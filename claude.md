# CLAUDE.md — Adapter Library

This repo is a **storybook for OpenFn adapters**, not the adapters themselves.
It's a fork of `openfn/adaptors` stripped down to per-adapter metadata folders
plus a small React app that renders them. The original repo remains the source
of truth for adapter code.

## Resuming work

1. Read [SPEC.md](./SPEC.md) — that's the canonical objective + roadmap with
   the current checklist. **Always start there.**
2. Read [README.md](./README.md) for the repo layout and how to run the UI.
3. Active branch for ongoing work: `claude/create-adapter-library-VnZnx`
   (tracked by PR
   [#1](https://github.com/brandonjackson/adaptors-storybook/pull/1)).
   Push commits to that branch to update the PR.

## What lives where

```
packages/<adapter>/
  package.json                       # name, label, version, description
  configuration-schema.json          # credentials (JSON Schema)
  oauth-configuration-schema.json    # optional
  ast.json                           # parsed JSDoc for every operation
  snippets.json                      # { CATEGORY: { Title: {description, code} } }
  triggers.json                      # event triggers + output.schemaRef
  data-schemas/                      # OpenAPI-ingested JSON Schemas (one per ref)
  metadata.json                      # vendor info + spec source URLs
  README.md                          # adapter docs
  assets/{square,rectangle}.png      # logos used in the UI
  src/Adaptor.js                     # kept for reference, imports broken, not built

tools/
  ingest-openapi.mjs                 # metadata.json + triggers.json → data-schemas/

ui/                                  # Vite + React + Tailwind
  scripts/build-manifest.mjs         # packages/* -> public/adapters/
  src/components/                    # Sidebar, AdapterView, OperationsTable,
                                     # ConfigurationSchema, Snippets,
                                     # Triggers, DataSchemas, Sources
```

## Working principles

- **Do not** restore the upstream `tools/`, `scripts/`, build configs, tests,
  pnpm workspace, or other tooling from `openfn/adaptors`. This repo is
  intentionally not buildable as adapter code. (Our own `tools/` directory
  for ingestion scripts is fine — it's not the upstream one.)
- **Do** add new metadata files inside `packages/<adapter>/` (e.g.
  `triggers.json`, `data-schemas/`). When you do:
  1. Update `ui/scripts/build-manifest.mjs` to surface them.
  2. Add or wire up a tab in `ui/src/components/AdapterView.jsx`.
  3. Re-run `npm run manifest` (or just restart `npm run dev`).
- The UI reads from `ui/public/adapters/`, which is **generated**. Don't
  edit files there by hand — they're in `.gitignore`.
- Snippets shape (already in use): `{ CATEGORY: { Title: { description, code } } }`.
  Categories so far are `CREATE` and `SEARCH`.

## triggers.json shape

```json
{
  "source": "zapier",
  "scrapedAt": "2026-05",
  "notes": "Optional adapter-level note",
  "triggers": [
    {
      "name": "New Task in Project",
      "description": "Fires when a new task is added to a project.",
      "mechanism": "polling",          // polling | webhook
      "openfnPattern": "cron",         // cron | webhook
      "output": {
        "summary": "Asana Task object",
        "fields": ["gid", "name", "assignee", "due_on"]
      }
    }
  ]
}
```

`mechanism` describes how the vendor surfaces the event. `openfnPattern` is
the matching OpenFn workflow trigger — polling → cron schedule that calls the
adapter's list operation with a since-cursor; webhook → vendor POSTs to an
OpenFn webhook URL.

## data-schemas via OpenAPI ingestion

`tools/ingest-openapi.mjs <adapter>` reads the adapter's
`metadata.json`, finds the `kind: openapi` source, fetches it (cached at
`.cache/openapi/<adapter>.{json,yaml}`), then for every trigger in
`triggers.json` that has `output.schemaRef`, extracts
`components.schemas[<schemaRef>]` from the spec and writes it to
`packages/<adapter>/data-schemas/<schemaRef>.json`. Internal `$ref`s are
inlined one hop deep — deeper refs stay as `{"$ref": ...}`.

YAML specs are parsed by shelling out to `python3 -c 'import yaml,json...'`
to avoid pulling a JS yaml dep. If you run this somewhere without python3 +
pyyaml, switch to a JSON-format OpenAPI source in `metadata.json` or add a
`yaml` npm dep.

The build-manifest copies each `data-schemas/<id>.json` to
`ui/public/adapters/<adapter>/data-schemas/` and the UI lazy-fetches it when
the user clicks into the **Data** tab — so even huge specs (Stripe Charge is
~250KB) don't bloat the manifest. The **Triggers** tab shows a `schema:<ref>`
chip that jumps over to the **Data** tab.

## faq.json (overview FAQ overrides)

`ui/src/components/Faq.jsx` renders seven canned questions (`what`, `connect`,
`when`, `how`, `wire`, `scale`, `best`). Each adapter folder ships a
`faq.json` with adapter-specific override text for those keys; the manifest
builder picks it up automatically. Regenerate with
`node tools/generate-faqs.mjs [adapter ...]` (no args = `--all`). The
generator pulls from `package.json`, `metadata.json`, `ast.json`,
`snippets.json`, `triggers.json`, and `configuration-schema.json`, so update
those first if the FAQ output looks stale.

## What's next

Anything unchecked in [SPEC.md § Roadmap snapshot](./SPEC.md#roadmap-snapshot).
Most natural next pick: walk the other 18 adapters with `kind: openapi` in
their `metadata.json`, add `output.schemaRef` values to their triggers, and
rerun `node tools/ingest-openapi.mjs --all`. After that, the WSDL / GraphQL /
AsyncAPI sources still need their own ingestors (the `kind` enum in
`metadata.json` already lists them).
