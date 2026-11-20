import { describe, expect, it } from "vitest";
import { buildBenchRows, flagshipCaseId, isSafeCoupleId, staffLenses, toBenchPersona, type BenchPersona, type DemoCase } from "./public-bench";

const persona = (id: string, role: BenchPersona["role"], coupleId: string | null = null): BenchPersona => ({ id, display_name: `${id} (synthetic)`, role, couple_id: coupleId });

const PERSONAS: BenchPersona[] = [
  persona("clinician", "clinician"),
  persona("counsellor", "counsellor"),
  persona("programme", "programme"),
  persona("judge", "judge"),
  persona("cpl-demo-02-a", "couple_member", "cpl-demo-02"),
  persona("cpl-demo-02-b", "couple_member", "cpl-demo-02"),
  persona("cpl-demo-08-a", "couple_member", "cpl-demo-08"),
];

const caseOf = (n: number, partners: string[], summary = `Case ${n} summary`): DemoCase => ({
  couple_id: `cpl-demo-${String(n).padStart(2, "0")}`,
  n,
  title: `Case ${n} title`,
  summary,
  relationship: "first_cousin",
  emirate_policy: "abu_dhabi",
  pathway_target: "counselling_done",
  partner_persona_ids: partners,
});

describe("buildBenchRows", () => {
  const rows = buildBenchRows([caseOf(8, ["cpl-demo-08-a", "cpl-demo-08-b"]), caseOf(2, ["cpl-demo-02-a", "cpl-demo-02-b"])], PERSONAS);

  it("keeps the API's text and orders the rows by case number", () => {
    expect(rows.map((r) => r.n)).toEqual([2, 8]);
    expect(rows[0]).toMatchObject({ coupleId: "cpl-demo-02", title: "Case 2 title", summary: "Case 2 summary", policy: "abu_dhabi", relationship: "first_cousin" });
  });

  it("crosses each case with its two partners and the staff lenses, and never makes the programme a persona", () => {
    expect(rows[0]?.partners.map((p) => p?.id)).toEqual(["cpl-demo-02-a", "cpl-demo-02-b"]);
    expect(rows[0]?.counsellor?.id).toBe("counsellor");
    expect(rows[0]?.clinician?.id).toBe("clinician");
    expect(rows.every((r) => r.programmeCell === "aggregate_only")).toBe(true);
  });

  it("marks the flagship case as the place to start, and no other", () => {
    const shared = buildBenchRows([caseOf(1, ["x", "y"], "No shared change found."), caseOf(2, ["cpl-demo-02-a", "cpl-demo-02-b"], "A shared result on one condition: counselling is booked."), caseOf(3, ["x", "y"], "A shared result again.")], PERSONAS);
    expect(shared.map((r) => r.startHere)).toEqual([false, true, false]);
    expect(rows.filter((r) => r.startHere)).toHaveLength(1);
  });

  it("picks the flagship from the API's own text, falling back to case 2 and then to the first case", () => {
    expect(flagshipCaseId([caseOf(1, [], "x"), caseOf(4, [], "A shared result on one condition")])).toBe("cpl-demo-04");
    expect(flagshipCaseId([caseOf(3, [], "x"), caseOf(2, [], "y")])).toBe("cpl-demo-02");
    expect(flagshipCaseId([caseOf(5, [], "x"), caseOf(7, [], "y")])).toBe("cpl-demo-05");
    expect(flagshipCaseId([])).toBeNull();
  });

  it("leaves a null cell (lens unavailable) for a partner whose persona is missing, instead of inventing one", () => {
    expect(rows[1]?.partners.map((p) => p?.id ?? null)).toEqual(["cpl-demo-08-a", null]);
  });

  it("returns no rows and no staff cells without data", () => {
    expect(buildBenchRows([], PERSONAS)).toEqual([]);
    const bare = buildBenchRows([caseOf(1, ["x", "y"])], []);
    expect(bare[0]).toMatchObject({ partners: [null, null], counsellor: null, clinician: null });
  });
});

describe("staffLenses and tokens", () => {
  it("lists the four lenses that are not tied to a case, one persona per role", () => {
    expect(staffLenses(PERSONAS).map((l) => l.role)).toEqual(["programme", "judge", "clinician", "counsellor"]);
    expect(staffLenses([persona("judge", "judge")]).map((l) => l.role)).toEqual(["judge"]);
  });

  it("drops the demo token when a persona is turned into a bench persona", () => {
    const full = { id: "judge", display_name: "J", role: "judge" as const, couple_id: null, token: "secret", person_id: null, description: "", simulated: true };
    const safe = toBenchPersona(full);
    expect(JSON.stringify(safe)).not.toContain("secret");
    expect(Object.keys(safe).sort()).toEqual(["couple_id", "display_name", "id", "role"]);
  });

  it("accepts only plain couple ids as a landing target", () => {
    expect(isSafeCoupleId("cpl-demo-02")).toBe(true);
    expect(isSafeCoupleId("../../admin")).toBe(false);
    expect(isSafeCoupleId("a b")).toBe(false);
    expect(isSafeCoupleId("")).toBe(false);
  });
});
