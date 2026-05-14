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
    metadata.json                      # vendor/API source links for ingestion
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

## Adapter metadata (`metadata.json`)

Each adapter has a `metadata.json` that points at the upstream sources of truth
for the connected system's API — base URLs, OpenAPI/WSDL/GraphQL specs, docs
indexes, SDK repos, etc. The goal is for every entry to be **concrete enough
that an ingestion script can dispatch on `kind` and fetch the right thing**
without further guesswork.

The canonical shape lives at [`metadata.template.json`](./metadata.template.json).
A minimal example:

```json
{
  "vendor": "DHIS2",
  "product": "DHIS2 Web API",
  "homepage": "https://dhis2.org",
  "apiStyle": "rest",
  "baseUrls": ["https://play.dhis2.org/dev/api"],
  "sources": [
    { "kind": "openapi",     "url": "https://docs.dhis2.org/.../openapi.json", "format": "json", "version": "3.0" },
    { "kind": "docs-index",  "url": "https://docs.dhis2.org/en/develop/using-the-api/dhis-core-version-master/dhis2-web-api.html" },
    { "kind": "sdk-repo",    "url": "https://github.com/dhis2/web-api-specification", "language": "kotlin" }
  ]
}
```

Recognised `kind` values (extend as needed):

| `kind`              | What it points at                                     | Ingestion |
| ------------------- | ----------------------------------------------------- | --------- |
| `openapi`           | OpenAPI / Swagger 2 or 3 spec (JSON or YAML)          | parse spec → operations + schemas |
| `wsdl`              | SOAP service description (XML)                        | parse WSDL → operations |
| `graphql-schema`    | SDL file or introspection endpoint                    | parse SDL → operations + types |
| `asyncapi`          | AsyncAPI spec for event-driven APIs                   | parse → triggers + payloads |
| `postman-collection`| Postman collection JSON                               | extract requests → operations |
| `json-schema`       | Stand-alone JSON Schema for a resource or event       | feed into data-schemas |
| `docs-index`        | Human-readable docs landing page                      | scrape (last resort) |
| `docs-page`         | A specific docs page worth scraping                   | scrape |
| `sdk-repo`          | Official client library source                        | harvest types / method signatures |
| `changelog`         | Release notes / API changelog                         | track API drift |
| `sandbox`           | Test environment we can hit live                      | probe / smoke test |

Top-level fields:

- `vendor` / `product` — human names for the system.
- `homepage` — vendor home page.
- `status` — `stub` | `partial` | `complete`, our coverage flag.
- `apiStyle` — `rest` | `soap` | `graphql` | `grpc` | `jsonrpc` | `sdk` | `mixed`.
- `baseUrls` — array of API base URLs.
- `auth.schemes` — e.g. `["oauth2", "api-key"]`. Detail lives in
  `configuration-schema.json`; this is just a hint for ingestion.
- `webhooks.supported` + `webhooks.docs` — does the vendor push events?
- `notes` — free-form, anything else worth capturing.

## Run the UI

From the repo root:

```bash
npm install      # also installs ui/ deps via postinstall
npm run dev      # http://localhost:5173
```

`npm install` at the root fans out to `ui/` via a `postinstall` script, so
you don't need to `cd ui` first.

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
- [ ] Seed `metadata.json` for every adapter (vendor + API source links)
- [ ] OpenAPI ingestion pipeline
