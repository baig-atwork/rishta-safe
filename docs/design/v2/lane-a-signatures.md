# Lane A signatures (foundation and shell), as built 2026-11-20

State described: the working tree of branch `v2-registry-grid` after Lane A. Lanes B, C and D import from here and never edit these files. If you need a change, use a local wrapper and say so in your report.

## Components

### `components/grid/Cell.tsx`
```ts
export type CellFill = "solid" | "hatch" | "open";
export type CellTone = "ink" | "accent" | "shared" | "none" | "info";
export interface CellProps {
  fill: CellFill;
  dashed?: boolean | undefined;   // dashed edge = pending / not yet
  tone?: CellTone | undefined;    // omitted: the cell takes the surrounding text colour (works on dark surfaces)
  size?: number | undefined;      // px edge; default is var(--cell-size) = 14
  label?: string | undefined;     // sr-only text (role="img"); without it the cell is aria-hidden
}
export function Cell(props: CellProps): JSX.Element   // <span class="cell" data-fill data-dashed data-tone>
```
Colour comes from `color`/`currentColor`. On a dark surface set `--cell-edge` (open-cell edge, default `--fg-3`) to a light token if the open edge falls under 3:1. The hatch is the only gradient in the app and is defined once, in `globals.css` (`.cell[data-fill="hatch"]`). Size 10 px or less automatically uses a finer hatch.

### `components/grid/CellGrid.tsx`
```ts
export interface CellSpec { fill: CellFill; dashed?: boolean; tone?: CellTone }
export interface CellGridProps {
  cells: readonly CellSpec[];
  columns: number;
  size?: number; gap?: number;       // px, default tokens
  labelledBy?: string;               // id of the describing element (preferred)
  label?: string;                    // else a text alternative (one of the two is required)
  testId?: string;
}
export function CellGrid(props: CellGridProps): JSX.Element  // role="img": static, non-interactive
```
Fills from the reading start, so RTL is correct without mirroring. For an interactive grid (switch matrix, bench) build a real `<table>` and use `<Cell>` inside the cells; do not put controls inside `CellGrid`.

### `components/grid/TallyGrid.tsx` (replaces `result/IconArray.tsx`)
```ts
export interface TallyLegend { affected: string; carrier: string; neither: string }  // labels from messages
export interface TallyGridProps {
  spec: IconArraySpec;       // from the API block; counts in the legend come from here
  captionId: string;         // id of the element with the API caption; the grid is aria-labelledby it
  legend: TallyLegend;
  size?: number;             // default 15
  invalidLabel?: string;     // shown as role="alert" if the parts do not add up (never repaired silently)
}
export function TallyGrid(props: TallyGridProps): JSX.Element  // data-testid="tally-grid"; 100 cells data-fill solid|hatch|open
```
Solid = affected, hatch = carrier, open = neither. It does not render the caption: you render the API sentence yourself with `id={captionId}` (visible, in both languages for Read Together). It uses `lib/icon-array.ts` (`buildIconArray`, `iconColumns`).

### `components/result/CategoryChip.tsx`
```ts
export interface CategoryChipProps {
  category: ResultCategory;   // shared_result_found | no_shared_change_found | more_information_needed
  label?: string;             // default: t("result.category.<category>") (closed vocabulary, message catalogue)
  size?: "sm" | "md";         // 24 or 28 px
}
export function CategoryChip(props): JSX.Element  // <span class="chip" data-cat data-size>
```
Glyph: shared = hatched pair, none = open pair, more information = open + dashed. There is no chip for the withheld branches (right not to know, counselling first, awaiting partner): those are not categories, render the API's withheld document. The chip reads `result.category.*` in `result.json` (Lane B's file): keep those three keys, or pass `label`.

### `components/shell/HonestyRail.tsx` (replaces `StatusStamps`)
`export function HonestyRail(): JSX.Element` (no props, server component, rendered by the layout on every route). 28 px. `<ul aria-label>` of `li.stamp` items: Synthetic data, Arabic and Urdu: draft translations, Clinical rules pending sign-off, Not clinical advice, plus "Fixture mode" only in mock mode; then a "Limits" link to `/governance#limits`. Below 760 px only Synthetic data, Not clinical advice and Limits show. Keys: `shell.rail.*`. The old `status.*` namespace is gone.

