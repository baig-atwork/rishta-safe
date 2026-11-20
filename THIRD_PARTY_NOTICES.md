# Third-party notices

Rishta Safe is a prototype running on made-up data. This file lists third-party material that Rishta Safe uses or cites, with its licence, and third-party material it deliberately does not ship. The data declaration (`backend/src/bayan/data/declarations/data_declaration.md`) is the narrative version of the same facts. Where a licence has not been checked, this file says so.

## Content used under a licence

### NHS England: Sickle cell and thalassaemia screening handbook for antenatal laboratories

- **Edition and date.** Fifth edition, updated 10 October 2024.
- **Source.** https://www.gov.uk/government/publications/sct-screening-handbook-for-antenatal-laboratories
- **Licence.** Open Government Licence v3.0. The publication page footer reads "All content is available under the Open Government Licence v3.0, except where otherwise stated" and carries a Crown copyright notice (checked 2026-11-20).
- **Use.** Thresholds and rule wording are cited as facts with chapter and section, in the haematology rule table.
- **Attribution.** Contains public sector information licensed under the Open Government Licence v3.0. Licence text: https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/

### SITE 2022: First and second level haemoglobinopathies diagnosis

- **Source.** Italian Society of Thalassemia and Haemoglobinopathies best-practice paper, Journal of Clinical Medicine 2022;11(18):5426, DOI 10.3390/jcm11185426. Authors are as listed on the article page.
- **Licence.** CC BY. Europe PMC's licence field reads "cc by"; the version number is not stated in the field and the publisher page returned HTTP 403, so the version is not independently confirmed.
- **Use.** Thresholds and expert-agreement statements are cited as facts with section references. No text is reproduced.
- **Changes.** None to the source; we cite only.

### Conditional entry: Single Item Literacy Screener

- **Source.** BMC Family Practice 2006;7:21, PMC1435902. Licence CC BY.
- **Use.** Include this entry only if the closure form ships this item as an optional stratifier. If it does not, delete this entry.

## Cited as facts only, no text reproduced, licence not checked

- British Society for Haematology 2023 guideline (Br J Haematol 201:1047, DOI 10.1111/bjh.18794).
- Thalassaemia International Federation short guide on prevention and diagnosis of haemoglobinopathies.
- Oman Ministry of Health Premarital Testing and Counseling Guideline, first edition 2018.
- ACMG 2021 carrier screening practice resource (Genet Med, PMC8488021) and the 2016 ESHG carrier screening recommendations (Eur J Hum Genet, PMC4867464; Rishta Safe authoring note: its licence was recorded as CC BY-NC-SA, so reuse of its text is excluded). Formulas and recommendations are cited, never copied.
- Published prevalence and carrier figures from journal articles, each cited where it appears.
- PRSB outpatient letter standards (2017) and the HL7 FHIR Task resource, used as structural anchors for the closure proforma. The HL7 Genomics Reporting IG states CC BY 4.0; the FHIR Task page showed no licence line when read.

## Not shipped, and why

- **AVDB:** "All rights reserved", no terms stated.
- **Jain et al. 2025 supplement (Genet Med Open):** CC BY-NC-ND.
- **GeneReviews and OMIM:** restricted licences, not ingested.
- **gnomAD:** not used.
- **Decisional Conflict Scale, Decision Regret Scale, GCOS-24, MMIC and Newest Vital Sign:** conditional, missing or "all rights reserved" terms. Not shipped.
- **DoH Abu Dhabi and DHA Dubai forms, risk statements, report layouts and the published gene list:** not copied. The DHA text bars copying without written permission, and the DoH document states no reuse licence.
- **Rival repositories:** nothing copied.

## Open-source dependencies

### Backend (Python, runtime set)

