#!/usr/bin/env node
// Walks packages/* and emits packages/<adapter>/faq.json with overrides for
// the seven FAQ questions surfaced by ui/src/components/Faq.jsx.
//
// The Faq component renders the override string with a paragraph splitter
// (blank lines), so each value is plain prose, not JSX or markdown — markdown
// bold/italic won't render. Use simple sentences.
//
// Usage:
//   node tools/generate-faqs.mjs [adapter ...]
//   node tools/generate-faqs.mjs --all
//
// With no args, defaults to --all.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function uniq(xs) {
  return [...new Set(xs.filter(Boolean))];
}

function joinList(items, conjunction = 'and') {
  const xs = items.filter(Boolean);
  if (xs.length === 0) return '';
  if (xs.length === 1) return xs[0];
  if (xs.length === 2) return `${xs[0]} ${conjunction} ${xs[1]}`;
  return `${xs.slice(0, -1).join(', ')}, ${conjunction} ${xs[xs.length - 1]}`;
}

function describeAuthScheme(s) {
  switch (s) {
    case 'basic':
      return 'HTTP Basic auth';
    case 'bearer':
      return 'bearer tokens';
    case 'api-key':
      return 'API keys';
    case 'oauth2':
      return 'OAuth 2.0';
    case 'oauth1':
      return 'OAuth 1.0a';
    case 'personal-access-token':
      return 'personal access tokens';
    case 'session':
      return 'session cookies';
    case 'jwt':
      return 'JWT';
    case 'mtls':
      return 'mutual TLS';
    case 'sas':
      return 'shared access signatures';
    case 'none':
      return 'no authentication';
    default:
      return s;
  }
}

function collectOps(ast) {
  const ops = Array.isArray(ast?.operations) ? ast.operations : [];
  return ops.map((o) => ({
    name: o.name,
    description: o.docs?.description || '',
  }));
}

function pickExampleOp(ops) {
  // Prefer a CRUD-ish read first, fall back to first op.
  const priorities = [
    /^get/i,
    /^list/i,
    /^find/i,
    /^search/i,
    /^fetch/i,
    /^create/i,
    /^upsert/i,
    /^update/i,
    /^post/i,
  ];
  for (const re of priorities) {
    const hit = ops.find((o) => re.test(o.name));
    if (hit) return hit.name;
  }
  return ops[0]?.name || 'operation';
}

function snippetSummary(raw) {
  if (!raw || typeof raw !== 'object') return { count: 0, categories: [] };
  const categories = [];
  let count = 0;
  for (const [cat, group] of Object.entries(raw)) {
    if (!group || typeof group !== 'object') continue;
    const titles = Object.keys(group);
    categories.push({ category: cat, count: titles.length });
    count += titles.length;
  }
  return { count, categories };
}

function triggerSummary(raw) {
  const triggers = Array.isArray(raw?.triggers) ? raw.triggers : [];
  const webhook = triggers.filter((t) => t.mechanism === 'webhook').length;
  const polling = triggers.filter((t) => t.mechanism === 'polling').length;
  const names = triggers.map((t) => t.name).filter(Boolean);
  return { total: triggers.length, webhook, polling, names };
}

function configSummary(schema) {
  if (!schema || typeof schema !== 'object') return { fields: [], required: [] };
  const props = schema.properties || {};
  const required = new Set(schema.required || []);
  const fields = Object.keys(props).map((k) => ({
    name: k,
    required: required.has(k),
    description: props[k]?.description || '',
  }));
  return { fields, required: [...required] };
}

function answerWhat(ctx) {
  const { label, vendor, product, pkgDesc, opCount, snippets, homepage } = ctx;
  const subject = product || vendor || label;
  const lead = pkgDesc
    ? `${pkgDesc.replace(/\.$/, '')}. The adaptor lets OpenFn workflows read from and write to ${subject}.`
    : `The ${label} adaptor lets OpenFn workflows read from and write to ${subject}.`;

  const opSentence =
    opCount > 0
      ? `It exposes ${opCount} operation${opCount === 1 ? '' : 's'} that you can call from a workflow step, listed in the Operations tab.`
      : `Operations haven't been parsed for this adaptor yet — see the Sources tab for vendor API docs.`;

  let snippetSentence = '';
  if (snippets.count > 0) {
    const cats = joinList(
      snippets.categories.map(
        (c) => `${c.category.toLowerCase()} (${c.count})`
      )
    );
    snippetSentence = ` ${snippets.count} ready-to-paste snippets are grouped as ${cats}.`;
  }

  const homepageSentence = homepage
    ? ` Vendor homepage: ${homepage}.`
    : '';

  return [lead, `${opSentence}${snippetSentence}${homepageSentence}`].join('\n\n');
}