### `components/shell/LensControl.tsx` (replaces `PersonaSwitcher`)
```ts
export interface LensPersona { id: string; displayName: string; coupleId: string | null }
export interface LensOption { id: string; displayName: string; role: Role; coupleId: string | null }
export interface LensControlProps {
  persona?: LensPersona | null;
  options?: LensOption[];     // fallback list inside the dialog while there is no slot content
  children?: ReactNode;       // SLOT: Lane C's compact CaseBench
}
```
A button (`data-testid="lens-control"`, accessible name "Lens: {display_name} {couple_id}", "Lens: none" when signed out) opens a native modal `<dialog>` titled "Choose a case and a lens". The body renders only while open. It holds the slot (or the fallback list) and, when signed in, "Leave this lens". Sessions use the existing `startSession(personaId, locale)` and `endSession(locale)` server actions (httpOnly cookie, redirect to the role home). The dialog closes when the route or the lens changes.

**Contract for Lane C's compact CaseBench:** put `data-lens-persona={persona.id}` on every element that starts a session (the lens cells). `e2e/helpers.ts` `signInViaLens` and the lens e2e tests click `[data-lens-persona="<id>"]` inside the dialog. A cell that links to a route under a lens must call `startSession` (it redirects to the role home), as the demo page does today.

**Wiring (controller, one edit):** `app/[locale]/layout.tsx` renders `<SiteHeader ... />` without `lensSlot`. When `CaseBench` exists, pass `lensSlot={<CaseBench compact cases={...} personas={...} />}` there. Lane A did not do it because the layout is Lane A's file and CaseBench does not exist yet.

### `components/shell/LocaleSwitch.tsx` (replaces `LocaleSwitcher.tsx`)
`export function LocaleSwitch(): JSX.Element`. Segmented EN | عربي | اردو, current one inverted (`aria-current="true"`), each link keeps the path and has its own `lang`. Accessible names: "EN English", "العربية", "اردو" (the name must start with the visible text, or axe `label-content-name-mismatch` fails).

### `components/shell/SiteHeader.tsx`
```ts
export function navItemsFor(role: Role | null): NavItem[]   // at most 5, per role
export interface SiteHeaderProps {
  role: Role | null; persona: LensPersona | null; personaOptions: LensOption[]; lensSlot?: ReactNode;
}
export function SiteHeader(props: SiteHeaderProps): JSX.Element
```
52 px one row: wordmark (three cells solid, hatch, open + Rishta Safe + بيان), role nav, LensControl, LocaleSwitch, theme toggle. Under 1024 px the nav and the theme toggle move into one menu button (`HeaderMenu`, a disclosure, Escape closes). Nav sets: public = How it works, Governance, Evidence, Case bench; couple = Home, Result, Who sees what, Practice, After counselling; counsellor = Queue, Case bench, Governance, How it works; clinician = Queue, Haematology aid, Case bench, Governance; programme = Programme, Evidence, Case bench, Governance; judge = Evidence, Case bench, Governance. Nav keys are `shell.nav.*` (new: `evidence result sharing practice closure queue haem programme`; changed values: `demo` = "Case bench", `home` = "Home", `governance` = "Governance").

### `components/shell/SiteFooter.tsx`
`export function SiteFooter(): JSX.Element`. One compact block (what it is, simulation notice, three links). Unchanged keys `shell.footer.*`.

### `components/shell/MainNav.tsx`, `HeaderMenu.tsx`, `ThemeToggle.tsx`
Internal to the header. `ThemeToggle` gained `showLabel?: boolean` (default true).

