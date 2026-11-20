# ADR 0147: Detection-rate labels are shown as the engine supplies them; reasons for more_information_needed are an argument to render

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** lane C (journey and explain), for the controller

## Context
Two contract gaps found while building: `DetectionStatement.detection_rate_label` is free English text (it cannot be localised), and `DisclosedResult` has no field for `needs_more_information_reasons`.

## Decision
Detection statements are rendered through localised full-sentence templates keyed by `statement_key` (`limits.detection.panel_rate_assumed`, `alpha_globin_locus_limit`, `related_couple_shared_misses`), each keeping the assumed, illustrative and not-a-measured-rate qualifiers. The two numerals are read from the English label by one strict reader (`detection_rate_numbers`: exactly two numerals, denominator 10 or 100) and checked as engine numbers, so the sentences cannot diverge from genetics; a test extracts the numerals of the real genetics labels and asserts the Arabic and Urdu sentences carry them. An unknown key or an unreadable label falls back to the generic template, which prints the English label inside a bidi isolate. `ExplainService.render(disclosed, locale, *, reasons=())` takes the reason keys from the caller (composition passes `CoupleResult.needs_more_information_reasons`); unknown reason keys use a safe generic template and `templates.aliases.yaml` maps the genetics lane keys to template ids.

## Consequences
Known statements contain no English phrase in Arabic or Urdu. The numerals are derived from the label text, so a genetics change to the label format drops that statement to the generic fallback (visible in the test) rather than showing a wrong number.

## Revisit trigger
The controller adds a structured detection rate and the reasons to the contract.