function answerConnect(ctx) {
  const { label, vendor, auth, config, hasOauth, authDocs, baseUrls } = ctx;
  const schemes = auth?.schemes || [];
  const subject = vendor || label;

  const schemeText = schemes.length
    ? `${subject} supports ${joinList(schemes.map(describeAuthScheme), 'or')} for API access.`
    : `Authentication details for ${subject} aren't catalogued yet — check the Sources tab for the vendor's auth docs.`;

  const fieldLines = config.fields.length
    ? `The credential schema asks for ${joinList(
        config.fields.map(
          (f) => `${f.name}${f.required ? ' (required)' : ''}`
        )
      )}.`
    : 'No credential fields are published for this adaptor; check the Credentials tab once it lands.';

  const oauthSentence = hasOauth
    ? ' An OAuth flow is wired up — use the OAuth schema on the Credentials tab to provision tokens through OpenFn rather than handling refresh yourself.'
    : '';

  const baseUrlSentence = baseUrls.length
    ? ` Point the credential at the ${baseUrls.length === 1 ? 'base URL' : 'base URL that matches your environment'}: ${baseUrls.join(', ')}.`
    : '';

  const docsSentence = authDocs ? ` Auth reference: ${authDocs}.` : '';

  return [
    schemeText,
    `${fieldLines}${oauthSentence}${baseUrlSentence}${docsSentence}`,
  ].join('\n\n');
}

function answerWhen(ctx) {
  const { label, vendor, product, triggers, webhooksSupported, webhookDocs } = ctx;
  const subject = vendor || label;
  const purpose = product
    ? `data in ${product}`
    : `data in ${subject}`;

  const triggerSentence =
    triggers.total > 0
      ? `${triggers.total} trigger${triggers.total === 1 ? ' is' : 's are'} catalogued (${triggers.webhook} webhook, ${triggers.polling} polling)${
          triggers.names.length
            ? `, including ${triggers.names.slice(0, 4).join(', ')}${triggers.names.length > 4 ? ', and more' : ''}.`
            : '.'
        } See the Triggers tab for the full list.`
      : `Triggers haven't been catalogued yet — drive the workflow from a cron schedule or an upstream webhook in the meantime.`;

  const webhookSentence = webhooksSupported
    ? ` ${subject} can push events to OpenFn via webhooks${webhookDocs ? ` (docs: ${webhookDocs})` : ''}, so reactive workflows are a good fit.`
    : ` ${subject} doesn't appear to expose webhooks, so plan on polling at a sensible interval.`;

  return [
    `Reach for this adaptor when your workflow needs to read or write ${purpose}.`,
    `${triggerSentence}${webhookSentence}`,
  ].join('\n\n');
}

function answerHow(ctx) {
  const { packageName, exampleOp, snippets, ops } = ctx;
  const topOps = ops.slice(0, 3).map((o) => o.name);
  const importList = topOps.length ? topOps.join(', ') : exampleOp;

  const code = `import { ${importList} } from "${packageName}";\n\n${exampleOp}({ /* params */ });`;

  const snippetSentence =
    snippets.count > 0
      ? `The Snippets tab has ${snippets.count} ready-to-paste example${snippets.count === 1 ? '' : 's'} grouped by category — start there rather than from scratch.`
      : `Snippets haven't been seeded for this adaptor yet; the Operations tab shows each function's signature and JSDoc examples.`;

  return [
    `In a job step, import the adaptor and chain its operations. Each operation reads and writes to job state, so the response from one becomes the input to the next:`,
    code,
    snippetSentence,
  ].join('\n\n');
}

function answerWire(ctx) {
  const { label, vendor, triggers, webhooksSupported } = ctx;
  const subject = vendor || label;
  const triggerLine =
    triggers.total > 0
      ? `Kick the workflow off from a trigger on the Triggers tab (${webhooksSupported ? 'webhook-driven where supported, polling otherwise' : 'polled on a cron'}).`
      : `Drive the workflow from a cron schedule or an upstream webhook trigger.`;

  return [
    `A typical wiring pattern is trigger → fetch → transform → write.`,
    `${triggerLine} Then chain operations from this adaptor's Operations tab to fetch or write data in ${subject}. Pass values between steps through state.data — every operation reads from and writes to job state.`,
    `To move data between systems, follow this step with another adaptor (e.g. write the fetched records into a downstream FHIR, DHIS2, or database adaptor).`,
  ].join('\n\n');
}

