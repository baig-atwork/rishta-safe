import { describe, expect, it } from "vitest";
import {
  EMPTY_VALUES,
  buildHaemSchemas,
  fieldFromServerPath,
  parseDecimal,
  snapshotOf,
  stepOfField,
  toCbcInput,
  toHplcInput,
} from "./schema";

describe("parseDecimal", () => {
  it.each([
    ["12", 12],
    ["11.5", 11.5],
    ["11,5", 11.5],
    [" .5 ", 0.5],
    ["٧٠٫٥", 70.5],
    ["۱۲", 12],
  ])("reads %s as %d", (text, expected) => {
    expect(parseDecimal(text)).toBe(expected);
  });

  it.each(["", "0", "0.0", "-3", "abc", "1e3", "1.2.3", "NaN", "Infinity"])("rejects %j", (text) => {
    expect(parseDecimal(text)).toBeNull();
  });
});

describe("schemas", () => {
  const messages = { positive: "positive", choose: "choose" };
  const { cbc, full } = buildHaemSchemas(messages);
  const valid = { ...EMPTY_VALUES, sex: "male", hb_g_dl: "14", mcv_fl: "88", mch_pg: "29" };

  it("accepts a CBC with only the required fields", () => {
    expect(cbc.safeParse(valid).success).toBe(true);
  });

  it("does not ask for the HPLC step when only the CBC is validated", () => {
    expect(cbc.safeParse({ ...valid, hba2_percent: "" }).success).toBe(true);
    expect(full.safeParse(valid).success).toBe(false);
  });

  it("requires HbA2 and HbF once the HPLC step is validated", () => {
    const result = full.safeParse(valid);
    const paths = result.success ? [] : result.error.issues.map((issue) => issue.path[0]);
    expect(paths.sort()).toEqual(["hba2_percent", "hbf_percent"]);
    expect(full.safeParse({ ...valid, hba2_percent: "2.5", hbf_percent: "0.5" }).success).toBe(true);
  });

  it("only accepts the listed choices for a closed question, and the empty answer", () => {
    expect(cbc.safeParse({ ...valid, pregnant: "unknown", transfused_last_4_months: "no", ferritin_status: "not_measured" }).success).toBe(true);
    expect(cbc.safeParse({ ...valid, pregnant: "maybe" }).success).toBe(false);
    expect(cbc.safeParse({ ...valid, age_years: "0" }).success).toBe(false);
    const hplc = { ...valid, hba2_percent: "2.5", hbf_percent: "0.5" };
    expect(full.safeParse({ ...hplc, hba2_is_total: "yes", single_hba_band_only: "no" }).success).toBe(true);
    expect(full.safeParse({ ...hplc, hba2_is_total: "unknown" }).success).toBe(false);
  });

  it("only rejects an optional field when it is filled with something that is not a positive number", () => {
    expect(cbc.safeParse({ ...valid, ferritin_ug_l: "" }).success).toBe(true);
    expect(cbc.safeParse({ ...valid, ferritin_ug_l: "0" }).success).toBe(false);
  });
});

describe("mapping to API inputs", () => {
  it("builds a CbcInput with null for omitted optionals", () => {
    expect(toCbcInput({ ...EMPTY_VALUES, sex: "female", hb_g_dl: "11,2", mcv_fl: "70", mch_pg: "22" })).toEqual({
      sex: "female",
      hb_g_dl: 11.2,
      mcv_fl: 70,
      mch_pg: 22,
      rbc_10e12_l: null,
      ferritin_ug_l: null,
    });
    expect(toCbcInput(EMPTY_VALUES)).toBeNull();
  });

  it("adds the aid's other answers only when answered, as booleans, tri-states and the lab's flag", () => {
    const base = { ...EMPTY_VALUES, sex: "male", hb_g_dl: "14", mcv_fl: "88", mch_pg: "29" };
    expect(toCbcInput({ ...base, age_years: "31", pregnant: "yes", transfused_last_4_months: "no", ferritin_status: "low" })).toMatchObject({
      age_years: 31,
      pregnant: true,
      transfused_last_4_months: false,
      ferritin_status: "low",
    });
    expect(toCbcInput({ ...base, pregnant: "unknown" })).toMatchObject({ pregnant: "unknown" });
    const bare = toCbcInput(base);
    for (const key of ["age_years", "pregnant", "transfused_last_4_months", "ferritin_status"]) expect(bare).not.toHaveProperty(key);
  });

  it("adds the HPLC attestations only when answered", () => {
    const base = { ...EMPTY_VALUES, hba2_percent: "2.5", hbf_percent: "0.5" };
    expect(toHplcInput({ ...base, hba2_is_total: "no", single_hba_band_only: "yes" })).toMatchObject({ hba2_is_total: false, single_hba_band_only: true });
    const bare = toHplcInput(base);
    expect(bare).not.toHaveProperty("hba2_is_total");
    expect(bare).not.toHaveProperty("single_hba_band_only");
  });

  it("builds an HplcInput and trims the variant name to null when blank", () => {
    expect(toHplcInput({ ...EMPTY_VALUES, hba2_percent: "5", hbf_percent: "1", variant_hb_name: "  " })).toEqual({
      hba2_percent: 5,
      hbf_percent: 1,
      variant_hb_percent: null,
      variant_hb_name: null,
    });
    expect(toHplcInput({ ...EMPTY_VALUES, hba2_percent: "5", hbf_percent: "1", variant_hb_percent: "40", variant_hb_name: " Hb X " })).toEqual({
      hba2_percent: 5,
      hbf_percent: 1,
      variant_hb_percent: 40,
      variant_hb_name: "Hb X",
    });
  });
});

describe("server error paths", () => {
  it.each([
    ["cbc.hb_g_dl", "hb_g_dl"],
    ["body.hplc.hbf_percent", "hbf_percent"],
    ["body.cbc[mcv_fl]", "mcv_fl"],
    ["hb_g_dl", "hb_g_dl"],
  ])("maps %s", (path, field) => {
    expect(fieldFromServerPath(path)).toBe(field);
  });

  it("returns null for a path that is not a form field", () => {
    expect(fieldFromServerPath("body.unknown")).toBeNull();
    expect(fieldFromServerPath("")).toBeNull();
  });

  it("knows which step a field belongs to", () => {
    expect(stepOfField("ferritin_ug_l")).toBe("cbc");
    expect(stepOfField("hba2_percent")).toBe("hplc");
  });
});

describe("snapshotOf", () => {
  it("ignores the HPLC fields for a CBC-only reading", () => {
    const a = snapshotOf({ ...EMPTY_VALUES, hb_g_dl: "14" }, "cbc");
    const b = snapshotOf({ ...EMPTY_VALUES, hb_g_dl: "14", hba2_percent: "5" }, "cbc");
    expect(a).toBe(b);
    expect(snapshotOf({ ...EMPTY_VALUES, hb_g_dl: "14" }, "both")).not.toBe(snapshotOf({ ...EMPTY_VALUES, hb_g_dl: "14", hba2_percent: "5" }, "both"));
  });
});
