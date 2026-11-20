"""Typed records of the governance package.

Everything is frozen and synthetic. `GovernedDisclosure` extends the controller's
`DisclosedResult` additively (a subclass in this package, not an edit of `core/contracts.py`).
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final, Literal

from pydantic import AwareDatetime, Field, model_validator

from bayan.core.contracts import DisclosedResult, Finding, Frozen
from bayan.core.types import Principal

# --------------------------------------------------------------------------------------------
# Consent
# --------------------------------------------------------------------------------------------


class ConsentScope(StrEnum):
    """How much of ONE person's findings a recipient may see. Ordered by `SCOPE_RANK`."""

    COUPLE_RESULT_ONLY = "couple_result_only"
    GENE_NAMES_ONLY = "gene_names_only"
    FULL_VARIANT_DETAIL = "full_variant_detail"


SCOPE_RANK: Final[dict[ConsentScope, int]] = {
    ConsentScope.COUPLE_RESULT_ONLY: 1,
    ConsentScope.GENE_NAMES_ONLY: 2,
    ConsentScope.FULL_VARIANT_DETAIL: 3,
}


class ConsentBasis(StrEnum):
    """Why a record exists. The mandatory couple screening is NOT consent-based.

    Federal Decree-Law 49/2023 Art. 4(2)(a) exempts the obligatory screening 'mentioned in this
    Law' from the consent requirement and Art. 15 makes couple screening obligatory. Consent
    governs voluntary and secondary uses and the sharing of one person's findings with someone
    else. A `STATUTORY_OBLIGATION` record documents the legal basis, confers no sharing scope and
    cannot be revoked.
    """

    EXPLICIT_CONSENT = "explicit_consent"
    STATUTORY_OBLIGATION = "statutory_obligation"


class RecipientKind(StrEnum):
    ROLE = "role"
    PERSON = "person"


class ConsentRecord(Frozen):
    """The folded (read) view of the append-only ledger: a grant plus its revocation, if any."""

    consent_id: str
    couple_id: str
    subject_person_id: str  # whose findings are shared
    recipient: str  # a Role value or a person id (see recipient_kind)
    recipient_kind: RecipientKind
    scope: ConsentScope | None
    purpose: str = Field(min_length=3, max_length=60)
    basis: ConsentBasis
    granted_at: AwareDatetime
    expires_at: AwareDatetime | None = None
    revoked_at: AwareDatetime | None = None

    @model_validator(mode="after")
    def _basis_matches_scope(self) -> ConsentRecord:
        if self.basis is ConsentBasis.EXPLICIT_CONSENT and self.scope is None:
            raise ValueError("an explicit consent record needs a scope")
        if self.basis is ConsentBasis.STATUTORY_OBLIGATION and self.scope is not None:
            raise ValueError("a statutory-obligation record confers no sharing scope")
        return self


class LedgerEntry(Frozen):
    """One immutable line of the consent ledger. The ledger only ever appends these."""

    seq: int
    kind: Literal["grant", "revoke"]
    at: AwareDatetime
    consent_id: str
    by_subject_id: str  # pseudonymous id of who made the change ("system" for seeding)
    record: ConsentRecord | None = None  # present on grants only


class RntkEntry(Frozen):
    """Right-not-to-know declaration or withdrawal (Decree-Law 49/2023 Art. 9(2)), append-only."""

    seq: int
    kind: Literal["declared", "withdrawn"]
    at: AwareDatetime
    couple_id: str
    person_id: str


# --------------------------------------------------------------------------------------------
# Auth (demo, simulated)
# --------------------------------------------------------------------------------------------

DEMO_AUTH_NOTICE: Final = (
    "Simulated demo authentication on synthetic data. Not production authentication: a "
    "production deployment would use the national identity provider (UAE PASS, Emirates ID)."
)


class OtpChallenge(Frozen):
    challenge_id: str
    channel: Literal["email", "mobile"]
    target_masked: str
    expires_at: AwareDatetime
    attempts_left: int
    simulated: bool = True
    demo_code: str | None = None  # returned ONLY in demo mode, because nothing is delivered
    notice: str = DEMO_AUTH_NOTICE


class SessionToken(Frozen):
    access_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105  (the OAuth scheme name, not a secret)
    expires_at: AwareDatetime
    principal: Principal
    simulated: bool = True
    auth_mode: Literal["demo_simulated"] = "demo_simulated"
    notice: str = DEMO_AUTH_NOTICE


# --------------------------------------------------------------------------------------------
# Audit
# --------------------------------------------------------------------------------------------

AuditOutcome = Literal["allowed", "denied", "refused", "recorded"]


class AuditEvent(Frozen):
    """One link of the hash chain. Only pseudonymous ids and closed-vocabulary tokens appear."""

    index: int
    timestamp: AwareDatetime
    actor_role: str
    actor_id: str
    action: str
    couple_id: str | None
    subject_id: str | None
    outcome: AuditOutcome
    reason: str
    detail: tuple[tuple[str, str], ...] = ()
    prev_hash: str
    hash: str


class AuditVerification(Frozen):
    ok: bool
    length: int
    head_hash: str
    first_bad_index: int | None = None
    problem: str | None = None


# --------------------------------------------------------------------------------------------
# Disclosure
# --------------------------------------------------------------------------------------------


class MemberFindings(Frozen):
    """Staff view only: one couple member's findings, attributed."""

    person_id: str
    findings: tuple[Finding, ...] = ()


class GovernedDisclosure(DisclosedResult):
    """`DisclosedResult` plus what the contract has no field for.

    `partner_gene_names` carries the partner's gene names under the `gene_names_only` scope
    (the contract's `partner_findings` holds whole `Finding` objects, which would include the
    zygosity, so it stays empty at that scope). `member_findings` is staff views only.
    """

    partner_gene_names: tuple[str, ...] = ()
    member_findings: tuple[MemberFindings, ...] = ()
    synthetic: bool = True  # hard rule 1: say "synthetic" wherever data is shown
