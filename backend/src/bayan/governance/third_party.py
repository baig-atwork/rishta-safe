"""Third-party requests (employer, insurer, relative, anyone without a grant) and the refusal
classifier for free-text requests.

Two separate things live here:

1. `refusal_for_third_party`: the fixed refusal text and legal citation for a request that arrives
   from someone with no grant. The service logs it and raises `Forbidden` (HTTP 403). Employers and
   insurers: Federal Decree-Law 49/2023 Art. 19 to 21 (they may not require genetic screening or
   request or use previous results). Anyone else: Art. 9(1) (each person may request their own
   results) and the person's right to refuse to share. The state is a statutory recipient
   (Art. 26(2), Art. 15) and the programme's own flow is unaffected: this is about private parties.
2. `classify_request`: a DETERMINISTIC refusal classifier for the product's refusal list (diagnosis,
   treatment, "should we marry or call it off", termination advice, lineage inference, employer and
   insurer questions, another person's result). It is keyword and pattern matching on normalised
   text. It is not language understanding, it can be evaded by paraphrase the lists do not cover,
   and it will refuse some harmless sentences that contain a listed phrase. It exists so the
   refusal is auditable and reproducible; measured numbers are in tests/governance (the adversarial
   set) and in docs/decisions/0126. Patterns of ALL locales apply to every request (people
   code-switch); the locale only picks the language of the message. Arabic and Urdu data are draft.
"""

from __future__ import annotations

from typing import Final

from bayan.core.contracts import Frozen
from bayan.core.types import Locale
from bayan.governance.policies import (
    RefusalCategory,
    compiled_refusal_patterns,
    load_policy_file,
)
from bayan.governance.text import normalize

THIRD_PARTY_KINDS: Final = ("employer", "insurer", "relative", "other")
MAX_REQUEST_CHARS: Final = 2000

# When several categories match, the message names the first of these (all are recorded).
_PRIORITY: Final[tuple[RefusalCategory, ...]] = (
    "employer_insurer",
    "lineage_inference",
    "termination_advice",
    "marriage_decision",
    "other_person_result",
    "diagnosis",
    "treatment_advice",
)

LEGAL_BASIS_EMPLOYER_INSURER: Final = (
    "Federal Decree-Law 49/2023 Art. 19 to 21: employers and insurers may not require genetic "
    "screening or request or use previous results"
)
LEGAL_BASIS_OTHER: Final = (
    "Federal Decree-Law 49/2023 Art. 9(1): each person may request their own results; results are "
    "not disclosed to others without that person's consent"
)


class RefusalDecision(Frozen):
    refuse: bool
    category: RefusalCategory | None = None
    categories: tuple[RefusalCategory, ...] = ()
    matched_rule_ids: tuple[str, ...] = ()
    escalate: bool = False
    message: str | None = None
    legal_basis: str | None = None
    locale: Locale = Locale.EN
    method: str = "keyword_and_pattern_matching_not_language_understanding"


def classify_request(text: str, locale: Locale = Locale.EN) -> RefusalDecision:
    """Refuse (and say why) when the text matches a listed pattern in any language."""
    norm = normalize(text[:MAX_REQUEST_CHARS])
    matched_ids: list[str] = []
    matched_cats: set[RefusalCategory] = set()
    for pat in compiled_refusal_patterns():
        if pat.regex.search(norm):
            matched_ids.append(pat.id)
            matched_cats.add(pat.category)
    if not matched_cats:
        return RefusalDecision(refuse=False, locale=locale)
    data = load_policy_file().refusal
    ordered = tuple(c for c in _PRIORITY if c in matched_cats)
    primary = ordered[0]
    cat_def = data.categories[primary]
    return RefusalDecision(
        refuse=True,
        category=primary,
        categories=ordered,
        matched_rule_ids=tuple(matched_ids),
        escalate=any(data.categories[c].escalate for c in ordered),
        message=cat_def.messages[locale.value],
        legal_basis=cat_def.legal_basis,
        locale=locale,
    )


def normalise_kind(kind: str) -> str:
    """Closed vocabulary for the audit log: anything unlisted becomes 'other'."""
    cleaned = kind.strip().lower()
    return cleaned if cleaned in THIRD_PARTY_KINDS else "other"


def refusal_for_third_party(kind: str) -> tuple[str, str]:
    """(detail, legal basis) for a refused third-party request."""
    if normalise_kind(kind) in ("employer", "insurer"):
        return (
            "Refused. Under Federal Decree-Law 49/2023 Art. 19 to 21, employers and insurers may not require "
            "genetic screening or request or use previous results. Nobody has to share results with an "
            "employer or an insurer, and Rishta Safe releases no result, screening status or fitness statement "
            "to them.",
            LEGAL_BASIS_EMPLOYER_INSURER,
        )
    return (
        "Refused. Each person may request their own results (Federal Decree-Law 49/2023 Art. 9(1)), results "
        "are not disclosed to anyone else without that person's consent, and each person may refuse to "
        "share. Rishta Safe releases no result, screening status or fitness statement to a requester who has "
        "no grant.",
        LEGAL_BASIS_OTHER,
    )
