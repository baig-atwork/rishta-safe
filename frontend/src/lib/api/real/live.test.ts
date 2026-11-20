import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createApi, type Api } from "../endpoints";
import { ApiError, problemFromUnknown, type ApiRequest, type Transport } from "../transport";
import { callBackend } from "../upstream";
import type { ClinicianProformaInput, Persona } from "../types";

/**
 * Opt-in contract test against a RUNNING real backend, through the same path the app uses (createApi, then
 * callBackend, then the adapter). It writes to the demo state (consent, closure, a new case), so point it at a throwaway
 * instance:
 *
 *   cd ../backend && uv run python -m uvicorn "bayan.api.app:create_app" --factory --port 8000
 *   BAYAN_LIVE_URL=http://127.0.0.1:8000 node_modules/.bin/vitest run src/lib/api/real/live.test.ts
 *
 * Without BAYAN_LIVE_URL every test here is skipped.
 */
const LIVE_URL = process.env["BAYAN_LIVE_URL"];

function apiFor(token: string | null): Api {
  const transport: Transport = async <T>(req: ApiRequest): Promise<T> => {
    const result = await callBackend(req, token);
    if (result.status >= 200 && result.status < 300) return result.body as T;
    throw new ApiError(problemFromUnknown(result.status, result.body, "The request failed"));
  };
  return createApi(transport);
}

async function raw(req: ApiRequest, token: string): Promise<unknown> {
  const result = await callBackend(req, token);
  if (result.status < 200 || result.status >= 300) throw new Error(`${req.method} ${req.path}: ${result.status} ${JSON.stringify(result.body)}`);
  return result.body;
}

