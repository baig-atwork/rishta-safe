"""Rishta Safe governance: demo auth, consent ledger, disclosure policies, audit chain, refusals, escalation.

See `README.md` in this package for what is built, what is simulated and the known limits.
"""

from bayan.governance.service import GovernanceService, build_governance_service

__all__ = ["GovernanceService", "build_governance_service"]
