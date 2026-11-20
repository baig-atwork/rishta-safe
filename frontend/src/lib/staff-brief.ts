import type { CounsellorBrief, EscalationDecision } from "@/lib/api/types";

/**
 * The staff instrument's trace model. Nothing here is generated: every chip points at an entry that is a rule the API
 * returned, a trace line the API returned, a record count, or the engine ruleset the API names. The mapping from a
 * brief line to its entry uses only structure the API provides (the leading rule id of a "why" line, the condition id
 * of a "result" line, the section key), never wording.
 */

export type TraceKind = "engine" | "rule" | "line" | "consent" | "pathway";

export interface TraceEntry {
  id: string;
  kind: TraceKind;
  /** API text for a `line` entry (the trace line without its leading id), the ruleset for `engine`. */
  text: string;
  /** `rule` entries: the escalation rule (trigger) id, tier, due hint, source and the two review flags. */
  ruleId?: string;
  reason?: string;
  tier?: string;
  due?: string;
  source?: string;
  signoffPending: boolean;
  legalRead: boolean;
  /** `consent` and `pathway`: counts and state keys the brief reports. */
  count?: number;
  state?: string;
  policy?: string;
  category?: string;
}

export interface BriefLine {
  text: string;
  chipId: string;
}

export interface BriefSectionView {
  key: string;
  title: string;
  lines: BriefLine[];
}

export interface BriefView {
  sections: BriefSectionView[];
  entries: TraceEntry[];
}

export function traceAnchor(id: string): string {
  return `trace-${id}`;
}

const LEADING_ID = /^([A-Z]+\d+)\b[:.\s-]*/;

function uniqueId(wanted: string, taken: Set<string>): string {
  let id = wanted;
  let n = 2;
  while (taken.has(id)) id = `${wanted}-${n++}`;
  taken.add(id);
  return id;
}

function ruleEntry(decision: EscalationDecision, id: string): TraceEntry {
  return {
    id,
    kind: "rule",
    text: decision.reason,
    ruleId: decision.rule_id,
    reason: decision.reason,
    ...(decision.tier !== undefined ? { tier: decision.tier } : {}),
    ...(decision.due_by_hint !== undefined ? { due: decision.due_by_hint } : {}),
    source: decision.source,
    // Every escalation rule is pending clinical sign-off; the flag is absent only in fixture mode, where it still is.
    signoffPending: decision.needs_clinician_signoff ?? true,
    legalRead: decision.needs_legal_read ?? false,
  };
}

/** The ruleset named by the API's result section ("Ruleset: ..."), or an empty string. */
function rulesetOf(brief: CounsellorBrief): string {
  for (const line of brief.sections?.find((s) => s.key === "result")?.lines ?? []) {
    const match = /^Ruleset:\s*(.+)$/.exec(line);
    if (match?.[1] !== undefined) return match[1];
  }
  return "";
}

