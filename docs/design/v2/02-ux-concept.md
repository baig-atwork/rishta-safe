# 02. UX concept, IA and per-screen spec (v2, 2026-11-20)

Status: this is the **build spec for the v2 branch**. It describes the target state, not production. Every distinctive interaction below uses **existing endpoints only** (`backend/openapi.json`). There is no new backend.

The comps are in `prototype/*.html`:
- `landing`, `landing-ar`;
- `bench`;
- `threshold`;
- `result`, `result-ar`;
- `sharing`;
- `staff`;
- `evidence`.

Tokens: `tokens.css`. Direction: `01-direction.md`. Overlaps this answers: `00-ux-audit.md`.

Copy: the English is given here. Every new key needs an `ar` and `ur` counterpart; flag `language_status: draft` as today. Keys marked **[ar/ur]** must be added to all three message files. Result and clinical wording never comes from message files; it comes from the API.

## 1. The model in one paragraph

Rishta Safe is entered through the **Case bench**: ten synthetic cases, each listed by what it tests, crossed with the roles (lenses) you can enter it as. Couple members meet their result through **the threshold**, a four-way choice backed by the right-not-to-know endpoint. They then read it **together**, in both partners' languages side by side. They control **who sees what** in a matrix whose cells cite the law, and every change appears as a row on the **audit tape**. Staff work in a three-pane **instrument** (queue, brief, trace) where every line links to its rule and source. Judges get **Evidence**: live probes against the real API, each showing the response and the audit row it wrote, above the scoreboard with its NOT RUN cells.

## 2. Information architecture: every current route, its new home

All 15 routes keep their URLs. Nothing redirects.

| # | Route (unchanged URL) | v2 name in nav | Role(s) | v2 content | Change |
|---|---|---|---|---|---|
| 1 | `/[locale]` | (landing) | public | Dark statement row + bilingual product sheet, then threshold / who-sees-what / evidence / staff sections | rebuilt |
| 2 | `/[locale]/demo` | Case bench | public | 10 cases x lenses matrix, reset demo | rebuilt |
| 3 | `/[locale]/how-it-works` | How it works | public | Short page: the five moves (threshold, read together, who sees what, instrument, evidence) each with its endpoint, then the pathway reference (`pathway-reference.ts`) as PathwayCells | restyled + trimmed |
| 4 | `/[locale]/governance` | Governance | public | Clause register table: article, what the law says (short), where in Rishta Safe, endpoint, test. The third-party demo moves to Evidence (link left here) | restyled |
| 5 | `/[locale]/judge` | Evidence | judge (read-only); also public view | Probe console + scoreboard cells | rebuilt |
| 6 | `/[locale]/programme` | Programme | programme | Pathway step x 10 case cells + KPI rows in mono | rebuilt |
| 7 | `/[locale]/clinician` | Haematology aid | clinician | HaemAid as an instrument: inputs left, label + rule trace right; reports filing as today | restyled |
| 8 | `/[locale]/couple` | Home | couple member | Next action panel + PathwayCells + "your result" entry (goes to threshold) | rebuilt |
| 9 | `/[locale]/couple/result` | Result | couple member | Threshold, then Read together + tally + disclosures + next step | rebuilt |
| 10 | `/[locale]/couple/sharing` | Who sees what | couple member | Visibility matrix + audit table + ledger (in a disclosure) + RNTK status | rebuilt |
| 11 | `/[locale]/couple/teach-back` | Practice | couple member | Same quiz, one question per view, result as cells | restyled |
| 12 | `/[locale]/couple/closure` | After counselling | couple member | Same patient items + service interest, as a ruled form | restyled |
| 13 | `/[locale]/staff` | Queue | counsellor, clinician | Instrument: queue pane + empty brief pane ("Select a case") + trace pane | rebuilt |
| 14 | `/[locale]/staff/couples/[coupleId]` | Queue (case selected) | counsellor, clinician | Same instrument with this case selected; proforma opens in the brief pane | rebuilt |
| 15 | `not-found`, `error`, `loading` | n/a | all | Not found: "This page does not exist in the prototype" + links to Case bench and landing. Error: message + retry + correlation id. Loading: shell skeleton | restyled |

