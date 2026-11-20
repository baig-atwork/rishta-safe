import resultAr from "@/lib/api/real/__fixtures__/result_02a_ar.json";
import resultEn from "@/lib/api/real/__fixtures__/result_02a.json";
import resultUr from "@/lib/api/real/__fixtures__/result_02a_ur.json";
import escalationsFixture from "@/lib/api/real/__fixtures__/escalations.json";
import scoreboardFixture from "@/lib/api/real/__fixtures__/scoreboard_full.json";
import { escalationQueueSchema, scoreboardSchema } from "@/lib/api/real/schemas";
import type { IconArraySpec, Locale, ResultCategory, Scoreboard } from "@/lib/api/types";

/**
 * Landing-page data, all of it recorded from the real backend (the committed fixtures the adapter tests use) and read
 * on the server. Nothing here is typed by hand: the sheet's wording is the API's own text for the case.
 */

export const SHEET_COUPLE_ID = "cpl-demo-02";

interface RawBlock {
  kind: string;
  text: string;
  icon_array: IconArraySpec | null;
}
interface RawResult {
  couple_id: string;
  locale: string;
  disclosed: { category: ResultCategory | null; relationship?: string; policy?: string };
  document: { language_status: string; blocks: RawBlock[] };
}

export interface SheetColumn {
  locale: Locale;
  dir: "ltr" | "rtl";
  heading: string;
  summary: string;
  caption: string;
  languageStatus: string;
}

export interface LandingSheet {
  coupleId: string;
  category: ResultCategory;
  relationship: string;
  policy: string;
  columns: SheetColumn[];
  tally: IconArraySpec;
  endpoints: string;
}

const RAW: Record<"en" | "ar" | "ur", RawResult> = {
  en: resultEn as unknown as RawResult,
  ar: resultAr as unknown as RawResult,
  ur: resultUr as unknown as RawResult,
};

/** Which two languages the sheet shows for a page locale: the page's own first, then the other end of the pair. */
export function sheetLocales(page: Locale): [Locale, Locale] {
  if (page === "ar") return ["ar", "en"];
  if (page === "ur") return ["ur", "en"];
  return ["en", "ar"];
}

function column(locale: Locale): SheetColumn {
  const raw = RAW[locale];
  const blocks = raw.document.blocks;
  const heading = blocks.find((b) => b.kind === "heading")?.text ?? "";
  const summary = blocks.find((b) => b.kind === "paragraph")?.text ?? "";
  const caption = blocks.find((b) => b.kind === "icon_array")?.icon_array?.caption ?? "";
  return {
    locale,
    dir: locale === "en" ? "ltr" : "rtl",
    heading,
    summary,
    caption,
    languageStatus: raw.document.language_status,
  };
}

export function buildLandingSheet(page: Locale): LandingSheet {
  const [first, second] = sheetLocales(page);
  const base = RAW.en;
  const tally = base.document.blocks.find((b) => b.kind === "icon_array")?.icon_array;
  if (!tally || base.disclosed.category === null) throw new Error("The recorded landing fixture has no result and tally.");
  return {
    coupleId: SHEET_COUPLE_ID,
    category: base.disclosed.category,
    relationship: base.disclosed.relationship ?? "",
    policy: base.disclosed.policy ?? "",
    columns: [column(first), column(second)],
    tally,
    endpoints: `GET /v1/couples/${SHEET_COUPLE_ID}/result?locale=${first}  ·  ?locale=${second}`,
  };
}

// ---- evidence ----------------------------------------------------------------------------------------------

export interface LandingMetric {
  id: string;
  title: string;
  value: string;
  n: number | null;
  measured: boolean;
  doesNotShow: string;
  /** A 100% regression gate (the same team wrote the check and the thing checked): tagged so it is not read as safety evidence. */
  gate: boolean;
}

/**
 * The metrics the landing shows, in this order: the weakest measured figure first (M6, the refusal classifier's first run),
 * then the regression gates, then the two measures that were not run. Their wording and numbers are the scoreboard's own.
 */
export const LANDING_METRIC_IDS = ["M6", "M1", "M5", "M2b", "M4", "M8", "M9"] as const;

/**
 * Figures that are regression gates, not safety evidence. The scoreboard's own caveat says "Several figures compare an
 * implementation with another written by the same team"; these are the ones that read 100%.
 */
