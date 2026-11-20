import { z } from "zod";
import type { components } from "../schema";

/**
 * Runtime schemas for the REAL backend's responses (FastAPI, `components["schemas"]` in ../schema.d.ts).
 *
 * Each schema reads only the fields the adapter uses, so an unused backend field can change without breaking the
 * UI. Enums are typed against the generated types (`satisfies z.ZodType<...>`), so a value that is not in the
 * generated union fails to compile; a value the backend adds later fails at runtime as one AdapterError.
 * Nullable-or-absent fields are normalised to `null` here, so the mappers see one shape.
 */
type Real = components["schemas"];

const nullish = <T extends z.ZodType>(schema: T) => schema.nullish().transform((value) => value ?? null);

export const roleSchema = z.enum([
  "couple_member",
  "counsellor",
  "clinician",
  "programme",
  "judge",
  "external",
]) satisfies z.ZodType<Real["Role"]>;
export const localeSchema = z.enum(["en", "ar", "ur"]) satisfies z.ZodType<Real["Locale"]>;
export const emirateSchema = z.enum(["abu_dhabi", "dubai"]) satisfies z.ZodType<Real["Emirate"]>;
export const relationshipSchema = z.enum([
  "unrelated",
  "second_cousin",
  "first_cousin_once_removed",
  "first_cousin",
  "double_first_cousin",
  "other_close",
]) satisfies z.ZodType<Real["Relationship"]>;
export const resultCategorySchema = z.enum([
  "shared_result_found",
  "no_shared_change_found",
  "more_information_needed",
]) satisfies z.ZodType<Real["ResultCategory"]>;
export const reviewPrioritySchema = z.enum(["routine", "priority", "urgent"]) satisfies z.ZodType<Real["ReviewPriority"]>;
const sexSchema = z.enum(["female", "male"]) satisfies z.ZodType<Real["Sex"]>;
const languageStatusSchema = z.enum(["reviewed", "draft"]);
const inheritanceSchema = z.enum(["AR", "XL", "AD"]) satisfies z.ZodType<Real["Inheritance"]>;

// ---- demo ---------------------------------------------------------------------------------------------

export const personaSchema = z.object({
  id: z.string(),
  role: roleSchema,
  display_name: z.string(),
  description: z.string(),
  couple_id: nullish(z.string()),
  token: z.object({
    access_token: z.string(),
    principal: z.object({ subject_id: z.string() }),
  }),
});
export const personasSchema = z.array(personaSchema);

export const resetSchema = z.object({ status: z.string() });

// ---- cases, pathway, referrals --------------------------------------------------------------------------

export const memberSchema = z.object({
  person_id: z.string(),
  display_name: z.string(),
  sex: sexSchema,
  language: localeSchema.optional(),
});

export const coupleSchema = z.object({
  couple_id: z.string(),
  created_at: z.string(),
  members: z.array(memberSchema).length(2),
  relationship: relationshipSchema,
  emirate_policy: emirateSchema,
});

const stepStatusSchema = z.enum([
  "done",
  "current",
  "upcoming",
  "not_applicable",
  "skipped",
  "blocked",
]) satisfies z.ZodType<Real["StepStatus"]>;

export const pathwayStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: stepStatusSchema,
  completed_at: nullish(z.string()),
  simulated: z.boolean(),
  planning_minutes: nullish(z.number()),
  timer: nullish(
    z.object({
      standard_hours: nullish(z.number()),
      sla: z.enum(["on_time", "at_risk", "breached"]) satisfies z.ZodType<Real["SlaStatus"]>,
    }),
  ),
});

export const pathwayEventKindSchema = z.enum([
  "consult_completed",
  "sample_collected",
  "lab_started",
  "joint_report_ready",
  "result_communicated",
  "counselling_booked",
  "counselling_missed",
  "counselling_completed",
  "counselling_declined",
  "referral_rejected",
  "partner_declined_to_share",
  "declaration_signed",
  "certificate_issued",
  "judicial_handoff_sent",
  "case_closed",
  "brief_generated",
  "confirmatory_test_ordered",
  "confirmatory_test_resulted",
  "specialist_referral_requested",
  "specialist_referral_completed",
]) satisfies z.ZodType<Real["PathwayEventKind"]>;

