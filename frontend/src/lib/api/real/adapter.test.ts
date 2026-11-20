import { describe, expect, it } from "vitest";
import type { ApiRequest } from "../transport";
import type {
  AuditEvent,
  AuditVerification,
  ClosureRecord,
  ClosureSchema,
  ConsentRecord,
  CoupleCase,
  CounsellorBrief,
  EscalationItem,
  ExplainerDoc,
  GlossaryEntry,
  HaemInterpretation,
  PathwayView,
  Persona,
  ProgrammeKpis,
  ReferralTask,
  ResultEnvelope,
  Scoreboard,
  TeachBackQuiz,
  TeachBackResult,
} from "../types";
import { companionRequests, fromBackendResponse, normalizeProblem, toBackendRequest } from "./adapter";
import { AdapterError } from "./errors";
import audit from "./__fixtures__/audit_02.json";
import auditVerify from "./__fixtures__/audit_verify.json";
import brief from "./__fixtures__/brief_09.json";
import closureClinicianRecord from "./__fixtures__/closure_clinician_record.json";
import closurePatientRecord from "./__fixtures__/closure_patient_record.json";
import closureSchema from "./__fixtures__/closure_schema_en.json";
import communicate from "./__fixtures__/communicate_response.json";
import consentGranted from "./__fixtures__/consent_granted.json";
import consentRevoked from "./__fixtures__/consent_revoked.json";
import consents from "./__fixtures__/consents_02a.json";
import couple from "./__fixtures__/couple_02.json";
import escalations from "./__fixtures__/escalations.json";
import glossary from "./__fixtures__/explain_glossary.json";
import options from "./__fixtures__/explain_options.json";
import haemIncomplete from "./__fixtures__/haem_incomplete.json";
import haemPattern from "./__fixtures__/haem_pattern.json";
import kpis from "./__fixtures__/kpis.json";
import pathway01 from "./__fixtures__/pathway_01.json";
import pathway05 from "./__fixtures__/pathway_05.json";
import pathwayEvent05 from "./__fixtures__/pathway_event_05.json";
import personas from "./__fixtures__/personas.json";
import problemForbidden from "./__fixtures__/problem_forbidden.json";
import problemThirdParty from "./__fixtures__/problem_third_party.json";
import problemUnauthenticated from "./__fixtures__/problem_unauthenticated.json";
import problemHaem from "./__fixtures__/problem_validation_haem.json";
import problemProforma from "./__fixtures__/problem_validation_proforma.json";
import referrals from "./__fixtures__/referrals_05.json";
import result02a from "./__fixtures__/result_02a.json";
import result02Staff from "./__fixtures__/result_02_staff.json";
import result04bWithheld from "./__fixtures__/result_04b_withheld.json";
import scoreboard from "./__fixtures__/scoreboard.json";
import teachbackQuiz from "./__fixtures__/teachback_quiz.json";
import teachbackResult from "./__fixtures__/teachback_result.json";

/** The mapped value is `unknown` by contract (the route decides the type); tests state which UI type they expect. */
function ui<T>(req: ApiRequest, body: unknown, options?: Parameters<typeof fromBackendResponse>[2]): T {
  return fromBackendResponse(req, body, options) as T;
}
const get = (path: string, query?: Record<string, string>): ApiRequest => (query ? { method: "GET", path, query } : { method: "GET", path });
const post = (path: string, body: unknown): ApiRequest => ({ method: "POST", path, body });

describe("personas", () => {
  const list = ui<Persona[]>(get("/v1/demo/personas"), personas);

  it("uses the real access_token as the session token and derives the person id from the principal", () => {
    const member = list.find((p) => p.id === "cpl-demo-02-a");
    expect(member).toEqual({
      id: "cpl-demo-02-a",
      display_name: "Layla Demo (synthetic)",
      role: "couple_member",
      couple_id: "cpl-demo-02",
      person_id: "prs-02a",
      description: "Case 2: First cousins, both carry the same condition.",
      token: "demo-token-cpl-demo-02-a",
      simulated: true,
    });
  });

  it("gives staff personas no couple and no person id", () => {
    const clinician = list.find((p) => p.id === "clinician");
    expect(clinician).toMatchObject({ role: "clinician", couple_id: null, person_id: null, token: "demo-token-clinician" });
  });
});

describe("couple case", () => {
  it("derives partners from members and defaults the panel", () => {
    const view = ui<CoupleCase>(get("/v1/couples/cpl-demo-02"), couple);
    expect(view.partners).toEqual([
      { person_id: "prs-02a", display_name: "Layla Demo", sex: "female", language: "en" },
      { person_id: "prs-02b", display_name: "Anwar Demo", sex: "male", language: "ar" },
    ]);
    expect(view).toMatchObject({ couple_id: "cpl-demo-02", relationship: "first_cousin", policy: "abu_dhabi", panel_id: "default", synthetic: true });
  });
});

