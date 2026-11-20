"""Shared vocabulary: roles, locales, relationship degrees, principals.

Owned by the controller. Packages import from here; they do not redefine these.
"""

from __future__ import annotations

from enum import StrEnum
from typing import NewType

from pydantic import BaseModel, ConfigDict

PersonId = NewType("PersonId", str)
CoupleId = NewType("CoupleId", str)


class Locale(StrEnum):
    EN = "en"
    AR = "ar"
    UR = "ur"


class Emirate(StrEnum):
    """Which emirate's published disclosure standard a policy follows."""

    ABU_DHABI = "abu_dhabi"
    DUBAI = "dubai"


class Role(StrEnum):
    COUPLE_MEMBER = "couple_member"
    COUNSELLOR = "counsellor"  # accredited genetics professional or trained physician
    CLINICIAN = "clinician"  # reporting physician / haematology aid user
    PROGRAMME = "programme"  # programme operator (KPIs, aggregate view, no individual results)
    JUDGE = "judge"  # read-only evaluator with the scoreboard
    EXTERNAL = "external"  # employer, insurer, relative, anyone without a grant


class Relationship(StrEnum):
    """Degree of relatedness between the partners (as declared at intake)."""

    UNRELATED = "unrelated"
    SECOND_COUSIN = "second_cousin"
    FIRST_COUSIN_ONCE_REMOVED = "first_cousin_once_removed"
    FIRST_COUSIN = "first_cousin"
    DOUBLE_FIRST_COUSIN = "double_first_cousin"
    OTHER_CLOSE = "other_close"  # declared close relation not otherwise listed

    @property
    def inbreeding_coefficient(self) -> float | None:
        """F of a child of this pair (pedigree recursion), None when not computable."""
        return {
            Relationship.UNRELATED: 0.0,
            Relationship.SECOND_COUSIN: 1 / 64,
            Relationship.FIRST_COUSIN_ONCE_REMOVED: 1 / 32,
            Relationship.FIRST_COUSIN: 1 / 16,
            Relationship.DOUBLE_FIRST_COUSIN: 1 / 8,
            Relationship.OTHER_CLOSE: None,
        }[self]


class Principal(BaseModel):
    """Who is calling. Demo auth only: a signed token carries exactly this."""

    model_config = ConfigDict(frozen=True)

    role: Role
    subject_id: str  # a PersonId for couple members, a staff id otherwise
    couple_id: str | None = None  # set for couple members
    display_name: str = ""
