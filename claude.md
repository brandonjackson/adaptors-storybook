# CLAUDE.md — Adapter Library

This repo is a **storybook for OpenFn adapters**, not the adapters themselves.
It's a fork of `openfn/adaptors` stripped down to per-adapter metadata folders
plus a small React app that renders them. The original repo remains the source
of truth for adapter code.

## What lives where

```
packages/<adapter>/
  package.json                       # name, label, version, description
  configuration-schema.json          # credentials (JSON Schema)
  oauth-configuration-schema.json    # optional
  ast.json                           # parsed JSDoc for every operation
  README.md                          # adapter docs
  assets/{square,rectangle}.png      # logos used in the UI
  src/Adaptor.js                     # kept for reference, not built

ui/                                  # Vite + React + Tailwind
  scripts/build-manifest.mjs         # packages/* -> public/adapters/
  src/components/                    # Sidebar, AdapterView, OperationsTable, ConfigurationSchema
```

## Working principles

- **Do not** restore `tools/`, `scripts/`, build configs, tests, or the
  pnpm workspace. This repo is intentionally not buildable as adapter code.
- **Do** add new metadata files inside `packages/<adapter>/` (e.g.
  `snippets/`, `triggers.json`, `data-schemas/`). When you do, update
  `ui/scripts/build-manifest.mjs` to surface them, then add a tab or
  section in `ui/src/components/AdapterView.jsx`.
- The UI reads from `ui/public/adapters/`, which is generated. Don't edit
  files in there by hand.
- Re-run `npm run manifest` (or just `npm run dev`) after adding metadata.

## Open roadmap items

- Snippets: pull from
  `openfn/adaptors@prototype-snippets-feature-QYQu9` into
  `packages/<adapter>/snippets/`.
- Triggers + data schemas: define shape and ingest.
- Integration ideas: cross-adapter recipe pages.
- OpenAPI ingestion: scrape vendor sites and transform to our schemas.
