# 00. UX audit: where Rishta Safe's interaction patterns coincide with the four rivals (2026-11-20)

Status: design-stage document. It describes the **current production frontend** (`D:\dev\bayan\frontend\src`, screenshots `docs/design/shots/en-*-1440.png`) against the rivals' **public demos as observed on 2026-11-20**. Sources: `D:\dev\_research\ch03-ui\rival-ux-map.md` (a sibling agent drove Silah, Two Keys, KinSight and GeneBridge read-only; see its "Not done" list for gated areas), the rival screenshots in `D:\dev\_research\ch03-ui\rivals\`, and my own read of the Rishta Safe routes, messages and `backend/openapi.json`.

## 1. The finding in one paragraph

The owner's complaint is accurate for both look and UX. On the rival map's pattern table Rishta Safe is present or partial in 16 of 19 rows. The most recognisable copies are in the **first ten seconds**. The first is the landing composition: a cream ground, the headline on the left, a pedigree drawing on the right and two buttons labelled "Try the demo" and "See how it works". That is Two Keys' fold almost exactly. The second is the demo entry: a persona dropdown in the header plus a card list of couples. That matches KinSight's "Viewing as" dropdown and the Silah and Two Keys casts. The third is a 100-mark result field with filled, half and open marks, which KinSight, Silah and Two Keys each have in some form. Rishta Safe's real differences are invisible in the current UI. It has a right-not-to-know API with no control on screen, live third-party refusal, a refusal classifier, a haematology aid, two emirate rules, a 12-field closure proforma, a rule register with sources, and NOT RUN measures. They sit behind long document pages.

## 2. Overlap table

Column "Kind": **R** = the challenge requires the capability, so every entry will have some version of it. Keep the capability but execute it differently. **D** = a pattern we adopted by default, which we replace.

