"""Mutation tests: the checker must catch injected faults. Plus static audits and readability."""

from __future__ import annotations

import re
from pathlib import Path

import pytest
import yaml

from bayan.core.contracts import BlockKind, ExplainerDoc
from bayan.core.types import Locale
from bayan.explain.banned import find_banned
from bayan.explain.checker import check_document
from bayan.explain.evaluation import OPERATORS, build_scenarios, run_explain_evaluation
from bayan.explain.loader import DATA_DIR, load_bundles
from bayan.explain.readability import count_syllables, document_grade, flesch_kincaid_grade
from bayan.explain.render import render_result
from bayan.explain.service import build_explain_service
from bayan.explain.text_tools import number_tokens, to_ascii_digits

pytestmark = pytest.mark.unit

SCENARIOS = build_scenarios()
SERVICE = build_explain_service()
SHARED = next(
    s
    for s in SCENARIOS
    if s.name.startswith("shared_both_carriers|member_full_detail|abu_dhabi|unrelated")
)
NO_SHARED = next(
    s for s in SCENARIOS if s.name.startswith("no_shared|member_couple_only|abu_dhabi|first_cousin")
)
WITHHELD = next(
    s for s in SCENARIOS if s.name.startswith("withheld_counselling_first|member_couple_only")
)
LOCALES = (Locale.EN, Locale.AR, Locale.UR)


def _doc(scenario_name: str, locale: Locale) -> tuple[ExplainerDoc, str]:
    scenario = next(s for s in SCENARIOS if s.name.startswith(scenario_name))
    return render_result(
        SERVICE.bundle(locale), scenario.disclosed, scenario.reasons
    ), scenario.name


def _check(doc: ExplainerDoc, scenario_prefix: str, locale: Locale):
    scenario = next(s for s in SCENARIOS if s.name.startswith(scenario_prefix))
    return check_document(doc, scenario.disclosed, SERVICE.bundle(locale))


@pytest.mark.parametrize("locale", LOCALES)
def test_unmutated_documents_pass(locale: Locale) -> None:
    for prefix in (SHARED.name, NO_SHARED.name, WITHHELD.name):
        doc, _ = _doc(prefix, locale)
        assert _check(doc, prefix, locale).ok


@pytest.mark.parametrize("locale", LOCALES)
def test_flipped_number_in_text_is_caught(locale: Locale) -> None:
    doc, name = _doc(SHARED.name, locale)
    index = next(i for i, b in enumerate(doc.blocks) if b.kind is BlockKind.LIST and b.numbers)
    block = doc.blocks[index]
    flipped = tuple(re.sub(r"(?<!\w)25(?!\w)", "52", item) for item in block.items)
    assert flipped != block.items
    blocks = list(doc.blocks)
    blocks[index] = block.model_copy(update={"items": flipped})
    mutant = doc.model_copy(update={"blocks": tuple(blocks)})
    report = _check(mutant, name, locale)
    assert not report.ok
    assert not report.numeric_fidelity


@pytest.mark.parametrize("locale", LOCALES)
def test_swapped_numbers_between_outcome_lines_are_caught(locale: Locale) -> None:
    doc, name = _doc(SHARED.name, locale)
    index = next(
        i for i, b in enumerate(doc.blocks) if b.kind is BlockKind.LIST and len(b.items) == 3
    )
    block = doc.blocks[index]
    first, second = block.items[0], block.items[1]
    swapped = (
        first.replace("25", "50", 1),
        second.replace("50", "25", 1),
        block.items[2],
    )
    blocks = list(doc.blocks)
    blocks[index] = block.model_copy(update={"items": swapped})
    report = _check(doc.model_copy(update={"blocks": tuple(blocks)}), name, locale)
    assert not report.numeric_fidelity


def test_flipped_declared_number_and_icon_array_are_caught() -> None:
    doc, name = _doc(SHARED.name, Locale.EN)
    for operator in ("declared_number_flipped", "icon_array_flipped"):
        mutant = OPERATORS[operator](doc, SERVICE.bundle(Locale.EN), SHARED.disclosed)
        assert mutant is not None
        assert not _check(mutant, name, Locale.EN).numeric_fidelity, operator


