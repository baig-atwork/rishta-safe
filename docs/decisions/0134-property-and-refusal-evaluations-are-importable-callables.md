# ADR 0134: The disclosure property run and the refusal evaluation are importable callables

- **Status:** Accepted (refines ADR 0125 to 0127; supersedes where the tests held the only definition)
- **Date:** 2026-11-20
- **Deciders:** governance lane, at the controller's request (the judge scoreboard needs the numbers live)

## Decision
- `bayan.governance.property_eval.run_disclosure_property_evaluation(n_sequences=2000, seed=20261120)` returns a frozen `DisclosurePropertyReport` (sequences, operations, decisions, allowed, denied, leak scans, mismatches against the reference model, mutants killed, runtime, seed, caveat). Default runtime about 5 s on a laptop (2000 sequences plus 10 mutants at up to 300 sequences each).
- `bayan.governance.refusal_eval.run_refusal_evaluation()` returns a frozen `RefusalReport`: the dev split (tuned), the held-out split CURRENT run, and the held-out FIRST run frozen as a constant (36 of 59 refused = 61.0 percent, 0 of 20 benign refused, recorded 2026-11-20). Prompt sets moved to `governance/eval_data/`.
- ONE definition: the reference model (`reference_model.py`), the scenario generator, the executor and the mutants now live in the package; the hypothesis tests import them.

## Design calls that changed
- The generator is `random.Random` with one seed per sequence, not hypothesis strategies, because `hypothesis` is a dev-only dependency and the package must not import it. Hypothesis now only drives the seed. We lose its structured shrinking; a failing example prints its seed, which reproduces it exactly. The 10,000-sequence run is unchanged in size and now passes the same checks.
- Mutants run on ISOLATED service instances: the decision function is an instance attribute (`GovernanceService._decide`) and the assignment mutant is a subclass. The tests used to monkeypatch module functions, which would be unsafe inside a running API process, so that approach is not used in the package.
- Each scenario stops at its first mismatch, so `mismatches` counts failing sequences.

## Limits
Random, not exhaustive, not a proof; the model and the service share an author, so the textual leak scan and the mutant-kill result are the independent checks. The refusal held-out set is no longer held out if anyone tunes patterns on its misses: the frozen first run stays the honest estimate, and a test pins it.
