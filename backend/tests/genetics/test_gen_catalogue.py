"""Catalogue and panel data: provenance, flags, referential integrity, banned wording."""

from __future__ import annotations

import re
from importlib.resources import files

import pytest
from pydantic import ValidationError

from bayan.core.contracts import Inheritance
from bayan.genetics.catalogue import data_content_hash, load_catalogue, load_panels
from bayan.genetics.models import CarrierFrequency, ConditionRow, PanelInfo

pytestmark = pytest.mark.unit

# Spec section 2, rule 4: banned in any user-facing string.
BANNED = (
    "compatible",
    "incompatible",
    "pass",
    "fail",
    "no risk",
    "safe",
    "high risk",
    "moderate risk",
    "low risk",
    "you should",
    "you must not",
    "proceed with the marriage",
    "cancel",
)


def test_catalogue_has_the_requested_breadth() -> None:
    cat = load_catalogue()
    ids = {c.id for c in cat.conditions}
    assert len(cat.conditions) >= 12
    for required in (
        "beta_thalassaemia",
        "sickle_cell_disease",
        "alpha_thalassaemia_alpha0",
        "hb_h_disease",
        "hb_variant_other",
        "cystic_fibrosis",
        "congenital_adrenal_hyperplasia",
        "familial_mediterranean_fever",
        "usher_syndrome_type_2a",
        "stargardt_disease",
        "g6pd_deficiency",
    ):
        assert required in ids


def test_every_frequency_is_sourced_or_flagged_illustrative() -> None:
    for row in load_catalogue().conditions:
        freq = row.carrier_frequency
        if freq is None:
            continue
        if freq.illustrative:
            assert not freq.source_id or freq.basis, row.id
        else:
            assert freq.source_id, f"{row.id}: sourced value needs a source"
            assert freq.wording, f"{row.id}: sourced value needs the cited wording"
        assert freq.basis, f"{row.id}: every frequency states what it measures"


def test_cited_sources_say_what_the_build_read() -> None:
    cat = load_catalogue()
    for source in cat.sources:
        assert source.read_status, source.id
    used = {
        r.carrier_frequency.source_id
        for r in cat.conditions
        if r.carrier_frequency and r.carrier_frequency.source_id
    }
    assert used <= {s.id for s in cat.sources}


def test_published_headline_figures_match_the_cited_wording() -> None:
    rows = {c.id: c for c in load_catalogue().conditions}
    assert rows["congenital_adrenal_hyperplasia"].carrier_frequency is not None
    assert rows["congenital_adrenal_hyperplasia"].carrier_frequency.value == pytest.approx(0.106)
    assert rows["familial_mediterranean_fever"].carrier_frequency.value == pytest.approx(0.059)  # type: ignore[union-attr]
    assert rows["stargardt_disease"].carrier_frequency.value == pytest.approx(0.043)  # type: ignore[union-attr]
    cftr = rows["cystic_fibrosis"].carrier_frequency
    assert cftr is not None
    assert cftr.value == pytest.approx(2 * 0.0034 * (1 - 0.0034), abs=5e-5)
    assert cftr.derived


def test_unsourced_values_are_illustrative() -> None:
    rows = {c.id: c for c in load_catalogue().conditions}
    for cid in (
        "usher_syndrome_type_2a",
        "eys_retinal_dystrophy",
        "cyp1b1_anterior_segment_dysgenesis",
    ):
        freq = rows[cid].carrier_frequency
        assert freq is not None
        assert freq.illustrative
        assert freq.source_id is None
    assert rows["alpha_thalassaemia_alpha0"].carrier_frequency.illustrative  # type: ignore[union-attr]


def test_severity_tiers_are_all_illustrative() -> None:
    cat = load_catalogue()
    assert {c.severity_status for c in cat.conditions} == {"illustrative"}
    assert set(cat.severity_tier_definitions) == {"A", "B", "C"}
    assert all("illustrative" in d for d in cat.severity_tier_definitions.values())


