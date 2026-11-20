# 0168: The audit table is capped and folded, and Arabic and Urdu text never takes Latin label styling

Status: accepted (2026-11-20). Polish lane P1 (frontend). Answers critique items S1-1, S2-4, S2-5 and S3 (`_research/ch03-ui/critic/critique.md`).

## Context

1. The sharing page printed every audit event of the couple, newest first. A late judge saw `token_issued` 573 times, a page 25,000 px tall at 1440 with Verify chain and the footer out of reach. The backend no longer writes those rows, but the log still grows with every consent change and pathway step, so the table has to stay short on its own.
2. Label and mono utilities (tracking, uppercase, Latin mono) were applied to Arabic and Urdu runs. Letter-spacing breaks cursive joins and Arabic script has no case; the direction document already forbids tracking on Arabic.
3. Pathway action labels come from the API in English only, so Arabic and Urdu next-step panels held an English sentence.

## Decision

**Audit table.** `AuditTrail` keeps Verify chain above the list. Consecutive events with the same action and actor fold into one row with a count ("token_issued x 12", index shown as a range). The newest 20 rows are open (8 on a phone, where each row is a card). The next 100 rows sit in a collapsed `<details>` "Show earlier events (N)"; beyond that a plain note says how many older events exist but are not listed. Verify chain still checks the whole chain through the API. The first mismatch a verification finds is never folded, so it stays on its own row. Logic lives in `src/lib/couple-audit.ts` with tests, including a 600-event log (1440 px page: 2,945 px).

**Typography.** One unlayered block at the end of `globals.css` sets `letter-spacing: 0` and `text-transform: none` for `:lang(ar)`, `:lang(ur)` and `[dir=rtl]:not(:lang(en))`. It is deliberately outside every `@layer` so it beats Tailwind utilities and component classes. A block marked `lang="en"` inside an Arabic or Urdu page does not match and keeps its Latin styling. Arabic or Urdu text inside a `.font-mono` or `.mono` element uses the script's UI face (Kufi; Naskh for Urdu); `code`, `.ltr-run`, `.ltr` and `dir=ltr` runs keep real mono for ids, hashes and endpoints. The Urdu H1 is 14 percent larger and bold, because Naskh and Nastaliq set smaller than Kufi at the same size; the Urdu footer is 15 px.

**Localised next steps.** `describeNext` maps the pathway event code to a message (`pathway.event.<code>`, `pathway.nextBy.<code>`, in en, ar and ur) before it falls back to the API's own label, so a code without a message still shows the API text. The waiting sentence reads "Next: the clinician records the signed declaration." The ar and ur sentences are drafts.

**Counted nouns.** The tape's event count uses ICU plural: all six CLDR categories for Arabic, one and other for Urdu and English. The tape says "hash chain intact, N events" (a local hash chain, not an external certification).

## Consequences

The API's pathway endpoint is not asked for the page locale (the backend has Arabic and Urdu labels); asking would make the mapping a fallback only. Parked, not done, because the pathway call lives in `lib/api` outside this lane. The `couple.waiting.body` message in `marketing.json` is now unused.