export function buildBriefView(brief: CounsellorBrief): BriefView {
  const taken = new Set<string>();
  const entries: TraceEntry[] = [];

  const engineId = uniqueId("R1", taken);
  entries.push({ id: engineId, kind: "engine", text: rulesetOf(brief), signoffPending: true, legalRead: false, category: brief.category });

  const ruleIds = new Map<string, string>();
  brief.escalations.forEach((decision, index) => {
    const id = uniqueId(`T${index + 1}`, taken);
    ruleIds.set(decision.rule_id, id);
    entries.push(ruleEntry(decision, id));
  });

  const lineEntries: TraceEntry[] = [];
  for (const raw of brief.trace) {
    const lead = LEADING_ID.exec(raw);
    const id = uniqueId(lead?.[1] ?? `L${lineEntries.length + 1}`, taken);
    const entry: TraceEntry = { id, kind: "line", text: lead ? raw.slice(lead[0].length) : raw, signoffPending: false, legalRead: false };
    lineEntries.push(entry);
    entries.push(entry);
  }

  const consentId = uniqueId("C1", taken);
  entries.push({
    id: consentId,
    kind: "consent",
    text: "",
    count: brief.consent_count ?? 0,
    ...(brief.emirate_policy !== undefined ? { policy: brief.emirate_policy } : {}),
    signoffPending: false,
    legalRead: false,
  });

  const pathwayId = uniqueId("W1", taken);
  entries.push({
    id: pathwayId,
    kind: "pathway",
    text: "",
    count: brief.referral_tasks.length,
    ...(brief.pathway_state !== undefined ? { state: brief.pathway_state } : {}),
    signoffPending: false,
    legalRead: false,
  });

  const chipFor = (sectionKey: string, line: string): string => {
    if (sectionKey === "why") {
      const lead = /^([A-Za-z0-9_.-]+):/.exec(line)?.[1];
      return (lead !== undefined ? ruleIds.get(lead) : undefined) ?? engineId;
    }
    if (sectionKey === "result") {
      if (/^(Ruleset|Category):/.test(line)) return engineId;
      const token = /^([A-Za-z0-9_.-]+)/.exec(line)?.[1];
      const hit = token === undefined ? undefined : lineEntries.find((e) => e.text.includes(token));
      return hit?.id ?? engineId;
    }
    if (sectionKey === "sharing") return consentId;
    if (sectionKey === "open") return pathwayId;
    return engineId;
  };

  const sections = (brief.sections ?? []).map((section) => ({
    key: section.key,
    title: section.title,
    lines: section.lines.map((text) => ({ text, chipId: chipFor(section.key, text) })),
  }));

  return { sections, entries };
}

export type WaitingUnit = "d" | "h" | "min";

/** Waiting time for the queue: whole days from 24 hours, whole hours from 60 minutes, else minutes. Never negative. */
export function waitingOf(raisedAt: string, nowMs: number): { n: number; unit: WaitingUnit } {
  const raised = Date.parse(raisedAt);
  const minutes = Number.isNaN(raised) ? 0 : Math.max(0, Math.floor((nowMs - raised) / 60_000));
  if (minutes >= 24 * 60) return { n: Math.floor(minutes / (24 * 60)), unit: "d" };
  if (minutes >= 60) return { n: Math.floor(minutes / 60), unit: "h" };
  return { n: minutes, unit: "min" };
}

/** Index of the next row for J (+1) and K (-1); the first press with no cursor lands on the first row. Clamped, no wrap. */
export function moveCursor(current: number, delta: 1 | -1, length: number): number {
  if (length === 0) return -1;
  if (current < 0) return 0;
  return Math.min(length - 1, Math.max(0, current + delta));
}

/** The pathway events a staff verb button may fire. Each is an existing event; the label comes from `staff.action.<event>`. */
export const STAFF_VERBS = ["counselling_booked", "counselling_completed"] as const;
export type StaffVerb = (typeof STAFF_VERBS)[number];

interface VerbSource {
  next_action: { event: string | null } | null;
  next_actions?: { event: string | null; roles: string[] }[] | undefined;
}

/**
 * Which verbs the pathway offers this role right now. Real backend: `next_actions` lists each allowed event with its
 * roles. Fixture mode: only the single main-path `next_action`, which is open to staff. A verb the pathway does not
 * offer is not shown (no hold or decline: no existing event fits a staff-side hold, and declining is the couple's).
 */
export function staffVerbs(pathway: VerbSource, role: string): StaffVerb[] {
  const offered =
    pathway.next_actions !== undefined
      ? pathway.next_actions.filter((a) => a.roles.includes(role)).map((a) => a.event)
      : [pathway.next_action?.event ?? null];
  return STAFF_VERBS.filter((verb) => offered.includes(verb));
}

/** The clock, kept out of components so a render stays free of direct impure calls. */
export const clockMs = (): number => Date.now();
