"""`GovernanceService`: the one object the other lanes and the routers talk to.

Composition only. The rules live in the modules it wires together (`auth`, `consent`,
`disclosure`, `audit`, `third_party`, `escalation`); this class gathers state, applies the pure
decision functions and writes the audit chain. In-memory and single-process: a Postgres adapter
and a durable, externally anchored audit log are parked (ADR 0129).

Public surface = the exact names in spec section 3.1, plus a few additive methods the demo needs
(`register_identity`, `assign_staff`, `record_right_not_to_know`, `mark_case_synthetic`,
`record_statutory_basis`, `classify_request`, `escalation_queue`, `audit_events_for`).
"""

from __future__ import annotations

import re
import threading
from collections.abc import Callable, Sequence
from datetime import datetime
from typing import Final, Literal, NoReturn

from bayan.core.clock import Clock
from bayan.core.config import Settings
from bayan.core.contracts import CoupleResult, PersonReport
from bayan.core.errors import (
    BayanError,
    Forbidden,
    Invalid,
    RuleViolation,
    Unauthenticated,
)
from bayan.core.types import Emirate, Locale, Principal, Role
from bayan.governance.audit import AuditLog
from bayan.governance.auth import AuthService
from bayan.governance.consent import ConsentLedger, RightNotToKnowLedger
from bayan.governance.disclosure import (
    STAFF_ROLES,
    DisclosureInputs,
    DisclosureOutcome,
    decide_disclosure,
)
from bayan.governance.errors import TooManyAttempts
from bayan.governance.escalation import (
    EscalationContext,
    EscalationDecision,
    EscalationRecord,
    decision_for,
    evaluate,
)
from bayan.governance.models import (
    AuditEvent,
    AuditVerification,
    ConsentBasis,
    ConsentRecord,
    ConsentScope,
    GovernedDisclosure,
    OtpChallenge,
    RecipientKind,
    RntkEntry,
    SessionToken,
)
from bayan.governance.policies import load_policy_file, policy_for
from bayan.governance.third_party import (
    RefusalDecision,
    classify_request,
    normalise_kind,
    refusal_for_third_party,
)

STATUTORY_PURPOSE: Final = "couple_screening_statutory"
_ID_RE: Final = re.compile(r"^[A-Za-z0-9_.:\-]{1,80}$")


def _reason_of(exc: BayanError, default: str) -> str:
    value = exc.extra.get("reason")
    return value if isinstance(value, str) and value else default


