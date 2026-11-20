# Commercial path and pilot plan

Status today: Rishta Safe is a prototype on made-up data. There is no customer, no pilot partner, no revenue and no buyer conversation. Everything below is a hypothesis to test, and each unsourced judgement is labelled as such.

## Who might pay

Analysis, not evidence: three possible payers, none contacted.

- **A programme operator.** The standards put reporting duties on the programme side: a Dubai facility assigns a coordinator who submits visit and outcome data (DHA V1 6.7), and Abu Dhabi has a monitoring unit that follows up positive couples (DoH V3 App. 9a). The programme tracks a 90 percent target for referring positive genetic cases to a clinical geneticist or counsellor (DoH V3 section 5, Table 1), which Rishta Safe's pathway view and referral tasks address.
- **Licensed screening centres.** The centre owns consent, sampling, the report and the certificate, and counsels with trained family physicians supported by a counsellor "if required for difficult cases" (DoH V3 App. 15). A counsellor brief and a structured closure proforma serve that workflow.
- **A health authority.** Any AI used by a licensed entity falls under the DoH Responsible AI Standard, as stated in the organisers' regulation context note. Our inference is that a pilot would run through a licensed facility rather than as a direct purchase by an authority.
- **Not couples.** A 2024 press report puts the mandatory service at AED 100 for UAE and GCC citizens and AED 250 for others (Khaleej Times, read through a summarising tool). A per-couple charge looks unrealistic against that, which is our inference.

## Pilot design: a shadow pilot with a licensed facility

Rishta Safe runs beside the facility's normal flow. In the shadow phase no result reaches a couple through Rishta Safe, and staff compare its output with their own.

- **Gates before anyone sees it.** Ethics first: DoH Abu Dhabi says only its research ethics committee decides the review level, and sensitive topics can trigger Full Board review (Rishta Safe authoring note, pending verification against the committee's own pages). Then the clinical lead's sign-off (checklist below), native clinical review of Arabic and Urdu, the outstanding legal reads, the facility's ADHICS and Responsible AI risk assessment, and an independent privacy audit before any real data. A licensed facility must host the pilot, and whether Rishta Safe itself needs a licence under Decree-Law Art. 28 is an open legal question.
- **Time to counsellor brief.** System timestamps from risk signal to task creation and brief generation, as a median and 90th percentile with an interval.
- **Referral within the 90 percent KPI.** The standard's own measure, with a denominator at each step (task created, booked, attended), tasks lost, and reasons for failure.
- **Comprehension by teach-back.** The eight original items, a counterbalanced within-subject design, one pre-registered primary contrast, item-level results and intervals only. At n=30, an observed 80 percent has a 95 percent interval of 61 to 92 percent, so the result is formative.
- **Escalation recall.** Against a set labelled by the clinical lead, not generated from our rules, with the misses listed.
- **Privacy audit.** Disclosure property tests over randomised role and consent sequences, audit-chain verification, and the independent audit above.
- **Never a success measure.** Cancelled marriages or any single personal choice (challenge text, item 6). The pilot records no marriage outcome.
- **Stop rule.** Any displayed number that differs from the engine, or any banned word reaching a user, stops the pilot.

Durations are set with the facility. We do not state any here.

## Pricing: an assumption, not a finding

**Assumption (not tested with any buyer):** a licensed centre would pay a flat monthly site subscription, in the order of USD 750 to 2,000 per site per month, with any per-couple component left unset until a partner gives a view. The basis is the comparables below, and nothing else supports it. We state no revenue figure.

- **Closest comparable we could read.** The DNAvisit pricing page (fetched 2026-11-20) lists subscription tiers of USD 750 and 1,950 per month billed quarterly, an AI insights charge of USD 10 per patient, and separate per-patient and per-consult counsellor fees. These are one vendor's own list prices for a genetic counselling and pharmacogenomics service platform, not for software like Rishta Safe.
- **Weaker comparables.** Search summaries we did not open show EHR-suite prices of roughly USD 90 to 500 per clinician per month (SigmaMD and NovoClinical listings) and an aggregator listing for a cancer-genetics platform from USD 1,000 per user per month (Capterra; the page returned HTTP 403).
- **What we could not verify.** No published price for premarital screening explanation software in the UAE or the Gulf, no tender prices, and no UAE willingness-to-pay data. The comparables are mostly US vendors, differ in product and scope, and are vendor-stated. Replace this section with a partner's quote.

## In-UAE hosting path

- **Today.** The public demo holds made-up data only. Its region is stated with the demo link and is never described as in the UAE unless verified against the live resources (open risks, item 4).
- **Target.** Azure UAE North. A pilot with identifiable data must keep it in the UAE: Federal Law 2/2019 Art. 13 sets that default, read from secondary summaries. The DoH Responsible AI Standard cl. 3.1.4.5.1 requires AI compute and storage, including the disaster recovery site, to be within the UAE, and says remote access for development and support "should be exclusively from within the UAE".
- **Open gaps, stated plainly.** Where support staff would sit, Rishta Safe's DoH risk tier and any conformity assessment, and ADHICS alignment (its cloud wording conflicts across sources). There is no runtime language model, so no model call can leave the country (ADR 0003).

## What the clinical lead must sign off before any user sees it

The clinical lead (sign-off pending) owns each item below.

- Every haematology rule and its citation, including the four parameters sources disagree on: the MCV cut-off, borderline HbA2, iron deficiency first or proceed, and the post-transfusion wait.
- Every detection-rate assumption, and whether a pre-test numeric figure stays off.
- The closed result vocabulary and the banned-word lists in all three languages.
- Every Arabic and Urdu string, with a native clinical reviewer.
- Wording for "carrier", consanguinity and the options pane, and the fixed order of options.
- The escalation trigger list, review priorities and their time targets.
- The 12-field proforma, and which fields the couple sees.
- Whether a family physician as counsellor fits Art. 7(1) in practice.
- A statistician's review of the correlated-miss derivation.
- The intended-use statement and the device-classification route.
