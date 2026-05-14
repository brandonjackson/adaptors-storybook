# Adapter Library

A storybook-style browser for OpenFn adapters. Every connected system we
integrate with has an adapter; this repo collects everything we know about each
one — credentials, operations, triggers, data shapes, snippets, integration
ideas — in one place, with a UI to browse it.

This is a fork of [openfn/adaptors](https://github.com/openfn/adaptors),
stripped to a per-adapter folder of schemas + metadata, plus a small React app
that renders it. The original repo remains the source of truth for adapter
code; this one is for iterating on _how we describe_ adapters.

## Structure

```
packages/
  <adapter-name>/
    package.json                       # name, label, version, description
    configuration-schema.json          # credentials schema (JSON Schema)
    oauth-configuration-schema.json    # optional, e.g. salesforce
    ast.json                           # parsed JSDoc for every operation
    README.md                          # adapter-level docs
    assets/
      square.png                       # 256x256 logo
      rectangle.png                    # 512x190 logo
    src/Adaptor.js                     # the adapter source (kept for reference)

ui/                                    # Vite + React + Tailwind app
  scripts/build-manifest.mjs           # walks packages/* -> public/adapters/
  src/                                 # left-nav + per-adapter overview
```

## Roadmap

The bones are in place; metadata is what we'll fill in next.

- [x] Strip adapter packages down to schemas + Adaptor.js + assets
- [x] Build manifest pipeline that aggregates `package.json`,
      `configuration-schema.json`, `ast.json` per adapter
- [x] UI: left-nav + overview / operations / credentials tabs
- [x] Pull snippets from
      [`openfn/adaptors@prototype-snippets-feature-QYQu9`](https://github.com/openfn/adaptors/tree/prototype-snippets-feature-QYQu9)
      into `packages/<adapter>/snippets.json` and wire them to the Snippets tab
      (27 adapters covered so far)
- [ ] Define `triggers.json` schema and render in the Triggers tab
- [ ] Define `data-schemas/` for the shapes that come in on each trigger
- [ ] Integration ideas: cross-adapter recipe pages
- [ ] Automated ingestion: scrape vendor sites for OpenAPI docs and transform
      them into our schemas

## Run the UI

```bash
cd ui
npm install
npm run dev      # http://localhost:5173
```

`npm run dev` and `npm run build` both invoke
`scripts/build-manifest.mjs` first, which scans every `packages/*` folder
and writes `ui/public/adapters/` (one folder per adapter plus a top-level
`index.json` for the nav). When you add new metadata files to a package,
re-run `npm run manifest` (or just restart the dev server).
