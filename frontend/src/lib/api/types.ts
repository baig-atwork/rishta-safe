/**
 * Domain types the frontend consumes. Shapes that exist in backend/src/bayan/core/contracts.py and types.py
 * are mirrored exactly. Shapes marked ASSUMED are not yet published by the owning lane (journey, governance,
 * explain, composition); phase 2 replaces them with the generated OpenAPI types (`pnpm gen:api`).
 */

export type Locale = "en" | "ar" | "ur";
export type Emirate = "abu_dhabi" | "dubai";
export type Role = "couple_member" | "counsellor" | "clinician" | "programme" | "judge" | "external";
export type Relationship =
  | "unrelated"
  | "second_cousin"
  | "first_cousin_once_removed"
  | "first_cousin"
  | "double_first_cousin"
  | "other_close";

// ---- core/contracts.py (exact) -------------------------------------------------------------------

export type ResultCategory = "shared_result_found" | "no_shared_change_found" | "more_information_needed";
export const RESULT_CATEGORIES: readonly ResultCategory[] = [
  "shared_result_found",
  "no_shared_change_found",
  "more_information_needed",
];
export type ReviewPriority = "routine" | "priority" | "urgent";
export type Inheritance = "AR" | "XL" | "AD";
export type Zygosity = "carrier" | "affected" | "vus" | "not_detected";

export interface Finding {
  gene: string;
  condition_id: string;
  zygosity: Zygosity;
  inheritance: Inheritance;
  classification: "pathogenic" | "likely_pathogenic" | "vus";
  variant_label: string | null;
}

export interface OutcomeLine {
  label: "affected" | "carrier" | "neither";
  per_100: number;
  applies_to: "any_child" | "son" | "daughter";
}

export interface SharedCondition {
  condition_id: string;
  gene: string;
  inheritance: Inheritance;
  basis:
    | "both_carriers"
    | "affected_partner_and_carrier"
    | "both_affected"
    | "x_linked_carrier_female"
    | "x_linked_affected_male";
  outcomes: OutcomeLine[];
}

export interface DetectionStatement {
  panel_id: string;
  statement_key: string;
  detection_rate_label: string;
  assumed: boolean;
  related_couple_caveat: boolean;
}

export type HaemLabel =
  | "indices_reduced"
  | "indices_not_flagged"
  | "cbc_incomplete"
  | "pattern_suggests_beta_thal_trait"
  | "pattern_suggests_alpha_thal_trait"
  | "pattern_suggests_hb_variant_trait"
  | "pattern_suggests_iron_deficiency_first"
  | "pattern_suggests_possible_compound_or_affected"
  | "pattern_unclear_refer_for_molecular"
  | "no_pattern_flagged_on_this_work_up"
  | "work_up_incomplete";

export interface DisclosedResult {
  couple_id: string;
  viewer_role: Role;
  viewer_person_id: string | null;
  policy: Emirate;
  category: ResultCategory | null;
  withheld_reason_key: string | null; // counselling_first | awaiting_partner_consent | right_not_to_know
  shared: SharedCondition[];
  own_findings: Finding[];
  partner_finding_scope: "none" | "couple_result_only" | "gene_names_only" | "full_variant_detail";
  partner_findings: Finding[];
  detection: DetectionStatement[];
  relationship: Relationship;
  review_priority: ReviewPriority | null; // staff only
  staff_trace: string[]; // staff only
  boundary_notice_key: string;
  certificate_note_key: string | null;
  ruleset_version: string;
  /** Real backend only: the partner's gene names under the gene_names_only scope (partner_findings stays empty then). */
  partner_gene_names?: string[];
}

export type BlockKind = "heading" | "paragraph" | "list" | "icon_array" | "callout" | "disclaimer";

export interface NumberRef {
  key: string;
  value: number | string;
  origin: "engine" | "template_constant";
}

export interface IconArraySpec {
  total: number;
  affected: number;
  carrier: number;
  neither: number;
  caption: string;
}

export interface Block {
  kind: BlockKind;
  text: string;
  items: string[];
  icon_array: IconArraySpec | null;
  tone: "neutral" | "info" | "care";
  numbers: NumberRef[];
}

export interface CheckSummary {
  ok: boolean;
  numeric_fidelity: boolean;
  polarity: boolean;
  banned_words_absent: boolean;
  messages: string[];
}