### `components/consent/AuditTape.tsx`
`export function AuditTape({ coupleId }: { coupleId: string }): JSX.Element | null`. Rendered by the layout for a `couple_member` session with a couple id; returns null off `/couple/**`. 36 px, sticky to the bottom. Reads `["audit", coupleId]` (`clientApi.audit`, the same key as `AuditTrail` and `SharingPanel`, so their `invalidateQueries(["audit", coupleId])` refreshes the tape) and `["audit-verify", coupleId, <event count>]` (`clientApi.verifyAudit`, re-run when the log length changes). Shows the newest two events, and "chain verified, N events" (N = `own_events` for a couple member). Failure: attention colour, "chain check failed at #{first_bad_index}". Four states: skeleton, "No events yet", "Audit unavailable" + retry, "chain not checked" when only verification failed. The one real link (to `/couple/sharing#audit`) is the chain status; a stretched `::after` makes the whole bar clickable by pointer without making a full-width target (a full-width link failed axe `target-size` against whatever scrolls under it). Lane B: give the audit table on the sharing page `id="audit"`.

### `components/ui/states.tsx`
```ts
PageHeader({ eyebrow?, title, standfirst?, children? })
EmptyState({ title, body, actionHref?, actionLabel?, secondaryHref?, secondaryLabel? })  // cell motif + CTA, never a dead end
ErrorState({ problem: ProblemDetails })     // role="alert", retry (router.refresh), correlation id
PartialNotice({ children })                 // role="status"
SkeletonBlock({ className? })
SkeletonRows({ rows? = 8 })                 // 36 px rows, for lists and tables
PageSkeleton()                              // header band + two blocks; used by loading.tsx
```
`EmptyState` no longer uses `Pedigree`. `NeedPersona` is unchanged in API. New: `states.notFound*` copy ("This page does not exist in the prototype" + links to the Case bench and the start). `[locale]/[...rest]/page.tsx` (new, calls `notFound()`) makes unknown URLs render the styled not-found page inside the shell instead of Next's bare root 404.

## Tokens and classes you can use

Tokens are CSS custom properties in `globals.css` (`:root`, `[data-theme=dark]`, system dark). Tailwind utilities from `@theme inline`: `bg-surface`, `bg-surface-raised`, `bg-surface-sunken`, `bg-surface-inverse`, `text-fg`, `text-fg-2`, `text-fg-3`, `text-fg-inverse(-2)`, `border-line`, `border-line-strong`, `bg-accent`, `text-on-accent`, `bg-accent-soft`, `text-link`, `cat-shared|none|info-fg|bg|mark`, `attention-fg|bg`, `ok-fg|bg`, `font-sans`, `font-mono`, `font-read`, `text-label|sm|base|lg|xl|display`, `rounded-xs` and `rounded-sm` (2 px), `rounded-md` (4 px), `rounded-lg` (6 px, the maximum; cells are 0), `max-w-folio` (1280).

Type stacks, set per script on any element with `lang` (so an Arabic block on an English page reads in Arabic type): `--stack-ui`, `--stack-read`, `--stack-mono`. Latin = Archivo (+ Red Hat Mono); Arabic = Noto Kufi UI, Noto Naskh prose; Urdu = Noto Naskh UI, Noto Nastaliq prose (Kufi is never used for Urdu). Archivo width via `font-stretch`: `--wdth-display` 112%, `--wdth-ui` 100%, `--wdth-dense` 88%.

Component classes (all in `@layer components`): `.wrap` (1280 container with 24/16 px padding), `.panel`, `.panel-sunken`, `.panel-attention`, `.rule`, `.dl`, `.label` (mono uppercase label; Arabic and Urdu drop caps and tracking), `.mono`, `.ltr`, `.ltr-run`, `.num`, `.read` (reading prose: Naskh/Nastaliq by `lang`), `.t-display`, `.wdth-dense`, `.cell`, `.tally`, `.legend`, `.chip`, `.stamp`, `.btn` + `.btn-primary|secondary|quiet|ghost|danger|link|sm|icon`, `.field-*`, `.input|.select|.textarea`, `.tag` + `-ok|attention|info|brand`, `.skeleton`, `.data-table`, `.tbl` (40 px instrument table; selected row = `aria-selected="true"`), `.dialog-popup` (native modal dialog; the one shadow), `.skip-link`, `.row-settle` (180 ms), `.verify-tick`. Shell classes (`.site-header`, `.rail`, `.tape`, `.lens-btn`, `.locale-seg`, `.menu-*`) belong to the shell.

