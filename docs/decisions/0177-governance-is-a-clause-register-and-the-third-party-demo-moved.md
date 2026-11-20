# 0177: Governance is a clause register; the third-party demo moved to Evidence

Status: accepted (2026-11-20). Lane C (v2 frontend).

## Context

The governance page was a set of prose panels with a third-party button. Judges asked "which article, where in the product, which endpoint, how do I test it" and had to infer it.

## Decision

The page leads with a table of seven clauses (article, what the law says in a few words, where in Rishta Safe, the endpoint, how to try it). Every article is one the product already cites (Art. 19 to 21, 26(2), 9(2), 4(2)(a) and 15, 25(3), D1 App. 2, and the DoH and DHA standards); the "try it" column names an Evidence probe or a scoreboard id, never a test that does not exist. The data declaration, simulated parts, limits (`#limits`, the anchor the honesty rail links to), prior art and regulatory posture stay as ruled rows. The declaration documents are listed from `GET /v1/governance/declarations`; if that read fails the page says so and carries on. `ThirdPartyDemo` was deleted; the live version is Evidence probes 1 and 2, with a link left on this page.

## Consequences

The register's wording lives in message files (product copy, not clinical text). Arabic and Urdu are draft.