Navigation sets (header, max 5 items; collapse to a menu button below 1024 px):
- **public**: How it works, Governance, Evidence, Case bench.
- **couple**: Home, Result, Who sees what, Practice, After counselling.
- **staff**: Queue, Haematology aid (clinician only), Programme (link out only if the role permits).
- **judge**: Evidence, Case bench, Governance.

## 3. The app shell (all routes)

- **Header, 52 px, one row.** It holds:
  - the wordmark: three cells + "Rishta Safe" + "بيان";
  - the role nav;
  - **LensControl**;
  - **LocaleSwitch**, a segmented EN | عربي | اردو control with the current one inverted;
  - the theme toggle, which goes into the overflow menu at under 1024 px.
- **LensControl** is a button: "Lens: {display_name} · {couple_id} ▾", or "Lens: none" when signed out. It opens a dialog containing a compact Case bench (the same component) plus "Sign out of the demo lens". It replaces `PersonaSwitcher`'s `<select>`. Its state uses the same session mechanism as today (`lib/session.ts`). The words "(synthetic)" always follow a person's name; the API's `display_name` already carries it.
- **HonestyRail, 28 px.** It reads: "Synthetic data", "Arabic and Urdu: draft translations", "Clinical rules pending sign-off", "Not clinical advice", and a "Limits" link to the governance limits anchor. Below 760 px only "Synthetic data" and "Not clinical advice" are shown, plus "Limits". It replaces `StatusStamps` (the 70 px band).
- **AuditTape, 36 px, sticky to the bottom.** Couple routes only (`/couple/**`). It shows the last 2 events from `GET /v1/couples/{id}/audit` (index, action, when) and, at the end of the reading line, "chain verified, N events" from `GET /v1/audit/verify`. Couple members get `ok` and a count. Clicking it goes to `/couple/sharing#audit`. If verification fails it shows the attention colour and "chain check failed at #{first_bad_index}".
- **Footer**: the current SiteFooter content in a single compact block.

Copy **[ar/ur]**:
- `shell.lens.label` "Lens"
- `shell.lens.none` "none"
- `shell.lens.dialogTitle` "Choose a case and a lens"
- `shell.lens.signOut` "Leave this lens"
- `shell.rail.synthetic` "Synthetic data"
- `shell.rail.draft` "Arabic and Urdu: draft translations"
- `shell.rail.pending` "Clinical rules pending sign-off"
- `shell.rail.notAdvice` "Not clinical advice"
- `shell.rail.limits` "Limits"
- `shell.tape.label` "Audit"
- `shell.tape.verified` "chain verified, {count} events"
- `shell.tape.failed` "chain check failed at #{index}"

## 4. The distinctive interactions (exact behaviour + acceptance)

### 4.1 The threshold (`/couple/result`, first visit per lens)

**Data.** `GET /v1/couples/{id}/result?locale={page}` (one query, already in `endpoints.ts`).

**Branching on `disclosed.withheld_reason_key`:**
- `"right_not_to_know"`: show the **declared state**. Heading: "You chose not to know this result". Body: "Your choice is recorded. The screening centre and the national genomic database still hold the result (Art. 26(2)). You can change your mind at any time." Primary action: "I want to see my result" → `DELETE /v1/couples/{id}/right-not-to-know` → refetch result → show the threshold again.
- `"counselling_first"` or `"awaiting_partner_consent"`: no threshold. Render the API's withheld document as today (the server decided), with the next step.
- `null` with a category: show the threshold unless a choice is stored for this lens and couple.

**The four options**, a radio group with one Continue button. Each option shows its cell glyph.