describe("pathway", () => {
  const view = ui<PathwayView>(get("/v1/couples/cpl-demo-05/pathway"), pathway05);

  it("folds the 12 real steps into the 9 UI states in order and drops case_closed", () => {
    expect(view.states.map((s) => s.key)).toEqual([
      "registration_consent",
      "physician_consult",
      "sample_collection",
      "lab_processing",
      "joint_report",
      "counselling",
      "declaration",
      "certificate",
      "judicial_handoff",
    ]);
  });

  it("reports done, current and upcoming states with timestamps and the UI's label fallback", () => {
    const byKey = Object.fromEntries(view.states.map((s) => [s.key, s]));
    expect(byKey["lab_processing"]).toMatchObject({ status: "done", label: null, sla_status: "on_track", expected_duration_hours: 24 });
    const completedAt = (id: string) => pathway05.steps.find((step) => step.id === id)?.completed_at;
    expect(byKey["lab_processing"]?.completed_at).toBe(completedAt("lab_started"));
    // entered when the previous real step finished
    expect(byKey["lab_processing"]?.entered_at).toBe(completedAt("sample_collected"));
    expect(byKey["registration_consent"]?.entered_at).toBe(completedAt("registered"));
    expect(byKey["physician_consult"]?.expected_duration_hours).toBe(0.25);
    expect(byKey["counselling"]).toMatchObject({ status: "current", sla_status: "breached", expected_duration_hours: 336, completed_at: null });
    expect(byKey["declaration"]).toMatchObject({ status: "upcoming", entered_at: null, sla_status: "not_applicable" });
  });

  it("takes next_action from the first real next action, with the event as key and a mapped owner", () => {
    expect(view.next_action).toEqual({ key: "counselling_booked", label: "Book counselling", event: "counselling_booked", owner: "counsellor" });
    expect(view.referral_target_met).toBeNull();
  });

  it("treats counselling steps that do not apply as done for the folded counselling state", () => {
    const unflagged = ui<PathwayView>(get("/v1/couples/cpl-demo-01/pathway"), pathway01);
    expect(unflagged.states.find((s) => s.key === "counselling")?.status).toBe("done");
    expect(unflagged.states.find((s) => s.key === "certificate")?.status).toBe("current");
  });

  it("sends the UI event as the real kind, and routes result_communicated through the communicate endpoint", () => {
    const advance = toBackendRequest(post("/v1/couples/cpl-demo-05/pathway/events", { event: "counselling_booked" }));
    expect(advance).toEqual({ method: "POST", path: "/v1/couples/cpl-demo-05/pathway/events", body: { kind: "counselling_booked" } });

    const communicated = toBackendRequest(post("/v1/couples/cpl-fixture-01/pathway/events", { event: "result_communicated" }));
    expect(communicated).toEqual({ method: "POST", path: "/v1/couples/cpl-fixture-01/result/communicate", body: {} });
  });

  it("maps both real answers (an event, and the communicate envelope) to a pathway view", () => {
    const afterEvent = ui<PathwayView>(post("/v1/couples/cpl-demo-05/pathway/events", { event: "counselling_booked" }), pathwayEvent05);
    // The headline is the next MAIN-path step; counselling_missed is a branch and is listed apart, flagged.
    expect(afterEvent.next_action?.event).toBe("counselling_completed");
    expect(afterEvent.next_actions?.find((a) => a.event === "counselling_missed")?.branch).toBe(true);
    expect(afterEvent.next_actions?.find((a) => a.event === "counselling_completed")?.branch).toBe(false);
    expect(afterEvent.states.find((s) => s.key === "counselling")?.status).toBe("current");

    const afterCommunicate = ui<PathwayView>(post("/v1/couples/cpl-fixture-01/pathway/events", { event: "result_communicated" }), communicate);
    expect(afterCommunicate.couple_id).toBe("cpl-fixture-01");
    expect(afterCommunicate.states.find((s) => s.key === "joint_report")?.status).toBe("done");
  });

  it("maps referral tasks, with a destination per task code", () => {
    const tasks = ui<ReferralTask[]>(get("/v1/couples/cpl-demo-05/referrals"), referrals);
    expect(tasks).toEqual([
      {
        task_id: "task-cpl-demo-05-001",
        destination: "Genetic counselling service (simulated)",
        status: "accepted", // counselling_booked was recorded before this capture
        authored_on: referrals[0]?.authored_on,
        last_modified: referrals[0]?.last_modified,
        simulated: true,
      },
    ]);
  });
});

