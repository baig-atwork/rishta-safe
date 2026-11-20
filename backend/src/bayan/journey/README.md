# bayan.journey

The couple case record, the pathway state machine, referral tasks, closure and the teach-back quiz. Synthetic data only. Every outside system (licensed centre, laboratories, result feed, certificate service, judicial department, national genomic database) is **simulated** and labelled so in all three languages. Nothing is booked, sent or issued.

## What it does
- `JourneyService.create_case(IntakeInput)`: two synthetic members, relationship, emirate policy, `id_type` as a setting (`emirates_id`, `cnic`, `none`; no number is ever stored), declared family history from a controlled list, and a preliminary-risk opt-in that is OFF by default and returns nothing when off (ADR 0149).
- `advance(couple_id, PathwayEvent, actor)`: the state machine of `data/pathway.yaml`. States: registered, consult_done, sample_collected, lab_in_progress, report_ready, result_clear or counselling_pending, counselling_booked, counselling_done or counselling_declined, certificate_withheld, declaration_signed, certificate_issued, judicial_handoff_sent, closed. A screening visit is a simulated "book at a licensed centre" hand-off, never home collection (ADR 0141). Events are stamped by the injected clock.
- SLA status per step (on_time, at_risk, breached): lab start within 24 hours, genetic result 21 days (Abu Dhabi) or 28 days (Dubai), certificate valid three calendar months, referral timer 14 days (**illustrative**, ADR 0148). Sources are in the data file; the two standards disagree and nothing is hard-coded.
- `referral_tasks`: FHIR R5 Task shaped, labelled simulated, with t0 to t5 timestamps (ADR 0150). `kpis()`: time to result, time to referral, counselling uptake, share referred against the 90 percent target of the Abu Dhabi standard, share referred within the (illustrative) standard, open and stale tasks. Computed from stored cases; a figure with no cases behind it is `None`, never invented.
- Closure: 12-field clinician proforma, eight original patient items, optional SILS stratifier, opt-in `interested_in_future_services`, and a teach-back quiz (five items per result type, deterministic scoring, explanations, three languages). **There is no marriage-decision field** (ADR 0143).

## Invariants (enforced in `machine.py`, property-tested)
No flagged couple without a counselling task; a task that is rejected, failed, cancelled or on hold has a reason; a rejected or failed counselling task always spawns a replacement; a case cannot close with an open task or, if flagged, without a clinician proforma; event times never go backwards; a failed event leaves the case untouched. A couple member can record only three events (book counselling, decline counselling, decline to share) and only on their own case; judges and external parties can record none. The service refuses a couple-member actor of another couple even if a route forgot to check.

## Tests
`cd D:\dev\bayan\backend && uv run pytest tests/journey -q`: unit tests of the service, a hypothesis property test over random event, role and delay sequences, router tests with cross-couple denial for every route.

## Honest limits
- The human comprehension test is **not run**; this is the protocol and the instrument (ADR 0146). The ethics-exemption question is open.
- Closure items are original and unvalidated; results are item-level only, with no total score (ADR 0145).
- Arabic and Urdu labels, items and consent text are drafts, not reviewed by a native clinical reader.
- Time-to-result and time-to-referral come from the injected clock; on seeded data they are simulated, not measured waits.
- The 14-day referral standard and the 75 percent at-risk fraction are illustrative; the 30-day stale-task limit is illustrative.
- The case store is in memory behind a small repository class; a Postgres adapter is parked.
- A partner who declines to share leads to `certificate_withheld`, the tension both standards describe (DoH V3 3.3.12.1, DHA V1 9.1.10b); it is labelled, not hidden.

## Sources
DoH Abu Dhabi Premarital Screening Standard V3 (2024), DHA Standards for Premarital Screening Services V1 (2026), HL7 FHIR R5 Task and Task Status value set (5.0.0), PRSB outpatient letter standard (2017), research notes 02 and 04. Structure follows them; no form, text or gene list is copied. The Single Item Literacy Screener is CC BY (Morris and others, BMC Family Practice 2006) and is used with attribution as a stratifier only.