export const pathwaySchema = z.object({
  couple_id: z.string(),
  state: z.string(),
  steps: z.array(pathwayStepSchema),
  next_actions: z.array(
    z.object({
      event: pathwayEventKindSchema,
      label: z.string(),
      roles: z.array(z.string()),
    }),
  ),
});

/** POST /v1/couples/{id}/result/communicate: the pathway after the result was communicated. */
export const communicateSchema = z.object({ pathway: pathwaySchema });

export const referralSchema = z.object({
  id: z.string(),
  code: z.enum(["counselling", "confirmatory_testing", "specialist_referral"]) satisfies z.ZodType<Real["TaskCode"]>,
  status: z.enum([
    "requested",
    "accepted",
    "in-progress",
    "on-hold",
    "completed",
    "rejected",
    "failed",
    "cancelled",
  ]) satisfies z.ZodType<Real["TaskStatus"]>,
  authored_on: z.string(),
  last_modified: z.string(),
  simulated: z.boolean(),
});
export const referralsSchema = z.array(referralSchema);

// ---- result, explainer ----------------------------------------------------------------------------------

export const findingSchema = z.object({
  gene: z.string(),
  condition_id: z.string(),
  zygosity: z.enum(["carrier", "affected", "vus", "not_detected"]) satisfies z.ZodType<Real["Zygosity"]>,
  inheritance: inheritanceSchema,
  classification: z.enum(["pathogenic", "likely_pathogenic", "vus"]),
  variant_label: nullish(z.string()),
});

export const sharedConditionSchema = z.object({
  condition_id: z.string(),
  gene: z.string(),
  inheritance: inheritanceSchema,
  basis: z.enum([
    "both_carriers",
    "affected_partner_and_carrier",
    "both_affected",
    "x_linked_carrier_female",
    "x_linked_affected_male",
  ]),
  outcomes: z.array(
    z.object({
      label: z.enum(["affected", "carrier", "neither"]),
      per_100: z.number(),
      applies_to: z.enum(["any_child", "son", "daughter"]),
    }),
  ),
});

export const detectionSchema = z.object({
  panel_id: z.string(),
  statement_key: z.string(),
  detection_rate_label: z.string(),
  assumed: z.boolean(),
  related_couple_caveat: z.boolean(),
});

const numberRefSchema = z.object({
  key: z.string(),
  value: z.union([z.number(), z.string()]),
  origin: z.enum(["engine", "template_constant"]),
});

const blockSchema = z.object({
  kind: z.enum(["heading", "paragraph", "list", "icon_array", "callout", "disclaimer"]),
  text: z.string().default(""),
  items: z.array(z.string()).default([]),
  icon_array: nullish(
    z.object({
      total: z.number(),
      affected: z.number(),
      carrier: z.number(),
      neither: z.number(),
      caption: z.string().default(""),
    }),
  ),
  tone: z.enum(["neutral", "info", "care"]).default("neutral"),
  numbers: z.array(numberRefSchema).default([]),
});

export const explainerDocSchema = z.object({
  locale: localeSchema,
  language_status: languageStatusSchema,
  blocks: z.array(blockSchema),
  glossary_keys: z.array(z.string()).default([]),
  numbers_used: z.array(numberRefSchema).default([]),
  template_ids: z.array(z.string()).default([]),
  check: nullish(
    z.object({
      ok: z.boolean(),
      numeric_fidelity: z.boolean(),
      polarity: z.boolean(),
      banned_words_absent: z.boolean(),
      messages: z.array(z.string()).default([]),
    }),
  ),
});

export const disclosureSchema = z.object({
  couple_id: z.string(),
  viewer_role: roleSchema,
  viewer_person_id: nullish(z.string()),
  policy: emirateSchema,
  category: nullish(resultCategorySchema),
  withheld_reason_key: nullish(z.string()),
  shared: z.array(sharedConditionSchema).default([]),
  own_findings: z.array(findingSchema).default([]),
  partner_finding_scope: z.enum(["none", "couple_result_only", "gene_names_only", "full_variant_detail"]),
  partner_findings: z.array(findingSchema).default([]),
  partner_gene_names: z.array(z.string()).default([]),
  detection: z.array(detectionSchema).default([]),
  relationship: relationshipSchema,
  review_priority: nullish(reviewPrioritySchema),
  staff_trace: z.array(z.string()).default([]),
  boundary_notice_key: z.string(),
  certificate_note_key: nullish(z.string()),
  ruleset_version: z.string(),
});

