# ADR 0221: Every number in the submission drafts comes from the scoreboard or from a command that was run

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the submission-drafts lane (G2), under the architecture contract (rules 2, 3 and 14)

## Context
The judges see the scoreboard on screen and will compare it with the report, the form text, the deck and the video. A number that differs by a digit reads as carelessness or inflation. Two numbers in package READMEs already differ from the code: the explain README says 5,616 injected faults and 80 templates per language, while the scoreboard says 5,760 faults and a command over `data/templates.*.yaml` counts 83 templates per language (the evaluation function also reports 5,760 mutants and 83 templates). The scoreboard artefact records code version `d668dbb`, the repository head is `74f0855`, and the working tree is uncommitted.

## Decision
- Evaluation numbers are copied verbatim from `backend/src/bayan/data/scoreboard.json`, with the metric's method and its does-not-show line. The report's evaluation table is generated from that file by a script, not typed. No figure is rounded, restated as a different percentage or combined with another.
- Counts that are not on the scoreboard (tests, routes, triggers, templates, glossary terms, states, events, ADRs) are counted by a command, and the report's reproducibility section names the command. Where a package README disagrees with the code, the code wins and the report says so.
- The deck, the form text and the video quote only scoreboard rows. They do not quote counts from the report.
- The refusal measure is always quoted as the held-out first run (36 of 59, 61 percent, 0 of 20 benign prompts refused), never as the tuned set alone.
- The scoreboard must be regenerated after the final commit, and the report's commit line updated (checklist).

## Consequences
The drafts are less impressive than a headline of "513 tests" or "100 percent" would be, and they cannot be caught out. A reader who wants the count behind a number can run the command.

## Revisit trigger
The scoreboard is regenerated, or a metric is added or changed.
