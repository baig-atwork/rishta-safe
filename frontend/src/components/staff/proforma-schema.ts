import type { FieldErrors, FieldValues, ResolverResult } from "react-hook-form";
import * as z from "zod/mini";
import type { ProformaField } from "@/lib/api/types";

/**
 * Schema-first proforma validation. The zod schema is built from the field list the API publishes
 * (`closureSchema().proforma_fields`), so a field added on the server appears here without a code change.
 *
 * Only the clinician fields are inputs. System fields are read-only and patient fields belong to the patient's own
 * session, so neither is validated or submitted. There is deliberately no marriage-decision field anywhere: the
 * schema can only contain what the server lists, and the server lists none.
 *
 * The schema carries no "required" flag (ProformaField has none), so structure is validated here (allowed choices,
 * length, a complete action row) and completeness is left to the server, whose 422 messages the form shows inline.
 */

/** Key under which a form-level message (not tied to one field) is reported to react-hook-form. */
export const FORM_ERROR_KEY = "_form";

/** closure.yaml `free_text_max_length`. */
export const PROFORMA_TEXT_MAX = 2000;

export interface ActionRow {
  uid: string;
  action: string;
  owner: string;
  due: string;
}

export interface ProformaMessages {
  maxLength: string;
  datetime: string;
  choice: string;
  actionRow: string;
  atLeastOne: string;
}

export type Answers = Record<string, string | string[]>;

export function isClinicianField(field: ProformaField): boolean {
  return field.filled_by === "clinician" && field.kind !== "system";
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isActionRow(value: unknown): value is ActionRow {
  if (typeof value !== "object" || value === null) return false;
  const rec = value as Record<string, unknown>;
  return typeof rec["uid"] === "string" && typeof rec["action"] === "string" && typeof rec["owner"] === "string" && typeof rec["due"] === "string";
}

export function toActionRows(value: unknown): ActionRow[] {
  return Array.isArray(value) ? value.filter(isActionRow) : [];
}

export function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function rowIsComplete(row: ActionRow): boolean {
  return row.action.trim() !== "" && row.owner.trim() !== "" && row.due !== "";
}

/** `<input type="datetime-local">` values look like 2026-11-20T14:30 (seconds optional). */
export function isValidLocalDateTime(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

export function defaultValues(fields: readonly ProformaField[]): FieldValues {
  const out: FieldValues = {};
  for (const field of fields) {
    if (!isClinicianField(field)) continue;
    out[field.id] = field.kind === "checklist" || field.kind === "action_list" ? [] : "";
  }
  return out;
}

function fieldSchema(field: ProformaField, messages: ProformaMessages): z.ZodMiniType {
  const ids = new Set(field.choices.map((choice) => choice.id));
  switch (field.kind) {
    case "text":
      return z.string().check(z.maxLength(PROFORMA_TEXT_MAX, { error: messages.maxLength }));
    case "datetime":
      return z.string().check(z.refine((value) => value === "" || isValidLocalDateTime(value), { error: messages.datetime }));
    case "yes_no":
      return z.string().check(z.refine((value) => value === "" || value === "yes" || value === "no", { error: messages.choice }));
    case "single_choice":
      return z.string().check(z.refine((value) => value === "" || ids.has(value), { error: messages.choice }));
    case "checklist":
      return z.array(z.string()).check(z.refine((values) => values.every((value) => ids.has(value)), { error: messages.choice }));
    case "action_list": {
      // When the server publishes the roles an owner may be, the owner must be one of them.
      const owners = new Set((field.owner_choices ?? []).map((choice) => choice.id));
      return z
        .array(z.object({ uid: z.string(), action: z.string(), owner: z.string(), due: z.string() }))
        .check(z.refine((rows) => rows.every((row) => rowIsComplete(row) && (owners.size === 0 || owners.has(row.owner))), { error: messages.actionRow }));
    }
    case "system":
      return z.unknown();
  }
}

/** True when at least one value is present, so an entirely empty form cannot be saved. */
export function hasAnyAnswer(fields: readonly ProformaField[], values: Record<string, unknown>): boolean {
  return fields.filter(isClinicianField).some((field) => {
    const value = values[field.id];
    if (typeof value === "string") return value.trim() !== "";
    return Array.isArray(value) && value.length > 0;
  });
}

export function buildProformaSchema(fields: readonly ProformaField[], messages: ProformaMessages) {
  const shape: Record<string, z.ZodMiniType> = {};
  for (const field of fields) {
    if (isClinicianField(field)) shape[field.id] = fieldSchema(field, messages);
  }
  return z.object(shape).check(z.refine((values) => hasAnyAnswer(fields, values), { error: messages.atLeastOne, path: [FORM_ERROR_KEY] }));
}

/** Runs the zod schema and reports each failing field (or `_form` for a form-level message) to react-hook-form. */
export function proformaResolver(schema: ReturnType<typeof buildProformaSchema>): (values: FieldValues) => ResolverResult<FieldValues> {
  return (values) => {
    const parsed = schema.safeParse(values);
    if (parsed.success) return { values, errors: {} };
    const errors: FieldErrors<FieldValues> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? FORM_ERROR_KEY);
      if (!(key in errors)) errors[key] = { type: "validate", message: issue.message };
    }
    return { values: {}, errors };
  };
}

/**
 * The submitted shape: answered clinician fields only, except that checklists and action lists are always sent as an
 * array (empty means "none ticked" / "no actions"), one JSON string per complete action row.
 */
export function buildAnswers(fields: readonly ProformaField[], values: Record<string, unknown>): Answers {
  const answers: Answers = {};
  for (const field of fields.filter(isClinicianField)) {
    const value = values[field.id];
    if (field.kind === "checklist") {
      answers[field.id] = isStringArray(value) ? value : [];
    } else if (field.kind === "action_list") {
      answers[field.id] = toActionRows(value)
        .filter(rowIsComplete)
        .map((row) => JSON.stringify({ action: row.action.trim(), owner: row.owner.trim(), due: row.due }));
    } else {
      const text = toText(value).trim();
      if (text !== "") answers[field.id] = text;
    }
  }
  return answers;
}

/** Maps an RFC 9457 error path such as `answers.plan` or `body.answers.plan[0]` to a proforma field id. */
export function fieldIdFromServerPath(path: string, fields: readonly ProformaField[]): string | null {
  const parts = path.split(/[.[\]]+/).filter((part) => part !== "");
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part !== undefined && fields.some((field) => field.id === part && isClinicianField(field))) return part;
  }
  return null;
}
