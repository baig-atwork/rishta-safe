# 0178: The staff instrument is one pane layout, and the selected case lives in the URL

Status: accepted (2026-11-20). Lane D (frontend v2).

## Context

The v2 spec (02 section 4.6) makes `/staff` and `/staff/couples/[id]` one three-pane instrument: queue, brief, trace. The old pages were two separate documents (a table, then a long brief page). Two options for "the case is selected": keep selection as client state and fetch the brief in the browser, or keep each case at its own URL and render the same server tree around it.

## Decision

1. Both routes render one server component, `StaffInstrument`, with `selectedId` null or the couple id. Opening a case is a route change (`/staff/couples/<id>`), so the brief is a server read (GET only; the backend guarantees a brief read writes nothing), the URL is shareable and Back works. `QueuePane` is the only client piece in the queue: it handles J, K and Enter, and `aria-selected` shows the cursor row.
2. Each pane has its own four states. A failed brief leaves the queue usable and vice versa; the loading skeleton mirrors the three panes.
3. Every brief line carries a `TraceChip` to an entry in the trace pane. The mapping uses only API structure (a "why" line starts with its rule id; a "result" line names its condition id; sections map to the consent and pathway entries), never wording. `src/lib/staff-brief.ts` builds it and a test asserts every line resolves.
4. Verb buttons fire only existing pathway events and only those the pathway offers this role (`counselling_booked`, `counselling_completed`). There is no hold or decline verb: no existing event is a staff-side hold, and `counselling_declined` is the couple's choice.
5. J, K and Enter use one document-level handler instead of a focusable container: a role-less region with `tabIndex` and a key handler fails the a11y lint rules, and a handler that ignores fields, dialogs and modified keys behaves like the shortcuts people know from triage tools.

## Consequences

The brief locale switch is a query parameter (`?briefLang=`), so reading the brief in the other partner's language is also a plain navigation. The brief types gained optional, additive fields (`members`, `sections`, tier and review flags on escalations) because the real brief returns them and the adapter used to drop them. The teach-back status line of the spec's "Open" section is not shown: the brief endpoint does not carry it and staff cannot read the quiz result.
