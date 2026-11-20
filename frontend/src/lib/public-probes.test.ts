import { describe, expect, it } from "vitest";
import {
  MAX_FREE_TEXT,
  ProbeError,
  planProbe,
  previewProbe,
  resolveScope,
  runProbe,
  summariseResponse,
  type AuditRowView,
  type PersonaLike,
  type ProbeDeps,
  type ProbeRequest,
  type RawReply,
} from "./public-probes";

const PERSONAS: PersonaLike[] = [
  { id: "judge", display_name: "Evaluator (synthetic)", role: "judge", couple_id: null },
  { id: "counsellor", display_name: "Counsellor (synthetic)", role: "counsellor", couple_id: null },
  { id: "clinician", display_name: "Clinician (synthetic)", role: "clinician", couple_id: null },
  { id: "cpl-demo-01-a", display_name: "Salma (synthetic)", role: "couple_member", couple_id: "cpl-demo-01" },
  { id: "cpl-demo-02-a", display_name: "Layla (synthetic)", role: "couple_member", couple_id: "cpl-demo-02" },
  { id: "cpl-demo-05-a", display_name: "Basma (synthetic)", role: "couple_member", couple_id: "cpl-demo-05" },
];

function row(index: number, action = "third_party_request_refused"): AuditRowView {
  return { index, at: "2026-11-20T10:00:00Z", actor: "external", action, detail: "refused: third_party:employer", prevHash: "a".repeat(64), hash: `${index}`.padStart(64, "b") };
}

interface Fake {
  deps: ProbeDeps;
  sent: { persona: string; request: ProbeRequest }[];
}

/** A backend double with a real audit log: sending a "writing" request appends a row, as the real endpoint does. */
function fake(options: {
  reply: (request: ProbeRequest) => Omit<RawReply, "ms">;
  writes: (request: ProbeRequest) => string | null;
  auditFails?: boolean;
  startingRows?: AuditRowView[];
}): Fake {
  const log = new Map<string, AuditRowView[]>([["cpl-demo-02", options.startingRows ?? [row(0, "result_released")]]]);
  const sent: Fake["sent"] = [];
  let chain = 1;
  const deps: ProbeDeps = {
    personas: PERSONAS,
    async send(persona, request) {
      sent.push({ persona, request });
      const couple = options.writes(request);
      if (couple !== null) {
        const rows = log.get(couple) ?? [];
        rows.push(row(chain));
        log.set(couple, rows);
        chain += 1;
      }
      return { ...options.reply(request), ms: 3, wire: request };
    },
    async readAudit(coupleId) {
      if (options.auditFails) throw new Error("The audit log answered 500.");
      return [...(log.get(coupleId) ?? [])];
    },
    async verify() {
      return { ok: true, length: chain, firstBadIndex: null };
    },
  };
  return { deps, sent };
}

const employerProblem = {
  status: 403,
  correlationId: "corr-1",
  body: {
    title: "Forbidden",
    status: 403,
    detail: "Refused. Under Federal Decree-Law 49/2023 Art. 19 to 21, employers and insurers may not require genetic screening.",
    code: "forbidden",
    reason: "third_party:employer",
    legal_basis: "Federal Decree-Law 49/2023 Art. 19 to 21",
    correlation_id: "corr-1",
  },
};

describe("resolveScope", () => {
  it("uses case 2 for the member probes and case 5 as the other couple, from the persona list itself", () => {
    const scope = resolveScope(PERSONAS);
    expect(scope.coupleId).toBe("cpl-demo-02");
    expect(scope.otherCoupleId).toBe("cpl-demo-05");
    expect(scope.memberPersona.id).toBe("cpl-demo-02-a");
  });

  it("falls back to whatever couples exist, and refuses to run with no couple member", () => {
    const only = PERSONAS.filter((p) => p.role !== "couple_member" || p.couple_id === "cpl-demo-01");
    expect(resolveScope(only).otherCoupleId).toBeNull();
    expect(() => resolveScope(PERSONAS.filter((p) => p.role !== "couple_member"))).toThrow(ProbeError);
  });
});

