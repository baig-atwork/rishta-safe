"""Typed inputs, outputs and rule models of the haematology aid.

SYNTHETIC-DATA PROTOTYPE. A clinician-facing screening-support aid, never a diagnosis. The output vocabulary is the
closed `HaemLabel` of `bayan.core.contracts`; a CBC alone can never produce a carrier, not-a-carrier, normal or
disease statement.

Physiological range checks reject nonsense input (for example a haemoglobin of 5000 g/L). Missing values are allowed
and give an 'incomplete' label: the engine never imputes.
"""

from __future__ import annotations

from typing import Literal, Self

from pydantic import Field, JsonValue, model_validator

from bayan.core.contracts import Frozen, HaemLabel

Stage = Literal["cbc_only", "cbc_plus_hplc"]
RuleStage = Literal["ALL", "S1", "S2"]
VariantDetected = Literal["none", "S", "C", "D", "E", "OArab", "Lepore", "other_or_unknown"]
TriState = bool | Literal["unknown"]

CBC_ONLY_LABELS: frozenset[str] = frozenset(
    {"indices_reduced", "indices_not_flagged", "cbc_incomplete"}
)
HPLC_LABELS: frozenset[str] = frozenset(
    {
        "pattern_suggests_beta_thal_trait",
        "pattern_suggests_alpha_thal_trait",
        "pattern_suggests_hb_variant_trait",
        "pattern_suggests_iron_deficiency_first",
        "pattern_suggests_possible_compound_or_affected",
        "pattern_unclear_refer_for_molecular",
        "no_pattern_flagged_on_this_work_up",
        "work_up_incomplete",
    }
)


class CbcInput(Frozen):
    """Complete blood count plus context. Every numeric field may be null (the result is then 'incomplete')."""

    age_years: float | None = Field(default=None, ge=0, le=120)
    sex: Literal["F", "M", "unknown"] = "unknown"
    pregnant: TriState = "unknown"
    transfused_last_4_months: TriState = "unknown"
    hb_g_per_l: float | None = Field(default=None, ge=20, le=250)
    mcv_fl: float | None = Field(default=None, ge=40, le=140)
    mch_pg: float | None = Field(default=None, ge=10, le=50)
    ferritin_status: Literal["low", "not_low", "not_measured"] = "not_measured"
    alpha0_origin_both_high_or_unknown: bool | None = None


class HplcInput(Frozen):
    """Haemoglobin analysis by HPLC or capillary electrophoresis. Null fields give 'incomplete'."""

    hba2_pct: float | None = Field(default=None, ge=0, le=100)
    hba2_is_total: bool | None = (
        None  # the caller attests HbA2 is TOTAL HbA2 including any HbA2 variant peak
    )
    hbf_pct: float | None = Field(default=None, ge=0, le=100)
    variant_detected: VariantDetected | None = None
    single_hba_band_only: bool | None = None


class HaemSourceRef(Frozen):
    id: str
    title: str
    year: str = ""
    url: str | None = None
    tier: str = ""
    licence: str | None = None
    read_from: str | None = None


class RuleSource(Frozen):
    id: str
    locator: str


class LabelOverride(Frozen):
    condition: str
    label: HaemLabel


class HaemRule(Frozen):
    id: str
    stage: RuleStage
    type: Literal["terminal", "annotate"]
    inputs: tuple[str, ...] = ()
    condition: str
    output: str | None = None  # the draft rule table's own output name, kept for traceability
    label: HaemLabel | None = None
    label_s1: HaemLabel | None = None
    label_s2: HaemLabel | None = None
    label_overrides: tuple[LabelOverride, ...] = ()
    reason: str | None = None
    validity: bool = (
        False  # True: marks a record out of scope or unreadable; suppresses clinical annotate flags
    )
    flag: str | None = None
    note: str | None = None
    mandatory_statement: str | None = None
    sources_disagree: str | None = None
    source: RuleSource
    needs_clinician_signoff: Literal[True]

    @model_validator(mode="after")
    def _label_shape(self) -> Self:
        if self.type == "annotate":
            if self.flag is None or self.label or self.label_s1 or self.label_s2:
                msg = f"annotate rule {self.id} needs a flag and no label"
                raise ValueError(msg)
            return self
        has_split = self.label_s1 is not None and self.label_s2 is not None
        if (self.label is None) == (not has_split):
            msg = f"terminal rule {self.id} needs either label or both label_s1 and label_s2"
            raise ValueError(msg)
        return self


