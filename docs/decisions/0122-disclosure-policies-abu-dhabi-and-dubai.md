# ADR 0122: Two selectable disclosure policies, and what actually differs between them

- **Status:** Accepted (draft; clinical sign-off and a legal read pending)
- **Date:** 2026-11-20
- **Deciders:** governance lane

## Context
The brief says Dubai informs the affected person first and the partner only with explicit consent, and that both emirates withhold the certificate if a partner refuses to share. Research 02 gives the clauses (DoH Abu Dhabi Standard V3 App. 1b item 6, App. 2, App. 5a, 3.3.12.1; DHA Dubai Standards V1 9.1.4 and 9.1.10b) and its own comparison table shows the two rules as close to identical in effect: Abu Dhabi, "affected individual consents before the partner is told"; Dubai, "affected individual first, partner only on explicit consent". The brief overstates the gap. The honest difference in the sources is where the consent gate sits.

## Decision (data in `consent_policies.yaml`, each rule with its clause)
- **abu_dhabi (joint report):** one couple-level report. After counselling the couple-level category is released to both partners without a consent step (Art. 15 requires the couple to be informed; App. 5a minimal joint report). The affected individual's consent gates the joint counselling meeting and what is shown about the partner's own findings (the per-person scope, none by default).
- **dubai (affected individual first):** a `shared_result_found` is withheld from a member (`awaiting_partner_consent`) until every OTHER member with an abnormal finding has granted at least `couple_result_only` (9.1.4). Directional: partner B waiting for partner A consent is independent of partner A waiting for B.
- **Both:** a shared condition owned by one person (X-linked carrier female, X-linked affected male) needs the owner's consent before the other partner sees the category (research 03 rows 2 and 4, flagged for a legal read). A shared or unresolved category is withheld until post-test counselling is recorded (`counselling_first`); the DHA text on this was not confirmed, so for Dubai it is a labelled product safeguard that mirrors Abu Dhabi. The default `counselling_completed=False` is fail-closed; the composition lane passes True from the journey state.
- **Certificate-refusal tension:** both standards withhold the certificate if a partner will not share or sign. `certificate_note_key` (`certificate_note.abu_dhabi`, `certificate_note.dubai`) is set whenever a partner with an abnormal finding has not granted the other any scope, shown to both members and to staff. It is labelled, not hidden. The explain lane owns the wording of the two keys.
- A VUS is not an abnormal finding for the gate. No lineage, ancestry or relatedness is produced: `relationship` is the couple's own declared value.

## Consequences
The policies differ only where the sources say they do. If a legal read finds that Art. 15 requires the couple-level category to reach both partners under Dubai too, the change is one line (`category_gate: joint_report`).

## Revisit trigger
Clinical lead and legal read.
