# 0165: Frontend cuts and deferrals in the 80-minute phase 1

Status: accepted (2026-11-20). Lane D (frontend). Each item is also one line in `docs/parking-lot.md`.

## Context

Phase 1 is time-boxed to about 80 minutes. The standing frontend rules ask for more than fits. Cutting is allowed only with a record.

## Decisions

1. **Storybook 9 portable stories and Chromatic are deferred.** Component states are covered by Vitest component tests (LTR and RTL) and Playwright screenshots (`pnpm shots`) instead. Revisit when a second frontend developer joins.
2. **Zustand and nuqs are not installed.** There is no global client state (the session is a server-held cookie, the theme is a `data-theme` attribute plus `localStorage`), and no URL-synchronised filter or tab state exists yet. Adding either now would be dead weight in the bundle.
3. **A strict Content-Security-Policy is deferred.** The theme bootstrap is one inline constant script; a nonce-based CSP needs a middleware pass. Baseline security headers (nosniff, frame deny, referrer, permissions policy) are set in `next.config.ts`.
4. **Lighthouse CI is not wired into CI by this lane.** Budgets (route JS 170 KB gzip, LCP 2.5 s, CLS 0.1) were measured locally and reported; the CI lane can add `lhci` against `pnpm start`.
5. **Metric-matched fallback `@font-face` overrides are not generated** (see ADR 0160); CLS is measured instead.
6. **Voice entry, marriage-decision field, residual-risk figure** are cut by hard rule 6 and the controller's spec, not by this lane; the UI has no place for them and a test asserts the closure form has no marriage question.
7. **`openapi-fetch` is not used and was removed from `package.json`.** The adapter has its own two-transport layer (ADR 0162) that already passes RFC 9457 bodies through; the generated `src/lib/api/schema.d.ts` (`pnpm gen:api`) types the real-API side of the anti-corruption layer in `src/lib/api/real/`, which is where `openapi-typescript` earns its place.

## Consequences

The deliverables the brief marks as required (pages, four states, tests, axe, screenshots) are met; the deferrals above are visible and revisitable.
