# ADR 0129: Cut: durable consent and audit storage, and an external anchor for the audit head hash

- **Status:** Cut for the prototype (spec section 3: state in memory behind small classes; a Postgres adapter is a parked ADR)
- **Date:** 2026-11-20

## Decision
The consent ledger, right-not-to-know ledger, audit chain, assignments and escalation queue live in memory in one process, behind lock-protected classes with narrow methods so an adapter can replace them. Nothing survives a restart and nothing is shared between replicas (infra ADR 0182 pins a single replica).

## Consequences
The audit chain proves internal consistency, not durability. Tail truncation is undetectable without an anchor (ADR 0125). A production audit log needs append-only storage, a signed head hash written outside the operator's control, and retention rules. The consent table and audit table would be created through reversible migrations when the Postgres adapter is built.

## Revisit trigger
A persistence adapter; any real deployment.
