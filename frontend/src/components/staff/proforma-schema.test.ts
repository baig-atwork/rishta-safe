import { describe, expect, it } from "vitest";
import type { ProformaField } from "@/lib/api/types";
import {
  buildAnswers,
  buildProformaSchema,
  defaultValues,
  fieldIdFromServerPath,
  hasAnyAnswer,
  isValidLocalDateTime,
  proformaResolver,
  type ActionRow,
} from "./proforma-schema";
import { sortEscalations } from "./queue";

const field = (overrides: Partial<ProformaField> & Pick<ProformaField, "id" | "kind">): ProformaField => ({
  number: 1,
  label: overrides.id,
  filled_by: "clinician",
  choices: [],
  hint: null,
  ...overrides,
});

const FIELDS: ProformaField[] = [
  field({ id: "sys", kind: "system", filled_by: "system" }),
  field({ id: "ticks", kind: "checklist", choices: [{ id: "a", text: "A" }, { id: "b", text: "B" }] }),
  field({ id: "choice", kind: "single_choice", choices: [{ id: "x", text: "X" }] }),
  field({ id: "yn", kind: "yes_no" }),
  field({ id: "note", kind: "text" }),
  field({ id: "when", kind: "datetime" }),
  field({ id: "plan", kind: "action_list" }),
  field({ id: "pat", kind: "single_choice", filled_by: "patient", choices: [{ id: "p", text: "P" }] }),
];

const MESSAGES = { maxLength: "max", datetime: "datetime", choice: "choice", actionRow: "row", atLeastOne: "one" };
const row = (patch: Partial<ActionRow> = {}): ActionRow => ({ uid: "r1", action: "recontact", owner: "counsellor", due: "2026-12-01", ...patch });

describe("proforma schema", () => {
  const schema = buildProformaSchema(FIELDS, MESSAGES);
  const empty = defaultValues(FIELDS);

  it("only creates inputs for clinician fields", () => {
    expect(Object.keys(empty).sort()).toEqual(["choice", "note", "plan", "ticks", "when", "yn"]);
  });

  it("rejects an entirely empty form with a form-level message", () => {
    const result = proformaResolver(schema)(empty);
    expect(result).toMatchObject({ errors: { _form: { message: "one" } } });
  });

  it("accepts one answer", () => {
    const result = proformaResolver(schema)({ ...empty, note: "hello" });
    expect(result.errors).toEqual({});
  });

  it("rejects values outside the published choices, a bad datetime and an incomplete row", () => {
    const result = proformaResolver(schema)(
      { ...empty, ticks: ["zzz"], choice: "nope", yn: "maybe", when: "yesterday", plan: [row({ owner: "" })] }
    );
    expect(result).toMatchObject({
      errors: {
        ticks: { message: "choice" },
        choice: { message: "choice" },
        yn: { message: "choice" },
        when: { message: "datetime" },
        plan: { message: "row" },
      },
    });
  });

  it("limits free text to the documented length", () => {
    const result = proformaResolver(schema)({ ...empty, note: "x".repeat(2001) });
    expect(result).toMatchObject({ errors: { note: { message: "max" } } });
  });
});

describe("answers", () => {
  it("includes only answered clinician fields and serialises action rows", () => {
    const answers = buildAnswers(FIELDS, {
      sys: "ignored",
      pat: "ignored",
      ticks: ["a"],
      choice: "",
      yn: "no",
      note: "  spaced  ",
      when: "2026-11-20T10:30",
      plan: [row(), row({ uid: "r2", action: "", owner: "", due: "" })],
    });
    expect(answers).toEqual({
      ticks: ["a"],
      yn: "no",
      note: "spaced",
      when: "2026-11-20T10:30",
      plan: [JSON.stringify({ action: "recontact", owner: "counsellor", due: "2026-12-01" })],
    });
  });

  it("sends checklists and action lists as arrays even when empty", () => {
    expect(buildAnswers(FIELDS, { ...defaultValues(FIELDS), note: "x" })).toEqual({ note: "x", ticks: [], plan: [] });
  });

  it("detects whether anything was answered", () => {
    expect(hasAnyAnswer(FIELDS, defaultValues(FIELDS))).toBe(false);
    expect(hasAnyAnswer(FIELDS, { ...defaultValues(FIELDS), ticks: ["a"] })).toBe(true);
  });
});

describe("helpers", () => {
  it.each([
    ["2026-11-20T10:30", true],
    ["2026-11-20T10:30:15", true],
    ["2026-11-20", false],
    ["2026-13-45T10:30", false],
    ["", false],
  ])("datetime %j is %s", (value, expected) => {
    expect(isValidLocalDateTime(value)).toBe(expected);
  });

  it("maps server paths to clinician field ids only", () => {
    expect(fieldIdFromServerPath("answers.note", FIELDS)).toBe("note");
    expect(fieldIdFromServerPath("body.answers.plan[0]", FIELDS)).toBe("plan");
    expect(fieldIdFromServerPath("answers.sys", FIELDS)).toBeNull();
    expect(fieldIdFromServerPath("answers.missing", FIELDS)).toBeNull();
  });
});

describe("sortEscalations", () => {
  const item = (couple_id: string, review_priority: "urgent" | "priority" | "routine", raised_at: string) => ({
    couple_id,
    couple_label: couple_id,
    review_priority,
    decisions: [],
    raised_at,
  });

  it("orders urgent, priority, routine, then oldest first, without mutating the input", () => {
    const input = [
      item("r-new", "routine", "2026-11-20T09:00:00Z"),
      item("p-1", "priority", "2026-11-20T08:00:00Z"),
      item("u-late", "urgent", "2026-11-20T07:00:00Z"),
      item("u-early", "urgent", "2026-11-19T07:00:00Z"),
      item("r-old", "routine", "2026-11-18T09:00:00Z"),
    ];
    const snapshot = input.map((entry) => entry.couple_id);
    expect(sortEscalations(input).map((entry) => entry.couple_id)).toEqual(["u-early", "u-late", "p-1", "r-old", "r-new"]);
    expect(input.map((entry) => entry.couple_id)).toEqual(snapshot);
  });
});
