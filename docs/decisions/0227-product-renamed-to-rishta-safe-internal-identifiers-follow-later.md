# ADR 0227: The product is renamed Rishta Safe; internal identifiers follow after submission

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the owner (the name), the controller (scope and the guard against the word "safe")

## Context
The working name was "Bayan" in every document and screen until this record. The owner set the final name, **Rishta Safe**, on the submission day, about two hours before the deadline. A rename of every code identifier (the Python package, the `BAYAN_` environment variables, container and Azure resource names) is a mechanical but wide change that can break the build, and nothing a judge sees depends on it.

## Decision
1. **Everything a reader sees is renamed now**: the interface in all three languages (the header wordmark is the Latin name only; the Arabic-script wordmark of the old name is removed), the page titles, the API title, the data files and templates, the declarations, every document under `docs/`, the READMEs, the Dockerfile comments and the Render service (`rishta-safe-demo`). The rule-set identifier shown in the staff brief is now `rishta-safe-couple-1.0+<hash>`, and every fixture, test and the committed scoreboard carry the new string (the hash changed because the data files changed).
2. **In Arabic and Urdu text the old name was the word "بيان" / "بیان"**, which is also an ordinary word. Only the product-name uses were replaced (by hand-checked file and line); verb and noun uses were kept. The brand is written in Latin script in all three languages.
3. **The word "safe" is a banned word in result text** (ADR 0005, `templates.banned.yaml`): it reads as a verdict. The product name contains it. The guard masks the exact string "Rishta Safe" before matching (`explain/banned.py`), and four tests mask it the same way; the word still fails everywhere else. This is a real tension: a reader can take "Safe" in the name as a safety claim. Every surface keeps the statements that the product is not a safety or compatibility verdict, is not clinical advice and gives no marriage recommendation. The owner may want to revisit the name after the competition.
4. **Not renamed yet** (parked, `docs/parking-lot.md`): the Python package `bayan` and its imports, the `BAYAN_*` environment variables, the cookie and local-storage keys, the Azure and container resource names, the image tags, and the repository folder name. None is visible to a user or in the deck or video.

## Consequences
- The old name remains in this record, in the commit history and in the identifiers listed in item 4.
- Historical decision records now say "Rishta Safe" where they said the old name, so their wording is the current name, not the name at the time.

## Revisit trigger
After submission: rename the identifiers in item 4 in one reviewed change, and reconsider the name against item 3.
