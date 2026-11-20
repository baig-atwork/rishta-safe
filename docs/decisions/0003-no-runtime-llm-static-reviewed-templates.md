# ADR 0003: No runtime LLM; static reviewed templates plus a deterministic checker

- **Status:** Accepted (owner informed)
- **Date:** 2026-11-20
- **Deciders:** the architect (controller), under the owner's standing instruction to decide on best practice

## Context
Research 05 found no study showing that LLM paraphrase beats reviewed templates for result communication, the best verifier agreed with clinicians only 89 to 93 percent, and Gulf Arabic and Urdu speech and text quality cannot be measured honestly without native clinical reviewers. A numeric hallucination in a genetic result is the worst failure the product could have.

## Decision
The explainer renders reviewed static templates with typed slots and a glossary. A deterministic checker enforces numeric fidelity (every number equals an engine number), polarity (the document says what the engine said) and a banned-word list in three languages. There is no model call at runtime. A cloud LLM may have helped draft the static template text at authoring time (declared in the data declaration); no personal or realistic couple data ever went to it. Arabic and Urdu text is marked draft until a native clinical reviewer signs off.

## Consequences
The numbers on screen cannot be hallucinated, and the safety claim is testable. The cost is less fluent text and slower content growth.

## Revisit trigger
A comparison trial (templates versus paraphrase, in Arabic, with comprehension measured) exists or we can run one.
