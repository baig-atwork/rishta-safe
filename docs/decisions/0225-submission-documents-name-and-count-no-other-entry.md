# ADR 0225: The submission documents name and count no other entry, and the audit-verify video fallback is retired

- **Status:** Accepted (supersedes the one-name and one-count allowance in ADR 0224; narrows ADR 0204's wording)
- **Date:** 2026-11-20
- **Deciders:** the documentation-sync lane, under the controller's instruction after the interface rebuild (ADR 0007, 0169)

## Context
ADR 0224 kept the submission drafts anonymous but let them name one laboratory-value tool and state a count of entries that use private set intersection, following ADR 0204. ADR 0007 records that the first interface was checked against other entries and read as a copy, and ADR 0169 removed every name and count of other entries from the product itself because a reader cannot verify them and a ranking of other entrants reads as a comparison. The submission documents are copied into the submission form, a video script and a deck, so the same reasoning applies to them. Separately, ADR 0222 marked the audit-verification beat of the video for a screen check because the real backend refused a couple member; the router now answers a couple member with a reduced result (`ok` and the count of their own couple's events), and the redesigned sharing page and audit tape use it.

## Decision
1. No submission document (technical report, form text, deck outline, video script, judging map, checklist, commercial and pilot plan, open risks, the declaration package) names another entry, tool or repository, or states a count of them. "Public tools already interpret laboratory values" and "we cut private set intersection (ADR 0004)" are the allowed forms, as `declarations/prior_art.md` already words them. The technical report's section 2 sentence that named a tool and counted entries was replaced accordingly.
2. The video script no longer carries the `[confirm screen]` audit-verification fallback. It shows the audit row that a sharing change writes. The checklist asks the owner to confirm on screen that **Verify chain** works for a couple member.

## Consequences
A reviewer who wants no comparison gets none; a reader of ADR 0004 and `declarations/prior_art.md` still finds the reasoning for the cuts. The earlier ADRs stay as written and are marked by this record.

## Revisit trigger
The owner decides to name a collaborator or a comparison, or the backend narrows the audit-verify roles again.
