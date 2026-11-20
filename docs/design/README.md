# Design

**Current direction: Registry Grid, in `v2/`.** Committed 2026-11-20 by ADR 0007, which superseded the first build's direction.

- `v2/01-direction.md`: the visual direction (dark ink hero, cool mineral-white pages, one lapis accent, Archivo with Red Hat Mono, Noto Kufi and Naskh for Arabic, Noto Nastaliq for Urdu prose, hairlines instead of shadows) and its signature element, the tally grid of square cells.
- `v2/02-ux-concept.md`: the UX model and the per-screen spec (case bench, threshold, read together, who sees what, Evidence probes, staff instrument).
- `v2/DESIGN.md` and `v2/tokens.css`: the tokens in google-labs-code/design.md format and as CSS variables. The CSS variables in `frontend/src/app/globals.css` implement them; change `v2/DESIGN.md` first.
- `v2/00-ux-audit.md`, `v2/03-build-lanes.md`, `v2/lane-*.md` and the screenshot folders under `v2/`: how the redesign was audited, split and built.
- Decisions behind the direction: ADR 0007 (direction and UX model), 0160 (fonts), 0166 (CSS motion and the route JS budget), 0168 to 0179 (the screens).

**Superseded: `DESIGN.md` in this folder.** It is the first build's "Lineage Folio" direction (cream paper, serif, a pedigree motif), kept for history and not deleted. Do not implement it. ADRs 0163 and 0164 are superseded in look and interaction model by ADR 0007; the rule that the three result categories are not a scale still stands.

`shots/` is written by `pnpm shots` from `frontend/` (server running with `BAYAN_MOCK=1`, screenshots at 390, 768 and 1440 px in English and Arabic). Regenerate it from the current build before using any image from it in submission material.
