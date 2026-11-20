"""Governance test session setup: print the exact property-run counts at the end of the run."""

from __future__ import annotations

import pytest
from gov_helpers import EVAL_REPORT, PROPERTY_COUNTS


def pytest_terminal_summary(terminalreporter: pytest.TerminalReporter) -> None:
    if PROPERTY_COUNTS["sequences"]:
        terminalreporter.section("governance property-run counts (exact)")
        for key, value in PROPERTY_COUNTS.items():
            terminalreporter.write_line(f"  {key}: {value}")
    if EVAL_REPORT:
        terminalreporter.section(
            "governance evaluation numbers (synthetic sets, see ADRs 0126 and 0127)"
        )
        for key, text in EVAL_REPORT.items():
            terminalreporter.write_line(f"  {key}: {text}")
