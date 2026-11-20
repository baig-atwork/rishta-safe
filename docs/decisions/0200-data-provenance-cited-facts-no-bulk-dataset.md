# ADR 0200: Data provenance: cited facts and hand-written tables, no bulk third-party dataset

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the declarations lane (G1), under the architecture contract (rules 1, 3 and 8)

## Context
The organisers supply no data and their FAQ requires every source to be declared. Their Terms bar content under third-party rights, and say a result relying on rights that are not commercially available may not qualify for a prize (Terms, third-party clause). The research dossier (section 5) proposed calibrating on AVDB, which carries "All rights reserved" with no terms stated, and listed the Jain et al. 2025 supplement (CC BY-NC-ND), GeneReviews (non-commercial research use, search summary), OMIM (commercial licence needed, search summary) and gnomAD (licence not verified on its own page; Middle Eastern group small and not Emirati) as other options. Written permission from AVDB was not obtained.

## Decision
Ingest no bulk third-party dataset. Panel, condition and haematology rule tables are small and hand-written, every row cited (title, year, URL or DOI, and the table or wording) or flagged illustrative. Published figures appear only as numbers with citations. The data declaration lists what is used and, separately, what is not used and why.

## Consequences
The dossier's plan to reproduce published Emirati at-risk figures from AVDB's gene table is not carried out, and we make no claim to reproduce them. Carrier frequencies and detection rates in the synthetic generator are assumed or illustrative and labelled so. The declaration states that any source not listed is not used, so the controller must reconcile it against the final data files before submission.

## Revisit trigger
Written permission from AVDB, or an open-licensed source of Emirati carrier frequencies, appears.

## Parking-lot line (controller to append)
- AVDB-based Emirati carrier frequencies for calibration | licence is "all rights reserved" and no permission was obtained (ADR 0200) | written permission or an open-licensed Emirati frequency source exists
