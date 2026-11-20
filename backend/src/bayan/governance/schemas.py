"""Request and response models of the governance routers (kept here so OpenAPI is complete)."""

from __future__ import annotations

from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from bayan.core.contracts import Frozen
from bayan.core.types import Locale, Principal, Relationship
from bayan.governance.escalation import EscalationDecision, EscalationRecord
from bayan.governance.models import (
    AuditEvent,
    ConsentRecord,
    ConsentScope,
    LedgerEntry,
)


class _Body(BaseModel):
    model_config = ConfigDict(extra="forbid")


class OtpRequestBody(_Body):
    channel: Literal["email", "mobile"]
    target: str = Field(min_length=3, max_length=254)


class OtpVerifyBody(_Body):
    challenge_id: str = Field(min_length=4, max_length=80)
    code: str = Field(min_length=4, max_length=12)


class MeResponse(Frozen):
    principal: Principal
    simulated: bool = True
    notice: str


class GrantBody(_Body):
    """The subject is always the caller: nobody grants consent for someone else's findings."""

    recipient: str = Field(
        min_length=3, max_length=80, description="A role value or a pseudonymous person id"
    )
    scope: ConsentScope
    purpose: str = Field(min_length=3, max_length=60)
    expires_at: AwareDatetime | None = None


class ConsentListResponse(Frozen):
    couple_id: str
    records: tuple[ConsentRecord, ...]
    basis_note: str


class LedgerResponse(Frozen):
    couple_id: str
    entries: tuple[LedgerEntry, ...]


class AssignBody(_Body):
    staff_subject_id: str = Field(min_length=1, max_length=80)


class RntkResponse(Frozen):
    couple_id: str
    person_id: str
    active: bool
    note: str


class ThirdPartyBody(_Body):
    couple_id: str = Field(min_length=1, max_length=80)
    kind: str = Field(
        min_length=1, max_length=40, description="employer, insurer, relative or other"
    )


class ClassifyBody(_Body):
    text: str = Field(min_length=1, max_length=2000)
    locale: Locale = Locale.EN
    couple_id: str | None = Field(default=None, max_length=80)


class EscalationEvaluateBody(_Body):
    locale: Locale = Locale.EN
    free_text: str = Field(default="", max_length=2000)
    relationship: Relationship = Relationship.UNRELATED
    pregnancy_in_progress: bool = False
    family_history_recessive: bool = False
    reclassification_notice: bool = False
    non_targeted_finding: bool = False
    copy_number_or_non_snv: bool = False
    discordant_with_history: bool = False
    genotype_inferred_relatedness: bool = False
    severity_a_condition_ids: tuple[str, ...] = ()
    penetrance_gene_symbols: tuple[str, ...] = ()


class EscalationEvaluateResponse(Frozen):
    couple_id: str
    decisions: tuple[EscalationDecision, ...]
    notice: str = (
        "Deterministic triggers with sources. Every trigger and tier needs clinical sign-off (pending); "
        "triggers flagged needs_legal_read need a legal read. A human decides what happens next."
    )


class EscalationQueueResponse(Frozen):
    records: tuple[EscalationRecord, ...]


class AuditResponse(Frozen):
    couple_id: str
    events: tuple[AuditEvent, ...]
