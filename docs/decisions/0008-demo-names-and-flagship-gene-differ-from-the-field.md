# ADR 0008: Demo names and the flagship shared gene differ from the rest of the field

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the architect (controller), after an independent critic's review of the demo data

## Context
An independent critic compared Rishta Safe's seeded demo with other entries to the same hackathon and found two overlaps a judge would notice. Eight of our ten couples' first names (Mariam, Khalid, Noura, Latifa, Yousef, Hessa, Maitha, Sultan) are the first names in another entry's fictional roster. Our flagship case 2 (first cousins who both carry a CYP21A2 change, congenital adrenal hyperplasia, 25/50/25) is the same story as the hero example of two other entries. The overlap is almost certainly coincidence: common Emirati names and a textbook autosomal recessive example. It still reads as copying, and a reader who sees the same names in two entries cannot tell which is original.

## Decision
1. All twenty seeded people are renamed, not only the eight that overlapped, so no pair reads as half-borrowed: case 1 Salma and Faris; 2 Layla and Anwar; 3 Rubina and Imran; 4 Dalia and Hamad; 5 Basma and Walid; 6 Hind and Marwan; 7 Samar and Tawfiq; 8 Sana and Zubair; 9 Joud and Adel; 10 Ruba and Kamal. Ids, ages, languages, family histories and the partner a/b assignment are unchanged.
2. Case 2 keeps its shape (first cousins, both carriers, `shared_result_found`, 25/50/25) but the shared gene changes from CYP21A2 to USH2A (Usher syndrome type 2A).

Why USH2A and not CFTR (cystic fibrosis), the first candidate: CFTR is on the demo panel and has a sourced carrier frequency, but its illustrative severity tier is A. With tier A the engine adds the `shared_severity_a` trigger and raises case 2's staff review priority from `priority` to `urgent`. That would silently change the flagship's staff view and blur the difference from case 5, whose story is the urgent one. USH2A is tier B like CYP21A2: the same triggers, the same priority, the same trace shape, so only the gene and condition names change. USH2A is on the demo panel, autosomal recessive, couple matrix `simple`. It is not used by any other seeded case (CFTR already appears in case 7 as a variant of uncertain significance). The cost: the USH2A carrier frequency is `illustrative: true` (an AVDB-derived figure relayed in an authoring note, not a published, quotable one), whereas CFTR's came from Jain et al. The frequency does not appear in any couple-facing result, and the product already labels it illustrative.

CYP21A2 and congenital adrenal hyperplasia stay in the condition catalogue and the panel, because the catalogue still lists the condition. Only the seeded case changed.

## Honesty note
All names, couples and cases are synthetic. They are invented to exercise the engine's branches, and none refers to a real person. Choosing different names does not make the cases more or less realistic. It removes an avoidable resemblance.

## Consequences
- Recorded API fixtures in `frontend/src/lib/api/real/__fixtures__/` were recaptured from a throwaway backend; the capture script now also records `result_02a_ar`, `result_02a_ur` and `scoreboard_full`.
- The ruleset version string changed with the data files, from `rishta-safe-couple-1.0+d1348d268828` to `rishta-safe-couple-1.0+b682d63abbf0`; see ADR 0009. The committed scoreboard was regenerated. Its numbers are unchanged.
- Screenshots and submission text that show the old names or the CYP21A2 case must be re-taken or edited.

## Revisit trigger
The clinical lead (sign-off pending) prefers another flagship condition, or the severity tiers are replaced by sourced ones, in which case CFTR becomes a candidate again.