def test_arabic_indic_digits_are_normalised_and_a_wrong_value_is_caught() -> None:
    assert number_tokens("٢٥ / ۱۰۰") == ["25", "100"]
    assert to_ascii_digits("٢٥") == "25"
    doc, name = _doc(SHARED.name, Locale.AR)
    mutant = OPERATORS["number_in_wrong_digit_system"](
        doc, SERVICE.bundle(Locale.AR), SHARED.disclosed
    )
    assert mutant is not None
    assert not _check(mutant, name, Locale.AR).numeric_fidelity


@pytest.mark.parametrize("locale", LOCALES)
def test_flipped_polarity_is_caught_in_text_and_in_template_ids(locale: Locale) -> None:
    doc, name = _doc(NO_SHARED.name, locale)
    bundle = SERVICE.bundle(locale)
    by_text = OPERATORS["polarity_flipped_in_text"](doc, bundle, NO_SHARED.disclosed)
    by_ids = OPERATORS["polarity_flipped_in_template_ids"](doc, bundle, NO_SHARED.disclosed)
    assert by_text is not None
    assert by_ids is not None
    for mutant in (by_text, by_ids):
        report = _check(mutant, name, locale)
        assert not report.ok
        assert not report.polarity


def test_shared_document_with_no_shared_wording_is_caught() -> None:
    doc, name = _doc(SHARED.name, Locale.EN)
    wrong = SERVICE.bundle(Locale.EN).templates["result.no_shared.heading"].text
    index = next(i for i, b in enumerate(doc.blocks) if b.kind is BlockKind.HEADING)
    blocks = list(doc.blocks)
    blocks[index] = blocks[index].model_copy(update={"text": wrong})
    assert not _check(doc.model_copy(update={"blocks": tuple(blocks)}), name, Locale.EN).polarity


def test_no_shared_document_without_limits_is_caught() -> None:
    doc, name = _doc(NO_SHARED.name, Locale.EN)
    mutant = doc.model_copy(
        update={
            "template_ids": tuple(t for t in doc.template_ids if t != "limits.panel_not_complete")
        }
    )
    assert not _check(mutant, name, Locale.EN).polarity


@pytest.mark.parametrize("locale", LOCALES)
def test_banned_word_is_caught_in_every_language(locale: Locale) -> None:
    doc, name = _doc(SHARED.name, locale)
    bundle = SERVICE.bundle(locale)
    for operator in ("banned_word_injected_in_locale", "banned_word_injected_english"):
        mutant = OPERATORS[operator](doc, bundle, SHARED.disclosed)
        assert mutant is not None
        report = _check(mutant, name, locale)
        assert not report.banned_words_absent, (operator, locale)


def test_banned_guard_matches_whole_words_and_arabic_clitics() -> None:
    assert find_banned("This couple is compatible.", Locale.EN)
    assert find_banned("A result of no-risk", Locale.EN)
    assert find_banned("You should proceed with the marriage", Locale.EN)
    assert not find_banned("A passage about compassion and bypass roads", Locale.EN)
    assert find_banned("والمتوافق", Locale.AR)
    assert find_banned("محفوظ", Locale.UR)
    assert not find_banned("A carrier has one changed copy of a gene.", Locale.EN)


def test_withheld_document_with_category_wording_is_caught() -> None:
    doc, name = _doc(WITHHELD.name, Locale.EN)
    wrong = SERVICE.bundle(Locale.EN).templates["result.shared.heading"].text
    blocks = list(doc.blocks)
    blocks.append(blocks[1].model_copy(update={"text": wrong}))
    report = _check(doc.model_copy(update={"blocks": tuple(blocks)}), name, Locale.EN)
    assert not report.polarity


def test_false_review_claim_and_unknown_identifier_are_caught() -> None:
    doc, name = _doc(SHARED.name, Locale.AR)
    for operator in ("false_review_claim", "unknown_identifier_injected"):
        mutant = OPERATORS[operator](doc, SERVICE.bundle(Locale.AR), SHARED.disclosed)
        assert mutant is not None
        assert not _check(mutant, name, Locale.AR).ok


