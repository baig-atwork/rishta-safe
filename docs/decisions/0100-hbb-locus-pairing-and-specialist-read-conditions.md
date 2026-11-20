# ADR 0100: Pair carriers across conditions at the HBB locus; send other haemoglobin variants and HbH to a specialist read

- **Status:** Accepted (draft ruleset, clinician sign-off pending)
- **Date:** 2026-11-20
- **Deciders:** genetics lane, under the owner's standing instruction (conventions win over the brief)

## Context
The brief says two carriers "of the same AR condition" give 25/50/25. Research report 01 section 2.5 (NHS referral table, SITE Table 12) lists pairings that cross conditions at one gene: Hb S with beta-thalassaemia is a sickle syndrome, Hb S with Hb E or Hb D-Punjab is a compound disorder. A strict same-condition rule would report "no shared change found" for a beta-thalassaemia carrier and a sickle-trait partner, which is a false reassurance for exactly the pairing the haemoglobinopathy research flags. The 25/50/25 arithmetic is Mendelian regardless of severity, but not every pairing is a disease: homozygous Hb D-Punjab is mild or silent, and Hb H disease arises from several alpha-gene combinations that the simple table does not describe.

## Decision
- The catalogue defines a locus group `HBB`. Carriers (or an affected partner and a carrier) of two different conditions in the group pair into the group's compound condition (`hbb_compound_haemoglobin_disorder`) with the same 25/50/25 or 50/50 or 100 lines, and the trace names the pairing (rule E14).
- Conditions marked `couple_matrix: specialist_read` (`hb_variant_other`, `hb_h_disease`) never produce a shared result. A couple in which both partners have a finding in the same locus where either condition is specialist-read gets `more_information_needed` with reason key `specialist_read_needed` and a trace line marked `needs_clinician_signoff`.
- A person with two findings at one locus gets `more_information_needed` (`duplicate_findings_same_locus`) and no result is stated at that locus: the engine does not guess phase or compound state.

## Consequences
The engine is more conservative than the brief on the specialist conditions and less conservative on cross-condition HBB pairs (it reports them). Severity of any pairing remains a specialist read. The independent oracle covers the HBB compound naming; it does not generate the specialist conditions, which are tested directly.

## Revisit trigger
The clinical lead signs off, amends or rejects the HBB pairing table, or supplies pairings for Hb variants that can be automated.
