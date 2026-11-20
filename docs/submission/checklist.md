# Pre-submission checklist

For the owner, 2026-11-20. Tick each box yourself; the documentation lane could not see the dashboard. The interface was rebuilt on 2026-11-20 (Registry Grid, ADR 0007), and every screen check below uses the new names. "Live URL" means a hosted demo only if one exists: at the time of writing no Rishta Safe resource exists in Azure (ADRs 0186 and 0187, runbook section 0, `docs/deployment-status.md`), so every check below can also be run on the local build.

## 0. Decide first

- [ ] Hosting. Choose a route from `docs/deployment-status.md` (upgrade the subscription, place the apps in the existing Container Apps environment, request a quota increase, or host outside Azure), or submit with the demo shown locally. App Service is not available on this subscription (quota 0, ADR 0187). Until `.\infra\scripts\deploy.ps1 -Action Status` prints a live location for a Rishta Safe resource, say nothing about where the demo runs. If it prints `uaenorth`, the only sentence allowed is "demo hosted in Azure UAE North on made-up data".
- [ ] Registration. The research synthesis lists as unresolved how Challenge 03 is registered and whether any person is on two teams (the FAQ says one team per person). Nothing in the repository answers it.
- [ ] Team name. Fill `[TEAM NAME]` in the report, the video title card and the deck.
- [ ] Whether to name any collaborator anywhere. The drafts name no one (ADR 0224). Do not add a clinician's name to any page as a reviewer: there is no review.

## 1. Verify on the live URL (or the local build)

Start locally with the commands in the technical report, section 12. Reset first (`POST /v1/demo/reset` or the reset control), and reset again after any smoke test, because the smoke test writes one refused request to the audit log.

