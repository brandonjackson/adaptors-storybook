# language-openg2p

A storybook entry for an OpenFn **adaptor** for
[OpenG2P](https://openg2p.org) — the open-source government-to-person
payments and social registry platform.

OpenG2P is built on Odoo and follows the
[G2P Connect](https://spec.ids.global) specifications for interoperability
across social registries, programs, and payment systems.

## Integration shape

- **REST APIs** via FastAPI modules (`g2p_registry_rest_api`,
  `g2p_programs_rest_api`).
- **Payment Hub EE / Mojaloop** for outbound disbursement, routed through
  the G2P Bridge.
- **Odoo Automation Rules** (manual webhooks) for push patterns —
  configured by an OpenG2P admin in the same way as OpenSPP.

Most triggers in `triggers.json` are polling-based today; expect more push
options as the G2P Connect spec adds callback patterns.
