"""Evaluation of the escalation library on a deterministic synthetic edge-case set.

READ THIS BEFORE QUOTING A NUMBER. The must-escalate cases are GENERATED FROM THE SAME TRIGGER
DEFINITIONS the engine reads (data/escalation_rules.yaml): each case is built so that one
trigger's own `when` clause holds, plus random noise flags. Recall therefore measures
IMPLEMENTATION CONSISTENCY (the code does what the data file says, on every clause kind and every
trigger), not clinical sensitivity. It says nothing about whether the trigger list is complete,
whether the tiers are right, or whether real couples would be escalated when they should be; those
need the clinical lead's sign-off (pending) and real follow-up that this prototype does not have.

Negatives come in two groups. EASY negatives (no flag, no listed phrase) must not fire: precision
on them checks the engine does not escalate by accident. HARD negatives are sentences that contain
a listed distress phrase but are negated or about someone else ("I am not terrified", "my cousin was
devastated"): a keyword list cannot tell, so these DO fire; they are reported, not hidden, because
that is the known price of a deterministic phrase list (it errs towards escalating).
"""

from __future__ import annotations

import random

from bayan.core.contracts import (
    CoupleResult,
    Frozen,
    Inheritance,
    ResultCategory,
    ReviewPriority,
    SharedCondition,
)
from bayan.core.errors import Invalid
from bayan.core.types import Locale
from bayan.governance.escalation import (
    EscalationContext,
    Rules,
    TriggerDef,
    WhenClause,
    evaluate,
    load_rules,
)

MIN_POSITIVE_CASES = 200
COUPLE = "synthetic-couple-eval"

CAVEAT = (
    "The must-escalate cases are generated from the same trigger definitions the engine reads, so recall "
    "measures implementation consistency, not clinical sensitivity. Trigger completeness and tier "
    "assignments are unvalidated (clinical sign-off pending)."
)

_EASY_NEGATIVE_TEXT = (
    "",
    "When is my counselling appointment?",
    "What does carrier mean?",
    "This week at work was busy but I feel fine.",
    "Please explain the number 25 in 100 again.",
    "متى موعد الاستشارة؟",
    "ما معنى حامل؟",
    "میرا اپائنٹمنٹ کب ہے؟",
    "نتیجے کا مطلب سمجھائیں",
)
_HARD_NEGATIVE_TEXT = (
    "I am not terrified, just curious about the numbers.",
    "My cousin was devastated when she heard about her own result, not me.",
    "I used to feel hopeless about exams, this is different.",
    "I was so scared of needles as a child but the blood test was fine.",
    "لست خائفا جدا، فقط اريد الفهم",
    "میں بہت پریشان نہیں ہوں، بس سمجھنا چاہتا ہوں",
)
_CARRIER_SENTENCE = {
    Locale.EN: "I read the result and honestly {phrase} today",
    Locale.AR: "قرأت النتيجة و {phrase}",
    Locale.UR: "میں نے نتیجہ پڑھا اور {phrase}",
}


class TriggerScore(Frozen):
    cases: int
    fired: int
    recall: float


class EscalationEvaluation(Frozen):
    seed: int
    n_positive: int
    n_easy_negative: int
    n_hard_negative: int
    true_positive: int  # a case that must escalate, and the INTENDED trigger fired
    false_negative: int
    easy_false_positive: int
    hard_false_positive: int
    recall: float
    precision_easy: float  # TP / (TP + false positives among easy negatives)
    precision_with_hard: float
    per_trigger: dict[str, TriggerScore]
    missed_case_ids: tuple[str, ...]
    caveat: str = CAVEAT


def _result(category: ResultCategory, basis: str | None) -> CoupleResult:
    shared: tuple[SharedCondition, ...] = ()
    if basis is not None:
        shared = (
            SharedCondition(
                condition_id="cond-eval",
                gene="EVAL_GENE",
                inheritance=Inheritance.AUTOSOMAL_RECESSIVE,
                basis=basis,
                outcomes=(),
            ),
        )
    return CoupleResult(
        couple_id=COUPLE,
        category=category,
        review_priority=ReviewPriority.ROUTINE,
        shared=shared,
    )


def _noise_flags(rng: random.Random, exclude: str) -> dict[str, bool]:
    names = sorted(n for n, f in EscalationContext.model_fields.items() if f.annotation is bool)
    picked = rng.sample(names, k=rng.randint(0, 3))
    return {n: True for n in picked if n != exclude}


