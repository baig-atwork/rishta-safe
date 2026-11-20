# ADR 0124: Role visibility rules, and care-team assignment is itself access-controlled

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** governance lane (assignment rules tightened after the controller's security review)

## Decision
- **Couple member:** own couple only; own findings always (unless a right not to know); partner findings to the scope the partner granted (none by default).
- **Counsellor, clinician:** the staff view (everything, trace and review priority) for couples ASSIGNED to them; every access is audited. Basis: care-team assignment, not consent.
- **Programme:** no individual or couple result, enforced in code (`Forbidden`), even if someone tried to grant it. Aggregates only, through the journey lane's KPIs.
- **Judge:** the staff view, read-only, of SYNTHETIC cases only. Every case in this prototype is synthetic (hard rule 1), so in demo mode the default is synthetic; outside demo mode a case counts as synthetic only if explicitly marked. A judge never writes (the controller's `assert_couple_access` refuses judge writes).
- **External:** nothing.
- **Assignment authority** (the staff view hangs on it): a non-None caller may assign only if it is the programme operator, or staff already assigned to that couple. Self-assignment is forbidden unless the caller is the programme operator. The target must be a registered staff identity (`register_staff`, `register_identity` or `issue_demo_token`). Every denial is audited. `by=None` is the internal trusted path for the seeder only; a test asserts by AST that no router passes it.

## Consequences
The first assignment for a couple needs the programme operator or the seeder. The property tests include assignment operations: a staff member never gains the staff view of a couple they were not assigned to by an authorised actor.

## Revisit trigger
Real staff directory; removal and expiry of assignments (parked).
