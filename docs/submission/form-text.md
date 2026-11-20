# Form text for the submission dashboard

Drafts for the owner. Placeholders in square brackets are not known to this lane. The three limits (256, 2,000 and 1,500 characters) are provisional and have not been confirmed for this challenge: check them on the dashboard before pasting (ADR 0223). Each count below is Python `len()` of the exact text, with each line break counted as 1, printed by a command at the time of writing. The texts describe the interface as rebuilt on 2026-11-20 (Registry Grid, ADR 0007). They make no hosting claim and no clinical claim, state the synthetic-data limit and the draft status of Arabic and Urdu, and use only scoreboard numbers (ADR 0221): the 20,000 of 20,000 is M1, and 36 of 59 and 61 percent are M6.

## (a) Short description, at most 256 characters

```text
Rishta Safe is a companion for premarital genetic screening results. Each person chooses how to meet theirs, in plain English with draft Arabic and Urdu. It shows who sees what and sends hard cases to a human. Synthetic data only; not clinically reviewed.
```

Character count: 255 of 256.

## (b) Solution summary, at most 2,000 characters

Four paragraphs, separated by single line breaks. If the dashboard limit is smaller, drop the last paragraph first, then the third.

```text
Rishta Safe helps a couple understand a premarital genetic screening result that a licensed programme has already reported. Before a result is shown, each person chooses how to meet it: now, with a counsellor first, not yet, or not at all (recorded on the server as the right not to know, Federal Decree-Law 49/2023, Art. 9(2)). The result then reads in plain, non-stigmatising language in both partners' languages side by side (English, with machine-drafted Arabic and Urdu). A matrix shows who may see what: the person's own switches for the partner, and law-fixed columns for the care team, the national genomic database, employers and insurers. Fixed rules escalate to a human. It is education and decision support, not a diagnosis, a medical device or clinical advice.
What we are proudest of is being honest about the evidence. Every number on our scoreboard is printed with its method and what it does not show, and a judge can send seven live probes and see each response and the audit row it wrote. The result engine agrees with an independent oracle on 20,000 of 20,000 synthetic couples, but both were written by the same team: a regression gate, not safety evidence. Our refusal classifier refused 36 of 59 held-out prompts (61%) on its first run, before any tuning, and we publish that number first. No comprehension study or clinical review has been done.
Design choices: only these result labels (shared result found, no shared change found on this test, more information needed); a detection rate instead of a residual-risk number; no marriage-decision field; no language model at run time, so a deterministic checker confirms every number and statement on screen matches the engine.
Limits: all data is synthetic; detection rates are assumed; Arabic and Urdu text awaits native clinical review; evidence figures and staff briefs are English only; every clinical rule awaits sign-off from the clinical lead (sign-off pending); every outside system is simulated; nothing is deployed.
```

Character count: 1998 of 2,000.

## (c) What has been built, at most 1,500 characters

```text
A working prototype that runs locally from the repository. A Python backend with separate packages for the result engine, a clinician-facing haematology aid, governance (consent ledger, two emirate disclosure policies, a hash-chained audit log, refusal of third-party requests, escalation), the pathway and closure, and the explainer. A web app in English, Arabic and Urdu (right to left): a landing page with a recorded product sheet; a case bench of ten seeded synthetic cases crossed with role lenses; the threshold before a result; the result read in two languages side by side with a 100-cell grid; a who-sees-what matrix that writes an audit row for each change; a counsellor instrument (queue, brief, trace); a two-pane haematology aid; a programme page of aggregates; and an Evidence page with seven live probes and the scoreboard (nine measured results, two not run). Not built: a deployed service, real integrations, a comprehension study, clinical review, production sign-in and durable storage. AI assistants helped write code, documents and template text at authoring time; there is no language model at run time.
```

Character count: 1126 of 1,500.

## Before pasting

- Confirm the three limits on the dashboard. If a dashboard counts a line break as two characters, text (b) gains 3 characters, which still fits.
- If a hosted demo exists by then and `deploy.ps1 -Action Status` has printed its region, the owner may add one hosting sentence to (c) and remove "a deployed service" from its "Not built" list, and remove "nothing is deployed" from (b). Do not name a region otherwise (ADR 0220).
- The numbers in these texts are scoreboard rows (M1, M6) and the counts of the built product (ten cases, seven probes, nine measured results and two not run, as in `backend/src/bayan/data/scoreboard.json`). Check them against the scoreboard before pasting.
- Do not add a team name, an individual's name, the name or number of any other entry, or any claim of clinical review, validation or endorsement.