export interface ExplainerDoc {
  locale: Locale;
  language_status: "reviewed" | "draft";
  blocks: Block[];
  glossary_keys: string[];
  numbers_used: NumberRef[];
  template_ids: string[];
  check: CheckSummary | null;
}

// ---- Errors (RFC 9457 problem details) -------------------------------------------------------------

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  correlation_id?: string;
  errors?: { field: string; message: string }[];
  /** Real backend: machine code (forbidden, validation_error, ...). */
  code?: string;
  /** Real backend: legal citation on a refused third-party request. */
  legal_basis?: string;
}

// ---- Demo (ASSUMED: composition lane, phase 2) -----------------------------------------------------

export interface Persona {
  id: string;
  display_name: string;
  role: Role;
  couple_id: string | null;
  person_id: string | null;
  description: string;
  token: string;
  simulated: boolean;
}

// ---- Cases and pathway (ASSUMED: journey lane) -----------------------------------------------------

export interface Partner {
  person_id: string;
  display_name: string;
  sex: "female" | "male";
  /** The language this person uses with the service (additive: the real API publishes it, the older mock did not). */
  language?: Locale;
}

/** PUT and DELETE /v1/couples/{id}/right-not-to-know (Decree-Law 49/2023, Art. 9(2)). */
export interface RntkStatus {
  couple_id: string;
  person_id: string;
  active: boolean;
  note: string;
}

export interface CoupleCase {
  couple_id: string;
  partners: Partner[];
  relationship: Relationship;
  policy: Emirate;
  panel_id: string;
  synthetic: boolean;
  created_at: string;
}

export type PathwayStateKey =
  | "registration_consent"
  | "physician_consult"
  | "sample_collection"
  | "lab_processing"
  | "joint_report"
  | "counselling"
  | "declaration"
  | "certificate"
  | "judicial_handoff";

export type PathwayStatus = "done" | "current" | "upcoming" | "blocked";
export type SlaStatus = "on_track" | "at_risk" | "breached" | "not_applicable";

export interface PathwayState {
  key: PathwayStateKey;
  label: string | null; // optional server label; the UI falls back to its own message key
  status: PathwayStatus;
  entered_at: string | null;
  completed_at: string | null;
  expected_duration_hours: number | null;
  sla_status: SlaStatus;
  simulated: boolean;
}

export interface NextAction {
  key: string;
  label: string | null;
  event: string | null; // pathway event the demo may fire to advance
  owner: "couple" | "clinic" | "lab" | "counsellor";
}

/** One allowed pathway event. `branch` marks things that can happen but are not the next main-path step. */
export interface NextActionOption extends NextAction {
  roles: string[];
  branch: boolean;
}

export interface PathwayView {
  couple_id: string;
  states: PathwayState[];
  /** The next main-path step (first non-branch event), whoever may record it. */
  next_action: NextAction | null;
  /** Every allowed event with the roles that may record it; absent in fixture mode. */
  next_actions?: NextActionOption[];
  referral_target_met: boolean | null;
}

export interface ReferralTask {
  task_id: string;
  destination: string;
  status: "requested" | "accepted" | "in-progress" | "completed" | "rejected" | "failed" | "cancelled" | "on-hold";
  authored_on: string;
  last_modified: string;
  simulated: boolean;
}

// ---- Consent and audit (ASSUMED: governance lane; scope enum is in the spec) -----------------------

export type ConsentScope = "couple_result_only" | "gene_names_only" | "full_variant_detail";

/**
 * The closed list of consent purposes the real backend accepts (backend/src/bayan/data/consent_policies.yaml
 * `consent_purposes`). The backend does not publish it on an endpoint (only in the 422 for an unknown purpose), so the
 * UI keeps this mirror; the adapter sends an id from it and never free text.
 */
