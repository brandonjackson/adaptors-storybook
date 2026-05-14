#!/usr/bin/env node
// Pulls a vendor's OpenAPI spec (per packages/<adapter>/metadata.json) and writes
// JSON Schema files into packages/<adapter>/data-schemas/ for every trigger that
// names a schemaRef.
//
// Usage:
//   node tools/ingest-openapi.mjs <adapter> [--refresh]
//   node tools/ingest-openapi.mjs --all      # every adapter with openapi + schemaRefs
//
// The fetched spec is cached at .cache/openapi/<adapter>.(json|yaml) so reruns
// are offline-fast. Pass --refresh to ignore the cache.
//
// Each trigger in packages/<adapter>/triggers.json may carry
//   output.schemaRef: "Charge"            // points at components.schemas.Charge
// When present, this script extracts that schema, resolves internal $refs
// (with cycle protection — repeat visits become {"$ref": "#/.../Name"}), and
// writes packages/<adapter>/data-schemas/<schemaRef>.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');
const CACHE_DIR = path.join(REPO_ROOT, '.cache', 'openapi');

// How many ref-hops to inline before bottoming out as a $ref stub. Stripe's
// OpenAPI cross-references everything; even depth=2 blows up to multi-MB per
// schema. Depth 1 keeps the top-level fields readable while leaving nested
// resources as references the UI can link to.
const MAX_INLINE_DEPTH = 1;

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function fetchToCache(url, dest, refresh) {
  if (!refresh && fs.existsSync(dest)) return fs.readFileSync(dest, 'utf8');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  console.log(`  fetching ${url}`);
  const res = await fetch(url);
  if (!res.ok) die(`fetch failed: ${res.status} ${res.statusText}`);
  const body = await res.text();
  fs.writeFileSync(dest, body);
  return body;
}

function parseYaml(text) {
  // Shell out to python3 + pyyaml — pure-JS yaml parsing would mean adding a dep.
  const out = spawnSync(
    'python3',
    ['-c', 'import sys, yaml, json; json.dump(yaml.safe_load(sys.stdin), sys.stdout)'],
    { input: text, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }
  );
  if (out.status !== 0) die(`yaml parse failed: ${out.stderr}`);
  return JSON.parse(out.stdout);
}

function loadSpec(adapter, source, refresh) {
  const ext = source.format === 'yaml' ? 'yaml' : 'json';
  const cacheFile = path.join(CACHE_DIR, `${adapter}.${ext}`);
  return fetchToCache(source.url, cacheFile, refresh).then((text) =>
    ext === 'yaml' ? parseYaml(text) : JSON.parse(text)
  );
}

function resolvePointer(root, pointer) {
  // JSON Pointer like "#/components/schemas/Charge"
  if (!pointer.startsWith('#/')) return null;
  const parts = pointer.slice(2).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur = root;
  for (const p of parts) {
    if (cur == null) return null;
    cur = cur[p];
  }
  return cur;
}

function inlineRefs(node, root, seen = new Set(), depth = 0) {
  if (node == null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map((x) => inlineRefs(x, root, seen, depth));
  if (typeof node.$ref === 'string') {
    const ref = node.$ref;
    if (seen.has(ref) || depth >= MAX_INLINE_DEPTH) return { $ref: ref };
    const target = resolvePointer(root, ref);
    if (target == null) return { $ref: ref };
    const nextSeen = new Set(seen).add(ref);
    const inlined = inlineRefs(target, root, nextSeen, depth + 1);
    if (inlined && typeof inlined === 'object' && !Array.isArray(inlined)) {
      return { 'x-openapi-ref': ref, ...inlined };
    }
    return inlined;
  }
  const out = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = inlineRefs(v, root, seen, depth);
  }
  return out;
}