describe("planProbe", () => {
  const scope = resolveScope(PERSONAS);

  it("asks as the right actor for each of the seven probes", () => {
    expect(planProbe("employer", scope, {}).steps[0]?.request).toEqual({ method: "POST", path: "/v1/third-party-requests", body: { couple_id: "cpl-demo-02", kind: "employer" } });
    expect(planProbe("insurer", scope, {}).steps[0]?.request.body).toMatchObject({ kind: "insurer" });
    expect(planProbe("marriage", scope, {}).steps[0]?.request.path).toBe("/v1/refusals/classify");
    const distress = planProbe("distress", scope, {});
    expect(distress.steps.map((s) => [s.actor, s.request.path])).toEqual([
      ["judge", "/v1/refusals/classify"],
      ["counsellor", "/v1/couples/cpl-demo-02/escalations/evaluate"],
    ]);
    const cross = planProbe("cross", scope, {});
    expect(cross.steps[0]).toMatchObject({ actor: "member", request: { method: "GET", path: "/v1/couples/cpl-demo-05/result" } });
    expect(cross.auditCoupleId).toBe("cpl-demo-05");
    expect(planProbe("haem", scope, {}).steps[0]).toMatchObject({ actor: "clinician", request: { path: "/v1/haem/interpret" } });
  });

  it("sends the visitor's own words with the chosen locale, and rejects empty or oversized text", () => {
    const plan = planProbe("words", scope, { text: "  Is it safe to marry my cousin?  ", locale: "ar" });
    expect(plan.steps[0]?.request.body).toEqual({ text: "Is it safe to marry my cousin?", locale: "ar", couple_id: null });
    expect(() => planProbe("words", scope, { text: "   " })).toThrow(ProbeError);
    expect(() => planProbe("words", scope, { text: "x".repeat(MAX_FREE_TEXT + 1) })).toThrow(ProbeError);
    expect(planProbe("words", scope, { text: "hello", locale: "fr" }).steps[0]?.request.body).toMatchObject({ locale: "en" });
  });

  it("cannot open 'another couple' when only one couple exists", () => {
    const lone = resolveScope(PERSONAS.filter((p) => p.role !== "couple_member" || p.couple_id === "cpl-demo-02"));
    expect(() => planProbe("cross", lone, {})).toThrow(ProbeError);
  });
});

describe("summariseResponse", () => {
  it("shows a refusal's status, code, reason, legal basis and the detail verbatim", () => {
    const facts = summariseResponse({ method: "POST", path: "/v1/third-party-requests" }, 403, employerProblem.body, "hdr-1");
    expect(facts.verdict).toBe("refused");
    expect(facts.text).toBe(employerProblem.body.detail);
    expect(Object.fromEntries(facts.facts.map((f) => [f.key, f.value]))).toMatchObject({ status: "403", code: "forbidden", reason: "third_party:employer", correlation_id: "corr-1" });
  });

  it("reads a classifier refusal and a classifier miss", () => {
    const refused = summariseResponse(
      { method: "POST", path: "/v1/refusals/classify" },
      200,
      { refuse: true, category: "marriage_decision", matched_rule_ids: ["en.mar.1", "en.mar.2"], message: "Rishta Safe does not advise on whether to marry.", method: "keyword_and_pattern_matching_not_language_understanding", escalate: true },
      null,
    );
    expect(refused.verdict).toBe("refused");
    expect(refused.text).toBe("Rishta Safe does not advise on whether to marry.");
    expect(refused.facts).toContainEqual({ key: "matched_rule_ids", value: "en.mar.1, en.mar.2" });

    const missed = summariseResponse({ method: "POST", path: "/v1/refusals/classify" }, 200, { refuse: false, category: null, method: "keyword_and_pattern_matching_not_language_understanding" }, null);
    expect(missed.verdict).toBe("notRefused");
    expect(missed.text).toBeNull();
  });

  it("lists escalation decisions, and says honestly when none is raised", () => {
    const body = { decisions: [{ trigger_id: "user_distress", tier: "counsellor", due_by_hint: "same_session" }], notice: "A human decides what happens next." };
    const raised = summariseResponse({ method: "POST", path: "/v1/couples/cpl-demo-02/escalations/evaluate" }, 200, body, null);
    expect(raised.verdict).toBe("raised");
    expect(raised.facts).toContainEqual({ key: "decision", value: "user_distress · counsellor · same_session" });
    expect(raised.text).toBe("A human decides what happens next.");
    expect(summariseResponse({ method: "POST", path: "/v1/couples/x/escalations/evaluate" }, 200, { decisions: [] }, null).verdict).toBe("noneRaised");
  });

  it("keeps the haematology aid's own never-a-diagnosis sentence and its sign-off flag", () => {
    const facts = summariseResponse(
      { method: "POST", path: "/v1/haem/interpret" },
      200,
      { label: "cbc_incomplete", matched_rule_id: "V01", trace: [{ rule_id: "V01" }], needs_clinician_signoff: true, not_a_diagnosis: "This is a screening-support pattern for a clinician. It is not a diagnosis." },
      null,
    );
    expect(facts.verdict).toBe("answered");
    expect(facts.text).toMatch(/not a diagnosis/);
    expect(facts.facts).toContainEqual({ key: "needs_clinician_signoff", value: "true" });
  });
});

