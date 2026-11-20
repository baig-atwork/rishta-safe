"""Service surface, the evaluation report, and property tests of the engine."""

from __future__ import annotations

import json

import pytest
from gen_helpers import FULL, carrier, female, male
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from bayan.core.contracts import (
    Finding,
    Inheritance,
    PersonReport,
    ResultCategory,
    Sex,
    Zygosity,
)
from bayan.core.errors import NotFound
from bayan.core.types import Relationship
from bayan.genetics.evaluation import EngineEvalReport, run_engine_evaluation
from bayan.genetics.service import (
    ConditionCatalogue,
    GeneticsService,
    PanelCatalogue,
    PanelInfo,
    build_genetics_service,
)

# ---------------------------------------------------------------- service


@pytest.mark.unit
def test_service_exposes_the_contract_surface(svc: GeneticsService) -> None:
    assert isinstance(svc.catalogue(), ConditionCatalogue)
    assert isinstance(svc.panels(), PanelCatalogue)
    panel = svc.panel(FULL)
    assert isinstance(panel, PanelInfo)
    assert panel.assumed
    assert panel.illustrative
    assert panel.needs_clinician_signoff
    assert isinstance(build_genetics_service(), GeneticsService)


@pytest.mark.unit
def test_unknown_panel_is_not_found(svc: GeneticsService) -> None:
    with pytest.raises(NotFound):
        svc.panel("nope")
    with pytest.raises(NotFound):
        svc.detection_statements("nope", Relationship.UNRELATED)


@pytest.mark.unit
def test_detection_is_attached_once_per_distinct_panel(svc: GeneticsService) -> None:
    same = svc.compute_couple_result("c", [female(), male()], Relationship.UNRELATED)
    assert {d.panel_id for d in same.detection} == {FULL}
    assert len(same.detection) == len(svc.detection_statements(FULL, Relationship.UNRELATED))


@pytest.mark.unit
def test_result_round_trips_through_json(svc: GeneticsService) -> None:
    result = svc.compute_couple_result(
        "c",
        [female(carrier("cystic_fibrosis")), male(carrier("cystic_fibrosis"))],
        Relationship.FIRST_COUSIN,
    )
    again = type(result).model_validate_json(result.model_dump_json())
    assert again == result


# ---------------------------------------------------------------- evaluation report


@pytest.mark.unit
def test_evaluation_report_is_typed_deterministic_and_synthetic() -> None:
    a = run_engine_evaluation(1_500, seed=42)
    b = run_engine_evaluation(1_500, seed=42)
    assert isinstance(a, EngineEvalReport)
    assert a.model_dump(exclude={"runtime_seconds"}) == b.model_dump(exclude={"runtime_seconds"})
    assert a.synthetic
    assert "Synthetic" in a.notice
    assert a.agreement_total == a.n == 1_500
    assert a.agreement_rate == 1.0
    assert sum(r.couples for r in a.by_relationship) == 1_500
    for r in a.by_relationship:
        assert sum(r.categories.values()) == r.couples
        assert r.ar_found + r.ar_missed == r.ar_truly_shared
    assert a.ruleset_version.startswith("rishta-safe-couple-1.0+")
    assert a.seed == 42
    assert a.runtime_seconds >= 0
    assert a.assumptions
    json.loads(a.model_dump_json())  # serialisable for the scoreboard


@pytest.mark.unit
def test_evaluation_differs_between_seeds() -> None:
    a = run_engine_evaluation(1_000, seed=1)
    b = run_engine_evaluation(1_000, seed=2)
    assert a.categories_overall != b.categories_overall


# ---------------------------------------------------------------- property tests

AR_CONDITIONS = (
    "beta_thalassaemia",
    "sickle_cell_disease",
    "hbb_compound_haemoglobin_disorder",
    "alpha_thalassaemia_alpha0",
    "cystic_fibrosis",
    "congenital_adrenal_hyperplasia",
    "familial_mediterranean_fever",
    "usher_syndrome_type_2a",
    "stargardt_disease",
    "eys_retinal_dystrophy",
)
GENE = {
    "beta_thalassaemia": "HBB",
    "sickle_cell_disease": "HBB",
    "hbb_compound_haemoglobin_disorder": "HBB",
    "alpha_thalassaemia_alpha0": "HBA1/HBA2",
    "cystic_fibrosis": "CFTR",
    "congenital_adrenal_hyperplasia": "CYP21A2",
    "familial_mediterranean_fever": "MEFV",
    "usher_syndrome_type_2a": "USH2A",
    "stargardt_disease": "ABCA4",
    "eys_retinal_dystrophy": "EYS",
    "g6pd_deficiency": "G6PD",
}


def _finding(condition_id: str, zygosity: Zygosity) -> Finding:
    xl = condition_id == "g6pd_deficiency"
    return Finding(
        gene=GENE[condition_id],
        condition_id=condition_id,
        zygosity=zygosity,
        inheritance=Inheritance.X_LINKED if xl else Inheritance.AUTOSOMAL_RECESSIVE,
        classification="vus" if zygosity is Zygosity.VUS else "pathogenic",
    )


