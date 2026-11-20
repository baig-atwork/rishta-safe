# ADR 0126: A deterministic refusal classifier, and what its numbers do and do not show

- **Status:** Accepted (draft; Arabic and Urdu lists unreviewed by a native clinical reader)
- **Date:** 2026-11-20
- **Deciders:** governance lane

## Context
The product refuses: diagnosis, treatment, "should we marry or call it off", termination advice, lineage inference, employer and insurer questions, and another person's result (the brief lists five; treatment and other-person results come from the dossier's refusal list and Art. 9). There is no runtime LLM (ADR 0003), so there is nothing that generates an answer; the classifier decides whether a free-text request is refused with a fixed message and, for the cases that cannot be answered safely, whether a counsellor is told.

## Decision
- Keyword and regular-expression patterns per language in `consent_policies.yaml` (about 100), applied to normalised text (case, Arabic and Urdu letter variants, diacritics and apostrophes folded). Patterns of ALL three languages apply to every request because people code-switch; the locale only selects the language of the refusal message. Messages are fixed text with the statute cited (Decree-Law 49/2023 Art. 19 to 21 for employers and insurers; Art. 9 for lineage and other people's results) and are checked against the explain lane's banned-word list.
- `marriage_decision`, `termination_advice`, `lineage_inference` and `other_person_result` also notify a counsellor (research 03 section 2.7 rows 11 and 12); diagnosis, treatment and employer or insurer questions are refused without escalation.
- A refusal is audited by category, never by text.

## Measured (synthetic set of 179 labelled prompts: 100 dev, 79 held-out; EN, AR, UR; same author as the patterns, so optimistic)
- DEV split, patterns tuned on it: 70 of 70 must-refuse prompts refused (100%), category correct on 70, 0 of 25 benign prompts refused. Five prompts are labelled known gaps and not counted: romanised Urdu, Arabizi, leetspeak, mixed-script sentences. None is refused.
- HELD-OUT split, written after tuning and not tuned against, first run: 36 of 59 must-refuse prompts refused (61.0%), 0 of 20 benign prompts refused. The 23 misses are natural paraphrases (broken plurals, colloquial verbs, synonyms such as "tablets", "real dad", "ethnic group"). They stay in the set.
- The honest number for keyword matching on unseen phrasing is therefore about 60 percent recall with no false refusals on the benign prompts tried. Regression floors in the tests are 98 percent (dev) and 55 percent (held-out).

## Limits
Keyword matching is not understanding: paraphrase, misspelling, other scripts and Roman transliteration evade it, and a sentence that contains a listed phrase is refused even if harmless (for example a question about abortion law). Because nothing generates free text, a miss produces no unsafe output; it fails to route a distressed or high-impact question to a human. That is the real cost, and it is why escalation also runs on the person's own distress phrases and why every refusal path points to a counsellor.

## Revisit trigger
A native-speaker review of the lists; a larger independent prompt set; a semantic classifier on a self-hosted model (parked, ADR 0132).
