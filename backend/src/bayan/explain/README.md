# bayan.explain

Reviewed static templates, a glossary and a deterministic checker. **No runtime LLM** (ADR 0003, 0144). Everything here is a prototype on synthetic data. Nothing is clinically reviewed: every file carries `needs_clinician_signoff: true` and `language_status: draft` (English too, ADR 0140). The product shows the status on every document.

## What it does
`ExplainService.render(disclosed, locale, *, reasons=())` turns a `DisclosedResult` into an `ExplainerDoc`: the result category (own view and partner view), a shared-condition explanation with a fixed 100-icon natural-frequency array, what a result does and does not mean, the detection-limits statement, the related-couple caveat (no residual number), the reasons for "more information needed", withheld-result texts, the certificate-refusal note, the boundary notice, and the privacy and policy notes. `options_pane` gives the neutral options (Art. 11, Art. 12, specialist discussion, right not to know Art. 9(2)) in a fixed order set by article number, the same in every language. `render` raises `RuleViolation` if the checker fails.

## Files
- `data/templates.<en|ar|ur>.yaml`: 83 templates each with typed `{slots}`, no typed digits. Same ids and slots in every language (checked at load).
- `data/templates.constants.yaml`: the only digits besides engine numbers (denominator 100, article numbers). `templates.aliases.yaml` maps other lanes' keys to template ids. `templates.banned.yaml`: banned words in en, ar, ur. `templates.eval.yaml`: scoreboard notes.
- `data/glossary.<locale>.yaml`: 34 plain-language terms per language.
- `loader.py` (strict loading), `render.py` (template choice and slot filling), `checker.py`, `banned.py`, `text_tools.py` (digit normalisation, bidi isolates), `readability.py`, `evaluation.py`, `service.py`.

## The checker
Numeric fidelity: the digits printed in each block, in order and after normalising Western, Arabic-Indic and extended Arabic-Indic digits, must equal the numbers the block declares, and every declared number must equal the engine's number (re-derived from the DisclosedResult) or a declared constant. Gene symbols and variant labels are masked first; an identifier the engine did not supply is refused. Polarity: template ids and wording must match the category, a no-shared-change document must carry the limits template (and the related-couple caveat for related partners), and a withheld document must show no category, number, icon array or gene. Banned words: the English list always, plus the locale list.

## Tests and evaluation
`cd D:\dev\bayan\backend && uv run pytest tests/explain -q` renders 256 scenarios in three languages (768 documents) and injects 5,760 faults (flipped number, swapped lines, wrong digit system, flipped polarity in text and in ids, banned word, unknown identifier, false review claim, dropped limits). `run_explain_evaluation()` returns the scoreboard report (counts, numeric fidelity percent, polarity percent, mutation catch rate, English Flesch-Kincaid grade).

## Honest limits
- English readability is a computed Flesch-Kincaid grade (syllable heuristic, about one grade of error). **No validated Arabic or Urdu readability standard exists**, so none is computed or claimed.
- Arabic and Urdu text was drafted at authoring time with an LLM assistant (no personal data) and has not been read by a native clinical reviewer. Wording flagged by the drafters for review: the Arabic and Urdu word for carrier, "detection rate", "declaration".
- Detection statements are full localised sentences keyed by `statement_key` (panel rate, alpha-globin locus, related-couple shared misses). Their two numerals are read from the genetics label ("about 9 in 10") and machine-checked as engine numbers, so a rate change in genetics flows through. An unknown key or a label that is not "about N in 10 or 100" falls back to the generic template, which shows the English label as supplied (ADR 0147). The reasons for more_information_needed are passed as an argument because `DisclosedResult` has no field for them.
- The icon-array captions for sons and daughters rely on the introduction sentence ("each group is out of 100 pregnancies").
- The checker proves fidelity to the engine's numbers and categories, not that the engine is right, and not that the wording is clinically adequate.
- Statute citations follow the dossier section 3.3 reading of Federal Decree-Law 49/2023; the official text was not re-read in this build.

## Licences
Templates, glossary and checker are original, released with the repository licence. No third-party glossary, standard text or form is copied (spec rule 8). Statute articles and the programme standards are cited, not reproduced.
