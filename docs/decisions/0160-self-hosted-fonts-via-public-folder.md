# 0160: Self-hosted fonts from `public/fonts` with plain `@font-face`, not `next/font`

Status: accepted (2026-11-20). Lane D (frontend).

## Context

The brief asked for self-hosted `next/font` faces that render Arabic and Urdu well within the performance budget. Requirements that `next/font/google` and `next/font/local` do not meet together: (1) the build must work offline (CI and Docker must not depend on fonts.googleapis.com at build time; `next/font/google` fails the production build if the download fails), (2) per-locale preloading (an Arabic page should preload the Arabic face only, an English page the two Latin faces), (3) `unicode-range` subsetting so a Latin glyph inside an Arabic page does not pull a second file, (4) a 239 KB Nastaliq face that must be loaded only on `/ur`.

## Decision

Commit the WOFF2 files (SIL OFL 1.1; licence files alongside) to `frontend/public/fonts/`, declare them with `@font-face` in `globals.css` (`font-display: swap`, `unicode-range`), preload per locale with `react-dom`'s `preload()` in the locale layout, serve with `Cache-Control: immutable`. Faces: Newsreader (Latin voice), Source Sans 3 (Latin interface), Noto Naskh Arabic (Arabic voice and interface, Urdu interface), Noto Nastaliq Urdu (Urdu headings and reading prose). Sizes: 58 KB, 29 KB, 94 KB, 239 KB (variable weight, one subset each). Source: Fontsource packages at 5.3.x, extracted from the npm tarballs.

## Consequences

Deterministic offline builds; no third-party request at runtime; only the locale's faces are preloaded. We lose `next/font`'s automatic metric-matched fallback; layout shift on swap is measured instead (CLS budget 0.1) and the leading for Arabic and Urdu is set generously so the swap does not move blocks. Revisit if `next/font/local` gains per-route `unicode-range` control.
