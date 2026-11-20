# ADR 0130: Cut: the data-deletion workflow that Art. 8 attaches to withdrawal

- **Status:** Cut for the prototype
- **Date:** 2026-11-20

## Context
Decree-Law 49/2023 Art. 8 (dossier 3.3): a person may withdraw from a voluntary screening at any stage, and the entity must then not keep samples or data without fresh written consent. The dossier suggests a withdrawal-triggers-deletion workflow, tested. The same dossier row notes Art. 8(1) is limited to voluntary screening; the mandatory couple screening is outside it.

## Decision
Revoking a sharing consent here stops further disclosure and appends a revoke line; it does not delete anything. A deletion workflow is a different thing (it would erase stored results and samples, and must be reconciled with an append-only audit chain and with the state's statutory receipt of data, Art. 26(2)). The prototype stores no real data and no samples, so there is nothing to delete.

## Consequences
The product does not claim Art. 8 compliance. The audit chain holds pseudonymous ids and tokens only, so a future deletion workflow can erase results without touching the chain.

## Revisit trigger
Any voluntary-screening or secondary-use feature with stored data.
