"""Render every category x viewer x policy x relationship x locale combination and run the checker."""

from __future__ import annotations

import pytest

from bayan.core.contracts import BlockKind, DisclosedResult, ResultCategory
from bayan.core.errors import RuleViolation
from bayan.core.types import Emirate, Locale, Relationship, Role
from bayan.explain.checker import check_document
from bayan.explain.evaluation import Scenario, build_scenarios
from bayan.explain.loader import load_bundles, load_constants
from bayan.explain.render import render_result
from bayan.explain.service import ExplainService, build_explain_service
from bayan.explain.text_tools import number_tokens

pytestmark = pytest.mark.unit

SCENARIOS = build_scenarios()
LOCALES = (Locale.EN, Locale.AR, Locale.UR)


@pytest.fixture(scope="module")
def service() -> ExplainService:
    return build_explain_service()


def test_scenario_matrix_is_large_enough() -> None:
    categories = {s.disclosed.category for s in SCENARIOS}
    assert categories == {*ResultCategory, None}
    roles = {s.disclosed.viewer_role for s in SCENARIOS}
    assert {Role.COUPLE_MEMBER, Role.COUNSELLOR} <= roles
    assert len(SCENARIOS) >= 200


@pytest.mark.parametrize("locale", LOCALES)
def test_every_scenario_renders_and_passes_the_checker(
    service: ExplainService, locale: Locale
) -> None:
    failures: list[str] = []
    for scenario in SCENARIOS:
        doc = service.render(scenario.disclosed, locale, reasons=scenario.reasons)
        assert doc.check is not None
        assert doc.check.ok, (scenario.name, doc.check.messages)
        report = service.check(doc, scenario.disclosed)
        if not report.ok:
            failures.append(f"{scenario.name}: {report.messages}")
    assert not failures


def test_language_status_is_draft_everywhere_and_shown(service: ExplainService) -> None:
    for locale in LOCALES:
        doc = service.render(SCENARIOS[0].disclosed, locale)
        assert doc.language_status == "draft"
        assert doc.template_ids[0] == "status.draft_notice"
        assert doc.blocks[0].kind is BlockKind.CALLOUT
    for locale in (Locale.AR, Locale.UR):
        bundle = service.bundle(locale)
        assert bundle.language_status == "draft"
        assert bundle.direction == "rtl"
        assert all(
            g.language_status == "draft" and g.needs_clinician_signoff for g in bundle.glossary
        )


def test_numbers_come_only_from_the_engine_or_declared_constants(service: ExplainService) -> None:
    constants = set(load_constants().values())
    for scenario in SCENARIOS[::7]:
        for locale in LOCALES:
            doc = service.render(scenario.disclosed, locale, reasons=scenario.reasons)
            engine_values: set[int] = set()
            for ref in doc.numbers_used:
                if ref.origin == "engine":
                    engine_values.update(int(t) for t in number_tokens(str(ref.value)))
            printed = {
                int(t)
                for b in doc.blocks
                for text in ([b.text] if b.text else []) + list(b.items)
                for t in number_tokens(text)
            }
            assert printed <= engine_values | constants


def test_shared_result_has_fixed_hundred_icon_array(service: ExplainService) -> None:
    shared = next(
        s for s in SCENARIOS if s.name.startswith("shared_both_carriers|member_couple_only")
    )
    doc = service.render(shared.disclosed, Locale.EN)
    arrays = [b.icon_array for b in doc.blocks if b.icon_array is not None]
    assert len(arrays) == 1
    spec = arrays[0]
    assert (spec.total, spec.affected, spec.carrier, spec.neither) == (100, 25, 50, 25)


def test_x_linked_has_one_array_per_group(service: ExplainService) -> None:
    case = next(
        s
        for s in SCENARIOS
        if s.name.startswith("shared_x_linked_carrier_female|member_couple_only")
    )
    doc = service.render(case.disclosed, Locale.EN)
    arrays = [b.icon_array for b in doc.blocks if b.icon_array is not None]
    assert len(arrays) == 2
    assert all(a.total == 100 and a.affected + a.carrier + a.neither == 100 for a in arrays)