class HaemFixture(Frozen):
    id: str
    synthetic: Literal[True]
    # `class` is a Python keyword; the loader renames it.
    fixture_class: str
    input: dict[str, JsonValue]
    expect_draft_output: str
    expect_label: HaemLabel
    expect_flags: tuple[str, ...] = ()
    why: str


class HaemMeta(Frozen):
    version: str
    status: str
    derived_from: str
    date: str
    all_fixtures_synthetic: bool
    needs_clinician_signoff_default: bool
    population_caveat: str
    licence_note: str
    not_a_diagnosis: str
    prior_art_note: str
    fixture_authorship_note: str


class HaemLabels(Frozen):
    cbc_only: tuple[HaemLabel, ...]
    cbc_plus_hplc: tuple[HaemLabel, ...]


class HaemLeftOut(Frozen):
    rule: str
    why: str


class HaemRuleset(Frozen):
    """The parsed `haem_rules.yaml`."""

    meta: HaemMeta
    sources: dict[str, HaemSourceRef]
    inputs: dict[str, JsonValue]
    policy_parameters: dict[str, JsonValue]
    policy_parameters_note: str
    labels: HaemLabels
    label_descriptions: dict[str, str]
    forbidden_outputs_unless_a_cited_guideline_allows: tuple[str, ...]
    forbidden_outputs_note: str
    rules: tuple[HaemRule, ...]
    rules_deliberately_left_out: tuple[HaemLeftOut, ...]
    fixtures: tuple[HaemFixture, ...] = ()


class HaemTraceLine(Frozen):
    rule_id: str
    kind: Literal["terminal", "annotate"]
    outcome: str  # the draft output name, the flag, or the validity reason
    source_id: str
    locator: str


class HaemInterpretation(Frozen):
    """The aid's whole answer. Deterministic: same inputs give the same object."""

    label: HaemLabel
    stage: Stage
    label_description: str
    matched_rule_id: str
    draft_output: str
    trace: tuple[HaemTraceLine, ...]
    flags: tuple[str, ...]
    mandatory_statements: tuple[str, ...] = ()
    sources_disagree: tuple[str, ...] = ()
    sources: tuple[HaemSourceRef, ...]
    needs_clinician_signoff: Literal[True] = True
    not_a_diagnosis: str
    prior_art_note: str
    population_caveat: str
    ruleset_version: str


class HaemRuleView(Frozen):
    id: str
    stage: RuleStage
    type: Literal["terminal", "annotate"]
    condition: str
    labels: tuple[HaemLabel, ...]
    flag: str | None = None
    reason: str | None = None
    source: RuleSource
    sources_disagree: str | None = None
    needs_clinician_signoff: Literal[True] = True


class HaemRulesView(Frozen):
    """What `GET /v1/haem/rules` returns: the rule table with its provenance and sign-off status."""

    ruleset_version: str
    status: str
    needs_clinician_signoff: Literal[True] = True
    not_a_diagnosis: str
    prior_art_note: str
    population_caveat: str
    cbc_only_labels: tuple[HaemLabel, ...]
    cbc_plus_hplc_labels: tuple[HaemLabel, ...]
    label_descriptions: dict[str, str]
    forbidden_outputs_unless_a_cited_guideline_allows: tuple[str, ...]
    rules: tuple[HaemRuleView, ...]
    rules_deliberately_left_out: tuple[HaemLeftOut, ...]
    sources: tuple[HaemSourceRef, ...]
    fixture_authorship_note: str


class HaemInterpretRequest(Frozen):
    """`POST /v1/haem/interpret` body. Omit `hplc` for a CBC-only work-up."""

    cbc: CbcInput
    hplc: HplcInput | None = None
