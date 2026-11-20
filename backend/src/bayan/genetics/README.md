# bayan.genetics

The couple-result engine, the condition and panel catalogue, detection statements, and the synthetic evaluation kit.
**Synthetic-data prototype. Not a medical device, not a diagnosis, not clinical advice.** Every rule, tier, frequency
and detection rate needs sign-off from the clinical lead (pending); nothing here is "reviewed" or "validated".

## What is here

| File | Purpose |
|---|---|
| `service.py` | `GeneticsService` (`compute_couple_result`, `catalogue`, `panel`, `detection_statements`, plus `panels`, `ruleset_info`) and `build_genetics_service()`. Also exports `ConditionCatalogue`, `PanelCatalogue`, `PanelInfo`. |
| `engine.py` | Deterministic Mendelian classification into `CoupleResult` with a one-line-per-rule `trace` (rules E01 to E25, P1 to P3). |
| `catalogue.py`, `models.py` | Load and validate `data/conditions.yaml` and `data/panels.yaml` (fails fast on a broken reference). |
| `detection.py` | `DetectionStatement` objects from a panel's assumed rate and the relationship. Never a residual number. |
| `residual.py` | Residual closed forms. INTERNAL ANALYSIS ONLY, unreviewed by a statistician. Never exposed. |
| `synthetic.py` | Gene-dropping generator through five pedigrees, with ground-truth alleles. |
| `oracle.py` | Independent allele-level classifier (shares no code with the engine). |
| `evaluation.py` | `run_engine_evaluation(n, seed) -> EngineEvalReport` for the scoreboard. |

## Result rules in one place

Both carriers of one recessive condition: 25 affected, 50 carrier, 25 neither per 100 pregnancies (integers, fixed
denominator). Affected plus carrier: 50 and 50. Both affected: 100. X-linked: separate son and daughter lines. HBB
carriers of different conditions pair into `hbb_compound_haemoglobin_disorder` (ADR 0100). A variant of uncertain
significance is never counted. A pending report, or a haematology work-up that stopped at CBC or CBC plus HPLC, can never
give a shared or no-shared statement. Dominant findings are outside the couple matrix. Relatedness never changes the
Mendelian lines (it changes how much a negative result reassures, carried by the detection statements).

Reason keys the explainer must handle (`needs_more_information_reasons`): `result_pending_confirmation`,
`haem_work_up_cbc_only`, `haem_work_up_hplc_unconfirmed`, `vus_present`, `panel_mismatch`,
`finding_outside_declared_panel`, `finding_inconsistent_with_sex`, `finding_inconsistent_with_catalogue`,
`duplicate_findings_same_locus`, `specialist_read_needed`, `x_linked_clinical_read_needed`, `x_linked_sex_pair_needed`.

Detection statement keys: `detection.panel_rate_assumed`, `detection.alpha_globin_locus_limit`,
`detection.related_couple_shared_misses` (the last sets `related_couple_caveat` on every statement for a related couple).

X-linked `OutcomeLine`s use `applies_to` of `son` or `daughter` and are per 100 sons or per 100 daughters.

`ruleset_version` is `rishta-safe-couple-1.0+<first 12 hex of the SHA-256 of conditions.yaml and panels.yaml>` (line endings
normalised).

## Run the tests

```
cd D:\dev\bayan\backend
uv run pytest tests/genetics -q                 # all (about 35 s)
uv run pytest tests/genetics -q -m "not slow"   # skip the large simulations
uv run pytest tests/genetics -q -m oracle       # engine versus oracle, gene-dropping versus closed forms
uv run ruff check src tests ; uv run mypy
```

## Data sources and licences

Facts (numbers with a citation) are quoted; no table is copied (spec rule 8). Carrier frequencies cite Jain et al. 2025
(Genet Med Open, 1,194 Emirati exomes; CYP21A2, MEFV, ABCA4 carrier rates and the CFTR gene frequency, re-read by this
build), Belhoul et al. 2013 (Dubai premarital screening, beta-thalassaemia trait, Hb S) and Abdulrazzaq et al. 1999 (G6PD).
USH2A, EYS, CYP1B1, alpha-zero and HbH values are illustrative and flagged. AVDB is all rights reserved, so no AVDB
value is used as a sourced figure. Each source in `conditions.yaml` says what this build actually read. Panel detection
rates are assumed (no published per-panel rate was found) and flagged `assumed`, `illustrative`,
`needs_clinician_signoff`. The panels are not the Abu Dhabi, Dubai or federal programme panels.

## Known limits

- Detection rates are assumed; several carrier frequencies are illustrative; severity tiers are illustrative.
- The correlated-miss assumption (one detection probability per allele lineage, shared by descent) is unreviewed.
- The synthetic generator drops X-linked loci independently, skips specialist-read conditions, and assumes outbred
  founders (ADR 0103). X-linked G6PD (15 percent of males, one hospital's newborns) dominates the synthetic couples'
  shared-result rate; use the `ar_*` fields for the autosomal screen.
- Agreement with the oracle is consistency of two derivations on synthetic couples, not clinical validation.
- Who may see an X-linked or affected-partner result is a legal read for governance, not decided here.
- No staff-only review priority is shown to a couple; priority levels are design rules without an external source (ADR 0105).
