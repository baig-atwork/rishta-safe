"""Couple-result engine: the Mendelian table, the gates, the VUS and panel rules, review priority.

Hand-written expected values come from the Mendelian arithmetic in research report 03 section 2.3 and the couple table
in report 01 section 2.5. Every ruleset line here is a draft awaiting clinician sign-off.
"""

from __future__ import annotations

import pytest
from gen_helpers import (
    AD,
    FULL,
    HAEM,
    affected,
    carrier,
    female,
    finding,
    lines,
    male,
    person,
    vus,
)

from bayan.core.contracts import (
    CoupleResult,
    Inheritance,
    ResultCategory,
    ReviewPriority,
    Sex,
    Zygosity,
)
from bayan.core.errors import Invalid
from bayan.core.types import Relationship
from bayan.genetics.service import GeneticsService

pytestmark = pytest.mark.unit

SHARED = ResultCategory.SHARED_RESULT_FOUND
NONE_FOUND = ResultCategory.NO_SHARED_CHANGE_FOUND
MORE = ResultCategory.MORE_INFORMATION_NEEDED


def run(svc: GeneticsService, a, b, rel: Relationship = Relationship.UNRELATED) -> CoupleResult:  # type: ignore[no-untyped-def]
    return svc.compute_couple_result("C-TEST", [a, b], rel)


# ---------------------------------------------------------------- the autosomal recessive table


def test_both_carriers_give_25_50_25_per_100(svc: GeneticsService) -> None:
    r = run(svc, female(carrier("cystic_fibrosis")), male(carrier("cystic_fibrosis")))
    assert r.category is SHARED
    (s,) = r.shared
    assert (s.condition_id, s.basis, s.inheritance) == (
        "cystic_fibrosis",
        "both_carriers",
        Inheritance.AUTOSOMAL_RECESSIVE,
    )
    assert lines(s) == {"affected": 25, "carrier": 50, "neither": 25}
    assert all(isinstance(o.per_100, int) for o in s.outcomes)
    assert {o.applies_to for o in s.outcomes} == {"any_child"}


def test_affected_partner_and_carrier_give_50_50(svc: GeneticsService) -> None:
    r = run(svc, female(affected("cystic_fibrosis")), male(carrier("cystic_fibrosis")))
    (s,) = r.shared
    assert s.basis == "affected_partner_and_carrier"
    assert lines(s) == {"affected": 50, "carrier": 50}


def test_both_affected_give_100_affected(svc: GeneticsService) -> None:
    r = run(svc, female(affected("stargardt_disease")), male(affected("stargardt_disease")))
    (s,) = r.shared
    assert s.basis == "both_affected"
    assert lines(s) == {"affected": 100}


def test_one_carrier_and_a_partner_without_a_finding_is_no_shared_change(
    svc: GeneticsService,
) -> None:
    r = run(svc, female(carrier("cystic_fibrosis")), male())
    assert r.category is NONE_FOUND
    assert r.shared == ()
    assert r.review_priority is ReviewPriority.ROUTINE


def test_two_unrelated_carriers_of_different_genes_share_nothing(svc: GeneticsService) -> None:
    r = run(svc, female(carrier("cystic_fibrosis")), male(carrier("stargardt_disease")))
    assert r.category is NONE_FOUND


def test_affected_partner_with_a_negative_partner_is_not_shared_but_is_flagged(
    svc: GeneticsService,
) -> None:
    r = run(svc, female(affected("cystic_fibrosis")), male())
    assert r.category is NONE_FOUND
    assert r.review_priority is ReviewPriority.URGENT
    assert any(line.startswith("E13") for line in r.trace)


def test_nothing_found_in_either_partner(svc: GeneticsService) -> None:
    r = run(svc, female(), male())
    assert r.category is NONE_FOUND
    assert r.shared == ()
    assert r.needs_more_information_reasons == ()
    assert r.review_priority is ReviewPriority.ROUTINE