describe("result envelope", () => {
  const req = get("/v1/couples/cpl-demo-02/result", { locale: "en" });

  it("wraps the shared result of cpl-demo-02-a as {disclosed, explainer}", () => {
    const envelope = ui<ResultEnvelope>(req, result02a);
    expect(envelope.disclosed).toMatchObject({
      couple_id: "cpl-demo-02",
      viewer_role: "couple_member",
      viewer_person_id: "prs-02a",
      policy: "abu_dhabi",
      category: "shared_result_found",
      withheld_reason_key: null,
      partner_finding_scope: "none",
      partner_findings: [],
      partner_gene_names: [],
      review_priority: null,
      staff_trace: [],
      relationship: "first_cousin",
      boundary_notice_key: "boundary.education_decision_support",
      certificate_note_key: "certificate_note.abu_dhabi",
    });
    expect(envelope.disclosed.shared[0]).toMatchObject({ gene: "USH2A", basis: "both_carriers" });
    expect(envelope.disclosed.shared[0]?.outcomes).toEqual([
      { label: "affected", per_100: 25, applies_to: "any_child" },
      { label: "carrier", per_100: 50, applies_to: "any_child" },
      { label: "neither", per_100: 25, applies_to: "any_child" },
    ]);
    expect(envelope.explainer?.language_status).toBe("draft");
    expect(envelope.explainer?.blocks.some((b) => b.kind === "icon_array" && b.icon_array?.total === 100)).toBe(true);
  });

  it("gives a withheld result (cpl-demo-04-b) a null category and the reason key", () => {
    const envelope = ui<ResultEnvelope>(get("/v1/couples/cpl-demo-04/result"), result04bWithheld);
    expect(envelope.disclosed.category).toBeNull();
    expect(envelope.disclosed.withheld_reason_key).toBe("awaiting_partner_consent");
    expect(envelope.disclosed.policy).toBe("dubai");
    expect(envelope.disclosed.own_findings).toHaveLength(1);
    expect(envelope.disclosed.shared).toEqual([]);
    expect(envelope.explainer?.blocks.length).toBeGreaterThan(0);
  });

  it("keeps the staff-only fields for a staff viewer", () => {
    const envelope = ui<ResultEnvelope>(req, result02Staff);
    expect(envelope.disclosed.viewer_role).toBe("counsellor");
    expect(envelope.disclosed.review_priority).toBe("priority");
    expect(envelope.disclosed.staff_trace.length).toBeGreaterThan(0);
  });

  it("reads the explainer reference endpoints", () => {
    expect(ui<ExplainerDoc>(get("/v1/explain/options", { locale: "en" }), options).blocks.length).toBeGreaterThan(0);
    expect(ui<GlossaryEntry[]>(get("/v1/explain/glossary"), glossary)[0]).toEqual({
      key: "gene",
      term: "gene",
      definition: expect.stringContaining("A gene is a set of instructions") as string,
    });
  });
});

describe("consents", () => {
  it("lists real consent records in the UI shape", () => {
    const list = ui<ConsentRecord[]>(get("/v1/couples/cpl-demo-02/consents"), consents);
    expect(list).toEqual([
      {
        consent_id: "consent-00001",
        couple_id: "cpl-demo-02",
        subject_person_id: "prs-02a",
        recipient: "prs-02b",
        scope: "couple_result_only",
        purpose: "partner_disclosure",
        granted_at: consents.records[0]?.granted_at,
        expires_at: null,
        revoked_at: null,
      },
    ]);
  });

  it("does not list a statutory record (no sharing scope, cannot be revoked)", () => {
    const withStatutory = { ...consents, records: [...consents.records, { ...consents.records[0], consent_id: "consent-00002", basis: "statutory_obligation", scope: null }] };
    expect(ui<ConsentRecord[]>(get("/v1/couples/cpl-demo-02/consents"), withStatutory)).toHaveLength(1);
  });

  it("sends a grant as {recipient, scope, purpose, expires_at} and implies the purpose from the recipient", () => {
    const toPartner = toBackendRequest(
      post("/v1/couples/cpl-demo-02/consents", { subject_person_id: "prs-02a", recipient_role: "prs-02b", scope: "gene_names_only", purpose: "so we can talk", expires_at: "2026-12-31T23:59:59.999Z" }),
    );
    expect(toPartner.body).toEqual({ recipient: "prs-02b", scope: "gene_names_only", purpose: "partner_disclosure", expires_at: "2026-12-31T23:59:59.999Z" });

    const toCounsellor = toBackendRequest(post("/v1/couples/cpl-demo-02/consents", { subject_person_id: "prs-02a", recipient_role: "counsellor", scope: "couple_result_only", purpose: "x", expires_at: null }));
    expect(toCounsellor.body).toMatchObject({ recipient: "counsellor", purpose: "couple_counselling", expires_at: null });

    const exact = toBackendRequest(post("/v1/couples/cpl-demo-02/consents", { subject_person_id: "prs-02a", recipient_role: "counsellor", scope: "couple_result_only", purpose: "service_referral", expires_at: null }));
    expect(exact.body).toMatchObject({ purpose: "service_referral" });
  });

  it("maps a granted and a revoked record", () => {
    const granted = ui<ConsentRecord>(post("/v1/couples/cpl-demo-02/consents", {}), consentGranted);
    expect(granted).toMatchObject({ consent_id: "consent-00001", scope: "couple_result_only", revoked_at: null });
    const revoked = ui<ConsentRecord>(post("/v1/consents/consent-00001/revoke", undefined), consentRevoked);
    expect(revoked.revoked_at).toBe(consentRevoked.revoked_at);
  });
});

