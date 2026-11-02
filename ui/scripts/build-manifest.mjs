// Walks packages/* and emits ui/public/adapters/<name>/{manifest.json, README.md, square.png, rectangle.png}
// plus ui/public/adapters/index.json (an array of adapter summaries for the left-nav).
// Running it from the ui/ directory; resolves the repo root via ../packages.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'adapters');

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function readTextSafe(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function copyIfExists(src, dest) {
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return true;
  }
  return false;
}

function buildDataSchemas(pkgDir, outPkgDir, adapter) {
  // packages/<a>/data-schemas/*.json — each file is a JSON Schema. We copy
  // them into ui/public/adapters/<a>/data-schemas/ for lazy fetch, and return
  // a lightweight summary so the manifest stays small.
  const srcDir = path.join(pkgDir, 'data-schemas');
  if (!fs.existsSync(srcDir)) return [];
  const outDir = path.join(outPkgDir, 'data-schemas');
  fs.mkdirSync(outDir, { recursive: true });
  const summaries = [];
  for (const f of fs.readdirSync(srcDir)) {
    if (!f.endsWith('.json')) continue;
    const id = f.replace(/\.json$/, '');
    const schema = readJsonSafe(path.join(srcDir, f));
    if (!schema) continue;
    fs.copyFileSync(path.join(srcDir, f), path.join(outDir, f));
    summaries.push({
      id,
      title: schema.title || id,
      description:
        typeof schema.description === 'string'
          ? schema.description.split('\n').slice(0, 4).join('\n')
          : '',
      type: schema.type || null,
      propertyCount: schema.properties
        ? Object.keys(schema.properties).length
        : null,
      source: schema['x-source'] || null,
      path: `adapters/${adapter}/data-schemas/${f}`,
    });
  }
  summaries.sort((a, b) => a.id.localeCompare(b.id));
  return summaries;
}

function buildSnippetSummary(raw) {
  if (!raw || typeof raw !== 'object') return [];
  const out = [];
  for (const [category, group] of Object.entries(raw)) {
    if (!group || typeof group !== 'object') continue;
    for (const [title, body] of Object.entries(group)) {
      out.push({
        category,
        title,
        description: body?.description || '',
        code: body?.code || '',
      });
    }
  }
  return out;
}

function buildTriggerSummary(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const triggers = Array.isArray(raw.triggers) ? raw.triggers : [];
  return {
    source: raw.source || null,
    sourceUrl: raw.sourceUrl || null,
    scrapedAt: raw.scrapedAt || null,
    notes: raw.notes || null,
    triggers,
  };
}

function buildOperationSummary(ast) {
  if (!ast || !Array.isArray(ast.operations)) return [];
  return ast.operations.map((op) => {
    const description =
      op.docs?.description ||
      op.docs?.tags?.find?.((t) => t.title === 'description')?.description ||
      '';
    const examples = (op.docs?.tags || [])
      .filter((t) => t.title === 'example')
      .map((t) => ({ caption: t.caption || '', code: t.description || '' }));
    return {
      name: op.name,
      params: op.params || [],
      description,
      examples,
    };
  });
}

// Spec and mock coverage, synced from openfn-api-specs and openfn-mocker by
// tools/sync-coverage.mjs; snippet coverage from each package's
// snippet-coverage.json (tools/check-snippets.ts). All three measure against
// the same thing, the adaptor's spec in openfn-api-specs.
const COVERAGE_DIR = path.join(REPO_ROOT, 'status');
const specCoverage = readJsonSafe(path.join(COVERAGE_DIR, 'specs.json'));
const mockCoverage = readJsonSafe(path.join(COVERAGE_DIR, 'mocks.json'));
const STALE_DAYS = 90;

const pct1 = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);

function buildCoverage(name, snippetCoverage) {
  const spec = specCoverage?.adaptors?.[name] ?? null;
  const mock = mockCoverage?.adaptors?.[name] ?? null;
  const clock = spec?.lastCheckedAt || spec?.capturedAt;
  const ageDays = clock ? Math.floor((Date.now() - Date.parse(clock)) / 86400000) : null;
  return {
    spec: spec && spec.hasOpenapi
      ? {
          origin: spec.origin,
          upstreamFormat: spec.upstreamFormat,
          // complete | best-effort | null (no claim made)
          completeness: spec.completeness,
          completenessReason: spec.completenessReason,
          // full | subset | null
          coverage: spec.coverage,
          operations: spec.operations,
          resourceGroups: spec.resourceGroups,
          lastCheckedAt: clock || null,
          stale: ageDays !== null && ageDays > STALE_DAYS,
        }
      : null,
    mock: mock
      ? {
          system: mock.system,
          exercised: mock.exercised,
          specOperations: mock.specOperations,
          percent: mock.percent,
          routes: mock.routes,
          verified: mock.verified,
        }
      : null,
    snippets: snippetCoverage
      ? snippetCoverage.measured
        ? {
            measured: true,
            covered: snippetCoverage.coveredCount,
            resourceGroups: snippetCoverage.spec.resourceGroups,
            percent: snippetCoverage.percent,
            resources: snippetCoverage.covered,
            ranClean: snippetCoverage.snippets.filter((s) => s.run === 'ok').length,
            snippetCount: snippetCoverage.snippets.length,
            checkedAt: snippetCoverage.checkedAt,
          }
        : { measured: false, reason: snippetCoverage.reason, checkedAt: snippetCoverage.checkedAt }
      : spec?.hasOpenapi && spec.resourceGroups
        ? // No snippets at all: nothing covered, which is 0%, not "unknown".
          {
            measured: true,
            covered: 0,
            resourceGroups: spec.resourceGroups,
            percent: 0,
            resources: [],
            ranClean: 0,
            snippetCount: 0,
            checkedAt: null,
          }
        : null,
    sources: {
      specs: specCoverage?.source ?? null,
      mocks: mockCoverage?.source ?? null,
    },
  };
}