function answerScale(ctx) {
  const { label, vendor, webhooksSupported, apiStyle, vendorNotes } = ctx;
  const subject = vendor || label;

  const lines = [
    webhooksSupported
      ? `Prefer ${subject} webhooks over polling — they cut latency and rate-limit pressure.`
      : `${subject} doesn't surface webhooks, so poll on the longest interval your SLA allows and use a since-cursor to avoid re-reading everything.`,
    apiStyle === 'rest'
      ? 'Paginate list and search calls explicitly; never assume a single response is the full result set.'
      : 'Batch requests where the API supports it and avoid fan-out loops over large collections.',
    'Make jobs idempotent by keying on stable external IDs so a replay doesn\'t create duplicates.',
    'Surface 4xx/5xx responses with the vendor request ID in your logs, and treat 429s as retries with backoff.',
  ];

  const vendorNote = vendorNotes ? `\n\nAdapter note: ${vendorNotes}` : '';

  return `When running ${subject} jobs at volume:\n\n- ${lines.join('\n- ')}${vendorNote}`;
}

function answerBest(ctx) {
  const { label, vendor, hasDataSchemas, version, packageName } = ctx;
  const subject = vendor || label;

  const lines = [
    `Store ${subject} credentials in OpenFn's credential store; never inline keys or tokens in job code.`,
    `Pin ${packageName}${version ? ` to v${version}` : ''} in package.json so an upstream change doesn't break a production workflow silently.`,
    `Keep each step small — one logical API call per operation makes failures easier to diagnose and retry.`,
    hasDataSchemas
      ? `Validate inbound trigger payloads against the schemas on the Data tab before transforming them; payloads can drift between vendor versions.`
      : `Add defensive checks before transforming inbound payloads — vendor responses change between versions.`,
    `Log enough context (resource id, run id, vendor request id) so an incident can be traced end-to-end.`,
  ];

  return `- ${lines.join('\n- ')}`;
}

function generateFor(name) {
  const pkgDir = path.join(PACKAGES_DIR, name);
  if (!fs.existsSync(pkgDir)) {
    console.error(`✗ ${name}: no such package`);
    return false;
  }

  const pkgJson = readJson(path.join(pkgDir, 'package.json')) || {};
  const metadata = readJson(path.join(pkgDir, 'metadata.json')) || {};
  const ast = readJson(path.join(pkgDir, 'ast.json'));
  const snippetsRaw = readJson(path.join(pkgDir, 'snippets.json'));
  const triggersRaw = readJson(path.join(pkgDir, 'triggers.json'));
  const configSchema = readJson(path.join(pkgDir, 'configuration-schema.json'));
  const oauthSchema = readJson(
    path.join(pkgDir, 'oauth-configuration-schema.json')
  );
  const hasDataSchemas = fs.existsSync(path.join(pkgDir, 'data-schemas'));

  const ops = collectOps(ast);
  const ctx = {
    name,
    label: pkgJson.label || name,
    packageName: pkgJson.name || `@openfn/language-${name}`,
    pkgDesc: pkgJson.description || '',
    version: pkgJson.version || null,
    vendor: metadata.vendor || '',
    product: metadata.product || '',
    homepage: metadata.homepage || pkgJson.homepage || '',
    auth: metadata.auth || { schemes: [] },
    authDocs: metadata.auth?.docs || '',
    baseUrls: Array.isArray(metadata.baseUrls) ? metadata.baseUrls : [],
    webhooksSupported: !!metadata.webhooks?.supported,
    webhookDocs: metadata.webhooks?.docs || '',
    apiStyle: metadata.apiStyle || 'rest',
    vendorNotes: metadata.notes || '',
    ops,
    opCount: ops.length,
    exampleOp: pickExampleOp(ops),
    snippets: snippetSummary(snippetsRaw),
    triggers: triggerSummary(triggersRaw),
    config: configSummary(configSchema),
    hasOauth: !!oauthSchema,
    hasDataSchemas,
  };

  const faq = {
    generatedAt: new Date().toISOString().slice(0, 10),
    source: 'tools/generate-faqs.mjs',
    what: answerWhat(ctx),
    connect: answerConnect(ctx),
    when: answerWhen(ctx),
    how: answerHow(ctx),
    wire: answerWire(ctx),
    scale: answerScale(ctx),
    best: answerBest(ctx),
  };

  fs.writeFileSync(
    path.join(pkgDir, 'faq.json'),
    JSON.stringify(faq, null, 2) + '\n'
  );
  return true;
}

const args = process.argv.slice(2);
let targets;
if (args.length === 0 || args.includes('--all')) {
  targets = fs
    .readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
} else {
  targets = args.filter((a) => !a.startsWith('--'));
}

let ok = 0;
for (const name of targets) {
  if (generateFor(name)) ok++;
}
console.log(`✓ wrote faq.json for ${ok} / ${targets.length} adapters`);
