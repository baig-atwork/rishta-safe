# Rishta Safe: technical report

Abu Dhabi Future Health Challenge, Challenge 03 (Understanding and Reducing Inherited Disease Risk). Draft of 2026-11-20 for the owner's review. Team name: [TEAM NAME]. Code state: commit 7dca266, plus the commit that adds the regenerated scoreboard (section 12).

**Read this first.** Rishta Safe is a prototype on made-up data. It is education and decision support, not a medical device, a diagnosis or clinical advice. No clinical review, field validation, comprehension study or real data stands behind it. Every clinical rule, cut-off and detection rate awaits sign-off from the clinical lead (sign-off pending). Arabic and Urdu text is machine-drafted and has had no native clinical review. Every evaluation number was measured on synthetic couples, several against code or rules written by the same team, and detection rates are assumed. Each number here is copied from `backend/src/bayan/data/scoreboard.json` or comes from a command named in section 12.

## 1. The problem, and the challenge's six items

Screening helps only if people understand a carrier or couple-level result, reach qualified counselling and choose in line with their values, without one family member's information reaching another unasked. The organisers supply no data. Rishta Safe's answer is deliberately narrow: it explains a result a licensed programme has already reported, shows who may see what under each emirate's published rule, escalates to a human by deterministic rule, tracks the real pathway and closes the loop with a clinician proforma. It does not screen, test or counsel.

Paths below are under `backend/src/bayan/` unless they begin with `frontend/` or `docs/`.

| # | Challenge item (shortened) | What we built | Where | Evidence | What it does not show |
|---|---|---|---|---|---|
| 1 | Plain, non-stigmatising explanation with uncertainty and the risk-versus-diagnosis line | Result in three languages from reviewed templates, read together in both partners' languages side by side; 100-cell tally grid; detection limits; related-couple caveat; boundary notice | `explain/`, `data/templates.*.yaml`, `frontend/src/components/result/` | M2, M2b, M3 | That anyone understands it: no comprehension study; Arabic and Urdu are drafts |
| 2 | Informed, values-sensitive choices without directing | Options pane in fixed article order; the threshold, a four-way choice before a result is rendered (read now, with a counsellor first, not yet, prefer not to know, the last recorded as the right not to know); three labels; no marriage-decision field | `explain/service.py`, `data/closure.yaml` | ADR 0005, 0143; M2, M6 | That a clinician or user finds the wording neutral; screening access is a simulated hand-off |
| 3 | Qualified human counselling; education versus advice boundary | 21 deterministic triggers in two tiers, counsellor queue and one-page brief, refusal classifier | `governance/escalation.py`, `compose.py` | M4, M6 | Clinical sensitivity of the triggers; refusal of paraphrase (61% held-out first run) |
| 4 | Privacy-preserving family workflows | Append-only consent ledger, role-based disclosure, two emirate policies, hash-chained audit, third-party refusals | `governance/` | M5 | Legal completeness; sharing with relatives (cut); durable storage |
| 5 | Safe linkage to services | 15-state, 20-event pathway machine from the two standards, FHIR-shaped referral tasks, 12-field proforma; outside systems simulated | `journey/`, `data/pathway.yaml` | Property test over random event sequences; M7 | Integration or real referral performance |
| 6 | Measurable comprehension and access, cancelled marriages not the measure | Scoreboard of 11 measures (9 run, 2 not run), five-item teach-back per result type, programme aggregates | `evalkit/`, `data/scoreboard.json` | M1 to M9 | Comprehension, uptake or equity by language and literacy: M8 not run |

## 2. What Rishta Safe is and is not

Rishta Safe is a couple-result companion for the UAE premarital genetic screening pathway. For a reported result it explains it in plain English, Arabic and Urdu (the last two right to left), shows who may see what, escalates complex cases by rule, follows the two standards' states and times, and records closure. Views exist for a couple member, a counsellor, a clinician, a programme operator (aggregates only) and a read-only evaluator.

It is not a diagnosis, device or clinical advice, and every result screen says so. It does not order or report a test, counsel (Decree-Law 49/2023 Art. 7(1) names a specialist physician or genomics specialist) or issue a certificate. It has no marriage-decision field, score or residual-risk number. It does not hide data from the state, a statutory recipient (Art. 26(2)). It is not connected to Emirates Health Services, Malaffi, the Emirati Genome Programme, DoH or DHA: every such connection is simulated and labelled. We do not claim to be first at laboratory-value interpretation; we claim only a traceable rule trace. We cut private set intersection (ADR 0004).

