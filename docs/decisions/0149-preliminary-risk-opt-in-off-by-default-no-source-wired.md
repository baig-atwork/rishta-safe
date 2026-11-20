# ADR 0149: Preliminary pre-test risk: opt-in only, off by default, returns nothing when off, unavailable until a cited source is wired

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** lane C (journey and explain), for the controller

## Context
Hard rule 6: no pre-test numeric risk by default; research 03 found no evidence either way, and a number needs a cited carrier frequency.

## Decision
`IntakeInput.preliminary_risk_opt_in` defaults to false and `JourneyService.preliminary_risk` returns None without computing anything. With the opt-in and no provider it returns `available: false`. A provider (composition may wire the genetics engine) is called only on opt-in.

## Consequences
The feature exists as a switch without inventing a number.

## Revisit trigger
The clinical lead decides whether the pre-test number stays off, with a cited frequency source.