describe("audit", () => {
  it("renames timestamp to at, folds outcome, reason and detail pairs into one string, and builds an event id", () => {
    const events = ui<AuditEvent[]>(get("/v1/couples/cpl-demo-02/audit"), audit);
    const first = audit.events[0];
    expect(events[0]).toMatchObject({
      index: first?.index,
      event_id: `audit-${first?.index}`,
      at: first?.timestamp,
      actor_role: "system",
      actor_id: "system",
      action: "staff_assigned",
      couple_id: "cpl-demo-02",
      detail: "recorded: care_team_assignment (staff=stf-clinician-01)",
    });
    expect(events[0]?.prev_hash).toHaveLength(64);
    expect(events.map((e) => e.event_id)).toEqual(events.map((e) => `audit-${e.index}`));
  });

  it("maps the reduced own-couple verification a couple member receives (no chain length or hash)", () => {
    const reduced = { scope: "own_couple", ok: true, own_events: 3, length: null, head_hash: null, first_bad_index: null, problem: null };
    expect(ui<AuditVerification>(get("/v1/audit/verify"), reduced)).toEqual({
      ok: true,
      scope: "own_couple",
      own_events: 3,
      length: null,
      head_hash: null,
      first_bad_index: null,
      problem: null,
    });
  });

  it("maps the chain verification", () => {
    expect(ui<AuditVerification>(get("/v1/audit/verify"), auditVerify)).toMatchObject({
      ok: true,
      length: auditVerify.length,
      head_hash: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
      first_bad_index: null,
    });
  });
});

describe("problem details", () => {
  it("passes the third-party refusal through with its status, correlation id and citation", () => {
    const problem = normalizeProblem(403, problemThirdParty, post("/v1/third-party-requests", { couple_id: "cpl-demo-01", kind: "employer" }));
    expect(problem).toMatchObject({
      type: "https://bayan.invalid/problems/forbidden",
      title: "Forbidden",
      status: 403,
      code: "forbidden",
      instance: "/v1/third-party-requests",
      correlation_id: problemThirdParty.correlation_id,
    });
    expect(problem.detail).toContain("Art. 19 to 21");
    expect(problem.legal_basis).toContain("Federal Decree-Law 49/2023");
  });

  it("keeps title, status, detail and correlation id of an authorisation failure", () => {
    expect(normalizeProblem(403, problemForbidden)).toMatchObject({ title: "Forbidden", status: 403, detail: "This record belongs to another couple." });
    expect(normalizeProblem(401, problemUnauthenticated)).toMatchObject({ title: "Unauthenticated", status: 401, correlation_id: problemUnauthenticated.correlation_id });
  });

  it("names a haematology field error by the UI form's field name", () => {
    const problem = normalizeProblem(422, problemHaem, post("/v1/haem/interpret", {}));
    expect(problem.errors).toEqual([{ field: "body.cbc.hb_g_dl", message: "Input should be less than or equal to 250" }]);
  });

  it("attaches proforma errors to the UI field ids, including the fields the adapter splits or renames", () => {
    const problem = normalizeProblem(422, problemProforma, post("/v1/couples/cpl-demo-02/closure/clinician", {}));
    expect(problem.errors?.map((e) => e.field)).toEqual([
      "answers.encounter_duration_minutes",
      "answers.information_given",
      "answers.next_step_status",
      "answers.teach_back",
      "answers.patient_questions_invited",
    ]);
  });

  it("keeps the status and gives an unreadable body a title", () => {
    expect(normalizeProblem(502, null)).toEqual({ type: "about:blank", title: "The request failed", status: 502 });
    expect(normalizeProblem(404, "nope")).toMatchObject({ title: "Not found", status: 404 });
  });

  it("reads FastAPI's own validation shape", () => {
    const problem = normalizeProblem(422, { detail: [{ loc: ["body", "answers", "out_of_100"], msg: "too big", type: "x" }] });
    expect(problem.errors).toEqual([{ field: "body.answers.out_of_100", message: "too big" }]);
  });
});

