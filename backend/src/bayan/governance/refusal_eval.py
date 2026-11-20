"""Importable refusal evaluation: the measured numbers behind the refusal classifier.

Two labelled prompt sets live in `eval_data/` (synthetic prompts, English, Arabic draft, Urdu draft):

* DEV (100 prompts): the patterns in `data/consent_policies.yaml` were tuned against this split, so
  its numbers are optimistic by construction.
* HELD-OUT (79 prompts): written after the tuning and NEVER tuned against. Its FIRST-RUN result
  (recorded on 2026-11-20: 36 of 59 must-refuse prompts refused = 61.0 percent, 0 of 20 benign
  prompts refused) is frozen below as `HELDOUT_FIRST_RUN`. The report also gives the CURRENT run,
  labelled as such. If patterns are later tuned on the held-out misses, that set is no longer held
  out: the frozen first run stays the honest estimate and the current run is no longer evidence of
  generalisation.

Both sets were written by the same engineer who wrote the patterns (an optimistic bias). The
classifier is keyword and pattern matching on normalised text, not language understanding.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any, Final

import yaml

from bayan.core.contracts import Frozen
from bayan.core.types import Locale
from bayan.governance.errors import GovernanceConfigError
from bayan.governance.policies import compiled_refusal_patterns, load_policy_file
from bayan.governance.third_party import classify_request

EVAL_DATA: Final = Path(__file__).resolve().parent / "eval_data"
DEV_FILE: Final = "refusal_prompts_dev.yaml"
HELDOUT_FILE: Final = "refusal_prompts_heldout.yaml"

LIMIT: Final = (
    "Keyword and pattern matching on normalised text, not language understanding. It misses paraphrase, "
    "broken plurals, colloquial forms, Roman-script Urdu, Arabizi and obfuscation, and refuses some "
    "harmless sentences that contain a listed phrase. Nothing in the product generates free text, so a "
    "miss does not produce an unsafe answer; it fails to route a high-impact or distressed question to a "
    "counsellor. Prompt sets are synthetic and written by the same engineer as the patterns."
)


class SplitResult(Frozen):
    name: str
    tuned_on_it: bool
    n_prompts: int
    languages: dict[str, int]
    must_refuse: int
    refused: int
    recall: float
    category_correct: int
    benign: int
    false_refusals: int
    known_gap: int
    known_gap_refused: int
    missed_ids: tuple[str, ...]


class FrozenFirstRun(Frozen):
    """The held-out first-run result, recorded before any tuning could touch it. Never edit."""

    recorded_on: str
    must_refuse: int
    refused: int
    recall: float
    benign: int
    false_refusals: int
    note: str


HELDOUT_FIRST_RUN: Final = FrozenFirstRun(
    recorded_on="2026-11-20",
    must_refuse=59,
    refused=36,
    recall=36 / 59,
    benign=20,
    false_refusals=0,
    note="First run of the held-out split, before any pattern was tuned on it. 23 misses, all natural paraphrases.",
)


class RefusalReport(Frozen):
    n_prompts: int
    languages: dict[str, int]
    categories: dict[str, int]
    patterns: int
    dev_tuned: SplitResult
    heldout_current_run: SplitResult
    heldout_first_run_frozen: FrozenFirstRun
    heldout_current_matches_first_run: bool
    limit: str = LIMIT
    status: str = "draft: Arabic and Urdu prompts and patterns have no native clinical review"


def _load(name: str) -> list[dict[str, Any]]:
    try:
        rows = yaml.safe_load((EVAL_DATA / name).read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as exc:
        raise GovernanceConfigError(
            f"refusal evaluation data {name} is unreadable: {type(exc).__name__}"
        ) from exc
    if not isinstance(rows, list):
        raise GovernanceConfigError(f"refusal evaluation data {name} must be a list")
    return rows


def score_split(name: str, rows: list[dict[str, Any]], *, tuned_on_it: bool) -> SplitResult:
    """Score the classifier on one labelled split. Known-gap prompts are reported, not counted."""
    must_refuse = [r for r in rows if r["expected"] != "allow" and not r.get("known_gap")]
    gaps = [r for r in rows if r.get("known_gap")]
    benign = [r for r in rows if r["expected"] == "allow"]
    refused = category_correct = 0
    missed: list[str] = []
    for r in must_refuse:
        d = classify_request(r["text"], Locale(r["locale"]))
        refused += d.refuse
        category_correct += d.refuse and d.category == r["expected"]
        if not d.refuse:
            missed.append(str(r["id"]))
    false_refusals = sum(classify_request(r["text"], Locale(r["locale"])).refuse for r in benign)
    gap_refused = sum(classify_request(r["text"], Locale(r["locale"])).refuse for r in gaps)
    return SplitResult(
        name=name,
        tuned_on_it=tuned_on_it,
        n_prompts=len(rows),
        languages=dict(Counter(str(r["locale"]) for r in rows)),
        must_refuse=len(must_refuse),
        refused=refused,
        recall=refused / len(must_refuse) if must_refuse else 0.0,
        category_correct=category_correct,
        benign=len(benign),
        false_refusals=false_refusals,
        known_gap=len(gaps),
        known_gap_refused=gap_refused,
        missed_ids=tuple(missed),
    )


def run_refusal_evaluation() -> RefusalReport:
    """Score both labelled splits now and report them next to the frozen held-out first run."""
    dev_rows = _load(DEV_FILE)
    held_rows = _load(HELDOUT_FILE)
    dev = score_split("dev (patterns tuned on this split)", dev_rows, tuned_on_it=True)
    held = score_split("held-out (current run)", held_rows, tuned_on_it=False)
    rows = dev_rows + held_rows
    first = HELDOUT_FIRST_RUN
    return RefusalReport(
        n_prompts=len(rows),
        languages=dict(Counter(str(r["locale"]) for r in rows)),
        categories=dict(Counter(str(r["expected"]) for r in rows)),
        patterns=len(compiled_refusal_patterns()),
        dev_tuned=dev,
        heldout_current_run=held,
        heldout_first_run_frozen=first,
        heldout_current_matches_first_run=(
            held.refused == first.refused
            and held.must_refuse == first.must_refuse
            and held.false_refusals == first.false_refusals
        ),
    )


def category_names() -> tuple[str, ...]:
    return tuple(load_policy_file().refusal.categories)
