"""Write the OpenAPI document the frontend generates its types from.

Run: `uv run python scripts/export_openapi.py`
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from bayan.api.app import create_app
from bayan.core.config import Settings


def main() -> None:
    app = create_app(Settings(env="dev", demo_mode=True))
    spec = app.openapi()
    out = Path(__file__).resolve().parent.parent / "openapi.json"
    out.write_text(json.dumps(spec, indent=2, sort_keys=True), encoding="utf-8")
    sys.stdout.write(f"wrote {out} ({len(spec['paths'])} paths)\n")


if __name__ == "__main__":
    main()
