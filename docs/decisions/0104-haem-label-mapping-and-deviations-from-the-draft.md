# ADR 0104: How the draft haematology rule table maps to the closed vocabulary, and where this build deviates from the draft

- **Status:** Accepted (draft ruleset, clinician sign-off pending)
- **Date:** 2026-11-20
- **Deciders:** haem lane

## Context
`research/ch03/01-rules-draft.yaml` has 24 rules and 20 fixtures with its own output names. The contract `HaemLabel` in `core/contracts.py` has 3 CBC-only and 8 CBC-plus-HPLC labels. The fixtures were written by the same author as the rules, so they show internal consistency only.

## Decision
- `data/haem_rules.yaml` keeps the draft's structure, sources, locators, conditions and fixtures. It adds a `label` per terminal rule (and `label_s1` / `label_s2` for the validity rules that apply at both stages), clinician-facing `label_descriptions`, and `expect_label` on every fixture. The draft's output names stay in `output` and are shown in the rule trace.
- The stage is S2 when an HPLC input object is supplied and S1 otherwise. The loader refuses any rule whose label is outside the stage's vocabulary, so a CBC alone can never emit a carrier, not-a-carrier, normal or disease statement.
- **Label split (this build's decision, needs sign-off):** rules S2-R09 and S2-R10 ("alpha-thalassaemia or iron deficiency possible, no beta pattern") give `pattern_suggests_alpha_thal_trait`, or `pattern_suggests_iron_deficiency_first` when the laboratory flags low ferritin. The draft has one output; the contract has two labels; the sources disagree on iron-first versus proceed (report 01 section 1, item 9).
- **Deviation from the draft, validity rules suppress clinical flags (needs sign-off):** when a validity rule (V01 to V04, S2-V01) decides the label, no annotate flags are emitted. The draft would flag, for example, a possible alpha-thalassaemia on a 12-year-old using adult cut-offs while saying the record is out of scope.
- `pattern_suggests_possible_compound_or_affected` is reserved and has no rule: no guideline read supports an automated disease-state output.
- Rule conditions stay as readable expressions in the data file, evaluated by an `ast`-whitelisting interpreter (booleans, comparisons, declared names, constants), never `eval`. A missing value never satisfies an ordered comparison.
- **Cut: the four disagreeing parameters (MCV cut-off, borderline HbA2, iron-first, transfusion window) are documented but not separately configurable.** Their values are written into the rule conditions. Revisit when the clinical lead chooses values.

## Consequences
All 20 fixtures pass, and a property test shows no CBC-only input can yield an HPLC label or the reserved label. Numbers in the conditions remain the draft's, cited to their sources; none is mine.

## Revisit trigger
The clinical lead signs off, amends or rejects the rules and the label split; or the parameters need to be configurable per laboratory.
