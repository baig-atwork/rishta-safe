# 03. Build lanes for the v2 rollout (implementation agents)

Status: plan for the v2 branch. The controller commits; agents do not run git (no stash, reset, rebase or checkout). Every agent reads, in order:
1. `docs/design/v2/DESIGN.md`
2. `01-direction.md` §4-5
3. `02-ux-concept.md` (its own sections)
4. `tokens.css`
5. the comp HTML and the screenshots for its screens

Also read `frontend/AGENTS.md`: this Next.js has breaking changes, so read `node_modules/next/dist/docs/` before writing route code. **Conventions win. If this plan contradicts the code or a hard rule, say so in your report and do the correct thing.**

Hard rules for every lane:
- Result and clinical text comes from the API only. Use the closed vocabulary.
- No red or green on results. Give every colour a second channel.
- Western digits. Logical properties only. No hex in JSX; use tokens only.
- Provide all four states.
- No animation library. CSS motion only, with the reduced-motion branch.
- The route budget is 170 KB gzip. Check `next build` output.
- WCAG 2.2 AA. Run axe on every page you touch.
- Every new message key goes into **en, ar and ur**. `src/i18n/messages.test.ts` enforces parity. Mark ar and ur as draft.
- No em dashes in copy.
- Never name an individual.

## Order

```
Lane A (foundation) ──► then in parallel: Lane B (couple) | Lane C (public + evidence + programme) | Lane D (staff + clinician)
```

Lane A must merge first, because it owns tokens, fonts, the shell and the grid primitives everyone imports. It should be about 60 to 75 minutes of work. Lanes B, C and D can start reading and scaffolding against Lane A's component **signatures** (02-ux-concept.md §6) while Lane A runs. They must not edit Lane A's files.

## Lane A: Foundation and shell

**Owns these files (nobody else edits them):**
- `src/app/globals.css`
- `src/app/[locale]/layout.tsx`
- `src/app/[locale]/loading.tsx`, `error.tsx`, `not-found.tsx`
- `src/components/shell/*`
- `src/components/grid/*` (new)
- `src/components/ui/*`
- `src/components/result/CategoryChip.tsx` (new)
- `src/components/consent/AuditTape.tsx` (new)
- `src/lib/motion.ts`
- `public/fonts/*`
- `src/messages/{en,ar,ur}/core.json`

**Do:**
1. Copy the font files into `public/fonts/`:
   - from `docs/design/v2/prototype/fonts/`: `archivo-latin-var.woff2`, `noto-kufi-arabic-arabic-var.woff2`, `noto-kufi-arabic-latin-var.woff2`, `red-hat-mono-latin-var.woff2`;
   - keep the existing Naskh and Nastaliq files;
   - add an OFL licence file per family (text from the Google Fonts repo);
   - stop preloading Newsreader and Source Sans 3, but leave the files in place.
2. Write the `@font-face` rules with `font-stretch: 62% 125%` for Archivo, plus metric-matched fallbacks.
3. Port `tokens.css` into `globals.css`: the `:root`, the dark blocks and the `@theme inline` mapping. Delete the Lineage Folio tokens. Keep any token name that existing components use as an alias to the new semantic token until lanes B, C and D finish, then the controller removes the aliases.
4. Build these components to the 02 §6 signatures: `Cell`, `TallyGrid`, `CategoryChip`, `HonestyRail` (replaces StatusStamps), `LensControl` (replaces PersonaSwitcher; its dialog embeds `CaseBench` in compact mode, which is a **Lane C** component, so Lane A ships the dialog with a slot and Lane C fills it), the `LocaleSwitch` restyle, the 52 px `SiteHeader` with role nav sets (02 §2), `SiteFooter`, and `AuditTape`.
5. Restyle the four-state primitives in `ui/states.tsx`: skeleton, actionable empty, error with retry and correlation id, and partial.

**Acceptance:**
- typecheck and lint are clean;
- the vitest suite is green;
- the header and rail render on every route in en, ar and ur;
- axe is clean on `/en` and `/ar/couple`;
- there are no hex literals in `src`. Check with `rg -n "#[0-9a-fA-F]{3,6}\b" src --glob '!*.json'`, which must return only token files.

**Tests likely to change:**
- `e2e/persona-and-result.spec.ts`: the persona select becomes the LensControl dialog.
- `e2e/roles.spec.ts`: persona switching via the helper.
- `e2e/helpers.ts`: the persona helper must use the bench cell link or the Lens dialog. Keep the helper's API stable for the other specs.

## Lane B: Couple screens

**Owns:**
- `src/app/[locale]/couple/**`
- `src/components/result/*` (except `CategoryChip.tsx`)
- `src/components/consent/*` (except `AuditTape.tsx`)
- `src/components/pathway/*`
- `src/components/closure/*`
- `src/lib/result-layers.ts`, `src/lib/next-actions.ts`, `src/lib/icon-array.ts`
- `src/messages/{en,ar,ur}/{result,consent,closure}.json`

`clinical.json` keys may be **read** but not edited. If a key is needed, add a new key in `result.json`.

**Do** (02 §4.1, 4.2, 4.3, 4.7, §5):
- `Threshold` with all four branches, PUT and DELETE right-not-to-know, and the declared state.
- `ReadTogether` with two locale queries, block alignment and the fallback when blocks do not line up.
- `ResultDisclosures` mapped in `result-layers.ts`.
- `TallyGrid` in place of `IconArray`.
- The next-step panel.
- `VisibilityMatrix`, the audit table, and the ledger inside `<details>`. **Keep `GrantForm` inside the ledger details** so purpose and expiry stay available.
- The RNTK status line on the sharing page.
- `PathwayCells` on `/couple`.
- Restyle teach-back (one question per view, results as cells) and the patient closure.

