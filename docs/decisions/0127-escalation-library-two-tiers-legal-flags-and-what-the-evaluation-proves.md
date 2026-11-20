# ADR 0127: Escalation library: two tiers, legal-read flags, and what the evaluation proves

- **Status:** Accepted (every trigger and tier is a draft: clinical sign-off pending)
- **Date:** 2026-11-20
- **Deciders:** governance lane

## Decision
- 21 deterministic named triggers in `escalation_rules.yaml`, each with a source (research 03 section 2.7 row, ACMG 2021, ESHG 2016, NHS handbook, the dossier, or "design rule" where no guideline text exists), `needs_clinician_signoff: true`, a tier and a due-by hint key. The list covers the brief (affected partner, shared severity-A finding, VUS, copy-number or non-SNV result, X-linked finding, pregnancy in progress, variable-penetrance gene, distress phrases in EN, AR, UR, genotype-inferred relatedness, non-targeted finding) plus the other research rows (shared result, partner results unavailable, family history, lab-unconfirmed carrier, discordant history, reclassification notice, unanswerable and lineage requests, crisis language, more information needed) and the right-not-to-know override (ADR 0123).
- Two tiers because the federal programme's counsellors are trained physicians, not genetics professionals (dossier requirement 3): `counsellor` and `accredited_geneticist`. The tier assigned to each trigger is itself a draft.
- Due-by hints are keys (`immediate`, `same_session`, `fast_track`, `routine`), never numbers of days; the time targets belong to the clinical lead.
- `needs_legal_read` follows the collision column of research 03: `always` for affected partner, X-linked, genotype-inferred relatedness, non-targeted findings, lineage requests and the override; conditional on a non-targeted finding for VUS, copy-number and penetrance; conditional on a genotype-inferred flag for discordance.
- Severity tier and penetrance are NOT decided here: they arrive as inputs from the condition catalogue (`severity_a_condition_ids`, `penetrance_gene_symbols`). Nothing clinical is written in this lane.
- Free text is evaluated and discarded; the queue and audit chain hold decisions only.

## What the evaluation proves (and does not)
`run_escalation_evaluation(n, seed)` builds at least 200 must-escalate cases (400 by default, round-robin over every trigger) from the same trigger definitions the engine reads, plus 200 easy and 20 hard negatives. Result: recall 400 of 400, 0 false positives on easy negatives (precision 100 percent); 17 of 20 hard negatives (negated or third-person distress) fire, giving precision 95.9 percent with them. **Recall here measures implementation consistency, not clinical sensitivity**: the cases come from the same rules, so 100 percent says the code does what the data file says. It says nothing about whether the list is complete or the tiers are right. A test breaks one clause kind on purpose and requires the evaluation to notice.

## Revisit trigger
Clinical sign-off on triggers and tiers; real follow-up data.
