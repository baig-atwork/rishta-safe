# 0175: The landing's product sheet and evidence come from recorded API responses, labelled as such

Status: accepted (2026-11-20). Lane C (v2 frontend).

## Context

The landing is the first thing a judge sees. A live call would make it depend on the backend being up and would add a failure path to the page that must never fail. The wording on the sheet must still be the API's, not typed by hand.

## Decision

The sheet reads committed recordings of `GET /v1/couples/cpl-demo-02/result?locale=en|ar|ur` (as the first-partner persona), the full `GET /v1/eval/scoreboard`, and `GET /v1/escalations`, all captured from the real backend on 2026-11-20 into `src/lib/api/real/__fixtures__/` (`result_02a_ar.json`, `result_02a_ur.json`, `scoreboard_full.json` are new). The page is a server component with no client JavaScript for the hero, and the sheet carries "From a recorded response" and the endpoints it was recorded from. For a visitor with no lens the Evidence page shows the same recorded scoreboard (the live endpoint needs a lens), labelled the same way, so the link from the landing is never a dead end.

## Consequences

The recordings can drift from the backend; they are re-captured with the existing capture script. The landing's route JS is 161.1 KB gzip, with a 100-cell tally server-rendered.