export const CONSENT_PURPOSES = [
  "partner_disclosure",
  "couple_counselling",
  "service_referral",
  "service_interest_follow_up",
  "research_secondary_use",
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export interface ConsentRecord {
  consent_id: string;
  couple_id: string;
  subject_person_id: string;
  recipient: string; // a Role or a person id
  scope: ConsentScope;
  purpose: string;
  granted_at: string;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface ConsentGrantInput {
  subject_person_id: string;
  recipient_role: string;
  scope: ConsentScope;
  purpose: string;
  expires_at: string | null;
}

export interface AuditEvent {
  index: number;
  event_id: string;
  at: string;
  actor_role: Role | "system";
  actor_id: string;
  action: string;
  couple_id: string | null;
  detail: string;
  prev_hash: string;
  hash: string;
}

/**
 * Chain verification. A couple member gets the reduced form (scope "own_couple": ok and own_events only, so no
 * cross-couple volume or hash is disclosed); staff and evaluators get the full chain (scope "chain").
 */
export interface AuditVerification {
  ok: boolean;
  scope?: "chain" | "own_couple";
  own_events?: number | null;
  length: number | null;
  head_hash: string | null;
  first_bad_index: number | null;
  problem?: string | null;
}

// ---- Escalation and brief (ASSUMED: governance + composition) --------------------------------------

export type DueByHint = "immediate" | "same_session" | "fast_track" | "routine";

export interface EscalationDecision {
  rule_id: string;
  priority: ReviewPriority;
  reason: string;
  source: string;
  /** The rule's due-by key (never a number of days); decisions are ordered most urgent first by it. */
  due_by_hint?: DueByHint;
  /** Real backend only: who the rule routes to. Absent in fixture mode. */
  tier?: "counsellor" | "accredited_geneticist";
  /** Real backend only: every rule is pending clinical sign-off; a flag the trace pane shows as a stamp. */
  needs_clinician_signoff?: boolean;
  /** Real backend only: the rule needs a legal read before use. */
  needs_legal_read?: boolean;
}

export interface EscalationItem {
  couple_id: string;
  couple_label: string;
  review_priority: ReviewPriority;
  decisions: EscalationDecision[];
  raised_at: string;
}

/** One partner as the brief states them (additive: real backend and fixture mode both fill it). */
export interface BriefMember {
  display_name: string;
  sex: string;
  age: number | null;
  language: string;
  family_history: string[];
}

/** A section of the one-page brief, as the API composes it (result, why, sharing, open). Lines are API text. */
export interface BriefSection {
  key: string;
  title: string;
  lines: string[];
}

export interface CounsellorBrief {
  couple_id: string;
  generated_at: string;
  review_priority: ReviewPriority;
  category: ResultCategory;
  relationship: Relationship;
  shared: SharedCondition[];
  detection: DetectionStatement[];
  trace: string[];
  escalations: EscalationDecision[];
  referral_tasks: ReferralTask[];
  grounded_in: string[]; // rule ids and source titles the brief is built from
  /** Additive, for the staff instrument. */
  members?: BriefMember[];
  emirate_policy?: string;
  pathway_state?: string;
  sections?: BriefSection[];
  consent_count?: number;
  closure_record_count?: number;
}

// ---- Haematology aid (ASSUMED: genetics lane) ------------------------------------------------------

export interface CbcInput {
  sex: "female" | "male";
  hb_g_dl: number;
  mcv_fl: number;
  mch_pg: number;
  rbc_10e12_l: number | null;
  ferritin_ug_l: number | null;
  /** Real backend only (the aid reads these; see real/haem.ts). Absent means "not collected". */
  age_years?: number | null;
  ferritin_status?: "low" | "not_low" | "not_measured";
  pregnant?: boolean | "unknown";
  transfused_last_4_months?: boolean | "unknown";
}

export interface HplcInput {
  hba2_percent: number;
  hbf_percent: number;
  variant_hb_percent: number | null;
  variant_hb_name: string | null;
  /** Real backend only: the aid needs these two answers from the clinician. */
  hba2_is_total?: boolean | null;
  single_hba_band_only?: boolean | null;
}

export interface HaemSource {
  title: string;
  year: number | null;
  url: string | null;
  illustrative: boolean;
}

export interface HaemRuleStep {
  rule_id: string;
  description: string;
  source: HaemSource | null;
}

export interface HaemInterpretation {
  label: HaemLabel;
  label_text: string | null;
  rule_trace: HaemRuleStep[];
  flags: string[];
  needs_clinician_signoff: boolean;
  sources: HaemSource[];
  /** Real backend only: text the aid requires the screen to show. */
  mandatory_statements?: string[];
  not_a_diagnosis?: string;
  population_caveat?: string;
  sources_disagree?: string[];
  stage?: "cbc_only" | "cbc_plus_hplc";
  ruleset_version?: string;
}

// ---- Closure and teach-back (ASSUMED: journey lane; field lists follow research note 04) ------------

export type ClosureItemKind = "free_text" | "integer_0_100" | "true_false_unsure" | "single_choice" | "agree_1_5";

export interface ClosureChoice {
  id: string;
  text: string;
}

export interface PatientItem {
  id: string;
  kind: ClosureItemKind;
  prompt: string;
  choices: ClosureChoice[];
}

export type ProformaFieldKind = "system" | "text" | "datetime" | "yes_no" | "checklist" | "single_choice" | "action_list";

export interface ProformaField {
  id: string;
  number: number;
  label: string;
  filled_by: "system" | "clinician" | "patient";
  kind: ProformaFieldKind;
  choices: ClosureChoice[];
  hint: string | null;
  /** Real backend only: the roles an action's owner may be (action_list). When present, render a select, not free text. */
  owner_choices?: ClosureChoice[];
}

export interface ServiceInterestSchema {
  prompt: string;
  options: ClosureChoice[];
  topics: ClosureChoice[];
  consent_text: string;
}

export interface ClosureSchema {
  language_status: "reviewed" | "draft";
  patient_items: PatientItem[];
  proforma_fields: ProformaField[];
  service_interest: ServiceInterestSchema;
}

export interface PatientClosureInput {
  person_id: string;
  answers: Record<string, string>;
  service_interest: string;
  topics: string[];
}

export interface ClinicianProformaInput {
  answers: Record<string, string | string[]>;
}

export interface ClosureRecord {
  record_id: string;
  couple_id: string;
  kind: "patient" | "clinician";
  submitted_at: string;
  simulated: boolean;
}

export interface TeachBackQuestion {
  id: string;
  prompt: string;
  choices: ClosureChoice[];
}

export interface TeachBackQuiz {
  couple_id: string;
  locale: Locale;
  language_status: "reviewed" | "draft";
  questions: TeachBackQuestion[];
}

export interface TeachBackResult {
  couple_id: string;
  correct: number;
  total: number;
  items: { id: string; correct: boolean; explanation: string }[];
}

// ---- Programme KPIs and scoreboard (ASSUMED: journey + composition) --------------------------------

export interface ProgrammeKpis {
  generated_at: string;
  synthetic: boolean;
  cases_total: number;
  referral_target: number; // 0.9 in the DoH standard
  referral_completed: number;
  referral_eligible: number;
  by_state: { key: PathwayStateKey; count: number; median_hours: number | null; sla_breaches: number }[];
  /** Real backend only: what the real KPI endpoint offers beyond the mock shape (it has no per-state breakdown). */
  detail?: ProgrammeKpiDetail;
}

export interface DurationSummary {
  n: number;
  median_hours: number | null;
  p90_hours: number | null;
}

export interface ProgrammeKpiDetail {
  n_closed: number;
  n_flagged: number;
  time_to_result: DurationSummary;
  time_to_referral: DurationSummary;
  counselling_booked: number;
  counselling_completed: number;
  counselling_declined: number;
  counselling_uptake_booked_share: number | null;
  counselling_uptake_completed_share: number | null;
  share_referred: number | null;
  share_referred_within_standard: number | null;
  meets_referral_target: boolean | null;
  referral_standard_days: number;
  referral_standard_is_illustrative: boolean;
  open_tasks: number;
  stale_tasks: number;
  basis: string;
}

export type ScoreboardStatus = "measured" | "not_run";

export interface ScoreboardMetric {
  id: string;
  name: string;
  value: string; // preformatted by the evaluator, e.g. "100 of 100" or "0 of 1000, upper bound 0.3%"
  n: number | null;
  status: ScoreboardStatus;
  method: string;
  does_not_show: string;
}

export interface Scoreboard {
  generated_at: string;
  synthetic: boolean;
  metrics: ScoreboardMetric[];
  /** Real backend only. */
  caveats?: string[];
  code_version?: string;
}

// ---- Results envelope (ASSUMED: composition lane) ---------------------------------------------------

export interface ResultEnvelope {
  disclosed: DisclosedResult;
  explainer: ExplainerDoc | null;
}

export interface GlossaryEntry {
  key: string;
  term: string;
  definition: string;
}
