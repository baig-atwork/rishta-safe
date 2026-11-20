# ADR 0103: Scope and cuts of the synthetic couple generator

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** genetics lane

## Context
The evaluation needs synthetic couples with ground-truth genotypes from defined pedigrees, and an oracle that does not share code with the engine. It has to run vectorised, in under a minute for 20,000 couples.

## Decision
Generated: unrelated, second cousin, first cousin once removed, first cousin and double first cousin pedigrees (the gene-dropping topologies reproduce the inbreeding coefficients 1/64, 1/32, 1/16, 1/8; tested by homozygosity rates), one independent segregation per locus (unlinked loci), outbred founders, detectability decided once per founder allele and inherited with it (the shared-miss assumption of ADR 0101), and the HBB locus as a two-class multi-allelic locus.

Cut, each with the reason:
- **X-linked loci are dropped independently in the two partners, even for related couples.** Sex-aware X-linked pedigrees are out of scope; relatedness changes X-linked pair probabilities only slightly. Revisit if X-linked couples become a focus of the evaluation.
- **Specialist-read conditions (other Hb variants, HbH) are not generated.** No ground truth is defined for them (ADR 0100); the engine's handling is tested directly.
- **Pedigree founders are outbred and stated relationships are true.** Endogamy (clan, village) and mis-stated relationships are not modelled (research report 03 section 2.3).
- **Gates (pending, CBC-only, VUS, panel mismatch) are not injected into synthetic couples.** They are tested by hand-written and property tests; the oracle covers the simple couple table only.
- **The oracle classifies a couple from what was observed (detectable alleles) and from the truth; both use allele enumeration, not the engine's person-level tables.** A mutation test proves the comparison is not vacuous (a corrupted engine table is caught).

## Consequences
Agreement is consistency between two derivations of the same Mendelian rules on synthetic couples, not clinical validation. Rates derived from the generated population depend on the catalogue's frequencies, several of which are illustrative; X-linked G6PD (15 percent of males, from one hospital's 1994-96 newborns) makes X-linked lines very common in the synthetic population, so the report separates autosomal recessive metrics (`ar_*`) from the all-locus category counts.

## Revisit trigger
A statistician or clinician asks for endogamy or sex-aware X-linked pedigrees, or a real frequency table replaces the illustrative values.