function extractSchema(spec, schemaRef) {
  // schemaRef can be "Charge" (components.schemas.Charge) or a full pointer.
  let target;
  if (schemaRef.startsWith('#/')) {
    target = resolvePointer(spec, schemaRef);
  } else {
    const schemas =
      spec?.components?.schemas ??
      spec?.definitions ?? // swagger 2.0
      {};
    target = schemas[schemaRef];
  }
  if (!target) return null;
  return inlineRefs(target, spec, new Set([`#/components/schemas/${schemaRef}`]), 0);
}

function listAdapters() {
  return fs
    .readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function getOpenapiSource(metadata) {
  if (!metadata?.sources) return null;
  return metadata.sources.find(
    (s) => s.kind === 'openapi' && s.url && s.url.startsWith('http')
  );
}

function collectSchemaRefs(triggersDoc) {
  if (!triggersDoc?.triggers) return [];
  const seen = new Set();
  const refs = [];
  for (const t of triggersDoc.triggers) {
    const ref = t.output?.schemaRef;
    if (typeof ref === 'string' && !seen.has(ref)) {
      seen.add(ref);
      refs.push(ref);
    }
  }
  return refs;
}

async function ingestAdapter(adapter, { refresh }) {
  const pkgDir = path.join(PACKAGES_DIR, adapter);
  const metaPath = path.join(pkgDir, 'metadata.json');
  const triggersPath = path.join(pkgDir, 'triggers.json');
  if (!fs.existsSync(metaPath)) return { adapter, skipped: 'no metadata.json' };
  if (!fs.existsSync(triggersPath)) return { adapter, skipped: 'no triggers.json' };

  const metadata = readJson(metaPath);
  const triggers = readJson(triggersPath);
  const refs = collectSchemaRefs(triggers);
  if (refs.length === 0) return { adapter, skipped: 'no schemaRef in triggers' };

  const source = getOpenapiSource(metadata);
  if (!source) return { adapter, skipped: 'no openapi source in metadata' };

  console.log(`▸ ${adapter}: ${refs.length} schema(s) to extract`);
  const spec = await loadSpec(adapter, source, refresh);

  const outDir = path.join(pkgDir, 'data-schemas');
  fs.mkdirSync(outDir, { recursive: true });

  const written = [];
  const missing = [];
  for (const ref of refs) {
    const schema = extractSchema(spec, ref);
    if (!schema) {
      missing.push(ref);
      continue;
    }
    const filename = ref.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const out = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: `${adapter}/${filename}`,
      'x-source': {
        adapter,
        openapi: source.url,
        component: ref,
        ingestedAt: new Date().toISOString().slice(0, 10),
      },
      ...schema,
    };
    fs.writeFileSync(
      path.join(outDir, `${filename}.json`),
      JSON.stringify(out, null, 2) + '\n'
    );
    written.push(filename);
  }

  return { adapter, written, missing };
}

async function main() {
  const args = process.argv.slice(2);
  const refresh = args.includes('--refresh');
  const all = args.includes('--all');
  const targets = all
    ? listAdapters()
    : args.filter((a) => !a.startsWith('--'));

  if (targets.length === 0) {
    die('usage: node tools/ingest-openapi.mjs <adapter> [--refresh]   |   --all');
  }

  const results = [];
  for (const adapter of targets) {
    try {
      results.push(await ingestAdapter(adapter, { refresh }));
    } catch (err) {
      console.error(`✗ ${adapter}: ${err.message}`);
      results.push({ adapter, error: err.message });
    }
  }

  console.log('\nSummary:');
  for (const r of results) {
    if (r.skipped) {
      if (!all) console.log(`  ${r.adapter}: skipped — ${r.skipped}`);
    } else if (r.error) {
      console.log(`  ${r.adapter}: error — ${r.error}`);
    } else {
      console.log(
        `  ${r.adapter}: wrote ${r.written.length}` +
          (r.missing.length ? `, missing ${r.missing.join(', ')}` : '')
      );
    }
  }
}

main().catch((err) => die(err.stack || err.message));