`--header-h` 52, `--rail-h` 28, `--tape-h` 36. `html` has `scroll-padding` for the header, rail and tape, so focused elements are not hidden under them. The body is a flex column and `<main>` is `flex-1`, so the tape sits at the bottom of short pages.

## Aliases left for the controller to remove

Lineage Folio names kept so lanes B, C and D keep compiling and rendering until they finish. Each resolves to the closest Registry Grid token. Remove the `TEMPORARY ALIASES` block in `:root` and the matching block in `@theme inline` once `rg` finds no use.

| Old name | Now means |
|---|---|
| CSS `--border`, `--border-strong` | `--line`, `--line-strong` |
| `--ink`, `--ink-2`, `--ink-3` | `--fg`, `--fg-2`, `--fg-3` |
| `--brand`, `--brand-strong`, `--brand-soft`, `--on-brand` | `--accent`, `--accent-hover`, `--accent-soft`, `--on-accent` |
| `--cat-{shared,none,info}-line`, `--attention-line`, `--ok-line` | the category `-mark`, `--attention-fg`, `--ok-fg` |
| `--dialog-shadow`, `--stack-voice`, `--leading-body`, `--leading-heading`, `--tracking-caps` | `--shadow-dialog`, `--stack-read`, `--leading-read`, 1.2, `--tracking-label` |
| Tailwind `bg-raised`, `bg-sunken` | `surface-raised`, `surface-sunken` |
| `text-ink`, `text-ink-2`, `text-ink-3` | `text-fg`, `fg-2`, `fg-3` |
| `bg/text/border-brand`, `-brand-strong`, `-brand-soft`, `text-on-brand` | accent family |
| `text-attention`, `bg-attention-soft`, `text-ok`, `bg-ok-soft` | `attention-fg/bg`, `ok-fg/bg` |
| `text-cat-shared`, `bg-cat-shared-soft` (and none, info) | `cat-*-fg`, `cat-*-bg` |
| `font-voice`, `font-ui` | `font-read`, `font-sans` |
| `text-xs`, `text-md`, `text-2xl`, `text-3xl` | 12 px label size, 18 px, and both 28 px (`--text-xl`) |
| `ease-out-soft`, `ease-in-soft` | `ease-out`, `ease-in` |
| classes `.cat-chip`, `.cat-panel`, `.folio-rule`, `.eyebrow`, `.reading`, `.standfirst`, `.descent*` | restyled with the new tokens; replace with `CategoryChip`, `.rule`, `.label`, `.read`, `PathwayCells` |

Behaviour changes the old markup inherits: `h1` is 28 px (was 34 to 48), `text-xl` is 28 px (was 24), `.btn` is 40 px high (was 44), `border-line` is a 1.3:1 hairline (decorative), `text-display` tops out at 60 px.

## e2e and tests

- `e2e/helpers.ts`: `STAMP_COUNT` is now 4 (5 in mock mode: the extra is "Fixture mode"); new export `signInViaLens(page, locale, personaId)`; `signInAs` (demo page) and the rest are unchanged.
- Test ids: `lens-control`, `lens-dialog`, `lens-fallback`, `tally-grid`.
- Vitest: `grid/TallyGrid.test.tsx`, `result/CategoryChip.test.tsx`, `shell/shell.test.tsx`, `consent/AuditTape.test.tsx`.
- `e2e/review-fixes.spec.ts` "the persona select is wide enough for its longest label" asserts `header select`, which no longer exists by design. It is not Lane A's file: replace it with a check on the Lens button, or delete it with a note.

## New message keys (all in `core.json`, en, ar, ur; ar and ur are draft)

`shell.nav.*` (extended), `shell.menu.{label,open,close}`, `shell.lens.{label,none,dialogTitle,signOut,close,fallbackHint,enter}`, `shell.rail.{label,synthetic,draft,pending,notAdvice,limits,fixtures}`, `shell.tape.{label,region,verified,failed,notChecked,none,unavailable,retry,open}`, `states.{notFoundTitle,notFoundBody,notFoundCta,notFoundBench}`. Removed: `shell.persona`, `shell.noPersona`, `shell.homeLink`, the whole `status` namespace.
