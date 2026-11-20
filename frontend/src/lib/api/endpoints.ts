import type { Transport } from "./transport";
import type {
  AuditEvent,
  AuditVerification,
  CbcInput,
  ClinicianProformaInput,
  ClosureRecord,
  ClosureSchema,
  ConsentGrantInput,
  ConsentRecord,
  CoupleCase,
  CounsellorBrief,
  EscalationItem,
  ExplainerDoc,
  GlossaryEntry,
  HaemInterpretation,
  HplcInput,
  Locale,
  PatientClosureInput,
  PathwayView,
  Persona,
  ProgrammeKpis,
  ReferralTask,
  ResultEnvelope,
  RntkStatus,
  Scoreboard,
  TeachBackQuiz,
  TeachBackResult,
} from "./types";

/**
 * The one adapter. Every screen talks to the backend only through these functions; the transport decides
 * whether that means fixtures, the same-origin /api/v1 proxy (browser) or the backend directly (server).
 */
export function createApi(send: Transport) {
  return {
    personas: async (): Promise<Persona[]> => {
      const raw = await send<Persona[] | { personas: Persona[] }>({ method: "GET", path: "/v1/demo/personas" });
      return Array.isArray(raw) ? raw : raw.personas;
    },
    resetDemo: () => send<{ ok: boolean }>({ method: "POST", path: "/v1/demo/reset" }),

    couple: (coupleId: string) => send<CoupleCase>({ method: "GET", path: `/v1/couples/${coupleId}` }),
    pathway: (coupleId: string) => send<PathwayView>({ method: "GET", path: `/v1/couples/${coupleId}/pathway` }),
    advancePathway: (coupleId: string, event: string) =>
      send<PathwayView>({ method: "POST", path: `/v1/couples/${coupleId}/pathway/events`, body: { event } }),
    referrals: (coupleId: string) => send<ReferralTask[]>({ method: "GET", path: `/v1/couples/${coupleId}/referrals` }),

    result: (coupleId: string, locale: Locale) =>
      send<ResultEnvelope>({ method: "GET", path: `/v1/couples/${coupleId}/result`, query: { locale } }),
    options: (locale: Locale) => send<ExplainerDoc>({ method: "GET", path: "/v1/explain/options", query: { locale } }),
    glossary: (locale: Locale) =>
      send<GlossaryEntry[]>({ method: "GET", path: "/v1/explain/glossary", query: { locale } }),

    consents: (coupleId: string) => send<ConsentRecord[]>({ method: "GET", path: `/v1/couples/${coupleId}/consents` }),
    grantConsent: (coupleId: string, input: ConsentGrantInput) =>
      send<ConsentRecord>({ method: "POST", path: `/v1/couples/${coupleId}/consents`, body: input }),
    revokeConsent: (consentId: string) =>
      send<ConsentRecord>({ method: "POST", path: `/v1/consents/${consentId}/revoke` }),
    /** Declares the viewer's right not to know (writes one audit row); the next result read is withheld. */
    declareRightNotToKnow: (coupleId: string) =>
      send<RntkStatus>({ method: "PUT", path: `/v1/couples/${coupleId}/right-not-to-know` }),
    /** Withdraws it (writes one audit row); the next result read discloses again. */
    withdrawRightNotToKnow: (coupleId: string) =>
      send<RntkStatus>({ method: "DELETE", path: `/v1/couples/${coupleId}/right-not-to-know` }),
    audit: (coupleId: string) => send<AuditEvent[]>({ method: "GET", path: `/v1/couples/${coupleId}/audit` }),
    verifyAudit: () => send<AuditVerification>({ method: "GET", path: "/v1/audit/verify" }),
    thirdPartyRequest: (coupleId: string, kind: string) =>
      send<never>({ method: "POST", path: "/v1/third-party-requests", body: { couple_id: coupleId, kind } }),

    escalations: () => send<EscalationItem[]>({ method: "GET", path: "/v1/escalations" }),
    /** `locale` is optional and additive: the real brief composes its sections in that language. */
    brief: (coupleId: string, locale?: Locale) =>
      send<CounsellorBrief>(
        locale === undefined
          ? { method: "GET", path: `/v1/couples/${coupleId}/brief` }
          : { method: "GET", path: `/v1/couples/${coupleId}/brief`, query: { locale } },
      ),

    haemInterpret: (cbc: CbcInput, hplc: HplcInput | null) =>
      send<HaemInterpretation>({ method: "POST", path: "/v1/haem/interpret", body: { cbc, hplc } }),

    closureSchema: (locale: Locale) =>
      send<ClosureSchema>({ method: "GET", path: "/v1/closure/schema", query: { locale } }),
    submitPatientClosure: (coupleId: string, input: PatientClosureInput) =>
      send<ClosureRecord>({ method: "POST", path: `/v1/couples/${coupleId}/closure/patient`, body: input }),
    submitProforma: (coupleId: string, input: ClinicianProformaInput) =>
      send<ClosureRecord>({ method: "POST", path: `/v1/couples/${coupleId}/closure/clinician`, body: input }),
    teachback: (coupleId: string, locale: Locale) =>
      send<TeachBackQuiz>({ method: "GET", path: `/v1/couples/${coupleId}/teachback`, query: { locale } }),
    /** `locale` is optional and additive: the real backend explains each answer in the submission's language. */
    submitTeachback: (coupleId: string, answers: Record<string, string>, locale?: Locale) =>
      send<TeachBackResult>({
        method: "POST",
        path: `/v1/couples/${coupleId}/teachback`,
        body: locale === undefined ? { answers } : { answers, locale },
      }),

    kpis: () => send<ProgrammeKpis>({ method: "GET", path: "/v1/programme/kpis" }),
    scoreboard: () => send<Scoreboard>({ method: "GET", path: "/v1/eval/scoreboard" }),
  };
}

export type Api = ReturnType<typeof createApi>;
