"""Property tests: randomised sequences of roles, grants, revocations, expiries, right-not-to-know,
staff assignment and policy choice, checked against the independent reference model.

The generator, the executor and the reference model live in `bayan.governance.property_eval` and
`bayan.governance.reference_model` (ONE definition, shared with the judge scoreboard). Hypothesis
here is the driver: it draws a seed, the package turns it into a scenario, and the run must report no
mismatch. A failing example prints its seed, which reproduces it exactly:

    run_scenario(generate_scenario(random.Random(seed)))

The run prints its exact counts (see conftest.py). Override the number of sequences with
BAYAN_PROP_EXAMPLES (default 10000).
"""

from __future__ import annotations

import os
import random
import time

import pytest
from gov_helpers import EVAL_REPORT, PROPERTY_COUNTS
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from bayan.governance.property_eval import (
    EvalCounts,
    generate_scenario,
    run_disclosure_property_evaluation,
    run_scenario,
    scenario_rng,
)

pytestmark = [pytest.mark.property, pytest.mark.slow]

EXAMPLES = int(os.environ.get("BAYAN_PROP_EXAMPLES", "10000"))


@settings(
    max_examples=EXAMPLES,
    deadline=None,
    database=None,
    derandomize=True,
    suppress_health_check=list(HealthCheck),
)
@given(st.integers(min_value=0, max_value=2**62))
def test_disclosure_matches_reference_model_and_leaks_nothing(seed: int) -> None:
    outcome = run_scenario(generate_scenario(random.Random(seed)))
    counts = outcome.counts
    PROPERTY_COUNTS["sequences"] += counts.sequences
    PROPERTY_COUNTS["ops"] += counts.ops
    PROPERTY_COUNTS["disclosures"] += counts.decisions
    PROPERTY_COUNTS["allowed"] += counts.allowed
    PROPERTY_COUNTS["denied"] += counts.denied
    PROPERTY_COUNTS["withheld"] += counts.withheld
    PROPERTY_COUNTS["leak_scans"] += counts.leak_scans
    PROPERTY_COUNTS["escalations"] += counts.escalations
    PROPERTY_COUNTS["abnormal_sequences"] += counts.abnormal_sequences
    assert outcome.mismatch is None, f"seed={seed}: {outcome.mismatch}"


def test_scenarios_are_deterministic_and_exercise_every_branch() -> None:
    """The generator is reproducible, and a modest sample reaches every kind of decision."""
    assert generate_scenario(scenario_rng(1, 7)) == generate_scenario(scenario_rng(1, 7))
    total = EvalCounts()
    for i in range(300):
        total.add(run_scenario(generate_scenario(scenario_rng(1, i))).counts)
    assert total.allowed > 0
    assert total.denied > 0
    assert total.withheld > 0
    assert total.escalations > 0
    assert total.abnormal_sequences > 0
    assert total.leak_scans == total.allowed


def test_importable_evaluation_default_budget_is_clean_fast_and_kills_every_mutant() -> None:
    started = time.perf_counter()
    report = run_disclosure_property_evaluation()
    elapsed = time.perf_counter() - started
    assert report.sequences == 2000
    assert report.mismatches == 0, report.mismatch_examples
    assert report.decisions >= 14 * report.sequences
    assert report.leak_scans == report.allowed
    assert report.mutants_total == 10
    assert report.mutants_killed == 10, [m.name for m in report.mutants if not m.killed]
    assert elapsed < 60
    EVAL_REPORT["disclosure.property_eval (importable, default budget)"] = (
        f"{report.sequences} sequences, {report.ops} ops, {report.decisions} decisions "
        f"({report.allowed} allowed, {report.denied} denied), {report.leak_scans} leak scans, "
        f"{report.mismatches} mismatches vs the reference model; {report.mutants_killed}/"
        f"{report.mutants_total} mutants killed within {report.mutant_sequences_budget} sequences each; "
        f"{report.runtime_seconds:.1f} s"
    )


def test_importable_evaluation_is_deterministic_for_a_seed() -> None:
    a = run_disclosure_property_evaluation(150, seed=5, mutant_sequences=0)
    b = run_disclosure_property_evaluation(150, seed=5, mutant_sequences=0)
    assert a.model_copy(update={"runtime_seconds": 0.0}) == b.model_copy(
        update={"runtime_seconds": 0.0}
    )
    assert a.mutants == ()
    assert a.mutants_total == 0
