# ADR 0148: The time limit for the referral step is illustrative; the 90 percent target is sourced

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** lane C (journey and explain), for the controller

## Context
No standard states a time limit between result and counselling. The Abu Dhabi KPI is a share of 90 percent (DoH V3 section 5 Table 1). Research 04 section 2.6 found no primary figure and recommends scenarios.

## Decision
`pathway.yaml` sets 14 days for the referral timer with `illustrative: true`; the pathway view and the KPI object carry the flag. The lab-start (24 hours), genetic result (21 days Abu Dhabi, 28 days Dubai) and certificate validity (three months) timers are sourced and flagged not illustrative. The two standards disagree and the value follows the emirate policy.

## Consequences
`share_referred_within_standard` is an illustrative figure and is labelled so.

## Revisit trigger
A published or clinically agreed referral time.