@st.composite
def person_findings(draw: st.DrawFn, sex: Sex) -> tuple[Finding, ...]:
    chosen = draw(
        st.lists(st.sampled_from((*AR_CONDITIONS, "g6pd_deficiency")), max_size=4, unique=True)
    )
    # one finding per HBB-group member family is the clean case; the engine handles clashes separately.
    hbb = [c for c in chosen if GENE[c] == "HBB"]
    chosen = [c for c in chosen if GENE[c] != "HBB"] + hbb[:1]
    out: list[Finding] = []
    for cid in chosen:
        zyg = draw(
            st.sampled_from(
                (Zygosity.CARRIER, Zygosity.AFFECTED, Zygosity.VUS, Zygosity.NOT_DETECTED)
            )
        )
        if cid == "g6pd_deficiency" and sex is Sex.MALE and zyg is Zygosity.CARRIER:
            zyg = Zygosity.AFFECTED
        out.append(_finding(cid, zyg))
    return tuple(out)


@st.composite
def couples(draw: st.DrawFn) -> tuple[PersonReport, PersonReport]:
    f = PersonReport(
        person_id="F", sex=Sex.FEMALE, panel_id=FULL, findings=draw(person_findings(Sex.FEMALE))
    )
    m = PersonReport(
        person_id="M", sex=Sex.MALE, panel_id=FULL, findings=draw(person_findings(Sex.MALE))
    )
    return f, m


PROP = settings(
    max_examples=300, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture]
)


@pytest.mark.property
@PROP
@given(pair=couples(), rel=st.sampled_from(list(Relationship)))
def test_outcome_lines_always_sum_to_a_fixed_100_per_group(
    pair: tuple[PersonReport, PersonReport], rel: Relationship
) -> None:
    svc = _SVC
    result = svc.compute_couple_result("c", pair, rel)
    for shared in result.shared:
        by_group: dict[str, int] = {}
        for line in shared.outcomes:
            assert 0 < line.per_100 <= 100
            by_group[line.applies_to] = by_group.get(line.applies_to, 0) + line.per_100
        assert set(by_group.values()) == {100}
        if shared.inheritance is Inheritance.AUTOSOMAL_RECESSIVE:
            assert set(by_group) == {"any_child"}
        else:
            assert set(by_group) == {"son", "daughter"}


@pytest.mark.property
@PROP
@given(pair=couples())
def test_swapping_the_partner_order_changes_nothing_about_the_result(
    pair: tuple[PersonReport, PersonReport],
) -> None:
    svc = _SVC
    ab = svc.compute_couple_result("c", pair, Relationship.UNRELATED)
    ba = svc.compute_couple_result("c", (pair[1], pair[0]), Relationship.UNRELATED)
    assert (ab.category, ab.shared, ab.needs_more_information_reasons, ab.review_priority) == (
        ba.category,
        ba.shared,
        ba.needs_more_information_reasons,
        ba.review_priority,
    )


@pytest.mark.property
@PROP
@given(pair=couples())
def test_a_variant_of_uncertain_significance_never_creates_a_shared_result(
    pair: tuple[PersonReport, PersonReport],
) -> None:
    svc = _SVC
    only_vus = tuple(
        p.model_copy(
            update={"findings": tuple(_finding(f.condition_id, Zygosity.VUS) for f in p.findings)}
        )
        for p in pair
    )
    result = svc.compute_couple_result("c", only_vus, Relationship.FIRST_COUSIN)
    assert result.shared == ()
    assert result.category in {
        ResultCategory.MORE_INFORMATION_NEEDED,
        ResultCategory.NO_SHARED_CHANGE_FOUND,
    }
    has_vus = any(p.findings for p in only_vus)
    assert (result.category is ResultCategory.MORE_INFORMATION_NEEDED) == has_vus


@pytest.mark.property
@PROP
@given(pair=couples(), status=st.sampled_from(["pending", "cbc_only", "cbc_hplc"]))
def test_unconfirmed_reports_never_give_a_shared_or_no_shared_statement(
    pair: tuple[PersonReport, PersonReport], status: str
) -> None:
    svc = _SVC
    update = {"status": "pending_confirmation"} if status == "pending" else {"haem_stage": status}
    gated = (pair[0].model_copy(update=update), pair[1])
    result = svc.compute_couple_result("c", gated, Relationship.UNRELATED)
    assert result.category is ResultCategory.MORE_INFORMATION_NEEDED
    assert result.shared == ()
    assert result.needs_more_information_reasons


@pytest.mark.property
@PROP
@given(pair=couples(), rel=st.sampled_from(list(Relationship)))
def test_the_engine_is_deterministic(
    pair: tuple[PersonReport, PersonReport], rel: Relationship
) -> None:
    svc = _SVC
    assert svc.compute_couple_result("c", pair, rel) == svc.compute_couple_result("c", pair, rel)


@pytest.mark.property
@PROP
@given(pair=couples())
def test_a_shared_result_needs_a_finding_in_both_partners_or_an_x_linked_state(
    pair: tuple[PersonReport, PersonReport],
) -> None:
    svc = _SVC
    result = svc.compute_couple_result("c", pair, Relationship.UNRELATED)
    present = [
        {f.condition_id for f in p.findings if f.zygosity in (Zygosity.CARRIER, Zygosity.AFFECTED)}
        for p in pair
    ]
    for shared in result.shared:
        if shared.inheritance is Inheritance.AUTOSOMAL_RECESSIVE:
            hbb_group = {
                "beta_thalassaemia",
                "sickle_cell_disease",
                "hbb_compound_haemoglobin_disorder",
            }
            ids = {shared.condition_id} | (hbb_group if shared.gene == "HBB" else set())
            assert all(p & ids for p in present)
        else:
            assert any("g6pd_deficiency" in p for p in present)


_SVC = build_genetics_service()
