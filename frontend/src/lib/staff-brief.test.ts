import { describe, expect, it } from "vitest";
import type { CounsellorBrief } from "@/lib/api/types";
import { buildBriefView, moveCursor, staffVerbs, traceAnchor, waitingOf } from "./staff-brief";

function brief(overrides: Partial<CounsellorBrief> = {}): CounsellorBrief {
  return {
    couple_id: "cpl-demo-09",
    generated_at: "2026-11-20T10:00:00Z",
    review_priority: "urgent",
    category: "shared_result_found",
    relationship: "first_cousin_once_removed",
    shared: [],
    detection: [],
    trace: ["E10 beta_thalassaemia: partner 1 carrier, partner 2 carrier", "P1 review priority: urgent"],
    escalations: [
      { rule_id: "shared_result", priority: "priority", reason: "shared result", source: "R03 2.7", tier: "accredited_geneticist", due_by_hint: "fast_track", needs_clinician_signoff: true, needs_legal_read: false },
      { rule_id: "legal_rule", priority: "routine", reason: "needs a read", source: "Dossier", needs_clinician_signoff: true, needs_legal_read: true },
    ],
    referral_tasks: [],
    grounded_in: [],
    emirate_policy: "abu_dhabi",
    pathway_state: "counselling_pending",
    consent_count: 0,
    sections: [
      { key: "result", title: "Result on file", lines: ["Category: shared_result_found", "Ruleset: rishta-safe-couple-1.0", "beta_thalassaemia (HBB, AR): 25 of 100 affected"] },
      { key: "why", title: "Why", lines: ["shared_result: tier accredited_geneticist", "legal_rule: tier counsellor", "unknown_rule: tier counsellor"] },
      { key: "sharing", title: "Sharing", lines: ["No sharing consent recorded."] },
      { key: "open", title: "Open", lines: ["Next: Book counselling"] },
    ],
    ...overrides,
  };
}

describe("buildBriefView", () => {
  const view = buildBriefView(brief());
  const ids = view.entries.map((e) => e.id);

  it("gives every entry a unique id and every brief line a chip that resolves to an entry", () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const section of view.sections) {
      for (const line of section.lines) expect(ids, `${section.key}: ${line.text}`).toContain(line.chipId);
    }
  });

  it("links a why line to its escalation rule by the leading rule id", () => {
    const why = view.sections.find((s) => s.key === "why");
    const rule1 = view.entries.find((e) => e.ruleId === "shared_result");
    const rule2 = view.entries.find((e) => e.ruleId === "legal_rule");
    expect(why?.lines.map((l) => l.chipId)).toEqual([rule1?.id, rule2?.id, "R1"]);
  });

  it("links the result lines to the engine and to the trace line that names the condition", () => {
    const result = view.sections.find((s) => s.key === "result");
    expect(result?.lines.map((l) => l.chipId)).toEqual(["R1", "R1", "E10"]);
  });

  it("keeps the API's own ids for trace lines and strips them from the text", () => {
    const line = view.entries.find((e) => e.id === "E10");
    expect(line?.kind).toBe("line");
    expect(line?.text).toBe("beta_thalassaemia: partner 1 carrier, partner 2 carrier");
  });

  it("carries source, tier, due and both review stamps from the API data", () => {
    const rule1 = view.entries.find((e) => e.ruleId === "shared_result");
    expect(rule1).toMatchObject({ source: "R03 2.7", tier: "accredited_geneticist", due: "fast_track", signoffPending: true, legalRead: false });
    expect(view.entries.find((e) => e.ruleId === "legal_rule")).toMatchObject({ signoffPending: true, legalRead: true });
  });

  it("links sharing to the consent entry and open items to the pathway entry", () => {
    expect(view.sections.find((s) => s.key === "sharing")?.lines[0]?.chipId).toBe("C1");
    expect(view.sections.find((s) => s.key === "open")?.lines[0]?.chipId).toBe("W1");
    expect(view.entries.find((e) => e.id === "C1")).toMatchObject({ kind: "consent", count: 0, policy: "abu_dhabi" });
    expect(view.entries.find((e) => e.id === "W1")).toMatchObject({ kind: "pathway", state: "counselling_pending" });
  });

  it("reads the ruleset for the engine entry from the result section", () => {
    expect(view.entries[0]).toMatchObject({ id: "R1", kind: "engine", text: "rishta-safe-couple-1.0", category: "shared_result_found" });
  });

  it("de-duplicates ids that collide and tolerates a brief with no sections", () => {
    const withoutSections: Partial<CounsellorBrief> = brief();
    delete withoutSections.sections;
    const clash = buildBriefView({ ...(withoutSections as CounsellorBrief), trace: ["T1 a line that clashes with the first rule id"] });
    const all = clash.entries.map((e) => e.id);
    expect(new Set(all).size).toBe(all.length);
    expect(clash.sections).toEqual([]);
  });

  it("builds an anchor id from the chip id", () => {
    expect(traceAnchor("E10")).toBe("trace-E10");
  });
});

describe("waitingOf", () => {
  const now = Date.parse("2026-11-20T12:00:00Z");
  it("uses days from 24 hours, hours from 60 minutes and minutes below", () => {
    expect(waitingOf("2026-11-14T12:00:00Z", now)).toEqual({ n: 6, unit: "d" });
    expect(waitingOf("2026-11-19T12:00:00Z", now)).toEqual({ n: 1, unit: "d" });
    expect(waitingOf("2026-11-20T07:00:00Z", now)).toEqual({ n: 5, unit: "h" });
    expect(waitingOf("2026-11-20T11:30:00Z", now)).toEqual({ n: 30, unit: "min" });
  });
  it("is never negative and tolerates a bad date", () => {
    expect(waitingOf("2026-12-01T00:00:00Z", now)).toEqual({ n: 0, unit: "min" });
    expect(waitingOf("not a date", now)).toEqual({ n: 0, unit: "min" });
  });
});

describe("moveCursor", () => {
  it("lands on the first row on the first press, then moves and clamps without wrapping", () => {
    expect(moveCursor(-1, 1, 3)).toBe(0);
    expect(moveCursor(-1, -1, 3)).toBe(0);
    expect(moveCursor(0, 1, 3)).toBe(1);
    expect(moveCursor(2, 1, 3)).toBe(2);
    expect(moveCursor(0, -1, 3)).toBe(0);
    expect(moveCursor(1, -1, 3)).toBe(0);
  });
  it("returns -1 for an empty queue", () => {
    expect(moveCursor(-1, 1, 0)).toBe(-1);
  });
});

describe("staffVerbs", () => {
  it("offers only the verbs the pathway lists for this role (real backend)", () => {
    const pathway = {
      next_action: { event: "counselling_booked" },
      next_actions: [
        { event: "counselling_booked", roles: ["clinician", "counsellor", "couple_member"] },
        { event: "counselling_declined", roles: ["couple_member"] },
        { event: "counselling_completed", roles: ["programme"] },
        { event: "brief_generated", roles: ["counsellor"] },
      ],
    };
    expect(staffVerbs(pathway, "counsellor")).toEqual(["counselling_booked"]);
    expect(staffVerbs(pathway, "programme")).toEqual(["counselling_completed"]);
  });
  it("falls back to the main-path next action in fixture mode and offers nothing for other steps", () => {
    expect(staffVerbs({ next_action: { event: "counselling_completed" } }, "counsellor")).toEqual(["counselling_completed"]);
    expect(staffVerbs({ next_action: { event: "certificate_issued" } }, "counsellor")).toEqual([]);
    expect(staffVerbs({ next_action: null }, "counsellor")).toEqual([]);
  });
});
