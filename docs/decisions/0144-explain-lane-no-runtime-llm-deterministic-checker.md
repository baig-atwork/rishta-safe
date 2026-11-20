# ADR 0144: The explain lane has no runtime model call; a deterministic checker gates every release

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** lane C (journey and explain), for the controller

## Context
ADR 0003 decided it; this record is the explain-lane implementation. A paraphrase model adds a hallucination surface and the best verifier agrees with clinicians only 89 to 93 percent.

## Decision
`explain/render.py` fills reviewed templates with typed slots (engine integers, declared constants). `explain/checker.py` re-derives the allowed numbers from the DisclosedResult, compares printed digits (Western, Arabic-Indic and extended) with declared numbers and with the truth, enforces polarity and the withheld rule, and applies the banned-word lists. `render` raises `RuleViolation` if any check fails. `explain/evaluation.py` injects faults and reports the catch rate.

## Consequences
Numbers cannot be paraphrased wrongly. Wording grows only by adding reviewed templates in three languages.

## Revisit trigger
A comparison of templates with a bounded paraphrase on measured comprehension in Arabic.
