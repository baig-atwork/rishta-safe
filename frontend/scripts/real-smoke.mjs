// Contract smoke test for the real backend. No dependencies; plain fetch.
//
//   BAYAN_API_URL=http://127.0.0.1:8000 node scripts/real-smoke.mjs
//
// Fetches the demo personas, then, as the persona cpl-demo-02-a, the result and the pathway, and checks the fields the
// anti-corruption layer (src/lib/api/real/adapter.ts) reads. Prints OK, or every mismatch, and exits 1 on a mismatch.
const BASE = (process.env.BAYAN_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");
const PERSONA = "cpl-demo-02-a";
const mismatches = [];

function expect(label, ok, actual) {
  if (!ok) mismatches.push(`${label} (got ${JSON.stringify(actual)})`);
}

async function getJson(path, token) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(8000),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // leave body null; the status check below reports it
  }
  return { status: response.status, body };
}

try {
  const personas = await getJson("/v1/demo/personas");
  expect("GET /v1/demo/personas answers 200", personas.status === 200, personas.status);
  const list = Array.isArray(personas.body) ? personas.body : [];
  const persona = list.find((p) => p.id === PERSONA);
  expect(`persona ${PERSONA} exists`, persona !== undefined, list.map((p) => p.id));
  const token = persona?.token?.access_token;
  expect("persona has token.access_token", typeof token === "string" && token.length > 0, typeof token);
  expect("persona has token.principal.subject_id", typeof persona?.token?.principal?.subject_id === "string", persona?.token?.principal);
  expect("persona has couple_id", persona?.couple_id === "cpl-demo-02", persona?.couple_id);

  if (typeof token === "string" && persona?.couple_id) {
    const coupleId = persona.couple_id;

    const result = await getJson(`/v1/couples/${coupleId}/result?locale=en`, token);
    expect("GET result?locale=en answers 200", result.status === 200, result.status);
    const disclosed = result.body?.disclosed;
    expect("result.disclosed.category is shared_result_found", disclosed?.category === "shared_result_found", disclosed?.category);
    expect("result.disclosed.viewer_person_id is the persona's subject", disclosed?.viewer_person_id === persona.token.principal.subject_id, disclosed?.viewer_person_id);
    expect("result.disclosed.shared is a non-empty list", Array.isArray(disclosed?.shared) && disclosed.shared.length > 0, disclosed?.shared);
    expect("result.document.blocks is a non-empty list", Array.isArray(result.body?.document?.blocks) && result.body.document.blocks.length > 0, result.body?.document?.blocks?.length);
    expect("result has no staff-only review_priority for a couple member", disclosed?.review_priority == null, disclosed?.review_priority);

    const pathway = await getJson(`/v1/couples/${coupleId}/pathway`, token);
    expect("GET pathway answers 200", pathway.status === 200, pathway.status);
    const steps = pathway.body?.steps;
    expect("pathway.steps lists the 12 real steps", Array.isArray(steps) && steps.length === 12, steps?.length);
    expect("every step has id, status and simulated", Array.isArray(steps) && steps.every((s) => s.id && s.status && typeof s.simulated === "boolean"), null);
    expect("pathway.next_actions is a list of {event, label, roles}", Array.isArray(pathway.body?.next_actions) && pathway.body.next_actions.every((a) => a.event && a.label && Array.isArray(a.roles)), pathway.body?.next_actions);
    expect("pathway.state is a string", typeof pathway.body?.state === "string", pathway.body?.state);

    const denied = await getJson("/v1/couples/cpl-demo-03/result", token);
    expect("another couple's result is refused with 403", denied.status === 403, denied.status);
    expect("the refusal carries a correlation_id", typeof denied.body?.correlation_id === "string", denied.body);
  }
} catch (error) {
  mismatches.push(`could not reach ${BASE}: ${error instanceof Error ? error.message : String(error)}`);
}

if (mismatches.length === 0) {
  console.log(`OK  ${BASE} (${PERSONA}: personas, result?locale=en, pathway)`);
} else {
  console.error(`MISMATCH  ${BASE}`);
  for (const line of mismatches) console.error(`  - ${line}`);
  process.exit(1);
}
