# language-mosip

A storybook entry for an OpenFn **adaptor** for
[MOSIP](https://mosip.io) — the Modular Open-Source Identity Platform used
by countries to issue and manage foundational national IDs.

## Integration shape

MOSIP uses W3C **WebSub** (Ballerina WebSubHub) internally to publish events
between modules:

- ID Repository publishes UIN creation / update and VID creation events
- Credential issuance and credential-status updates flow via WebSub between
  IDA, the partners, and the print pipeline
- Auth type status changes are also published over WebSub

External integration is either:

1. **Subscribe to MOSIP's WebSub hub** (requires network access into the
   MOSIP deployment and proper partner onboarding), or
2. **Poll the REST APIs** (ID Repository, Resident services, partner
   management APIs).

eSignet provides OIDC for relying parties — that's request/response, not an
event source. The OpenCRVS → MOSIP mediator pattern is the canonical
cross-DPG reference: OpenCRVS fires a WebSub webhook on `BIRTH_REGISTERED`,
a mediator calls the MOSIP Token Seeder, MOSIP creates the national ID.
