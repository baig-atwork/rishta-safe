# ADR 0125: The audit chain, its canonical form, and what it does not detect

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** governance lane

## Decision
- Every disclosure decision (allowed, withheld, denied), consent change, right-not-to-know change, refusal, escalation, token issue, assignment and role denial is an event: actor role, pseudonymous actor and subject ids, action, couple id, outcome, closed-vocabulary reason, small token detail, clock time, `prev_hash`, `hash`.
- `hash = sha256(canonical JSON)`: `json.dumps` with sorted keys, separators `(",", ":")`, ASCII, over version, index, UTC timestamp (microseconds), actor role and id, action, couple id, subject id, outcome, reason, detail and `prev_hash`; genesis `prev_hash` is 64 zeros. The form is in the module docstring and a test recomputes it independently with `hashlib`.
- `verify_audit_chain()` returns ok, length, head hash, first bad index and the problem. Tests tamper with an event (with and without re-hashing), reorder, delete and insert, and require detection.
- Minimisation: ids that do not look pseudonymous (an email, for instance) are replaced by a keyed digest; `detail` accepts only short tokens; free text, results and anything a person typed never enter the log.

## Limits (stated, tested)
- Truncating the tail is NOT detected by the chain alone; a test pins that behaviour. The head hash must be anchored somewhere the operator cannot rewrite (shown on the judge scoreboard, written to WORM storage). Not built (ADR 0129).
- In memory; lost on restart. Failed `authenticate` calls are not logged (log-flooding risk); issues are.

## Revisit trigger
Durable storage; a head-hash anchor.
