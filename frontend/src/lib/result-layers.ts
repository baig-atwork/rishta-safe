import type { Block, ExplainerDoc } from "./api/types";

export interface ResultLayers {
  /** Layer 1: the result in one sentence (first heading of the rendered doc). */
  headline: Block | null;
  /** The sentence or two that follow the headline directly. */
  lead: Block | null;
  /** Layer 2: what it means and what it does not mean (everything else except notices, disclaimers and footnotes). */
  detail: Block[];
  /** Boundary statements supplied by the explainer. */
  disclaimers: Block[];
  /** Callouts that open the document before its headline (the "draft" notice); the page shows draft status as a chip instead. */
  notices: Block[];
  /** Anything after the last disclaimer (for example the "synthetic prototype" footnote): shown with the disclaimers. */
  trailing: Block[];
}

/**
 * Splits an explainer doc into the three-layer reading order. Layout only: no wording is created or changed
 * here, because result text comes from the API (reviewed templates), never from components.
 */
export function splitLayers(doc: ExplainerDoc): ResultLayers {
  const blocks = doc.blocks;
  const headlineIndex = blocks.findIndex((b) => b.kind === "heading");
  const headline = headlineIndex >= 0 ? (blocks[headlineIndex] ?? null) : null;
  const afterHeadline = headlineIndex >= 0 ? blocks.slice(headlineIndex + 1) : blocks;
  const leadIndex = afterHeadline.findIndex((b) => b.kind === "paragraph");
  const lead = leadIndex === 0 ? (afterHeadline[0] ?? null) : null;
  const remainder = lead ? afterHeadline.slice(1) : afterHeadline;

  const before = headlineIndex > 0 ? blocks.slice(0, headlineIndex) : [];
  const notices = before.filter((b) => b.kind === "callout");
  const beforeKept = before.filter((b) => b.kind !== "callout");

  const lastDisclaimer = remainder.reduce((last, b, i) => (b.kind === "disclaimer" ? i : last), -1);
  const trailing = lastDisclaimer >= 0 ? remainder.slice(lastDisclaimer + 1) : [];
  const body = lastDisclaimer >= 0 ? remainder.slice(0, lastDisclaimer + 1) : remainder;
  const flow = [...beforeKept, ...body];

  return {
    headline,
    lead,
    detail: flow.filter((b) => b.kind !== "disclaimer"),
    disclaimers: flow.filter((b) => b.kind === "disclaimer"),
    notices,
    trailing,
  };
}

// ---- v2: sections for the Registry Grid result (headline, figure, four disclosures, next step) --------------------------

export type DisclosureKey = "meaning" | "own" | "limits" | "who";
export const DISCLOSURE_ORDER: readonly DisclosureKey[] = ["meaning", "own", "limits", "who"];

export interface ResultSections {
  headline: Block | null;
  lead: Block | null;
  /** The first icon array of the document: the tally beside the first fold. Its text is the API caption. */
  figure: Block | null;
  /** The four disclosures, in the order of `DISCLOSURE_ORDER`: every remaining block lands in exactly one. */
  disclosures: Record<DisclosureKey, Block[]>;
  /** The document's own pointer to the next step (options.pointer or a *.next paragraph) when it closes the content. */
  next: Block[];
  disclaimers: Block[];
  notices: Block[];
  trailing: Block[];
  /** False when the headings could not be matched to template ids: everything then sits in "meaning" (nothing is lost or guessed). */
  classified: boolean;
}

const HEADING_ID = /\.heading$|^result\.more_info\.why$/;
const NEXT_ID = /(^|\.)next$|^options\.pointer$/;
const FRAME_ID = /^(boundary|status)\./;

/** First path segment of a template id decides the disclosure its section belongs to. */
function disclosureFor(templateId: string): DisclosureKey {
  const prefix = templateId.split(".")[0] ?? "";
  switch (prefix) {
    case "own":
      return "own";
    case "limits":
      return "limits";
    case "privacy":
    case "policy":
    case "certificate":
    case "options":
      return "who";
    default:
      // result, shared, withheld, meaning, partner and anything unknown
      return "meaning";
  }
}

/**
 * Splits a result document into the Registry Grid structure (02-ux-concept 4.2). A document is a run of sections that
 * each start with a heading block; the i-th heading block belongs to the i-th heading template id of `template_ids`
 * (the ids are in render order), and its id's prefix names the section (own, partner, meaning, limits, privacy, ...).
 * When the counts disagree, nothing is assigned by guesswork: all of the layer-2 flow goes to "meaning". No wording is
 * created or changed here.
 */
export function sectionResult(doc: ExplainerDoc): ResultSections {
  const base = splitLayers(doc);
  const headingIds = doc.template_ids.filter((id) => HEADING_ID.test(id));
  let flow = [...base.detail];
  const figureIndex = flow.findIndex((b) => b.kind === "icon_array");
  const figure = figureIndex >= 0 ? (flow[figureIndex] ?? null) : null;
  if (figureIndex >= 0) flow = flow.filter((_, i) => i !== figureIndex);

  // The block that closes the content may be the document's pointer to the next step.
  const contentIds = doc.template_ids.filter((id) => !FRAME_ID.test(id));
  const lastId = contentIds[contentIds.length - 1] ?? "";
  const last = flow[flow.length - 1];
  const next: Block[] = last !== undefined && last.kind === "paragraph" && NEXT_ID.test(lastId) ? [last] : [];
  if (next.length > 0) flow = flow.slice(0, -1);

  const disclosures: Record<DisclosureKey, Block[]> = { meaning: [], own: [], limits: [], who: [] };
  // The headline heading is not part of the flow (splitLayers took it), so its id is the first heading id.
  const sectionIds = base.headline !== null ? headingIds.slice(1) : headingIds;
  const flowHeadingCount = flow.filter((b) => b.kind === "heading").length;
  const aligned = flowHeadingCount === sectionIds.length;

  let current: DisclosureKey = "meaning";
  let seen = 0;
  for (const b of flow) {
    if (b.kind === "heading" && aligned) {
      current = disclosureFor(sectionIds[seen] ?? "");
      seen += 1;
    }
    disclosures[aligned ? current : "meaning"].push(b);
  }
  // A disclosure that is exactly one section drops its own leading heading: the disclosure title says it already.
  if (aligned) {
    for (const key of ["own", "limits", "who"] as const) {
      const headings = disclosures[key].filter((b) => b.kind === "heading").length;
      if (headings === 1 && disclosures[key][0]?.kind === "heading") disclosures[key] = disclosures[key].slice(1);
    }
  }

  return {
    headline: base.headline,
    lead: base.lead,
    figure,
    disclosures,
    next,
    disclaimers: base.disclaimers,
    notices: base.notices,
    trailing: base.trailing,
    classified: aligned,
  };
}
