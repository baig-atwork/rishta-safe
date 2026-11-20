# 0170: The threshold preselects nothing, and the result is not fetched, not just not shown, before a choice

Status: accepted (2026-11-20). Lane B (frontend v2).

## Context

02-ux-concept 4.1 requires that the result DOM is not rendered before a choice, and the comp `threshold.html` shows "Read it now" preselected. The result page was a server component that fetched the whole document.

## Decision

1. The server page reads the result only to branch (`entryState`: declared, withheld by the server, or threshold) and passes metadata, never text, to the client island `ResultExperience`. The result text is fetched by `ReadTogether` (TanStack queries) only after the person chooses. Before a choice the text is neither in the DOM nor in the RSC payload (a server-rendered child would have shipped it in the page payload even while unrendered).
2. No option is preselected and Continue without a choice says "Choose one option to continue". A default of "Read it now" is a nudge on a decision about not knowing something about your own genome; the comp's selected state was a drawing convenience. Departs from the comp on purpose.
3. Storage as specified, with injected stores so the logic is unit-tested: localStorage per lens and couple for now and counsellor, sessionStorage for not yet, the server for the right not to know; every storage call in try/catch. `?enter=now` skips the choice for one visit and stores nothing.

## Consequences

One extra client round trip after "Read it now" (a skeleton that mirrors the first fold covers it). The withheld views stay server-rendered because the server decided to withhold them.