**Acceptance:** the 02 §4.1-4.3 acceptance lists, plus:
- the result first fold at 1440 x 900 shows the chip, both headings, both summaries, the caption and the tally;
- the ar and ur layouts are checked by screenshot.

**Tests likely to change:**
- `components/result/ResultView.test.tsx`: the structure changes. Keep the assertions that the text comes from the API.
- `lib/result-layers.test.ts`: the new layer keys.
- `lib/icon-array.test.ts`: keep the logic and adapt it to the cells.
- `components/consent/SharingPanel.test.tsx` and `AuditTrail.test.tsx`.
- `components/consent/messages.test.ts`.
- `lib/next-actions.test.ts`.
- `e2e/consent-release.spec.ts`: either open "Consent ledger (table)" before using the grant form, or switch to the matrix switch "Share" in the "Couple result" row.
- `e2e/review-fixes.spec.ts` and `persona-and-result.spec.ts`: the result route now shows the threshold. Click "Read it now", or enter with `?enter=now`.

## Lane C: Public, evidence and programme

**Owns:**
- `src/app/[locale]/page.tsx`
- `src/app/[locale]/{demo,how-it-works,governance,judge,programme}/**`
- `src/components/{demo,evidence,governance,programme}/*`
- `src/components/motif/*`: remove the usage; ask the controller before deleting the file.
- `src/messages/{en,ar,ur}/{marketing,oversight}.json`

**Do:**
- The landing, per the `prototype/landing.html` comp:
  - the statement row;
  - the full-width product sheet fed by `GET result` for cpl-demo-02 in en and ar via a **server component**, with a fallback to the fixtures if the API is down. That fallback must be labelled "from a recorded response". If server data fetching on the landing is too heavy, the comp may render from the committed fixture `__fixtures__/result_02a.json`, plus an ar fixture you record, labelled as such;
  - the threshold, who-sees-what, evidence and staff sections.
- `CaseBench`, plus the compact variant for Lane A's Lens dialog slot.
- `ProbeConsole` with all seven probes, the audit delta and verify (02 §4.4).
- `EvidenceCell` and the scoreboard.
- The governance clause register.
- How it works, trimmed.
- The programme page (02 §4.8).

**Acceptance:**
- the 02 §4.4 and 4.5 lists;
- the landing first fold at 1440 matches the comp's structure;
- the landing route JS stays under 170 KB (the hero object is RSC with no client JS);
- the evidence probes run against the real backend in `e2e:real`.

**Tests likely to change:**
- `e2e/landing.spec.ts`: the h1 text and the CTA names.
- `components/programme/KpiDetail.test.tsx`.
- `e2e/roles.spec.ts` line 54: "does not show" stays visible on the evidence page. Keep that string.

## Lane D: Staff and clinician

**Owns:**
- `src/app/[locale]/staff/**`
- `src/app/[locale]/clinician/**`
- `src/components/staff/*`
- `src/components/haem/*`
- `src/messages/{en,ar,ur}/clinical.json`
- new `src/components/staff/{InstrumentLayout,TraceChip}.tsx`

**Do** (02 §4.6):
- The three-pane instrument for `/staff` and `/staff/couples/[id]`, with the case preselected.
- Keyboard J/K/Enter.
- Trace chips and the trace pane with sources and sign-off stamps.
- Verb actions, using only the existing pathway events.
- The ProformaForm hosted in the brief pane, with unchanged logic.
- HaemAid as an instrument: inputs on the reading start; the label, rule trace, sources and sign-off on the reading end.

**Acceptance:**
- the 02 §4.6 list;
- the ProformaForm tests and `proforma-schema.test.ts` are unchanged and green;
- the `HaemAid.test.tsx` assertions on the closed vocabulary are kept.

**Tests likely to change:**
- `components/staff/messages.test.ts` (new keys).
- `HaemAid.test.tsx` (structure only).

## Controller checks after merge

1. Run `pnpm typecheck && pnpm lint && pnpm test`. All 258 vitest tests (or the new count) must pass. Then run `pnpm test:e2e:real`. All 27 tests (or the new count) must pass.
2. `pnpm build`: every route at or under 170 KB gzip.
3. Capture screenshots: `pnpm shots` for en, ar and ur at 390, 768 and 1440. Compare them with `docs/design/v2/prototype/shots/` and **look at them**.
4. Run the design gate against `localhost:3000/en`, `/en/couple/result`, `/en/staff` and `/en/judge`:

   ```
   node "%USERPROFILE%\.claude\plugins\marketplaces\design-craft\plugins\design-craft\skills\visual-critique\scripts\design-gate.mjs" <url> --src frontend/src
   ```

5. Run the grep gate on `frontend/src`, which must return nothing:

   ```
   rg -n "box-shadow|backdrop-filter|blur\(|radial-gradient|linear-gradient|border-radius: ?([7-9]|[1-9][0-9])px|bounce|Newsreader|Source Sans|Pedigree" frontend/src
   ```

   Exceptions: the hatch `repeating-linear-gradient` in the `Cell` component, and the single `--shadow-dialog`.
6. Run the design.md lint on `docs/design/v2/DESIGN.md`. It has 0 errors and 0 warnings at handoff.
7. Ask a fresh Sonnet critic for an independent read. Give it the comps, the live screenshots and the four rival fold screenshots, but not the builders' reasoning.
