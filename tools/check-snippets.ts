/**
 * Snippet coverage: which of an adaptor's API resources have at least one
 * snippet, measured by running the snippets.
 *
 *   coverage = resource groups a snippet reaches / resource groups in the spec
 *
 * A "resource group" is the grouping `endpoints.md` uses in openfn-api-specs
 * (first tag, else first path segment). Reading the path out of a snippet's
 * code is unreliable (adaptor helpers add prefixes: `create('trackedEntities')`
 * becomes `POST /api/tracker/...`), so each snippet is run instead:
 *
 *   1. boot the adaptor's openfn-mocker mock, with an exchange capture;
 *   2. run the snippet as a one-step job through the real `@openfn/cli` and the
 *      real published adaptor, with a credential pointing at the mock;
 *   3. match every request it made to a spec operation with `createConformer`
 *      from openfn-api-specs, and map each operation to its resource group
 *      with `operationResources()`.
 *
 * A snippet covers a resource if it sent a request to one of the resource's
 * operations, whether or not that request then passed the spec's schemas
 * (violations are recorded alongside, for a later confidence measure). Calls
 * the adaptor makes for itself (login, token, session) don't count.
 *
 * Output: packages/<adaptor>/snippet-coverage.json, read by
 * ui/scripts/build-manifest.mjs. Adaptors openfn-mocker doesn't mock, or with
 * no spec, get a file saying so (`measured: false`), so the UI can tell
 * "not measured" from "0%".
 *
 *   npx tsx tools/check-snippets.ts                      # every adaptor with snippets
 *   npx tsx tools/check-snippets.ts --adaptor=dhis2,asana
 *   npx tsx tools/check-snippets.ts --concurrency=6
 *
 * Needs: clones of openfn-mocker (with `pnpm install` run) and openfn-api-specs
 * (likewise), found at ../openfn-mocker and ../openfn-api-specs or via
 * MOCKER_DIR / SPECS_DIR; the OpenFn CLI on PATH (`npm i -g @openfn/cli`); and
 * root for the few systems that need host aliasing (it writes /etc/hosts
 * entries, removed on exit). The mock-harness parts follow
 * openfn-api-specs/experiments/bld-120/check.ts.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PACKAGES = join(ROOT, 'packages');
const arg = (k: string, d?: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;

const MOCKER_DIR = resolve(arg('mocker', process.env.MOCKER_DIR ?? join(ROOT, '../openfn-mocker'))!);
const SPECS_DIR = resolve(arg('specs', process.env.SPECS_DIR ?? join(ROOT, '../openfn-api-specs'))!);
const RUN_TIMEOUT_MS = Number(arg('timeout', '90000'));
const CONCURRENCY = Number(arg('concurrency', '4'));
const REPO_DIR = process.env.OPENFN_REPO_DIR ?? join(tmpdir(), 'storybook-snippet-adaptors');
const WORK_DIR = arg('work', join(tmpdir(), 'storybook-snippet-runs'))!;

// ---------------------------------------------------------------- deps

interface Exchange {
  method: string;
  path: string;
  status: number;
  requestBody?: unknown;
  responseBody?: unknown;
  [k: string]: unknown;
}
interface Violation {
  kind: string;
  operation?: string;
  exchange: string;
  message: string;
}

interface Deps {
  plugins: Record<string, any>;
  createSystemServer: (plugin: any, config: any, opts: any) => Promise<{ app: any }>;
  loadConfig: (path?: string) => any;
  resolveCredentialValues: (spec: any, opts: any) => Record<string, unknown>;
  systemVars: (guide: any, config: any) => Record<string, string>;
  attachExchangeCapture: (app: any) => { exchanges: Exchange[] };
  createConformer: (spec: any, opts?: any) => {
    check: (e: Exchange) => Violation[];
    match: (method: string, path: string) => { method: string; path: string } | undefined;
  };
  operationResources: (openapi: any) => Record<string, string>;
}

async function loadDeps(): Promise<Deps> {
  const imp = (dir: string, p: string) => import(pathToFileURL(join(dir, p)).href);
  const [server, systems, config, creds, conf, conform, endpoints] = await Promise.all([
    imp(MOCKER_DIR, 'src/server.ts'),
    imp(MOCKER_DIR, 'src/systems/index.ts'),
    imp(MOCKER_DIR, 'src/config.ts'),
    imp(MOCKER_DIR, 'src/credentials.ts'),
    imp(MOCKER_DIR, 'scripts/lib/conformance.ts'),
    imp(SPECS_DIR, 'src/conform.ts'),
    imp(SPECS_DIR, 'src/endpoints.ts'),
  ]);
  if (typeof endpoints.operationResources !== 'function') {
    throw new Error(`${SPECS_DIR} has no operationResources(); update the openfn-api-specs clone`);
  }
  return {
    plugins: systems.plugins,
    createSystemServer: server.createSystemServer,
    loadConfig: config.loadConfig,
    resolveCredentialValues: creds.resolveCredentialValues,
    systemVars: creds.systemVars,
    attachExchangeCapture: conf.attachExchangeCapture,
    createConformer: conform.createConformer,
    operationResources: endpoints.operationResources,
  };
}

/** Mock system key for an adaptor short name ('fhir-4' -> 'fhir' when a plugin says so). */
function systemFor(d: Deps, adaptor: string): string | undefined {
  if (d.plugins[adaptor] && !d.plugins[adaptor].adaptorName) return adaptor;
  return Object.keys(d.plugins).find((k) => (d.plugins[k].adaptorName ?? k) === adaptor);
}