export const resultViewSchema = z.object({
  disclosed: disclosureSchema,
  document: explainerDocSchema,
});

export const glossarySchema = z.array(z.object({ key: z.string(), term: z.string(), definition: z.string() }));

// ---- consent, audit ------------------------------------------------------------------------------------

export const consentRecordSchema = z.object({
  basis: z.enum(["explicit_consent", "statutory_obligation"]) satisfies z.ZodType<Real["ConsentBasis"]>,
  consent_id: z.string(),
  couple_id: z.string(),
  subject_person_id: z.string(),
  recipient: z.string(),
  scope: nullish(z.enum(["couple_result_only", "gene_names_only", "full_variant_detail"]) satisfies z.ZodType<Real["ConsentScope"]>),
  purpose: z.string(),
  granted_at: z.string(),
  expires_at: nullish(z.string()),
  revoked_at: nullish(z.string()),
});
export const consentListSchema = z.object({ records: z.array(consentRecordSchema) });

export const auditEventSchema = z.object({
  index: z.number(),
  timestamp: z.string(),
  actor_role: z.string(),
  actor_id: z.string(),
  action: z.string(),
  couple_id: nullish(z.string()),
  outcome: z.enum(["allowed", "denied", "refused", "recorded"]) satisfies z.ZodType<Real["AuditEvent"]["outcome"]>,
  reason: z.string(),
  detail: z.array(z.tuple([z.string(), z.string()])).default([]),
  prev_hash: z.string(),
  hash: z.string(),
});
export const auditSchema = z.object({ events: z.array(auditEventSchema) });

export const auditVerificationSchema = z.object({
  ok: z.boolean(),
  scope: z.optional(z.enum(["chain", "own_couple"])),
  own_events: nullish(z.number()),
  length: nullish(z.number()),
  head_hash: nullish(z.string()),
  first_bad_index: nullish(z.number()),
  problem: nullish(z.string()),
});

// ---- escalation, brief ----------------------------------------------------------------------------------

export const escalationDecisionSchema = z.object({
  trigger_id: z.string(),
  tier: z.enum(["counsellor", "accredited_geneticist"]) satisfies z.ZodType<Real["EscalationTier"]>,
  reason_keys: z.array(z.string()),
  due_by_hint: z.enum(["immediate", "same_session", "fast_track", "routine"]) satisfies z.ZodType<Real["DueBy"]>,
  source: z.string(),
  needs_clinician_signoff: z.optional(z.boolean()),
  needs_legal_read: z.optional(z.boolean()),
});

export const escalationQueueSchema = z.object({
  records: z.array(
    z.object({
      couple_id: z.string(),
      created_at: z.string(),
      decisions: z.array(escalationDecisionSchema),
    }),
  ),
});

