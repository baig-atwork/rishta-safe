"""Judge-facing routes: the evaluation scoreboard and the governance declarations.

    GET /v1/eval/scoreboard               the committed scoreboard artefact (judge, staff, programme)
    GET /v1/governance/declarations       index of the declaration documents (public: no personal data)
    GET /v1/governance/declarations/{id}  one declaration document as Markdown

The declarations are static files shipped with the API (data declaration, limitations, regulatory
posture, prior art, open risks). They describe the prototype and contain no personal data.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends

from bayan.core.contracts import Frozen
from bayan.core.errors import NotFound
from bayan.core.types import Principal, Role
from bayan.evalkit.models import Scoreboard
from bayan.governance.deps import require_roles

router = APIRouter(prefix="/v1", tags=["judge"])

DATA = Path(__file__).resolve().parent.parent.parent / "data"
Reader = Annotated[
    Principal, Depends(require_roles(Role.JUDGE, Role.COUNSELLOR, Role.CLINICIAN, Role.PROGRAMME))
]


class DeclarationEntry(Frozen):
    id: str
    title: str
    file: str
    summary: str


class DeclarationDoc(Frozen):
    id: str
    title: str
    markdown: str


@lru_cache
def _scoreboard() -> Scoreboard:
    path = DATA / "scoreboard.json"
    if not path.exists():
        raise NotFound("The scoreboard has not been generated yet.", reason="scoreboard_missing")
    return Scoreboard.model_validate_json(path.read_text(encoding="utf-8"))


@lru_cache
def _index() -> tuple[DeclarationEntry, ...]:
    raw = json.loads((DATA / "declarations" / "index.json").read_text(encoding="utf-8"))
    return tuple(DeclarationEntry.model_validate(e) for e in raw)


@router.get("/eval/scoreboard", response_model=Scoreboard)
def scoreboard(principal: Reader) -> Scoreboard:
    del principal
    return _scoreboard()


@router.get("/governance/declarations", response_model=tuple[DeclarationEntry, ...])
def declarations() -> tuple[DeclarationEntry, ...]:
    return _index()


@router.get("/governance/declarations/{doc_id}", response_model=DeclarationDoc)
def declaration(doc_id: str) -> DeclarationDoc:
    for entry in _index():
        if entry.id == doc_id:
            text = (DATA / "declarations" / entry.file).read_text(encoding="utf-8")
            return DeclarationDoc(id=entry.id, title=entry.title, markdown=text)
    raise NotFound("No such declaration.", reason="declaration_missing")
