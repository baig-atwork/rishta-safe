# ADR 0182: The demo keeps its state in memory, so the api runs exactly one replica and no database is deployed

- **Status:** Accepted (infra lane, on the controller's brief of 2026-11-20)
- **Date:** 2026-11-20
- **Deciders:** the infra lane; the controller (brief). Applies the architecture contract (docs/spec/00-architecture-and-scope.md, section 3: state in memory behind small repository classes).
- **Supersedes / superseded by:** none
- **Evidence:** `backend/src/bayan/api/app.py` (services are built once into `app.state`; there is no storage layer); `docs/parking-lot.md` already lists the Postgres adapter.

## Context
Cases, consents, the hash-chained audit and the pathway state live in the api process. The demo is seeded and resettable (`POST /v1/demo/reset`).

## Decision
1. **No database is deployed.** No Postgres server, no managed identity for a database, no migration job.
2. **`bayan-api` runs exactly one replica: minimum 1 and maximum 1.** A second replica would be a second, empty demo behind the same address (a judge would see a case vanish between two requests). Scale to zero would reset the demo and cause a cold-start 502 for the next visitor. `bayan-web` is also fixed at one replica to keep the cost bounded.
3. **Any restart resets the demo.** A new revision, a platform move or a crash starts from the seed. That is intended: the demo is reproducible. Scripts and the runbook say "reset" and never promise persistence.
4. **The Postgres adapter stays parked** (the controller's parking-lot line). Reversible migrations, row-level security and a Squawk gate belong to that work, not to this one.

## Consequences
- No data survives a deployment; no backup exists or is needed (synthetic data only).
- The audit chain is only as durable as the process. Its verification endpoint proves integrity within one process lifetime, not across restarts. Any real use needs the persisted adapter.
- **Cost of being wrong:** someone assumes persistence or horizontal scale. The runbook states both limits in its first section.

## Revisit trigger
Any non-synthetic data; a load test that needs more than one replica; a second environment for a pilot.

## Links
[ADR 0180](0180-demo-hosted-in-france-central-design-target-uae-north.md) · [0181](0181-join-the-existing-container-apps-environment.md)
