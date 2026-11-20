# ADR 0009: Citation strings never point to internal notes

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the architect (controller), after an independent critic's review

## Context
The staff trace, the counsellor brief, the pathway timers and the closure schema print each rule's `source` string. Many of those strings pointed to internal research notes: "R03 2.7 row 1", "Dossier section 2 requirement 3", "research 02 section 2.2". A reader cannot open those notes, so the pointers read as a citation but verify nothing. Several data files also held a local file path to the notes.

## Decision
A user-visible `source`, `anchor`, `basis` or `read_status` string cites only a public basis: a named statute and article (Federal Decree-Law 49/2023), a named standard (DoH Abu Dhabi premarital standard, DHA premarital standard, referred to as D1 and D2), or a named paper or guideline (ACMG 2021, ESHG 2016, NSGC 2002, NHS England handbook, Jain et al. 2025). Never cite an internal note, dossier, ADR number or local path as the basis for a clinical, legal or numeric claim.

Where a string had both an internal pointer and a public basis, the pointer was dropped and the public basis kept. Where no public basis can be identified from the repository, the string says "Rishta Safe authoring note, pending clinical sign-off". Nothing was invented. A rule that is a design choice with no guideline text says so ("design rule; no guideline text found").

Scope of the change: `escalation_rules.yaml` (all source strings and the header), `conditions.yaml` (source titles, read_status, notes and basis text), `panels.yaml`, `pathway.yaml`, `closure.yaml`, `consent_policies.yaml`, `templates.{en,ar,ur}.yaml` and `templates.constants.yaml` (`source` and `note` strings), the E14 trace line in `genetics/engine.py` and the AVDB context source in `genetics/evaluation.py`. The `DL` abbreviation in printed sources is spelled out as Federal Decree-Law 49/2023. Source ids in `conditions.yaml` that began `DOSSIER-` were renamed to the cited work (OZEN-2017, BIZZARI-2023, AVDB-2025, M42-DOH-2024); nothing else referenced them. No rule id, category, threshold, tier or result word changed. The two internal-note entries in `pathway.yaml` `sources` became authoring-note entries without a path.

The Mendelian and statute content is unchanged. Statute readings still say the statute text was not re-read and that a legal read is pending.

## Consequences
The ruleset version is derived from `conditions.yaml` and `panels.yaml` (`data_content_hash`), so it changed to `rishta-safe-couple-1.0+b682d63abbf0`. The committed scoreboard records that version in its M1 method text and was regenerated; M1 to M7 values are identical. The recorded fixtures were recaptured. No test pins the hash.

Not changed (parked for the controller): code comments and docstrings that mention research reports, the `declarations/*.md` submission documents (they define their own source tags R01 to R06 and "Dossier"), and ADR text. These are not printed by the product.

## Revisit trigger
The clinical lead (sign-off pending) supplies a reviewed citation for any string that now reads "Rishta Safe authoring note"; replace it then.