def test_full_evaluation_catches_every_mutant_and_reports_readability() -> None:
    report = run_explain_evaluation()
    assert report.documents_checked == len(SCENARIOS) * 3
    assert report.render_refusals == 0
    assert (
        report.numeric_fidelity_pct
        == report.polarity_pct
        == report.banned_words_absent_pct
        == 100.0
    )
    assert report.mutants_generated > 1000
    assert report.mutation_catch_rate_pct == 100.0, report.uncaught_mutants
    assert set(report.mutation_by_operator) == set(OPERATORS)
    assert report.needs_clinician_signoff
    assert report.synthetic_inputs_only
    assert 0 < report.english_fk_grade_mean <= report.english_fk_grade_max <= 8.5
    assert (
        "No validated Arabic or Urdu readability standard exists" in report.arabic_urdu_readability
    )
    assert report.language_status == {"en": "draft", "ar": "draft", "ur": "draft"}
    assert all(n >= 25 for n in report.glossary_terms.values())


# ------------------------------------------------------------------------------ static audits
def _strings(node: object):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for v in node.values():
            yield from _strings(v)
    elif isinstance(node, list):
        for v in node:
            yield from _strings(v)


@pytest.mark.parametrize("locale", LOCALES)
@pytest.mark.parametrize("kind", ["templates", "glossary", "closure", "pathway"])
def test_no_user_visible_string_contains_a_banned_word_or_a_typed_number(
    kind: str, locale: Locale
) -> None:
    data = yaml.safe_load((DATA_DIR / f"{kind}.{locale.value}.yaml").read_text(encoding="utf-8"))
    skip = {
        "source",
        "authoring",
        "wording_basis",
        "default_source",
        "polarity_markers",
        "engine_slots",
    }
    problems: list[str] = []

    def walk(node: object, key: str = "") -> None:
        if isinstance(node, dict):
            for k, v in node.items():
                if k in skip or k == "meta":
                    continue
                walk(v, str(k))
        elif isinstance(node, list):
            for v in node:
                walk(v, key)
        elif isinstance(node, str):
            text = re.sub(r"\{[^}]*\}", "", node)
            if re.search(r"[0-9٠-٩۰-۹]", text):
                problems.append(f"digit in {key}: {node[:50]}")
            problems.extend(f"banned {hit!r} in {key}" for hit in find_banned(node, locale))

    walk(data)
    assert not problems


@pytest.mark.parametrize("locale", [Locale.AR, Locale.UR])
def test_arabic_and_urdu_files_declare_draft_status(locale: Locale) -> None:
    for kind in ("templates", "glossary", "closure", "pathway"):
        meta = yaml.safe_load(
            (DATA_DIR / f"{kind}.{locale.value}.yaml").read_text(encoding="utf-8")
        )["meta"]
        assert meta["language_status"] == "draft", (kind, locale)
        assert meta["needs_clinician_signoff"] is True
        assert meta["direction"] == "rtl"


def test_no_name_of_a_person_or_claim_of_review_in_data_files() -> None:
    for path in DATA_DIR.glob("*.yaml"):
        if not path.name.startswith(("templates", "glossary", "closure", "pathway")):
            continue
        text = path.read_text(encoding="utf-8").lower()
        assert "clinically reviewed" not in text, path.name
        assert "approved by" not in text, path.name


def test_templates_use_only_declared_constants_and_slots() -> None:
    bundles = load_bundles()
    assert bundles  # loader validates slots, typed numbers and parity at load time


# ------------------------------------------------------------------------------ readability
def test_flesch_kincaid_formula_and_syllables() -> None:
    assert count_syllables("gene") == 1
    assert count_syllables("pregnancy") == 3
    assert count_syllables("changed") == 1
    assert count_syllables("table") == 2
    text = "The cat sat on the mat. The dog ran to the park."
    grade = flesch_kincaid_grade(text)
    assert -3.0 < grade < 1.0
    assert flesch_kincaid_grade("") == 0.0


def test_english_readability_is_reported_per_document() -> None:
    grades = [
        document_grade(render_result(SERVICE.bundle(Locale.EN), s.disclosed, s.reasons), {"HBB"})
        for s in SCENARIOS[:20]
    ]
    assert all(0.0 < g < 9.0 for g in grades)


def test_readability_note_states_no_arabic_urdu_standard() -> None:
    notes = yaml.safe_load(Path(DATA_DIR / "templates.eval.yaml").read_text(encoding="utf-8"))[
        "notes"
    ]
    assert (
        "No validated Arabic or Urdu readability standard exists"
        in notes["arabic_urdu_readability"]
    )
