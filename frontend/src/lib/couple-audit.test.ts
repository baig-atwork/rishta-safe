import { describe, expect, it } from "vitest";
import type { AuditEvent } from "@/lib/api/types";
import { AUDIT_EARLIER_ROWS, AUDIT_VISIBLE_ROWS, groupAuditRuns, windowAuditRuns } from "./couple-audit";

function ev(index: number, action: string, actor: AuditEvent["actor_role"] = "couple_member"): AuditEvent {
  return {
    index,
    event_id: `e-${index}`,
    at: "2026-11-01T09:00:00Z",
    actor_role: actor,
    actor_id: "a",
    action,
    couple_id: "c",
    detail: `d${index}`,
    prev_hash: "",
    hash: "h",
  };
}
const newestFirst = (list: AuditEvent[]) => [...list].sort((a, b) => b.index - a.index);

describe("groupAuditRuns", () => {
  it("merges consecutive events with the same action and actor", () => {
    const runs = groupAuditRuns(newestFirst([ev(0, "consent.granted"), ev(1, "token_issued"), ev(2, "token_issued"), ev(3, "token_issued"), ev(4, "result.viewed")]));
    expect(runs.map((r) => [r.newest.action, r.count])).toEqual([
      ["result.viewed", 1],
      ["token_issued", 3],
      ["consent.granted", 1],
    ]);
    expect(runs[1]?.newest.index).toBe(3);
    expect(runs[1]?.oldest.index).toBe(1);
  });

  it("does not merge across a different actor or when the same action comes back later", () => {
    const runs = groupAuditRuns(newestFirst([ev(0, "a"), ev(1, "a", "counsellor"), ev(2, "b"), ev(3, "a")]));
    expect(runs).toHaveLength(4);
  });

  it("keeps the first mismatch on its own row", () => {
    const runs = groupAuditRuns(newestFirst([ev(0, "t"), ev(1, "t"), ev(2, "t"), ev(3, "t")]), new Set([2]));
    expect(runs.map((r) => r.count)).toEqual([1, 1, 2]);
    expect(runs.some((r) => r.newest.index === 2 && r.count === 1)).toBe(true);
  });
});

describe("windowAuditRuns", () => {
  it("shows the newest 20 rows, caps the earlier list at 100 and counts the rest", () => {
    // 600 events that alternate, so no grouping helps: the worst case for page length.
    const events = newestFirst(Array.from({ length: 600 }, (_, i) => ev(i, i % 2 === 0 ? "consent.granted" : "result.viewed")));
    const window = windowAuditRuns(groupAuditRuns(events));
    expect(window.visible).toHaveLength(AUDIT_VISIBLE_ROWS);
    expect(window.earlier).toHaveLength(AUDIT_EARLIER_ROWS);
    expect(window.earlierEvents).toBe(580);
    expect(window.unlistedEvents).toBe(480);
    expect(window.visible[0]?.newest.index).toBe(599);
  });

  it("600 identical token events collapse to a single row and nothing is hidden", () => {
    const events = newestFirst(Array.from({ length: 600 }, (_, i) => ev(i, "token_issued")));
    const window = windowAuditRuns(groupAuditRuns(events));
    expect(window.visible).toHaveLength(1);
    expect(window.visible[0]?.count).toBe(600);
    expect(window.earlier).toHaveLength(0);
    expect(window.earlierEvents).toBe(0);
  });
});
