# 0169: Product copy never names or counts other entries, and the evidence is published in English

Status: accepted (2026-11-20). Polish lane P2 (public pages, evidence, staff, programme). Applies ADR 0224 to the product itself.

## Context

The governance page named a laboratory-value prior-art tool and stated that "at least fourteen public repositories" address the challenge and "four use private set intersection". A judge cannot verify the count, and a product page that ranks other entrants reads as a comparison. ADR 0224 already keeps rival names and counts out of the submission drafts; the product still carried them in three message files. Separately, the measured figures, their methods and the staff brief's rule text and sources exist only in English (they are API data), yet the Arabic and Urdu pages presented them under translated labels with no word that they were English.

## Decision

1. Product copy (messages, components, pages) names no other competition entry or repository and states no count of them. The governance section "Prior art and the field" became "What Rishta Safe claims and does not claim": one neutral statement of what Rishta Safe claims (a way to explain a result in each partner's language and keep each person's choices on record, on synthetic data) and what it does not (clinical validity, a new test, a validated translation, clinical review). The comparison stays in the submission documents (`declarations/prior_art.md`), where ADR 0224 allows it.
2. The scoreboard's 100% figures that are regression gates (M1, M2, M2b, M4, M5) carry the tag "Regression gate, not safety evidence", taken from the scoreboard's own caveat. The landing leads with the weakest measured figure (M6, first run 36 of 59, 61%). Every figure and every "what this does not show" text is shown exactly as the API gives it.
3. API text that exists only in English stays English, in a run marked `lang="en" dir="ltr"`, with one visible plain sentence above it in the page language ("The measured figures and their methods are published in English." on the evidence surfaces, "Rule text and sources are in English." on the staff brief and trace). The chrome around it (card labels, headings, section titles, buttons) is translated. This makes the language boundary a stated decision rather than a defect.

## Consequences

An Arabic or Urdu reader sees which parts are translated and which are not. Translating the scoreboard and the rule text is a content task with clinical review (parked with the other translation sign-off work). A reviewer who wants the field comparison reads the declarations, not the product.

## Revisit trigger

The owner names a collaborator or a comparison in the product, or the scoreboard and rule text get reviewed translations.
