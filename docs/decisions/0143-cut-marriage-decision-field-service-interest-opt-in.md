# ADR 0143: Cut: the per-person marriage-decision field; an opt-in service-interest field replaces it

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** lane C (journey and explain), for the controller

## Context
The programme already records the decision in a signed declaration; the standards place the decision to marry with the judicial authorities; challenge 03 item 6 forbids treating any single personal choice as the success measure; the state is a statutory recipient (Art. 26(2)). Research 04 section 2.2 lists six reasons.

## Decision
No field in `ClinicianProforma`, `ClosureAnswers`, `ClosureRecord` or the YAML records a marriage intention or outcome, and `extra=forbid` rejects one. `interested_in_future_services` is opt-in with a consent text (yes now, yes later with a reminder, no thank you, prefer not to say). The clinician record stores only who answered, never what.

## Consequences
The programme-level aggregate (71 percent) stays with the authorities.

## Revisit trigger
A licensing rule, or a separate anonymous unlinked research design, that needs the datum.
