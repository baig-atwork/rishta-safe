# Deck outline for the organisers' template

The organisers' template file is not available to us, so the owner must place this text into it. Each slide below has a title, text of at most 40 words (title included) and one visual idea. The word counts were made by a command. The only numbers on any slide are scoreboard rows (ADR 0221); no slide quotes a count from the report. The visuals describe the interface rebuilt on 2026-11-20 (Registry Grid, ADR 0007); take screenshots from the running build, in English and Arabic, never from the retired design. Placeholders: `[TEAM NAME]`, and any link the template asks for (video, repository). No slide names a person, a rival or a hosting region.

The deck makes no hosting claim. If a hosted demo exists and `deploy.ps1 -Action Status` has printed its region, the owner may add it to slide 13 in the organisers' own words; otherwise leave slide 13 as written (ADR 0220).

### Slide 1: Rishta Safe

**Text (26 words with the title):** A couple-result companion for premarital genetic screening. Education and decision support on synthetic data. Not a medical device, not clinical advice. [TEAM NAME] · Challenge 03.

**Visual:** Title on the dark ink hero with the three-cell wordmark (solid, hatch, open) and three neutral stamps: Synthetic, Draft, Not advice.

### Slide 2: The problem: a result is not understanding

**Text (34 words with the title):** Screening helps only if couples understand a result, reach a qualified person and keep control of who sees it. Explanation, privacy and follow-up are usually separate problems.

**Visual:** A result card with three gaps drawn beside it: explanation, privacy, follow-up.

### Slide 3: Who it is for

**Text (19 words with the title):** Couples first. Counsellors, clinicians, programme operators and evaluators each see only what their role allows.

**Visual:** The case bench: ten seeded cases crossed with the five role lenses, the programme cell reading "Aggregate only".

### Slide 4: The pathway

**Text (26 words with the title):** Built from the published Abu Dhabi and Dubai standards: each state, its expected time, one next action. Every outside system is simulated and labelled.

**Visual:** Screenshot of the couple's pathway cells (case 2, Layla and Anwar, synthetic).

### Slide 5: How it works

**Text (32 words with the title):** A reported result goes in. Fixed rules and reviewed templates produce the words. No language model at run time. A checker confirms every number and statement matches the engine.

**Visual:** Pipeline diagram: result engine, disclosure filter, templates, checker, screen.

### Slide 6: The safeguards

**Text (36 words with the title):** A who-sees-what matrix: partner switches are the person's own, other columns fixed by law. Every change writes an audit row. Third-party requests are refused and logged. Escalation to a human is fixed by rule.

**Visual:** The who-sees-what matrix, and beside it the Evidence probe "An employer asks for a result" refused, with the audit row it wrote.

### Slide 7: A result, on the person's terms

**Text (40 words with the title):** First the person chooses how to meet it, or not to know. Then only: shared result found, no shared change found on this test, more information needed. A detection rate, never a residual-risk number.

**Visual:** The threshold with its four options, none preselected, beside the result read together in English and Arabic with the 100-cell grid and the draft stamp.

### Slide 8: The evidence: measured on synthetic couples

**Text (39 words with the title):** Engine against an independent oracle: 20,000 of 20,000 agree. Disclosure rules: 30,527 decisions, 0 mismatches. Explanations: 768 documents, numbers 100%; 5,760 of 5,760 injected faults caught. Same-team oracles: regression gates, not safety evidence.

**Visual:** The scoreboard cells from the Evidence page, each with its "does not show" line visible beneath the value.

### Slide 9: The evidence we published although it is weak

**Text (40 words with the title):** Refusal of out-of-scope requests, held-out first run before any tuning: 36 of 59 (61%), 0 of 20 benign prompts refused. Escalation recall 400 of 400, on cases generated from the same rules.

**Visual:** The Evidence page with this figure shown first, labelled "first run, before tuning", above the live probes.

### Slide 10: What we do not claim

**Text (30 words with the title):** No clinical review. No comprehension study. No real data. No connection to any UAE system. Arabic and Urdu are machine drafts. Detection rates are assumed.

**Visual:** A plain ledger titled "Not done", with the two hatched scoreboard cells marked "Not run".

### Slide 11: The pilot path

**Text (31 words with the title):** A shadow pilot beside a licensed facility: no result reaches a couple through Rishta Safe. Gates first: ethics determination, the clinical lead's sign-off, native review, legal reads, privacy audit.

**Visual:** A gate diagram: ethics, sign-off, review, then shadow.

### Slide 12: The commercial path

**Text (26 words with the title):** A hypothesis, not a finding. Possible payers: programme operators and licensed centres. Pricing is an untested assumption. No buyer contacted. No revenue figure.

**Visual:** A payer map with every box stamped "hypothesis".

### Slide 13: The ask

**Text (33 words with the title):** A licensed facility and a clinical lead for a shadow pilot. A native clinical reviewer for Arabic and Urdu. An ethics route for a comprehension study. Design target: Azure UAE North.

**Visual:** Three open slots, each with a named need and no logos.

## Notes for the owner

- Slides 8 and 9 are the evidence. Keep the words "same-team", "held-out first run" and "does not show" on screen; they are what makes the numbers honest.
- Slide 8 uses rows M1, M5 and M2/M2b; slide 9 uses M6 and M4. Copy the values from the scoreboard, never from memory.
- Do not add a slide that quotes "516 tests" or any other count from the report.