export const briefSchema = z.object({
  couple_id: z.string(),
  category: nullish(resultCategorySchema),
  review_priority: nullish(reviewPrioritySchema),
  relationship: relationshipSchema,
  shared: z.array(sharedConditionSchema),
  detection: z.array(detectionSchema),
  trace: z.array(z.string()),
  escalations: z.array(escalationDecisionSchema),
  members: z
    .array(
      z.object({
        display_name: z.string(),
        sex: z.string(),
        age: nullish(z.number()),
        language: z.string(),
        family_history: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  emirate_policy: z.optional(z.string()),
  pathway_state: z.optional(z.string()),
  sections: z.array(z.object({ key: z.string(), title: z.string(), lines: z.array(z.string()) })).default([]),
  consents: z.array(z.unknown()).default([]),
  closure_records: z.array(z.unknown()).default([]),
});

// ---- haematology aid ------------------------------------------------------------------------------------

export const haemLabelSchema = z.enum([
  "indices_reduced",
  "indices_not_flagged",
  "cbc_incomplete",
  "pattern_suggests_beta_thal_trait",
  "pattern_suggests_alpha_thal_trait",
  "pattern_suggests_hb_variant_trait",
  "pattern_suggests_iron_deficiency_first",
  "pattern_suggests_possible_compound_or_affected",
  "pattern_unclear_refer_for_molecular",
  "no_pattern_flagged_on_this_work_up",
  "work_up_incomplete",
]) satisfies z.ZodType<Real["HaemInterpretation"]["label"]>;

export const haemInterpretationSchema = z.object({
  label: haemLabelSchema,
  label_description: z.string(),
  stage: z.enum(["cbc_only", "cbc_plus_hplc"]),
  trace: z.array(
    z.object({
      rule_id: z.string(),
      kind: z.enum(["terminal", "annotate"]),
      outcome: z.string(),
      source_id: z.string(),
      locator: z.string(),
    }),
  ),
  flags: z.array(z.string()),
  mandatory_statements: z.array(z.string()).default([]),
  sources_disagree: z.array(z.string()).default([]),
  sources: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      year: z.string().default(""),
      url: nullish(z.string()),
      tier: z.string().default(""),
    }),
  ),
  not_a_diagnosis: z.string(),
  population_caveat: z.string(),
  ruleset_version: z.string(),
});

// ---- closure and teach-back -------------------------------------------------------------------------------

export const closureSchemaSchema = z.object({
  language_status: languageStatusSchema,
  clinician_fields: z.array(
    z.object({
      no: z.number(),
      id: z.string(),
      label: z.string(),
      help: z.string(),
      filled_by: z.string(),
    }),
  ),
  information_ticks: z.record(z.string(), z.string()),
  patient_items: z.array(
    z.object({
      id: z.string(),
      no: z.number(),
      format: z.string(),
      prompt: z.string(),
      options: z.record(z.string(), z.string()).default({}),
    }),
  ),
  service_interest_prompt: z.string(),
  service_interest_consent_text: z.string(),
  service_interest_values: z.record(z.string(), z.string()),
  service_interest_topics: z.record(z.string(), z.string()),
});

export const closureRecordSchema = z.object({
  record_id: z.string(),
  couple_id: z.string(),
  kind: z.enum(["patient", "clinician"]),
  submitted_at: z.string(),
});

export const teachbackQuizSchema = z.object({
  couple_id: z.string(),
  locale: localeSchema,
  language_status: languageStatusSchema,
  items: z.array(
    z.object({
      id: z.string(),
      prompt: z.string(),
      options: z.array(z.object({ id: z.string(), label: z.string() })),
    }),
  ),
});

export const teachbackResultSchema = z.object({
  couple_id: z.string(),
  correct_count: z.number(),
  item_count: z.number(),
  items: z.array(z.object({ item_id: z.string(), correct: z.boolean(), explanation: z.string() })),
});

// ---- programme, evaluation ------------------------------------------------------------------------------

const durationSchema = z.object({
  n: z.number(),
  median_hours: nullish(z.number()),
  p90_hours: nullish(z.number()),
});

export const kpisSchema = z.object({
  n_cases: z.number(),
  n_closed: z.number(),
  n_flagged: z.number(),
  time_to_result: durationSchema,
  time_to_referral: durationSchema,
  counselling_booked: z.number(),
  counselling_completed: z.number(),
  counselling_declined: z.number(),
  counselling_uptake_booked_share: nullish(z.number()),
  counselling_uptake_completed_share: nullish(z.number()),
  share_referred: nullish(z.number()),
  referral_target_share: z.number(),
  meets_referral_target: nullish(z.boolean()),
  share_referred_within_standard: nullish(z.number()),
  referral_standard_days: z.number(),
  referral_standard_is_illustrative: z.boolean(),
  open_tasks: z.number(),
  stale_tasks: z.number(),
  basis: z.string(),
});

export const scoreboardSchema = z.object({
  generated_at: z.string(),
  code_version: z.string().default(""),
  data_label: z.string(),
  caveats: z.array(z.string()).default([]),
  metrics: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.enum(["measured", "protocol_only", "not_run"]) satisfies z.ZodType<Real["Metric"]["status"]>,
      value: z.string(),
      n: nullish(z.number()),
      method: z.string(),
      does_not_show: z.string(),
    }),
  ),
});