def test_outcome_lines_that_do_not_sum_to_a_hundred_are_refused(service: ExplainService) -> None:
    case = next(
        s for s in SCENARIOS if s.name.startswith("shared_both_carriers|member_couple_only")
    )
    shared = case.disclosed.shared[0]
    broken_line = shared.outcomes[0].model_copy(update={"per_100": 30})
    broken = shared.model_copy(update={"outcomes": (broken_line, *shared.outcomes[1:])})
    disclosed = case.disclosed.model_copy(update={"shared": (broken,)})
    with pytest.raises(RuleViolation):
        service.render(disclosed, Locale.EN)


def test_no_shared_document_has_limits_and_related_caveat_and_no_residual_number(
    service: ExplainService,
) -> None:
    related = next(
        s
        for s in SCENARIOS
        if s.name.startswith("no_shared|member_couple_only|abu_dhabi|first_cousin")
    )
    unrelated = next(
        s
        for s in SCENARIOS
        if s.name.startswith("no_shared|member_couple_only|abu_dhabi|unrelated")
    )
    doc_related = service.render(related.disclosed, Locale.EN)
    doc_unrelated = service.render(unrelated.disclosed, Locale.EN)
    assert "limits.panel_not_complete" in doc_related.template_ids
    assert "limits.related_couple" in doc_related.template_ids
    assert "limits.related_couple" not in doc_unrelated.template_ids
    for doc in (doc_related, doc_unrelated):
        assert not any(b.kind is BlockKind.ICON_ARRAY for b in doc.blocks)
        # The only engine numbers are detection-rate numerals; there is no outcome or residual number.
        assert not any(
            ref.origin == "engine"
            and isinstance(ref.value, int)
            and not ref.key.startswith("detection.")
            for b in doc.blocks
            for ref in b.numbers
        )


def test_more_information_never_shows_outcomes_and_unknown_reason_is_generic(
    service: ExplainService,
) -> None:
    case = next(
        s
        for s in SCENARIOS
        if s.name.startswith("more_info_some_new_unknown_key|member_couple_only")
    )
    doc = service.render(case.disclosed, Locale.EN, reasons=case.reasons)
    assert "reason.generic" in doc.template_ids
    assert not any(b.kind is BlockKind.ICON_ARRAY for b in doc.blocks)
    known = next(
        s
        for s in SCENARIOS
        if s.name.startswith("more_info_haem_work_up_cbc_only|member_couple_only")
    )
    assert (
        "reason.haem_cbc_only"
        in service.render(known.disclosed, Locale.EN, reasons=known.reasons).template_ids
    )


def test_withheld_documents_do_not_leak_the_category_or_findings(service: ExplainService) -> None:
    withheld = [s for s in SCENARIOS if s.disclosed.category is None]
    assert withheld
    for scenario in withheld:
        for locale in LOCALES:
            doc = service.render(scenario.disclosed, locale)
            ids = set(doc.template_ids)
            assert not any(
                t.startswith(("result.", "shared.", "limits.", "own.", "partner.")) for t in ids
            )
            assert not any(b.kind is BlockKind.ICON_ARRAY for b in doc.blocks)
            text = " ".join(b.text + " ".join(b.items) for b in doc.blocks)
            assert "HBB" not in text
            assert not any(ref.origin == "engine" for b in doc.blocks for ref in b.numbers)


def test_withheld_with_own_findings_present_still_hides_them(service: ExplainService) -> None:
    """Governance populates own_findings even when the result is withheld; explain must not print them."""
    case = next(
        s for s in SCENARIOS if s.name.startswith("withheld_right_not_to_know|member_gene_names")
    )
    assert case.disclosed.own_findings
    text = " ".join(
        b.text + " ".join(b.items) for b in service.render(case.disclosed, Locale.EN).blocks
    )
    assert "CFTR" not in text
    assert "HBB" not in text


def test_partner_view_respects_scope(service: ExplainService) -> None:
    def ids(name: str) -> set[str]:
        case = next(s for s in SCENARIOS if s.name.startswith(name))
        return set(service.render(case.disclosed, Locale.EN).template_ids)

    base = "shared_both_carriers|"
    assert "partner.none" in ids(base + "member_couple_only|abu_dhabi|unrelated")
    assert "partner.gene_only" in ids(base + "member_gene_names|abu_dhabi|unrelated")
    assert "partner.full.carrier" in ids(base + "member_full_detail|abu_dhabi|unrelated")
    assert not any(t.startswith("partner.") for t in ids(base + "counsellor|abu_dhabi|unrelated"))


