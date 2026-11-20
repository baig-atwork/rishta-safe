import type { NextAction, NextActionOption, PathwayState, PathwayStateKey, PathwayStatus, PathwayView, ReferralTask, SlaStatus } from "../types";
import { parseReal } from "./errors";
import { communicateSchema, pathwaySchema, referralsSchema } from "./schemas";
import type { z } from "zod";

type RealPathway = z.output<typeof pathwaySchema>;
type RealStep = RealPathway["steps"][number];

/**
 * MAPPING TABLE: the backend's 12 pathway steps (data/pathway.yaml) onto the UI's 9 states (PathwayStateKey).
 * The UI has no "result explained" or "case closed" state, so:
 *   - result_communicated and the two counselling steps fold into the UI's "counselling" state;
 *   - case_closed has no UI state and is not shown (GAP: the end of the case is not a tracker row).
 * A step id the table does not know is ignored, so a new backend step cannot break the tracker.
 */
export const UI_STATE_GROUPS: readonly { key: PathwayStateKey; steps: readonly string[] }[] = [
  { key: "registration_consent", steps: ["registered"] },
  { key: "physician_consult", steps: ["consult_completed"] },
  { key: "sample_collection", steps: ["sample_collected"] },
  { key: "lab_processing", steps: ["lab_started"] },
  { key: "joint_report", steps: ["joint_report_ready"] },
  { key: "counselling", steps: ["result_communicated", "counselling_booked", "counselling_completed"] },
  { key: "declaration", steps: ["declaration_signed"] },
  { key: "certificate", steps: ["certificate_issued"] },
  { key: "judicial_handoff", steps: ["judicial_handoff_sent"] },
];

const FINISHED: ReadonlySet<RealStep["status"]> = new Set(["done", "not_applicable", "skipped"]);

/** Group status: blocked wins, then current; all finished is done; some finished is "current"; none is upcoming. */
function groupStatus(steps: readonly RealStep[]): PathwayStatus {
  if (steps.some((s) => s.status === "blocked")) return "blocked";
  if (steps.some((s) => s.status === "current")) return "current";
  if (steps.every((s) => FINISHED.has(s.status))) return "done";
  if (steps.some((s) => s.status === "done")) return "current";
  return "upcoming";
}

const SLA_RANK: Record<SlaStatus, number> = { not_applicable: 0, on_track: 1, at_risk: 2, breached: 3 };

function slaOf(step: RealStep): SlaStatus {
  if (step.timer === null) return "not_applicable";
  switch (step.timer.sla) {
    case "on_time":
      return "on_track";
    case "at_risk":
      return "at_risk";
    case "breached":
      return "breached";
  }
}

function latest(values: readonly (string | null)[]): string | null {
  let best: string | null = null;
  for (const value of values) {
    if (value !== null && (best === null || Date.parse(value) > Date.parse(best))) best = value;
  }
  return best;
}

function mapPathwayState(
  key: PathwayStateKey,
  group: readonly RealStep[],
  previousDoneAt: string | null,
  isFirstGroup: boolean,
): PathwayState {
  const status = groupStatus(group);
  const completedAt = status === "done" ? latest(group.map((s) => s.completed_at)) : null;
  // entered_at: when the previous real step finished (the moment this state became current). The first state has no
  // predecessor, so it uses its own completion time. A state not yet reached has no entry time.
  const enteredAt = status === "upcoming" ? null : isFirstGroup ? latest(group.map((s) => s.completed_at)) : previousDoneAt;

  const timed = group.filter((s) => s.timer !== null && s.timer.standard_hours !== null);
  const timer = timed[0]?.timer ?? null;
  const planning = group.find((s) => s.planning_minutes !== null)?.planning_minutes ?? null;
  const expected = timer?.standard_hours ?? (planning !== null ? planning / 60 : null);

  const sla = group.map(slaOf).reduce<SlaStatus>((worst, next) => (SLA_RANK[next] > SLA_RANK[worst] ? next : worst), "not_applicable");

  return {
    key,
    // GAP: server labels are English-only unless the request carries ?locale; null makes the UI use its own translated label.
    label: null,
    status,
    entered_at: enteredAt,
    completed_at: completedAt,
    expected_duration_hours: expected,
    sla_status: sla,
    simulated: group.some((s) => s.simulated),
  };
}

type Owner = NextAction["owner"];

