# Rishta Safe: submission deck content (Challenge 03)

Built into the organisers' template by `../tools/build_deck.py`. Every number comes from the scoreboard file in the backend data folder or from a command named in `../technical-report.md`; the sources are listed in `QA.md`. Synthetic data only. Placeholders in square brackets are for the owner to fill before upload.

## S01 Title
Team Name: Rishta Safe
Team Size: 1 registered entrant
Problem Statement: Challenge 03, Understanding and Reducing Inherited Disease Risk
@sub A companion for the UAE premarital genetic screening pathway: plain-language results in English, Arabic and Urdu, per-person sharing, a hash-chained audit log. Synthetic data; not clinical advice.

## S01b | The case in one page
**Rishta Safe helps a couple understand a reported screening result, privately and in their own language. It is strongest on responsible AI and technical depth, weakest on deployment readiness and commercial evidence.**
| Evaluation criterion | Our answer | Slide |
|---|---|---|
| Health impact and clinical relevance | Plain-language result in three languages; a threshold with the right not to know; fixed rules hand hard cases to a human. No clinical review: sign-off is pending | [[S05]], [[S07]] |
| Technical depth and architecture | Rules engine checked against an independent oracle; no runtime language model; a deterministic checker for every sentence | [[S04]], [[S04b]] |
| Working solution and demo quality | Working prototype: ten synthetic cases, three languages, live probes on an Evidence page | [[S11]], [[S11b]] |
| Responsible AI, safety and data governance | Each person's own sharing switches; employers and insurers refused; hash-chained audit; weakest figure published first (61%) | [[S05b]], [[S09]] |
| Scalability and deployment readiness | The weakest criterion: scalability is design, not evidence | [[S09]], [[S12]] |
| Commercial viability and path to pilot | A hypothesis only: a shadow pilot beside a licensed facility; no price, no buyer contacted | [[S12]], [[S12b]] |
@small Demo, video and repository links: see slide [[S11]]. All people, results and timelines in this deck are synthetic.

## S02 Team members
@sub One registered entrant.
| S.No | Name | Country | Role | Organization | Age confirmation |
|---|---|---|---|---|---|
| 1 | [ADD ENTRANT NAME BEFORE UPLOAD] | [OWNER TO FILL] | Registered entrant; clinician; the clinical lead (sign-off pending) | [OWNER TO FILL] | [OWNER TO FILL] |
@small No other person is registered. AI coding assistants helped write code and documents; they are tools, not team members, and are declared on slide [[S13]].

