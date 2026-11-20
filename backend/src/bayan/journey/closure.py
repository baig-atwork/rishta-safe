"""Closure: schema, typed scoring of the original patient items, and the teach-back quiz.

Item-level only. There is no total score and no scale score (n is too small and the items are
unvalidated; research 04 section 2.1). The comprehension test has NOT been run on people.
"""

from __future__ import annotations

from typing import Any, Literal, cast

from bayan.core.contracts import ResultCategory
from bayan.core.errors import Invalid
from bayan.core.types import Locale
from bayan.explain.loader import load_constants
from bayan.journey.config import load_closure, load_closure_texts
from bayan.journey.models import (
    ClosureAnswers,
    ClosureSchema,
    ItemOutcome,
    ItemResult,
    PatientClosure,
    PatientItemDef,
    ProformaFieldDef,
    SilsChoice,
    TeachBackItem,
    TeachBackItemResult,
    TeachBackOption,
    TeachBackQuiz,
    TeachBackResult,
    TeachBackSubmission,
)

LanguageStatus = Literal["reviewed", "draft"]


def _fill(text: str) -> str:
    """Fill the {denominator} slot from the shared constants; no other slot exists in closure text."""
    return text.format(denominator=load_constants()["denominator"])


def _status(locale: Locale) -> LanguageStatus:
    return cast("LanguageStatus", str(load_closure_texts(locale)["meta"]["language_status"]))


def build_schema(locale: Locale) -> ClosureSchema:
    data, texts = load_closure(), load_closure_texts(locale)
    labels = texts["proforma"]
    fields = tuple(
        ProformaFieldDef(
            no=f["number"],
            id=f["id"],
            label=labels[f["id"]]["label"],
            help=labels[f["id"]]["help"],
            filled_by=f["filled_by"],
            anchor=f["anchor"],
            challenge_items=tuple(f["challenge_items"]),
            measure=f["measure"],
        )
        for f in data["proforma"]["fields"]
    )
    items = tuple(
        PatientItemDef(
            id=i["id"],
            no=i["number"],
            format=i["format"],
            prompt=_fill(texts["patient_items"][i["id"]]["prompt"]),
            options=dict(texts["patient_items"][i["id"]].get("options", {})),
            scoring=i["scoring"],
            measures=i["measures"],
        )
        for i in data["patient_items"]["items"]
    )
    interest = texts["service_interest"]
    return ClosureSchema(
        locale=locale,
        language_status=_status(locale),
        clinician_fields=fields,
        information_ticks=dict(texts["proforma_options"]["information_ticks"]),
        patient_items=items,
        sils_prompt=texts["sils"]["prompt"],
        sils_options=dict(texts["sils"]["options"]),
        sils_attribution=texts["sils"]["attribution"],
        service_interest_prompt=interest["prompt"],
        service_interest_consent_text=interest["consent_text"],
        service_interest_values=dict(interest["values"]),
        service_interest_topics=dict(interest["topics"]),
        reminder_months=tuple(data["service_interest"]["reminder_months"]),
        notices=dict(texts["notices"]),
    )


def _tri_outcome(answer: str, correct: str) -> ItemOutcome:
    if answer == "not_sure":
        return "not_sure"
    return "correct" if answer == correct else "incorrect"


def _score_item(
    item: dict[str, Any], answer: str | int | None, expected: int | None, tolerance: int
) -> ItemOutcome:
    if answer is None:
        return "not_answered"
    if item["scoring"] == "key":
        return _tri_outcome(str(answer), str(item["correct"]))
    if item["scoring"] == "tolerance_against_engine":
        if expected is None:
            return "not_scored"
        return "correct" if abs(int(answer) - expected) <= tolerance else "incorrect"
    return "not_scored"


def score_patient(
    person_id: str, answers: ClosureAnswers, expected_affected_per_100: int | None
) -> PatientClosure:
    """Item-level results. Only items with a key or an engine number are scored; the rest are stored."""
    data = load_closure()["patient_items"]
    tolerance = int(data["scored_tolerance_points"]["value"])
    results: list[ItemResult] = []
    for item in data["items"]:
        raw = getattr(answers, str(item["id"]))
        answer: str | int | None = raw.value if hasattr(raw, "value") else raw
        results.append(
            ItemResult(
                item_id=str(item["id"]),
                outcome=_score_item(item, answer, expected_affected_per_100, tolerance),
                answer=answer,
            )
        )
    sils = load_closure()["sils"]
    positive: bool | None = None
    if answers.sils is not None:
        score = int(sils["score_by_option"][SilsChoice(answers.sils).value])
        positive = score > int(sils["positive_screen_if_score_above"])
    interest = answers.service_interest
    return PatientClosure(
        person_id=person_id,
        items=tuple(results),
        sils_positive_screen=positive,
        service_interest=interest,
        consent_text_version=interest.consent_version if interest else None,
    )


# ------------------------------------------------------------------------------ teach-back
def _quiz_items(category: ResultCategory) -> list[dict[str, Any]]:
    return cast("list[dict[str, Any]]", load_closure()["teachback"]["quizzes"][category.value])


def build_quiz(couple_id: str, category: ResultCategory, locale: Locale) -> TeachBackQuiz:
    data, texts = load_closure()["teachback"], load_closure_texts(locale)
    tb = texts["teachback"]
    items: list[TeachBackItem] = []
    for item in _quiz_items(category):
        text = tb["items"][item["id"]]
        if item["format"] == "true_false_not_sure":
            options = tuple(
                TeachBackOption(id=o, label=texts["answer_labels"][o])
                for o in ("true", "false", "not_sure")
            )
        else:
            options = tuple(
                TeachBackOption(id=o, label=_fill(text["options"][o])) for o in data["option_ids"]
            )
        items.append(
            TeachBackItem(
                id=item["id"], prompt=_fill(text["prompt"]), format=item["format"], options=options
            )
        )
    return TeachBackQuiz(
        couple_id=couple_id,
        locale=locale,
        language_status=_status(locale),
        result_category=category,
        intro=tb["intro"],
        items=tuple(items),
        design_note=str(data["design"]),
    )


def _valid_options(item: dict[str, Any], option_ids: list[str]) -> tuple[str, ...]:
    if item["format"] == "true_false_not_sure":
        return ("true", "false", "not_sure")
    return tuple(option_ids)


def grade_quiz(
    couple_id: str, category: ResultCategory, submission: TeachBackSubmission
) -> TeachBackResult:
    data, texts = load_closure()["teachback"], load_closure_texts(submission.locale)
    tb = texts["teachback"]
    items = _quiz_items(category)
    known = {i["id"]: i for i in items}
    for item_id, option in submission.answers.items():
        if item_id not in known:
            raise Invalid(f"Unknown quiz item {item_id!r} for a {category.value} quiz.")
        if option not in _valid_options(known[item_id], list(data["option_ids"])):
            raise Invalid(f"Option {option!r} is not valid for item {item_id!r}.")
    graded = tuple(
        TeachBackItemResult(
            item_id=i["id"],
            answered=submission.answers.get(i["id"]),
            correct=submission.answers.get(i["id"]) == i["correct"],
            correct_option=i["correct"],
            explanation=_fill(tb["items"][i["id"]]["explanation"]),
        )
        for i in items
    )
    return TeachBackResult(
        couple_id=couple_id,
        locale=submission.locale,
        result_category=category,
        correct_count=sum(1 for g in graded if g.correct),
        item_count=len(graded),
        items=graded,
        results_note=tb["results_note"],
        scoring_note=str(data["scoring"]),
    )
