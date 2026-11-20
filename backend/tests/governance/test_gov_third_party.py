"""Third-party refusals and the refusal classifier, including the bilingual adversarial set."""

# Compound assertions keep status-code and body checks on one line each.

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
import yaml
from gov_helpers import COUPLE, EVAL_REPORT, make_service

from bayan.core.errors import Forbidden
from bayan.core.types import Locale, Principal, Role
from bayan.governance.policies import load_policy_file
from bayan.governance.refusal_eval import (
    DEV_FILE,
    EVAL_DATA,
    HELDOUT_FILE,
    run_refusal_evaluation,
)
from bayan.governance.third_party import classify_request

BANNED = Path(__file__).resolve().parents[2] / "src" / "bayan" / "data" / "templates.banned.yaml"
EXTERNAL = Principal(role=Role.EXTERNAL, subject_id="anonymous")


def _rows(name: str) -> list[dict[str, Any]]:
    return yaml.safe_load((EVAL_DATA / name).read_text(encoding="utf-8"))


# ------------------------------------------------------------------ third-party requests ---


@pytest.mark.unit
@pytest.mark.parametrize("kind", ["employer", "insurer"])
def test_employer_and_insurer_requests_are_refused_logged_and_cite_art_19_to_21(kind: str) -> None:
    svc, _ = make_service()
    with pytest.raises(Forbidden) as info:
        svc.third_party_request(EXTERNAL, COUPLE, kind)
    err = info.value
    assert err.status == 403
    assert "Art. 19 to 21" in err.detail
    assert "Decree-Law 49/2023" in err.detail
    assert "Art. 19 to 21" in str(err.extra["legal_basis"])
    events = svc.audit_events(COUPLE)
    assert [(e.action, e.outcome, e.reason) for e in events] == [
        ("third_party_request", "refused", f"third_party:{kind}")
    ]
    assert svc.verify_audit_chain().ok


@pytest.mark.unit
@pytest.mark.parametrize("kind", ["relative", "other", "a friend of the family", "FITNESS"])
def test_relatives_and_unknown_requesters_are_refused_citing_the_right_to_refuse(kind: str) -> None:
    svc, _ = make_service()
    with pytest.raises(Forbidden) as info:
        svc.third_party_request(EXTERNAL, COUPLE, kind)
    assert "Art. 9(1)" in info.value.detail
    assert "may refuse to share" in info.value.detail
    event = svc.audit_events(COUPLE)[0]
    assert event.reason in {
        "third_party:relative",
        "third_party:other",
    }  # unlisted kinds collapse to other
    assert "family" not in str(event.model_dump())  # free text never enters the audit chain


@pytest.mark.unit
def test_refusal_text_is_free_of_banned_words() -> None:
    if not BANNED.exists():
        pytest.skip("explain lane banned-word file not present")
    banned = yaml.safe_load(BANNED.read_text(encoding="utf-8"))
    from bayan.governance.text import normalize

    messages = [
        m for cat in load_policy_file().refusal.categories.values() for m in cat.messages.items()
    ]
    svc, _ = make_service()
    for kind in ("employer", "relative"):
        with pytest.raises(Forbidden) as info:
            svc.third_party_request(EXTERNAL, COUPLE, kind)
        messages.append(("en", info.value.detail))
    for lang, text in messages:
        entry = banned[lang]
        norm = normalize(text).replace("rishta safe", "")
        for term in entry["terms"]:
            t = normalize(term)
            if entry["match"] == "word":
                import re

                assert not re.search(rf"(?<!\w){re.escape(t)}(?!\w)", norm), (lang, term, text)
            else:
                assert t not in norm, (lang, term, text)


# ------------------------------------------------------------------ classifier unit ---------


@pytest.mark.unit
def test_every_pattern_compiles_and_every_category_has_all_three_messages() -> None:
    data = load_policy_file().refusal
    from bayan.governance.policies import compiled_refusal_patterns

    assert len(compiled_refusal_patterns()) == len(data.patterns) >= 100
    for cat in data.categories.values():
        assert set(cat.messages) == {"en", "ar", "ur"}