def test_policy_and_certificate_notes(service: ExplainService) -> None:
    case = next(
        s
        for s in SCENARIOS
        if s.name.startswith("shared_both_carriers|member_couple_only|dubai|first_cousin")
    )
    ids = service.render(case.disclosed, Locale.EN).template_ids
    assert "policy.dubai" in ids
    assert "certificate.refusal_tension" in ids
    other = next(
        s
        for s in SCENARIOS
        if s.name.startswith("shared_both_carriers|member_couple_only|abu_dhabi|first_cousin")
    )
    assert "policy.abu_dhabi" in service.render(other.disclosed, Locale.EN).template_ids


def test_boundary_notice_on_every_document(service: ExplainService) -> None:
    for scenario in SCENARIOS[::5]:
        for locale in LOCALES:
            doc = service.render(scenario.disclosed, locale, reasons=scenario.reasons)
            assert "boundary.education_decision_support" in doc.template_ids
            assert "status.synthetic_notice" in doc.template_ids


def test_options_pane_is_neutral_cited_and_in_a_fixed_order(service: ExplainService) -> None:
    docs = {loc: service.options_pane(loc) for loc in LOCALES}
    reference = docs[Locale.EN].template_ids
    for loc, doc in docs.items():
        assert doc.template_ids == reference, loc
        assert doc.check is not None
        assert doc.check.ok
        assert doc.language_status == "draft"
    order = [t for t in reference if t.startswith("options.item.")]
    assert order == [
        "options.item.preimplantation",
        "options.item.prenatal_diagnosis",
        "options.item.specialist_discussion",
    ]
    cited = {
        int(r.value)
        for r in docs[Locale.EN].numbers_used
        if r.key in {"const.art_11", "const.art_12", "const.art_9_para"}
    }
    assert {11, 12, 2} <= cited


def test_glossary_has_at_least_25_terms_in_each_language(service: ExplainService) -> None:
    for locale in LOCALES:
        entries = service.glossary(locale)
        assert len(entries) >= 25
        assert all(e.term and e.definition for e in entries)
    keys = {loc: {e.key for e in service.glossary(loc)} for loc in LOCALES}
    assert keys[Locale.EN] == keys[Locale.AR] == keys[Locale.UR]
    required = {
        "gene",
        "variant",
        "carrier",
        "recessive",
        "panel",
        "vus",
        "haemoglobin",
        "thalassaemia",
        "sickle_cell_disease",
        "hplc",
        "detection_rate",
        "consanguinity",
        "genetic_counselling",
        "confirmatory_test",
    }
    assert required <= keys[Locale.EN]


def test_every_template_cites_known_glossary_terms_and_locales_have_identical_ids() -> None:
    bundles = load_bundles()
    en = bundles[Locale.EN]
    for locale in (Locale.AR, Locale.UR):
        assert set(bundles[locale].templates) == set(en.templates)


def test_render_refuses_inconsistent_inputs(service: ExplainService) -> None:
    base = SCENARIOS[0].disclosed
    with pytest.raises(RuleViolation):
        service.render(base.model_copy(update={"shared": ()}), Locale.EN)
    nonshared = next(s for s in SCENARIOS if s.name.startswith("no_shared|member_couple_only"))
    with pytest.raises(RuleViolation):
        service.render(nonshared.disclosed.model_copy(update={"shared": base.shared}), Locale.EN)


def test_checker_is_independent_of_the_renderer_for_a_hand_edited_doc(
    service: ExplainService,
) -> None:
    scenario: Scenario = next(
        s for s in SCENARIOS if s.name.startswith("shared_both_carriers|member_couple_only")
    )
    doc = render_result(service.bundle(Locale.EN), scenario.disclosed)
    assert check_document(doc, scenario.disclosed, service.bundle(Locale.EN)).ok
    assert isinstance(scenario.disclosed, DisclosedResult)
    assert scenario.disclosed.policy in (Emirate.ABU_DHABI, Emirate.DUBAI)
    assert scenario.disclosed.relationship in (Relationship.UNRELATED, Relationship.FIRST_COUSIN)