// ---------------------------------------------------------------- mocks

interface RunningMock {
  configuration: Record<string, unknown>;
  exchanges: Exchange[];
  env: Record<string, string>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

const HOSTS = '/etc/hosts';
const HOSTS_MARK = '# storybook snippet check alias (safe to delete)';
const CERT_DIR = join(tmpdir(), 'storybook-snippet-alias-cert');

function cert(): { cert: string; key: string } {
  const c = join(CERT_DIR, 'cert.pem');
  const k = join(CERT_DIR, 'key.pem');
  if (!existsSync(c)) {
    mkdirSync(CERT_DIR, { recursive: true });
    spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', k, '-out', c, '-days', '3650', '-nodes', '-subj', '/CN=openfn-mocker']);
  }
  return { cert: readFileSync(c, 'utf8'), key: readFileSync(k, 'utf8') };
}

/**
 * Host aliasing for adaptors that derive hostnames from a `host` credential
 * (opencrvs: auth.<domain>, ...) or call a hardcoded public host (mailgun).
 * The base domain is a name (`<system>.mock.test`), since `auth.127.0.0.1` is
 * not a valid URL host.
 */
async function startAlias(plugin: any, backendPort: number) {
  if (!plugin.hostAliases?.length) return undefined;
  const base = `${plugin.name}.mock.test`;
  const hosts: string[] = [...new Set<string>(plugin.hostAliases.map((t: string) => t.replace('{host}', base)))];
  const current = readFileSync(HOSTS, 'utf8');
  const add = hosts.filter((h) => !current.includes(`127.0.0.1 ${h} `)).map((h) => `127.0.0.1 ${h} ${HOSTS_MARK}`);
  if (add.length) writeFileSync(HOSTS, current.replace(/\n?$/, '\n') + add.join('\n') + '\n');
  const explicitPort = plugin.credential?.fields?.some((f: any) => f.role === 'host');
  const server = https.createServer(cert(), (req, res) => {
    const up = http.request({ host: '127.0.0.1', port: backendPort, method: req.method, path: req.url, headers: req.headers }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    up.on('error', () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(up);
  });
  const port: number = await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(explicitPort ? 0 : 443, '0.0.0.0', () => ok((server.address() as any).port));
  });
  return {
    hostValue: explicitPort ? `${base}:${port}` : undefined,
    hosts,
    env: { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    close: () => new Promise<void>((ok) => server.close(() => ok())),
  };
}

async function startMock(d: Deps, system: string): Promise<RunningMock> {
  const plugin = d.plugins[system];
  let fromFile: any = {};
  try {
    fromFile = d.loadConfig(join(MOCKER_DIR, 'mock.config.yaml')).systems?.[system] ?? {};
  } catch {
    /* defaults */
  }
  const config = { ...fromFile, port: 0 };
  // Faults and latency off: one run per snippet, so an injected 500 would be noise.
  for (const k of ['error_rate', 'error_status', 'rate_limit', 'latency']) delete config[k];
  const { app } = await d.createSystemServer(plugin, config, { logLevel: 'warn', autoAuth: false });
  const { exchanges } = d.attachExchangeCapture(app);
  await app.listen({ port: 0, host: '127.0.0.1' });
  const port = (app.server.address() as any).port;
  const origin = `http://127.0.0.1:${port}`;
  const alias = await startAlias(plugin, port);
  const vars = { ...d.systemVars(plugin.guide, config), ORIGIN: origin };
  const configuration = d.resolveCredentialValues(plugin.credential, { url: origin, hostValue: alias?.hostValue, vars });
  const noProxy = ['127.0.0.1', 'localhost', ...(alias?.hosts ?? []), process.env.NO_PROXY].filter(Boolean).join(',');
  return {
    configuration,
    exchanges,
    env: { ...(alias?.env ?? {}), NO_PROXY: noProxy, no_proxy: noProxy },
    reset: async () => {
      exchanges.length = 0;
      await fetch(`${origin}/_admin/reset`, { method: 'POST' }).catch(() => undefined);
    },
    close: async () => {
      await alias?.close();
      await app.close();
    },
  };
}

function cleanupHosts() {
  try {
    const cur = readFileSync(HOSTS, 'utf8');
    if (cur.includes(HOSTS_MARK)) writeFileSync(HOSTS, cur.split('\n').filter((l) => !l.includes(HOSTS_MARK)).join('\n'));
  } catch {
    /* not writable: nothing was added */
  }
}

// ---------------------------------------------------------------- run

interface RunOutcome {
  ok: boolean;
  errors: string[];
  timedOut: boolean;
  /** Failed before any job code ran (adaptor install, network): not the snippet's fault. */
  infra: boolean;
}

/**
 * Snippets map from `$.data`, the trigger's input, which a bare run doesn't
 * have, so `$.data.indicators.map(...)` would throw before any request went
 * out. This prelude stands in a placeholder: any property read returns another
 * placeholder, which reads as an empty array when iterated or mapped and as
 * the string 'sample-<key>' when interpolated or serialised. The snippet then
 * reaches its request, which is all coverage needs to see.
 */
const SAMPLE_DATA = `fn(state => {
  const ARRAY = new Set(['map','filter','flatMap','forEach','reduce','some','every','find','findIndex','slice','concat','join','includes','indexOf','at','sort','flat','entries','keys','values']);
  const sample = (name) => new Proxy({}, {
    get(t, k) {
      if (k === 'then' || k === 'constructor' || k === Symbol.asyncIterator) return undefined;
      if (k === Symbol.toPrimitive || k === 'toString' || k === 'valueOf' || k === 'toJSON') return () => 'sample-' + name;
      if (k === Symbol.iterator) return [][Symbol.iterator].bind([]);
      if (k === 'length') return 0;
      if (typeof k === 'string' && ARRAY.has(k)) return Array.prototype[k].bind([]);
      if (typeof k === 'symbol') return undefined;
      return sample(k);
    },
  });
  state.data = sample('data');
  return state;
});
`;

function runSnippet(
  adaptor: string,
  version: string,
  code: string,
  configuration: Record<string, unknown>,
  env: Record<string, string>,
  dir: string
): Promise<RunOutcome> {
  mkdirSync(dir, { recursive: true });
  const wf = {
    workflow: {
      steps: [{ id: 'snippet', adaptor: `@openfn/language-${adaptor}@${version}`, configuration, expression: SAMPLE_DATA + code + '\n' }],
    },
  };
  const wfPath = join(dir, 'workflow.json');
  const outPath = join(dir, 'out.json');
  writeFileSync(wfPath, JSON.stringify(wf, null, 2));
  return new Promise((done) => {
    const child = spawn('openfn', [wfPath, '-o', outPath], { detached: true, env: { ...process.env, OPENFN_REPO_DIR: REPO_DIR, ...env } });
    let log = '';
    child.stdout.on('data', (b) => (log += b));
    child.stderr.on('data', (b) => (log += b));
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, RUN_TIMEOUT_MS);
    child.on('close', (code) => {
      clearTimeout(timer);
      writeFileSync(join(dir, 'run.log'), log);
      let state: any = {};
      try {
        state = JSON.parse(readFileSync(outPath, 'utf8'));
      } catch {
        /* none written */
      }
      const errors = Object.values(state?.errors ?? {}).map((e: any) => e?.message ?? String(e));
      const fatal = log.match(/(CRITICAL ERROR[^\n]*|[✗×][^\n]*)/g) ?? [];
      const started = /√ snippet completed|snippet/.test(log) && !/Failed to install|Command failed: npm install/.test(log);
      done({
        ok: code === 0 && !timedOut && errors.length === 0 && fatal.length === 0,
        errors: [...errors, ...fatal].map((e) => String(e).slice(0, 300)).slice(0, 3),
        timedOut,
        infra: /Command failed: npm install|ETIMEDOUT|EAI_AGAIN|Failed to install|E403|E404/.test(log) && !started,
      });
    });
  });
}

// ---------------------------------------------------------------- judge

/**
 * Calls an adaptor makes for itself to authenticate: the snippet's author
 * didn't choose them. Narrower than bld-120's filter on purpose: `sessions`
 * is left out because it is also a business resource (Stripe checkout sessions).
 */
const isAuth = (e: Exchange) =>
  /(^|\/)(login|logout|token|accesstoken|oauth2?|auth|authenticate)(\/|$|\?)/i.test(e.path.split('?')[0]);

/**
 * The mock's credential can point an adaptor one level deeper than the spec's
 * paths begin (spec paths are /api/products, the base URL already ends in
 * /api). When an exchange matches nothing, retry behind the spec's dominant
 * leading path segment.
 */
function leadingPrefix(spec: any): string | undefined {
  const firsts = Object.keys(spec?.paths ?? {}).map((p) => p.split('/')[1]).filter(Boolean);
  const counts = new Map<string, number>();
  for (const f of firsts) counts.set(f, (counts.get(f) ?? 0) + 1);
  const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
  return top && n / firsts.length > 0.5 && !top.includes('{') ? `/${top}` : undefined;
}

export interface SnippetResult {
  category: string;
  title: string;
  /** ok: ran clean; error: the job threw (it may still have made requests); infra: never got to run. */
  run: 'ok' | 'error' | 'infra';
  error?: string;
  /** Spec operations the snippet's requests matched, as 'METHOD /template'. */
  operations: string[];
  /** Resource groups those operations belong to. */
  resources: string[];
  /** Requests that matched no spec operation. */
  offSpec: string[];
  /** Schema violations on requests that did match (request/response body, status, media type). */
  violations: number;
}

export interface SnippetCoverage {
  $comment: string;
  adaptor: string;
  adaptorVersion: string;
  checkedAt: string;
  measured: boolean;
  /** Why not measured: no-mock (openfn-mocker doesn't mock this system) or no-spec. */
  reason?: 'no-mock' | 'no-spec' | 'no-resources';
  snippetCount: number;
  spec?: { operations: number; resourceGroups: number };
  covered?: string[];
  coveredCount?: number;
  /** coveredCount / spec.resourceGroups, as a percentage to one decimal place. */
  percent?: number;
  snippets?: SnippetResult[];
}

const COMMENT =
  'Generated by `npx tsx tools/check-snippets.ts`; do not edit by hand. Snippet coverage = resource groups ' +
  '(as in openfn-api-specs endpoints.md) that at least one snippet sends a request to, out of all resource groups in the spec.';

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

function readSnippets(adaptor: string): { category: string; title: string; code: string }[] {
  const raw = JSON.parse(readFileSync(join(PACKAGES, adaptor, 'snippets.json'), 'utf8'));
  const out: { category: string; title: string; code: string }[] = [];
  for (const [category, group] of Object.entries<any>(raw ?? {})) {
    if (!group || typeof group !== 'object') continue;
    for (const [title, body] of Object.entries<any>(group)) {
      if (typeof body?.code === 'string' && body.code.trim()) out.push({ category, title, code: body.code });
    }
  }
  return out;
}

async function checkAdaptor(d: Deps, adaptor: string): Promise<SnippetCoverage> {
  const pkg = JSON.parse(readFileSync(join(PACKAGES, adaptor, 'package.json'), 'utf8'));
  const version: string = pkg.version ?? 'latest';
  const snippets = readSnippets(adaptor);
  const base: SnippetCoverage = {
    $comment: COMMENT,
    adaptor,
    adaptorVersion: version,
    checkedAt: new Date().toISOString().slice(0, 10),
    measured: false,
    snippetCount: snippets.length,
  };
  const specPath = join(SPECS_DIR, 'specs/adaptors', adaptor, 'openapi.json');
  if (!existsSync(specPath)) return { ...base, reason: 'no-spec' };
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const resourceOf = d.operationResources(spec);
  const groups = new Set(Object.values(resourceOf));
  if (!groups.size) return { ...base, reason: 'no-resources' };
  const system = systemFor(d, adaptor);
  if (!system) return { ...base, reason: 'no-mock', spec: { operations: Object.keys(resourceOf).length, resourceGroups: groups.size } };

  const conformer = d.createConformer(spec);
  const prefix = leadingPrefix(spec);
  const mock = await startMock(d, system);
  const results: SnippetResult[] = [];
  try {
    for (const [i, s] of snippets.entries()) {
      await mock.reset();
      const run = await runSnippet(adaptor, version, s.code, mock.configuration, mock.env, join(WORK_DIR, adaptor, String(i)));
      const own = mock.exchanges.filter((e) => !isAuth(e));
      const operations = new Set<string>();
      const offSpec = new Set<string>();
      let violations = 0;
      for (const e of own) {
        let ex = e;
        let m = conformer.match(e.method, e.path);
        if (!m && prefix && !e.path.startsWith(prefix + '/')) {
          ex = { ...e, path: prefix + e.path };
          m = conformer.match(ex.method, ex.path);
        }
        if (!m) {
          offSpec.add(`${e.method.toUpperCase()} ${e.path.split('?')[0]}`);
          continue;
        }
        const op = `${m.method.toUpperCase()} ${m.path}`;
        operations.add(op);
        violations += conformer.check(ex).length;
      }
      const resources = [...new Set([...operations].map((o) => resourceOf[o]).filter(Boolean))].sort();
      results.push({
        category: s.category,
        title: s.title,
        run: run.infra ? 'infra' : run.ok ? 'ok' : 'error',
        ...(run.ok ? {} : { error: run.timedOut ? 'timed out' : run.errors[0] ?? 'failed' }),
        operations: [...operations].sort(),
        resources,
        offSpec: [...offSpec].sort(),
        violations,
      });
    }
  } finally {
    await mock.close();
  }
  const covered = [...new Set(results.flatMap((r) => r.resources))].sort();
  return {
    ...base,
    measured: true,
    spec: { operations: Object.keys(resourceOf).length, resourceGroups: groups.size },
    covered,
    coveredCount: covered.length,
    percent: pct(covered.length, groups.size),
    snippets: results,
  };
}

// ---------------------------------------------------------------- main

async function main() {
  const only = arg('adaptor')?.split(',').map((s) => s.trim()).filter(Boolean);
  const adaptors = readdirSync(PACKAGES)
    .filter((a) => existsSync(join(PACKAGES, a, 'snippets.json')))
    .filter((a) => !only || only.includes(a))
    .sort();
  const d = await loadDeps();
  process.on('exit', cleanupHosts);
  process.on('SIGINT', () => process.exit(130));

  // Systems that alias hosts may bind :443, so they run one at a time; the rest in parallel.
  const aliased = adaptors.filter((a) => {
    const s = systemFor(d, a);
    return s && d.plugins[s].hostAliases?.length;
  });
  const parallel = adaptors.filter((a) => !aliased.includes(a));
  console.log(`${adaptors.length} adaptor(s) with snippets (mocker: ${MOCKER_DIR}, specs: ${SPECS_DIR})`);

  const one = async (a: string) => {
    let r: SnippetCoverage;
    try {
      r = await checkAdaptor(d, a);
    } catch (err: any) {
      console.log(`${a}: checker error: ${err.message}`);
      return;
    }
    writeFileSync(join(PACKAGES, a, 'snippet-coverage.json'), JSON.stringify(r, null, 2) + '\n');
    const ran = r.snippets ? `${r.snippets.filter((s) => s.run === 'ok').length}/${r.snippets.length} ran clean` : '';
    console.log(
      r.measured
        ? `${a}: ${r.coveredCount}/${r.spec!.resourceGroups} resources (${r.percent}%), ${ran}`
        : `${a}: not measured (${r.reason})`
    );
  };

  // Install every adaptor version up front, one at a time: parallel npm
  // installs into the shared module repo corrupt each other.
  for (const a of adaptors) {
    if (!systemFor(d, a) || !existsSync(join(SPECS_DIR, 'specs/adaptors', a, 'openapi.json'))) continue;
    const v = JSON.parse(readFileSync(join(PACKAGES, a, 'package.json'), 'utf8')).version ?? 'latest';
    const r = spawnSync('openfn', ['repo', 'install', `@openfn/language-${a}@${v}`, '--repo-dir', REPO_DIR], { encoding: 'utf8' });
    if (r.status !== 0) console.log(`${a}: install of ${v} failed; its runs will be marked infra`);
  }

  const queue = [...parallel];
  const workers = Array.from({ length: Math.max(1, CONCURRENCY) }, async () => {
    while (queue.length) await one(queue.shift()!);
  });
  const serial = (async () => {
    for (const a of aliased) await one(a);
  })();
  await Promise.all([...workers, serial]);
  cleanupHosts();
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
