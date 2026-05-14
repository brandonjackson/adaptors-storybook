# Adapter Library — original spec

> Captured verbatim from the original brief so it survives across sessions.
> Anything we've already done is checked off in [ROADMAP](#roadmap-snapshot)
> at the bottom of this file. The day-to-day orientation lives in
> [README.md](./README.md).

## Purpose

The **Adapter Library** is a new repository whose purpose is to collect all
information about how connected systems work on adapters in one place, so we
can improve our system quickly.

The Adapter Library functions like a storybook, letting you browse different
schemas and data objects all in one location. Adapters are the functions we
use to connect to various systems that we integrate into workflows. Each
adapter includes:

- **Triggers** that indicate when a connected system can be used
- **The data that comes in** with each trigger and its structure
- **The available API functions** for that system
- **The credentials** required to connect
- **Snippets** showing what you can do with the API
- **Integration ideas** that demonstrate how actions or snippets across
  adapters can fit together

## How we got here

To create the Adapter Storybook repository on GitHub, we forked the existing
[`openfn/adaptors`](https://github.com/openfn/adaptors) repository.

1. **Strip it down** to a set of folders — one per adapter — containing the
   current schemas and information about how each adapter works.
2. **Add metadata** such as snippets, data schemas, and trigger schemas for
   every adapter.
3. **Build a UI** with a left-hand navigation menu listing each adapter.
   Clicking an adapter opens an overview in the right-hand pane, displaying
   all collected information in a human-readable format.

This UI provides a space to iterate and experiment with different models
without polluting the original adapters repository.

## Where snippets came from

The snippet seed data lives in this branch of the original repo:
[`openfn/adaptors@prototype-snippets-feature-QYQu9`](https://github.com/openfn/adaptors/tree/prototype-snippets-feature-QYQu9).
That branch contributes `snippets.json` files for 27 adapters; we've copied
them into `packages/<adapter>/snippets.json`.

## Long-term vision

In the fullness of time, build an **automated ingestion tool** that scrapes
vendor sites looking for OpenAPI docs, then transforms them into useful
schemas (triggers, data, operations) for the library.

## The six pillars

Every adapter folder is being grown toward this shape:

| Pillar               | Lives in                                              | Status        |
| -------------------- | ----------------------------------------------------- | ------------- |
| Operations (API fns) | `packages/<a>/ast.json` (parsed JSDoc)                | done          |
| Credentials          | `packages/<a>/configuration-schema.json`              | done          |
| Snippets             | `packages/<a>/snippets.json`                          | 27 / 104      |
| Triggers             | `packages/<a>/triggers.json`                          | 30 / 104      |
| Data schemas         | `packages/<a>/data-schemas/` (OpenAPI-ingested)       | 8 / 30        |
| Integration ideas    | Cross-adapter, location TBD                           | not started   |

## Roadmap snapshot

- [x] Strip adapter packages down to schemas + Adaptor.js + assets
- [x] Build manifest pipeline that aggregates `package.json`,
      `configuration-schema.json`, `ast.json`, `snippets.json` per adapter
- [x] UI: left-nav + overview / operations / credentials / snippets tabs
- [x] Pull snippets from the prototype-snippets branch (27 adapters)
- [x] Define `triggers.json` schema and render in the Triggers tab
      (seeded for the 30 Zapier-overlap adapters; 142 triggers total)
- [x] Bootstrap `data-schemas/` via `tools/ingest-openapi.mjs` — pulls each
      adapter's OpenAPI spec listed in `metadata.json`, extracts the
      `components.schemas` named by each trigger's `output.schemaRef`, and
      writes them into `packages/<a>/data-schemas/`. Seeded for stripe + asana.
- [x] Expand `schemaRef` coverage across more OpenAPI-backed adapters and
      rerun the ingestor. Now covers stripe, asana, twilio, msgraph, bigquery,
      gmail, googledrive, googlesheets. The ingestor also handles Google
      Discovery docs (bare `$ref` names → `spec.schemas.<name>`).
- [ ] **Next**: harder ingestion targets — mailchimp's Swagger 2.0 splits
      schemas into remote `$ref` files (definitions block is empty);
      nexmo/Vonage upstream paths have moved; mongodb's Atlas Admin spec
      doesn't cover the driver-level triggers we have. Each needs custom
      handling before its `schemaRef`s can resolve.
- [ ] Cross-adapter integration ideas — render as recipe pages
- [ ] Fill in snippets that arrived with empty `code` fields
- [ ] Extend ingestion beyond OpenAPI: WSDL, AsyncAPI, GraphQL SDL — the
      `kind` discriminator in `metadata.json` already enumerates the targets.
