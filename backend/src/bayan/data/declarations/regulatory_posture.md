# Regulatory posture

This page says how UAE law and the two emirate standards shape the design. It is a design reading, not legal advice. The Decree-Law readings are Rishta Safe's reading of the official English text of Federal Decree-Law 49/2023 (read in full on 2026-11-06 and audited; Rishta Safe authoring note, pending clinical sign-off). Several legal reads are still outstanding (see Limitations).

## Federal Decree-Law 49/2023, article by article

- **Art. 4(1) and 6.** Consent must be written and explicit, with purpose stated. This is the rule for voluntary screening. Art. 4(2)(a) exempts obligatory screening, and Art. 15(1) makes couple screening obligatory. Design: the consent ledger covers voluntary and secondary uses and sharing. We never describe the statutory couple screening as consented.
- **Art. 7.** A specialist physician or genomics specialist gives counselling before sampling (7(1)). Samples are coded, analysis is targeted, labs are accredited, extra purposes need fresh consent, and samples stay in the State without approval (7(3), (4), (5), (7), (9)). Design: Rishta Safe prepares people and explains a reported result, and is never presented as the counselling.
- **Art. 8.** Withdrawal applies to voluntary screening. Design: revocation is modelled for Rishta Safe's own consents, not presented as a right over the mandatory flow.
- **Art. 9(1) to (6).** Each person may request their own results, may state in writing that they do not wish to know, and must be told if life or fetal life is threatened. Lineage results go only to their owner, and non-targeted results need consent (breach is criminal, Art. 33). Design: right-to-know and right-not-to-know controls. Ancestry and relatedness are never inferred from genotype.
- **Art. 11 and 12.** Embryo and prenatal screening are permitted, and all medical options are available where a serious abnormality is shown. Design: a neutral options pane citing the articles.
- **Art. 15.** Couple screening is obligatory, and the marriage contract is not completed without evidence of the examination and informing the couple of its results.
- **Art. 19 to 21.** Employers and insurers may not require genetic screening or use earlier results. Design: third-party requests are always refused and logged.
- **Art. 23(2).** Direct-to-consumer genetic products are medical devices. Rishta Safe is not one: it does not order, perform, sell or report a test.
- **Art. 25(3).** Programme data or statistics may not be published without approval. Design: no programme statistic is generated or shown. Published figures appear only as cited facts.
- **Art. 26(2).** Every party performing genetic screening gives the data to the National Genomic Database. The state is a statutory recipient and Rishta Safe never claims to hide data from it. Privacy here is horizontal: partner, family, employer, insurer.
- **Art. 28, 39, 40.** A licence is needed for genome-related services, and unlicensed advertising is barred. The prototype stays synthetic and is not offered as a service.

## The two emirate standards: who may see what

- **Abu Dhabi (DoH Standard V3).** The doctor meets the couple together only after the individual with the abnormal result consents (App. 2). The joint genetic report states a negative or positive result only, without gene or variant detail (App. 5a; the Arabic text was read by eye only, awaiting an Arabic reader's check).
- **Dubai (DHA Standards V1, 9.1.4).** Where a condition is found, the result goes exclusively to the affected individual. The partner is told only with that person's explicit consent.
- **The tension, shown and not hidden.** Both emirates withhold the certificate if a partner refuses to share or sign (DoH 3.3.12.1; DHA 9.1.10b). Individual control is real until the certificate is needed. Rishta Safe offers both policies.
- **Marriage decisions.** The decision belongs to the judicial authorities (DoH App. 2) and is recorded in a signed declaration (App. 9a, 9b). Rishta Safe has no marriage-decision field, and no marriage outcome counts as success (challenge text, item 6).

## Data localisation and hosting

- **Rule.** Federal Law 2/2019, Art. 13, bars storing, processing or transferring health data on services provided in the UAE outside the UAE, except where the Health Authority allows (Rishta Safe authoring note, pending clinical sign-off). Ministerial Resolution 51/2021 lists exceptions. Both were read through secondary summaries only.
- **DoH Responsible AI Standard, cl. 3.1.4.5.1.** AI compute and storage, including disaster recovery, "must be situated within the UAE", and remote access for support "should be exclusively from within the UAE". It binds licensed Abu Dhabi entities, not a demo on made-up data.
- **Our position.** The public demo holds made-up data only, which we read as outside these rules (our reading). In-UAE hosting (Azure UAE North) is the design target and is never claimed for the demo unless it has been verified against the live resources. A pilot with identifiable data must be in the UAE. We claim no ADHICS certification.

## Why education and decision support, not a device or counselling

- **Intended use.** Rishta Safe explains a reported screening result, shows who can see what and escalates by rule to a qualified human. It does not diagnose, advise clinically or counsel, and every result screen says so. The haematology aid is clinician-facing and never states a carrier or disease state from a CBC.
- **Counselling.** Art. 7(1) names a specialist physician or genomics specialist. The standards use trained family physicians supported by a counsellor "if required for difficult cases" (DoH App. 15). We flag the mismatch for the clinical lead.
- **Human oversight.** DoH's 2018 AI policy describes supportive technology as used "by a human to assist in the making of final decisions". Rishta Safe's risk tier under the Responsible AI Standard (3.3.1.2.2) has not been assessed.
- **The honest limit.** A label does not decide device status, and we found no UAE text saying it does (Rishta Safe authoring note, pending clinical sign-off). Federal Decree-Law 38/2024 created the Emirates Drug Establishment, and no guidance on software as a medical device was found. A pilot would settle classification before any commercial claim.
