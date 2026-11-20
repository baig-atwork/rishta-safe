# ADR 0201: Cut: the standards' text and gene list, and the named patient-reported instruments

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** the declarations lane (G1), under the architecture contract (rule 8)

## Context
The DHA Dubai standard says its contents "shall not be copied or reproduced in any form without prior written permission". The DoH Abu Dhabi standard states no reuse licence, its consent form is a laboratory's own and marked against unauthorised copying, and its 570-gene list is published without a licence (research R02 section 1). The Decisional Conflict Scale and Decision Regret Scale are free only if not used for profit and not altered, GCOS-24 has no licence terms we could find, the Newest Vital Sign page says "All rights reserved", and MMIC wording is copyrighted journal text (R04 section 2.1). No Arabic or Urdu version of DCS, DRS, GCOS-24 or MMIC was found.

## Decision
Model the structure of the two standards and write original wording that cites the clause it follows. Do not copy their forms, risk statements, report layouts or gene list. Do not ship any named instrument. The eight patient closure items are original, with construct anchors cited.

## Consequences
The eight items have no psychometric validation, so results are reported item by item and no scale score or reliability figure is computed (R04 section 2.1). The panel in the product is a small illustrative subset, and we assert no gene count for the national panel.

## Revisit trigger
Written permission from the standards' owners or the instruments' copyright holders, including terms for translation and commercial use.

## Parking-lot line (controller to append)
- Published patient-reported instruments (DCS, DRS, GCOS-24) in a pilot | licence terms are conditional or unknown and no Arabic or Urdu versions were found (ADR 0201) | written permission covering translation and commercial use is obtained
