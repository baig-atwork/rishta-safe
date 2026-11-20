# ADR 0102: Different panels give "more information needed" only where the comparison is genuinely unknown

- **Status:** Accepted (refines the brief; draft ruleset, sign-off pending)
- **Date:** 2026-11-20
- **Deciders:** genetics lane

## Context
The brief says different panels for the two partners yield `more_information_needed` (panel mismatch) "unless the genes compared are covered by both". Read literally as "any difference in panels means more information needed", a couple where both partners are negative on everything they were tested for would never get a no-shared statement just because one lab ran a narrower panel. Read as the unless-clause intends, the comparison is only unknown for a locus that one partner's panel does not cover while the other partner has a carrier or affected finding there.

## Decision
- A locus is compared only when both partners' panels cover it. If one partner has a finding at a locus that the other partner's panel does not cover, the result is `more_information_needed` with reason key `panel_mismatch` (rule E08) and the trace names the locus and the panel.
- A shared result at a locus covered by both stands even if the panels differ elsewhere.
- If the panels differ but no locus is in that unknown state, the category follows the normal rules, a trace line records that the partners were tested on different panels, and the detection statements for both panels are attached, so the explainer can say what each test did and did not look at.
- A finding for a gene outside the person's own declared panel is `more_information_needed` (`finding_outside_declared_panel`).

## Consequences
Never states "no shared change found" about a gene one partner was not tested for while the other carries a change in it. A both-negative couple on different panels still gets the no-shared statement with both panels' limits. If the clinical lead prefers the stricter reading (any panel difference gives more information needed), it is a one-line change in `CoupleEngine.classify`.

## Revisit trigger
The clinical lead decides which reading to adopt.
