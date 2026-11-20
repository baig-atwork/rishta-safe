# ADR 0202: Declare the authoring-time language model and AI-assisted authoring

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the declarations lane (G1), under the architecture contract (rules 5 and 14)

## Context
ADR 0003 allows a cloud language model to have helped draft static template text at authoring time and forbids any runtime model. Research R05 (section 3, "Must change" item 5) says this must appear in the data declaration and that the provider's output terms need a check. The Terms ask each participant to warrant that the submission is original work or built on rights the participant holds. Code and documents in this repository were also drafted with AI coding assistants.

## Decision
Declare both uses in the data declaration. State what never went to a model: personal data, real or realistic couple, result, pedigree or laboratory value, and any real person's name. State that the provider's output terms were not independently reviewed. Leave the provider and model name as a marked placeholder for the controller to complete, because this lane cannot verify which was used.

## Consequences
The declaration is honest and carries a visible gap (terms not reviewed). It exposes the originality warranty to scrutiny, and we accept that over concealing the use. The controller must fill the provider name or remove the sentence if it is wrong.

## Revisit trigger
The provider's output terms are reviewed, or a native reviewer replaces the machine-drafted Arabic and Urdu text.