def test_alpha_zero_carrier_pair(svc: GeneticsService) -> None:
    r = run(
        svc,
        female(carrier("alpha_thalassaemia_alpha0")),
        male(carrier("alpha_thalassaemia_alpha0")),
    )
    (s,) = r.shared
    assert s.gene == "HBA1/HBA2"
    assert lines(s) == {"affected": 25, "carrier": 50, "neither": 25}
    assert r.review_priority is ReviewPriority.URGENT


# ---------------------------------------------------------------- the HBB locus group


def test_beta_thalassaemia_with_sickle_carrier_pairs_into_the_compound_condition(
    svc: GeneticsService,
) -> None:
    r = run(svc, female(carrier("beta_thalassaemia")), male(carrier("sickle_cell_disease")))
    assert r.category is SHARED
    (s,) = r.shared
    assert s.condition_id == "hbb_compound_haemoglobin_disorder"
    assert lines(s) == {"affected": 25, "carrier": 50, "neither": 25}
    assert any(line.startswith("E14") for line in r.trace)


def test_compound_affected_partner_with_a_carrier(svc: GeneticsService) -> None:
    r = run(
        svc,
        female(affected("hbb_compound_haemoglobin_disorder")),
        male(carrier("beta_thalassaemia")),
    )
    (s,) = r.shared
    assert s.condition_id == "hbb_compound_haemoglobin_disorder"
    assert s.basis == "affected_partner_and_carrier"
    assert lines(s) == {"affected": 50, "carrier": 50}
    assert r.review_priority is ReviewPriority.URGENT


def test_sickle_affected_with_sickle_carrier_keeps_the_sickle_condition(
    svc: GeneticsService,
) -> None:
    r = run(svc, female(affected("sickle_cell_disease")), male(carrier("sickle_cell_disease")))
    assert r.shared[0].condition_id == "sickle_cell_disease"


def test_other_haemoglobin_variants_always_need_a_specialist_read(svc: GeneticsService) -> None:
    r = run(svc, female(carrier("hb_variant_other")), male(carrier("hb_variant_other")))
    assert r.category is MORE
    assert r.shared == ()
    assert "specialist_read_needed" in r.needs_more_information_reasons
    assert any("needs_clinician_signoff" in line for line in r.trace)


def test_variant_with_a_beta_carrier_needs_a_specialist_read(svc: GeneticsService) -> None:
    r = run(svc, female(carrier("hb_variant_other")), male(carrier("beta_thalassaemia")))
    assert r.category is MORE
    assert "specialist_read_needed" in r.needs_more_information_reasons


def test_two_findings_at_the_hbb_locus_in_one_person_need_a_read(svc: GeneticsService) -> None:
    r = run(
        svc,
        female(carrier("beta_thalassaemia"), carrier("sickle_cell_disease")),
        male(carrier("beta_thalassaemia")),
    )
    assert r.category is MORE
    assert "duplicate_findings_same_locus" in r.needs_more_information_reasons


# ---------------------------------------------------------------- X-linked


def test_x_linked_carrier_female_gives_son_and_daughter_lines(svc: GeneticsService) -> None:
    r = run(svc, female(carrier("g6pd_deficiency")), male())
    assert r.category is SHARED
    (s,) = r.shared
    assert s.basis == "x_linked_carrier_female"
    sons = {o.label: o.per_100 for o in s.outcomes if o.applies_to == "son"}
    daughters = {o.label: o.per_100 for o in s.outcomes if o.applies_to == "daughter"}
    assert sons == {"affected": 50, "neither": 50}
    assert daughters == {"carrier": 50, "neither": 50}
    assert not any(o.applies_to == "any_child" for o in s.outcomes)
    assert r.review_priority is ReviewPriority.PRIORITY  # tier C is illustrative, never urgent


def test_x_linked_affected_male_with_a_female_without_the_variant(svc: GeneticsService) -> None:
    r = run(svc, female(), male(affected("g6pd_deficiency")))
    (s,) = r.shared
    assert s.basis == "x_linked_affected_male"
    assert {o.label: o.per_100 for o in s.outcomes if o.applies_to == "son"} == {"neither": 100}
    assert {o.label: o.per_100 for o in s.outcomes if o.applies_to == "daughter"} == {
        "carrier": 100
    }


