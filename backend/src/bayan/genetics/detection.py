"""Detection statements: what a panel can and cannot rule out.

The product shows the detection rate and its limits. It never shows a residual-risk number (spec rule 6; ACMG 2021, as
reported in research report 03 section 2.5, recommends giving the detection rate rather than a multiplex residual
estimate). For related partners a negative result reassures less than the independent-partner arithmetic suggests,
because a change the panel misses is missed in both partners when it is shared by descent (research report 03
section 2.3). The statements therefore set `related_couple_caveat`.

Every rate here is ASSUMED and illustrative (see `data/panels.yaml`); the explainer renders the text from the
`statement_key` templates, and `detection_rate_label` is only a fallback.
"""

from __future__ import annotations

from bayan.core.contracts import DetectionStatement
from bayan.core.types import Relationship
from bayan.genetics.models import PanelInfo

KEY_PANEL_RATE = "detection.panel_rate_assumed"
KEY_ALPHA_LOCUS = "detection.alpha_globin_locus_limit"
KEY_RELATED_MISSES = "detection.related_couple_shared_misses"

_ALPHA_CONDITIONS = ("alpha_thalassaemia_alpha0", "hb_h_disease")


def rate_label(rate: float) -> str:
    """Plain natural-frequency wording for a detection rate (fixed 10 or 100 denominator)."""
    tenths = rate * 10
    if abs(tenths - round(tenths)) < 1e-9 and 0 < round(tenths) < 10:
        return f"about {round(tenths)} in 10"
    return f"about {round(rate * 100)} in 100"


def is_related(relationship: Relationship) -> bool:
    return relationship is not Relationship.UNRELATED


def build_detection_statements(
    panel: PanelInfo, relationship: Relationship
) -> tuple[DetectionStatement, ...]:
    related = is_related(relationship)
    statements = [
        DetectionStatement(
            panel_id=panel.id,
            statement_key=KEY_PANEL_RATE,
            detection_rate_label=(
                f"{rate_label(panel.assumed_detection_rate)} of the known changes in these genes "
                "(assumed and illustrative, not a measured rate; see limits)"
            ),
            assumed=panel.assumed,
            related_couple_caveat=related,
        )
    ]
    alpha_rates = [panel.detection_for(c) for c in _ALPHA_CONDITIONS if c in panel.condition_ids]
    if alpha_rates:
        statements.append(
            DetectionStatement(
                panel_id=panel.id,
                statement_key=KEY_ALPHA_LOCUS,
                detection_rate_label=(
                    f"{rate_label(min(alpha_rates))} for the alpha-globin genes "
                    "(assumed and illustrative; this locus is technically complex to assess)"
                ),
                assumed=panel.assumed,
                related_couple_caveat=related,
            )
        )
    if related:
        statements.append(
            DetectionStatement(
                panel_id=panel.id,
                statement_key=KEY_RELATED_MISSES,
                detection_rate_label=(
                    f"{rate_label(panel.assumed_detection_rate)} (assumed); because the partners are related, "
                    "a change this test misses is likely to be missed in both of them"
                ),
                assumed=panel.assumed,
                related_couple_caveat=True,
            )
        )
    return tuple(statements)