## 3. The pathway, modelled from the two published standards

The pathway, times and disclosure rules come from the Department of Health Abu Dhabi Premarital Screening Standard V3 (September 2024) and the Dubai Health Authority Standards for Premarital Screening Services V1 (effective 27 March 2026). We modelled structure and wrote original wording citing the clause followed. We did not copy forms, report layouts, risk statements or the gene list.

`data/pathway.yaml` defines 15 states (registered through report_ready, then result_clear or counselling_pending, counselling_booked, counselling_done or counselling_declined, certificate_withheld, declaration_signed, certificate_issued, judicial_handoff_sent, closed) and 20 events, five of them side events (brief generated, confirmatory test, specialist referral). The screening visit is a simulated hand-off to a licensed centre; neither standard has home collection (ADR 0141). A partner who declines to share leads to `certificate_withheld`, the tension both standards describe, shown rather than hidden.

Times are data. Laboratory work starts within 24 hours; the genetic result is due in 21 days (Abu Dhabi policy) or 28 days (Dubai policy), because the standards disagree; a certificate is valid three months. The Abu Dhabi programme tracks a 90 percent target for referring positive genetic cases to a counsellor. No standard sets a time limit for that referral, so our 14-day timer and related thresholds are flagged illustrative (ADR 0148).

Seven outside systems (licensed centre, two laboratory types, result feed, certificate service, judicial department, national genomic database) are simulated and labelled in all three languages. Referral tasks are shaped like an HL7 FHIR R5 Task; no FHIR server exists (ADR 0150). Invariants in `journey/machine.py` are property-tested: no flagged couple without a counselling task; a rejected or failed counselling task spawns a replacement; no case closes with an open task or, if flagged, without a clinician proforma; times never go backwards.

## 4. Architecture

The backend is Python 3.13 (FastAPI, Pydantic v2, structlog, uv) with eight runtime dependencies, none a model client. Pure-domain packages sit behind a thin HTTP layer: `core`, `genetics` (engine, catalogue, synthetic generator, independent oracle), `haem`, `governance`, `journey`, `explain`, `evalkit`, `demo` and `api`. Each exposes a small service class with typed inputs and outputs; only `compose.py` calls across them (compute, filter for the viewer, render, communicate, brief a human). Genetics computes and never decides who sees what; governance decides and never words anything; explain words and never computes.

The API has 44 operations on 40 paths under `/v1`, plus three health routes, with RFC 9457 problem details and a correlation id. State is in memory behind small repository classes with narrow methods, so a database adapter can replace them; a Postgres adapter is parked (ADR 0129, 0182). The demo is seeded, resettable and meant for one replica. The clock is injected, so every timing is simulated, not a measured wait.

Nothing generates text at run time. The explainer fills reviewed templates with typed slots, and a deterministic checker re-derives every allowed number and refuses to release a document that disagrees (ADR 0003, 0144). We chose this because a numeric hallucination in a genetic result is the worst failure available, the best verifier we found agreed with clinicians only 89 to 93 percent of the time, and Arabic and Urdu model output cannot be measured honestly without native reviewers. A cloud language model may have helped draft static template text and AI coding assistants helped write code and documents; both are declared (ADR 0202), no personal or realistic data went to either, and the provider's output terms were not reviewed. The cost is less fluent text and slower growth of wording.

### The frontend (rebuilt on 2026-11-20)

**Stack.** Next.js 16 (App Router, webpack build), React 19, strict TypeScript 6, Tailwind CSS 4, next-intl for three locales (English, and Arabic and Urdu right to left), TanStack Query and react-hook-form with zod on the form screens, ESLint 9 with strict jsx-a11y (ADR 0160 to 0167). Result and clinical wording comes from the API response and components only lay it out. Every other string is in message files, and the Arabic and Urdu files are drafts awaiting native clinical review, including the interface copy of the screens added on 2026-11-20.

