# Adapter Library

A storybook-style browser for OpenFn adapters. Every connected system we
integrate with has an adapter; this repo collects everything we know about each
one — credentials, operations, triggers, data shapes, snippets, integration
ideas — in one place, with a UI to browse it.

This is a fork of [openfn/adaptors](https://github.com/openfn/adaptors),
stripped to per-adapter metadata folders plus a small React app that renders
them. The original repo remains the source of truth for adapter code; this one
is for iterating on _how we describe_ adapters.

**See [SPEC.md](./SPEC.md) for the full objective + roadmap (start there
if you're resuming work).**

## Repo structure

```
packages/
  <adapter-name>/
    package.json                       # name, label, version, description
    configuration-schema.json          # credentials (JSON Schema)
    oauth-configuration-schema.json    # optional, e.g. salesforce
    ast.json                           # parsed JSDoc for every operation
    snippets.json                      # CREATE / SEARCH snippets (27 adapters)
    README.md                          # adapter-level docs
    assets/{square,rectangle}.png      # logos used in the UI
    src/Adaptor.js                     # kept for reference (imports broken, code not built)

ui/                                    # Vite + React + Tailwind app
  scripts/build-manifest.mjs           # walks packages/* -> public/adapters/
  src/components/                      # Sidebar, AdapterView, OperationsTable,
                                       # ConfigurationSchema, Snippets
```

Per-package files that aren't on every adapter but stay because they're useful
seed material for future phases: `bigquery/samples/`, `ibipimo/jobs/`,
`openmrs/integrations/`, `medicmobile/sample_response.json`, and
`mogli/connecting_*.md`.

## Run the UI

```bash
cd ui
npm install
npm run dev      # http://localhost:5173
```

`npm run dev` and `npm run build` both invoke `scripts/build-manifest.mjs`
first, which scans every `packages/*` folder and writes
`ui/public/adapters/` (one folder per adapter plus a top-level `index.json`
for the nav). When you add new metadata files to a package, re-run
`npm run manifest` (or just restart the dev server).

## Roadmap

See [SPEC.md](./SPEC.md#roadmap-snapshot). Short form:

- [x] Strip packages, scaffold UI, wire credentials + operations + snippets tabs
- [x] Triggers (`triggers.json` + Triggers tab) — seeded for 30 adapters
- [ ] Data schemas (`data-schemas/` for trigger payloads)
- [ ] Cross-adapter integration ideas
- [ ] Fill empty `code` fields in existing snippets
- [ ] OpenAPI ingestion pipeline
