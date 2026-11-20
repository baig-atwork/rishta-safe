"""Detection statements are localised sentences whose numerals track the genetics lane's labels."""

from __future__ import annotations

import re

import pytest

from bayan.core.contracts import Block, DetectionStatement, DisclosedResult, ResultCategory
from bayan.core.types import Emirate, Locale, Relationship, Role
from bayan.explain.render import render_result
from bayan.explain.service import build_explain_service
from bayan.explain.text_tools import number_tokens
from bayan.genetics.service import build_genetics_service

pytestmark = pytest.mark.unit

SERVICE = build_explain_service()
GENETICS = build_genetics_service()
PANELS = ("uae_demo_panel_v1", "haemoglobinopathy_demo_panel_v1")
RELATIONSHIPS = (Relationship.UNRELATED, Relationship.FIRST_COUSIN)


def _disclosed(
    statements: tuple[DetectionStatement, ...], relationship: Relationship
) -> DisclosedResult:
    return DisclosedResult(
        couple_id="syn-couple",
        viewer_role=Role.COUNSELLOR,
        policy=Emirate.ABU_DHABI,
        category=ResultCategory.NO_SHARED_CHANGE_FOUND,
        detection=statements,
        relationship=relationship,
    )


def _statement_block(doc_blocks: tuple[Block, ...], index: int) -> Block:
    key = f"detection.{index}.rate_num"
    return next(b for b in doc_blocks if any(r.key == key for r in b.numbers))


@pytest.mark.parametrize("relationship", RELATIONSHIPS)
@pytest.mark.parametrize("panel_id", PANELS)
def test_arabic_and_urdu_sentences_carry_the_numerals_of_the_genetics_labels(
    panel_id: str, relationship: Relationship
) -> None:
    statements = GENETICS.detection_statements(panel_id, relationship)
    assert statements
    disclosed = _disclosed(statements, relationship)
    for locale in (Locale.EN, Locale.AR, Locale.UR):
        doc = render_result(SERVICE.bundle(locale), disclosed)
        assert SERVICE.check(doc, disclosed).ok, locale
        for index, statement in enumerate(statements):
            expected = re.findall(
                r"\d+", statement.detection_rate_label
            )  # independent of explain's reader
            assert len(expected) == 2, statement.detection_rate_label
            block = _statement_block(doc.blocks, index)
            # Urdu puts the denominator first ("10 میں سے 9"), so compare the numerals as a set of
            # tokens and the roles (numerator, denominator) by the keys the checker re-derives.
            assert sorted(number_tokens(block.text)) == sorted(expected), (
                locale,
                statement.statement_key,
            )
            declared = {r.key: r.value for r in block.numbers}
            assert declared[f"detection.{index}.rate_num"] == int(expected[0])
            assert declared[f"detection.{index}.rate_den"] == int(expected[1])
            assert all(
                ref.origin == "engine" for ref in block.numbers if ref.key.startswith("detection.")
            )


@pytest.mark.parametrize("panel_id", PANELS)
def test_arabic_and_urdu_documents_contain_no_english_detection_label(panel_id: str) -> None:
    statements = GENETICS.detection_statements(panel_id, Relationship.FIRST_COUSIN)
    disclosed = _disclosed(statements, Relationship.FIRST_COUSIN)
    for locale in (Locale.AR, Locale.UR):
        doc = render_result(SERVICE.bundle(locale), disclosed)
        text = " ".join(b.text for b in doc.blocks)
        for statement in statements:
            assert statement.detection_rate_label not in text
        assert "assumed" not in text
        assert not re.search(r"[A-Za-z]{4,} [a-z]{3,} [a-z]{3,}", text.replace("HBB", ""))
        assert "limits.detection.generic" not in doc.template_ids


def test_english_sentences_keep_the_assumed_illustrative_not_measured_qualifiers() -> None:
    statements = GENETICS.detection_statements(PANELS[0], Relationship.FIRST_COUSIN)
    doc = render_result(
        SERVICE.bundle(Locale.EN), _disclosed(statements, Relationship.FIRST_COUSIN)
    )
    by_id = {t: SERVICE.bundle(Locale.EN).templates[t].text for t in doc.template_ids}
    assert "assumed and illustrative" in by_id["limits.detection.panel_rate_assumed"]
    assert "not a measured rate" in by_id["limits.detection.panel_rate_assumed"]
    assert "assumed and illustrative" in by_id["limits.detection.alpha_globin_locus_limit"]
    assert "(assumed)" in by_id["limits.detection.related_couple_shared_misses"]
    assert "limits.detection.assumed_note" in doc.template_ids


def test_a_changed_rate_flows_through_to_every_language() -> None:
    changed = DetectionStatement(
        panel_id="p",
        statement_key="detection.panel_rate_assumed",
        detection_rate_label="about 7 in 10 of the known changes in these genes (assumed and illustrative)",
    )
    disclosed = _disclosed((changed,), Relationship.UNRELATED)
    for locale in (Locale.EN, Locale.AR, Locale.UR):
        doc = render_result(SERVICE.bundle(locale), disclosed)
        assert sorted(number_tokens(_statement_block(doc.blocks, 0).text)) == ["10", "7"]
    wrong = render_result(SERVICE.bundle(Locale.AR), disclosed)
    block = _statement_block(wrong.blocks, 0)
    tampered = wrong.model_copy(
        update={
            "blocks": tuple(
                b.model_copy(update={"text": b.text.replace("7", "9")}) if b is block else b
                for b in wrong.blocks
            )
        }
    )
    assert not SERVICE.check(tampered, disclosed).numeric_fidelity


def test_unknown_key_or_unparsable_label_falls_back_to_the_safe_generic_template() -> None:
    cases = (
        DetectionStatement(
            panel_id="p",
            statement_key="detection.some_new_key",
            detection_rate_label="about 9 in 10 (new)",
        ),
        DetectionStatement(
            panel_id="p",
            statement_key="detection.panel_rate_assumed",
            detection_rate_label="roughly nine in ten",
        ),
        DetectionStatement(
            panel_id="p",
            statement_key="detection.panel_rate_assumed",
            detection_rate_label="about 9 in 10 and 3 in 4",
        ),
    )
    for statement in cases:
        disclosed = _disclosed((statement,), Relationship.UNRELATED)
        for locale in (Locale.EN, Locale.AR, Locale.UR):
            doc = render_result(SERVICE.bundle(locale), disclosed)
            assert "limits.detection.generic" in doc.template_ids
            assert SERVICE.check(doc, disclosed).ok
            assert statement.detection_rate_label in " ".join(b.text for b in doc.blocks)
            assert doc.language_status == "draft"
