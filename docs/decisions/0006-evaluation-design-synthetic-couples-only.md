# ADR 0006: Evaluation design: measured on synthetic couples; what is not measured

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the architect (controller), under the owner's standing instruction to decide on best practice

## Context
The organisers provide no data and the Terms put non-commercial third-party content at risk. A human comprehension test needs ethics clearance (DoH Abu Dhabi says only the research ethics committee decides exemption), and at n=30 an 80 percent score has a 95 percent interval of 61 to 92 percent.

## Decision
Measure only what can be measured honestly: engine versus an independent oracle on synthetic couples; escalation recall and precision on a deterministic edge-case set (generated from the same trigger rules, so it measures implementation consistency, not clinical sensitivity); disclosure properties over randomised role and consent sequences against a reference model; numeric fidelity, polarity and mutation catch rate of the explanations; refusal compliance on a labelled bilingual prompt set; simulated pathway timing. The teach-back study is a protocol and an honest 'not run'.

## Consequences
Every number on the scoreboard carries its method and a 'what this does not show' line. No comprehension, uptake or clinical-accuracy claim is made.

## Revisit trigger
Volunteers outside the Abu Dhabi ethics scope are available and the exemption question is answered.
