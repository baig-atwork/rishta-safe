import type { Role } from "@/lib/api/types";

/** One entry of GET /v1/demo/cases (the backend's ScenarioOut). */
export interface DemoCase {
  couple_id: string;
  n: number;
  title: string;
  summary: string;
  relationship: string;
  emirate_policy: string;
  pathway_target: string;
  partner_persona_ids: string[];
  synthetic?: boolean;
}

/** A persona as the bench sees it. It never carries the demo token, so it is safe to render anywhere. */
export interface BenchPersona {
  id: string;
  display_name: string;
  role: Role;
  couple_id: string | null;
}

export type StaffRole = "counsellor" | "clinician" | "programme" | "judge";

export interface BenchRow {
  n: number;
  coupleId: string;
  title: string;
  summary: string;
  /** Raw ids, shown in mono: `abu_dhabi`, `first_cousin`. */
  policy: string;
  relationship: string;
  /** Partner 1 and 2, in the order the case lists them. `null` where the persona is missing (lens unavailable). */
  partners: [BenchPersona | null, BenchPersona | null];
  counsellor: BenchPersona | null;
  clinician: BenchPersona | null;
  /** The programme lens never opens a case: the cell is open and says "Aggregate only". */
  programmeCell: "aggregate_only";
  startHere: boolean;
}

/**
 * The flagship case, read from the cases the API returned (no id is hard-coded): the lowest-numbered case whose summary
 * describes a shared result, else case 2, else the first case. It is the one a visitor should open first.
 */
export function flagshipCaseId(cases: readonly DemoCase[]): string | null {
  const sorted = [...cases].sort((a, b) => a.n - b.n);
  const found = sorted.find((c) => /\bshared result\b/i.test(c.summary)) ?? sorted.find((c) => c.n === 2) ?? sorted[0];
  return found?.couple_id ?? null;
}

export function toBenchPersona(p: { id: string; display_name: string; role: Role; couple_id: string | null }): BenchPersona {
  return { id: p.id, display_name: p.display_name, role: p.role, couple_id: p.couple_id };
}

function firstOfRole(personas: readonly BenchPersona[], role: Role): BenchPersona | null {
  return personas.find((p) => p.role === role) ?? null;
}

/**
 * Crosses the cases with the lenses. Partner cells come from each case's `partner_persona_ids`; the counsellor and
 * clinician cells use the one staff persona of that role (they see every case); the programme column is never a persona.
 * Nothing about a case is hard-coded: the order and the text are the API's.
 */
export function buildBenchRows(cases: readonly DemoCase[], personas: readonly BenchPersona[]): BenchRow[] {
  const byId = new Map(personas.map((p) => [p.id, p] as const));
  const counsellor = firstOfRole(personas, "counsellor");
  const clinician = firstOfRole(personas, "clinician");
  const flagship = flagshipCaseId(cases);
  return [...cases]
    .sort((a, b) => a.n - b.n)
    .map((c) => ({
      n: c.n,
      coupleId: c.couple_id,
      title: c.title,
      summary: c.summary,
      policy: c.emirate_policy,
      relationship: c.relationship,
      partners: [byId.get(c.partner_persona_ids[0] ?? "") ?? null, byId.get(c.partner_persona_ids[1] ?? "") ?? null],
      counsellor,
      clinician,
      programmeCell: "aggregate_only" as const,
      startHere: c.couple_id === flagship,
    }));
}

/** The lenses that look across the whole programme, one persona per role. */
export function staffLenses(personas: readonly BenchPersona[]): { role: StaffRole; persona: BenchPersona }[] {
  const out: { role: StaffRole; persona: BenchPersona }[] = [];
  for (const role of ["programme", "judge", "clinician", "counsellor"] as const) {
    const persona = firstOfRole(personas, role);
    if (persona) out.push({ role, persona });
  }
  return out;
}

/** Where a case-specific lens cell lands. Only these shapes are accepted by the server action. */
export type LensTarget =
  | { kind: "home" }
  | { kind: "result_now" }
  | { kind: "staff_case"; coupleId: string }
  | { kind: "clinician_case"; coupleId: string };

const COUPLE_ID = /^[A-Za-z0-9_-]{1,40}$/;

export function isSafeCoupleId(value: string): boolean {
  return COUPLE_ID.test(value);
}
