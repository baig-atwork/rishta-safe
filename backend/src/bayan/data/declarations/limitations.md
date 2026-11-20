# Limitations

This is a plain list of what this prototype does not do, does not show, or cannot prove. Rishta Safe is education and decision support on made-up data. It is not a medical device, not a diagnosis and not clinical advice.

## Clinical and content

- **No clinical review.** Every clinical rule, cut-off, detection rate and condition entry is a draft awaiting sign-off from the clinical lead (sign-off pending).
- **Arabic and Urdu are machine-translated drafts.** They are marked `language_status: draft`. No native clinical reviewer has read them, so register, wording for "carrier" and consanguinity, gender agreement and right-to-left rendering are all unchecked (Rishta Safe authoring note, pending clinical sign-off).
- **Detection rates are assumed or illustrative.** Real per-gene detection rates must come from the testing laboratory (Rishta Safe authoring note, pending clinical sign-off). The product shows a detection rate with its limits and never a residual-risk number.
- **The panel is small and hand-written.** It is not the national panel. Sources give different gene counts for that panel, so we assert none. The published national panel excludes X-linked and dominant genes (DoH Standard V3, Appendix 12), so the X-linked demo case lies outside the national programme as published.
- **The haematology rules are an extrapolation.** They draw on England antenatal screening guidance (NHS England 2024, BSH 2023) and an Italian paper, applied to non-pregnant adults in a UAE premarital setting. The NHS family-origin list does not include the UAE, so every transfer is an extrapolation the clinical lead must own. Sources disagree on the MCV cut-off, borderline HbA2, iron deficiency and the post-transfusion wait, so these are configurable. No specificity for MCH or MCV screening in a UAE-like population was found. A CBC alone never produces a carrier statement.
- **Rule fixtures show internal consistency only.** The fixtures for the haematology rules pass a checker written by the same author, which shows the rules behave as written and nothing about clinical accuracy (Rishta Safe authoring note, pending clinical sign-off).
- **Not covered.** G6PD and other X-linked conditions are outside the haematology matrix (Rishta Safe authoring note, pending clinical sign-off). The prototype models one UAE pathway. Civil marriages, couples with a non-citizen partner and other jurisdictions are not modelled (ADR 0002).

## Statistics and evaluation

- **The correlated-miss derivation is ours.** It is the correction for related couples whose panel misses are shared by descent (a 16 to 60 times understatement for the naive update in our simulation). It has not been reviewed by a statistician. Simulation tests the algebra, not the modelling assumption that misses are variant-level; random assay error would shrink the effect (Rishta Safe authoring note, pending clinical sign-off).
- **Escalation recall is measured on a set generated from the same rules.** It shows the engine implements the trigger list as written. It does not show that the list is complete or clinically sensitive (ADR 0006).
- **The engine's oracle shares the author.** The closed-form checker is independent code but has the same author and assumptions. Agreement shows implementation consistency, not correctness against real couples (Rishta Safe authoring note, pending clinical sign-off).
- **No comprehension test has been run.** A protocol exists. The ethics exemption question is unanswered (DoH Abu Dhabi says only its research ethics committee decides exemption; Rishta Safe authoring note, pending clinical sign-off). At n=30, an observed 80 percent has a 95 percent interval of 61 to 92 percent.
- **Programme statistics.** Cited only from what the authorities have published. None are generated or shown as ours (Decree-Law 49/2023 Art. 25(3)).
- **Every scoreboard number is a synthetic-couple result.** None is a claim about real couples, uptake or comprehension.

## Pathway, platform and hosting

- **Pathway adapters are simulated.** Malaffi, the EHS app, TAMM, the Ministry of Justice link, laboratories and the national genomic database are simulated and labelled so. No public interface for any of them was found (Rishta Safe authoring note).
- **Pathway times are parameters.** Sources disagree on the genetic result turnaround, from 10 working days to about four weeks (Rishta Safe authoring note, pending clinical sign-off). The two standards were read on 2026-11-15; whether a newer Abu Dhabi standard than V3 exists was not confirmed.
- **Hosting.** The design target is Azure UAE North. The region in which a public demo runs is stated with the demo link and verified against the live resources; the demo is never described as hosted in the UAE unless that has been verified. The demo holds made-up data only.
- **State is in memory.** The demo is seeded and resettable. Nothing is persisted. A database adapter is parked.
- **Demo authentication is simulated.** The one-time code is returned in the response and flagged simulated. It is not secure authentication.
- **No runtime language model and no voice.** Text comes from reviewed templates. Dictation and speech-to-form were not built (Rishta Safe authoring note).

## Legal

- **Decree-Law legal reads are outstanding.** Open items: genotype-inferred relatedness, non-targeted findings, visibility of X-linked or affected-partner results, the life-threat disclosure override of the right not to know, and whether the consent wording about the state's access is exact. The article readings come from a full read of the official English text of Federal Decree-Law 49/2023 on 2026-11-06 (Rishta Safe authoring note, pending clinical sign-off), and the statute could not be re-read on 2026-11-15 (the official site returned HTTP 403).
- **This is not legal advice.** Federal Law 2/2019 and Ministerial Resolution 51/2021 were read from secondary summaries only (Rishta Safe authoring note, pending clinical sign-off).
- **Device classification is unresolved.** No UAE guidance on software as a medical device was found that settles how a tool like this is classified. Calling it education does not by itself decide that (Rishta Safe authoring note, pending clinical sign-off).
- **Not an accredited service.** Rishta Safe does not counsel, order tests, issue certificates or replace the licensed centre.
