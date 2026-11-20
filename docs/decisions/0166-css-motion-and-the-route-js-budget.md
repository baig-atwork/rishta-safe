# 0166: CSS motion instead of Motion, and the route JS budget (three form routes still over)

Status: accepted (2026-11-20). Lane D (frontend). Departs from frontend-discipline rule 11 (Motion with `useReducedMotion`) on evidence.

## Context

The budget is route JS at most 170 KB gzip. Measured on the production build with `scripts/measure-budget.mjs` (all script responses for one page load, unthrottled local server): the framework alone (react-dom 62.6 KB plus the Next runtime 65.5 KB) is about 128 KB; the landing page with the shell was 161 KB. Motion (`LazyMotion` plus `m`) added about 34 KB gzip on every route that used it (how it works, couple home, sharing); zod classic about 25 to 30 KB, react-hook-form 13 KB, the resolver 4 KB, TanStack Query about 12 KB and `@base-ui/react` Dialog about 30 KB added to the form routes.

## Decision

1. Drop Motion for this product: the tracker's one-time line draw, the consent row settle and the verify-chain tick are CSS keyframes; a global `prefers-reduced-motion` rule neutralises them and the stagger timer is skipped under reduced motion (`src/lib/motion.ts`). The accessibility outcome of rule 11 (no motion for people who ask for none) is kept; the library is not.
2. Replace the Base UI Dialog with the native `<dialog>` and `showModal()` (focus trap, Escape and inert background come free; focus returns to the trigger).
3. Move the four form schemas to `zod/mini` (about 17 KB saved) and give next-intl `precompile: true` (about 5.5 KB saved on every route).

## Result

After the changes every route is at or under 170 KB gzip except the three form routes: sharing about 188 KB, closure about 182 KB, clinician about 184 KB (identical in en, ar and ur). LCP and CLS are far inside budget on the local production server (LCP under 150 ms, CLS 0) but that is an unthrottled local measure, not Lighthouse on a mobile profile. The remaining excess is react-hook-form, `zod/mini`, the resolver and TanStack Query, all of which the form screens use.

## Consequences and next steps

Not fixed in phase 1: lazy-loading the validation libraries on first field focus (about 12 KB), replacing TanStack Query on form pages with a small transition-based hook (about 12 KB) and dropping react-hook-form for these forms. Any one of them brings closure and clinician to about 170; sharing needs two. Parked in `docs/parking-lot.md`. `motion` and `@base-ui/react` are no longer imported and are removed from `package.json`.
