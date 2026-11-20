# 0171: Read together pairs blocks by section and stops at the first mismatch

Status: accepted (2026-11-20). Lane B (frontend v2).

## Context

The plan maps blocks to disclosures by `template_ids` prefix. The API's blocks carry no template id; `template_ids` is deduplicated per document and one template can make several items in one list block, so index-to-id mapping is wrong.

## Decision

1. `sectionResult` (result-layers.ts) aligns the i-th heading block with the i-th heading template id (`*.heading`, plus the mock's `result.more_info.why`) and maps the id prefix to a disclosure (own, limits, privacy/policy/certificate/options to "who", everything else to "meaning"). When the counts disagree nothing is assigned by guesswork: the whole flow goes to "meaning" (a unit test covers it). The closing paragraph is the next-step pointer only when the last content template id is `options.pointer` or ends in `.next`.
2. `pairBlocks` pairs position by position while the block kinds match and stops at the first difference, returning each language's remainder in full under the "not aligned" note.
3. The second language is the other member's, else the viewer's own, else none with "Add a language". The adapter used to drop the member `language`; it now keeps it (additive field, optional).

## Consequences

Every block appears exactly once (tested). The mock's document shape differs from the real one, so the same function is tested on both shapes.