| Package | Version | Licence |
|---|---|---|
| annotated-doc | 0.0.7 | MIT |
| annotated-types | 0.8.0 | MIT |
| anyio | 4.16.0 | MIT |
| certifi | 2026.10.23 | MPL-2.0 |
| click | 8.5.1 | BSD-3-Clause |
| fastapi | 0.165.0 | MIT |
| h11 | 0.16.0 | MIT |
| httpcore | 1.0.9 | BSD-3-Clause |
| httptools | 0.9.0 | MIT |
| httpx | 0.28.1 | BSD-3-Clause |
| idna | 3.20 | BSD-3-Clause |
| numpy | 2.5.5 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 |
| opentelemetry-api | 1.45.2 | Apache-2.0 |
| pydantic | 2.14.4 | MIT |
| pydantic-core | 2.50.5 | MIT |
| pydantic-settings | 2.16.3 | MIT |
| python-dotenv | 1.2.4 | BSD-3-Clause |
| pyyaml | 6.0.3 | MIT |
| starlette | 1.10.0 | BSD-3-Clause |
| structlog | 26.1.0 | MIT OR Apache-2.0 |
| typing-extensions | 4.16.0 | PSF-2.0 |
| typing-inspection | 0.4.5 | MIT |
| uvicorn | 0.54.0 | BSD-3-Clause |
| uvloop | not installed on the Windows build machine (Linux container only) | MIT OR Apache-2.0 (project metadata, not read from an install here) |
| watchfiles | 1.3.0 | MIT |
| websockets | 17.4 | BSD-3-Clause |

### Frontend (JavaScript, production set)

| Package | Version | Licence |
|---|---|---|
| @babel/code-frame | 7.29.7 | MIT |
| @babel/compat-data | 7.29.7 | MIT |
| @babel/core | 7.29.13 | MIT |
| @babel/generator | 7.29.14 | MIT |
| @babel/helper-compilation-targets | 7.29.13 | MIT |
| @babel/helper-globals | 7.29.7 | MIT |
| @babel/helper-module-imports | 7.29.7 | MIT |
| @babel/helper-module-transforms | 7.29.14 | MIT |
| @babel/helper-string-parser | 7.29.14 | MIT |
| @babel/helper-validator-identifier | 7.29.7 | MIT |
| @babel/helper-validator-option | 7.29.7 | MIT |
| @babel/helpers | 7.29.14 | MIT |
| @babel/parser | 7.29.14 | MIT |
| @babel/template | 7.29.7 | MIT |
| @babel/traverse | 7.29.14 | MIT |
| @babel/types | 7.29.14 | MIT |
| @eloqnt/config | 0.1.2 | MIT |
| @eloqnt/format-json | 0.1.1 | MIT |
| @eloqnt/format-po | 0.1.2 | MIT |
| @formatjs/fast-memoize | 3.1.7 | MIT |
| @formatjs/icu-messageformat-parser | 3.5.23 | MIT |
| @formatjs/icu-skeleton-parser | 2.1.13 | MIT |
| @formatjs/intl-localematcher | 0.8.14 | MIT |
| @hookform/resolvers | 7.0.7 | MIT |
| @img/colour | 1.1.0 | MIT |
| @img/sharp-win32-x64 | 0.35.5 | Apache-2.0 AND LGPL-3.0-or-later |
| @jridgewell/gen-mapping | 0.3.13 | MIT |
| @jridgewell/remapping | 2.3.5 | MIT |
| @jridgewell/resolve-uri | 3.1.3 | MIT |
| @jridgewell/sourcemap-codec | 1.6.0 | MIT |
| @jridgewell/trace-mapping | 0.3.31 | MIT |
| @next/env | 16.4.6 | MIT |
| @next/swc-win32-x64-msvc | 16.4.6 | MIT |
| @parcel/watcher | 2.6.0 | MIT |
| @parcel/watcher-win32-x64 | 2.6.0 | MIT |
| @playwright/test | 1.65.1 | Apache-2.0 |
| @schummar/icu-type-parser | 1.21.5 | MIT |
| @standard-schema/utils | 0.3.0 | MIT |
| @swc/core | 1.16.22 | Apache-2.0 |
| @swc/core-win32-x64-msvc | 1.16.22 | Apache-2.0 AND MIT |
| @swc/counter | 0.1.3 | Apache-2.0 |
| @swc/helpers | 0.5.23 | Apache-2.0 |
| @swc/types | 0.1.28 | Apache-2.0 |
| @tanstack/query-core | 5.108.0 | MIT |
| @tanstack/react-query | 5.108.0 | MIT |
| @types/node | 24.19.2 | MIT |
| @types/react | 19.3.0 | MIT |
| baseline-browser-mapping | 2.11.38 | Apache-2.0 |
| browserslist | 4.29.6 | MIT |
| caniuse-lite | 1.0.30001826 | CC-BY-4.0 |
| client-only | 0.0.1 | MIT |
| clsx | 2.1.1 | MIT |
| content-type | 2.1.0 | MIT |
| convert-source-map | 2.0.0 | MIT |
| csstype | 3.2.4 | MIT |
| debug | 4.4.3 | MIT |
| detect-libc | 2.1.2 | Apache-2.0 |
| electron-to-chromium | 1.5.490 | ISC |
| escalade | 3.2.0 | MIT |
| gensync | 1.0.0-beta.2 | MIT |
| icu-minify | 4.15.2 | MIT |
| intl-messageformat | 12.2.0 | BSD-3-Clause |
| is-extglob | 2.1.1 | MIT |
| is-glob | 4.0.3 | MIT |
| js-tokens | 4.0.0 | MIT |
| jsesc | 3.1.0 | MIT |
| json5 | 2.2.3 | MIT |
| lru-cache | 5.1.1 | ISC |
| lucide-react | 1.74.0 | ISC |
| ms | 2.1.3 | MIT |
| nanoid | 3.3.20 | MIT |
| negotiator | 1.1.0 | MIT |
| next | 16.4.6 | MIT |
| next-intl | 4.15.1 | MIT |
| next-intl-swc-plugin-extractor | 4.15.1 | MIT |
| node-addon-api | 7.1.1 | MIT |
| node-releases | 2.0.65 | MIT |
| picocolors | 1.1.1 | ISC |
| picomatch | 4.0.7 | MIT |
| playwright | 1.65.1 | Apache-2.0 |
| playwright-core | 1.65.1 | Apache-2.0 |
| po-parser | 2.2.0 | MIT |
| postcss | 8.5.23 | MIT |
| react | 19.3.1 | MIT |
| react-dom | 19.3.1 | MIT |
| react-hook-form | 7.92.0 | MIT |
| scheduler | 0.28.0 | MIT |
| semver | 6.3.2, 7.8.6 | ISC |
| sharp | 0.35.5 | Apache-2.0 |
| source-map-js | 1.2.3 | BSD-3-Clause |
| styled-jsx | 5.1.6 | MIT |
| supports-color | 10.2.2 | MIT |
| tailwind-merge | 3.7.0 | MIT |
| tslib | 2.9.1 | 0BSD |
| undici-types | 7.24.6 | MIT |
| update-browserslist-db | 1.4.0 | MIT |
| use-intl | 4.15.1 | MIT |
| yallist | 3.1.1 | ISC |
| zod | 4.6.7 | MIT |