| Option | Glyph | Effect | Persisted where |
|---|---|---|---|
| Read it now | solid | reveal the result view | `localStorage["bayan.threshold.{personaId}"]="now"` (per-viewer convenience; wrap in try/catch) |
| Read it with a counsellor first | hatch | closed view: "Kept closed on this screen until after your counselling" + current counselling step from `GET /pathway` + "Open it now" link | localStorage "counsellor" |
| Not yet | dashed open | closed view with "Open it" button; asked again next session | `sessionStorage` only |
| I prefer not to know | open | confirm dialog quoting Art. 9(2) and Art. 26(2) → `PUT /right-not-to-know` → refetch → declared state; audit tape shows the new row | server |

**Rules.**
- The result DOM is **not rendered** before a choice. Hiding it with CSS does not count: screen readers must not reach it.
- "Change how I meet my result" sits in the result's next-step panel and reopens the threshold. If RNTK is declared, it offers DELETE.
- Staff and judge lenses never see the threshold; they see the staff view of the result.
- A bench link may pass `?enter=now` to skip the threshold for judges in a hurry. The link label must say "skip the choice".

**Copy [ar/ur].**
- `result.threshold.eyebrow` "Your screening result"
- `result.threshold.title` "Your result is ready. How would you like to meet it?"
- `result.threshold.body` "You can change this at any time. Your partner makes their own choice; neither of you sees the other's choice."
- `result.threshold.now` "Read it now" / `...nowHint` "It opens on this page. A next step and a person to talk to are always one tap away."
- `...counsellor` "Read it with a counsellor first" / hint "It stays closed on this screen until after your counselling visit."
- `...notYet` "Not yet" / hint "Nothing is recorded. We will ask again next time."
- `...rntk` "I prefer not to know" / hint "Recorded as your right not to know. You can withdraw it whenever you want."
- `...law` "Right not to know: Federal Decree-Law 49/2023, Art. 9(2). The screening centre and the national genomic database still hold the result (Art. 26(2)). This choice is about what you read here."
- `...confirmTitle` "Record that you prefer not to know?"
- `...continue` "Continue"
- `...declaredTitle` "You chose not to know this result"
- `...withdraw` "I want to see my result"

**Acceptance.**
- (a) With no stored choice, no result text is in the DOM.
- (b) The RNTK option issues exactly one PUT. The refetched result has `withheld_reason_key=right_not_to_know`. The audit tape count goes up by one.
- (c) Withdraw issues a DELETE and returns to the threshold.
- (d) Keyboard: the arrows move between options; Enter on Continue.
- (e) axe passes in en, ar and ur.

### 4.2 Read together (`/couple/result`)

**Data.**
- Primary column: `GET .../result?locale={page}`.
- Second language: from `GET /v1/couples/{id}` `members[]` (`language`). Use the **other** member's language if it differs from the page locale. Otherwise use the viewer's own member language if it differs. Otherwise show no second column and offer "Add a language" (en, ar, ur).
- Second column: `GET .../result?locale={second}` as a second TanStack query (`["result", id, locale]`).

Check `real/adapter.ts` passes `locale` through for both. It does for `result(coupleId, locale)`.

**Layout.**
- Rows are **aligned block by block**. Both documents are rendered from the same `template_ids`. Pair `document.blocks[i]` with `blocks[i]`. If the lengths differ, stop pairing and render the remaining blocks stacked under a "Not aligned" note. Never guess.
- Page-locale column first, at the reading start. Each column has its own `lang` and `dir`.
- The second column is in `fg-2` (it is the same meaning, not a second voice), and its heading is in `fg`.
- Each column carries its own `language_status` stamp.
- At under 760 px the pair stacks per block, with a dashed hairline between languages.
- "Show one language" collapses to the page locale and is remembered in localStorage.
- The tally grid sits beside the text (it has no language). The legend is in the page locale.
- The icon array caption is the API sentence; the tally `aria-labelledby` points to it.

**First fold at 1440** must contain:
- the category chip;
- the heading in both languages;
- the summary paragraph in both languages;
- the 100 caption in both languages;
- the tally with its legend.

