"""The haematology aid: CBC, then HPLC, into a closed vocabulary with a rule trace.

SYNTHETIC-DATA PROTOTYPE. A clinician-facing screening-support aid. Every rule needs clinician sign-off. It is not a
diagnosis, not clinical advice and not a medical device. A CBC alone can never produce a carrier, not-a-carrier,
normal or disease statement; the loader refuses any such label at the CBC stage.

Prior art: other public tools already interpret laboratory values (haemoglobin, MCV, MCH, HbA2, HbF, ferritin, G6PD) with named
sources. This aid is not claimed as new.
"""

from __future__ import annotations

from bayan.core.contracts import HaemLabel
from bayan.haem.models import (
    CbcInput,
    HaemInterpretation,
    HaemRule,
    HaemRulesView,
    HaemRuleView,
    HaemSourceRef,
    HaemTraceLine,
    HplcInput,
    Stage,
)
from bayan.haem.rules import CompiledRuleset, Value, evaluate, load_haem_ruleset

__all__ = ["HaemService", "build_haem_service"]

_INPUT_ORDER = (
    "age_years",
    "sex",
    "pregnant",
    "transfused_last_4_months",
    "hb_g_per_l",
    "mcv_fl",
    "mch_pg",
    "ferritin_status",
    "alpha0_origin_both_high_or_unknown",
    "hba2_pct",
    "hba2_is_total",
    "hbf_pct",
    "variant_detected",
    "single_hba_band_only",
)


class HaemService:
    def __init__(self, compiled: CompiledRuleset) -> None:
        self._c = compiled

    @property
    def ruleset_version(self) -> str:
        return self._c.version

    def interpret(self, cbc: CbcInput, hplc: HplcInput | None) -> HaemInterpretation:
        """Interpret a work-up. With `hplc` omitted only the three CBC-only labels are possible."""
        stage: Stage = "cbc_only" if hplc is None else "cbc_plus_hplc"
        rule_stage = "S1" if hplc is None else "S2"
        ctx = self._context(cbc, hplc)
        trace: list[HaemTraceLine] = []
        flags: list[str] = []
        statements: list[str] = []
        disagreements: list[str] = []
        used_sources: dict[str, HaemSourceRef] = {}
        decided: tuple[HaemRule, HaemLabel] | None = None

        for rule in self._c.ruleset.rules:
            if rule.stage not in ("ALL", rule_stage):
                continue
            if rule.type == "terminal" and decided is not None:
                continue
            if not evaluate(self._c.compiled[rule.id], ctx):
                continue
            used_sources[rule.source.id] = self._c.ruleset.sources[rule.source.id]
            if rule.flag:
                flags.append(rule.flag)
            if rule.type == "annotate":
                trace.append(self._line(rule, rule.flag or rule.id))
                continue
            decided = (rule, self._label_for(rule, stage, ctx))
            trace.append(self._line(rule, rule.output or rule.reason or rule.id))
            if rule.mandatory_statement:
                statements.append(rule.mandatory_statement)
            if rule.sources_disagree:
                disagreements.append(rule.sources_disagree)

        if (
            decided is None
        ):  # unreachable while the table ends in a catch-all, but never fall through silently
            msg = "no terminal rule matched; the rule table must end with a catch-all"
            raise RuntimeError(msg)
        rule, label = decided
        if rule.validity:
            # An out-of-scope or unreadable record carries no clinical flags (ADR 0104).
            flags = []
            trace = [line for line in trace if line.kind == "terminal"]
            used_sources = {rule.source.id: self._c.ruleset.sources[rule.source.id]}
        meta = self._c.ruleset.meta
        return HaemInterpretation(
            label=label,
            stage=stage,
            label_description=self._c.ruleset.label_descriptions[label],
            matched_rule_id=rule.id,
            draft_output=rule.output or rule.reason or rule.id,
            trace=tuple(trace),
            flags=tuple(dict.fromkeys(flags)),
            mandatory_statements=tuple(statements),
            sources_disagree=tuple(disagreements),
            sources=tuple(used_sources.values()),
            not_a_diagnosis=meta.not_a_diagnosis,
            prior_art_note=meta.prior_art_note,
            population_caveat=meta.population_caveat,
            ruleset_version=self._c.version,
        )

    def rules_view(self) -> HaemRulesView:
        rs = self._c.ruleset
        return HaemRulesView(
            ruleset_version=self._c.version,
            status=rs.meta.status,
            not_a_diagnosis=rs.meta.not_a_diagnosis,
            prior_art_note=rs.meta.prior_art_note,
            population_caveat=rs.meta.population_caveat,
            cbc_only_labels=rs.labels.cbc_only,
            cbc_plus_hplc_labels=rs.labels.cbc_plus_hplc,
            label_descriptions=rs.label_descriptions,
            forbidden_outputs_unless_a_cited_guideline_allows=rs.forbidden_outputs_unless_a_cited_guideline_allows,
            rules=tuple(
                HaemRuleView(
                    id=r.id,
                    stage=r.stage,
                    type=r.type,
                    condition=r.condition,
                    labels=self._rule_labels(r),
                    flag=r.flag,
                    reason=r.reason,
                    source=r.source,
                    sources_disagree=r.sources_disagree,
                )
                for r in rs.rules
            ),
            rules_deliberately_left_out=rs.rules_deliberately_left_out,
            sources=tuple(rs.sources.values()),
            fixture_authorship_note=rs.meta.fixture_authorship_note,
        )

    # ------------------------------------------------------------------ internals

    def _rule_labels(self, rule: HaemRule) -> tuple[HaemLabel, ...]:
        return self._c.labels_for(rule)

    @staticmethod
    def _line(rule: HaemRule, outcome: str) -> HaemTraceLine:
        return HaemTraceLine(
            rule_id=rule.id,
            kind=rule.type,
            outcome=outcome,
            source_id=rule.source.id,
            locator=rule.source.locator,
        )

    def _label_for(self, rule: HaemRule, stage: Stage, ctx: dict[str, Value]) -> HaemLabel:
        if rule.label is None:
            assert rule.label_s1 is not None
            assert rule.label_s2 is not None
            return rule.label_s1 if stage == "cbc_only" else rule.label_s2
        for i, override in enumerate(rule.label_overrides):
            if evaluate(self._c.override_compiled[(rule.id, i)], ctx):
                return override.label
        return rule.label

    @staticmethod
    def _context(cbc: CbcInput, hplc: HplcInput | None) -> dict[str, Value]:
        values: dict[str, Value] = dict.fromkeys(_INPUT_ORDER)
        values.update(cbc.model_dump())
        if hplc is not None:
            values.update(hplc.model_dump())
        return values


def build_haem_service() -> HaemService:
    return HaemService(load_haem_ruleset())