def test_x_linked_affected_male_and_carrier_female(svc: GeneticsService) -> None:
    r = run(svc, female(carrier("g6pd_deficiency")), male(affected("g6pd_deficiency")))
    (s,) = r.shared
    assert s.basis == "affected_partner_and_carrier"
    assert {o.label: o.per_100 for o in s.outcomes if o.applies_to == "daughter"} == {
        "affected": 50,
        "carrier": 50,
    }


def test_x_linked_both_affected(svc: GeneticsService) -> None:
    r = run(svc, female(affected("g6pd_deficiency")), male(affected("g6pd_deficiency")))
    (s,) = r.shared
    assert s.basis == "both_affected"
    assert all(o.label == "affected" and o.per_100 == 100 for o in s.outcomes)


def test_x_linked_affected_female_with_unaffected_male_needs_a_clinical_read(
    svc: GeneticsService,
) -> None:
    r = run(svc, female(affected("g6pd_deficiency")), male())
    assert r.category is MORE
    assert "x_linked_clinical_read_needed" in r.needs_more_information_reasons


def test_x_linked_needs_one_female_and_one_male(svc: GeneticsService) -> None:
    a = person("P-1", Sex.FEMALE, carrier("g6pd_deficiency"))
    b = person("P-2", Sex.FEMALE)
    r = run(svc, a, b)
    assert r.category is MORE
    assert "x_linked_sex_pair_needed" in r.needs_more_information_reasons


def test_a_male_x_linked_carrier_is_inconsistent(svc: GeneticsService) -> None:
    r = run(svc, female(), male(carrier("g6pd_deficiency")))
    assert r.category is MORE
    assert "finding_inconsistent_with_sex" in r.needs_more_information_reasons


# ---------------------------------------------------------------- VUS never counts


def test_vus_alone_is_more_information_needed_never_a_result(svc: GeneticsService) -> None:
    r = run(svc, female(vus("cystic_fibrosis")), male(carrier("cystic_fibrosis")))
    assert r.category is MORE
    assert r.shared == ()
    assert "vus_present" in r.needs_more_information_reasons
    assert any(line.startswith("E04") for line in r.trace)
    assert r.review_priority is ReviewPriority.PRIORITY


def test_vus_zygosity_vus_with_pathogenic_label_is_still_not_counted(svc: GeneticsService) -> None:
    a = female(finding("cystic_fibrosis", Zygosity.CARRIER, classification="vus"))
    r = run(svc, a, male(carrier("cystic_fibrosis")))
    assert r.shared == ()
    assert r.category is MORE


def test_vus_with_a_shared_result_elsewhere_lets_the_shared_result_stand(
    svc: GeneticsService,
) -> None:
    a = female(carrier("cystic_fibrosis"), vus("stargardt_disease"))
    b = male(carrier("cystic_fibrosis"))
    r = run(svc, a, b)
    assert r.category is SHARED
    assert "vus_present" not in r.needs_more_information_reasons
    assert any(line.startswith("E04") for line in r.trace)
    assert [s.condition_id for s in r.shared] == ["cystic_fibrosis"]


def test_not_detected_findings_are_ignored(svc: GeneticsService) -> None:
    a = female(finding("cystic_fibrosis", Zygosity.NOT_DETECTED))
    assert run(svc, a, male()).category is NONE_FOUND


# ---------------------------------------------------------------- gates: pending and CBC-only work-ups


@pytest.mark.parametrize(
    ("kwargs", "reason"),
    [
        ({"status": "pending_confirmation"}, "result_pending_confirmation"),
        ({"haem_stage": "cbc_only"}, "haem_work_up_cbc_only"),
        ({"haem_stage": "cbc_hplc"}, "haem_work_up_hplc_unconfirmed"),
    ],
)
def test_unconfirmed_reports_never_give_a_shared_or_no_shared_statement(
    svc: GeneticsService, kwargs: dict[str, str], reason: str
) -> None:
    both_carriers = (carrier("beta_thalassaemia"),)
    r = run(svc, female(*both_carriers, **kwargs), male(*both_carriers))
    assert r.category is MORE
    assert r.shared == ()
    assert reason in r.needs_more_information_reasons
    # And the same with nothing found: still never "no shared change found".
    empty = run(svc, female(**kwargs), male())
    assert empty.category is MORE
    assert empty.review_priority is ReviewPriority.PRIORITY