Then four disclosures, in this order (Myriad report order: label and next steps first, maths and limits last):
1. "What this means, and what it does not": meaning + partner blocks.
2. "Your own report": own blocks.
3. "Limits of this test": detection blocks. For related couples the related-couple caveat is pinned **open**.
4. "Who can see this": links to Who sees what.

The next-step panel is on the reading end. Its heading is the action. It also holds the boundary text, plus "Close the result" and "Change how I meet it".

Mapping from blocks to disclosures uses `template_ids` prefixes: `result.*` and `shared.*` go to the top; `meaning.*` and `partner.*` to disclosure 1; `own.*` to 2; `limits.*` to 3; `privacy.*`, `policy.*` and `certificate.*` to 4; `options.*` and `shared.next` to the next-step panel; `boundary.*` to the panel; `status.*` to stamps. This mapping lives in the existing `lib/result-layers.ts`; extend it there.

**Copy [ar/ur].**
- `result.together.label` "Read together"
- `result.together.one` "Show one language"
- `result.together.add` "Add a language"
- `result.together.notAligned` "The two languages could not be lined up from here on; each is shown in full."
- `result.more.meaning` "What this means, and what it does not"
- `result.more.own` "Your own report"
- `result.more.limits` "Limits of this test"
- `result.more.who` "Who can see this"
- `result.close` "Close the result"
- `result.change` "Change how I meet it"

**Acceptance.**
- (a) Case 2 as Layla (en) shows en + ar. Case 6 as Hind (ur) shows ur + en. Case 4 as Dalia (ar) shows ar + en.
- (b) Each column's text equals the API text for that locale (a unit test against fixtures).
- (c) No user-visible result or clinical string comes from message files.
- (d) Both columns render Western digits.
- (e) CLS is 0.1 or less while the second query loads. The skeleton mirrors the column.

### 4.3 Who sees what: the visibility matrix (`/couple/sharing`)

**Data.**
- `GET /v1/auth/me` for the viewer `person_id`.
- `GET /v1/couples/{id}` for `members` and `emirate_policy`.
- `GET /v1/couples/{id}/consents`.
- `GET /v1/couples/{id}/audit`.
- `GET /v1/audit/verify`.

**Layout.**
- Rows are the three `ConsentScope` values: "Couple result" `couple_result_only`, "Gene names" `gene_names_only`, "Full variant detail" `full_variant_detail`. The mono scope id sits under each label.
- Columns:
  1. **{partner display name}, your partner**: "you decide".
  2. **Care team**: "fixed: care".
  3. **National genomic database**: "fixed: Art. 26(2)".
  4. **Employer**: "fixed: Art. 19-21".
  5. **Insurer**: "fixed: Art. 19-21".

**Partner cells** are `role="switch"`:
- On when there is a consent record with `subject_person_id == me`, `recipient == partner person_id`, the same `scope`, `revoked_at == null` and not expired. The cell then reads "Shared with {name}" with a "Revoke" action, has the lapis fill and the `accent-soft` background.
- Off reads "Not shared" with a "Share" action.
- Share: `POST /consents {recipient: partnerId, scope, purpose: "partner_disclosure", expires_at: null}`.
- Revoke: the existing RevokeDialog, then `POST /consents/{id}/revoke`.
- After either: invalidate consents and audit. The new audit row is highlighted (`accent-soft`, 180 ms settle) and announced in a polite live region: "Recorded: {action}".

**Fixed cells** have a cell glyph, a label and a "fixed" tag, and are not interactive:
- Care team: "Sees what the disclosure rule allows, for your care". Implementers: confirm against `data/consent_policies.yaml` per emirate and use that wording. Do not invent it.
- Database: "Receives by law" (hatch).
- Employer and Insurer: "Never" (open).