| # | Rishta Safe pattern today (route) | Rivals with the same pattern | Kind | Decision | New execution (see 02-ux-concept.md) |
|---|---|---|---|---|---|
| 1 | Landing: cream ground, serif headline left, pedigree diagram right, "Try the demo" / "See how it works" (`/`) | Two Keys (same composition, same second label, NSGC pedigree), GeneBridge (serif on warm) | D | **Replace** | Dark ink statement row, then a full-width **product object**: the real result sentence for case 02 in English and Arabic side by side, with the 10x10 tally grid. No diagram. CTAs: "Open the case bench" / "See the evidence" |
| 2 | Header "Demo persona" `<select>` + 70 px stamp band on every page (shell) | KinSight "Viewing as" dropdown (7 personas); Silah person pills | D | **Replace** | Compact **Lens** control ("Lens: Layla (synthetic) · cpl-demo-02 ▾") that opens the Case bench as a dialog; 28 px honesty rail |
| 3 | `/demo`: page of personas grouped by couple | Silah cast row, Two Keys "pick one of four couples", KinSight sign-in case card | D | **Replace** | **Case bench**: a 10 cases x 5 lenses matrix. Rows say what each case tests, columns are roles, and greyed cells show the access rule at work (programme lens = "aggregate only") |
| 4 | `/couple`: "Hello, Layla" + pathway stepper + "Go to" panel | Silah 7-node diamond line, KinSight 8-step lab tracker | R (pathway states are in the brief) | **Keep, re-execute** | Pathway as a **row of state cells** (done / current / upcoming / blocked) with times in mono, not a vertical stepper. The page leads with the one next action |
| 5 | `/couple/result`: three stacked layers, ~5,000 px of text | Two Keys Simple/Standard/Detailed tabs, KinSight Simple/Standard toggle | R (a result view) | **Keep, re-execute** | Entered through **the threshold** (right not to know). Opens on **Read together**: the same API sentence in both partners' languages side by side. Detail stays in four disclosures. The first fold holds the whole result at 1440 |
| 6 | 100-circle icon array, solid / half / open | KinSight 100 spheres, Silah 100 dots, Two Keys half-filled diamonds | R (natural frequencies are best practice) | **Keep, re-execute** | **Square cells**: solid, **diagonal hatch**, open. Monochrome ink, with the pattern as the channel. No circles, no halves, no diamonds |
| 7 | `/couple/sharing`: consent ledger table + grant form | Two Keys "Who learns what" (static table on landing), KinSight consent centre | R (consent + disclosure) | **Keep, re-execute** | **Visibility matrix**: information layers (the API's three `ConsentScope` values) down the side and recipients across the top. The partner column holds live switches. The other cells are fixed by law and cite the article. Each switch writes a visible audit row underneath. The ledger table moves into a disclosure |
| 8 | Hash-chained audit + "Verify chain" (`/couple/sharing`, `/judge`) | KinSight auditor "Verify audit chain" + "Run tamper test" | R-ish (accountability) | **Keep, re-execute** | **Audit tape**: a 36 px strip pinned to the bottom of couple screens with the last events and "chain verified, N events". On the evidence page each probe shows the audit row it wrote |
| 9 | `/staff` queue table + `/staff/couples/[id]` one-page brief | Silah urgency queue + pre-visit brief + "Mark counselled"; KinSight tier filter + tiles | R (escalation to a human) | **Keep, re-execute** | **Instrument**: three panes (queue, brief, trace) on one screen, keyboard J/K. Every brief line carries a trace chip (R1, E1, C1) that links to the rule, its source and its sign-off status. No generated agenda (Silah has one) |
| 10 | `/couple/teach-back` quiz | Silah pictorial, Two Keys, KinSight 5-question | R (comprehension check) | **Keep, light re-execute** | Same quiz. Results are shown as cells (one cell per item, solid = right, open = not yet) and are visible to the counsellor in the brief's "Open" section |
| 11 | `/judge` scoreboard | Two Keys `/proof` tiles, KinSight analyst view | D (as a static page) | **Replace** | **Evidence**: a live probe console (employer, insurer, marriage-verdict question, distress text, another couple's result, CBC only, free text) on the real endpoints, above the scoreboard cells with their "does not show" lines and the NOT RUN cells |
| 12 | `/programme` KPI page | Silah funnel + "DoH target 90%" bar, Two Keys eight KPI tiles, KinSight funnel | R (programme measures in the brief) | **Keep, re-execute** | Per-case **cell strip** for each pathway step (10 seeded cases, SLA state as glyph + label), with numbers in mono. No filled progress bars and no tiles. "Seeded cases only; never national statistics (Art. 25(3))" |
| 13 | `/how-it-works` long page | Two Keys "how it works" band, KinSight scroll story | D | **Merge** | Becomes the landing's lower sections plus a short "how it is built" page. The URL stays |
| 14 | Glossary terms inline | Common | R | Keep | Glossary terms stay as inline `<dfn>` with a popover. No change |
| 15 | `/governance` page | Two Keys clause table with "Gap" column | R-ish | **Keep, re-execute** | A clause register in the same instrument table style, with law article to endpoint to test |
| 16 | Stamps "Synthetic / Draft / Pending" | KinSight banner, GeneClarity label | R (honesty) | **Keep, compact** | 28 px mono rail. The result screen adds one inline stamp |
| 17 | `/clinician` haem aid | none seen (open space) | own | **Promote** | Also linked as a probe ("Blood count only") and from case 10 on the bench |
| 18 | Closure proforma `/couple/closure` + staff proforma | Silah closes with one button | own | **Promote** | The brief's primary action. The who-fills-what split (system / clinician / patient) is shown as column cells |

## 3. What is ours alone (verified against the API, used as the spine of the new UX)

Each item lists its endpoints:
- Right not to know: `PUT/DELETE /v1/couples/{id}/right-not-to-know`. Once it is declared, `GET .../result` returns `category: null` and `withheld_reason_key: "right_not_to_know"` (`core/contracts.py:164`; the other server-side keys are `counselling_first` and `awaiting_partner_consent`).
- Bilingual reading: `GET /v1/couples/{id}/result?locale=` takes `en|ar|ur`, and `GET /v1/couples/{id}` returns `members[].language`. Seeded pairs: case 2 en+ar, case 4 ar+en, case 6 ur+en, case 9 en+ar.
- Live refusals: `POST /v1/third-party-requests` returns a 403 problem with `legal_basis`. `POST /v1/refusals/classify` returns a category (`marriage_decision`, `employer_insurer`, ...), `escalate` and a message. `POST /v1/couples/{id}/escalations/evaluate` takes `free_text`.
- Audit: `GET /v1/couples/{id}/audit` and `GET /v1/audit/verify`. The verify call is role-aware: couple members get `ok` and their own count.
- Haematology: `POST /v1/haem/interpret` and `GET /v1/haem/rules`, with sources and sign-off.
- Scoreboard: `GET /v1/eval/scoreboard`, which includes `not_run` metrics and `does_not_show`.
- Two emirate rules: `emirate_policy` on each case, in `/v1/demo/cases`.

## 4. Not verified

- The rivals' gated areas: the Two Keys counsellor desk and the GeneBridge dashboards. Either may have a pattern we now think is ours.
- Whether any rival has a right-not-to-know control behind sign-in. The rival map saw none on the public pages.