def test_a_pending_partner_blocks_even_when_the_other_is_final(svc: GeneticsService) -> None:
    r = run(
        svc,
        female(carrier("cystic_fibrosis")),
        male(carrier("cystic_fibrosis"), status="pending_confirmation"),
    )
    assert r.category is MORE
    assert r.shared == ()


# ---------------------------------------------------------------- dominant, panels, consistency


def test_autosomal_dominant_findings_are_out_of_the_matrix(svc: GeneticsService) -> None:
    a = female(finding("neurofibromatosis_type_1", Zygosity.AFFECTED, inheritance=AD))
    b = male(finding("neurofibromatosis_type_1", Zygosity.AFFECTED, inheritance=AD))
    r = run(svc, a, b)
    assert r.category is NONE_FOUND
    assert r.shared == ()
    assert any(line.startswith("E05") for line in r.trace)


def test_different_panels_with_a_finding_outside_one_give_panel_mismatch(
    svc: GeneticsService,
) -> None:
    r = run(svc, female(carrier("cystic_fibrosis")), male(panel=HAEM))
    assert r.category is MORE
    assert "panel_mismatch" in r.needs_more_information_reasons


def test_different_panels_both_negative_are_compared_where_both_cover(svc: GeneticsService) -> None:
    r = run(svc, female(), male(panel=HAEM))
    assert r.category is NONE_FOUND
    assert any(line.startswith("E08") for line in r.trace)
    assert {d.panel_id for d in r.detection} == {FULL, HAEM}


def test_different_panels_shared_gene_covered_by_both_is_a_result(svc: GeneticsService) -> None:
    r = run(
        svc, female(carrier("beta_thalassaemia")), male(carrier("beta_thalassaemia"), panel=HAEM)
    )
    assert r.category is SHARED
    assert r.shared[0].condition_id == "beta_thalassaemia"


def test_a_finding_for_a_gene_outside_the_declared_panel_needs_review(svc: GeneticsService) -> None:
    r = run(svc, female(), male(carrier("cystic_fibrosis"), panel=HAEM))
    assert r.category is MORE
    assert "finding_outside_declared_panel" in r.needs_more_information_reasons


def test_duplicate_findings_for_one_condition_need_review(svc: GeneticsService) -> None:
    r = run(
        svc,
        female(carrier("cystic_fibrosis"), carrier("cystic_fibrosis")),
        male(carrier("cystic_fibrosis")),
    )
    assert r.category is MORE
    assert "duplicate_findings_same_locus" in r.needs_more_information_reasons


def test_inheritance_disagreeing_with_the_catalogue_needs_review(svc: GeneticsService) -> None:
    bad = finding("cystic_fibrosis", Zygosity.CARRIER, inheritance=Inheritance.X_LINKED)
    r = run(svc, female(bad), male(carrier("cystic_fibrosis")))
    assert r.category is MORE
    assert "finding_inconsistent_with_catalogue" in r.needs_more_information_reasons


# ---------------------------------------------------------------- invalid input


def test_unknown_panel_is_invalid(svc: GeneticsService) -> None:
    with pytest.raises(Invalid):
        run(svc, female(panel="no_such_panel"), male())


def test_unknown_condition_is_invalid(svc: GeneticsService) -> None:
    bad = finding("cystic_fibrosis", Zygosity.CARRIER).model_copy(
        update={"condition_id": "made_up"}
    )
    with pytest.raises(Invalid):
        run(svc, female(bad), male())


def test_exactly_two_distinct_people_are_required(svc: GeneticsService) -> None:
    with pytest.raises(Invalid):
        svc.compute_couple_result("C", [female()], Relationship.UNRELATED)
    with pytest.raises(Invalid):
        svc.compute_couple_result("C", [female(), female()], Relationship.UNRELATED)


# ---------------------------------------------------------------- determinism, relationship, versioning, wording