Below the matrix:
- a footnote citing Art. 19 to 21, plus "Rishta Safe never claims to hide data from the health authorities";
- a sentence that screening itself is not consent-based (Art. 4(2)(a), 15). The text is the `basis_note` from the consents response;
- **"What has happened to your information"**: the audit table (#, when, who, action, outcome, short hash), newest first, with the chain status at the top-end;
- the full consent ledger table (the existing `SharingPanel` table) inside a `<details>`;
- an RNTK status line: "Right not to know: not declared · Declare" or "declared · Withdraw", using the same endpoints as 4.1.

**Copy [ar/ur].**
- `consent.matrix.title` "You decide what {name} sees. The law fixes the rest."
- `consent.matrix.intro` "Only the first column is yours to change. Every change writes a row to the audit log below."
- `consent.matrix.col.partner` "{name}, your partner"
- `consent.matrix.col.care` "Care team"
- `consent.matrix.col.db` "National genomic database"
- `consent.matrix.col.employer` "Employer"
- `consent.matrix.col.insurer` "Insurer"
- `consent.matrix.row.result` "Couple result"
- `consent.matrix.row.genes` "Gene names"
- `consent.matrix.row.detail` "Full variant detail"
- `consent.matrix.on` "Shared with {name}"
- `consent.matrix.off` "Not shared"
- `consent.matrix.share` "Share"
- `consent.matrix.revoke` "Revoke"
- `consent.matrix.fixed` "fixed"
- `consent.matrix.law` "Receives by law"
- `consent.matrix.never` "Never"
- `consent.audit.title` "What has happened to your information"
- `consent.audit.recorded` "Recorded: {action}"
- `consent.ledger.toggle` "Consent ledger (table)"

**Acceptance.**
- (a) The switch states equal the ledger for seeded case 2.
- (b) Share then Revoke produces two new audit rows and the chain still verifies.
- (c) The fixed cells have no focusable control.
- (d) The matrix is a real `<table>` with `scope` attributes. At 390 it scrolls inside a focusable region with an accessible name.
- (e) There is no colour-only state: each cell has a glyph and text.

### 4.4 Evidence: live probes (`/judge`)

**Data.**
- Personas from `GET /v1/demo/personas`, which carry tokens; the transport already supports a per-request bearer.
- Each probe runs **as a stated persona**. It reads the audit before and after for the couple involved (`GET /v1/couples/{id}/audit` as the judge lens) and re-verifies (`GET /v1/audit/verify`).

| Probe | As | Request | Show |
|---|---|---|---|
| Employer asks for a result | judge lens (requester kind in body) | `POST /v1/third-party-requests {couple_id:"cpl-demo-02", kind:"employer"}` | 403 problem: `detail` verbatim, `legal_basis`, `code`, `reason`, `correlation_id`; new audit row |
| Insurer asks for screening status | same | `kind:"insurer"` | same |
| "Should we cancel the wedding?" | judge | `POST /v1/refusals/classify {text, locale, couple_id:null}` | `refuse`, `category` (marriage_decision), `message` verbatim, `matched_rule_ids`, `method` |
| A distressed message (synthetic test sentence) | counsellor | `POST /v1/couples/cpl-demo-02/escalations/evaluate {free_text, relationship:"first_cousin", locale}` | `decisions[]` (trigger, tier, due), `notice`; audit row |
| Open another couple's result | Layla (cpl-demo-02-a) | `GET /v1/couples/cpl-demo-05/result` | 403 problem; audit row on cpl-demo-05 if the API writes one, otherwise "No row: the request was refused before any record was read" |
| Blood count only | clinician | `POST /v1/haem/interpret {cbc: fixture haem_incomplete}` | label (closed vocabulary), rule trace, "never a carrier statement from a blood count alone", sign-off flag |
| Your own words | judge | classify with the typed text and the chosen locale | the same as row 3, plus the honest note from M6: "Keyword and pattern matching. Held-out first run: 36 of 59 refused (61%)." |

**Layout.**
- Dark console: the probe list on the reading start. Then three stacked panes: Request (mono), Response (a verdict cell + the API text verbatim + codes) and Audit row written (index, action, outcome, prev and hash shortened, chain re-verified).
- Response, then the audit pane, appear in sequence (120 ms) unless reduced motion is on.
- Below the console: the **scoreboard** as evidence cells from `GET /v1/eval/scoreboard`. Each cell shows the title, the value in mono, the n, and a "Does not show" line (always visible, never in a tooltip). `status: not_run` cells are **hatched** and say "Not run".
- The caveats list ends the page.

**Copy [ar/ur].**
- `judge.title` "Try to break it."
- `judge.intro` "Each probe sends a real request as a synthetic persona. You see what came back and the audit row it left."
- Probe titles as in the table.
- `judge.req` "Request"
- `judge.res` "Response"
- `judge.audit` "Audit row written"
- `judge.noRow` "No audit row: this request did not touch a couple record."
- `judge.dns` "Does not show"
- `judge.notRun` "Not run"
- The distress sentence is shown with the label "synthetic test sentence". It must not be graphic. Use: "Since the result I feel hopeless and I do not know how to go on." If it does not trigger, show that honestly with the M6 caveat.

**Acceptance.**
- (a) Each probe hits the real endpoint in the real-backend e2e (`e2e/*`, mode real).
- (b) The response text shown equals the API body.
- (c) The audit delta is computed, not hard-coded.
- (d) Running the probes twice produces new audit rows each time and the chain still verifies.
- (e) "Reset the demo" (`POST /v1/demo/reset`) is available from the bench, not the console.

### 4.5 Case bench (`/demo` and the Lens dialog)

**Data.** `GET /v1/demo/cases` and `GET /v1/demo/personas`.

**Columns.**
- "Case, and what it tests": `n`, `title` and `summary` (summary on hover/focus disclosure).
- "Rule · relationship": `emirate_policy` · `relationship`, in mono.
- Partner 1 and Partner 2: personas whose `couple_id` matches. A solid lapis cell + display name.
- Counsellor ("Brief") and Clinician ("Record"): hatch cells linking to `/staff/couples/{id}` and `/clinician?couple={id}` under that lens.
- Programme: an open cell, "Aggregate only", not a link. This is the rule made visible.

Above the table: "Not tied to one case": Programme, Evidence, Haematology aid. "Reset the demo" goes at the end of the reading line.

**Suggested start.** Case 08 (certificate tension) carries a small "start here" mono tag. The rival map shows rivals open on the happy case.

**Copy [ar/ur].**
- `demo.title` "Pick what you want to test, then the lens to test it through."
- `demo.intro` "Each row is a seeded case built to exercise one branch of the rules. Each column is a role. A cell opens that case as that person. Greyed cells are the access rules at work: the programme lens never sees an individual case."
- `demo.col.case` "Case, and what it tests"
- `demo.col.rule` "Rule · relationship"
- `demo.col.p1` "Partner 1"
- `demo.col.p2` "Partner 2"
- `demo.col.counsellor` "Counsellor"
- `demo.col.clinician` "Clinician"
- `demo.col.programme` "Programme"
- `demo.aggregateOnly` "Aggregate only"
- `demo.startHere` "start here"
- `demo.reset` "Reset the demo"

**Acceptance.**
- (a) 10 rows from the API, with no hard-coded cases.
- (b) Entering a cell sets the lens and lands on the right route.
- (c) The table is keyboard navigable, and each link name includes the case and the role ("Open case 02 as Layla").

### 4.6 The staff instrument (`/staff`, `/staff/couples/[id]`)

Layout: three panes, full-bleed. Under 1100 px it becomes a single column: the queue, then the brief on selection.

1. **Queue** (`GET /v1/escalations`): case id (mono), priority (glyph + uppercase mono label: ▲ URGENT in `attention`, ■ PRIORITY, □ ROUTINE in `fg-3`), first rule fired (mono) + "+N", waiting (computed from `created_at`, mono, end-aligned). Sorting is priority, then waiting. Rows are 36 px. J/K moves, Enter opens, `aria-selected` shows the selection.
2. **Brief** (`GET /v1/couples/{id}/brief?locale=`).
   - A key/value block: couple (names, ages, relationship), languages (each member's language; the brief locale switch offers both), the emirate rule, the pathway state with any flag, and family history.
   - Then the API `sections` (result, why, sharing, open), each line with a **TraceChip** (`R1`, `E1`, `C1`) linking to the trace pane.
   - "Open" includes the teach-back cells and whether closure records exist.
   - Actions are verbs: "Record counselling booked" / "Record counselling done" (`POST /pathway/events`) and "Open closure proforma" (the existing ProformaForm in this pane). A hold or decline action needs a reason. Use the existing pathway event kinds; if none fits, omit it. Do not add backend.
3. **Trace**: `trace[]` and `escalations[]` from the brief. Each shows the id, rule or trigger, tier, due, the **source** text, and "sign-off pending" / "legal read needed" stamps (`needs_clinician_signoff`, `needs_legal_read`). The footer reads "Nothing in this brief is generated. Each line comes from a rule, a record or the engine, and links to it."

**Copy [ar/ur].**
- `staff.queue.title` "Review queue"
- `staff.queue.meta` "{n} open · sorted by priority, then waiting"
- `staff.queue.keys` "J / K move · Enter open"
- `staff.brief.empty` "Select a case from the queue. The brief and its trace open here."
- `staff.trace.title` "Trace"
- `staff.trace.footer` (as above)
- `staff.action.booked` "Record counselling booked"
- `staff.action.done` "Record counselling done"
- `staff.action.proforma` "Open closure proforma"

**Acceptance.**
- (a) Every brief line has a chip that resolves to a trace entry.
- (b) Opening `/staff/couples/cpl-demo-09` preselects that row.
- (c) The ProformaForm tests still pass unchanged.
- (d) Table semantics are kept.

### 4.7 PathwayCells (`/couple`, `/how-it-works`, brief)

A horizontal row of square cells, one per pathway step (`GET /pathway` `steps[]`): solid = done, lapis ring = current, open = upcoming, dashed = blocked or breached. The label sits under each cell, with mono times. On mobile it becomes a vertical list, still made of cells. The SLA state (`timer`) is text plus a glyph, never colour alone. This replaces `PathwayTracker`'s vertical descent line.

### 4.8 Programme (`/programme`)

`GET /v1/programme/kpis`: KPI rows as a definition table (label, value in mono, basis), with the "illustrative standard" stamp where `referral_standard_is_illustrative`. Then the steps x cases grid: for each step, the 10 cases as cells by state. Programme cannot see the case ids, so cells are anonymous; show counts only if the API gives them. **If the KPI response does not give per-step counts, show only the KPI rows. Do not derive per-case cells for this role.** Footer: "Seeded synthetic cases only. Never national statistics (Art. 25(3))."

## 5. Four states, per data surface

| Surface | Loading | Empty (actionable) | Error | Partial |
|---|---|---|---|---|
| Case bench | 10 skeleton rows of fixed height | "No cases: the demo store is empty." + "Reset the demo" | message + retry + correlation id | cases loaded, personas failed: lens cells show "Lens unavailable · retry" |
| Threshold / result | skeleton of the threshold card (never of the result) | n/a (the API always returns a document or a withheld reason) | problem detail + retry + correlation id; 403 → "This lens cannot see this case" + "Change lens" | second-language query failed: the primary column stays, the second says "Could not load {language} · retry" |
| Visibility matrix | matrix skeleton, all cells grey | no consents: all partner cells "Not shared", intro says "Nothing is shared yet. Use Share in the first column." | retry + id; a failed mutation reverts the switch and shows the problem inline in that cell | audit failed: matrix works, audit area shows retry |
| Audit tape | thin skeleton | "No events yet" | "Audit unavailable · retry" | verify failed: events shown, chain status "not checked" |
| Evidence probe | the pane shows "Sending..." in mono | before the first run: "Pick a probe. Each one sends a real request." | network error shows the raw status + correlation id | response OK but audit fetch failed: "Audit not read · retry" |
| Scoreboard | 8 cell skeletons | n/a | retry + id | n/a |
| Staff queue | 8 skeleton rows | "No open escalations. New cases appear here when a written rule fires." | retry + id | queue OK, brief failed: the brief pane errors alone |
| Programme | KPI skeleton | "No cases have reached this step." | retry + id | n/a |

## 6. Component inventory (props kept under about 8; compose for more)

| Component | Path (new unless noted) | Props |
|---|---|---|
| `Cell` | `components/grid/Cell.tsx` | `fill: "solid" \| "hatch" \| "open"`, `dashed?: boolean`, `tone?: "ink" \| "accent" \| "shared" \| "none" \| "info"`, `size?: number`, `label?: string` (sr-only) |
| `TallyGrid` | `components/grid/TallyGrid.tsx` (replaces `result/IconArray.tsx`) | `spec: IconArraySpec`, `captionId: string`, `legend: {affected, carrier, neither}` (labels from messages, counts from the API) |
| `CategoryChip` | `components/result/CategoryChip.tsx` | `category: ResultCategory`, `size?: "sm" \| "md"` |
| `HonestyRail` | `components/shell/HonestyRail.tsx` (replaces `StatusStamps`) | none (reads messages + route) |
| `LensControl` | `components/shell/LensControl.tsx` (replaces `PersonaSwitcher`) | `persona?: PersonaOut` |
| `LocaleSwitch` | restyle `shell/LocaleSwitcher.tsx` | unchanged |
| `AuditTape` | `components/consent/AuditTape.tsx` | `coupleId: string` |
| `Threshold` | `components/result/Threshold.tsx` | `coupleId`, `personaId`, `onChoose(choice)` |
| `ReadTogether` | `components/result/ReadTogether.tsx` | `primary: ExplainerDoc`, `secondary?: ExplainerDoc`, `onSingle()` |
| `ResultDisclosures` | `components/result/ResultDisclosures.tsx` | `layers` (from `result-layers.ts`) |
| `VisibilityMatrix` | `components/consent/VisibilityMatrix.tsx` | `coupleId`, `me`, `partner`, `consents`, `policy` |
| `CaseBench` | `components/demo/CaseBench.tsx` | `cases`, `personas`, `compact?: boolean` |
| `ProbeConsole` | `components/evidence/ProbeConsole.tsx` | `personas` |
| `EvidenceCell` | `components/evidence/EvidenceCell.tsx` | `metric: Metric` |
| `InstrumentLayout` | `components/staff/InstrumentLayout.tsx` | slots: `queue`, `brief`, `trace` |
| `TraceChip` | `components/staff/TraceChip.tsx` | `id: string`, `href: string` |
| `PathwayCells` | `components/pathway/PathwayCells.tsx` (replaces `PathwayTracker`) | `steps: PathwayStepView[]`, `orientation?` |

`motif/Pedigree.tsx` is deleted from use. Remove its imports; the file may stay until the controller decides.

## 7. Motion spec (CSS only, `--dur-*`, `--ease-out`)

1. Switch → audit row: background settle 180 ms on the new row, plus a polite live region.
2. Probe: response pane fades in at 0 ms, audit pane at 120 ms (opacity + 8 px translate).
3. Threshold → result: cross-fade 180 ms. No slide.
4. Button press: translateY(1px) for 100 ms.
5. The tally is static. Nothing counts up, nothing pulses.

Under `prefers-reduced-motion: reduce` everything is instant (the global rule in `tokens.css`). No animation library (ADR 0166 stands).

## 8. What NOT to change

- The API contracts, the adapters' mapping logic, the zod schemas, the closure and proforma field logic, the i18n plumbing (next-intl), the session and persona token mechanism, the data fetching layers, and every test's behavioural assertion.
- The rules: the closed vocabulary, no hard-coded clinical text, Western digits, logical properties, `<bdi>` for ids, four states, and the 170 KB route budget.
- The teach-back items and the closure items (content), and the `needs_clinician_signoff` display.
- The Urdu Nastaliq loading on `/ur` only.
