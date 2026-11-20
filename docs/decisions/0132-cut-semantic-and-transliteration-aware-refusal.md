# ADR 0132: Cut: semantic refusal, Roman-script Urdu and Arabizi, leetspeak and obfuscation handling

- **Status:** Cut for the prototype
- **Date:** 2026-11-20

## Decision
The refusal classifier (ADR 0126) matches normalised Arabic, Urdu and English script only. Not built: Roman Urdu and Arabizi lists, leetspeak and spaced-out letters, stemming or morphological analysis for Arabic and Urdu (broken plurals and colloquial forms are the main source of held-out misses), and any semantic model. A semantic classifier would have to run on a self-hosted model because free text about distress and results is personal-class data, and its agreement with a human reviewer would have to be measured; none of that fits the time box and no model was evaluated.

## Consequences
Held-out recall is about 61 percent (ADR 0126). Known-gap prompts are in the dev set and reported, not hidden.

## Revisit trigger
A native-speaker reviewer; an evaluated self-hosted classifier.
