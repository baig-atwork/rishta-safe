"""Deterministic escalation library.

Named triggers (data/escalation_rules.yaml), each with a source, `needs_clinician_signoff: true`
and a legal-read flag where research 03 section 2.7 says a trigger may collide with Federal
Decree-Law 49/2023. Two tiers, because the federal programme's counsellors are trained physicians,
not genetics professionals:

* `counsellor`: a trained physician or counsellor of the programme.
* `accredited_geneticist`: an accredited genetics professional.

`evaluate` is a pure function of (context, result, rules). Nothing here is learned, scored or
generated: the triggers fire exactly as written, and a human decides what happens next. The due-by
hint is a key (`immediate`, `same_session`, `fast_track`, `routine`), never a number of days: the
time targets belong to the clinical lead (sign-off pending).
"""

from __future__ import annotations

import re
from collections.abc import Collection, Sequence
from dataclasses import dataclass
from enum import StrEnum
from functools import cache
from pathlib import Path
from typing import Final, Literal

import yaml
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, ValidationError, model_validator

from bayan.core.contracts import (
    CoupleResult,
    Frozen,
    Inheritance,
    PersonReport,
    ResultCategory,
    Zygosity,
)
from bayan.core.errors import Invalid
from bayan.core.types import Locale
from bayan.governance.errors import GovernanceConfigError
from bayan.governance.policies import DATA_DIR
from bayan.governance.text import normalize
from bayan.governance.third_party import classify_request


class EscalationTier(StrEnum):
    COUNSELLOR = "counsellor"
    ACCREDITED_GENETICIST = "accredited_geneticist"


class DueBy(StrEnum):
    IMMEDIATE = "immediate"
    SAME_SESSION = "same_session"
    FAST_TRACK = "fast_track"
    ROUTINE = "routine"


LegalMode = Literal["never", "always", "when_non_targeted", "when_genotype_inferred"]


class EscalationContext(Frozen):
    """Facts the rules read. Derived from reports with `context_from_reports`, or set directly.

    `free_text` is a person's own words (a question, a message). It is evaluated and then
    discarded: it is never stored in the queue or the audit chain.
    """

    couple_id: str
    locale: Locale = Locale.EN
    free_text: str = Field(default="", max_length=2000)
    affected_partner: bool = False
    shared_severity_a: bool = False
    has_vus: bool = False
    copy_number_or_non_snv: bool = False
    x_linked_finding: bool = False
    pregnancy_in_progress: bool = False
    partner_results_unavailable: bool = False
    variable_penetrance_gene: bool = False
    family_history_recessive: bool = False
    lab_unconfirmed: bool = False
    genotype_inferred_relatedness: bool = False
    non_targeted_finding: bool = False
    discordant_with_history: bool = False
    reclassification_notice: bool = False
    rntk_with_life_threat: bool = False


class EscalationDecision(Frozen):
    couple_id: str
    trigger_id: str
    tier: EscalationTier
    reason_keys: tuple[str, ...]
    due_by_hint: DueBy
    needs_clinician_signoff: Literal[True] = True
    needs_legal_read: bool
    source: str


class EscalationRecord(Frozen):
    """A queue entry for the counsellor queue. Holds decisions only, never the person's words."""

    escalation_id: str
    couple_id: str
    created_at: AwareDatetime
    decisions: tuple[EscalationDecision, ...]
    status: Literal["open"] = "open"


# --------------------------------------------------------------------------------------------
# Rule data
# --------------------------------------------------------------------------------------------

_FLAG_FIELDS: Final = frozenset(
    name for name, f in EscalationContext.model_fields.items() if f.annotation is bool
)
_PHRASE_LISTS: Final = ("crisis", "distress")