def _build_positive(
    rng: random.Random, rules: Rules, trig: TriggerDef
) -> tuple[EscalationContext, CoupleResult]:
    clause: WhenClause = rng.choice(trig.when)
    category = ResultCategory.NO_SHARED_CHANGE_FOUND
    basis: str | None = None
    flags: dict[str, bool] = {}
    text = rng.choice(_EASY_NEGATIVE_TEXT)
    locale = rng.choice(list(Locale))
    if clause.kind == "result_category":
        category = ResultCategory(rng.choice(clause.values))
    elif clause.kind == "shared_basis":
        category = ResultCategory.SHARED_RESULT_FOUND
        basis = rng.choice(clause.values)
    elif clause.kind == "flag":
        flags[clause.name] = True
    elif clause.kind == "phrase_list":
        phrase = rng.choice(rules.file.phrase_lists[clause.name][locale])
        text = _CARRIER_SENTENCE[locale].format(phrase=phrase)
    else:  # request_category
        cat = rng.choice(clause.values)
        text = rng.choice(rules.file.request_examples[cat][locale])
    noise = _noise_flags(rng, clause.name if clause.kind == "flag" else "")
    ctx = EscalationContext(couple_id=COUPLE, locale=locale, free_text=text, **{**noise, **flags})
    return ctx, _result(category, basis)


def run_escalation_evaluation(n: int = 400, seed: int = 20261120) -> EscalationEvaluation:
    """Build `n` must-escalate cases (round-robin over every trigger, so each is exercised about
    n / 21 times) plus easy and hard negatives, run `evaluate`, and score it. Deterministic."""
    if n < MIN_POSITIVE_CASES:
        raise Invalid(f"the evaluation needs at least {MIN_POSITIVE_CASES} must-escalate cases")
    rng = random.Random(seed)  # noqa: S311  (deterministic test data, not security)
    rules = load_rules()
    triggers = rules.triggers
    per_cases = dict.fromkeys((t.id for t in triggers), 0)
    per_fired = dict.fromkeys((t.id for t in triggers), 0)
    tp = fn = 0
    missed: list[str] = []
    for i in range(n):
        trig = triggers[i % len(triggers)]
        ctx, result = _build_positive(rng, rules, trig)
        fired = {d.trigger_id for d in evaluate(ctx, result, rules)}
        per_cases[trig.id] += 1
        if trig.id in fired:
            tp += 1
            per_fired[trig.id] += 1
        else:
            fn += 1
            missed.append(f"{trig.id}#{i}")
    n_easy = n // 2
    easy_fp = 0
    for _ in range(n_easy):
        ctx = EscalationContext(
            couple_id=COUPLE,
            locale=rng.choice(list(Locale)),
            free_text=rng.choice(_EASY_NEGATIVE_TEXT),
        )
        easy_fp += bool(evaluate(ctx, _result(ResultCategory.NO_SHARED_CHANGE_FOUND, None), rules))
    n_hard = max(len(_HARD_NEGATIVE_TEXT), n // 20)
    hard_fp = 0
    for j in range(n_hard):
        text = _HARD_NEGATIVE_TEXT[j % len(_HARD_NEGATIVE_TEXT)]
        ctx = EscalationContext(couple_id=COUPLE, free_text=text)
        hard_fp += bool(evaluate(ctx, _result(ResultCategory.NO_SHARED_CHANGE_FOUND, None), rules))
    return EscalationEvaluation(
        seed=seed,
        n_positive=n,
        n_easy_negative=n_easy,
        n_hard_negative=n_hard,
        true_positive=tp,
        false_negative=fn,
        easy_false_positive=easy_fp,
        hard_false_positive=hard_fp,
        recall=tp / n,
        precision_easy=tp / (tp + easy_fp) if tp + easy_fp else 0.0,
        precision_with_hard=tp / (tp + easy_fp + hard_fp) if tp + easy_fp + hard_fp else 0.0,
        per_trigger={
            tid: TriggerScore(
                cases=per_cases[tid],
                fired=per_fired[tid],
                recall=per_fired[tid] / per_cases[tid] if per_cases[tid] else 0.0,
            )
            for tid in per_cases
        },
        missed_case_ids=tuple(missed),
    )