Notes on the table above: `caniuse-lite` is CC-BY-4.0 and is attributed here (build-time browser data only). The `@img/sharp-*` binaries bundle libvips under LGPL-3.0-or-later and are used by the Next.js image tooling at build and run time as separate shared libraries; the Windows build was used locally and the Linux build is used in the container.

## Fonts

Five typefaces are self-hosted as WOFF2 files in `frontend/public/fonts/` (no request to a font service at run time). All are under the SIL Open Font License 1.1; the licence text of each is in `frontend/public/fonts/licences/`.

| Typeface | Used for | Licence | Licence file |
|---|---|---|---|
| Archivo (variable, width and weight axes) | Latin interface, headings and reading text | SIL OFL 1.1 | `OFL-archivo.txt` |
| Red Hat Mono | Identifiers, hashes, figures and labels | SIL OFL 1.1 | `OFL-redhatmono.txt` |
| Noto Kufi Arabic | Arabic interface text and headings | SIL OFL 1.1 | `OFL-notokufiarabic.txt` |
| Noto Naskh Arabic | Arabic reading text and the Urdu interface | SIL OFL 1.1 | `OFL-notonaskharabic.txt` |
| Noto Nastaliq Urdu | Urdu reading text (loaded on `/ur` only) | SIL OFL 1.1 | `OFL-notonastaliqurdu.txt` |

Newsreader and Source Sans 3 were used by the first build and are no longer loaded or shipped (removed with the Registry Grid direction, ADR 0007).

## Licence texts

Each package's licence text ships in its own distribution (the `licenses` directory of the wheel or the package folder in `node_modules`). They are not reproduced here.