describe("haematology aid", () => {
  it("converts units and names, and sends only what the form collected", () => {
    const real = toBackendRequest(
      post("/v1/haem/interpret", {
        cbc: { sex: "female", hb_g_dl: 11.2, mcv_fl: 68, mch_pg: 21, rbc_10e12_l: 4.1, ferritin_ug_l: 9 },
        hplc: { hba2_percent: 3.8, hbf_percent: 1.1, variant_hb_percent: null, variant_hb_name: null },
      }),
    );
    expect(real.body).toEqual({
      cbc: { sex: "F", hb_g_per_l: 112, mcv_fl: 68, mch_pg: 21, ferritin_status: "not_measured" },
      hplc: { hba2_pct: 3.8, hbf_pct: 1.1, hba2_is_total: null, single_hba_band_only: null, variant_detected: "none" },
    });
  });

  it("passes the optional answers the aid needs when the form supplies them, and maps a variant name to the closed list", () => {
    const real = toBackendRequest(
      post("/v1/haem/interpret", {
        cbc: { sex: "male", hb_g_dl: 14, mcv_fl: 90, mch_pg: 30, rbc_10e12_l: null, ferritin_ug_l: null, age_years: 31, ferritin_status: "low", pregnant: "unknown" },
        hplc: { hba2_percent: 2.5, hbf_percent: 0.5, variant_hb_percent: 38, variant_hb_name: "HbS", hba2_is_total: true, single_hba_band_only: false },
      }),
    );
    expect(real.body).toEqual({
      cbc: { sex: "M", hb_g_per_l: 140, mcv_fl: 90, mch_pg: 30, ferritin_status: "low", age_years: 31, pregnant: "unknown" },
      hplc: { hba2_pct: 2.5, hbf_pct: 0.5, hba2_is_total: true, single_hba_band_only: false, variant_detected: "S" },
    });
  });

  it("omits hplc when the work-up is CBC only", () => {
    const real = toBackendRequest(post("/v1/haem/interpret", { cbc: { sex: "female", hb_g_dl: 11, mcv_fl: 70, mch_pg: 22, rbc_10e12_l: null, ferritin_ug_l: null }, hplc: null }));
    expect(real.body).not.toHaveProperty("hplc");
  });

  it("maps the real interpretation, linking each trace line to its source", () => {
    const view = ui<HaemInterpretation>(post("/v1/haem/interpret", {}), haemPattern);
    expect(view.label).toBe("indices_reduced");
    expect(view.needs_clinician_signoff).toBe(true);
    expect(view.rule_trace.map((step) => step.rule_id)).toEqual(["S1-A01", "S1-R01"]);
    expect(view.rule_trace[0]?.source).toMatchObject({ title: expect.stringContaining("NHS England") as string, illustrative: false });
    expect(view.sources[0]?.year).toBeNull(); // "updated 2024-10-10" is not a year
    expect(view.flags).toContain("ALPHA_THAL_POSSIBLE_CBC_CANNOT_SEPARATE_FROM_IRON_DEFICIENCY");
    expect(view.not_a_diagnosis).toContain("not a diagnosis");
    expect(view.stage).toBe("cbc_only");
  });

  it("maps an incomplete work-up and marks the validation source as illustrative", () => {
    const view = ui<HaemInterpretation>(post("/v1/haem/interpret", {}), haemIncomplete);
    expect(view.label).toBe("cbc_incomplete");
    expect(view.rule_trace[0]?.source?.illustrative).toBe(true);
  });
});

