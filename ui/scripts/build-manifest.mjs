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
  const triggersInfo = buildTriggerSummary(triggersRaw);
  const triggerCount = triggersInfo ? triggersInfo.triggers.length : 0;

  const manifest = {
    name,
    label: pkgJson.label || name,
    packageName: pkgJson.name || `@openfn/language-${name}`,
    version: pkgJson.version || null,
    description: pkgJson.description || '',
    homepage: pkgJson.homepage || null,
    repository: pkgJson.repository || null,
    icons: {
      square: hasSquare ? `/adapters/${name}/square.png` : null,
      rectangle: hasRectangle ? `/adapters/${name}/rectangle.png` : null,
    },
    configurationSchema: configSchema,
    oauthConfigurationSchema: oauthSchema,
    operations,
    operationCount: operations.length,
    snippets,
    snippetCount: snippets.length,
    triggers: triggersInfo,
    triggerCount,
    metadata,
    readmePath: `/adapters/${name}/README.md`,
  };

  fs.writeFileSync(
    path.join(outPkgDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  if (readme) fs.writeFileSync(path.join(outPkgDir, 'README.md'), readme);

  summaries.push({
    name,
    label: manifest.label,
    description: manifest.description,
    operationCount: manifest.operationCount,
    snippetCount: manifest.snippetCount,
    triggerCount: manifest.triggerCount,
    icon: manifest.icons.square,
  });
}

fs.writeFileSync(
  path.join(OUT_DIR, 'index.json'),
  JSON.stringify(summaries, null, 2)
);

console.log(`Wrote manifest for ${summaries.length} adapters to ${OUT_DIR}`);
