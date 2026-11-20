/**
 * The closure form's vocabulary and pure helpers. Deliberately free of zod: the teach-back quiz and the field
 * components only need these constants, and importing them through the schema module would ship the validation
 * library to a page that never validates anything.
 */
import type { ClosureSchema, PatientClosureInput, PatientItem } from "@/lib/api/types";

export const FREE_TEXT_MAX = 1000;
export const TRUE_FALSE_UNSURE = ["true", "false", "not_sure"] as const;
export const AGREE_1_5 = ["1", "2", "3", "4", "5"] as const;

/** Form state. `answers` is keyed by patient item id; radios start unset, so a required item is "not answered" until chosen. */
export interface ClosureFormValues {
  answers: Record<string, string>;
  /** "" means no answer, which is the default and a valid choice: the future-services question is optional. */
  service_interest: string;
  topics: string[];
}

export interface ClosureMessages {
  required: string;
  integerWhole: string;
  integerRange: string;
  tooLong: string;
  interestInvalid: string;
}

/**
 * The schema carries no "required" flag, so the rule is ours: every item must be answered except the free-text one,
 * which stays optional because nobody should have to write a paragraph to be heard.
 */
export function isRequired(item: PatientItem): boolean {
  return item.kind !== "free_text";
}

/** A "yes" answer to the future-services question (yes_now, yes_later) is what opens the topics. */
export function isYesOption(optionId: string): boolean {
  return optionId.startsWith("yes");
}

/** Starting values: text-like items begin as empty strings; radio items begin unset so nothing is pre-selected. */
export function defaultClosureValues(schema: ClosureSchema): ClosureFormValues {
  const answers: Record<string, string> = {};
  for (const item of schema.patient_items) {
    if (item.kind === "free_text" || item.kind === "integer_0_100") answers[item.id] = "";
  }
  return { answers, service_interest: "", topics: [] };
}

export function toPatientInput(values: ClosureFormValues, schema: ClosureSchema, personId: string): PatientClosureInput {
  const answers: Record<string, string> = {};
  for (const item of schema.patient_items) {
    const value = values.answers[item.id]?.trim();
    if (value) answers[item.id] = value;
  }
  const known = new Set(schema.service_interest.topics.map((topic) => topic.id));
  return {
    person_id: personId,
    answers,
    service_interest: values.service_interest,
    topics: isYesOption(values.service_interest) ? values.topics.filter((topic) => known.has(topic)) : [],
  };
}
