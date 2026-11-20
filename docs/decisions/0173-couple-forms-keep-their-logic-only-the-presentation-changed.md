# 0173: Teach-back shows one question per view and closure becomes a ruled form; logic and API calls are unchanged

Status: accepted (2026-11-20). Lane B (frontend v2).

## Decision

Teach-back shows one question at a time with a cell progress row and a result row of cells (solid matches, dashed open differs or not answered); answers are still submitted together in one call, and there is still no score, mark or percentage. The closure form drops its boxed panels for hairline-ruled sections; its schema, items and submit are untouched. The pathway tracker is redrawn as `PathwayCells` (`PathwayTracker` stays as a re-export so other lanes still compile).

## Consequences

The TeachBack tests were adapted to step through the questions; every behavioural assertion is kept.