**Design direction.** Registry Grid (ADR 0007, `docs/design/v2/`), which replaced the first build's look: a dark ink hero, cool mineral-white pages, one lapis accent, hairlines instead of shadows. The signature element is the tally grid, square cells that are solid, hatched, open or dashed (pending). It draws the 100-cell result grid, the category chip, the who-sees-what matrix, the threshold options, the evidence cells and the case bench, and hatching gives each state a second channel beside colour. Fonts are self-hosted under the SIL Open Font Licence and listed in `THIRD_PARTY_NOTICES.md`: Archivo for Latin text, Red Hat Mono for identifiers and figures, Noto Kufi Arabic for the Arabic interface, Noto Naskh Arabic for Arabic reading text and Noto Nastaliq Urdu for Urdu reading text.

**Interaction model.**
1. *Case bench* (`/demo`): ten seeded synthetic cases listed by what each tests, crossed with role lenses (partner 1, partner 2, counsellor, clinician; the programme role is aggregate only), a flagship shortcut and a "skip the choice" link, and a compact Lens control in the header.
2. *The threshold*: before a result is rendered, each person chooses read now, read with a counsellor first, not yet or prefer not to know. Nothing is preselected. Only "prefer not to know" is written to the server (`PUT` and `DELETE /v1/couples/{id}/right-not-to-know`, Federal Decree-Law 49/2023 Art. 9(2)); the other three choices stay in the browser. The result text is not fetched or rendered before a choice (ADR 0170).
3. *Read together*: the same result text in both partners' languages side by side, from two locale calls; on a phone one language shows by default (ADR 0171).
4. *Who sees what*: a visibility matrix in which only the partner column is the person's own switches. The care team, national genomic database (Art. 26(2)), employer and insurer (Art. 19 to 21) columns are fixed and cite the articles. Each change appends an audit row, and the consent ledger table stays under a disclosure (ADR 0172).
5. *Evidence* (`/judge`): seven live probes (an employer request, an insurer request, a wedding question, a distress sentence, another couple's result, a blood count only, free text) sent through server actions to the real endpoints, each showing the request, the response and the audit row it wrote or an honest statement that it wrote no couple row (ADR 0174). Below them is the 11-measure scoreboard with not-run cells hatched, the weakest figure (refusal, held-out first run, 36 of 59, 61%) shown first, and the 100% figures tagged "regression gate, not safety evidence" (ADR 0169).
6. *Staff instrument* (`/staff`): queue, one-page brief and trace pane side by side. Every brief line links to its rule and source, nothing is generated, and J, K and Enter move through the queue (ADR 0178). The haematology aid is a two-pane instrument with its rule trace as a table (ADR 0179), and the programme page shows three figures and simulated stamps, aggregates only.

The landing page's product sheet reads committed recordings of API responses and says so (ADR 0175).

**Accessibility.** Automated axe checks (WCAG 2 A and AA and WCAG 2.2 AA rules) pass on the routes the end-to-end suite visits. That is an automated check only: it is not an accessibility audit, and no manual audit or assistive-technology user test is recorded.

**Checks and budget, local machine, 2026-11-20.** Typecheck and lint are clean. 417 Vitest tests pass (11 live tests are skipped unless a backend is named). The Playwright suite passes 62 tests with 3 skipped in mock mode, and 63 pass with 2 skipped against the real backend (the 11 live unit tests also pass). Route JavaScript on a production build in mock mode (gzip, `node scripts/measure-budget.mjs`) against a 170 KB budget: landing 161.3, how-it-works 161.5, governance 161.5, demo 161.5, programme 161.5, couple home 163.7, judge 165.3, staff 168.6, teach-back 167.7 and result 169.0 KB are under it. **Three routes are over it:** sharing 173.8, closure 188.3 and clinician 190.7 KB. Closure and clinician were already over before the redesign because of react-hook-form and zod (ADR 0166); lazy-loading the form libraries is parked. Largest Contentful Paint was under 0.4 s and layout shift under 0.012 on the local build. This is not a throttled mobile profile.

## 5. The result engine, the haematology aid and the limits of a negative result

The engine classifies a couple into three labels, `shared_result_found`, `no_shared_change_found` and `more_information_needed`; staff also see a review priority a couple never sees. Two carriers of one recessive condition get 25 affected, 50 carrier and 25 neither per 100 pregnancies, as integers over a fixed denominator; affected plus carrier gives 50 and 50; X-linked conditions give lines per 100 sons and per 100 daughters. Carriers of different conditions at the haemoglobin beta locus pair into a compound disorder (ADR 0100). A variant of uncertain significance is never counted. A pending report or a blood-count-only work-up can never give a shared or no-shared statement. A locus is compared only when both panels cover it (ADR 0102). Review priorities and severity tiers are our own illustrative rules (ADR 0105). The vocabulary is closed because the programme's own words can read as a verdict on a couple; banned-word lists in three languages (38, 38 and 32 terms plus match patterns) are enforced by the checker.

The haematology aid is clinician-facing. From a blood count and optionally an HPLC result it returns one of 11 labels (3 for a blood count alone, 8 with HPLC), the rules fired with source, and a not-a-diagnosis notice. Its 24 rules draw on six cited source entries (an NHS England antenatal laboratory handbook, the 2023 British Society for Haematology guideline, a Thalassaemia International Federation guide and an Italian best-practice paper) and run in a whitelisting `ast` interpreter, never `eval`. A blood count alone cannot yield a carrier, normal or disease label; the loader refuses it. Missing values are never imputed. Limits: sources disagree on four parameters (MCV cut-off, borderline HbA2, iron deficiency first, post-transfusion wait), written into the rules and not yet configurable; the rules extrapolate from England antenatal guidance to non-pregnant UAE adults; alpha-thalassaemia needs DNA; the 20 fixtures were written by the rules' author, so they show internal consistency only. Every rule awaits the clinical lead's sign-off.

For negative results the product shows a detection rate and its limits, never a residual-risk number. Panel detection rates are assumed (90 and 95 percent in `data/panels.yaml`) and flagged illustrative. For related partners a negative test lowers the chance less than the naive per-partner update suggests, because a missed variant is shared by descent. Our internal closed form, returned by no route (ADR 0101), gives an understatement of 16.8 times for first cousins at carrier frequency 0.02 and assumed detection 0.8, and 63.7 times at 0.005 (`genetics/residual.py`, computed 2026-11-20). The derivation is ours and unreviewed by a statistician. So every statement for a related couple carries the caveat and no figure.

## 6. Disclosure, consent, audit and the certificate tension

A couple member sees their own findings (unless they recorded a right not to know) and a partner's findings only to the scope the partner granted (`couple_result_only`, `gene_names_only`, `full_variant_detail`; none by default). A counsellor or clinician sees the staff view of assigned couples, audited on every access. The programme operator sees no couple result, enforced in code; a judge has a read-only view of synthetic cases; external parties see nothing.

The consent ledger is append-only: a grant is one line, a revocation another. Mandatory couple screening is not consent-based (Art. 4(2)(a), 15); it is recorded with a statutory basis that grants nothing and cannot be revoked. Revocation stops disclosure and deletes nothing; the Art. 8 deletion workflow is cut (ADR 0130).

The two policies differ only where the sources do. Under Abu Dhabi, one joint report: after post-test counselling the couple-level label reaches both partners. Under Dubai, a `shared_result_found` is withheld from a member until every other member with an abnormal finding has granted at least `couple_result_only`. Under both, a shared label waits for recorded counselling (for Dubai a labelled product safeguard, the text unconfirmed) (ADR 0122). On 2026-11-20 we ran the app in process on the seeded Dubai case with two carriers: both members saw "awaiting partner consent"; after one granted the other, the other saw `shared_result_found` and the first still waited; after both granted, both saw it and the certificate note disappeared.

The certificate tension is shown. Both standards withhold the certificate if a partner refuses to share or sign (Abu Dhabi 3.3.12.1, Dubai 9.1.10b), so individual control is real until the certificate is needed. A right not to know (Art. 9(2)) removes everything result-related from that person's view. Where life or fetal life may be threatened, the statute compels disclosure but does not say an app must deliver it, so the app view stays withheld and an accredited professional is alerted, flagged for a legal read (ADR 0123).

The audit chain records each disclosure decision, consent change, refusal, escalation and denial with pseudonymous ids; no free text or result enters it. Each event stores the SHA-256 of its canonical JSON and the previous hash; tests tamper with, reorder, delete from and insert into the chain. It cannot detect truncation of its tail without an external anchor, which is not built, and it is in memory (ADR 0125, 0129). Third-party requests from an employer, insurer or relative are always refused with HTTP 403 citing Art. 19 to 21 and logged. Authentication is simulated (ADR 0120, 0131).

## 7. Escalation and the refusal classifier

Escalation is 21 named deterministic triggers in `data/escalation_rules.yaml`, each with a source (or "design rule"), a tier, a due-by key and `needs_clinician_signoff: true`. They cover an affected partner, shared and severity-A results, a variant of uncertain significance, X-linked findings, pregnancy in progress, distress and crisis phrases in three languages, the right-not-to-know override and others. Two tiers exist because the federal programme's counsellors are trained physicians, not genetics professionals: `counsellor` (8 triggers) and `accredited_geneticist` (13). Due-by keys (`immediate`, `same_session`, `fast_track`, `routine`) are never days, because time targets belong to the clinical lead. Ten triggers carry a legal-read flag. The counsellor brief is one page of facts and sources and makes no recommendation. M4 measures implementation consistency, not clinical sensitivity.

The refusal classifier is keyword and regular-expression matching on normalised English, Arabic and Urdu text with 102 patterns, all applied to every request because people code-switch. It refuses diagnosis, treatment advice, "should we marry", termination advice, lineage inference, employer and insurer questions and another person's result; marriage, termination, lineage and other-person requests also notify a counsellor. Its honest number is the held-out first run, recorded once before any tuning: 36 of 59 must-refuse prompts refused (61%) and 0 of 20 benign prompts wrongly refused. The 23 misses are natural paraphrases and stay in the set. Nothing in the product generates free text, so a miss does not produce an unsafe answer; it fails to route a distressed or high-impact question to a counsellor, which is why escalation also reads distress phrases.

## 8. The explainer, closure and teach-back

The explainer has 83 templates and 34 glossary terms per language, with typed slots and no typed digits; ids and slots match across languages, checked at load. English is draft too: every template carries `language_status: draft`, every document opens with a draft notice and the checker refuses a document that claims review (ADR 0140). The checker verifies numeric fidelity (printed digits, after normalising Western and Arabic-Indic forms, equal declared numbers, which equal engine numbers), polarity (wording matches the label; a withheld document shows no label, number or gene) and banned words. `render` raises `RuleViolation` on any failure. The mutation test injects faults with 11 operators and the checker must reject each (M2b).

Closure has no marriage field. The clinician proforma has 12 fields and one optional note, anchored structurally on the UK PRSB outpatient letter standard and HL7 FHIR Task. The patient has eight original items, scored item by item with no total, and an optional single-item literacy stratifier (CC BY). Five named instruments (Decisional Conflict Scale, Decision Regret Scale, GCOS-24, MMIC, Newest Vital Sign) are not shipped, because their terms bar it or none were found (ADR 0145, 0201). Service interest is opt-in; no marriage intention or outcome is recorded (ADR 0143). The teach-back quiz has five items for each of three result types in three languages, and every quiz object carries `human_comprehension_test_run: false` (ADR 0146).

## 9. The evaluation

Every row is copied from `backend/src/bayan/data/scoreboard.json` by a script, not retyped (ADR 0221). The file records code version 7dca266 and was generated at 2026-11-20T16:39:21.487657Z. Nine measures were run; two were not.

| ID and status | Measure | Value | Method | What it does not show |
|---|---|---|---|---|
| M1, measured | Result engine versus an independent oracle | 20,000 of 20,000 synthetic couples agree (100%) | Couples are generated by gene dropping through unrelated, second-cousin, first-cousin-once-removed, first-cousin and double-first-cousin pedigrees with ground-truth genotypes. An allele-level oracle that shares no helper code with the engine classifies each couple; the engine's category, shared conditions and outcome lines must match exactly. Ruleset rishta-safe-couple-1.0+b682d63abbf0; seed 20261120. | Agreement between two implementations written by the same team. It does not show that the rules are clinically right, and several carrier frequencies are illustrative. |
| M1b, measured | Random-mating at-risk rate against the closed form | observed 2.28% against closed form 2.33% (autosomal loci of the demo panel) | Unrelated couples drawn under Hardy-Weinberg; the share with at least one autosomal locus where both carry a pathogenic allele, compared with the independent closed form. Published figures are shown as context only: AVDB-style sum of squared carrier frequencies, about 425 genes, random mating: 4.0%; UAE federal programme couples labelled incompatible: 4.0%. | A bracket, not a validation: the demo panel is small and illustrative, and the published programme figures use different panels and definitions. |
| M2, measured | Numeric fidelity, polarity and banned words in rendered explanations | 768 documents (256 scenarios, 3 languages): numbers 100%, polarity 100%, banned words absent 100% | Every scenario is rendered in English, Arabic and Urdu from reviewed templates, then checked: every number equals an engine number, the text says what the engine said, and no banned wording appears. | That the wording is clear to a real person, or correct in Arabic and Urdu: those texts are machine-drafted and no native clinical reviewer has read them. |
| M2b, measured | Does the checker catch injected faults? | 5,760 of 5,760 injected faults caught (100%) | Flipped numbers, flipped polarity and inserted banned words are injected into rendered text; the checker must reject each. | Only the fault types listed in the method; a fault of a kind we did not think of would not be counted here. |
| M3, measured | Readability of the English text | Flesch-Kincaid grade 5.3 on average, 6.5 at most | Flesch-Kincaid grade computed on every rendered English document. | Understanding. No validated Arabic or Urdu readability standard exists, so no Arabic or Urdu readability score is computed or claimed. The English figure is a Flesch-Kincaid grade computed with a syllable heuristic (about one grade of error) and says nothing about the Arabic or Urdu drafts. Reading level in those languages needs human lay readers. |
| M4, measured | Escalation triggers: recall and precision on a generated edge-case set | recall 100% (400 of 400 must-escalate cases); precision 100% on easy negatives, 96% including hard negatives | Must-escalate and must-not-escalate cases are generated deterministically from the trigger definitions. | The must-escalate cases are generated from the same trigger definitions the engine reads, so recall measures implementation consistency, not clinical sensitivity. Trigger completeness and tier assignments are unvalidated (clinical sign-off pending). |
| M5, measured | Disclosure properties against an independent reference model | 2,000 randomised sequences, 30,527 disclosure decisions (13,772 allowed, 16,755 denied): 0 mismatches with the reference model, 13,772 leak scans clean; 10 of 10 deliberately broken rule sets caught | Random sequences of roles, grants, revocations, expiries, right-not-to-know and policy choices. Each decision is compared with a short reference model written from the rules that imports no policy code, and every allowed view is scanned for text it should not contain. Deliberately broken rule sets (mutants) must each be caught. | That the rules are legally complete. The reference model and the implementation share an author; several triggers still need a legal read against Federal Decree-Law 49/2023. |
| M6, measured | Refusal compliance on a labelled prompt set (English, Arabic, Urdu) | held-out set, first run before any tuning: 36 of 59 refused (61%), 0 of 20 benign prompts wrongly refused; tuned set: 70 of 70 refused (179 prompts in total) | Keyword and pattern matching on prompts that ask for a diagnosis, whether to marry or cancel, termination advice, lineage inference, or employer or insurer access. The held-out set was run once before any tuning; that first run is the number to read. The tuned set is shown only to show the tuning worked. | Keyword and pattern matching on normalised text, not language understanding. It misses paraphrase, broken plurals, colloquial forms, Roman-script Urdu, Arabizi and obfuscation, and refuses some harmless sentences that contain a listed phrase. Nothing in the product generates free text, so a miss does not produce an unsafe answer; it fails to route a high-impact or distressed question to a counsellor. Prompt sets are synthetic and written by the same engineer as the patterns. |
| M7, measured | Pathway timing and referral share on the seeded cases (simulated) | 10 synthetic cases, 7 flagged: median time to result 11.1 days; 57% of flagged cases (4 of 7) referred within the standard (target 90%) | Computed from the stored synthetic cases; event times come from a backdated clock. | Real programme performance. The timings are scripted, the referral standard is illustrative, and no external system is connected. |
| M8, not run | Human comprehension (teach-back) study | Not run. A protocol exists; the ethics exemption question is unanswered. | Within-subject teach-back on hypothetical couples, five items, stratified by language and a literacy proxy. At n=30 an 80% score has a 95% interval of 61 to 92%, so the study would be reported with intervals, never as proof. | Everything: no comprehension, uptake or decision-quality claim is made. |
| M9, not run | Clinical review of rules, detection rates and translations | Not done. Every rule and every Arabic and Urdu string is a draft awaiting sign-off. | Sign-off by the clinical lead (rules) and a native clinical reviewer (languages). | Any clinical validity. |

The file also records a 95 percent interval for M1 of 0.9998 to 1.0, and the commands `uv run python scripts/run_evaluation.py` for M1 and M5. The seed is 20261120 wherever a seed applies.

The scoreboard's own caveats, verbatim:

- All people, results and timelines are synthetic. Nothing here measures a real programme.
- Several figures compare an implementation with another written by the same team.
- Detection rates, severity tiers and some carrier frequencies are assumed or illustrative and flagged so.
- Arabic and Urdu text is machine-drafted and has had no native clinical review.
- No clinical review, field validation or comprehension study has been done.

## 10. What we did not do, and why

- **Private set intersection:** the output leaks and the state is a statutory recipient; privacy here is horizontal (ADR 0004).
- **A runtime language model** (ADR 0003), **a residual-risk number, score or pre-test risk** (ADR 0005, 0149), **a marriage-decision field** (ADR 0143).
- **Named instruments, the standards' text and gene list, bulk third-party data:** licence terms bar them (ADR 0145, 0200, 0201).
- **Family cascade invitations:** they need a channel, an identity and a legal read (ADR 0128).
- **Durable storage, audit-head anchor, Art. 8 deletion, production authentication:** data is synthetic and in memory (ADR 0129 to 0131).
- **Semantic or Roman-script refusal:** not evaluated (ADR 0132).
- **Home collection, Pakistan variant, voice entry:** no basis in either standard, and no honest way to measure speech (ADR 0141, 0142, 0002).
- **A human comprehension test:** no ethics determination (ADR 0146).
- **Configurable haematology parameters, specialist-read pairings, sex-aware X-linked pedigrees:** parked (ADR 0100, 0103, 0104).
- **Infrastructure hardening** (ADR 0184) and **a deployed demo** (section 11).
- **Native review of the interface copy:** the new Arabic and Urdu interface text (the threshold, read together, the matrix, the case bench, the Evidence labels) is draft.
- **Translating the evidence and the staff brief:** the scoreboard figures and the brief's rule text are English only and marked so on the Arabic and Urdu pages (ADR 0169).
- **Bringing three routes under the JS budget:** sharing, closure and clinician are over 170 KB gzip (173.8, 188.3 and 190.7); lazy-loading the form libraries is parked (ADR 0166).
- **Server-side record of every threshold choice:** only "prefer not to know" is recorded on the server and in the audit log; "read now", "with a counsellor first" and "not yet" stay in the browser and do not follow a person to another device (ADR 0170).
- **A sourced carrier frequency for the flagship gene:** the USH2A carrier frequency behind case 2 is illustrative (ADR 0008).
- **Clinical sign-off, native review of Arabic and Urdu, legal reads, a statistician's review:** not done.

## 11. The production path

The design target is Azure UAE North: Federal Law 2/2019 Art. 13 (read from secondary summaries) and the DoH Responsible AI Standard cl. 3.1.4.5.1 point to in-UAE storage and compute for identifiable data, and no runtime model call could leave the country. **Where the demo runs, at the time of writing:** no Rishta Safe resource exists in Azure. The deployment code was checked as a template only; Azure refused a second Container Apps environment in `uaenorth` and `germanywestcentral` (the subscription allows one in total), `westeurope` was not accepting new customers, and App Service plans have a quota of 0 on this subscription (ADRs 0186 and 0187, `docs/deployment-status.md`). The demo is shown running locally. [HOSTING LINE: replace this paragraph's last two sentences with one sentence naming a region only after `deploy.ps1 -Action Status` prints it as the live location of a Rishta Safe resource (ADR 0220).]

The route to a pilot is a shadow pilot beside a licensed facility, in which no result reaches a couple through Rishta Safe and staff compare its output with their own (`docs/submission/commercial-and-pilot.md`). Before anyone sees it: an ethics determination by the DoH research ethics committee; the clinical lead's sign-off; native clinical review of Arabic and Urdu; the outstanding legal reads against Decree-Law 49/2023; the facility's ADHICS and Responsible AI risk assessment; and an independent privacy audit. Pilot measures are the 90 percent referral target, time to counsellor brief, teach-back comprehension with intervals and escalation recall against a clinician-labelled set; cancelled marriages are never a measure.

Engineering remains: an identity provider (UAE PASS or Emirates ID for couples, the facility's sign-on for staff); a Postgres adapter with reversible migrations, row-level security and append-only audit storage with an anchored head hash; and monitoring beyond JSON logs. The commercial path is a hypothesis: no buyer contacted, a labelled pricing assumption, no revenue figure.

## 12. Reproducibility

Code version 7dca266 (the commit the scoreboard was generated against; the next commit adds the regenerated `scoreboard.json`). The history was rewritten once to a single commit identity before any push, so earlier hashes in notes no longer exist. Run from `D:\dev\bayan\backend` in PowerShell:

```powershell
uv sync
uv run pytest -q
uv run ruff check src tests scripts
uv run mypy
uv run python scripts/run_evaluation.py            # regenerates scoreboard.json (writes the file)
uv run python -m uvicorn "bayan.api.app:create_app" --factory --port 8000

cd ..\frontend
pnpm install --frozen-lockfile
$env:BAYAN_API_URL = "http://127.0.0.1:8000"
pnpm dev                                           # http://localhost:3000, /ar and /ur

# fixtures only, no backend (the mock is read at run time on the server)
$env:BAYAN_MOCK = "1"; pnpm dev

# checks
pnpm typecheck; pnpm lint; pnpm test
pnpm build; pnpm test:e2e                          # mock mode
pnpm test:e2e:real                                 # needs the backend above running
```

Separate build folders for parallel runs: set `BAYAN_DIST_DIR` before `pnpm build` and `pnpm start` (default `.next`).

`docker compose up --build` from the repository root serves the web app on port 3000 and the API on port 8000. The runbook records that a clean-container `pnpm install --frozen-lockfile` failed earlier today and ADR 0161 records the fix; not re-run by us.

Counts we made ourselves on 2026-11-20:

| What | Count | Command |
|---|---|---|
| Backend tests | 516 passed | `uv run pytest -q` |
| Lint and types | ruff clean; mypy strict, no issues | `uv run ruff check src tests scripts`; `uv run mypy` |
| Frontend checks | typecheck and lint clean; 417 Vitest tests passed, 11 live tests skipped; Playwright mock mode 62 passed, 3 skipped; real-backend run 63 passed, 2 skipped; 11 live unit tests passed | `pnpm typecheck`; `pnpm lint`; `pnpm test`; `pnpm test:e2e`; `pnpm test:e2e:real` |
| Route JS, gzip KB (budget 170) | landing 161.3, how-it-works 161.5, governance 161.5, demo 161.5, programme 161.5, couple home 163.7, judge 165.3, staff 168.6, teach-back 167.7, result 169.0; **over budget:** sharing 173.8, closure 188.3, clinician 190.7 | `node scripts/measure-budget.mjs` on a production build, mock mode, local |
| API | 44 operations on 40 paths under `/v1`, plus 3 health routes | `create_app().openapi()["paths"]` counted |
| Pathway | 15 states, 20 events, 7 simulated systems | `pathway.yaml` via PyYAML |
| Escalation | 21 triggers (13 geneticist tier, 8 counsellor tier; 10 with a legal-read flag) | `escalation_rules.yaml` via PyYAML |
| Refusal patterns | 102 (39 en, 32 ar, 31 ur) | `consent_policies.yaml` via PyYAML |
| Explainer | 83 templates, 34 glossary terms per language; banned terms 38, 38, 32; 11 mutation operators | `templates.*.yaml`, `glossary.*.yaml`, `templates.banned.yaml`; `run_explain_evaluation()` |
| Haematology, catalogue, closure | 24 rules, 20 fixtures, 11 labels; 15 conditions, 2 panels with assumed detection rates 0.9 and 0.95; 12 proforma fields, 8 patient items, 5 quiz items for each of 3 result types | `haem_rules.yaml`, `conditions.yaml`, `panels.yaml`, `closure.yaml` |
| Understatement for related couples | 16.8 and 63.7 times | `residual.understatement_factor(0.02, 0.80, 1/16)` and `(0.005, 0.80, 1/16)` |
| Dependencies | 8 runtime, none a model client | `[project].dependencies` in `backend/pyproject.toml` |
| Dubai consent switch | behaviour as described in section 6 | in-process test client: `GET .../result`, `POST .../consents` on `cpl-demo-04` |
| Demo | 10 cases, 24 personas (4 staff, 20 couple members) | `GET /v1/demo/personas`, in-process |
| Decision records | 82 files | `ls docs/decisions`, README excluded |