if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const pkgNames = fs
  .readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const summaries = [];

for (const name of pkgNames) {
  const pkgDir = path.join(PACKAGES_DIR, name);
  const pkgJson = readJsonSafe(path.join(pkgDir, 'package.json')) || {};
  const configSchema =
    readJsonSafe(path.join(pkgDir, 'configuration-schema.json')) || null;
  const oauthSchema =
    readJsonSafe(path.join(pkgDir, 'oauth-configuration-schema.json')) || null;
  const ast = readJsonSafe(path.join(pkgDir, 'ast.json')) || null;
  const snippetsRaw =
    readJsonSafe(path.join(pkgDir, 'snippets.json')) || null;
  const triggersRaw =
    readJsonSafe(path.join(pkgDir, 'triggers.json')) || null;
  const metadata = readJsonSafe(path.join(pkgDir, 'metadata.json')) || null;
  const snippetCoverage =
    readJsonSafe(path.join(pkgDir, 'snippet-coverage.json')) || null;
  const faq = readJsonSafe(path.join(pkgDir, 'faq.json')) || null;
  const readme = readTextSafe(path.join(pkgDir, 'README.md')) || '';

  const outPkgDir = path.join(OUT_DIR, name);
  fs.mkdirSync(outPkgDir, { recursive: true });

  const hasSquare = copyIfExists(
    path.join(pkgDir, 'assets', 'square.png'),
    path.join(outPkgDir, 'square.png')
  );
  const hasRectangle = copyIfExists(
    path.join(pkgDir, 'assets', 'rectangle.png'),
    path.join(outPkgDir, 'rectangle.png')
  );

  const operations = buildOperationSummary(ast);
  const snippets = buildSnippetSummary(snippetsRaw);
  // Attach each snippet's measured result (which resources it reached).
  if (snippetCoverage?.snippets) {
    const byKey = new Map(
      snippetCoverage.snippets.map((r) => [`${r.category}\u0000${r.title}`, r])
    );
    for (const s of snippets) {
      const r = byKey.get(`${s.category}\u0000${s.title}`);
      if (r) s.check = { run: r.run, resources: r.resources, offSpec: r.offSpec, error: r.error || null };
    }
  }
  const coverage = buildCoverage(name, snippetCoverage);
  const triggersInfo = buildTriggerSummary(triggersRaw);
  const triggerCount = triggersInfo ? triggersInfo.triggers.length : 0;
  const dataSchemas = buildDataSchemas(pkgDir, outPkgDir, name);

  const manifest = {
    name,
    label: pkgJson.label || name,
    packageName: pkgJson.name || `@openfn/language-${name}`,
    version: pkgJson.version || null,
    description: pkgJson.description || '',
    homepage: pkgJson.homepage || null,
    repository: pkgJson.repository || null,
    icons: {
      square: hasSquare ? `adapters/${name}/square.png` : null,
      rectangle: hasRectangle ? `adapters/${name}/rectangle.png` : null,
    },
    configurationSchema: configSchema,
    oauthConfigurationSchema: oauthSchema,
    operations,
    operationCount: operations.length,
    snippets,
    snippetCount: snippets.length,
    triggers: triggersInfo,
    triggerCount,
    dataSchemas,
    dataSchemaCount: dataSchemas.length,
    metadata,
    coverage,
    faq,
    readmePath: `adapters/${name}/README.md`,
  };

  fs.writeFileSync(
    path.join(outPkgDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  if (readme) fs.writeFileSync(path.join(outPkgDir, 'README.md'), readme);

  const sourceKinds = Array.isArray(metadata?.sources)
    ? Array.from(
        new Set(
          metadata.sources
            .filter((s) => s && s.kind && s.url)
            .map((s) => s.kind)
        )
      ).sort()
    : [];

  summaries.push({
    name,
    label: manifest.label,
    description: manifest.description,
    operationCount: manifest.operationCount,
    snippetCount: manifest.snippetCount,
    triggerCount: manifest.triggerCount,
    dataSchemaCount: manifest.dataSchemaCount,
    icon: manifest.icons.square,
    status: metadata?.status || null,
    apiStyle: metadata?.apiStyle || null,
    hasMetadata: Boolean(metadata),
    hasConfigurationSchema: Boolean(configSchema),
    hasOauthSchema: Boolean(oauthSchema),
    hasReadme: Boolean(readme && readme.trim()),
    webhooksSupported: Boolean(metadata?.webhooks?.supported),
    sourceKinds,
    coverage: {
      spec: coverage.spec
        ? {
            completeness: coverage.spec.completeness,
            origin: coverage.spec.origin,
            stale: coverage.spec.stale,
            operations: coverage.spec.operations,
            resourceGroups: coverage.spec.resourceGroups,
          }
        : null,
      mock: coverage.mock
        ? {
            exercised: coverage.mock.exercised,
            specOperations: coverage.mock.specOperations,
            percent: coverage.mock.percent,
          }
        : null,
      snippets: coverage.snippets
        ? coverage.snippets.measured
          ? {
              measured: true,
              covered: coverage.snippets.covered,
              resourceGroups: coverage.snippets.resourceGroups,
              percent: coverage.snippets.percent,
            }
          : { measured: false, reason: coverage.snippets.reason }
        : null,
    },
  });
}

fs.writeFileSync(
  path.join(OUT_DIR, 'index.json'),
  JSON.stringify(summaries, null, 2)
);

console.log(`Wrote manifest for ${summaries.length} adapters to ${OUT_DIR}`);