def test_same_input_gives_the_same_object(svc: GeneticsService) -> None:
    a, b = female(carrier("cystic_fibrosis")), male(carrier("cystic_fibrosis"))
    assert run(svc, a, b, Relationship.FIRST_COUSIN) == run(svc, a, b, Relationship.FIRST_COUSIN)


def test_relationship_does_not_change_the_mendelian_lines(svc: GeneticsService) -> None:
    a, b = female(carrier("cystic_fibrosis")), male(carrier("cystic_fibrosis"))
    results = [run(svc, a, b, rel) for rel in Relationship]
    assert len({r.shared for r in results}) == 1
    assert len({r.category for r in results}) == 1


def test_related_couples_carry_the_shared_miss_caveat_and_unrelated_do_not(
    svc: GeneticsService,
) -> None:
    a, b = female(), male()
    related = run(svc, a, b, Relationship.FIRST_COUSIN)
    unrelated = run(svc, a, b, Relationship.UNRELATED)
    assert related.detection
    assert all(d.related_couple_caveat for d in related.detection)
    assert unrelated.detection
    assert not any(d.related_couple_caveat for d in unrelated.detection)
    assert related.relationship is Relationship.FIRST_COUSIN


def test_ruleset_version_has_a_constant_and_a_content_hash(svc: GeneticsService) -> None:
    r = run(svc, female(), male())
    base, _, digest = r.ruleset_version.partition("+")
    assert base == "rishta-safe-couple-1.0"
    assert len(digest) == 12
    assert svc.ruleset_info().data_content_hash.startswith(digest)
    assert svc.ruleset_info().needs_clinician_signoff


def test_every_fired_rule_appends_a_trace_line(svc: GeneticsService) -> None:
    r = run(
        svc,
        female(carrier("cystic_fibrosis"), vus("stargardt_disease")),
        male(carrier("cystic_fibrosis")),
    )
    prefixes = [line.split(" ", 1)[0] for line in r.trace]
    assert prefixes[0] == "E01"
    assert "E10" in prefixes
    assert "E04" in prefixes
    assert prefixes[-1] in {"P1", "P2", "P3"}


def test_no_banned_wording_in_trace_or_reason_keys(svc: GeneticsService) -> None:
    banned = ("compatible", "no risk", "safe", "high risk", "low risk", "you should", "cancel")
    cases = [
        run(svc, female(carrier("cystic_fibrosis")), male(carrier("cystic_fibrosis"))),
        run(svc, female(vus("cystic_fibrosis")), male()),
        run(svc, female(status="pending_confirmation"), male()),
        run(svc, female(affected("cystic_fibrosis")), male()),
    ]
    for r in cases:
        text = (
            " ".join(r.trace + r.needs_more_information_reasons).lower().replace("rishta safe", "")
        )
        assert not any(word in text for word in banned)


# ---------------------------------------------------------------- review priority ladder (staff-only)


def test_priority_urgent_for_a_shared_tier_a_condition(svc: GeneticsService) -> None:
    r = run(svc, female(carrier("sickle_cell_disease")), male(carrier("sickle_cell_disease")))
    assert r.review_priority is ReviewPriority.URGENT


def test_priority_priority_for_a_shared_tier_c_condition(svc: GeneticsService) -> None:
    r = run(
        svc,
        female(carrier("familial_mediterranean_fever")),
        male(carrier("familial_mediterranean_fever")),
    )
    assert r.category is SHARED
    assert r.review_priority is ReviewPriority.PRIORITY


def test_priority_urgent_for_an_affected_partner_of_a_tier_b_condition(
    svc: GeneticsService,
) -> None:
    r = run(
        svc,
        female(affected("congenital_adrenal_hyperplasia")),
        male(carrier("congenital_adrenal_hyperplasia")),
    )
    assert r.review_priority is ReviewPriority.URGENT


def test_priority_for_more_information_needed_is_priority(svc: GeneticsService) -> None:
    r = run(svc, female(vus("cystic_fibrosis")), male())
    assert r.category is MORE
    assert r.review_priority is ReviewPriority.PRIORITY
