# Rishta Safe frontend

Next.js 16 (App Router) couple-result companion for the UAE premarital genetic screening pathway, in English, Arabic and Urdu (the last two right to left). **Synthetic data, not a medical device, education and decision support only.** Nothing is deployed anywhere; this runs locally.

Contract and hard rules: `../docs/spec/00-architecture-and-scope.md`. Visual direction and tokens: **Registry Grid**, `../docs/design/v2/` (`01-direction.md`, `DESIGN.md`, `tokens.css`; ADR 0007). The UX model and per-screen spec: `../docs/design/v2/02-ux-concept.md`. The first build's direction (`../docs/design/DESIGN.md`) is superseded. Decisions: ADRs 0160 to 0167 (stack, fonts, adapter) and 0007, 0168 to 0179 (the redesign) in `../docs/decisions/`.

## Stack

Next.js 16 (webpack build), React 19, TypeScript 6 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), Tailwind CSS 4, next-intl 4, TanStack Query 5, react-hook-form with zod on the form screens, lucide-react icons, ESLint 9 with strict `jsx-a11y`. Tests: Vitest 5 with Testing Library, Playwright with `@axe-core/playwright`. Node 24 or later; pnpm 11. No animation library: motion is CSS only (ADR 0166). Fonts are self-hosted in `public/fonts` under the SIL Open Font Licence and listed in `../THIRD_PARTY_NOTICES.md`: Archivo (Latin), Red Hat Mono (identifiers, figures), Noto Kufi Arabic (Arabic interface), Noto Naskh Arabic (Arabic reading text), Noto Nastaliq Urdu (Urdu reading text).

## Run

```powershell
pnpm install --frozen-lockfile
cp .env.example .env.local        # BAYAN_MOCK=1 serves recorded fixtures; no backend needed
pnpm dev                           # webpack dev server (Turbopack dev leaks memory on this laptop)
pnpm build; pnpm start             # production build (output: 'standalone')
```

**Mock mode** (`BAYAN_MOCK=1`, or `NEXT_PUBLIC_BAYAN_MOCK=1`): the server answers from typed fixtures, so the whole app works without the backend. It is read at run time on the server, so a built image can switch without a rebuild. Fixture mode must not be enabled in a deployed image.

**Real mode:** unset `BAYAN_MOCK`, set `BAYAN_API_URL` (default `http://localhost:8000`) and start the backend (`cd ../backend; uv run python -m uvicorn "bayan.api.app:create_app" --factory --port 8000`). `BAYAN_API_TIMEOUT_MS` sets the upstream timeout.

**Separate build folders:** `BAYAN_DIST_DIR` sets Next's `distDir` (default `.next`, which the Dockerfile expects). Set it before both `pnpm build` and `pnpm start` to build and serve from another folder, for example when two builds or a test run must not overwrite each other.

First visit: open `/en/demo` (the case bench) and press "Open the flagship case".

## Scripts

| Script | What |
|---|---|
| `dev`, `build`, `start` | Next.js (webpack) |
| `lint` | ESLint 9 with `eslint-config-next`, strict `jsx-a11y`, no `any`, no literal-px inline styles |
| `typecheck` | `tsc --noEmit` |
| `test` | Vitest: units, component tests in LTR and RTL, message-file parity and banned-word scan |
| `test:e2e` | Playwright with axe (WCAG 2 A and AA, WCAG 2.1 and 2.2 AA rules) against `pnpm start` in mock mode; run `pnpm build` first |
| `test:e2e:real` | the same specs against the real backend (`BAYAN_API_URL`, default `http://127.0.0.1:8000`; start the backend separately); personas switch to the backend's seeded ids |
| `gen:api` | `openapi-typescript ../backend/openapi.json -o src/lib/api/schema.d.ts` |
| `node scripts/measure-budget.mjs` | route JS (gzip), LCP and CLS per page against the budgets (server running, `BASE_URL`) |
| `node scripts/chunk-report.mjs` | which chunks one page loads and which libraries they contain |
| `node scripts/capture-real-fixtures.mjs` | re-records the API fixtures the landing page and the mock use, from a running backend |
| `shots` | screenshots at 390, 768 and 1440 px in en and ar into `../docs/design/shots/` (server running with `BAYAN_MOCK=1`) |
| `design:lint` | `@google/design.md lint` on `../docs/design/DESIGN.md` (the superseded file; the current spec is `../docs/design/v2/DESIGN.md`) |

