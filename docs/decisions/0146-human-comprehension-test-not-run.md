# ADR 0146: The human comprehension test is not run; protocol and instrument only

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** lane C (journey and explain), for the controller

## Context
In Abu Dhabi only the research ethics committee decides exemption, and sensitive topics can trigger Full Board review (research 04 section 2.5). No determination exists. Three arms of 10 volunteers detect only gaps of 55 to 65 points.

## Decision
The teach-back quiz (five items per result type, deterministic scoring, correct answers explained, three languages) and the patient items are served as an instrument. Every schema and quiz object carries `human_comprehension_test_run: false`. Documents say plainly that no human result exists.

## Consequences
No comprehension claim can be made from this build.

## Revisit trigger
An ethics determination in writing, then a counterbalanced within-subject run.
