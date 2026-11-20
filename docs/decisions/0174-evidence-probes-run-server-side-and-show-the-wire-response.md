# 0174: Evidence probes run in a server action and show the wire response and a computed audit delta

Status: accepted (2026-11-20). Lane C (v2 frontend).

## Context

The Evidence page must let a judge send real requests as synthetic personas and see what came back and the audit row it wrote. The adapter's problem mapping drops fields the judge needs (`reason`, `legal_basis`), the browser must never hold a persona token, and not every request writes a row (the plan guessed the cross-couple request writes none; the real backend writes one on the other couple).

## Decision

1. Probes run in a server action (`judge/actions.ts`) that reads `GET /v1/demo/personas` server-side, acts as the right persona, and returns data only (no token). Only the judge and programme lenses may call it.
2. The runner (`lib/public-probes.ts`) is pure and takes its I/O as dependencies, so the success, refusal, audit-delta and no-audit-row cases are unit-tested without a server.
3. In real mode the probe request goes to the backend as plain HTTP and the body is shown exactly as written (no mapping). In mock mode it goes to the in-process mock.
4. The audit delta is computed from two reads of the couple's log and two reads of the chain length (`/v1/audit/verify`). A probe that adds no row to the couple's log says so; if the chain still grew it says that instead ("no row in a couple's log, the chain grew from X to Y").
5. Probes never reset the demo. Reset is a separate button on the Case bench, shown to the judge lens only (the backend allows reset for the judge role alone).

## Consequences

Measured against the real backend: employer, insurer and cross-couple requests each wrote one row to the couple's log; the marriage question wrote one chain row outside any couple log; the blood count and a classifier miss wrote none. The chain-length read is a global count, so concurrent activity by another client could be mistaken for a probe's row; the wording says "while this probe ran" for that reason.