## S03 Team Capability Summary
**A clinician is the registered entrant and the clinical lead for this entry; the clinical lead's sign-off of every rule is pending and no clinical review is claimed.**
- **Engineering:** a Python 3.13 backend with strict typing and a Next.js 16 web app in English, Arabic and Urdu, written with AI coding assistants (declared) and checked by 516 backend tests, 417 frontend unit tests and 62 end-to-end tests, all run locally.
- **Evaluation practice:** an independent oracle, a reference model with deliberately broken rule sets, mutation tests of the checker, and a scoreboard that prints what each number does not show.
- **Gaps, stated plainly:** no clinical review, no native review of Arabic and Urdu, no legal read, no real data.
@small Evaluation criteria served: health impact; technical depth; responsible AI. [OWNER TO CONFIRM: add the engineering contributor's role if the form allows.]

## S04 Architecture or workflow diagram
@img Figure 1. System architecture. Every box is a package or screen that exists in the repository. One request: it carries a role token (1), is checked for role and disclosure policy (2), is composed across the packages (3), writes an audit row for each decision (4) and returns only released text and numbers (5). Employers and insurers are refused with HTTP 403. Outside systems are simulated and labelled, and not drawn. No language model runs at any step. Criteria served: technical depth and architecture; responsible AI, safety and data governance. | 01b-system-architecture-slide@2x.png

## S04b | Workflow: one result, step by step
@img Figure 2. Data flow of one result. The engine and the checker write no audit row; the disclosure decision and a "prefer not to know" choice do. The three categories are a closed vocabulary, not a severity scale. A variant of uncertain significance is never a result. Criteria served: technical depth; responsible AI. | 02-data-flow-one-result@2x.png

## S05 Target users and intended outcome
@cols picture-right
**Intended outcome: a couple understands a reported result in their own language and on their own terms, reaches a human when a fixed rule says so, and controls who sees it.**
| User | What they get | Outcome |
|---|---|---|
| Couple members | Choose how to meet the result; read it side by side in two languages | Understand at their own pace |
| Counsellor or clinician | A queue, a one-page brief of facts and sources, a rule trace; no recommendation | Knows why a case was escalated |
| Programme operator | Aggregates only | Sees pathway timing, no couple result |
| Evaluator | A read-only view of synthetic cases and live probes | Can try to break it |
@small Not measured yet: comprehension (M8 not run). Criteria served: health impact; working solution.
@col
@img Result read together: English with Arabic beside it, and the 100-cell grid. Synthetic couple. Arabic is a machine draft. | crop-result.png

## S05b | Who sees what
@img Figure 3. Who sees what. Only the partner column is the person's own switch; care team, national genomic database, employer and insurer are fixed by law. An employer or insurer request is refused with HTTP 403 citing Federal Decree-Law 49/2023 Art. 19 to 21 and logged. Authentication in the demo is simulated. Criteria served: responsible AI, safety and data governance. | 03-who-sees-what@2x.png

## S06 How will success be measured?
**Each measure has a pilot test. Today's figures are synthetic and mostly same-team checks.**
| Measure | How a pilot would score it | Today, on synthetic data |
|---|---|---|
| Time to counsellor brief | System timestamps from risk signal to brief: median and 90th percentile | Not measured: the clock is simulated |
| Referral within the programme's 90% target | Counts at each step: task created, booked, attended, lost | M7: 4 of 7 flagged synthetic cases (57%) within an illustrative standard |
| Comprehension by teach-back | Eight original items, within-subject, reported with intervals | M8: NOT RUN. At n=30 an 80% score has a 95% interval of 61 to 92% |
| Escalation recall | Against a set labelled by the clinical lead, misses listed | M4: 400 of 400, on cases generated from the same rules |
| Privacy | Disclosure tests over random sequences; independent privacy audit | M5: 0 mismatches in 30,527 decisions, against a same-team reference model |
@small Never a success measure: cancelled marriages or any personal choice. Criteria served: health impact; working solution; responsible AI.

## S07 Evidence supporting the approach
@img Figure 4. Evidence map: the eleven scoreboard measures, weakest figure first. The refusal check, the weakest figure, refused 36 of 59 held-out prompts (61%) on its first run, before any tuning. M8 and M9 are NOT RUN. Every value is copied from the scoreboard file. Criteria served: technical depth; responsible AI; health impact. | 04-evidence-map@2x.png

## S07b | Evidence: what each figure does not show
| Measure | Value | Method | Does not show |
|---|---|---|---|
| M6 refusal, held-out, first run | 36 of 59 refused (61%); 0 of 20 benign prompts refused | Keyword and pattern matching in three languages; run once before any tuning | Understanding; misses paraphrase, Roman-script Urdu and obfuscation |
| M1 engine against oracle | 20,000 of 20,000 synthetic couples agree | Gene-dropping pedigrees; an oracle sharing no helper code | Clinical correctness: both written by one team |
| M5 disclosure | 30,527 decisions, 0 mismatches; 10 of 10 broken rule sets caught | Random roles, grants, revocations against a reference model | Legal completeness |
| M2 and M2b explanations | 768 documents: numbers, polarity, banned words 100%; 5,760 of 5,760 faults caught | Reviewed templates, then a deterministic check | Clarity to a real reader; Arabic and Urdu are drafts |
| M4 escalation | Recall 400 of 400; precision 96% with hard negatives | Cases generated from the trigger definitions | Clinical sensitivity |
| M7 pathway | Median 11.1 days to result; 57% of flagged cases (4 of 7) referred within the standard | Backdated clock on 10 seeded cases | Real programme performance |
@small Not run: M8 human comprehension study; M9 clinical review of rules, detection rates and translations. Detection rates are assumed. Criteria served: technical depth; responsible AI.

## S07c | Evidence: published sources behind the rules
- **Haemoglobinopathy thresholds:** NHS England sickle cell and thalassaemia screening handbook for antenatal laboratories, 5th edition, October 2024 (Open Government Licence v3.0); SITE 2022 best-practice paper, J Clin Med 11(18):5426 (CC BY); British Society for Haematology 2023 guideline; Thalassaemia International Federation short guide. Cited as facts, no text reproduced.
- **Pathway, times and disclosure rules:** the Department of Health Abu Dhabi Premarital Screening Standard V3 (September 2024) and the Dubai Health Authority Standards for Premarital Screening Services V1 (effective 27 March 2026). Structure modelled, wording original, nothing copied.
- **Law:** Federal Decree-Law 49/2023 (Art. 9, 15, 19 to 21, 26). Our readings are flagged for a legal read.
- **Reporting practice:** detection rate and its limits rather than a residual number, following published carrier-screening guidance (ACMG 2021).
- **Prior testing:** our own, on synthetic data only (slides [[S07]] and [[S07b]]). No field study, no comprehension study, no clinical review.
@small Criteria served: health impact and clinical relevance; responsible AI, safety and data governance.

## S08 Data sources and legal right to use them
**All data is synthetic and authored for the prototype. The rules are based on public guidance and are unreviewed. No personal data is used, collected or seen.**
| Source | Type, owner, sensitivity | Permission | Personal data |
|---|---|---|---|
| Synthetic couples and results | Generated with a fixed seed, authored for the prototype; not sensitive | Ours | None |
| Rule, panel and condition tables | Hand-written; each row cited or flagged illustrative; sign-off pending | Ours | None |
| NHS England SCT handbook; SITE 2022 paper | Public guidance and a published paper; thresholds cited as facts | Open Government Licence v3.0; CC BY (version not confirmed) | None |
| UAE standards and statute (DoH Abu Dhabi V3, DHA Dubai V1, Decree-Law 49/2023) | Public documents; used as structure; wording original | No reuse licence stated: nothing copied | None |
@small Not used: AVDB (all rights reserved), GeneReviews, OMIM, gnomAD, five named questionnaires. The organisers supplied no data. Criteria served: responsible AI, safety and data governance.

## S09 Risks and safeguards
| Risk | Safeguard | Stated limit |
|---|---|---|
| Privacy | Synthetic data; each person's own consent; a right not to know; audit rows with pseudonymous ids | The audit chain is in memory and cannot detect a cut tail without an anchor not yet built |
| Security | Signed role tokens; third-party requests refused with HTTP 403 | Sign-in is simulated: not production security |
| Bias and language | Three languages from one template set; numbers checked in each | Arabic and Urdu are machine drafts without native review; no Arabic or Urdu readability score |
| Explainability | No runtime language model; every sentence from a reviewed template; rule trace shown | Rules await the clinical lead's sign-off |
| Misuse | Employers and insurers refused; marriage questions refused, never scored | Refusal classifier: 61% on its held-out first run |
| Human oversight | 21 fixed triggers in two tiers hand cases to a human; briefs make no recommendation | Triggers unvalidated; recall measured on cases from the same rules |
| Failure modes | The checker refuses release on any mismatch; a blood count alone gives no carrier statement | State is held in memory: a restart resets; no load test |
@small Criteria served: responsible AI, safety and data governance; scalability and deployment readiness (the weakest).

## S10 Hardware requirements
**None. Rishta Safe is software only: no wearable, sensor, connected device or other hardware is needed, so no hardware sourcing or safety requirement arises.**

A current web browser on a phone or computer is enough. Criteria served: working solution and demo quality.

## S11 Login authentication: guest access, no credentials needed
@cols
**Guest access with every feature is enabled; no credentials are needed. A case bench lists ten synthetic cases, and choosing a persona starts a simulated session with no password.**
- Open the case bench and press "Open the flagship case": it opens the first partner of a synthetic couple on the result.
- The Lens control in the header switches to the second partner, a counsellor, a clinician, the programme operator or a read-only evaluator, in English, Arabic or Urdu.
- Demo link: working prototype shown in the video; the demo link is entered in the submission form. [OWNER TO FILL: demo link] [OWNER TO FILL: video link] [OWNER TO FILL: repository link]
@small One-time-code sign-in exists but is simulated and labelled as such. Criteria served: working solution and demo quality.
@col
@img The case bench: ten synthetic cases crossed with five role lenses. | crop-bench.png

## S11b | Working prototype: the threshold and the Evidence page
@cols
@img The threshold, before any result text is fetched: four options, none preselected. | crop-threshold.png
@col
@img The Evidence page: a live probe, "An employer asks for a result", refused with HTTP 403, and the audit row it wrote. | crop-evidence.png

## S12 Path to pilot and scale
**A shadow pilot beside one licensed facility, gates first. Today it is a plan: no partner, buyer or pilot site has been contacted.**
| Topic | Plan or assumption |
|---|---|
| Stakeholders | A licensed screening facility; a clinical lead; a native clinical reviewer for Arabic and Urdu; an ethics route; a statistician |
| Pilot design | Rishta Safe runs beside the facility's normal flow. No result reaches a couple through it; staff compare its output with their own |
| Integration | Every outside system is simulated. A pilot needs an identity provider, durable storage with an anchored audit chain, monitoring |
| Regulatory needs | Ethics determination; clinical sign-off; legal reads against Decree-Law 49/2023; the facility's security and responsible AI assessment; an independent privacy audit |
| Timeline assumptions | Durations are set with the facility; none is stated here |
| Sustainability | A hypothesis: a programme operator or licensed centre might pay. No price, no revenue figure |
| Scale | Design, not evidence: times, policies and templates are data files; two emirate policies exist |
@small Criteria served: commercial viability and path to pilot; scalability and deployment readiness.

## S12b | Path to pilot: one pathway, gates first
@img Figure 5. One-pathway pilot path. Dashed squares are gates not yet done; the hatched square is the shadow pilot, in which no result reaches a couple through Rishta Safe. No price and no duration are stated. Cancelled marriages are never a measure. Criteria served: commercial viability and path to pilot. | 05-pilot-path@2x.png

## S13 Pre-existing IP and third-party materials
| Item | Ownership, licence and restriction |
|---|---|
| The prototype | Authored for this entry; no code copied from other entries or repositories. [OWNER TO CONFIRM: the copyright holder] |
| Open-source software | Backend: 8 direct runtime dependencies, 26 packages with transitive ones, all permissive except certifi (MPL-2.0, unmodified); none is a model client. Frontend: Next.js 16 and React 19 (MIT), plus others listed in THIRD_PARTY_NOTICES.md |
| Libraries with notes | sharp's libvips binaries are LGPL-3.0-or-later, used as separate libraries; caniuse-lite is CC-BY-4.0 (build-time data) |
| Published content used | NHS England handbook under Open Government Licence v3.0 (attributed); SITE 2022 under CC BY. Facts cited, no text reproduced |
| Fonts | Archivo, Red Hat Mono, Noto Kufi Arabic, Noto Naskh Arabic, Noto Nastaliq Urdu: SIL Open Font License 1.1, self-hosted |
| Deliberately not shipped | AVDB, a 2025 supplement (CC BY-NC-ND), GeneReviews, OMIM, gnomAD, five named questionnaires, the standards' forms and gene list |
| AI assistance | AI coding assistants helped write code and documents; a cloud language model may have helped draft template text. No personal or realistic data went to either. No language model runs at run time |
@small Details: THIRD_PARTY_NOTICES.md and the data declaration in the repository. Criteria served: responsible AI, safety and data governance.

## S14 Conflict of interest declaration
**[OWNER TO CONFIRM BEFORE UPLOAD: write "None declared" only if it is true for the registered entrant; otherwise list each relationship with the organisers, partners or judges.]**

What the repository can show: the organisers supplied no data and none was requested; no partner, buyer or pilot site has been contacted; and no clinical review or sign-off has taken place.

@small Criteria served: responsible AI, safety and data governance.

## S15 | Additional Slide: what we do not claim, and what a pilot would prove
@cols
**Not claimed**
- Clinical review or sign-off: the clinical lead's sign-off is pending.
- A comprehension study (M8) or any effect on uptake, referral or outcomes.
- Real data, field validation, or a connection to any national or emirate system: all are simulated.
- Correct Arabic or Urdu: both are machine drafts without native review.
- A residual-risk number, a marriage decision or a score. Detection rates are assumed.
@col
**A pilot would prove**
- Whether people understand the result (teach-back with intervals).
- Whether referral and time to counsellor improve.
- Whether the rules, translations and escalation triggers are clinically right.
- Whether consent and audit hold up under real use, and whether the checker ever fails.
@small Criteria served: responsible AI, safety and data governance; health impact and clinical relevance.
