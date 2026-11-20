// Captures small, synthetic payloads from a RUNNING real backend into src/lib/api/real/__fixtures__/.
//
//   cd ../backend && uv run python -m uvicorn "bayan.api.app:create_app" --factory --port 8000
//   BAYAN_API_URL=http://127.0.0.1:8000 node scripts/capture-real-fixtures.mjs
//
// The backend seeds ten synthetic couples; nothing here is real data. Bearer tokens are replaced by a placeholder so no
// credential-shaped string is committed. Long documents are cut to a few blocks: the adapter tests assert the mapping,
// not the text. The write calls (consent, closure, pathway, communicate) change the demo state of the running backend,
// so run this against a throwaway instance.
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const BASE = (process.env.BAYAN_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
const OUT = fileURLToPath(new URL("../src/lib/api/real/__fixtures__/", import.meta.url));

const personas = await (await fetch(`${BASE}/v1/demo/personas`)).json();
const token = (id) => {
  const persona = personas.find((p) => p.id === id);
  if (!persona) throw new Error(`no persona ${id}`);
  return persona.token.access_token;
};

async function call(method, path, who, body) {
  const headers = { Accept: "application/json" };
  if (who) headers.Authorization = `Bearer ${token(who)}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

const saved = [];
async function save(name, value) {
  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}${name}.json`, `${JSON.stringify(value, null, 2)}\n`);
  saved.push(name);
}

async function ok(method, path, who, body) {
  const result = await call(method, path, who, body);
  if (result.status < 200 || result.status >= 300) throw new Error(`${method} ${path} as ${who}: ${result.status} ${JSON.stringify(result.body).slice(0, 300)}`);
  return result.body;
}

const cut = (doc, blocks) => ({ ...doc, blocks: doc.blocks.slice(0, blocks), template_ids: doc.template_ids.slice(0, blocks) });
const withIconArray = (doc) => ({
  ...doc,
  blocks: [...doc.blocks.slice(0, 3), ...doc.blocks.filter((b) => b.kind === "icon_array").slice(0, 1)],
});

// demo -----------------------------------------------------------------------------------------------------------
const wanted = ["clinician", "counsellor", "programme", "judge", "cpl-demo-02-a", "cpl-demo-04-b"];
await save(
  "personas",
  personas
    .filter((p) => wanted.includes(p.id))
    .map((p) => ({ ...p, token: { ...p.token, access_token: `demo-token-${p.id}` } })),
);

// cases and pathway -------------------------------------------------------------------------------------------------
await save("couple_02", await ok("GET", "/v1/couples/cpl-demo-02", "cpl-demo-02-a"));
await save("pathway_05", await ok("GET", "/v1/couples/cpl-demo-05/pathway", "cpl-demo-05-a"));
await save("pathway_01", await ok("GET", "/v1/couples/cpl-demo-01/pathway", "cpl-demo-01-a"));
await save("pathway_event_05", await ok("POST", "/v1/couples/cpl-demo-05/pathway/events", "cpl-demo-05-a", { kind: "counselling_booked" }));
await save("referrals_05", await ok("GET", "/v1/couples/cpl-demo-05/referrals", "cpl-demo-05-a"));

// results ---------------------------------------------------------------------------------------------------------------
const shared = await ok("GET", "/v1/couples/cpl-demo-02/result?locale=en", "cpl-demo-02-a");
await save("result_02a", { ...shared, document: withIconArray(shared.document) });
// the landing hero and the locale switch use the full Arabic and Urdu documents, recorded as the released couple member
await save("result_02a_ar", await ok("GET", "/v1/couples/cpl-demo-02/result?locale=ar", "cpl-demo-02-a"));
await save("result_02a_ur", await ok("GET", "/v1/couples/cpl-demo-02/result?locale=ur", "cpl-demo-02-a"));
const withheld = await ok("GET", "/v1/couples/cpl-demo-04/result?locale=en", "cpl-demo-04-b");
await save("result_04b_withheld", { ...withheld, document: cut(withheld.document, 3) });
const staff = await ok("GET", "/v1/couples/cpl-demo-02/result?locale=en", "counsellor");
await save("result_02_staff", { ...staff, document: cut(staff.document, 2) });
await save("explain_options", cut(await ok("GET", "/v1/explain/options?locale=en", "judge"), 3));
await save("explain_glossary", (await ok("GET", "/v1/explain/glossary?locale=en", "judge")).slice(0, 3));

// consent and audit -----------------------------------------------------------------------------------------------------
const granted = await ok("POST", "/v1/couples/cpl-demo-02/consents", "cpl-demo-02-a", {
  recipient: "prs-02b",
  scope: "couple_result_only",
  purpose: "partner_disclosure",
  expires_at: null,
});
await save("consent_granted", granted);
await save("consents_02a", await ok("GET", "/v1/couples/cpl-demo-02/consents", "cpl-demo-02-a"));
await save("consent_revoked", await ok("POST", `/v1/consents/${granted.consent_id}/revoke`, "cpl-demo-02-a"));
const audit = await ok("GET", "/v1/couples/cpl-demo-02/audit", "counsellor");
await save("audit_02", { ...audit, events: audit.events.slice(0, 5) });
await save("audit_verify", await ok("GET", "/v1/audit/verify", "judge"));