Numbers on 2026-11-20 (local machine): typecheck and lint clean; 417 Vitest tests passed, 11 live tests skipped unless a backend is named (`BAYAN_LIVE_URL=http://127.0.0.1:8000 pnpm test` runs them); `pnpm test:e2e` in mock mode 62 passed, 3 skipped; `pnpm test:e2e:real` against the local backend 63 passed, 2 skipped. The axe checks run on the routes the end-to-end suite visits. That is an automated check, not an accessibility audit.

## Layout

```
src/app/[locale]/        routes: landing, how-it-works, governance, demo (case bench), judge (Evidence), programme, clinician,
                         couple/ (home, result, sharing, teach-back, closure), staff, staff/couples/[id]
src/app/api/v1/[...path] proxy to BAYAN_API_URL (explicit timeout, problem-details pass-through) or the mock
src/lib/api/             types.ts (UI shapes), endpoints.ts (the one adapter), transport.ts, server.ts, client.ts, upstream.ts,
                         real/ (anti-corruption layer to the real backend, ADR 0167; __fixtures__ are recorded responses),
                         mock/ (fixtures and handler), schema.d.ts (generated)
src/lib/                 pure logic with tests: couple-threshold, couple-pairing (read together), couple-matrix, couple-audit,
                         public-probes (Evidence), public-bench, public-landing, staff-brief, result-layers, icon-array
src/components/          grid (the tally grid cells), shell (header, Lens control, honesty rail, locale switch), landing, demo (case bench),
                         result (threshold, read together), consent (visibility matrix, audit), evidence (probe console, evidence cells),
                         staff (instrument: queue, brief, trace, proforma), haem, pathway, programme, closure, governance, ui (four states)
src/messages/{en,ar,ur}/ message files by area (core, marketing, result, consent, closure, clinical, oversight)
public/fonts/            self-hosted WOFF2 (SIL OFL), see ADR 0160
e2e/                     Playwright specs
```

## Rules this code enforces

- Every user-visible string goes through `t()`; Arabic and Urdu are machine drafts and carry the draft stamp. A test asserts the three key sets are identical and no banned word appears.
- Result and clinical wording comes from the API response; components only lay it out. The closed vocabulary is `shared_result_found`, `no_shared_change_found`, `more_information_needed`. The evidence figures and the staff brief's rule text exist only in English and are marked so on the Arabic and Urdu pages (ADR 0169).
- No marriage-decision field, no score, no residual-risk figure. The 100-cell tally grid refuses to draw when the numbers do not sum to the total.
- The threshold: the result is not fetched or rendered before the person chooses; nothing is preselected; only "I prefer not to know" is written to the server (`PUT` and `DELETE /v1/couples/{id}/right-not-to-know`); the other choices stay in the browser (ADR 0170).
- Colour is never the only channel: the tally grid, the category chip and every matrix cell carry a fill or glyph and text as well as colour.
- Tokens only: no hex in JSX, CSS variables in `src/app/globals.css`, dark mode by `data-theme` and `prefers-color-scheme`.
- Logical CSS properties only; Latin codes, hashes and ids are isolated (`.ltr-run`, `<bdi>`) inside RTL text; Arabic and Urdu text never takes letter-spacing or uppercase (ADR 0168).

## Real backend

Every server hop goes through `callBackend()`; in real mode `src/lib/api/real/adapter.ts` translates requests and responses between the backend contract (`schema.d.ts`, regenerate with `pnpm gen:api`) and the UI types, and marks every place the real data cannot fill a UI field with `// GAP:` (`grep -rn "GAP:" src/lib/api/real`). Quick check: `node scripts/real-smoke.mjs`.

## Performance (production build, local server, unthrottled; `node scripts/measure-budget.mjs`, mock mode)

Route JS (gzip, all scripts of one page load) against a 170 KB budget: landing 161.3, how-it-works 161.5, governance 161.5, demo 161.5, programme 161.5, couple home 163.7, judge 165.3, staff 168.6, teach-back 167.7 and result 169.0 KB are under it. **Three routes are over it:** sharing 173.8, closure 188.3 and clinician 190.7 KB. Closure and clinician were already over before the redesign because of react-hook-form and zod (ADR 0166); lazy-loading the form libraries is parked in `../docs/parking-lot.md`. Largest Contentful Paint under 0.4 s and layout shift under 0.012 on the local build. This is not a Lighthouse mobile profile.
