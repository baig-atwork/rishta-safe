"""Regenerate the judge scoreboard artefact: `uv run python scripts/run_evaluation.py`."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from bayan.evalkit.runner import build_scoreboard


def _commit() -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],  # noqa: S607
            capture_output=True,
            text=True,
            check=True,
            cwd=Path(__file__).parent,
        )
        return out.stdout.strip() or "dev"
    except (OSError, subprocess.CalledProcessError):
        return "dev"


def main() -> None:
    board = build_scoreboard(code_version=_commit())
    target = Path(__file__).resolve().parent.parent / "src" / "bayan" / "data" / "scoreboard.json"
    target.write_text(board.model_dump_json(indent=2), encoding="utf-8")
    sys.stdout.write(f"wrote {target} ({len(board.metrics)} metrics)\n")


if __name__ == "__main__":
    main()
