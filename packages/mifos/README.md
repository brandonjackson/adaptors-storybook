# language-mifos

A storybook entry for an OpenFn **adaptor** for [Mifos / Apache
Fineract](https://mifos.org) — the open-source core banking platform used
by community microfinance institutions.

This package collects the metadata used by the Adapter Library UI: what the
API exposes (REST + Kafka business events + Hooks/webhooks), how it
authenticates (basic auth or OAuth2, plus a tenant header), which triggers
fire when something happens in Fineract, and which data entities flow with
them.

## Two event delivery mechanisms

Fineract supports both:

- **Hooks (Webhooks)** — register hooks against entity-action pairs (e.g.
  `Client:CREATE`, `Loan:REPAYMENT`). Fineract sends an HTTP POST with the
  API response as the body plus headers (`X-Mifos-Entity`, `X-Mifos-Action`,
  `X-Mifos-Platform-TenantId`). Works out of the box.
- **Business Events pipeline (Kafka / ActiveMQ JMS)** — for production
  deployments, Fineract publishes events like `ClientCreated`, `LoanApproved`,
  `LoanDisbursed`, `SavingsDeposit` to a broker. Disabled by default; turn on
  for high-volume scenarios.

See `triggers.json` for the full event list and which mechanism each uses.