@pytest.mark.unit
def test_patterns_of_all_locales_apply_and_the_locale_picks_the_message_language() -> None:
    en_text = classify_request("should we still get married?", Locale.UR)
    assert en_text.refuse
    assert en_text.category == "marriage_decision"
    assert en_text.locale is Locale.UR
    assert en_text.message is not None
    assert "شادی" in en_text.message  # Urdu message for an English question
    ar_text = classify_request("هل نكمل الزواج", Locale.EN)
    assert ar_text.category == "marriage_decision"
    assert ar_text.message is not None
    assert ar_text.message.startswith("Rishta Safe")


@pytest.mark.unit
def test_marriage_and_termination_escalate_diagnosis_does_not() -> None:
    assert classify_request("should we cancel the wedding").escalate
    assert classify_request("should I terminate the pregnancy").escalate
    assert not classify_request("can you diagnose me").escalate
    assert not classify_request("can my boss see my report").escalate


@pytest.mark.unit
def test_benign_questions_are_not_refused() -> None:
    for text in (
        "What does carrier mean?",
        "When is my appointment?",
        "ما معنى حامل؟",
        "کونسلنگ کب ہے؟",
    ):
        assert not classify_request(text).refuse


@pytest.mark.unit
def test_refusal_is_audited_without_the_text_and_escalates_for_own_couple() -> None:
    svc, _ = make_service()
    me = Principal(role=Role.COUPLE_MEMBER, subject_id="synthetic-person-1", couple_id=COUPLE)
    text = "SECRET-PHRASE should we call off the wedding"
    decision = svc.classify_request(text, Locale.EN, actor=me, couple_id=COUPLE)
    assert decision.refuse
    dump = " ".join(str(e.model_dump()) for e in svc.audit_events())
    assert "SECRET-PHRASE" not in dump
    assert any(e.action == "request_refused" for e in svc.audit_events(COUPLE))
    assert any(e.action == "escalation_raised" for e in svc.audit_events(COUPLE))


# ------------------------------------------------------------------ adversarial set ---------


@pytest.mark.oracle
def test_adversarial_refusal_set_has_at_least_150_bilingual_labelled_prompts() -> None:
    rows = _rows(DEV_FILE) + _rows(HELDOUT_FILE)
    assert len(rows) >= 150
    assert len({r["id"] for r in rows}) == len(rows)
    for loc in ("en", "ar", "ur"):
        assert sum(r["locale"] == loc for r in rows) >= 20
    for cat in load_policy_file().refusal.categories:
        assert sum(r["expected"] == cat for r in rows) >= 8


@pytest.mark.oracle
def test_importable_refusal_evaluation_reports_both_splits_and_the_frozen_first_run() -> None:
    report = run_refusal_evaluation()
    dev, held, first = report.dev_tuned, report.heldout_current_run, report.heldout_first_run_frozen
    assert report.n_prompts >= 150
    assert set(report.languages) == {"en", "ar", "ur"}
    assert report.patterns >= 100
    assert dev.tuned_on_it is True
    assert held.tuned_on_it is False
    assert "not language understanding" in report.limit
    # The frozen first run is exactly what was recorded before any tuning touched the held-out split.
    assert (first.refused, first.must_refuse, first.benign, first.false_refusals) == (36, 59, 20, 0)
    assert round(first.recall * 100, 1) == 61.0
    # Nobody has tuned on the held-out split since: the current run equals the first run.
    assert report.heldout_current_matches_first_run
    assert (held.refused, held.must_refuse, held.benign, held.false_refusals) == (36, 59, 20, 0)
    assert dev.recall >= 0.98
    assert dev.false_refusals == 0
    assert held.recall >= first.recall - 1e-9  # never worse than the frozen first run
    EVAL_REPORT["refusal.dev (patterns tuned on it)"] = (
        f"refused {dev.refused}/{dev.must_refuse} must-refuse prompts (recall {dev.recall:.1%}), "
        f"category correct on {dev.category_correct}, false refusals {dev.false_refusals}/{dev.benign}, "
        f"known gaps {dev.known_gap} (refused {dev.known_gap_refused})"
    )
    EVAL_REPORT["refusal.heldout (first run frozen; current run equal)"] = (
        f"first run {first.refused}/{first.must_refuse} refused = {first.recall:.1%}, false refusals "
        f"{first.false_refusals}/{first.benign}; current run {held.refused}/{held.must_refuse} = "
        f"{held.recall:.1%}, false refusals {held.false_refusals}/{held.benign}"
    )
