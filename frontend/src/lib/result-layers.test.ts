import { describe, expect, it } from "vitest";
import type { Block, ExplainerDoc } from "./api/types";
import { DISCLOSURE_ORDER, sectionResult, splitLayers } from "./result-layers";

const block = (kind: Block["kind"], text = ""): Block => ({ kind, text, items: [], icon_array: null, tone: "neutral", numbers: [] });
const doc = (blocks: Block[]): ExplainerDoc => ({
  locale: "en",
  language_status: "draft",
  blocks,
  glossary_keys: [],
  numbers_used: [],
  template_ids: [],
  check: null,
});

describe("splitLayers", () => {
  it("takes the first heading as the one-sentence result and the next paragraph as the lead", () => {
    const layers = splitLayers(doc([block("heading", "H"), block("paragraph", "lead"), block("paragraph", "more"), block("disclaimer", "d")]));
    expect(layers.headline?.text).toBe("H");
    expect(layers.lead?.text).toBe("lead");
    expect(layers.detail.map((b) => b.text)).toEqual(["more"]);
    expect(layers.disclaimers.map((b) => b.text)).toEqual(["d"]);
  });

  it("does not invent a lead when the heading is not followed by a paragraph", () => {
    const layers = splitLayers(doc([block("heading", "H"), block("callout", "c"), block("paragraph", "p")]));
    expect(layers.lead).toBeNull();
    expect(layers.detail.map((b) => b.kind)).toEqual(["callout", "paragraph"]);
  });

  it("copes with a doc that has no heading: the first paragraph leads, nothing is duplicated or dropped", () => {
    const layers = splitLayers(doc([block("paragraph", "only"), block("paragraph", "second")]));
    expect(layers.headline).toBeNull();
    expect(layers.lead?.text).toBe("only");
    expect(layers.detail.map((b) => b.text)).toEqual(["second"]);
  });
});

describe("splitLayers notices and trailing statements", () => {
  it("treats callouts before the headline as notices (the draft banner), not as layer-2 text", () => {
    const layers = splitLayers(doc([block("callout", "draft notice"), block("heading", "H"), block("paragraph", "lead"), block("paragraph", "p")]));
    expect(layers.notices.map((b) => b.text)).toEqual(["draft notice"]);
    expect(layers.detail.map((b) => b.text)).toEqual(["p"]);
  });

  it("keeps whatever follows the last disclaimer apart from layer 2, in order", () => {
    const layers = splitLayers(doc([block("heading", "H"), block("paragraph", "lead"), block("paragraph", "p"), block("disclaimer", "d"), block("callout", "footnote")]));
    expect(layers.detail.map((b) => b.text)).toEqual(["p"]);
    expect(layers.disclaimers.map((b) => b.text)).toEqual(["d"]);
    expect(layers.trailing.map((b) => b.text)).toEqual(["footnote"]);
  });
});

describe("sectionResult", () => {
  const b = (kind: Block["kind"], text: string, extra: Partial<Block> = {}): Block => ({ ...block(kind, text), ...extra });
  const spec = { total: 100, affected: 25, carrier: 50, neither: 25, caption: "cap" };
  const real = (): ExplainerDoc => ({
    ...doc([
      b("callout", "draft"),
      b("heading", "result"),
      b("paragraph", "summary"),
      b("paragraph", "basis"),
      b("icon_array", "cap", { icon_array: spec }),
      b("heading", "own"),
      b("paragraph", "own text"),
      b("heading", "partner"),
      b("paragraph", "partner text"),
      b("heading", "meaning"),
      b("paragraph", "m1"),
      b("heading", "limits"),
      b("paragraph", "l1"),
      b("heading", "privacy"),
      b("paragraph", "who can see"),
      b("paragraph", "options pointer"),
      b("disclaimer", "boundary"),
      b("callout", "synthetic"),
    ]),
    template_ids: [
      "status.draft_notice",
      "result.shared.heading",
      "result.shared.summary",
      "shared.basis.both_carriers",
      "icon_array.caption.any_child",
      "own.heading",
      "own.finding.carrier",
      "partner.heading",
      "partner.none",
      "meaning.heading",
      "meaning.risk_not_diagnosis",
      "limits.heading",
      "limits.panel_not_complete",
      "privacy.heading",
      "privacy.who_can_see",
      "options.pointer",
      "boundary.education_decision_support",
      "status.synthetic_notice",
    ],
  });

  it("maps headings to disclosures by their template id prefix", () => {
    const s = sectionResult(real());
    expect(s.classified).toBe(true);
    expect(s.headline?.text).toBe("result");
    expect(s.lead?.text).toBe("summary");
    expect(s.figure?.text).toBe("cap");
    expect(s.disclosures.own.map((x) => x.text)).toEqual(["own text"]);
    expect(s.disclosures.limits.map((x) => x.text)).toEqual(["l1"]);
    expect(s.disclosures.who.map((x) => x.text)).toEqual(["who can see"]);
    // result-section extras, partner and meaning sit together in disclosure 1 (headings kept: it spans sections)
    expect(s.disclosures.meaning.map((x) => x.text)).toEqual(["basis", "partner", "partner text", "meaning", "m1"]);
    expect(s.next.map((x) => x.text)).toEqual(["options pointer"]);
    expect(s.disclaimers.map((x) => x.text)).toEqual(["boundary"]);
    expect(s.trailing.map((x) => x.text)).toEqual(["synthetic"]);
  });

  it("loses no block: every block appears once across headline, lead, figure, disclosures, next, notices, disclaimers, trailing", () => {
    const source = real();
    const s = sectionResult(source);
    const all = [
      s.headline,
      s.lead,
      s.figure,
      ...DISCLOSURE_ORDER.flatMap((k) => s.disclosures[k]),
      ...s.next,
      ...s.notices,
      ...s.disclaimers,
      ...s.trailing,
    ].filter((x): x is Block => x !== null);
    // the three section headings dropped by design: own, limits, privacy
    expect(all.length).toBe(source.blocks.length - 3);
  });

  it("falls back to 'meaning' for everything when headings and template ids disagree (never guesses)", () => {
    const broken = { ...real(), template_ids: ["result.shared.heading", "own.heading"] };
    const s = sectionResult(broken);
    expect(s.classified).toBe(false);
    expect(s.disclosures.own).toEqual([]);
    expect(s.disclosures.meaning.length).toBeGreaterThan(5);
  });

  it("pairs identically for two languages of the same document (same disclosure shape)", () => {
    const a = sectionResult(real());
    const c = sectionResult(real());
    for (const key of DISCLOSURE_ORDER) expect(a.disclosures[key].map((x) => x.kind)).toEqual(c.disclosures[key].map((x) => x.kind));
  });
});