def test_every_row_needs_clinician_signoff() -> None:
    cat = load_catalogue()
    assert cat.needs_clinician_signoff
    assert all(c.needs_clinician_signoff for c in cat.conditions)


def test_dominant_conditions_are_out_of_matrix_and_on_no_panel() -> None:
    cat = load_catalogue()
    dominant = [c for c in cat.conditions if c.inheritance is Inheritance.AUTOSOMAL_DOMINANT]
    assert dominant
    assert all(c.couple_matrix == "out_of_scope" for c in dominant)
    on_panels = {cid for p in load_panels().panels for cid in p.condition_ids}
    assert not on_panels & {c.id for c in dominant}


def test_panels_are_assumed_illustrative_and_gated() -> None:
    panels = load_panels()
    assert len(panels.panels) >= 2
    for panel in panels.panels:
        assert panel.assumed
        assert panel.illustrative
        assert panel.needs_clinician_signoff
        assert 0 < panel.assumed_detection_rate < 1
        assert panel.rate_basis
        assert panel.genes
        for cid in panel.condition_ids:
            assert load_catalogue().get(cid) is not None


def test_panels_say_they_are_not_the_real_programme_panels() -> None:
    panels = load_panels()
    text = (panels.note + " ".join(p.name_en + p.description for p in panels.panels)).lower()
    assert "synthetic" in text
    assert "demonstration" in text or "demo" in text


def test_locus_group_pairs_have_a_compound_condition() -> None:
    cat = load_catalogue()
    hbb = {g.id: g for g in cat.locus_groups}["HBB"]
    compound = cat.get(hbb.compound_condition_id)
    assert compound is not None
    assert compound.derived
    assert compound.carrier_frequency is None


def test_content_hash_is_stable_and_line_ending_independent() -> None:
    first = data_content_hash()
    assert len(first) == 64
    assert first == data_content_hash()
    assert load_catalogue().content_hash == first
    assert load_panels().content_hash == first


def test_data_files_contain_no_banned_wording() -> None:
    for name in ("conditions.yaml", "panels.yaml", "haem_rules.yaml"):
        text = (
            files("bayan")
            .joinpath("data", name)
            .read_text(encoding="utf-8")
            .lower()
            .replace("rishta safe", "")
        )
        for word in BANNED:
            pattern = r"(?<![a-z])" + re.escape(word) + r"(?![a-z])"
            assert not re.search(pattern, text), f"{name} contains banned wording {word!r}"


def test_data_files_name_no_individual() -> None:
    for name in ("conditions.yaml", "panels.yaml", "haem_rules.yaml"):
        text = files("bayan").joinpath("data", name).read_text(encoding="utf-8")
        for forbidden in (
            "Dr.",
            "Dr ",
            "reviewed by",
            "approved by",
            "clinically reviewed",
            "validated by",
        ):
            assert forbidden not in text, f"{name}: {forbidden!r}"


def test_a_non_illustrative_frequency_without_a_source_is_rejected() -> None:
    with pytest.raises(ValidationError):
        CarrierFrequency(value=0.05, illustrative=False, basis="from memory")


def test_a_derived_frequency_needs_its_derivation() -> None:
    with pytest.raises(ValidationError):
        CarrierFrequency(value=0.05, illustrative=True, basis="x", derived=True)


def test_x_linked_row_needs_the_x_kind() -> None:
    with pytest.raises(ValidationError):
        ConditionRow(
            id="x",
            gene="G",
            name_en="x",
            inheritance=Inheritance.X_LINKED,
            severity_tier="C",
            carrier_frequency=CarrierFrequency(value=0.1, illustrative=True, basis="x"),
        )


def test_panel_rates_cannot_be_unflagged() -> None:
    with pytest.raises(ValidationError):
        PanelInfo(
            id="p",
            name_en="p",
            description="d",
            condition_ids=("a",),
            assumed_detection_rate=0.9,
            assumed=False,
            rate_basis="measured",
        )
