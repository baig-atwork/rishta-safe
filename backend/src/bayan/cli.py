"""Command line entry point: `bayan serve`."""

from __future__ import annotations

import sys


def main() -> None:
    import uvicorn

    host = "0.0.0.0" if "--public" in sys.argv else "127.0.0.1"  # noqa: S104
    uvicorn.run("bayan.api.app:create_app", factory=True, host=host, port=8000, reload=False)
