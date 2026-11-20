# Judging map

Six criteria, each with a three-line self-assessment (what we show, what we cannot show, the weakest point) and pointers to the screen, file or number that evidences it. Written for the owner and for a reviewer who wants to check a claim. Rishta Safe is a prototype on synthetic data; every pointer is to something that exists in the repository on 2026-11-20. Screens are routes of the frontend under `/en`, `/ar` and `/ur` (the interface rebuilt on 2026-11-20, ADR 0007); persona ids are those listed by `GET /v1/demo/personas`. Numbers are scoreboard rows (M1 to M9; M1b and M2b are the two extra rows) unless a command is named (technical report, section 12).

Overall: strongest on responsible AI and technical depth, weakest on deployment readiness and commercial evidence. We would rather state that than have a judge find it.

## 1. Health impact and clinical relevance

- **We show:** a reported premarital result explained in plain language and read in both partners' languages side by side, a threshold that asks each person how to meet it (including the right not to know), who may see what, escalation to a human by fixed rules, the real pathway, a clinician-facing haematology aid with its rule trace as a table, and a closure proforma and teach-back instrument.
- **We cannot show:** any effect on understanding, uptake, referral or outcomes. No clinical review, field validation, comprehension study or real data exists (M8 and M9 are not run).
- **Weakest point:** clinical validity. Every rule, cut-off and detection rate awaits sign-off from the clinical lead (sign-off pending), detection rates are assumed, and the haematology rules extrapolate from England antenatal guidance.
- **Evidence:** `/en/couple/result` as `cpl-demo-02-a` (the threshold, then read together); `/en/clinician`; `/en/staff/couples/cpl-demo-09` as `counsellor`; `backend/src/bayan/haem/README.md`; `backend/src/bayan/data/declarations/limitations.md`; M8, M9.

## 2. Technical depth and architecture

- **We show:** pure-domain packages joined by one composition layer; a deterministic engine checked against an independent oracle; a disclosure property test against a reference model with deliberately broken rule sets; an explanation checker with a mutation test; strict typing and lint clean; no runtime language model, by design.
- **We cannot show:** performance under load, a database, more than one replica, or agreement with anything outside the team: the oracle and the reference model share an author with the code (M1, M5).
- **Weakest point:** every strong number is a same-team consistency result on synthetic data (the scoreboard tags the 100% figures "Regression gate, not safety evidence"), and state is in memory. Three routes are over the 170 KB route-JS budget (sharing 173.8, closure 188.3, clinician 190.7 KB gzip, measured locally on a production build; closure and clinician were over before the redesign: react-hook-form and zod, ADR 0166).
- **Evidence:** `backend/src/bayan/compose.py`; M1, M2, M2b, M5; ADRs 0003, 0100 to 0105, 0120 to 0127, 0144; technical report sections 4 to 8 and 12 (516 backend tests and 417 frontend unit tests, counted by command).

## 3. Working solution and demo quality

- **We show:** a case bench of ten seeded synthetic cases, listed by what each tests and crossed with five role lenses (shared result, no shared change with the related-couple caveat, variant of uncertain significance, blood count only, pregnancy in progress, a partner who declines to share), three locales with right-to-left layout, seven live probes on the Evidence page with the audit row each wrote, a resettable demo and a runbook. Frontend checks run on 2026-11-20: typecheck and lint clean, 417 unit tests (11 live tests skipped), 62 mock-mode end-to-end tests passed and 3 skipped; automated axe checks pass on the routes the end-to-end suite visits (that is not a claim of full accessibility).
- **We cannot show:** a hosted demo. No Rishta Safe resource exists in Azure at the time of writing (ADRs 0186 and 0187), so the demo runs locally unless the owner has secured hosting. Arabic text of the new screens has not been read by a native reviewer.
- **Weakest point:** no public URL, and a clean-container frontend install was recorded as failing earlier on 2026-11-20 (runbook section 9; ADR 0161 records a fix we have not re-run).
- **Evidence:** `/en/` and `/en/demo` (the flagship button); `/en/judge`; `docs/runbook.md` sections 0 and 9; `docs/submission/video-script.md`; cases cpl-demo-01 to cpl-demo-10; M7.

## 4. Responsible AI, safety and data governance

- **We show:** no model at run time; a closed three-label vocabulary and banned-word lists in three languages; a detection rate instead of a residual-risk number; two emirate disclosure policies; an append-only consent ledger; a hash-chained audit; third-party requests refused and logged; two-tier escalation with legal-read flags; a data declaration, limitations, regulatory posture and prior-art statement; a scoreboard that prints what each number does not show.
- **We cannot show:** legal completeness, clinical sign-off, native review of Arabic and Urdu, human comprehension, or production authentication.
- **Weakest point:** the refusal classifier refused 36 of 59 held-out prompts on its first run (61%), and the audit chain cannot detect a truncated tail without an anchor we have not built. We publish both.
- **Evidence:** `/en/governance` (the clause register and limits); `/en/couple/sharing` as `cpl-demo-02-a` (the who-sees-what matrix, whose changes each write an audit row) and as `cpl-demo-04-a`; `/en/judge` (the probes, including an employer request refused and a marriage question refused, and the scoreboard); `backend/src/bayan/data/declarations/`; M2, M4, M5, M6; ADRs 0005, 0122 to 0127.

## 5. Scalability and deployment readiness

- **We show:** repository classes with narrow methods so a database adapter can replace the in-memory state, container images, a Bicep template and deploy script checked as a template, a runbook with a cost estimate, and a UAE North design target with no model call that could leave the country.
- **We cannot show:** any deployment. Azure refused a second Container Apps environment in the regions tried, the subscription allows one in total, and App Service has a quota of 0 (ADRs 0186, 0187); the first deployment has never run; no load test or CI run on GitHub exists.
- **Weakest point:** this is the weakest criterion. Scalability here is design, not evidence, state is lost on restart by design, and the design target is not a hosting claim.
- **Evidence:** `docs/runbook.md`; ADRs 0129, 0180 to 0186; `infra/`; `docs/parking-lot.md`.

## 6. Commercial viability and path to pilot

- **We show:** a shadow-pilot design with gates (ethics determination, clinical lead's sign-off, native review, legal reads, privacy audit), measures taken from the programme's own referral KPI, a stop rule, payer hypotheses and a labelled pricing assumption with its basis.
- **We cannot show:** a buyer, a partner, a quote, a pilot site, willingness to pay or revenue. None was contacted.
- **Weakest point:** no evidence of demand. The price rests on one vendor's list prices for a different product, and a per-couple charge looks unrealistic against the mandatory service fee.
- **Evidence:** `docs/submission/commercial-and-pilot.md`; technical report section 11; ADR 0205.

## What this map does not do

It does not rate the entry against the other entries, and it does not predict a score.
