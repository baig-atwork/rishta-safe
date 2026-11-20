# bayan.haem

A clinician-facing haematology aid: CBC, then HPLC, into a closed vocabulary with a rule trace.
**Synthetic-data prototype. Screening support only, never a diagnosis, never clinical advice.** Every one of the 24
rules needs sign-off from the clinical lead (pending). **Prior art:** other public tools already interpret laboratory values
(haemoglobin, MCV, MCH, HbA2, HbF, ferritin, G6PD) with named sources; this aid is not claimed as new.

## What it does

`HaemService.interpret(cbc, hplc)` returns a `HaemInterpretation`: a label from `HaemLabel` (3 CBC-only labels, 8 CBC
plus HPLC labels), the fired rules as a trace with source and locator, flags, mandatory statements, the sources where
the guidelines disagree, `needs_clinician_signoff: true`, a plain `not_a_diagnosis` notice, the prior-art note, and the
population caveat (the rules come from NHS England antenatal and BSH guidance; use for non-pregnant premarital adults is
an extrapolation the clinician must own). `rules_view()` returns the whole rule table.

A CBC alone can never produce carrier, not-a-carrier, normal or disease: the loader refuses any label outside the stage's
vocabulary. No discriminant index (Mentzer and similar) is a rule. No numeric ferritin cut-off is written (the laboratory's
own low or not-low flag is used). Missing values are never imputed (the label is `cbc_incomplete` or `work_up_incomplete`).

## Files

- `data/haem_rules.yaml`: derived from `research/ch03/01-rules-draft.yaml` (same rules, sources, locators, fixtures), plus
  labels, descriptions and `expect_label`. See ADR 0104 for the mapping and the two deviations.
- `models.py` (typed, range-checked inputs and outputs), `rules.py` (loader and a whitelisting `ast` interpreter, never
  `eval`), `service.py` (`HaemService`, `build_haem_service()`).
- Routes: `bayan/api/routers/haem.py` (`POST /v1/haem/interpret`, `GET /v1/haem/rules`). Role gating (clinician only) belongs
  to the composition layer.

## Run the tests

```
cd D:\dev\bayan\backend
uv run pytest tests/haem -q
uv run ruff check src tests ; uv run mypy
```

## About the 20 fixtures

They were written by the same author as the rules, so passing them shows the engine reproduces the table as written
(internal consistency). They are not validation, and say nothing about sensitivity or specificity.

## Sources and licences

Thresholds are facts cited to their sources (NHS England handbook, Open Government Licence v3.0; BSH 2023; TIF booklet;
SITE 2022, CC BY 4.0; Oman 2018). The licences of BSH, TIF and the Oman guideline for reuse were not checked, so their
text is cited, not copied. Each rule carries its source id and locator.

## Known limits

- Rules are a draft awaiting sign-off; sources disagree on four parameters (MCV cut-off, borderline HbA2, iron-first,
  transfusion window). They are documented, written into the conditions, and not yet separately configurable.
- Scope guards: age under 16, transfusion within four months or unknown, haemoglobin under 80 g/L at the CBC stage, total
  HbA2 not attested, more than one HbA band.
- Alpha-thalassaemia needs DNA; neither CBC nor HPLC resolves it.
- No machine learning, no disease-state classifier.