class GovernanceService:
    def __init__(self, clock: Clock, settings: Settings) -> None:
        self._clock = clock
        self._settings = settings
        self._auth = AuthService(clock, settings)
        self._audit = AuditLog(clock, self._auth.pseudonym_key)
        self._ledger = ConsentLedger(clock)
        self._rntk = RightNotToKnowLedger(clock)
        self._assignments: dict[str, set[str]] = {}
        self._staff_ids: dict[str, Role] = {}
        self._synthetic: dict[str, bool] = {}
        self._queue: list[EscalationRecord] = []
        self._lock = threading.RLock()
        self._policies = load_policy_file()
        # The decision function is an attribute so the evaluation harness (property_eval) can run
        # deliberately broken variants against an ISOLATED service instance, never by patching
        # module state shared with live requests.
        self._decide: Callable[[DisclosureInputs], DisclosureOutcome] = decide_disclosure

    # ------------------------------------------------------------------ audit helpers ------------

    def _log(
        self,
        actor: Principal | None,
        action: str,
        outcome: Literal["allowed", "denied", "refused", "recorded"],
        reason: str,
        *,
        couple_id: str | None = None,
        subject_id: str | None = None,
        detail: dict[str, str] | None = None,
    ) -> AuditEvent:
        return self._audit.record(
            actor_role=actor.role.value if actor else "system",
            actor_id=actor.subject_id if actor else "system",
            action=action,
            outcome=outcome,
            reason=reason,
            couple_id=couple_id,
            subject_id=subject_id,
            detail=detail,
        )

    def record_access_denied(
        self,
        principal: Principal,
        action: str,
        reason: str = "role_not_permitted",
        couple_id: str | None = None,
    ) -> None:
        """Audit a role-guard refusal (used by the FastAPI dependencies)."""
        self._log(principal, f"access.{action}", "denied", reason, couple_id=couple_id)

    # ------------------------------------------------------------------ auth ----------------------

    def request_otp(self, channel: Literal["email", "mobile"], target: str) -> OtpChallenge:
        try:
            challenge = self._auth.request_otp(channel, target)
        except BayanError as exc:
            self._log(
                None,
                "otp_requested",
                "denied",
                _reason_of(exc, exc.code),
                detail={"channel": channel},
            )
            raise
        self._log(
            None,
            "otp_requested",
            "recorded",
            "simulated_code_issued",
            detail={"channel": channel, "simulated": "true"},
        )
        return challenge

    def verify_otp(self, challenge_id: str, code: str) -> SessionToken:
        try:
            token, principal = self._auth.verify_otp(challenge_id, code)
        except (Unauthenticated, TooManyAttempts) as exc:
            self._log(None, "otp_verified", "denied", _reason_of(exc, exc.code))
            raise
        self._log(
            principal,
            "token_issued",
            "recorded",
            "otp_simulated",
            couple_id=principal.couple_id,
            detail={"mode": "demo_simulated"},
        )
        return token

    def issue_demo_token(self, principal: Principal, *, audit: bool = True) -> SessionToken:
        """Mint a simulated demo token.

        `audit=False` is for listing the demo personas (one token each, many times a day): a refusal is always
        logged, but a listing writes no row, so the audit chain holds events that mean something."""
        try:
            self._auth.require_demo_mode()
        except Forbidden as exc:
            self._log(
                principal,
                "token_issued",
                "denied",
                _reason_of(exc, "demo_mode_off"),
                couple_id=principal.couple_id,
            )
            raise
        token = self._auth.issue(principal)
        self._remember_staff(principal)
        if audit:
            self._log(
                principal,
                "token_issued",
                "recorded",
                "demo",
                couple_id=principal.couple_id,
                detail={"mode": "demo_simulated"},
            )
        return token

    def authenticate(self, token: str) -> Principal:
        return self._auth.authenticate(token)

    def register_identity(
        self, channel: Literal["email", "mobile"], target: str, principal: Principal
    ) -> None:
        """Seed the demo identity directory (used by the demo composition)."""
        self._auth.register_identity(channel, target, principal)
        self._remember_staff(principal)

    def register_staff(self, principal: Principal) -> None:
        """Register a counsellor or clinician as a known care-team identity (a precondition for
        being assigned to a couple). `register_identity` and `issue_demo_token` do this too."""
        if principal.role not in STAFF_ROLES:
            raise Invalid("only a counsellor or clinician can be registered as care-team staff")
        self._remember_staff(principal)

    def _remember_staff(self, principal: Principal) -> None:
        if principal.role in STAFF_ROLES:
            with self._lock:
                self._staff_ids[principal.subject_id] = principal.role

    # ------------------------------------------------------------------ consent ledger -------------

    def grant(  # noqa: PLR0917  (positional order is the spec section 3.1 signature)
        self,
        couple_id: str,
        subject_person_id: str,
        recipient_role: Role | str,
        scope: ConsentScope,
        purpose: str,
        expires_at: datetime | None,
        *,
        by: Principal | None = None,
    ) -> ConsentRecord:
        """Record explicit consent to share ONE person's findings. Only that person may grant
        (`by` is checked when given; `by=None` is a system action such as seeding)."""
        if by is not None and not (
            by.role is Role.COUPLE_MEMBER
            and by.couple_id == couple_id
            and by.subject_id == subject_person_id
        ):
            self._log(
                by,
                "consent_granted",
                "denied",
                "only_the_subject_may_grant",
                couple_id=couple_id,
                subject_id=subject_person_id,
            )
            raise Forbidden(
                "only the person whose findings are shared may grant consent",
                reason="only_the_subject_may_grant",
            )
        if purpose not in self._policies.consent_purposes:
            raise Invalid(
                "unknown consent purpose", purposes=sorted(self._policies.consent_purposes)
            )
        recipient, kind = self._normalise_recipient(
            recipient_role, subject_person_id, by, couple_id
        )
        now = self._clock.now()
        if expires_at is not None and (expires_at.tzinfo is None or expires_at <= now):
            raise Invalid("expires_at must be a timezone-aware time in the future")
        record = self._ledger.append_grant(
            couple_id=couple_id,
            subject_person_id=subject_person_id,
            recipient=recipient,
            recipient_kind=kind,
            scope=scope,
            purpose=purpose,
            basis=ConsentBasis.EXPLICIT_CONSENT,
            expires_at=expires_at,
            by_subject_id=by.subject_id if by else "system",
        )
        self._log(
            by,
            "consent_granted",
            "recorded",
            "explicit_consent",
            couple_id=couple_id,
            subject_id=subject_person_id,
            detail={
                "consent_id": record.consent_id,
                "scope": scope.value,
                "purpose": purpose,
                "recipient": recipient,
                "recipient_kind": kind.value,
                "expires": "yes" if expires_at else "no",
            },
        )
        return record

    def _normalise_recipient(
        self, recipient: Role | str, subject_person_id: str, by: Principal | None, couple_id: str
    ) -> tuple[str, RecipientKind]:
        role_values = {r.value for r in Role}
        raw = recipient.value if isinstance(recipient, Role) else recipient
        if raw in role_values:
            role = Role(raw)
            if role not in self._policies.recipient_roles_allowed:
                self._log(
                    by,
                    "consent_granted",
                    "refused",
                    "recipient_role_not_allowed",
                    couple_id=couple_id,
                    subject_id=subject_person_id,
                )
                raise RuleViolation(
                    "This role never receives individual results (programme: aggregates only; judge: read-only "
                    "staff view of synthetic cases; external: nothing), so it cannot be named in a consent.",
                    reason="recipient_role_not_allowed",
                )
            return raw, RecipientKind.ROLE
        if not _ID_RE.fullmatch(raw):
            raise Invalid("recipient must be a role or a pseudonymous person id")
        if raw == subject_person_id:
            raise Invalid("a person cannot grant consent to themselves")
        return raw, RecipientKind.PERSON

    def revoke(self, consent_id: str, by: Principal) -> ConsentRecord:
        existing = self._ledger.get(consent_id)  # NotFound propagates
        try:
            record = self._ledger.append_revocation(consent_id, by_subject_id=by.subject_id)
        except (Forbidden, RuleViolation, BayanError) as exc:
            self._log(
                by,
                "consent_revoked",
                "denied",
                _reason_of(exc, exc.code),
                couple_id=existing.couple_id,
                subject_id=existing.subject_person_id,
                detail={"consent_id": consent_id},
            )
            raise
        self._log(
            by,
            "consent_revoked",
            "recorded",
            "revoked_by_subject",
            couple_id=record.couple_id,
            subject_id=record.subject_person_id,
            detail={"consent_id": consent_id},
        )
        return record

    def get_consent(self, consent_id: str) -> ConsentRecord:
        return self._ledger.get(consent_id)

    def consents(self, couple_id: str) -> tuple[ConsentRecord, ...]:
        return self._ledger.records(couple_id)

    def consents_for(self, principal: Principal, couple_id: str) -> tuple[ConsentRecord, ...]:
        """Authorised view of the ledger: assigned staff and synthetic-case judges see every record,
        a couple member sees the records they granted or received, nobody else sees any."""
        records = self._ledger.records(couple_id)
        if principal.role in STAFF_ROLES and principal.subject_id in self.assigned_staff(couple_id):
            return records
        if principal.role is Role.JUDGE and self.is_synthetic(couple_id):
            return records
        if principal.role is Role.COUPLE_MEMBER and principal.couple_id == couple_id:
            mine = {principal.subject_id, Role.COUPLE_MEMBER.value}
            return tuple(
                r
                for r in records
                if r.subject_person_id == principal.subject_id or r.recipient in mine
            )
        self._log(principal, "consents_read", "denied", "role_not_permitted", couple_id=couple_id)
        raise Forbidden("you may not read this consent ledger", reason="role_not_permitted")

    def record_statutory_basis(self, couple_id: str, subject_person_id: str) -> ConsentRecord:
        """Document that the mandatory couple screening is NOT consent-based (Decree-Law 49/2023
        Art. 4(2)(a) and 15). The record confers no sharing scope and cannot be revoked."""
        record = self._ledger.append_grant(
            couple_id=couple_id,
            subject_person_id=subject_person_id,
            recipient=Role.COUNSELLOR.value,
            recipient_kind=RecipientKind.ROLE,
            scope=None,
            purpose=STATUTORY_PURPOSE,
            basis=ConsentBasis.STATUTORY_OBLIGATION,
            expires_at=None,
            by_subject_id="system",
        )
        self._log(
            None,
            "statutory_basis_recorded",
            "recorded",
            "art_4_2_a_and_15",
            couple_id=couple_id,
            subject_id=subject_person_id,
            detail={"consent_id": record.consent_id},
        )
        return record

    # ------------------------------------------------------------------ right not to know ----------

    def _rntk_change(
        self,
        kind: Literal["declared", "withdrawn"],
        couple_id: str,
        person_id: str,
        by: Principal | None,
    ) -> RntkEntry:
        if by is not None and not (
            by.role is Role.COUPLE_MEMBER
            and by.couple_id == couple_id
            and by.subject_id == person_id
        ):
            self._log(
                by,
                f"rntk_{kind}",
                "denied",
                "only_the_person_may_decide",
                couple_id=couple_id,
                subject_id=person_id,
            )
            raise Forbidden(
                "only the person themselves may record or withdraw a right not to know",
                reason="only_the_person_may_decide",
            )
        entry = self._rntk.append(kind, couple_id, person_id)
        self._log(
            by, f"rntk_{kind}", "recorded", "art_9_2", couple_id=couple_id, subject_id=person_id
        )
        return entry

    def record_right_not_to_know(
        self, couple_id: str, person_id: str, by: Principal | None = None
    ) -> RntkEntry:
        return self._rntk_change("declared", couple_id, person_id, by)

    def withdraw_right_not_to_know(
        self, couple_id: str, person_id: str, by: Principal | None = None
    ) -> RntkEntry:
        return self._rntk_change("withdrawn", couple_id, person_id, by)

    def right_not_to_know_active(self, couple_id: str, person_id: str) -> bool:
        return self._rntk.active(couple_id, person_id, self._clock.now())

    # ------------------------------------------------------------------ assignments, provenance ------

    def assign_staff(
        self, couple_id: str, staff_subject_id: str, by: Principal | None = None
    ) -> None:
        """Assign a registered counsellor or clinician to a couple. Assignment is what grants the
        staff view, so it is itself access-controlled:

        * `by` is the authenticated caller. It may assign only if it is a PROGRAMME operator
          (who administers care-team assignment) or a staff member ALREADY assigned to this couple.
        * Self-assignment is forbidden unless the caller is PROGRAMME.
        * `staff_subject_id` must be a registered staff identity (`register_staff`,
          `register_identity` or `issue_demo_token`); unknown ids are rejected.
        * `by=None` is the internal, trusted path for the seeder only. No router may reach it:
          routers always pass the authenticated principal (tests/governance asserts this).

        Every denial is written to the audit chain before the error is raised."""
        if by is not None:
            self._authorise_assignment(by, couple_id, staff_subject_id)
        if not _ID_RE.fullmatch(staff_subject_id):
            raise Invalid("staff id must be a pseudonymous token")
        with self._lock:
            known = staff_subject_id in self._staff_ids
        if not known:
            self._log(by, "staff_assigned", "denied", "unknown_staff_identity", couple_id=couple_id)
            raise Invalid(
                "the staff id is not a registered care-team identity",
                reason="unknown_staff_identity",
            )
        with self._lock:
            self._assignments.setdefault(couple_id, set()).add(staff_subject_id)
        self._log(
            by,
            "staff_assigned",
            "recorded",
            "care_team_assignment",
            couple_id=couple_id,
            detail={"staff": staff_subject_id},
        )

    def _authorise_assignment(self, by: Principal, couple_id: str, staff_subject_id: str) -> None:
        if by.role is not Role.PROGRAMME and not (
            by.role in STAFF_ROLES and by.subject_id in self.assigned_staff(couple_id)
        ):
            self._log(
                by, "staff_assigned", "denied", "assigner_not_authorised", couple_id=couple_id
            )
            raise Forbidden(
                "only a programme operator or staff already assigned to this couple may assign staff",
                reason="assigner_not_authorised",
            )
        if staff_subject_id == by.subject_id and by.role is not Role.PROGRAMME:
            self._log(
                by, "staff_assigned", "denied", "self_assignment_forbidden", couple_id=couple_id
            )
            raise Forbidden("staff may not assign themselves", reason="self_assignment_forbidden")

    def assigned_staff(self, couple_id: str) -> frozenset[str]:
        with self._lock:
            return frozenset(self._assignments.get(couple_id, set()))

    def mark_case_synthetic(self, couple_id: str, synthetic: bool = True) -> None:
        with self._lock:
            self._synthetic[couple_id] = synthetic

    def is_synthetic(self, couple_id: str) -> bool:
        """Hard rule 1: everything in this prototype is synthetic, so demo mode defaults to True.
        Outside demo mode a case counts as synthetic only if it was explicitly marked."""
        with self._lock:
            return self._synthetic.get(couple_id, self._settings.demo_mode)

    # ------------------------------------------------------------------ disclosure -----------------

    def disclose(
        self,
        principal: Principal,
        couple_id: str,
        result: CoupleResult,
        reports: Sequence[PersonReport],
        policy: Emirate,
        *,
        counselling_completed: bool = False,
        pregnancy_in_progress: bool = False,
    ) -> GovernedDisclosure:
        """What `principal` may see of this couple's result under `policy`.

        `counselling_completed` is the journey's fact that post-test counselling happened; it
        defaults to False, which withholds a shared or unresolved couple-level category from couple
        members (counselling first). `pregnancy_in_progress` comes from intake. Raises `Forbidden`
        (audited) when the viewer may see no result at all."""
        now = self._clock.now()
        inputs = DisclosureInputs(
            principal=principal,
            couple_id=couple_id,
            result=result,
            reports=tuple(reports),
            emirate=policy,
            policy=policy_for(policy),
            common=self._policies.common,
            records=self._ledger.records(couple_id),
            rntk_persons=frozenset(
                r.person_id for r in reports if self._rntk.active(couple_id, r.person_id, now)
            ),
            assigned_staff=self.assigned_staff(couple_id),
            synthetic=self.is_synthetic(couple_id),
            counselling_completed=counselling_completed,
            pregnancy_in_progress=pregnancy_in_progress,
            at=now,
        )
        subject = principal.subject_id if principal.role is Role.COUPLE_MEMBER else None
        try:
            outcome = self._decide(inputs)
        except Forbidden as exc:
            self._log(
                principal,
                "disclose",
                "denied",
                _reason_of(exc, "forbidden"),
                couple_id=couple_id,
                subject_id=subject,
                detail={"policy": policy.value},
            )
            raise
        self._log(
            principal,
            "disclose",
            "allowed",
            outcome.reason,
            couple_id=couple_id,
            subject_id=subject,
            detail={
                "policy": policy.value,
                "category_released": "true" if outcome.category_released else "false",
            },
        )
        for trigger_id in outcome.escalation_trigger_ids:
            ctx = EscalationContext(couple_id=couple_id, rntk_with_life_threat=True)
            self._enqueue(
                couple_id,
                (decision_for(trigger_id, couple_id, ctx),),
                actor=None,
                source="disclosure",
            )
        return outcome.disclosure

    # ------------------------------------------------------------------ audit ---------------------

    def audit_events(self, couple_id: str | None = None) -> tuple[AuditEvent, ...]:
        return self._audit.events(couple_id)

    def verify_audit_chain(self) -> AuditVerification:
        return self._audit.verify()

    def audit_events_for(self, principal: Principal, couple_id: str) -> tuple[AuditEvent, ...]:
        """Authorised view of one couple's audit trail: assigned staff and judges (synthetic only)
        see all of it, a couple member sees the events about themselves, nobody else sees any."""
        events = self._audit.events(couple_id)
        if principal.role in STAFF_ROLES and principal.subject_id in self.assigned_staff(couple_id):
            return events
        if principal.role is Role.JUDGE and self.is_synthetic(couple_id):
            return events
        if principal.role is Role.COUPLE_MEMBER and principal.couple_id == couple_id:
            me = self._audit.pseudonym(principal.subject_id)
            return tuple(e for e in events if me in (e.subject_id, e.actor_id))
        self._log(principal, "audit_read", "denied", "role_not_permitted", couple_id=couple_id)
        raise Forbidden("you may not read this audit trail", reason="role_not_permitted")

    # ------------------------------------------------------------------ third party, refusal -------

    def third_party_request(self, requester: Principal, couple_id: str, kind: str) -> NoReturn:
        """Refuse a request from an employer, insurer, relative or anyone without a grant. Always
        audited, always `Forbidden`, with the legal citation in the response."""
        clean = normalise_kind(kind)
        detail, basis = refusal_for_third_party(clean)
        self._log(
            requester,
            "third_party_request",
            "refused",
            f"third_party:{clean}",
            couple_id=couple_id,
            detail={"kind": clean},
        )
        raise Forbidden(detail, reason=f"third_party:{clean}", legal_basis=basis, kind=clean)

    def classify_request(
        self,
        text: str,
        locale: Locale = Locale.EN,
        *,
        actor: Principal | None = None,
        couple_id: str | None = None,
    ) -> RefusalDecision:
        """Classify a free-text request. A refusal is audited (categories only, never the text);
        a refusal that cannot be answered safely also notifies a counsellor through the queue."""
        decision = classify_request(text, locale)
        if not decision.refuse:
            return decision
        self._log(
            actor,
            "request_refused",
            "refused",
            decision.category or "refused",
            couple_id=couple_id,
            detail={
                "categories": "|".join(decision.categories),
                "escalate": "true" if decision.escalate else "false",
            },
        )
        if decision.escalate and couple_id is not None:
            ctx = EscalationContext(couple_id=couple_id, free_text=text, locale=locale)
            self._run_escalation(ctx, None, actor)
        return decision

    # ------------------------------------------------------------------ escalation -----------------

    def evaluate_escalation(
        self, ctx: EscalationContext, result: CoupleResult
    ) -> tuple[EscalationDecision, ...]:
        return self._run_escalation(ctx, result, None)

    def _run_escalation(
        self, ctx: EscalationContext, result: CoupleResult | None, actor: Principal | None
    ) -> tuple[EscalationDecision, ...]:
        decisions = evaluate(ctx, result)
        self._enqueue(ctx.couple_id, decisions, actor=actor, source="evaluate")
        return decisions

    def _enqueue(
        self,
        couple_id: str,
        decisions: tuple[EscalationDecision, ...],
        *,
        actor: Principal | None,
        source: str,
    ) -> None:
        if not decisions:
            self._log(
                actor,
                "escalation_evaluated",
                "recorded",
                "no_trigger",
                couple_id=couple_id,
                detail={"source": source},
            )
            return
        with self._lock:
            record = EscalationRecord(
                escalation_id=f"esc-{len(self._queue) + 1:05d}",
                couple_id=couple_id,
                created_at=self._clock.now(),
                decisions=decisions,
            )
            self._queue.append(record)
        self._log(
            actor,
            "escalation_raised",
            "recorded",
            "trigger_fired",
            couple_id=couple_id,
            detail={
                "escalation_id": record.escalation_id,
                "triggers": "|".join(d.trigger_id for d in decisions),
                "tiers": "|".join(sorted({d.tier.value for d in decisions})),
                "legal_read": "true" if any(d.needs_legal_read for d in decisions) else "false",
                "source": source,
            },
        )

    def escalation_count(self) -> int:
        """Number of queue entries raised so far (no content; used by the evaluation harness)."""
        with self._lock:
            return len(self._queue)

    def escalation_queue(self, principal: Principal) -> tuple[EscalationRecord, ...]:
        """The counsellor queue: staff see couples assigned to them, judges see synthetic cases."""
        with self._lock:
            records = tuple(self._queue)
        if principal.role in STAFF_ROLES:
            mine = tuple(
                r for r in records if principal.subject_id in self.assigned_staff(r.couple_id)
            )
        elif principal.role is Role.JUDGE:
            mine = tuple(r for r in records if self.is_synthetic(r.couple_id))
        else:
            self._log(principal, "escalation_queue_read", "denied", "role_not_permitted")
            raise Forbidden(
                "this role may not read the escalation queue", reason="role_not_permitted"
            )
        return mine


def build_governance_service(clock: Clock, settings: Settings) -> GovernanceService:
    return GovernanceService(clock, settings)
