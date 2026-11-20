# ADR 0150: Referral tasks are FHIR R5 Task shaped objects; there is no FHIR server and no integration

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** lane C (journey and explain), for the controller

## Context
Spec rule 7 forbids claiming integration. FHIR R5 5.0.0 defines 12 Task status codes (fetched 2026-11-20); research 04 names 8.

## Decision
`ReferralTask` carries status, statusReason, intent, priority, code, for, authoredOn, lastModified, requester, owner and the t0 to t5 timestamps, labelled `simulated: true`. Statuses are the 8 named by research 04. A rejected or failed counselling task always spawns a replacement so nothing is silently lost; closing a case with an open task is refused.

## Consequences
A real adapter would map these objects onto a FHIR server without changing the state machine.

## Revisit trigger
A pilot with a licensed facility that exposes a FHIR endpoint.
