# 0176: The Case bench keeps `startSession` for role homes and adds `startLensAt` for case-specific landings

Status: accepted (2026-11-20). Lane C (v2 frontend).

## Context

The spec wants a "skip the choice" link that carries `?enter=now`, and counsellor and clinician cells that land on the case, but the shared `startSession` action can only redirect to the role's home, and the plan told lanes to use it.

## Decision

Cells that open a role's home (partner cells, the lenses not tied to a case) use `startSession` unchanged and carry `data-lens-persona` (and, on the page only, `data-persona-id` for `e2e/helpers.ts`). Cells that need a destination use `demo/actions.ts` `startLensAt(personaId, locale, target)`, where `target` is one of four shapes validated server-side (home, couple result with `?enter=now`, `/staff/couples/{id}`, `/clinician?couple={id}`); no client string becomes a path. It sets the same httpOnly cookie as `startSession`. The compact bench exported for the Lens dialog (`CaseBench compact`, or `CaseBenchSlot` which loads its own data) uses only `startSession` cells and the persona objects it receives carry no token.

## Consequences

Cookie-setting code exists twice; the controller can extract a `setSessionCookie` helper from `actions.ts` later. The programme column is an open cell with no link: the access rule is visible.