describe("runProbe", () => {
  it("a refused third-party request writes an audit row, and the delta is computed from two reads", async () => {
    const { deps, sent } = fake({ reply: () => employerProblem, writes: (r) => (r.path === "/v1/third-party-requests" ? "cpl-demo-02" : null) });
    const run = await runProbe(deps, "employer", {});

    expect(sent).toHaveLength(1);
    expect(sent[0]?.persona).toBe("judge");
    expect(run.steps[0]?.status).toBe(403);
    expect(run.steps[0]?.facts.verdict).toBe("refused");
    expect(run.audit.state).toBe("rows");
    if (run.audit.state === "rows") {
      expect(run.audit.before).toBe(1);
      expect(run.audit.after).toBe(2);
      expect(run.audit.rows.map((r) => r.index)).toEqual([1]);
    }
    expect(run.chain).toEqual({ before: 1, after: 2 });
    expect(run.verify?.ok).toBe(true);
  });

  it("running it twice writes a new row each time (never the same one twice)", async () => {
    const { deps } = fake({ reply: () => employerProblem, writes: () => "cpl-demo-02" });
    const first = await runProbe(deps, "employer", {});
    const second = await runProbe(deps, "employer", {});
    const indexes = [first, second].flatMap((r) => (r.audit.state === "rows" ? r.audit.rows.map((x) => x.index) : []));
    expect(indexes).toEqual([1, 2]);
  });

  it("a probe that writes nothing says so: no rows, an unchanged chain", async () => {
    const { deps } = fake({
      reply: () => ({ status: 200, correlationId: null, body: { refuse: true, category: "marriage_decision", message: "Rishta Safe does not advise on whether to marry.", matched_rule_ids: ["en.mar.1"], method: "keyword" } }),
      writes: () => null,
    });
    const run = await runProbe(deps, "marriage", {});
    expect(run.steps[0]?.facts.verdict).toBe("refused");
    expect(run.audit.state).toBe("none");
    expect(run.audit.coupleId).toBeNull();
    expect(run.chain.before).toBe(run.chain.after);
  });

  it("a cross-couple request that is refused before any record is read leaves the other couple's log untouched", async () => {
    const { deps, sent } = fake({
      reply: () => ({ status: 403, correlationId: "corr-2", body: { title: "Forbidden", status: 403, detail: "This record belongs to another couple.", code: "forbidden" } }),
      writes: () => null,
    });
    const run = await runProbe(deps, "cross", {});
    expect(sent[0]?.persona).toBe("cpl-demo-02-a");
    expect(sent[0]?.request.path).toBe("/v1/couples/cpl-demo-05/result");
    expect(run.steps[0]?.facts.text).toBe("This record belongs to another couple.");
    expect(run.audit).toMatchObject({ state: "none", coupleId: "cpl-demo-05" });
  });

  it("the distress probe sends two requests as two personas, in order", async () => {
    const { deps, sent } = fake({
      reply: (r) => (r.path.endsWith("/evaluate") ? { status: 200, correlationId: null, body: { decisions: [{ trigger_id: "user_distress", tier: "counsellor", due_by_hint: "same_session" }], notice: "n" } } : { status: 200, correlationId: null, body: { refuse: false, method: "keyword" } }),
      writes: () => null,
    });
    const run = await runProbe(deps, "distress", {});
    expect(sent.map((s) => s.persona)).toEqual(["judge", "counsellor"]);
    expect(run.steps.map((s) => s.facts.verdict)).toEqual(["notRefused", "raised"]);
  });

  it("reports 'audit not read' when the log cannot be read, instead of faking a delta", async () => {
    const { deps } = fake({ reply: () => employerProblem, writes: () => "cpl-demo-02", auditFails: true });
    const run = await runProbe(deps, "employer", {});
    expect(run.steps[0]?.status).toBe(403);
    expect(run.audit).toMatchObject({ state: "unread", message: "The audit log answered 500." });
  });

  it("surfaces a transport failure as a step with status 0, not as a thrown error", async () => {
    const { deps } = fake({ reply: () => ({ status: 0, correlationId: null, body: { title: "The service could not be reached", detail: "No response came back." } }), writes: () => null });
    const run = await runProbe(deps, "haem", {});
    expect(run.steps[0]?.status).toBe(0);
    expect(run.steps[0]?.facts.verdict).toBe("error");
    expect(run.steps[0]?.facts.text).toBe("No response came back.");
  });
});

describe("previewProbe (the request shown before anything is sent)", () => {
  it("names the acting persona, the endpoint and the body for each probe, from the persona list alone", () => {
    const employer = previewProbe("employer", PERSONAS, {});
    expect(employer).toHaveLength(1);
    expect(employer?.[0]).toMatchObject({ actor: { id: "judge", displayName: "Evaluator (synthetic)" }, request: { method: "POST", path: "/v1/third-party-requests" } });
    const distress = previewProbe("distress", PERSONAS, {});
    expect(distress?.map((step) => step.actor.id)).toEqual(["judge", "counsellor"]);
    expect(previewProbe("cross", PERSONAS, {})?.[0]?.actor.id).toBe("cpl-demo-02-a");
  });

  it("previews the free-text probe with an empty sentence instead of failing, and returns null without the needed personas", () => {
    const words = previewProbe("words", PERSONAS, { text: "", locale: "ar" });
    expect(words?.[0]?.request.body).toMatchObject({ text: "" });
    expect(previewProbe("employer", [], {})).toBeNull();
  });

  it("matches what the runner sends (same plan, no second source of truth)", () => {
    const planned = planProbe("marriage", resolveScope(PERSONAS), {});
    expect(previewProbe("marriage", PERSONAS, {})?.[0]?.request).toEqual(planned.steps[0]?.request);
  });
});