describe.skipIf(LIVE_URL === undefined)("real backend through the adapter", () => {
  const apis = new Map<string, Api>();
  let personas: Persona[] = [];
  const as = (id: string): Api => {
    const api = apis.get(id);
    if (api === undefined) throw new Error(`no persona ${id}`);
    return api;
  };
  const token = (id: string): string => {
    const persona = personas.find((p) => p.id === id);
    if (persona === undefined) throw new Error(`no persona ${id}`);
    return persona.token;
  };

  beforeAll(async () => {
    vi.stubEnv("BAYAN_MOCK", "");
    vi.stubEnv("NEXT_PUBLIC_BAYAN_MOCK", "");
    vi.stubEnv("BAYAN_API_URL", LIVE_URL ?? "");
    personas = await apiFor(null).personas();
    for (const persona of personas) apis.set(persona.id, apiFor(persona.token));
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it("lists 24 personas whose token is the real bearer", () => {
    expect(personas).toHaveLength(24);
    expect(personas.find((p) => p.id === "cpl-demo-02-a")).toMatchObject({ role: "couple_member", couple_id: "cpl-demo-02", person_id: "prs-02a", simulated: true });
    expect(personas.every((p) => p.token.length > 20)).toBe(true);
  });

  it("serves a couple member's own screens", async () => {
    const me = as("cpl-demo-02-a");
    const couple = await me.couple("cpl-demo-02");
    expect(couple.partners.map((p) => p.person_id)).toEqual(["prs-02a", "prs-02b"]);

    const pathway = await me.pathway("cpl-demo-02");
    expect(pathway.states).toHaveLength(9);

    const result = await me.result("cpl-demo-02", "en");
    expect(result.disclosed.category).toBe("shared_result_found");
    expect(result.explainer?.blocks.length).toBeGreaterThan(0);

    expect((await me.result("cpl-demo-02", "ar")).explainer?.locale).toBe("ar");
    expect((await me.options("en")).blocks.length).toBeGreaterThan(0);
    expect((await me.glossary("en")).length).toBeGreaterThan(0);
    expect(await me.referrals("cpl-demo-02")).toBeInstanceOf(Array);
  });

  it("grants and revokes a consent, which the audit trail then shows", async () => {
    const me = as("cpl-demo-02-a");
    const granted = await me.grantConsent("cpl-demo-02", {
      subject_person_id: "prs-02a",
      recipient_role: "prs-02b",
      scope: "couple_result_only",
      purpose: "anything the form typed",
      expires_at: null,
    });
    expect(granted).toMatchObject({ recipient: "prs-02b", scope: "couple_result_only", purpose: "partner_disclosure", revoked_at: null });
    expect((await me.consents("cpl-demo-02")).some((c) => c.consent_id === granted.consent_id)).toBe(true);
    const revoked = await me.revokeConsent(granted.consent_id);
    expect(revoked.revoked_at).not.toBeNull();

    const audit = await as("counsellor").audit("cpl-demo-02");
    expect(audit.length).toBeGreaterThan(0);
    expect(audit.every((e) => e.event_id.startsWith("audit-") && e.detail.length > 0)).toBe(true);
    expect((await as("judge").verifyAudit()).ok).toBe(true);
  });

  it("submits the patient closure and the teach-back, from the schema the adapter published", async () => {
    const me = as("cpl-demo-02-a");
    const schema = await me.closureSchema("en");
    const answers: Record<string, string> = {};
    for (const item of schema.patient_items) {
      if (item.kind === "integer_0_100") answers[item.id] = "25";
      else if (item.kind === "agree_1_5") answers[item.id] = "4";
      else if (item.kind === "true_false_unsure") answers[item.id] = "false";
      else if (item.kind === "single_choice") answers[item.id] = item.choices[0]?.id ?? "";
      else answers[item.id] = "In our own words";
    }
    const record = await me.submitPatientClosure("cpl-demo-02", { person_id: "prs-02a", answers, service_interest: "yes_later", topics: [schema.service_interest.topics[0]?.id ?? ""] });
    expect(record).toMatchObject({ couple_id: "cpl-demo-02", kind: "patient", simulated: true });

    const quiz = await me.teachback("cpl-demo-02", "en");
    expect(quiz.questions.length).toBeGreaterThan(0);
    const given = Object.fromEntries(quiz.questions.map((q) => [q.id, q.choices[0]?.id ?? ""]));
    const result = await me.submitTeachback("cpl-demo-02", given, "en");
    expect(result).toMatchObject({ couple_id: "cpl-demo-02", total: quiz.questions.length });
    expect(result.items).toHaveLength(quiz.questions.length);
  });

  it("serves the clinician: haematology aid and the clinician proforma, and explains a failed proforma by UI field", async () => {
    const clinician = as("clinician");
    const aid = await clinician.haemInterpret(
      { sex: "female", hb_g_dl: 11.2, mcv_fl: 68, mch_pg: 21, rbc_10e12_l: 4.1, ferritin_ug_l: null, age_years: 28, ferritin_status: "not_low", pregnant: false, transfused_last_4_months: false },
      null,
    );
    expect(aid.label).toBe("indices_reduced");
    // Without the transfusion answer the aid reports cbc_incomplete (rule V03), so the form must collect it.
    expect(aid.needs_clinician_signoff).toBe(true);

    const schema = await clinician.closureSchema("en");
    expect(schema.proforma_fields.some((f) => f.id === "encounter_mode")).toBe(true);
    const answers: ClinicianProformaInput["answers"] = {
      encounter_mode: "in_person",
      encounter_duration_minutes: "30",
      encounter_language: "en",
      encounter_interpreter: "no",
      findings_discussed: ["shared_result_discussed", "explained_as_chance"],
      information_given: ["carrier_vs_disease", "couple_numbers"],
      next_step_status: "decided",
      teach_back: "accurate",
      patient_questions_invited: "yes",
      patient_questions_answered: "yes",
      plan: [JSON.stringify({ action: "referral", owner: "counsellor", due: "2026-12-01" })],
      patient_copy_given: "yes",
    };
    expect(await clinician.submitProforma("cpl-demo-02", { answers })).toMatchObject({ kind: "clinician", simulated: true });

    const failure = await clinician.submitProforma("cpl-demo-02", { answers: { teach_back: "accurate" } }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    const problem = (failure as ApiError).problem;
    expect(problem.status).toBe(422);
    expect(problem.correlation_id).toBeTruthy();
    expect(problem.errors?.map((e) => e.field)).toEqual(expect.arrayContaining(["answers.encounter_mode", "answers.information_given", "answers.next_step_status"]));
  });

  it("releases a withheld joint result once the partner consents (cpl-demo-04, Dubai policy)", async () => {
    const owner = as("cpl-demo-04-a");
    // Start from "not consented", whatever an earlier run left behind: revoke any live consent from A to B.
    for (const record of await owner.consents("cpl-demo-04")) {
      if (record.subject_person_id === "prs-04a" && record.revoked_at === null) await owner.revokeConsent(record.consent_id);
    }
    const before = await as("cpl-demo-04-b").result("cpl-demo-04", "en");
    expect(before.disclosed).toMatchObject({ category: null, withheld_reason_key: "awaiting_partner_consent" });

    await owner.grantConsent("cpl-demo-04", {
      subject_person_id: "prs-04a",
      recipient_role: "prs-04b",
      scope: "couple_result_only",
      purpose: "partner_disclosure",
      expires_at: null,
    });
    const after = await as("cpl-demo-04-b").result("cpl-demo-04", "en");
    expect(after.disclosed.category).toBe("shared_result_found");
    expect(after.disclosed.withheld_reason_key).toBeNull();
  });

  it("reduces the audit verification for a couple member and gives staff the whole chain", async () => {
    const member = await as("cpl-demo-02-a").verifyAudit();
    expect(member).toMatchObject({ ok: true, scope: "own_couple", length: null, head_hash: null });
    expect(member.own_events).toBeGreaterThan(0);
    const staff = await as("judge").verifyAudit();
    expect(staff).toMatchObject({ ok: true, scope: "chain" });
    expect(staff.length).toBeGreaterThan(0);
    expect(staff.head_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("serves staff, programme and judge views", async () => {
    const counsellor = as("counsellor");
    const queue = await counsellor.escalations();
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.every((item) => item.decisions.length > 0 && item.couple_label !== "")).toBe(true);

    const brief = await counsellor.brief("cpl-demo-09");
    expect(brief).toMatchObject({ couple_id: "cpl-demo-09", review_priority: "urgent", category: "shared_result_found" });
    expect(brief.escalations.map((e) => e.rule_id)).toContain("pregnancy_in_progress");
    expect(brief.referral_tasks.length).toBeGreaterThan(0);

    const kpis = await as("programme").kpis();
    expect(kpis.cases_total).toBeGreaterThanOrEqual(10);
    expect(kpis.synthetic).toBe(true);

    const board = await as("judge").scoreboard();
    expect(board.metrics.some((m) => m.status === "measured")).toBe(true);
  });

  it("refuses a third-party request with a 403 that keeps its correlation id and legal basis", async () => {
    const failure = await as("cpl-demo-01-a").thirdPartyRequest("cpl-demo-01", "employer").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    const error = failure as ApiError;
    expect(error.status).toBe(403);
    expect(error.correlationId).toBeTruthy();
    expect(error.problem.detail).toContain("Art. 19");
  });

  it("advances a new case through the pathway, including result_communicated", async () => {
    const coupleId = `cpl-live-${Date.now().toString(36)}`;
    const clinicianToken = token("clinician");
    await raw(
      {
        method: "POST",
        path: "/v1/couples",
        body: {
          couple_id: coupleId,
          relationship: "unrelated",
          emirate_policy: "abu_dhabi",
          members: [
            { person_id: `${coupleId}-a`, display_name: "Live Alpha", sex: "female", age: 27, language: "en", family_history: ["none_declared"] },
            { person_id: `${coupleId}-b`, display_name: "Live Beta", sex: "male", age: 30, language: "en", family_history: ["none_declared"] },
          ],
        },
      },
      clinicianToken,
    );
    await raw({ method: "POST", path: `/v1/couples/${coupleId}/assignments`, body: { staff_subject_id: "stf-clinician-01" } }, token("programme"));
    const carrier = { gene: "USH2A", condition_id: "usher_syndrome_type_2a", zygosity: "carrier", inheritance: "AR", classification: "pathogenic", variant_label: null };
    await raw(
      {
        method: "PUT",
        path: `/v1/couples/${coupleId}/reports`,
        body: {
          reports: [
            { person_id: `${coupleId}-a`, sex: "female", panel_id: "uae_demo_panel_v1", findings: [carrier] },
            { person_id: `${coupleId}-b`, sex: "male", panel_id: "uae_demo_panel_v1", findings: [carrier] },
          ],
        },
      },
      clinicianToken,
    );

    const clinician = as("clinician");
    for (const event of ["consult_completed", "sample_collected", "lab_started", "joint_report_ready"]) {
      const view = await clinician.advancePathway(coupleId, event);
      expect(view.couple_id).toBe(coupleId);
    }
    const afterReport = await clinician.pathway(coupleId);
    expect(afterReport.next_action?.event).toBe("result_communicated");

    const communicated = await clinician.advancePathway(coupleId, "result_communicated");
    expect(communicated.states.find((s) => s.key === "counselling")?.status).toBe("current");
    expect(communicated.next_action?.event).toBe("counselling_booked");
  });

  it("resets the demo (the backend rate-limits this, so a 409 is also a valid answer)", async () => {
    const outcome = await as("judge").resetDemo().catch((error: unknown) => error);
    if (outcome instanceof ApiError) expect(outcome.status).toBe(409);
    else expect(outcome).toEqual({ ok: true });
  });
});