describe("closure schema and submissions", () => {
  const schema = ui<ClosureSchema>(get("/v1/closure/schema", { locale: "en" }), closureSchema);

  it("maps patient items by id, kind and choices", () => {
    expect(schema.language_status).toBe("draft");
    expect(schema.patient_items.map((i) => [i.id, i.kind])).toEqual([
      ["own_words", "free_text"],
      ["out_of_100", "integer_0_100"],
      ["carrier_is_disease", "true_false_unsure"],
      ["negative_means_none", "true_false_unsure"],
      ["next_step", "single_choice"],
      ["values_clarity", "agree_1_5"],
      ["felt_free", "agree_1_5"],
      ["who_can_see", "single_choice"],
    ]);
    expect(schema.patient_items.find((i) => i.id === "next_step")?.choices).toEqual([
      { id: "counsellor_explains", text: "A counsellor or doctor explains the result and the choices to us" },
      { id: "centre_decides", text: "The screening centre decides for us" },
      { id: "nothing_more", text: "Nothing more happens" },
      { id: "find_lab_yourself", text: "We find a laboratory ourselves" },
    ]);
  });

  it("maps the service-interest question", () => {
    expect(schema.service_interest.options.map((o) => o.id)).toEqual(["yes_now", "yes_later", "no_thanks", "prefer_not_to_say"]);
    expect(schema.service_interest.topics).toHaveLength(5);
    expect(schema.service_interest.consent_text).toContain("This is your choice");
  });

  it("offers the clinician every real proforma input as a typed UI field, in proforma order", () => {
    const fields = schema.proforma_fields;
    expect(fields.map((f) => f.id)).toEqual([
      "encounter_mode",
      "encounter_duration_minutes",
      "encounter_language",
      "encounter_interpreter",
      "risk_signal",
      "findings_discussed",
      "information_given",
      "next_step_status",
      "teach_back",
      "patient_questions_invited",
      "patient_questions_answered",
      "plan",
      "referral_task",
      "service_preference",
      "patient_copy_given",
      "completed_by",
    ]);
    const byId = Object.fromEntries(fields.map((f) => [f.id, f]));
    expect(byId["information_given"]?.choices.map((c) => c.id)).toEqual([
      "carrier_vs_disease",
      "couple_numbers",
      "test_limits",
      "options_neutral_order",
      "right_not_to_know",
      "who_can_see_result",
      "how_to_reach_us",
    ]);
    expect(byId["plan"]).toMatchObject({ kind: "action_list" });
    expect(byId["plan"]?.owner_choices?.map((c) => c.id)).toEqual(["clinician", "counsellor", "couple_member", "programme"]);
    expect(byId["next_step_status"]?.choices.map((c) => c.id)).toEqual(["decided", "still_deciding", "declined_to_discuss"]);
    expect(byId["teach_back"]?.choices.map((c) => c.id)).toEqual(["not_done", "accurate", "partly", "repeat_needed"]);
    expect(byId["risk_signal"]).toMatchObject({ filled_by: "system", kind: "system" });
    expect(byId["service_preference"]).toMatchObject({ filled_by: "patient" });
    // the real field label and number carry through
    expect(byId["teach_back"]).toMatchObject({ label: "Teach-back", number: 6 });
  });

  it("turns the form's patient answers into real ClosureAnswers", () => {
    const real = toBackendRequest(
      post("/v1/couples/cpl-demo-02/closure/patient", {
        person_id: "prs-02a",
        answers: { own_words: "We may both be carriers", out_of_100: "25", carrier_is_disease: "false", next_step: "counsellor_explains", values_clarity: "4", felt_free: "5", who_can_see: "me_and_partner" },
        service_interest: "yes_later",
        topics: ["preconception_counselling"],
      }),
    );
    expect(real.body).toEqual({
      person_id: "prs-02a",
      answers: {
        own_words: "We may both be carriers",
        out_of_100: 25,
        carrier_is_disease: "false",
        next_step: "counsellor_explains",
        values_clarity: 4,
        felt_free: 5,
        who_can_see: "me_and_partner",
        service_interest: { value: "yes_later", consent_acknowledged: true, consent_version: 1, topics: ["preconception_counselling"], reminder_months: 3 },
      },
    });
  });

  it("sends a non-numeric integer answer unchanged so the backend can name the field, and drops topics for a no", () => {
    const real = toBackendRequest(
      post("/v1/couples/cpl-demo-02/closure/patient", { person_id: "prs-02a", answers: { out_of_100: "lots" }, service_interest: "no_thanks", topics: ["preconception_counselling"] }),
    );
    expect(real.body).toEqual({
      person_id: "prs-02a",
      answers: { out_of_100: "lots", service_interest: { value: "no_thanks", consent_acknowledged: false, consent_version: 1, topics: [] } },
    });
  });

  it("turns the form's proforma answers into a real ClinicianProforma", () => {
    const real = toBackendRequest(
      post("/v1/couples/cpl-demo-02/closure/clinician", {
        answers: {
          encounter_mode: "virtual",
          encounter_duration_minutes: "45",
          encounter_language: "ar",
          encounter_interpreter: "yes",
          findings_discussed: ["shared_result_discussed", "explained_as_chance"],
          information_given: ["carrier_vs_disease", "test_limits"],
          next_step_status: "still_deciding",
          teach_back: "partly",
          patient_questions_invited: "yes",
          patient_questions_answered: "no",
          plan: [JSON.stringify({ action: "referral", owner: "Counsellor", due: "2026-12-01" })],
          patient_copy_given: "yes",
        },
      }),
    );
    expect(real.body).toEqual({
      encounter: { mode: "virtual", duration_minutes: 45, session_language: "ar", interpreter_used: true },
      findings_discussed: [{ finding_ref: "couple_result", explained_as_chance_not_diagnosis: true, flagged_uncertain: false }],
      information_given: {
        carrier_vs_disease: true,
        couple_numbers: false,
        test_limits: true,
        options_neutral_order: false,
        right_not_to_know: false,
        who_can_see_result: false,
        how_to_reach_us: false,
      },
      next_step_status: "still_deciding",
      teach_back_done: true,
      teach_back_result: "partly",
      patient_questions_invited: true,
      patient_questions_answered: false,
      plan: [{ action: "referral", owner_role: "counsellor", due_date: "2026-12-01" }],
      patient_copy_given: true,
    });
  });

  it("records teach-back as not done, and drops 'answered' when no question was invited", () => {
    const real = toBackendRequest(
      post("/v1/couples/cpl-demo-02/closure/clinician", { answers: { teach_back: "not_done", patient_questions_invited: "no", patient_questions_answered: "yes" } }),
    );
    expect(real.body).toEqual({ teach_back_done: false, patient_questions_invited: false, patient_questions_answered: null });
  });

  it("maps both closure records", () => {
    const patient = ui<ClosureRecord>(post("/v1/couples/cpl-demo-02/closure/patient", {}), closurePatientRecord);
    expect(patient).toEqual({ record_id: "closure-cpl-demo-02-001", couple_id: "cpl-demo-02", kind: "patient", submitted_at: closurePatientRecord.submitted_at, simulated: true });
    expect(ui<ClosureRecord>(post("/v1/couples/cpl-demo-02/closure/clinician", {}), closureClinicianRecord).kind).toBe("clinician");
  });
});

