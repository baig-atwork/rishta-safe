import { describe, expect, it } from "vitest";
import type { NextActionOption, PathwayView } from "./api/types";
import { planNextActions } from "./next-actions";

const option = (event: string, roles: string[], branch = false): NextActionOption => ({
  key: event,
  label: event,
  event,
  owner: "clinic",
  roles,
  branch,
});

const view = (next_actions?: NextActionOption[]): PathwayView => ({
  couple_id: "c",
  states: [],
  next_action: null,
  referral_target_met: null,
  ...(next_actions ? { next_actions } : {}),
});

// The real order for a released shared result at the counselling step (backend demo, cpl-demo-02).
const real = [
  option("partner_declined_to_share", ["clinician", "couple_member"], true),
  option("declaration_signed", ["clinician"]),
  option("confirmatory_test_ordered", ["clinician", "counsellor"]),
];

describe("planNextActions", () => {
  it("never makes a branch event the headline for a couple member; says whose turn it is instead", () => {
    const plan = planNextActions(view(real), "couple_member");
    expect(plan.primary).toBeNull();
    expect(plan.waitingOn?.event).toBe("declaration_signed");
    expect(plan.branches.map((o) => o.event)).toEqual(["partner_declined_to_share"]);
  });

  it("gives a clinician the first main-path step they may record, with branches listed apart", () => {
    const plan = planNextActions(view(real), "clinician");
    expect(plan.primary?.event).toBe("declaration_signed");
    expect(plan.waitingOn).toBeNull();
    expect(plan.branches.map((o) => o.event)).toEqual(["partner_declined_to_share"]);
  });

  it("only offers actions whose roles include the signed-in role", () => {
    const plan = planNextActions(view(real), "counsellor");
    expect(plan.primary?.event).toBe("confirmatory_test_ordered");
    expect(plan.branches).toEqual([]);
  });

  it("has nothing to say when there are no actions", () => {
    expect(planNextActions(view([]), "couple_member")).toEqual({ primary: null, waitingOn: null, branches: [] });
  });

  it("falls back to the single fixture next action for any role", () => {
    const fixture: PathwayView = {
      ...view(),
      next_action: { key: "attend_counselling", label: null, event: "counselling_completed", owner: "counsellor" },
    };
    expect(planNextActions(fixture, "couple_member").primary?.event).toBe("counselling_completed");
  });
});
