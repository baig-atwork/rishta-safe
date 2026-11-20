import * as z from "zod/mini";
import type { ClosureSchema, PatientItem } from "@/lib/api/types";
import { AGREE_1_5, FREE_TEXT_MAX, TRUE_FALSE_UNSURE, type ClosureFormValues, type ClosureMessages } from "./closure-items";

/**
 * zod/mini (functional API, tree-shakable) rather than classic zod: the form needs a handful of checks, not the whole
 * method surface, and the classic bundle costs about three times as much on the wire.
 */
function oneOf(values: readonly string[], message: string): z.ZodMiniType<string, string> {
  return z.string({ error: message }).check(z.refine((value) => values.includes(value), { error: message }));
}

function itemSchema(item: PatientItem, messages: ClosureMessages): z.ZodMiniType<string, string> {
  switch (item.kind) {
    case "free_text":
      return z.string().check(z.maxLength(FREE_TEXT_MAX, { error: messages.tooLong }));
    case "integer_0_100":
      return z
        .string({ error: messages.required })
        .check(
          z.trim(),
          z.minLength(1, { error: messages.required }),
          z.regex(/^\d+$/, { error: messages.integerWhole }),
          z.refine((value) => Number(value) >= 0 && Number(value) <= 100, { error: messages.integerRange }),
        );
    case "true_false_unsure":
      return oneOf(TRUE_FALSE_UNSURE, messages.required);
    case "single_choice":
      return oneOf(
        item.choices.map((choice) => choice.id),
        messages.required,
      );
    case "agree_1_5":
      return oneOf(AGREE_1_5, messages.required);
  }
}

/** Built from the schema the API returned, so a new item or kind needs no change here beyond its `case`. */
export function buildClosureSchema(schema: ClosureSchema, messages: ClosureMessages): z.ZodMiniType<ClosureFormValues, ClosureFormValues> {
  const shape: Record<string, z.ZodMiniType<string, string>> = {};
  for (const item of schema.patient_items) shape[item.id] = itemSchema(item, messages);
  return z.object({
    answers: z.object(shape),
    service_interest: oneOf(["", ...schema.service_interest.options.map((option) => option.id)], messages.interestInvalid),
    topics: z.array(z.string()),
  });
}
