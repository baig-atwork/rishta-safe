# ADR 0101: Residual-chance closed forms exist as internal analysis only

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** genetics lane, following ADR 0005

## Context
ADR 0005 cuts the residual-risk number from the product. Research report 03 still derives closed forms for the residual chance after negative tests (formulas 1 to 5), including the correlated-miss form that shows the naive per-partner update understates the chance for first cousins by about 16 times at q = 0.02, d = 0.80 (about 60 times at q = 0.005). The evaluation report and the tests need those forms to show the effect, and to pin the algebra against gene-dropping simulation.

## Decision
`bayan/genetics/residual.py` implements formulas 1 to 5 as an internal analysis module. It is not imported by any router, service method or template, and it is never shown in the UI or returned by an API. Its docstring states the modelling assumption (one detection probability per allele lineage, shared by descent; genes independent) and that a statistician has not reviewed it. Tests compare it with simulation: agreement within 10 percent for first cousins at q = 0.02, d = 0.80, and a more than tenfold understatement by the naive form. The tests confirm the algebra, not the assumption.

## Consequences
The "16 times" claim is reproducible in the repository, and the product still shows a detection rate and its limits (`detection.py`) rather than any residual figure.

## Revisit trigger
A statistician or genetic epidemiologist reviews the derivation; or real assay data show whether panel misses are mostly variant-level (shared by descent) or random (independent).
