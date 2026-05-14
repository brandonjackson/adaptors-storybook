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
  README.md                          # adapter docs
  assets/{square,rectangle}.png      # logos used in the UI
  src/Adaptor.js                     # kept for reference, imports broken, not built

ui/                                  # Vite + React + Tailwind
  scripts/build-manifest.mjs         # packages/* -> public/adapters/
  src/components/                    # Sidebar, AdapterView, OperationsTable,
                                     # ConfigurationSchema, Snippets
```

## Working principles

- **Do not** restore `tools/`, `scripts/`, build configs, tests, pnpm
  workspace, or other tooling from the upstream `openfn/adaptors` repo.
  This repo is intentionally not buildable as adapter code.
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

## What's next

Anything unchecked in [SPEC.md § Roadmap snapshot](./SPEC.md#roadmap-snapshot).
The most natural next pick is **data-schemas** — define the shape of the
output object each trigger produces (Asana Task, Stripe Charge, etc.) so the
Triggers tab can link from `output.summary` into a full schema view.
