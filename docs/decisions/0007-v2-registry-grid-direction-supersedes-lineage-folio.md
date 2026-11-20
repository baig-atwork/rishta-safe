# ADR 0007: Registry Grid direction and a new UX model supersede "Lineage Folio"

- **Status:** Accepted (supersedes ADR 0163 for look and for the interaction model; ADR 0163's rule that the three result categories are not a scale still stands)
- **Date:** 2026-11-20
- **Deciders:** the architect (controller), after the owner's rejection of the first build ("the ui/ux is not looking that good ... it looks a lot like our competitors", then "even UX matches a lot ... judges will know that we have copied things")

## Context
The first frontend ("Lineage Folio": cream paper, Newsreader serif, petrol accent, a pedigree-line hero, a 70 px stamp band and a persona select on every page, document-style pages) was checked against Linear, Stripe and Vercel only. It was never checked against the other entries in the same challenge. Measured on the four live rival demos on 2026-11-20 (`D:\dev\_research\ch03-ui\rival-ux-map.md`, 61 screenshots):
- Two Keys: cream #f1eee8, black ink, a pedigree-diagram hero beside the headline, "Try ..." and "See how it works" buttons, a persona and two-phone demo. Rishta Safe's hero and background were nearly the same.
- KinSight: teal on cool off-white, an anonymous persona entry, a "Verify chain" button. Silah: lavender-grey, phone frames, a 13-step guided story, a diamond stepper. GeneBridge: peach and orange, helix.
- Rishta Safe was present or partial in 16 of 19 tabled UX and visual patterns (persona chooser, my-home pathway stepper, three-layer result, "N out of 100" array with half marks, who-sees-what table, queue plus brief, teach-back, scoreboard page).
All four rivals are light, warm and friendly-consumer. Visual distance alone was not enough: the owner's second point was that the interaction patterns coincide too.

## Decision
1. Adopt the **Registry Grid** direction (`docs/design/v2/01-direction.md`, `DESIGN.md`, `tokens.css`): cool mineral white pages, a dark ink hero and evidence console, one lapis accent (about 3% of pixels), Archivo (width axis) with Red Hat Mono, Noto Kufi Arabic for the Arabic interface and Naskh for Arabic reading prose, Nastaliq for Urdu prose, radii 0/2/4/6, hairlines instead of shadows. Signature element: the **tally grid** (square cells: solid, hatch, open, dashed edge for pending) used for the result grid, category chip, who-sees-what matrix, threshold options, evidence cells, case bench and wordmark.
2. Adopt the **UX model** in `docs/design/v2/02-ux-concept.md`, all on existing endpoints: the **threshold** (a four-way choice before any result is rendered, backed by the right-not-to-know endpoint), **read together** (both partners' languages side by side from two `?locale=` calls), **who sees what** as a visibility matrix with a visible audit row per change, **Evidence** as live adversarial probes plus the scoreboard with "not run" cells, the **case bench** (ten cases by what they test, crossed with role lenses) instead of a persona picker, and the **staff instrument** (queue, brief, trace; every brief line links to its rule and source).
3. Answers to the design director's open questions: lapis approved (measured against the rival palettes); a bench link may carry `?enter=now` and is labelled "skip the choice" so a judge is never blocked; the landing hero uses a recorded API response (committed fixture, labelled "from a recorded response") with a live fetch only if it costs no client JavaScript; `Pedigree.tsx` and the Newsreader and Source Sans files may be deleted once nothing references them.
4. The pedigree motif, the 100-circle array with half marks, the "Viewing as" wording (KinSight's words) and the text-left, object-right hero (Two Keys' layout) are retired.

## Consequences
- A large visual and structural change to all 15 routes on the day of the deadline. Mitigations: the work runs on a branch (`v2-registry-grid`), the old build stays on `main` until the v2 branch passes typecheck, lint, vitest, the real-backend end-to-end suite, the route budget and the design gate; the existing tests are adapted, not deleted.
- The threshold adds one click before a couple sees a result; the cost is accepted because it is the product's main distinction, and the judge shortcut removes it for evaluation.
- The Arabic and Urdu interface copy for the new screens is draft and awaits native clinical review, as before.
- Hosting wording, honesty stamps and all hard rules are unchanged.

## Revisit trigger
A rival entry converges on tally-grid or threshold patterns, or the owner rejects the look after seeing the built app.