describe("teach-back", () => {
  it("maps the quiz's items to questions and options to choices", () => {
    const quiz = ui<TeachBackQuiz>(get("/v1/couples/cpl-demo-02/teachback", { locale: "en" }), teachbackQuiz);
    expect(quiz).toMatchObject({ couple_id: "cpl-demo-02", locale: "en", language_status: "draft" });
    expect(quiz.questions).toHaveLength(5);
    expect(quiz.questions[0]).toMatchObject({ id: "sr1", prompt: "What does a shared result mean?" });
    expect(quiz.questions[0]?.choices.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(quiz.questions[1]?.choices).toEqual([
      { id: "true", text: "True" },
      { id: "false", text: "False" },
      { id: "not_sure", text: "Not sure" },
    ]);
    expect(quiz).not.toHaveProperty("items");
  });

  it("sends answers with the locale the real submission requires", () => {
    expect(toBackendRequest(post("/v1/couples/cpl-demo-02/teachback", { answers: { sr1: "a" }, locale: "ur" })).body).toEqual({ answers: { sr1: "a" }, locale: "ur" });
    expect(toBackendRequest({ method: "POST", path: "/v1/couples/cpl-demo-02/teachback", query: { locale: "ar" }, body: { answers: { sr1: "a" } } }).body).toEqual({ answers: { sr1: "a" }, locale: "ar" });
    expect(toBackendRequest(post("/v1/couples/cpl-demo-02/teachback", { answers: {} })).body).toEqual({ answers: {}, locale: "en" });
  });

  it("maps the result counts and per-item explanations", () => {
    const result = ui<TeachBackResult>(post("/v1/couples/cpl-demo-02/teachback", {}), teachbackResult);
    expect(result).toMatchObject({ couple_id: "cpl-demo-02", correct: 3, total: 5 });
    expect(result.items[3]).toMatchObject({ id: "sr4", correct: false });
    expect(result.items[3]?.explanation).toContain("The choice is yours");
  });
});

describe("staff, programme and evaluation", () => {
  it("maps the escalation queue, deriving priority from the due hint and a label from the id", () => {
    const items = ui<EscalationItem[]>(get("/v1/escalations"), escalations);
    expect(items.map((i) => [i.couple_id, i.review_priority])).toEqual([
      ["cpl-demo-01", "routine"],
      ["cpl-demo-02", "priority"],
      ["cpl-demo-04", "priority"],
    ]);
    expect(items[1]).toMatchObject({ couple_label: "cpl-demo-02", raised_at: escalations.records[1]?.created_at });
    expect(items[1]?.decisions[0]).toMatchObject({ rule_id: "shared_result", priority: "priority" });
    expect(items[1]?.decisions[0]?.reason).toBe("shared result (tier: accredited geneticist; due: fast track)");
  });

  const decision = (trigger_id: string, due_by_hint: string) => ({
    trigger_id,
    tier: "accredited_geneticist",
    reason_keys: [`escalation.${trigger_id}`],
    due_by_hint,
    source: "test source",
  });
  const record = (couple_id: string, created_at: string, decisions: ReturnType<typeof decision>[]) => ({ couple_id, created_at, decisions });

  it("orders the rules inside a row most urgent first by due-by hint, keeping the backend order for equal hints", () => {
    const body = { records: [record("c", "2026-11-01T00:00:00Z", [decision("a_routine", "routine"), decision("b_fast", "fast_track"), decision("c_now", "immediate"), decision("d_fast", "fast_track")])] };
    const [item] = ui<EscalationItem[]>(get("/v1/escalations"), body);
    expect(item?.decisions.map((d) => d.rule_id)).toEqual(["c_now", "b_fast", "d_fast", "a_routine"]);
    expect(item?.decisions.map((d) => d.due_by_hint)).toEqual(["immediate", "fast_track", "fast_track", "routine"]);
  });

  it("shows Urgent only when the most urgent hint is the top value (immediate); same_session and fast_track are priority", () => {
    const priority = (hint: string) => ui<EscalationItem[]>(get("/v1/escalations"), { records: [record("c", "2026-11-01T00:00:00Z", [decision("x", hint)])] })[0]?.review_priority;
    expect(priority("immediate")).toBe("urgent");
    expect(priority("same_session")).toBe("priority");
    expect(priority("fast_track")).toBe("priority");
    expect(priority("routine")).toBe("routine");
  });

  it("merges several backend records for one couple into one row: earliest raise time, each rule once", () => {
    const body = {
      records: [
        record("c1", "2026-11-05T00:00:00Z", [decision("shared_result", "fast_track")]),
        record("c2", "2026-11-02T00:00:00Z", [decision("x", "routine")]),
        record("c1", "2026-11-03T00:00:00Z", [decision("shared_result", "fast_track"), decision("pregnancy_in_progress", "fast_track")]),
        record("c1", "2026-11-06T00:00:00Z", [decision("shared_result", "fast_track")]),
      ],
    };
    const items = ui<EscalationItem[]>(get("/v1/escalations"), body);
    expect(items.map((i) => i.couple_id)).toEqual(["c1", "c2"]);
    expect(items[0]).toMatchObject({ raised_at: "2026-11-03T00:00:00Z" });
    expect(items[0]?.decisions.map((d) => d.rule_id)).toEqual(["shared_result", "pregnancy_in_progress"]);
  });

  it("maps the brief and merges the referral tasks fetched alongside it", () => {
    const req = get("/v1/couples/cpl-demo-09/brief");
    expect(companionRequests(req)).toEqual({ referrals: { method: "GET", path: "/v1/couples/cpl-demo-09/referrals" } });
    const view = ui<CounsellorBrief>(req, brief, { companions: { referrals }, now: () => new Date("2026-11-20T10:00:00Z") });
    expect(view).toMatchObject({
      couple_id: "cpl-demo-09",
      generated_at: "2026-11-20T10:00:00.000Z",
      review_priority: "urgent",
      category: "shared_result_found",
      relationship: "first_cousin_once_removed",
    });
    expect(view.shared[0]?.gene).toBe("HBB");
    expect(view.escalations.map((e) => e.rule_id)).toContain("pregnancy_in_progress");
    expect(view.referral_tasks).toHaveLength(1);
    expect(view.grounded_in).toEqual(expect.arrayContaining(["E01", "P1"]));
    expect(companionRequests(get("/v1/couples/cpl-demo-09/pathway"))).toEqual({});
  });

  it("falls back to routine and more_information_needed when the brief has no priority or category, and to no tasks without the companion", () => {
    const view = ui<CounsellorBrief>(get("/v1/couples/cpl-demo-09/brief"), { ...brief, review_priority: null, category: null });
    expect(view).toMatchObject({ review_priority: "routine", category: "more_information_needed", referral_tasks: [] });
  });

  it("maps the programme KPIs: eligible is the flagged count, completed is share x eligible", () => {
    const view = ui<ProgrammeKpis>(get("/v1/programme/kpis"), kpis, { now: () => new Date("2026-11-20T10:00:00Z") });
    expect(view).toMatchObject({
      generated_at: "2026-11-20T10:00:00.000Z",
      synthetic: true,
      cases_total: kpis.n_cases,
      referral_target: 0.9,
      referral_eligible: kpis.n_flagged,
      referral_completed: Math.round((kpis.share_referred ?? 0) * kpis.n_flagged),
      by_state: [],
    });
    expect(view.detail).toMatchObject({ n_flagged: kpis.n_flagged, counselling_booked: kpis.counselling_booked, meets_referral_target: false, referral_standard_is_illustrative: true });
    expect(view.detail?.time_to_result).toMatchObject({ n: kpis.time_to_result.n, median_hours: kpis.time_to_result.median_hours });
  });

  it("maps the scoreboard, treating protocol_only like not_run", () => {
    const view = ui<Scoreboard>(get("/v1/eval/scoreboard"), scoreboard);
    expect(view.synthetic).toBe(true);
    expect(view.metrics[0]).toMatchObject({ id: "M1", status: "measured", n: 20000 });
    expect(view.metrics[0]).toHaveProperty("name", "Result engine versus an independent oracle");
    expect(view.metrics[1]).toMatchObject({ id: "M8", status: "not_run", n: null });
    const protocolOnly = ui<Scoreboard>(get("/v1/eval/scoreboard"), { ...scoreboard, metrics: [{ ...scoreboard.metrics[1], status: "protocol_only" }] });
    expect(protocolOnly.metrics[0]?.status).toBe("not_run");
  });

  it("maps the demo reset", () => {
    expect(ui<{ ok: boolean }>(post("/v1/demo/reset", undefined), { status: "reset", data: "synthetic" })).toEqual({ ok: true });
  });
});

describe("contract guards", () => {
  it("leaves requests it has no rule for, and every plain read, unchanged", () => {
    const reads: ApiRequest[] = [
      get("/v1/couples/cpl-demo-02"),
      get("/v1/couples/cpl-demo-02/pathway"),
      get("/v1/couples/cpl-demo-02/result", { locale: "ar" }),
      get("/v1/explain/glossary", { locale: "ur" }),
      get("/v1/escalations"),
      get("/v1/programme/kpis"),
      post("/v1/third-party-requests", { couple_id: "cpl-demo-01", kind: "employer" }),
      get("/v1/something/else"),
    ];
    for (const req of reads) expect(toBackendRequest(req)).toEqual(req);
  });

  it("raises one named AdapterError when the backend changes shape", () => {
    expect(() => fromBackendResponse(get("/v1/couples/cpl-demo-02/pathway"), { couple_id: "x" })).toThrow(AdapterError);
    expect(() => fromBackendResponse(get("/v1/couples/cpl-demo-02"), { ...couple, relationship: "cousins" })).toThrow(/relationship/);
  });

  it("passes an unknown route's body through untouched", () => {
    expect(fromBackendResponse(get("/v1/something/else"), { a: 1 })).toEqual({ a: 1 });
  });
});
