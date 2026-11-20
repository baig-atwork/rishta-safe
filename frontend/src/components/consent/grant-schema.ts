import * as z from "zod/mini";
import { CONSENT_PURPOSES, type ConsentGrantInput, type ConsentScope } from "@/lib/api/types";

export const CONSENT_SCOPES = ["couple_result_only", "gene_names_only", "full_variant_detail"] as const satisfies readonly ConsentScope[];
export { CONSENT_PURPOSES };

/** What the form collects. `recipient` is a partner's person id or a role name ("counsellor"); `purpose` is one of CONSENT_PURPOSES; `expiry` is "" or YYYY-MM-DD. */
export interface GrantValues {
  recipient: string;
  scope: ConsentScope;
  purpose: string;
  expiry: string;
}

/** Every message comes from next-intl, so the schema is built per render locale. */
export interface GrantMessages {
  recipientRequired: string;
  scopeRequired: string;
  purposeRequired: string;
  expiryPast: string;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** A chosen expiry date counts through the end of that day (UTC), matching how the date is sent. */
export function endOfDayIso(date: string): string {
  return `${date}T23:59:59.000Z`;
}

function isFutureDate(date: string): boolean {
  if (!DATE_ONLY.test(date)) return false;
  const end = Date.parse(endOfDayIso(date));
  return !Number.isNaN(end) && end > Date.now();
}

export function buildGrantSchema(recipients: readonly string[], messages: GrantMessages): z.ZodMiniType<GrantValues, GrantValues> {
  return z.object({
    recipient: z.string({ error: messages.recipientRequired }).check(z.refine((value) => recipients.includes(value), { error: messages.recipientRequired })),
    scope: z.enum(CONSENT_SCOPES, { error: messages.scopeRequired }),
    purpose: z.enum(CONSENT_PURPOSES, { error: messages.purposeRequired }),
    expiry: z.string().check(z.refine((value) => value === "" || isFutureDate(value), { error: messages.expiryPast })),
  });
}

export function toGrantInput(values: GrantValues, subjectPersonId: string): ConsentGrantInput {
  return {
    subject_person_id: subjectPersonId,
    recipient_role: values.recipient,
    scope: values.scope,
    purpose: values.purpose,
    expires_at: values.expiry ? endOfDayIso(values.expiry) : null,
  };
}
