// Pull spec and mock coverage from the two sibling repos into status/, where
// ui/scripts/build-manifest.mjs reads them.
//
//   status/specs.json  from openfn-api-specs  specs/adaptors/manifest.json
//   status/mocks.json  from openfn-mocker     coverage.json
//
// Snippet coverage is not synced: it lives next to the snippets, in
// packages/<adaptor>/snippet-coverage.json (tools/check-snippets.ts).
//
// Sources default to each repo's main branch on GitHub, so the Pages deploy
// always shows the latest. Point at local clones with SPECS_DIR / MOCKER_DIR
// (or --local, which uses ../openfn-api-specs and ../openfn-mocker). On a
// fetch failure the committed copy is kept and the script exits non-zero.
//
//   node tools/sync-coverage.mjs
//   node tools/sync-coverage.mjs --local

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'status');
const local = process.argv.includes('--local');
const SPECS_DIR = process.env.SPECS_DIR || (local ? path.join(ROOT, '../openfn-api-specs') : null);
const MOCKER_DIR = process.env.MOCKER_DIR || (local ? path.join(ROOT, '../openfn-mocker') : null);
const RAW = 'https://raw.githubusercontent.com/brandonjackson';

async function load(dir, rel, url) {
  if (dir) return { json: JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')), from: path.join(dir, rel) };
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return { json: await res.json(), from: url };
}

function specsFrom(manifest, from) {
  const adaptors = {};
  for (const e of manifest.adaptors ?? []) {
    adaptors[e.adaptor] = {
      hasOpenapi: Boolean(e.hasOpenapi),
      rest: e.rest ?? null,
      origin: e.origin ?? null,
      upstreamFormat: e.upstreamFormat ?? null,
      coverage: e.coverage ?? null,
      completeness: e.completeness ?? null,
      completenessReason: e.completenessReason ?? null,
      operations: e.operations ?? null,
      resourceGroups: e.resourceGroups ?? null,
      capturedAt: e.capturedAt ?? null,
      lastCheckedAt: e.lastCheckedAt ?? null,
    };
  }
  return {
    $comment: 'Synced from openfn-api-specs by `node tools/sync-coverage.mjs`; do not edit by hand.',
    source: from,
    dataUpdatedAt: manifest.dataUpdatedAt ?? null,
    adaptors,
  };
}

function mocksFrom(summary, from) {
  // Keyed by adaptor. Two mock systems for one adaptor would be unusual; keep
  // the one that exercises more of the spec.
  const adaptors = {};
  for (const s of summary.systems ?? []) {
    const prev = adaptors[s.adaptor];
    if (prev && prev.exercised >= s.exercised) continue;
    adaptors[s.adaptor] = {
      system: s.system,
      specOperations: s.specOperations,
      exercised: s.exercised,
      percent: s.percent,
      routes: s.routes,
      verified: s.verified,
      counts: s.counts,
    };
  }
  return {
    $comment: 'Synced from openfn-mocker by `node tools/sync-coverage.mjs`; do not edit by hand.',
    source: from,
    totals: summary.totals ?? null,
    adaptors,
  };
}

const write = (name, data) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2) + '\n');
};

let failed = false;
try {
  const { json, from } = await load(SPECS_DIR, 'specs/adaptors/manifest.json', `${RAW}/openfn-api-specs/main/specs/adaptors/manifest.json`);
  const out = specsFrom(json, SPECS_DIR ? 'openfn-api-specs (local clone)' : from);
  write('specs.json', out);
  console.log(`status/specs.json: ${Object.keys(out.adaptors).length} adaptor(s) from ${from}`);
} catch (err) {
  failed = true;
  console.error(`specs: ${err.message}; keeping the committed status/specs.json`);
}
try {
  const { json, from } = await load(MOCKER_DIR, 'coverage.json', `${RAW}/openfn-mocker/main/coverage.json`);
  const out = mocksFrom(json, MOCKER_DIR ? 'openfn-mocker (local clone)' : from);
  write('mocks.json', out);
  console.log(`status/mocks.json: ${Object.keys(out.adaptors).length} adaptor(s) from ${from}`);
} catch (err) {
  failed = true;
  console.error(`mocks: ${err.message}; keeping the committed status/mocks.json`);
}
process.exit(failed ? 1 : 0);
