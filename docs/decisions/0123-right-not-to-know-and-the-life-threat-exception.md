# ADR 0123: Right not to know withholds results in the app; the life-threat exception escalates to a human

- **Status:** Accepted as an interpretation; flagged `needs_legal_read`
- **Date:** 2026-11-20
- **Deciders:** governance lane

## Context
Decree-Law 49/2023 Art. 9 (dossier 3.3): each person may request their own results (9(1)); a written unwillingness to know is respected (9(2)); disclosure is compulsory where life or fetal life is threatened. The brief says: with a right not to know, category None and reason `right_not_to_know`, except where life or fetal life is threatened, which "must trigger an escalation and is flagged for a legal read".

## Decision
- A recorded right not to know (append-only declare and withdraw, only the person can do either) removes everything result-related from that person's view: no category, no own findings, no shared conditions, no partner information, no certificate note. The partner's view is unaffected.
- The statute makes disclosure compulsory in the threat case; it does not say an app must deliver it. Delivering bad news in an app to someone who recorded that they do not want it, with no counselling, would be the worst of both readings. So the app view stays withheld and `rntk_life_threat_override` is raised in the counsellor queue (tier accredited_geneticist, `needs_legal_read: true`, `needs_clinician_signoff: true`) so an accredited professional makes the statutory disclosure with counselling. The person is not told in the app that an escalation exists; the escalation is in the audit chain.
- Life or fetal-life threat is a deterministic proxy for human review, never a clinical determination: the engine's staff-only review priority is `urgent`, or a pregnancy is in progress and a shared result was found.

## Consequences
Possibly more conservative than the statute requires; possibly less direct. Either way a human owns the act.

## Revisit trigger
Legal read of Art. 9; the clinical lead defines the threat criteria.
