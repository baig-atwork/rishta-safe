# 0172: The visibility matrix: one column of switches, four columns of law, the ledger kept behind a disclosure

Status: accepted (2026-11-20). Lane B (frontend v2).

## Decision

1. Rows are the three consent scopes; the partner column is the viewer's own switches (`role="switch"`, same grant and revoke calls as the ledger, purpose `partner_disclosure`); care team, national database, employer and insurer are fixed cells with a glyph, text and a "fixed" label and no focusable control. The care-team cell cites the couple's emirate rule (`consent_policies.yaml`: assigned staff see the staff view; the emirate policy sets the gate), not a wording we invented.
2. The ledger table and the grant form sit in `<details>` "Consent ledger (table)" so purpose and expiry stay reachable. The panel is loaded only when the disclosure opens, which keeps the form libraries out of the first load of the sharing route.
3. The `basis_note` of the consents response is not exposed by the adapter, so the matrix intro states the Art. 4(2)(a) and 15 point from a message string.
4. The right-not-to-know status line reads the server's state from the result read (no GET endpoint exists) and uses PUT and DELETE through new additive client functions.

## Consequences

The mock handler gained the PUT and DELETE routes and per-person state so the flow is testable end to end in fixture mode.
