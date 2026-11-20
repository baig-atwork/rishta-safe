# ADR 0005: Closed result vocabulary; detection rate instead of a residual-risk number

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the architect (controller), under the owner's standing instruction to decide on best practice

## Context
No validated combined risk score exists (research 03). The programme's own wording (compatible, incompatible) can read as a verdict on the couple. For related couples a panel miss is shared by descent, so the naive per-partner update after two negatives understates the residual chance by about 16 times (about 60 times for rarer genes) in our simulation; this derivation has not been reviewed by a statistician. ACMG advises reporting detection rate, not a multiplex residual figure.

## Decision
The only result labels shown to a couple are `shared_result_found`, `no_shared_change_found` and `more_information_needed`; staff also see a review priority. Never compatible, incompatible, pass, fail, no risk, safe or high, moderate, low. Show the panel's detection rate and its limits; show no residual-risk number; keep pre-test numeric risk off by default (config flag). A variant of uncertain significance is never a result. A CBC alone can never produce a carrier statement.

## Consequences
The product is more cautious than the programme's own wording and says less than a number would. Users who want a single figure will not get one; that is deliberate.

## Revisit trigger
A statistician reviews the correlated-miss derivation, or a validated combined score appears.
