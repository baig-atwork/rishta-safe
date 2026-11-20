"""Typed models for the condition catalogue and the demonstration panels.

Everything here describes SYNTHETIC-DATA demonstration content. Every clinical datum carries a source or is flagged
illustrative (spec section 2, rules 2 and 3), and every row needs clinician sign-off.
"""

from __future__ import annotations

from typing import Literal, Self

from pydantic import Field, model_validator

from bayan.core.contracts import Frozen, Inheritance

SeverityTier = Literal["A", "B", "C"]
CoupleMatrix = Literal["simple", "specialist_read", "out_of_scope"]


class SourceRef(Frozen):
    """A cited source and an honest statement of what this build actually read of it."""

    id: str
    title: str
    year: str
    url: str | None = None
    read_status: str


class CarrierFrequency(Frozen):
    """A carrier frequency with its provenance, or an explicit illustrative flag.

    `kind` says what `value` means: the heterozygote carrier frequency for an autosomal recessive condition, or the
    variant allele frequency among males (which equals the hemizygous prevalence) for an X-linked one.
    """

    value: float = Field(ge=0.0, le=1.0)
    kind: Literal["carrier_heterozygote", "x_male_hemizygous"] = "carrier_heterozygote"
    illustrative: bool
    source_id: str | None = None
    wording: str | None = None
    wording_verbatim: bool = False
    basis: str
    derived: bool = False
    derivation: str | None = None
    note: str | None = None

    @model_validator(mode="after")
    def _provenance(self) -> Self:
        if not self.illustrative and (not self.source_id or not self.wording):
            msg = "a non-illustrative carrier frequency needs source_id and wording (spec rule 3)"
            raise ValueError(msg)
        if self.derived and not self.derivation:
            msg = "a derived carrier frequency needs its derivation"
            raise ValueError(msg)
        return self


class LocusGroup(Frozen):
    """Conditions at one locus whose carriers can pair into a disease state across conditions."""

    id: str
    gene: str
    compound_condition_id: str
    note: str


class ConditionRow(Frozen):
    id: str
    gene: str
    name_en: str
    inheritance: Inheritance
    severity_tier: SeverityTier
    # No source assigns a tier, so this is always "illustrative" in this prototype.
    severity_status: Literal["illustrative", "sourced"] = "illustrative"
    locus_group: str | None = None
    couple_matrix: CoupleMatrix = "simple"
    derived: bool = False
    carrier_frequency: CarrierFrequency | None = None
    notes: str = ""
    needs_clinician_signoff: bool = True

    @model_validator(mode="after")
    def _frequency_kind_matches_inheritance(self) -> Self:
        freq = self.carrier_frequency
        if freq is None:
            return self
        if self.inheritance is Inheritance.X_LINKED and freq.kind != "x_male_hemizygous":
            msg = f"{self.id}: an X-linked row needs kind x_male_hemizygous"
            raise ValueError(msg)
        if (
            self.inheritance is Inheritance.AUTOSOMAL_RECESSIVE
            and freq.kind != "carrier_heterozygote"
        ):
            msg = f"{self.id}: an autosomal recessive row needs kind carrier_heterozygote"
            raise ValueError(msg)
        return self


class ConditionCatalogue(Frozen):
    """The condition catalogue (what `GET /v1/catalogue/conditions` returns)."""

    version: str
    status: str
    needs_clinician_signoff: bool
    boundary_note: str
    severity_tier_definitions: dict[str, str]
    sources: tuple[SourceRef, ...]
    locus_groups: tuple[LocusGroup, ...] = ()
    conditions: tuple[ConditionRow, ...]
    content_hash: str = ""

    @model_validator(mode="after")
    def _integrity(self) -> Self:
        ids = [c.id for c in self.conditions]
        if len(ids) != len(set(ids)):
            msg = "duplicate condition id in conditions.yaml"
            raise ValueError(msg)
        source_ids = {s.id for s in self.sources}
        for c in self.conditions:
            freq = c.carrier_frequency
            if freq is not None and freq.source_id is not None and freq.source_id not in source_ids:
                msg = f"{c.id}: unknown source_id {freq.source_id}"
                raise ValueError(msg)
            if c.severity_tier not in self.severity_tier_definitions:
                msg = f"{c.id}: severity tier {c.severity_tier} is not defined"
                raise ValueError(msg)
        group_ids = {g.id for g in self.locus_groups}
        for g in self.locus_groups:
            if g.compound_condition_id not in ids:
                msg = f"locus group {g.id}: unknown compound condition {g.compound_condition_id}"
                raise ValueError(msg)
        for c in self.conditions:
            if c.locus_group is not None and c.locus_group not in group_ids:
                msg = f"{c.id}: unknown locus group {c.locus_group}"
                raise ValueError(msg)
        return self

    def get(self, condition_id: str) -> ConditionRow | None:
        for row in self.conditions:
            if row.id == condition_id:
                return row
        return None


class PanelInfo(Frozen):
    """A demonstration panel with an ASSUMED detection rate (never a measured one)."""

    id: str
    name_en: str
    description: str
    condition_ids: tuple[str, ...]
    genes: tuple[str, ...] = ()  # filled by the loader from the catalogue
    assumed_detection_rate: float = Field(ge=0.0, le=1.0)
    assumed: bool = True
    illustrative: bool = True
    needs_clinician_signoff: bool = True
    rate_basis: str
    detection_by_condition: dict[str, float] = Field(default_factory=dict)
    detection_by_condition_basis: str = ""
    limits: tuple[str, ...] = ()

    def detection_for(self, condition_id: str) -> float:
        return self.detection_by_condition.get(condition_id, self.assumed_detection_rate)

    @model_validator(mode="after")
    def _rates_are_flagged(self) -> Self:
        if not (self.assumed and self.illustrative and self.needs_clinician_signoff):
            msg = "every panel detection rate must be assumed, illustrative and need sign-off (spec rules 2 and 3)"
            raise ValueError(msg)
        for rate in self.detection_by_condition.values():
            if not 0.0 <= rate <= 1.0:
                msg = "detection_by_condition rates must lie in [0, 1]"
                raise ValueError(msg)
        return self


class PanelCatalogue(Frozen):
    """The panel list (what `GET /v1/catalogue/panels` returns)."""

    version: str
    status: str
    note: str
    panels: tuple[PanelInfo, ...]
    content_hash: str = ""

    def get(self, panel_id: str) -> PanelInfo | None:
        for panel in self.panels:
            if panel.id == panel_id:
                return panel
        return None


class RuleDoc(Frozen):
    id: str
    text: str


class RulesetInfo(Frozen):
    """What produced a result: the version string and the rules that can fire."""

    version: str
    base: str
    data_content_hash: str
    needs_clinician_signoff: bool = True
    rules: tuple[RuleDoc, ...]