/** Events that record something going the other way; they are demo options, never the headline step. */
export const BRANCH_EVENTS: ReadonlySet<string> = new Set([
  "partner_declined_to_share",
  "referral_rejected",
  "counselling_declined",
  "counselling_missed",
]);

/** Who does the step, by event: the backend's `roles` list names everyone allowed, not who normally acts. */
const OWNER_BY_EVENT: Readonly<Record<string, Owner>> = {
  consult_completed: "clinic",
  sample_collected: "clinic",
  lab_started: "lab",
  joint_report_ready: "lab",
  result_communicated: "clinic",
  counselling_booked: "counsellor",
  counselling_missed: "counsellor",
  counselling_completed: "counsellor",
  counselling_declined: "couple",
  referral_rejected: "counsellor",
  partner_declined_to_share: "couple",
  declaration_signed: "clinic",
  certificate_issued: "clinic",
  judicial_handoff_sent: "clinic",
  case_closed: "clinic",
  brief_generated: "counsellor",
  confirmatory_test_ordered: "clinic",
  confirmatory_test_resulted: "lab",
  specialist_referral_requested: "clinic",
  specialist_referral_completed: "clinic",
};

const OWNER_BY_ROLE: Readonly<Record<string, Owner>> = {
  couple_member: "couple",
  clinician: "clinic",
  counsellor: "counsellor",
  programme: "lab",
};

function ownerFor(event: string, roles: readonly string[]): Owner {
  const byEvent = OWNER_BY_EVENT[event];
  if (byEvent !== undefined) return byEvent;
  for (const role of roles) {
    const owner = OWNER_BY_ROLE[role];
    if (owner !== undefined) return owner;
  }
  return "clinic";
}

export function mapPathway(real: RealPathway): PathwayView {
  const byId = new Map(real.steps.map((step) => [step.id, step] as const));
  const states: PathwayState[] = [];
  UI_STATE_GROUPS.forEach((group, index) => {
    const steps = group.steps.map((id) => byId.get(id)).filter((s): s is RealStep => s !== undefined);
    if (steps.length === 0) return;
    const firstIndex = real.steps.findIndex((s) => s.id === steps[0]?.id);
    const before = real.steps.slice(0, Math.max(0, firstIndex)).filter((s) => s.status === "done");
    const previousDoneAt = latest(before.map((s) => s.completed_at));
    states.push(mapPathwayState(group.key, steps, previousDoneAt, index === 0));
  });

  const options: NextActionOption[] = real.next_actions.map((a) => ({
    key: a.event,
    label: a.label,
    event: a.event,
    owner: ownerFor(a.event, a.roles),
    roles: [...a.roles],
    branch: BRANCH_EVENTS.has(a.event),
  }));
  // The headline is the next MAIN-path step: the first allowed event that is not a branch (declined, missed, rejected).
  const main = options.find((o) => !o.branch);
  const nextAction: NextAction | null =
    main === undefined ? null : { key: main.key, label: main.label, event: main.event, owner: main.owner };

  return {
    couple_id: real.couple_id,
    states,
    next_action: nextAction,
    next_actions: options,
    // GAP: the real pathway carries no per-couple referral-target flag (the target is an aggregate KPI).
    referral_target_met: null,
  };
}

export function mapPathwayBody(body: unknown): PathwayView {
  return mapPathway(parseReal(pathwaySchema, body, "pathway"));
}

/** POST /result/communicate answers with `{category, escalations, pathway}`; the UI wants only the pathway. */
export function mapCommunicateBody(body: unknown): PathwayView {
  return mapPathway(parseReal(communicateSchema, body, "result/communicate").pathway);
}

/** UI destination text per task code (the real task has a code and an owner role, not a destination). */
const DESTINATION_BY_CODE = {
  counselling: "Genetic counselling service (simulated)",
  confirmatory_testing: "Confirmatory testing laboratory (simulated)",
  specialist_referral: "Clinical genetics service (simulated)",
} as const;

export function mapReferrals(body: unknown): ReferralTask[] {
  return parseReal(referralsSchema, body, "referrals").map((task) => ({
    task_id: task.id,
    destination: DESTINATION_BY_CODE[task.code],
    status: task.status,
    authored_on: task.authored_on,
    last_modified: task.last_modified,
    simulated: task.simulated,
  }));
}