class _Strict(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class WhenClause(_Strict):
    kind: Literal["result_category", "shared_basis", "flag", "phrase_list", "request_category"]
    values: tuple[str, ...] = ()
    name: str = ""

    @model_validator(mode="after")
    def _check(self) -> WhenClause:
        if self.kind == "flag" and self.name not in _FLAG_FIELDS:
            raise ValueError(f"unknown context flag {self.name!r}")
        if self.kind == "phrase_list" and self.name not in _PHRASE_LISTS:
            raise ValueError(f"unknown phrase list {self.name!r}")
        if self.kind in ("result_category", "shared_basis", "request_category") and not self.values:
            raise ValueError(f"{self.kind} needs values")
        if self.kind == "result_category":
            for v in self.values:
                ResultCategory(v)
        return self


class TriggerDef(_Strict):
    id: str
    source: str = Field(min_length=20)
    tier: EscalationTier
    due_by_hint: DueBy
    needs_clinician_signoff: Literal[True]
    needs_legal_read: LegalMode
    reason_keys: tuple[str, ...] = Field(min_length=1)
    when: tuple[WhenClause, ...] = Field(min_length=1)


class RulesFile(BaseModel):
    model_config = ConfigDict(frozen=True, extra="ignore")

    phrase_lists: dict[str, dict[Locale, tuple[str, ...]]]
    request_examples: dict[str, dict[Locale, tuple[str, ...]]]
    triggers: tuple[TriggerDef, ...]


@dataclass(frozen=True, slots=True)
class Rules:
    file: RulesFile
    phrases: dict[str, tuple[re.Pattern[str], ...]]

    @property
    def triggers(self) -> tuple[TriggerDef, ...]:
        return self.file.triggers

    def trigger(self, trigger_id: str) -> TriggerDef:
        for t in self.file.triggers:
            if t.id == trigger_id:
                return t
        raise GovernanceConfigError(f"escalation trigger {trigger_id!r} is not defined")


def _phrase_regex(phrase: str) -> re.Pattern[str]:
    norm = normalize(phrase)
    # ASCII phrases match on whole words; Arabic and Urdu attach clitics, so they match as substrings.
    return re.compile(rf"(?<!\w){re.escape(norm)}(?!\w)" if norm.isascii() else re.escape(norm))


@cache
def load_rules(path: Path | None = None) -> Rules:
    source = path or DATA_DIR / "escalation_rules.yaml"
    try:
        raw = yaml.safe_load(source.read_text(encoding="utf-8"))
        parsed = RulesFile.model_validate(raw)
    except (OSError, yaml.YAMLError, ValidationError) as exc:
        raise GovernanceConfigError(
            f"escalation_rules.yaml is unreadable or invalid: {str(exc)[:600]}"
        ) from exc
    ids = [t.id for t in parsed.triggers]
    if len(ids) != len(set(ids)):
        raise GovernanceConfigError("escalation_rules.yaml has a duplicate trigger id")
    phrases: dict[str, tuple[re.Pattern[str], ...]] = {}
    for name in _PHRASE_LISTS:
        by_locale = parsed.phrase_lists.get(name, {})
        phrases[name] = tuple(_phrase_regex(p) for loc in Locale for p in by_locale.get(loc, ()))
    return Rules(file=parsed, phrases=phrases)


# --------------------------------------------------------------------------------------------
# Evaluation
# --------------------------------------------------------------------------------------------


def _clause_true(
    clause: WhenClause,
    ctx: EscalationContext,
    result: CoupleResult | None,
    rules: Rules,
    text_norm: str,
) -> bool:
    if clause.kind == "result_category":
        return result is not None and result.category.value in clause.values
    if clause.kind == "shared_basis":
        return result is not None and any(s.basis in clause.values for s in result.shared)
    if clause.kind == "flag":
        return bool(getattr(ctx, clause.name))
    if clause.kind == "phrase_list":
        return bool(text_norm) and any(rx.search(text_norm) for rx in rules.phrases[clause.name])
    refusal = classify_request(ctx.free_text, ctx.locale) if text_norm else None
    return refusal is not None and any(c in clause.values for c in refusal.categories)


def _legal(mode: LegalMode, ctx: EscalationContext) -> bool:
    if mode == "always":
        return True
    if mode == "when_non_targeted":
        return ctx.non_targeted_finding
    if mode == "when_genotype_inferred":
        return ctx.genotype_inferred_relatedness
    return False


def evaluate(
    ctx: EscalationContext, result: CoupleResult | None, rules: Rules | None = None
) -> tuple[EscalationDecision, ...]:
    """Every trigger whose condition holds, in the order the data file lists them."""
    if result is not None and ctx.couple_id != result.couple_id:
        raise Invalid("the escalation context and the result belong to different couples")
    loaded = rules or load_rules()
    text_norm = normalize(ctx.free_text)
    return tuple(
        EscalationDecision(
            couple_id=ctx.couple_id,
            trigger_id=trig.id,
            tier=trig.tier,
            reason_keys=trig.reason_keys,
            due_by_hint=trig.due_by_hint,
            needs_legal_read=_legal(trig.needs_legal_read, ctx),
            source=trig.source,
        )
        for trig in loaded.triggers
        if any(_clause_true(c, ctx, result, loaded, text_norm) for c in trig.when)
    )


def decision_for(
    trigger_id: str, couple_id: str, ctx: EscalationContext | None = None
) -> EscalationDecision:
    """Build the decision for a named trigger fired by the service itself (for example the
    right-not-to-know life-threat override), using the same data as `evaluate`."""
    trig = load_rules().trigger(trigger_id)
    context = ctx or EscalationContext(couple_id=couple_id)
    return EscalationDecision(
        couple_id=couple_id,
        trigger_id=trig.id,
        tier=trig.tier,
        reason_keys=trig.reason_keys,
        due_by_hint=trig.due_by_hint,
        needs_legal_read=_legal(trig.needs_legal_read, context),
        source=trig.source,
    )


def context_from_reports(
    couple_id: str,
    reports: Sequence[PersonReport],
    result: CoupleResult,
    *,
    severity_a_condition_ids: Collection[str] = (),
    penetrance_gene_symbols: Collection[str] = (),
    locale: Locale = Locale.EN,
    free_text: str = "",
    pregnancy_in_progress: bool = False,
    family_history_recessive: bool = False,
    reclassification_notice: bool = False,
    non_targeted_finding: bool = False,
    copy_number_or_non_snv: bool = False,
    discordant_with_history: bool = False,
    genotype_inferred_relatedness: bool = False,
) -> EscalationContext:
    """Derive the report-based flags deterministically; the caller supplies facts the reports
    cannot carry (severity tier and penetrance come from the condition catalogue, pregnancy from
    intake, and so on). Nothing clinical is decided here."""
    findings = [f for r in reports for f in r.findings]
    pathogenic = [f for f in findings if f.classification != "vus"]
    shared_conditions = {s.condition_id for s in result.shared}
    return EscalationContext(
        couple_id=couple_id,
        locale=locale,
        free_text=free_text,
        affected_partner=any(f.zygosity is Zygosity.AFFECTED for f in pathogenic),
        shared_severity_a=bool(shared_conditions & set(severity_a_condition_ids)),
        has_vus=any(f.zygosity is Zygosity.VUS or f.classification == "vus" for f in findings),
        copy_number_or_non_snv=copy_number_or_non_snv,
        x_linked_finding=any(
            f.inheritance is Inheritance.X_LINKED
            and f.zygosity in (Zygosity.CARRIER, Zygosity.AFFECTED)
            for f in pathogenic
        ),
        pregnancy_in_progress=pregnancy_in_progress,
        partner_results_unavailable=len(reports) < 2
        or any(r.status == "pending_confirmation" for r in reports),
        variable_penetrance_gene=any(f.gene in set(penetrance_gene_symbols) for f in pathogenic),
        family_history_recessive=family_history_recessive,
        lab_unconfirmed=any(
            r.status == "pending_confirmation" or r.haem_stage != "genotype_confirmed"
            for r in reports
        ),
        genotype_inferred_relatedness=genotype_inferred_relatedness,
        non_targeted_finding=non_targeted_finding,
        discordant_with_history=discordant_with_history,
        reclassification_notice=reclassification_notice,
    )