const GATE_IDS: ReadonlySet<string> = new Set(["m1", "m2", "m2b", "m4", "m5"]);

export function isRegressionGate(id: string): boolean {
  return GATE_IDS.has(id.toLowerCase());
}

/** Evidence cards, weakest first: M6 leads wherever it appears, everything else keeps its order. */
export function weakestFirst<T extends { id: string }>(metrics: readonly T[]): T[] {
  const weak = metrics.filter((m) => m.id.toLowerCase() === "m6");
  return [...weak, ...metrics.filter((m) => m.id.toLowerCase() !== "m6")];
}

/**
 * Grid-cell classes that fill the evidence grid without an empty cell: the lead card is double width and the last card
 * stretches over whatever is left of its row, at the two-column and the wider breakpoint.
 */
export function evidenceSpan(count: number, index: number, opts: { leadWide: boolean; wideColumns: 3 | 4 }): string {
  const classes: string[] = [];
  if (opts.leadWide && index === 0) {
    classes.push("sm:col-span-2", "lg:col-span-2");
    return classes.join(" ");
  }
  if (index === count - 1) {
    // Grid slots taken before the last card: the lead card takes two, every other card one.
    const before = opts.leadWide ? count : count - 1;
    const smSpan = 2 - (before % 2);
    const lgSpan = opts.wideColumns - (before % opts.wideColumns);
    if (smSpan === 2) classes.push("sm:col-span-2");
    if (lgSpan === 1) {
      if (smSpan === 2) classes.push("lg:col-span-1");
    } else {
      classes.push(lgSpan === 2 ? "lg:col-span-2" : lgSpan === 3 ? "lg:col-span-3" : "lg:col-span-4");
    }
  }
  return classes.join(" ");
}

export function landingMetrics(): LandingMetric[] {
  const board = scoreboardSchema.parse(scoreboardFixture);
  const out: LandingMetric[] = [];
  for (const id of LANDING_METRIC_IDS) {
    const metric = board.metrics.find((m) => m.id === id);
    if (!metric) continue;
    out.push({
      id: metric.id,
      title: metric.title,
      value: metric.value,
      n: metric.n ?? null,
      measured: metric.status === "measured",
      doesNotShow: metric.does_not_show,
      gate: isRegressionGate(metric.id),
    });
  }
  return out;
}

// ---- staff queue sample ------------------------------------------------------------------------------------

export interface LandingQueueRow {
  coupleId: string;
  ruleId: string;
  tier: string;
  due: "immediate" | "same_session" | "fast_track" | "routine";
}

const DUE_RANK = { immediate: 3, same_session: 2, fast_track: 1, routine: 0 } as const;

/** Four rows of the recorded review queue, most urgent first (one row per couple, its most urgent rule). */
export function landingQueue(limit = 4): LandingQueueRow[] {
  const queue = escalationQueueSchema.parse(escalationsFixture);
  const byCouple = new Map<string, LandingQueueRow>();
  for (const record of queue.records) {
    for (const d of record.decisions) {
      const row: LandingQueueRow = { coupleId: record.couple_id, ruleId: d.trigger_id, tier: d.tier, due: d.due_by_hint };
      const seen = byCouple.get(record.couple_id);
      if (!seen || DUE_RANK[row.due] > DUE_RANK[seen.due]) byCouple.set(record.couple_id, row);
    }
  }
  return [...byCouple.values()].sort((a, b) => DUE_RANK[b.due] - DUE_RANK[a.due] || a.coupleId.localeCompare(b.coupleId)).slice(0, limit);
}

// ---- the whole scoreboard, recorded -------------------------------------------------------------------------------

/**
 * The full recorded scoreboard in the UI's own shape. The Evidence page shows it, labelled as recorded, to a visitor with no
 * lens (the live endpoint needs one), so the page is never a dead end.
 */
export function recordedScoreboard(): Scoreboard {
  const real = scoreboardSchema.parse(scoreboardFixture);
  return {
    generated_at: real.generated_at,
    synthetic: real.data_label === "synthetic",
    metrics: real.metrics.map((m) => ({
      id: m.id,
      name: m.title,
      value: m.value,
      n: m.n ?? null,
      status: m.status === "measured" ? "measured" : "not_run",
      method: m.method,
      does_not_show: m.does_not_show,
    })),
    caveats: real.caveats,
    code_version: real.code_version,
  };
}
