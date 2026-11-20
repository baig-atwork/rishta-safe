"""The keystone data contracts shared by genetics, governance, journey and explain.

Owned by the controller. A package that needs a change makes it additive in its own
module and reports it; nobody edits this file concurrently.

Every person-level record here is synthetic. Nothing in this prototype is real data.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from bayan.core.types import Emirate, Locale, Relationship, Role


class Frozen(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class Zygosity(StrEnum):
    CARRIER = "carrier"  # heterozygous for one pathogenic / likely pathogenic variant
    AFFECTED = "affected"  # homozygous or compound heterozygous (or hemizygous X-linked male)
    VUS = "vus"  # variant of uncertain significance: never counted as a result
    NOT_DETECTED = "not_detected"


class Inheritance(StrEnum):
    AUTOSOMAL_RECESSIVE = "AR"
    X_LINKED = "XL"
    AUTOSOMAL_DOMINANT = "AD"


class Sex(StrEnum):
    FEMALE = "female"
    MALE = "male"


class Finding(Frozen):
    """One interpreted line of a laboratory report (the programme ingests the lab's category)."""

    gene: str
    condition_id: str  # key into the condition catalogue (data/conditions.yaml)
    zygosity: Zygosity
    inheritance: Inheritance
    classification: Literal["pathogenic", "likely_pathogenic", "vus"] = "pathogenic"
    variant_label: str | None = None  # synthetic, display only


class PersonReport(Frozen):
    """A reported screening result for one person (synthetic)."""

    person_id: str
    sex: Sex
    panel_id: str  # which panel the lab ran (key into data/panels.yaml)
    findings: tuple[Finding, ...] = ()
    status: Literal["final", "pending_confirmation"] = "final"
    # How far the haematology work-up went: a CBC alone can never give a carrier statement.
    haem_stage: Literal["cbc_only", "cbc_hplc", "genotype_confirmed"] = "genotype_confirmed"


class ResultCategory(StrEnum):
    """The only three result labels the product may show a couple.

    Never "compatible", "incompatible", "pass", "fail", "no risk" or high/moderate/low.
    """

    SHARED_RESULT_FOUND = "shared_result_found"
    NO_SHARED_CHANGE_FOUND = "no_shared_change_found"
    MORE_INFORMATION_NEEDED = "more_information_needed"


class ReviewPriority(StrEnum):
    """Staff-only. Never shown to the couple."""

    ROUTINE = "routine"
    PRIORITY = "priority"
    URGENT = "urgent"


class OutcomeLine(Frozen):
    """One natural-frequency line, always out of 100 pregnancies (fixed denominator)."""

    label: Literal["affected", "carrier", "neither"]
    per_100: int = Field(ge=0, le=100)
    applies_to: Literal["any_child", "son", "daughter"] = "any_child"


class SharedCondition(Frozen):
    condition_id: str
    gene: str
    inheritance: Inheritance
    basis: Literal[
        "both_carriers",
        "affected_partner_and_carrier",
        "both_affected",
        "x_linked_carrier_female",
        "x_linked_affected_male",
    ]
    outcomes: tuple[OutcomeLine, ...]


class DetectionStatement(Frozen):
    """What the panel can and cannot rule out. Detection rate, never a residual-risk number."""

    panel_id: str
    statement_key: str  # key into the explainer templates
    detection_rate_label: str  # human text such as "about 9 in 10 (assumed, see limits)"
    assumed: bool = True
    related_couple_caveat: bool = (
        False  # True when partners are related: misses are shared by descent
    )


class CoupleResult(Frozen):
    """The engine's whole answer. Deterministic: same inputs give the same object."""

    couple_id: str
    category: ResultCategory
    review_priority: ReviewPriority  # staff-only
    shared: tuple[SharedCondition, ...] = ()
    needs_more_information_reasons: tuple[str, ...] = ()  # keys into explainer templates
    detection: tuple[DetectionStatement, ...] = ()
    relationship: Relationship = Relationship.UNRELATED
    ruleset_version: str = "unversioned"
    trace: tuple[
        str, ...
    ] = ()  # one line per rule that fired, for the audit and the counsellor brief


# Closed vocabulary of the haematology aid (the clinician-facing aid, never a diagnosis).
HaemLabel = Literal[
    # CBC only (3)
    "indices_reduced",
    "indices_not_flagged",
    "cbc_incomplete",
    # CBC plus HPLC / electrophoresis (8)
    "pattern_suggests_beta_thal_trait",
    "pattern_suggests_alpha_thal_trait",
    "pattern_suggests_hb_variant_trait",
    "pattern_suggests_iron_deficiency_first",
    "pattern_suggests_possible_compound_or_affected",
    "pattern_unclear_refer_for_molecular",
    "no_pattern_flagged_on_this_work_up",
    "work_up_incomplete",
]


class DisclosedResult(Frozen):
    """What one viewer may see of a couple's result, after consent and the emirate policy.

    Produced by governance, consumed by explain. A field that the viewer may not see is
    empty or None, never merely hidden by the UI.
    """

    couple_id: str
    viewer_role: Role
    viewer_person_id: str | None = None
    policy: Emirate
    category: (
        ResultCategory | None
    )  # None: release to this viewer is deferred (see withheld_reason_key)
    withheld_reason_key: str | None = (
        None  # counselling_first, awaiting_partner_consent, right_not_to_know
    )
    shared: tuple[SharedCondition, ...] = ()
    own_findings: tuple[Finding, ...] = ()
    partner_finding_scope: Literal[
        "none", "couple_result_only", "gene_names_only", "full_variant_detail"
    ] = "none"
    partner_findings: tuple[Finding, ...] = ()  # already filtered to the scope
    detection: tuple[DetectionStatement, ...] = ()
    relationship: Relationship = Relationship.UNRELATED
    review_priority: ReviewPriority | None = None  # staff roles only
    staff_trace: tuple[str, ...] = ()  # staff roles only
    boundary_notice_key: str = "boundary.education_decision_support"
    certificate_note_key: str | None = None  # the certificate-refusal tension, when it applies
    ruleset_version: str = "unversioned"


class BlockKind(StrEnum):
    HEADING = "heading"
    PARAGRAPH = "paragraph"
    LIST = "list"
    ICON_ARRAY = "icon_array"
    CALLOUT = "callout"
    DISCLAIMER = "disclaimer"


class NumberRef(Frozen):
    """A number that appears in rendered text, with where it came from."""

    key: str
    value: int | float | str
    origin: Literal["engine", "template_constant"]


class IconArraySpec(Frozen):
    """Fixed 100-icon part-to-whole array (a pre-registered framing choice)."""

    total: int = 100
    affected: int = 0
    carrier: int = 0
    neither: int = 0
    caption: str = ""


class Block(Frozen):
    kind: BlockKind
    text: str = ""
    items: tuple[str, ...] = ()
    icon_array: IconArraySpec | None = None
    tone: Literal["neutral", "info", "care"] = "neutral"
    numbers: tuple[NumberRef, ...] = ()


class CheckSummary(Frozen):
    ok: bool
    numeric_fidelity: bool
    polarity: bool
    banned_words_absent: bool
    messages: tuple[str, ...] = ()


class ExplainerDoc(Frozen):
    locale: Locale
    language_status: Literal[
        "reviewed", "draft"
    ]  # Arabic and Urdu are always "draft" until a native clinical review
    blocks: tuple[Block, ...]
    glossary_keys: tuple[str, ...] = ()
    numbers_used: tuple[NumberRef, ...] = ()
    template_ids: tuple[str, ...] = ()
    check: CheckSummary | None = None
