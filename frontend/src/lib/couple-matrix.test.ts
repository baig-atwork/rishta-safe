import { describe, expect, it } from "vitest";
import type { ConsentRecord } from "./api/types";
import { FIXED_COLUMNS, MATRIX_SCOPES, switchState } from "./couple-matrix";

const NOW = Date.parse("2026-11-20T10:00:00Z");
const record = (over: Partial<ConsentRecord>): ConsentRecord => ({
  consent_id: "c1",
  couple_id: "cpl-demo-02",
  subject_person_id: "prs-02a",
  recipient: "prs-02b",
  scope: "couple_result_only",
  purpose: "partner_disclosure",
  granted_at: "2026-11-20T01:58:38Z",
  expires_at: null,
  revoked_at: null,
  ...over,
});

describe("switchState (seeded case 2: Layla shares couple_result_only with Anwar)", () => {
  const seeded = [record({})];
  it("is on for the shared row and off for the other two", () => {
    expect(MATRIX_SCOPES.map((s) => switchState(seeded, "prs-02a", "prs-02b", s, NOW).on)).toEqual([true, false, false]);
  });
  it("ignores a revoked record", () => {
    expect(switchState([record({ revoked_at: "2026-11-20T02:00:00Z" })], "prs-02a", "prs-02b", "couple_result_only", NOW).on).toBe(false);
  });
  it("ignores an expired record and keeps one that expires later", () => {
    expect(switchState([record({ expires_at: "2026-11-20T09:00:00Z" })], "prs-02a", "prs-02b", "couple_result_only", NOW).on).toBe(false);
    expect(switchState([record({ expires_at: "2026-12-01T00:00:00Z" })], "prs-02a", "prs-02b", "couple_result_only", NOW).on).toBe(true);
  });
  it("ignores another person's record (the partner's own share to me is not my switch) and another recipient (the counsellor)", () => {
    expect(switchState([record({ subject_person_id: "prs-02b", recipient: "prs-02a" })], "prs-02a", "prs-02b", "couple_result_only", NOW).on).toBe(false);
    expect(switchState([record({ recipient: "counsellor" })], "prs-02a", "prs-02b", "couple_result_only", NOW).on).toBe(false);
  });
  it("returns every active record so Revoke can end them all", () => {
    const two = [record({ consent_id: "c1" }), record({ consent_id: "c2", purpose: "couple_counselling" })];
    expect(switchState(two, "prs-02a", "prs-02b", "couple_result_only", NOW).records.map((r) => r.consent_id)).toEqual(["c1", "c2"]);
  });
  it("no consents: every switch is off", () => {
    expect(MATRIX_SCOPES.every((s) => !switchState([], "prs-02a", "prs-02b", s, NOW).on)).toBe(true);
  });
});

describe("fixed columns", () => {
  it("are care, database, employer, insurer with glyph fills that do not rely on colour", () => {
    expect(FIXED_COLUMNS.map((c) => [c.key, c.fill, c.what])).toEqual([
      ["care", "solid", "care"],
      ["db", "hatch", "law"],
      ["employer", "open", "never"],
      ["insurer", "open", "never"],
    ]);
  });
});
