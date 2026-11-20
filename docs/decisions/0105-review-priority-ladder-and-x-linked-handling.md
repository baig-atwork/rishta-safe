# ADR 0105: Staff-only review priority ladder, and how X-linked results are handled in the couple result

- **Status:** Accepted (design rules with no external source; draft, sign-off pending)
- **Date:** 2026-11-20
- **Deciders:** genetics lane

## Context
The result contract has a staff-only `ReviewPriority` (routine, priority, urgent) and a `SharedCondition.basis` that includes X-linked cases. Research report 03 gives escalation triggers (section 2.7) but no source defines priority levels or time targets (the NHS sources say "fast-tracked" and give gestation windows). Severity tiers are this build's own illustrative grouping.

## Decision
Review priority (never shown to the couple):
- **urgent:** a shared condition of severity tier A, or an affected partner with a tier A or B condition (the brief's "affected partner, shared severity A").
- **priority:** any other shared result, any `more_information_needed`, any variant of uncertain significance, or an affected partner with a tier C condition. An affected partner with a tier C condition does not make a case urgent (G6PD deficiency is common in males in the cited newborn cohort).
- **routine:** none of the above.
- Pregnancy-related and other context escalations are made by governance, not by this engine.

X-linked: the explicit table gives son and daughter lines (per 100 sons and per 100 daughters). An X-linked carrier female with a male partner without the variant, an affected male with a female without the variant, an affected male with a carrier female, and both affected are shared results with their own basis. An affected female with an unaffected male partner is `more_information_needed` (`x_linked_clinical_read_needed`). A male cannot be an X-linked carrier (`finding_inconsistent_with_sex`). Autosomal affected-with-negative-partner is not a shared result (all children would carry) but flags the affected partner for review. Who may see an X-linked or affected-partner result is a legal read left to governance (research report 03 questions 6 and 12).

## Consequences
Thresholds for urgency are illustrative and depend on illustrative tiers. A reviewer can see which rule fired from the trace (P1, P2, P3).

## Revisit trigger
The clinical lead sets real priority definitions and time targets, and assigns severity tiers from a source.