- [ ] `GET /healthz`, `GET /readyz`, `GET /version` answer.
- [ ] `/en`, `/ar` and `/ur` load; Arabic and Urdu are right to left; the honesty rail ("Synthetic data", "Arabic and Urdu: draft translations", "Clinical rules pending sign-off", "Not clinical advice") is visible; the boundary statement (education and decision support, not clinical advice) is on every result screen. The landing's product sheet is tagged "From a recorded response".
- [ ] `/en/demo` (the case bench) lists ten cases, each crossed with Partner 1, Partner 2, Counsellor, Clinician and Programme ("Aggregate only"). `GET /v1/demo/personas` returned 24 personas (4 staff and 20 couple members) when counted earlier on 2026-11-20; recount if you rely on it. **Open the flagship case** opens case 2 as the first partner, on the result, with the choice skipped.
- [ ] The threshold: as `cpl-demo-02-b` (Anwar) open the result from the couple home; four options appear and none is selected; no result text is in the page before a choice. **I prefer not to know** then **Record my choice** shows "You chose not to know this result"; **I want to see my result** withdraws it. Reset the demo afterwards.
- [ ] Case cpl-demo-02 (shared gene USH2A, Usher syndrome type 2A), persona `cpl-demo-02-b`, `/ar/couple/result`, after choosing **Read it now**: `shared_result_found` is released with the 100-cell grid, in Arabic, beside the English text (Read together).
- [ ] Case cpl-demo-05, persona `cpl-demo-05-a`: the result is withheld with the reason "counselling first" (the server decides, so no threshold is shown), and no label, number or gene shows.
- [ ] Case cpl-demo-04 (Dubai policy), persona `cpl-demo-04-a` then `cpl-demo-04-b`: both start as "awaiting partner consent"; after `cpl-demo-04-a` presses **Share** on the "Couple result" row of the who-sees-what matrix, `cpl-demo-04-b` sees the result and `cpl-demo-04-a` still waits. Each change adds a row to the audit table.
- [ ] Case cpl-demo-08: both members are withheld and the certificate note is shown (the partner declined to share).
- [ ] Case cpl-demo-09, persona `counsellor`, `/en/staff/couples/cpl-demo-09`: the queue, the one-page brief and the trace pane side by side; urgent review priority, the triggers that fired, who may see what, open items; J, K and Enter move through the queue; every brief line has a trace chip. Rule text is English only, and the screen says so.
- [ ] `/en/governance`: the clause register lists seven clauses, each with its endpoint and how to try it. The live third-party refusal moved to Evidence (next items).
- [ ] Audit verification: `GET /v1/audit/verify` now answers a couple member with a reduced result (`ok` and the count of their own couple's events; `backend/src/bayan/api/routers/audit.py`), so the concern in ADR 0222 should no longer apply. Confirm on screen that **Verify chain** on `/en/couple/sharing` works as a couple member. As persona `judge`, the same route returns the full answer with `ok: true`.
- [ ] `/en/judge` as `judge`: the seven probes ("An employer asks for a result", "An insurer asks for screening status", "Ask whether to go ahead with the wedding", "A distressed message", "Open another couple's result", "A blood count only", "Your own words") each show a request, a response and an audit row, or an honest statement that no couple row was written. Below them, eleven scoreboard cells, nine measured and two hatched "Not run"; the refusal measure (first run 36 of 59, 61%) is shown first; the 100% figures are tagged "Regression gate, not safety evidence"; each value matches `backend/src/bayan/data/scoreboard.json` exactly; every cell shows its "does not show" line. Reset the demo afterwards: the probes write audit rows.
- [ ] `/en/programme` as `programme`: three large figures and simulated stamps, aggregates only. The programme persona must not be able to read any couple's result.
- [ ] Search the pages and the documents for the words that must not appear next to a result (compatible, incompatible, pass, fail, no risk, safe, high risk, moderate risk, low risk), for any sentence that says the demo is hosted in a region (ADR 0180's own mitigation), and for the retired look and names (Lineage Folio, the pedigree hero, the persona picker, the first build's seeded first names, CYP21A2 as the flagship).
- [ ] Run the frontend install once on a clean clone: `pnpm install --frozen-lockfile`, then `pnpm build`. The runbook (section 9) recorded a failure earlier today; ADR 0161 records a fix that has not been re-run on a clean clone.
- [ ] Frontend checks, last run 2026-11-20 on the local machine: `pnpm typecheck` and `pnpm lint` clean; `pnpm test` 417 passed with 11 live tests skipped; `pnpm test:e2e` (mock mode) 62 passed, 3 skipped; `pnpm test:e2e:real` against the local backend 63 passed, 2 skipped (the two skipped are mock-only); the 11 live unit tests pass with `BAYAN_LIVE_URL=http://127.0.0.1:8000`. Re-run after any change and correct these numbers.
- [ ] Route JS budget (170 KB gzip, measured with `node scripts/measure-budget.mjs` on a production build in mock mode): landing 161.3, how-it-works 161.5, governance 161.5, demo 161.5, programme 161.5, couple home 163.7, judge 165.3, staff 168.6, teach-back 167.7 and result 169.0 KB are under it. **Three routes are over it:** sharing 173.8, closure 188.3 and clinician 190.7 KB (closure and clinician were over before the redesign: react-hook-form and zod, ADR 0166). Say so wherever the budget is mentioned. Largest Contentful Paint under 0.4 s and layout shift under 0.012 on the local build (not a throttled mobile profile).
- [ ] `docker compose up --build` from the repository root starts both containers, if you intend to submit the containers.
- [ ] After any further code change: `uv run python scripts/run_evaluation.py`, then update the commit line in `technical-report.md` (it names 7dca266, the commit the scoreboard was last generated against) and re-check that the scoreboard values in the report, deck and form text still match.

## 2. Form fields

Texts are in `form-text.md` with exact character counts (253, 1,992 and 1,126 characters).

- [ ] Confirm the dashboard limits for the short description (256), the solution summary (2,000) and "what has been built" (1,500). They are provisional limits, not confirmed for this challenge (ADR 0223).
- [ ] Paste the three texts. Do not add a clinical claim, a hosting claim or a name.
- [ ] Other fields on the dashboard are unknown to this lane: team name, demo link, repository link, video link, deck upload, challenge and track selection, any declaration or consent checkboxes. Read the dashboard and fill each; do not guess a value.
- [ ] The organisers' Terms ask each participant to warrant that the work is original or built on rights the participant holds. The repository declares AI-assisted authoring (ADR 0202). Read the Terms clause yourself before ticking.

## 3. Files to attach

- [ ] `docs/submission/technical-report.md` (export to the format the dashboard asks for; keep the tables).
- [ ] The video, under three minutes, from `video-script.md`.
- [ ] The deck, with `deck-outline.md` placed into the organisers' template (the template file was not available to us).
- [ ] The repository link.
- [ ] If the dashboard asks for supporting documents: `docs/open-risks.md`, `backend/src/bayan/data/declarations/` (data declaration, limitations, regulatory posture, prior art), `THIRD_PARTY_NOTICES.md`, `docs/submission/commercial-and-pilot.md`, `docs/submission/judging-map.md` (this one is for you, not the judges, unless you decide otherwise).

## 4. Read before you submit

- [ ] `docs/open-risks.md` and its packaged copy `backend/src/bayan/data/declarations/open_risks.md` must stay identical (ADR 0206). The hosting item states a design target and no region for the demo, which is correct while nothing is deployed.
- [ ] `docs/submission/commercial-and-pilot.md`: pricing is an assumption, no buyer was contacted.
- [ ] `docs/decisions/0220` to `0225`: the calls the documentation lanes made.

## 5. Placeholders that remain

- [ ] `[TEAM NAME]` (report, video title card, deck slide 1).
- [ ] `[VIDEO LINK]` and `[REPO LINK]` wherever the dashboard or the template asks.
- [ ] The organisers' deck template (deck outline only).
- [ ] `[HOSTING LINE]` in the technical report, section 11.
- [ ] `backend/src/bayan/data/declarations/data_declaration.md`: the comment `PROVIDER AND MODEL NAME: controller to complete` and the comment `DEPENDENCY LIST`.
- [ ] `THIRD_PARTY_NOTICES.md`: the comments `DEPENDENCY TABLE`, `FONT TABLE` and `LICENCE TEXTS`, and the conditional entry for the single-item literacy screener (keep it only if the closure form ships that item).
- [ ] The commit hash and scoreboard version in the report, after the final commit.
- [ ] Screenshots for the deck and any figures: take them from the running build in English and Arabic (the landing sheet, the case bench, the threshold, read together, the who-sees-what matrix, the staff instrument, the Evidence probes and scoreboard). Screenshots in `docs/design/shots/` show the retired design and must not be used.

## 6. Only a human can do these

- [ ] Native-speaker clinical review of every Arabic and Urdu string, including the interface text of the screens added on 2026-11-20 (the threshold, read together, the matrix, the case bench, the Evidence labels). Until then every document says draft, and the drafts must not say otherwise.
- [ ] The clinical lead's sign-off of the haematology rules, detection-rate assumptions, banned-word lists, escalation triggers and priorities, and the proforma (the list is in `commercial-and-pilot.md`). Until it happens, write "sign-off pending", never "reviewed".
- [ ] A statistician's review of the correlated-miss derivation.
- [ ] The outstanding legal reads against Federal Decree-Law 49/2023 (genotype-inferred relatedness, non-targeted findings, X-linked or affected-partner visibility, the life-threat override of the right not to know).
- [ ] The ethics determination for a human comprehension study (measure M8 stays "not run" until then).
- [ ] The hosting decision, and the first deployment if you choose one: `Validate`, `Infra`, `Deploy`, `Smoke`, `Status` in that order (runbook sections 2 and 3). Nothing there has run to the end.
- [ ] Recording the video, and watching every beat once before recording (a passing end-to-end suite does not show how a screen looks).
- [ ] Reading the dashboard and pressing submit.
