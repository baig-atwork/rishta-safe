# Prior art and positioning

This is an honest statement of what Rishta Safe claims and what it does not. It does not compare Rishta Safe with named public projects. We looked at public pages of other entries to this challenge only to avoid duplicating their wording, values or thresholds; we copied no code, text or number, and we cannot see private work or entries that never name the challenge.

## What we do not claim to be first at

- **Interpreting laboratory values** (haemoglobin, MCV, MCH, HbA2, HbF, ferritin, G6PD) against named guideline cut-offs. Public tools already do this. Rishta Safe's haematology aid is not new. Every threshold in it is taken from a cited published text with the section shown, and every rule is gated on clinical sign-off, which is pending for all of them.
- **Private set intersection.** We cut it (ADR 0004). The output itself leaks: the universe of gene names is small, so an inflated input can enumerate the other party's carrier set. The state is a statutory recipient (Decree-Law 49/2023, Art. 26(2)), each person may request their own results (Art. 9(1)), and an anonymous pre-check would be a licensed voluntary service (Art. 28). Rishta Safe's privacy is horizontal protection through consent, role-based disclosure, minimisation and a tamper-evident audit.
- A counselling-referral state machine with timers.
- Arabic and English support, and plain-language templates with a verifier.
- Consent ledgers, role-based access and hash-chained audit logs.
- A refusal or red-team set.
- The rule that a cancelled marriage is not a success measure (the challenge text sets it).
- A family or cascade workflow. Rishta Safe has none.
- Naming a reviewing clinician. Rishta Safe names none: no clinician has reviewed anything here.

## Self-written gates are not measured safety

A headline such as "all sentences passed" or "all simulated couples correct" is a regression gate on a test set its authors wrote. Rishta Safe's numbers are the same kind of thing and are labelled so. Oracle agreement, escalation recall, disclosure property tests and numeric fidelity are measured on synthetic couples against rules or code written by the same author (ADR 0006). They show implementation consistency. They do not show clinical accuracy or safety for real people.

## Our three differentiators

- **A. Pathway fidelity.** The pathway, states, times and two disclosure rules are taken from the DoH Abu Dhabi and DHA Dubai standards, with the certificate-refusal tension shown rather than hidden.
- **B. Traceable haematology-first aid.** A clinician-facing aid with a rule trace, a closed output vocabulary, a citation (or an illustrative flag) for every threshold, and an on-screen sign-off status for every rule. It never states a carrier or disease from a CBC. The status is currently "sign-off pending" for all of it.
- **C. Measured, with limits.** Every number on the scoreboard states its method, its sample and what it does not show.

What we do not claim: a clinician-signed pathway (no real sign-off exists; only the unsigned status is visible per rule), a clinician-labelled escalation set (ours is generated from our own rules), and any comprehension result (no test has been run).
