"""The property checker must be able to FAIL. Each mutant (defined once, in
`bayan.governance.property_eval`) breaks one rule on purpose, on an isolated service instance; the same
checker must report a mismatch. If a mutant survives, the checker is vacuous for that rule."""

from __future__ import annotations

import pytest

import bayan.governance.disclosure as disclosure_mod
import bayan.governance.service as service_mod
from bayan.governance.disclosure import decide_disclosure
from bayan.governance.property_eval import (
    MUTANT_NAMES,
    evaluate_mutants,
    generate_scenario,
    mutant_factory,
    run_scenario,
    scenario_rng,
)

pytestmark = [pytest.mark.property, pytest.mark.slow]

BUDGET = 300


@pytest.mark.parametrize("name", MUTANT_NAMES)
def test_property_checker_kills_each_mutant(name: str) -> None:
    factory = mutant_factory(name)
    for i in range(BUDGET):
        outcome = run_scenario(generate_scenario(scenario_rng(20261120, i)), factory)
        if outcome.mismatch is not None:
            return
    pytest.fail(f"mutant {name} survived {BUDGET} sequences: the checker is vacuous for that rule")


def test_evaluate_mutants_reports_every_mutant_killed() -> None:
    results = evaluate_mutants(BUDGET)
    assert [r.name for r in results] == list(MUTANT_NAMES)
    assert all(r.killed and r.first_mismatch for r in results)


def test_unmutated_service_survives_the_same_budget() -> None:
    """Control: the real implementation passes the identical sequences."""
    for i in range(BUDGET):
        outcome = run_scenario(generate_scenario(scenario_rng(20261120, i)))
        assert outcome.mismatch is None, (i, outcome.mismatch)


def test_running_mutants_never_touches_shared_module_state() -> None:
    """Mutants run on isolated instances: nothing is patched on the modules live requests use."""
    before = (disclosure_mod.decide_disclosure, service_mod.decide_disclosure)
    evaluate_mutants(5)
    assert (disclosure_mod.decide_disclosure, service_mod.decide_disclosure) == before
    assert before[0] is decide_disclosure