// third party and failures ----------------------------------------------------------------------------------------------
await save("problem_third_party", (await call("POST", "/v1/third-party-requests", "cpl-demo-01-a", { couple_id: "cpl-demo-01", kind: "employer" })).body);
await save("problem_forbidden", (await call("GET", "/v1/couples/cpl-demo-03/result", "cpl-demo-02-a")).body);
await save("problem_unauthenticated", (await call("GET", "/v1/couples/cpl-demo-03/result", null)).body);
await save("problem_validation_haem", (await call("POST", "/v1/haem/interpret", "clinician", { cbc: { sex: "F", hb_g_per_l: 5000 } })).body);
await save("problem_validation_proforma", (await call("POST", "/v1/couples/cpl-demo-02/closure/clinician", "clinician", { encounter: { mode: "in_person", duration_minutes: 0, session_language: "en", interpreter_used: false } })).body);

// escalation and brief ----------------------------------------------------------------------------------------------------
const queue = await ok("GET", "/v1/escalations", "counsellor");
await save("escalations", { records: queue.records.slice(0, 3) });
const brief = await ok("GET", "/v1/couples/cpl-demo-09/brief?locale=en", "counsellor");
await save("brief_09", { ...brief, document: cut(brief.document, 1), pathway: { ...brief.pathway, steps: brief.pathway.steps.slice(0, 2) } });

// haematology -----------------------------------------------------------------------------------------------------------------
await save("haem_incomplete", await ok("POST", "/v1/haem/interpret", "clinician", { cbc: { sex: "F", hb_g_per_l: 110, mcv_fl: 68, mch_pg: 21 } }));
await save(
  "haem_pattern",
  await ok("POST", "/v1/haem/interpret", "clinician", {
    cbc: { sex: "F", age_years: 28, hb_g_per_l: 112, mcv_fl: 68, mch_pg: 21, ferritin_status: "not_low", pregnant: false, transfused_last_4_months: false },
  }),
);

// closure and teach-back --------------------------------------------------------------------------------------------------------
await save("closure_schema_en", await ok("GET", "/v1/closure/schema?locale=en", "cpl-demo-02-a"));
await save(
  "closure_patient_record",
  await ok("POST", "/v1/couples/cpl-demo-02/closure/patient", "cpl-demo-02-a", {
    person_id: "prs-02a",
    answers: { out_of_100: 25, carrier_is_disease: "false", next_step: "counsellor_explains", values_clarity: 4, service_interest: { value: "no_thanks", consent_acknowledged: false, consent_version: 1, topics: [] } },
  }),
);
await save(
  "closure_clinician_record",
  await ok("POST", "/v1/couples/cpl-demo-02/closure/clinician", "clinician", {
    encounter: { mode: "in_person", duration_minutes: 30, session_language: "en", interpreter_used: false },
    findings_discussed: [{ finding_ref: "couple_result", explained_as_chance_not_diagnosis: true, flagged_uncertain: false }],
    information_given: { carrier_vs_disease: true, couple_numbers: true, test_limits: true, options_neutral_order: true, right_not_to_know: true, who_can_see_result: true, how_to_reach_us: true },
    next_step_status: "decided",
    teach_back_done: true,
    teach_back_result: "accurate",
    patient_questions_invited: true,
    patient_questions_answered: true,
    plan: [{ action: "referral", owner_role: "counsellor", due_date: "2026-12-01" }],
    patient_copy_given: true,
  }),
);
await save("teachback_quiz", await ok("GET", "/v1/couples/cpl-demo-02/teachback?locale=en", "cpl-demo-02-a"));
await save(
  "teachback_result",
  await ok("POST", "/v1/couples/cpl-demo-02/teachback", "cpl-demo-02-a", { locale: "en", answers: { sr1: "a", sr2: "false", sr3: "a", sr4: "a", sr5: "b" } }),
);

// programme and evaluation ------------------------------------------------------------------------------------------------------
await save("kpis", await ok("GET", "/v1/programme/kpis", "programme"));
const board = await ok("GET", "/v1/eval/scoreboard", "judge");
await save("scoreboard_full", board);
await save("scoreboard", { ...board, metrics: [board.metrics[0], board.metrics.find((m) => m.status === "not_run") ?? board.metrics[1]].filter(Boolean) });

// a new case walked to "report ready", then communicated (the route the UI's result_communicated button uses) ------------------------
const fresh = await ok("POST", "/v1/couples", "clinician", {
  couple_id: "cpl-fixture-01",
  relationship: "unrelated",
  emirate_policy: "abu_dhabi",
  members: [
    { person_id: "prs-fx-a", display_name: "Fixture Alpha", sex: "female", age: 27, language: "en", family_history: ["none_declared"] },
    { person_id: "prs-fx-b", display_name: "Fixture Beta", sex: "male", age: 30, language: "en", family_history: ["none_declared"] },
  ],
});
await ok("POST", `/v1/couples/${fresh.couple_id}/assignments`, "programme", { staff_subject_id: "stf-clinician-01" });
const carrier = { gene: "USH2A", condition_id: "usher_syndrome_type_2a", zygosity: "carrier", inheritance: "AR", classification: "pathogenic", variant_label: null };
await ok("PUT", `/v1/couples/${fresh.couple_id}/reports`, "clinician", {
  reports: [
    { person_id: "prs-fx-a", sex: "female", panel_id: "uae_demo_panel_v1", findings: [carrier] },
    { person_id: "prs-fx-b", sex: "male", panel_id: "uae_demo_panel_v1", findings: [carrier] },
  ],
});
for (const kind of ["consult_completed", "sample_collected", "lab_started", "joint_report_ready"]) {
  await ok("POST", `/v1/couples/${fresh.couple_id}/pathway/events`, "clinician", { kind });
}
await save("communicate_response", await ok("POST", `/v1/couples/${fresh.couple_id}/result/communicate`, "clinician", {}));

console.log(`saved ${saved.length} fixtures to ${OUT}`);
