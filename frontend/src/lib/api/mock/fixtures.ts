/**
 * Seed data for the in-process mock backend. Pure and typed: no I/O, no clock reads, no randomness.
 *
 * Every export that holds mutable state returns a FRESH deep copy on each call, so the store in handler.ts can
 * be rebuilt (resetMock) without any shared reference surviving a reset.
 *
 * Status of everything in this file (spec section 2 rules 1 to 4, 7):
 *  - every person is SYNTHETIC (made-up given names, no surnames) and every adapter is SIMULATED;
 *  - result labels are only shared_result_found, no_shared_change_found, more_information_needed;
 *  - no clinical rule, rate or threshold is stated: rule text and sources are "illustrative fixture" and the
 *    clinical owner is "the clinical lead (sign-off pending)";
 *  - Arabic and Urdu are machine-drafted (language_status "draft"); English is a draft too, because nobody has
 *    reviewed it (spec section 2 rule 2: never claim a review that did not happen).
 */

import type {
  AuditEvent,
  Block,
  BlockKind,
  CheckSummary,
  ClosureChoice,
  ClosureSchema,
  ConsentRecord,
  CoupleCase,
  DetectionStatement,
  EscalationDecision,
  ExplainerDoc,
  Finding,
  GlossaryEntry,
  IconArraySpec,
  Locale,
  NextAction,
  NumberRef,
  OutcomeLine,
  PatientItem,
  PathwayState,
  PathwayStateKey,
  PathwayView,
  Persona,
  ProformaField,
  ReferralTask,
  ResultCategory,
  ReviewPriority,
  Role,
  Scoreboard,
  SharedCondition,
  SlaStatus,
  TeachBackQuestion,
  TeachBackQuiz,
} from "@/lib/api/types";

// ---------------------------------------------------------------------------------------------------------
// Clock and shared labels
// ---------------------------------------------------------------------------------------------------------

/** Registration time of the earliest seeded case. Every seeded timestamp is at or after this instant. */
export const FIXTURE_CLOCK = "2026-11-12T08:00:00Z";
/** The demo's "now" when the store is created. Each mutation then advances the mock clock by one minute. */
export const FIXTURE_NOW = "2026-12-05T08:00:00Z";

export const ILLUSTRATIVE_SOURCE_TITLE =
  "Illustrative fixture (rule text and sources are supplied by the backend in production)";
export const ESCALATION_SOURCE =
  "Illustrative fixture: rule text and sources are supplied by the backend in production";
export const MOCK_RULESET_VERSION = "mock-ruleset-0 (illustrative fixture)";
export const GENESIS_HASH = "0".repeat(64);

const HOUR_MS = 3_600_000;

/** ISO 8601 UTC without milliseconds. */
export function isoFromMs(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function addHours(isoTime: string, hours: number): string {
  return isoFromMs(Date.parse(isoTime) + hours * HOUR_MS);
}

type Tri = Readonly<Record<Locale, string>>;
type TriList = Readonly<Record<Locale, readonly string[]>>;

const tri = (en: string, ar: string, ur: string): Tri => ({ en, ar, ur });
const triList = (en: readonly string[], ar: readonly string[], ur: readonly string[]): TriList => ({ en, ar, ur });

export const LOCALES: readonly Locale[] = ["en", "ar", "ur"];

// ---------------------------------------------------------------------------------------------------------
// Personas (GET /v1/demo/personas). Tokens are demo tokens, simulated.
// ---------------------------------------------------------------------------------------------------------

export function makePersonas(): Persona[] {
  const member = (
    slug: string,
    name: string,
    coupleId: string,
    personId: string,
    description: string,
  ): Persona => ({
    id: `persona-${slug}`,
    display_name: name,
    role: "couple_member",
    couple_id: coupleId,
    person_id: personId,
    description,
    token: `demo-${slug}`,
    simulated: true,
  });
  const staff = (slug: string, name: string, role: Persona["role"], description: string): Persona => ({
    id: `persona-${slug}`,
    display_name: name,
    role,
    couple_id: null,
    person_id: null,
    description,
    token: `demo-${slug}`,
    simulated: true,
  });
  return [
    member(
      "amal",
      "Amal",
      "c-01",
      "p-01a",
      "A synthetic person in a first-cousin couple. The couple has a shared result and is at the counselling step.",
    ),
    member(
      "karim",
      "Karim",
      "c-01",
      "p-01b",
      "Amal's partner in the same synthetic couple. He has agreed to share gene names with the counsellor only.",
    ),
    member(
      "dana",
      "Dana",
      "c-02",
      "p-02a",
      "A synthetic person in an unrelated couple. No shared change was found on this test.",
    ),
    member("idris", "Idris", "c-02", "p-02b", "Dana's partner in the same synthetic couple, with the same result."),
    member(
      "salem",
      "Salem",
      "c-07",
      "p-07a",
      "A synthetic person whose report contains a change of uncertain meaning. More information is needed.",
    ),
    member(
      "rania",
      "Rania",
      "c-08",
      "p-08a",
      "A synthetic person whose partner has not yet agreed to share. Under the Dubai policy her result is held back until he does.",
    ),
    member(
      "tariq",
      "Tariq",
      "c-08",
      "p-08b",
      "Rania's partner. His agreement in the consent ledger is what releases the result to her.",
    ),
    staff(
      "counsellor",
      "Counsellor (demo)",
      "counsellor",
      "Sees every synthetic case, the review queue and the counsellor brief.",
    ),
    staff(
      "clinician",
      "Clinician (demo)",
      "clinician",
      "Sees every synthetic case, fills in the clinician proforma and uses the haematology aid.",
    ),
    staff(
      "programme",
      "Programme operator (demo)",
      "programme",
      "Sees programme figures only, never an individual or couple result.",
    ),
    staff(
      "judge",
      "Judge (demo)",
      "judge",
      "Read-only view of the scoreboard, programme figures, glossary, options page and the audit-chain check.",
    ),
  ];
}

// ---------------------------------------------------------------------------------------------------------
// The ten seeded couples (spec section 4). Names are made up; there are no surnames.
// ---------------------------------------------------------------------------------------------------------

export type MoreInfoReason = "vus_present" | "haem_cbc_only";

export interface CouplePersonModel {
  person_id: string;
  display_name: string;
  sex: "female" | "male";
  findings: Finding[];
}

export interface CoupleModel {
  case: CoupleCase;
  case_number: number;
  /** Staff-facing label, for example "Amal and Karim (synthetic)". */
  label: string;
  people: CouplePersonModel[];
  category: ResultCategory;
  shared: SharedCondition[];
  detection: DetectionStatement[];
  reasons: MoreInfoReason[];
  escalation_rule_ids: string[];
  pregnancy_in_progress: boolean;
  trace: string[];
  ruleset_version: string;
}

function finding(
  gene: string,
  conditionId: string,
  zygosity: Finding["zygosity"],
  inheritance: Finding["inheritance"],
  classification: Finding["classification"],
  variantLabel: string | null,
): Finding {
  return {
    gene,
    condition_id: conditionId,
    zygosity,
    inheritance,
    classification,
    variant_label: variantLabel,
  };
}

/** Mendelian arithmetic for an autosomal recessive both-carrier pair (engine output in production). */
function bothCarrierOutcomes(): OutcomeLine[] {
  return [
    { label: "affected", per_100: 25, applies_to: "any_child" },
    { label: "carrier", per_100: 50, applies_to: "any_child" },
    { label: "neither", per_100: 25, applies_to: "any_child" },
  ];
}

/** Autosomal recessive: one partner has both copies changed, the other is a carrier. */
function affectedAndCarrierOutcomes(): OutcomeLine[] {
  return [
    { label: "affected", per_100: 50, applies_to: "any_child" },
    { label: "carrier", per_100: 50, applies_to: "any_child" },
    { label: "neither", per_100: 0, applies_to: "any_child" },
  ];
}

/** X-linked recessive, carrier female and unaffected male. */
function xLinkedCarrierFemaleOutcomes(): OutcomeLine[] {
  return [
    { label: "affected", per_100: 50, applies_to: "son" },
    { label: "carrier", per_100: 0, applies_to: "son" },
    { label: "neither", per_100: 50, applies_to: "son" },
    { label: "affected", per_100: 0, applies_to: "daughter" },
    { label: "carrier", per_100: 50, applies_to: "daughter" },
    { label: "neither", per_100: 50, applies_to: "daughter" },
  ];
}

function detectionFor(panelId: string, related: boolean, alphaLocus = false): DetectionStatement[] {
  const statements: DetectionStatement[] = [
    {
      panel_id: panelId,
      statement_key: "detection.panel_rate_assumed",
      detection_rate_label:
        "not stated in this prototype (assumed and illustrative; the backend supplies the rate in production)",
      assumed: true,
      related_couple_caveat: related,
    },
  ];
  if (alphaLocus) {
    statements.push({
      panel_id: panelId,
      statement_key: "detection.alpha_globin_locus_limit",
      detection_rate_label: "this locus is technically complex to assess (assumed and illustrative)",
      assumed: true,
      related_couple_caveat: related,
    });
  }
  if (related) {
    statements.push({
      panel_id: panelId,
      statement_key: "detection.related_couple_shared_misses",
      detection_rate_label:
        "because the partners are related, a change this test misses is likely to be missed in both of them (assumed and illustrative)",
      assumed: true,
      related_couple_caveat: true,
    });
  }
  return statements;
}

const UAE_PANEL = "uae_demo_panel_v1";
const HAEM_PANEL = "haemoglobinopathy_demo_panel_v1";

interface CoupleSeed {
  id: string;
  number: number;
  names: [string, string];
  sexes: [CouplePersonModel["sex"], CouplePersonModel["sex"]];
  relationship: CoupleCase["relationship"];
  policy: CoupleCase["policy"];
  panel: string;
  created_at: string;
}

function people(seed: CoupleSeed, findingsA: Finding[], findingsB: Finding[]): CouplePersonModel[] {
  return [
    { person_id: `p-${seed.id.slice(2)}a`, display_name: seed.names[0], sex: seed.sexes[0], findings: findingsA },
    { person_id: `p-${seed.id.slice(2)}b`, display_name: seed.names[1], sex: seed.sexes[1], findings: findingsB },
  ];
}

/** Member languages as the real seed has them: English and Arabic by default; case 4 Arabic and English; case 6 Urdu and English. */
function languagesOf(caseNumber: number): [Locale, Locale] {
  if (caseNumber === 4) return ["ar", "en"];
  if (caseNumber === 6) return ["ur", "en"];
  return ["en", "ar"];
}

function caseOf(seed: CoupleSeed): CoupleCase {
  return {
    couple_id: seed.id,
    partners: [
      { person_id: `p-${seed.id.slice(2)}a`, display_name: seed.names[0], sex: seed.sexes[0], language: languagesOf(seed.number)[0] },
      { person_id: `p-${seed.id.slice(2)}b`, display_name: seed.names[1], sex: seed.sexes[1], language: languagesOf(seed.number)[1] },
    ],
    relationship: seed.relationship,
    policy: seed.policy,
    panel_id: seed.panel,
    synthetic: true,
    created_at: seed.created_at,
  };
}

const RELATED = new Set<CoupleCase["relationship"]>([
  "second_cousin",
  "first_cousin_once_removed",
  "first_cousin",
  "double_first_cousin",
  "other_close",
]);

/** Closed vocabulary: the trace line that every rule that fired contributes (staff only). */
function relationshipLine(seed: CoupleSeed): string {
  return `Relationship declared at intake: ${seed.relationship}. It is carried through as declared and is never inferred from the findings.`;
}

export function makeCoupleModels(): CoupleModel[] {
  const models: CoupleModel[] = [];

  // Case 2 (spec section 4): first cousins, both carriers of one autosomal recessive condition.
  {
    const seed: CoupleSeed = {
      id: "c-01",
      number: 2,
      names: ["Amal", "Karim"],
      sexes: ["female", "male"],
      relationship: "first_cousin",
      policy: "abu_dhabi",
      panel: UAE_PANEL,
      created_at: "2026-11-12T08:00:00Z",
    };
    models.push({
      case: caseOf(seed),
      case_number: seed.number,
      label: "Amal and Karim (synthetic)",
      people: people(
        seed,
        [finding("HBB", "beta_thalassaemia", "carrier", "AR", "pathogenic", "synthetic variant A")],
        [finding("HBB", "beta_thalassaemia", "carrier", "AR", "pathogenic", "synthetic variant B")],
      ),
      category: "shared_result_found",
      shared: [
        {
          condition_id: "beta_thalassaemia",
          gene: "HBB",
          inheritance: "AR",
          basis: "both_carriers",
          outcomes: bothCarrierOutcomes(),
        },
      ],
      detection: detectionFor(UAE_PANEL, true),
      reasons: [],
      escalation_rule_ids: ["ESC-01"],
      pregnancy_in_progress: false,
      trace: [
        "Partner p-01a reports one changed copy of HBB (carrier, synthetic finding).",
        "Partner p-01b reports one changed copy of HBB (carrier, synthetic finding).",
        "Both partners are carriers of the same autosomal recessive condition, so the category is shared_result_found.",
        "Outcome arithmetic for a both-carrier autosomal recessive pair: 25 affected, 50 carrier, 25 neither per 100 pregnancies (Mendelian arithmetic, engine output).",
        relationshipLine(seed),
        "Review priority set to priority by escalation rule ESC-01.",
      ],
      ruleset_version: MOCK_RULESET_VERSION,
    });
  }

  // Case 1: unrelated, no shared change found.
  {
    const seed: CoupleSeed = {
      id: "c-02",
      number: 1,
      names: ["Dana", "Idris"],
      sexes: ["female", "male"],
      relationship: "unrelated",
      policy: "abu_dhabi",
      panel: UAE_PANEL,
      created_at: "2026-11-12T09:00:00Z",
    };
    models.push({
      case: caseOf(seed),
      case_number: seed.number,
      label: "Dana and Idris (synthetic)",
      people: people(seed, [], []),
      category: "no_shared_change_found",
      shared: [],
      detection: detectionFor(UAE_PANEL, false),
      reasons: [],
      escalation_rule_ids: [],
      pregnancy_in_progress: false,
      trace: [
        "No change was found in a gene that both partners carry on this panel.",
        "The category is no_shared_change_found. This describes this test only.",
        relationshipLine(seed),
        "No escalation rule fired. Review priority is routine.",
      ],
      ruleset_version: MOCK_RULESET_VERSION,
    });
  }

  // Case 3: related, nothing found on this panel; the related-couple caveat is shown.
  {
    const seed: CoupleSeed = {
      id: "c-03",
      number: 3,
      names: ["Noor", "Faisal"],
      sexes: ["female", "male"],
      relationship: "first_cousin",
      policy: "dubai",
      panel: UAE_PANEL,
      created_at: "2026-11-13T08:00:00Z",
    };
    models.push({
      case: caseOf(seed),
      case_number: seed.number,
      label: "Noor and Faisal (synthetic)",
      people: people(seed, [], []),
      category: "no_shared_change_found",
      shared: [],
      detection: detectionFor(UAE_PANEL, true),
      reasons: [],
      escalation_rule_ids: [],
      pregnancy_in_progress: false,
      trace: [
        "No change was found in a gene that both partners carry on this panel.",
        "The category is no_shared_change_found. The related-couple caveat is attached to the detection statement; no residual figure is produced.",
        relationshipLine(seed),
        "No escalation rule fired. Review priority is routine.",
      ],
      ruleset_version: MOCK_RULESET_VERSION,
    });
  }

  // Case 4: alpha-thalassaemia carrier pair (the alpha locus is flagged as technically complex).
  {
    const seed: CoupleSeed = {
      id: "c-04",
      number: 4,
      names: ["Layla", "Omar"],
      sexes: ["female", "male"],
      relationship: "unrelated",
      policy: "abu_dhabi",
      panel: UAE_PANEL,
      created_at: "2026-11-12T12:00:00Z",
    };
    models.push({
      case: caseOf(seed),
      case_number: seed.number,
      label: "Layla and Omar (synthetic)",
      people: people(
        seed,
        [finding("HBA1/HBA2", "alpha_thalassaemia_alpha0", "carrier", "AR", "pathogenic", "synthetic deletion C")],
        [finding("HBA1/HBA2", "alpha_thalassaemia_alpha0", "carrier", "AR", "pathogenic", "synthetic deletion C")],
      ),
      category: "shared_result_found",
      shared: [
        {
          condition_id: "alpha_thalassaemia_alpha0",
          gene: "HBA1/HBA2",
          inheritance: "AR",
          basis: "both_carriers",
          outcomes: bothCarrierOutcomes(),
        },
      ],
      detection: detectionFor(UAE_PANEL, false, true),
      reasons: [],
      escalation_rule_ids: ["ESC-01"],
      pregnancy_in_progress: false,
      trace: [
        "Both partners report one changed copy at the alpha-globin locus (carrier, synthetic findings).",
        "The alpha locus is technically complex to assess; the detection statement says so. The counsellor confirms the genotype.",
        "Outcome arithmetic for a both-carrier autosomal recessive pair: 25 affected, 50 carrier, 25 neither per 100 pregnancies (fixture simplification at this locus).",
        relationshipLine(seed),
        "Review priority set to priority by escalation rule ESC-01.",
      ],
      ruleset_version: MOCK_RULESET_VERSION,
    });
  }

  // Case 5: one partner affected (compound), the other a carrier: urgent review.
  {
    const seed: CoupleSeed = {
      id: "c-05",
      number: 5,
      names: ["Mariam", "Yusuf"],
      sexes: ["female", "male"],
      relationship: "first_cousin_once_removed",
      policy: "dubai",
      panel: UAE_PANEL,
      created_at: "2026-11-12T14:00:00Z",
    };
    models.push({
      case: caseOf(seed),
      case_number: seed.number,
      label: "Mariam and Yusuf (synthetic)",
      people: people(
        seed,
        [
          finding(
            "HBB",
            "hbb_compound_haemoglobin_disorder",
            "affected",
            "AR",
            "pathogenic",
            "synthetic variants D and E (one in each copy)",
          ),
        ],
        [finding("HBB", "beta_thalassaemia", "carrier", "AR", "pathogenic", "synthetic variant D")],
      ),
      category: "shared_result_found",
      shared: [
        {
          condition_id: "hbb_compound_haemoglobin_disorder",
          gene: "HBB",
          inheritance: "AR",
          basis: "affected_partner_and_carrier",
          outcomes: affectedAndCarrierOutcomes(),
        },
      ],
      detection: detectionFor(UAE_PANEL, true),
      reasons: [],
      escalation_rule_ids: ["ESC-01", "ESC-02"],
      pregnancy_in_progress: false,
      trace: [
        "Partner p-05a reports changes in both copies of HBB (affected, synthetic finding).",
        "Partner p-05b reports one changed copy of HBB (carrier, synthetic finding).",
        "One partner is affected and the other is a carrier of the same autosomal recessive condition, so the category is shared_result_found.",
        "Outcome arithmetic for an affected partner and a carrier: 50 affected, 50 carrier, 0 neither per 100 pregnancies (Mendelian arithmetic, engine output).",
        relationshipLine(seed),
        "Review priority set to urgent by escalation rule ESC-02.",
      ],
      ruleset_version: MOCK_RULESET_VERSION,
    });
  }

  // Case 6: X-linked carrier female.
  {
    const seed: CoupleSeed = {
      id: "c-06",
      number: 6,
      names: ["Salma", "Hassan"],
      sexes: ["female", "male"],
      relationship: "unrelated",
      policy: "abu_dhabi",
      panel: UAE_PANEL,
      created_at: "2026-11-13T09:00:00Z",
    };
    models.push({
      case: caseOf(seed),
      case_number: seed.number,
      label: "Salma and Hassan (synthetic)",
      people: people(
        seed,
        [finding("G6PD", "g6pd_deficiency", "carrier", "XL", "pathogenic", "synthetic variant F")],
        [],
      ),
      category: "shared_result_found",
      shared: [
        {
          condition_id: "g6pd_deficiency",
          gene: "G6PD",
          inheritance: "XL",
          basis: "x_linked_carrier_female",
          outcomes: xLinkedCarrierFemaleOutcomes(),
        },
      ],
      detection: detectionFor(UAE_PANEL, false),
      reasons: [],
      escalation_rule_ids: ["ESC-01", "ESC-05"],
      pregnancy_in_progress: false,
      trace: [
        "Partner p-06a reports one changed copy of an X-linked gene (carrier, synthetic finding).",
        "The shared condition is X-linked and belongs to one partner, so the other partner sees it only after her agreement.",
        "Outcome arithmetic for an X-linked recessive condition with a carrier female: sons and daughters are reported separately.",
        relationshipLine(seed),
        "Review priority set to priority by escalation rule ESC-01.",
      ],
      ruleset_version: MOCK_RULESET_VERSION,
    });
  }

  // Case 7: variant of uncertain significance: more information needed, never a result.
  {
    const seed: CoupleSeed = {
      id: "c-07",
      number: 7,
      names: ["Salem", "Huda"],
      sexes: ["male", "female"],
      relationship: "second_cousin",
      policy: "abu_dhabi",
      panel: UAE_PANEL,
      created_at: "2026-11-21T08:00:00Z",
    };
    models.push({
      case: caseOf(seed),
      case_number: seed.number,
      label: "Salem and Huda (synthetic)",
      people: people(
        seed,
        [finding("CFTR", "cystic_fibrosis", "vus", "AR", "vus", "synthetic variant G (uncertain significance)")],
        [],
      ),
      category: "more_information_needed",
      shared: [],
      detection: detectionFor(UAE_PANEL, true),
      reasons: ["vus_present"],
      escalation_rule_ids: ["ESC-04"],
      pregnancy_in_progress: false,
      trace: [
        "Partner p-07a reports a change of uncertain meaning (variant of uncertain significance).",
        "A variant of uncertain significance is never counted as a result, so the category is more_information_needed.",
        "needs_more_information_reasons: vus_present.",
        relationshipLine(seed),
        "Review priority set to routine by escalation rule ESC-04.",
      ],
      ruleset_version: MOCK_RULESET_VERSION,
    });
  }

  // Case 8: one partner has not agreed to share (the certificate-refusal tension; Dubai policy).
  {
    const seed: CoupleSeed = {
      id: "c-08",
      number: 8,
      names: ["Rania", "Tariq"],
      sexes: ["female", "male"],
      relationship: "unrelated",
      policy: "dubai",
      panel: UAE_PANEL,
      created_at: "2026-11-18T08:00:00Z",
    };
    models.push({
      case: caseOf(seed),
      case_number: seed.number,
      label: "Rania and Tariq (synthetic)",
      people: people(
        seed,
        [finding("HBB", "beta_thalassaemia", "carrier", "AR", "pathogenic", "synthetic variant H")],
        [finding("HBB", "beta_thalassaemia", "carrier", "AR", "pathogenic", "synthetic variant I")],
      ),
      category: "shared_result_found",
      shared: [
        {
          condition_id: "beta_thalassaemia",
          gene: "HBB",
          inheritance: "AR",
          basis: "both_carriers",
          outcomes: bothCarrierOutcomes(),
        },
      ],
      detection: detectionFor(UAE_PANEL, false),
      reasons: [],
      escalation_rule_ids: ["ESC-01", "ESC-06"],
      pregnancy_in_progress: false,
      trace: [
        "Partner p-08a reports one changed copy of HBB (carrier, synthetic finding).",
        "Partner p-08b reports one changed copy of HBB (carrier, synthetic finding).",
        "Both partners are carriers of the same autosomal recessive condition, so the category is shared_result_found.",
        "Under the Dubai policy the couple-level result is held back from a partner until the other partner has agreed to share it.",
        relationshipLine(seed),
        "Review priority set to priority by escalation rule ESC-01.",
      ],
      ruleset_version: MOCK_RULESET_VERSION,
    });
  }

  // Case 9: pregnancy in progress with a shared result: escalation.
  {
    const seed: CoupleSeed = {
      id: "c-09",
      number: 9,
      names: ["Zainab", "Nasser"],
      sexes: ["female", "male"],
      relationship: "first_cousin",
      policy: "dubai",
      panel: UAE_PANEL,
      created_at: "2026-11-12T16:00:00Z",
    };
    models.push({
      case: caseOf(seed),
      case_number: seed.number,
      label: "Zainab and Nasser (synthetic)",
      people: people(
        seed,
        [finding("CFTR", "cystic_fibrosis", "carrier", "AR", "pathogenic", "synthetic variant J")],
        [finding("CFTR", "cystic_fibrosis", "carrier", "AR", "pathogenic", "synthetic variant K")],
      ),
      category: "shared_result_found",
      shared: [
        {
          condition_id: "cystic_fibrosis",
          gene: "CFTR",
          inheritance: "AR",
          basis: "both_carriers",
          outcomes: bothCarrierOutcomes(),
        },
      ],
      detection: detectionFor(UAE_PANEL, true),
      reasons: [],
      escalation_rule_ids: ["ESC-01", "ESC-03"],
      pregnancy_in_progress: true,
      trace: [
        "Both partners report one changed copy of CFTR (carrier, synthetic findings).",
        "Both partners are carriers of the same autosomal recessive condition, so the category is shared_result_found.",
        "A pregnancy is recorded as in progress, so a human accredited professional is notified.",
        relationshipLine(seed),
        "Review priority set to urgent by escalation rule ESC-03.",
      ],
      ruleset_version: MOCK_RULESET_VERSION,
    });
  }

  // Case 10: a CBC-only work-up, never a carrier statement.
  {
    const seed: CoupleSeed = {
      id: "c-10",
      number: 10,
      names: ["Reem", "Bilal"],
      sexes: ["female", "male"],
      relationship: "unrelated",
      policy: "abu_dhabi",
      panel: HAEM_PANEL,
      created_at: "2026-11-26T08:00:00Z",
    };
    models.push({
      case: caseOf(seed),
      case_number: seed.number,
      label: "Reem and Bilal (synthetic)",
      people: people(seed, [], []),
      category: "more_information_needed",
      shared: [],
      detection: detectionFor(HAEM_PANEL, RELATED.has(seed.relationship)),
      reasons: ["haem_cbc_only"],
      escalation_rule_ids: ["ESC-04"],
      pregnancy_in_progress: false,
      trace: [
        "Only a complete blood count is on file for this couple. A blood count alone never states a carrier status.",
        "The category is more_information_needed.",
        "needs_more_information_reasons: haem_cbc_only.",
        relationshipLine(seed),
        "Review priority set to routine by escalation rule ESC-04.",
      ],
      ruleset_version: MOCK_RULESET_VERSION,
    });
  }

  return models;
}

// ---------------------------------------------------------------------------------------------------------
// Escalation rules (illustrative fixture; the library is supplied by the backend in production)
// ---------------------------------------------------------------------------------------------------------

const PRIORITY_RANK: Record<ReviewPriority, number> = { routine: 0, priority: 1, urgent: 2 };

export function maxPriority(priorities: readonly ReviewPriority[]): ReviewPriority {
  let best: ReviewPriority = "routine";
  for (const p of priorities) {
    if (PRIORITY_RANK[p] > PRIORITY_RANK[best]) best = p;
  }
  return best;
}

const ESCALATION_RULES: Readonly<Record<string, { priority: ReviewPriority; reason: string }>> = {
  "ESC-01": {
    priority: "priority",
    reason: "A shared result was found. Offer a counselling visit with a trained professional.",
  },
  "ESC-02": {
    priority: "urgent",
    reason:
      "One partner's report lists changes in both copies of the gene and the other partner carries one changed copy. Route to an accredited genetics professional.",
  },
  "ESC-03": {
    priority: "urgent",
    reason:
      "A pregnancy is in progress and a shared result was found. Route to an accredited genetics professional without waiting for the routine queue.",
  },
  "ESC-04": {
    priority: "routine",
    reason:
      "A finding needs more work before it can be called a result (a change of uncertain meaning or an incomplete work-up). Arrange specialist review.",
  },
  "ESC-05": {
    priority: "routine",
    reason:
      "The shared condition is X-linked, so the result may belong to one partner. Check consent before the other partner sees any detail.",
  },
  "ESC-06": {
    priority: "routine",
    reason:
      "One partner has not agreed to share their result with the other. The certificate note applies; a counsellor explains the privacy rules.",
  },
};

export function makeEscalationDecision(ruleId: string): EscalationDecision {
  const rule = ESCALATION_RULES[ruleId];
  return {
    rule_id: ruleId,
    priority: rule?.priority ?? "routine",
    reason: rule?.reason ?? "Unknown rule id in this fixture.",
    source: ESCALATION_SOURCE,
  };
}

export interface EscalationSeed {
  couple_id: string;
  raised_at: string;
}

/** The counsellor queue: four items, urgent first. Decisions are derived from the couple's rule ids. */
export function makeEscalationSeeds(): EscalationSeed[] {
  return [
    { couple_id: "c-05", raised_at: "2026-12-01T09:00:00Z" },
    { couple_id: "c-09", raised_at: "2026-12-01T09:30:00Z" },
    { couple_id: "c-01", raised_at: "2026-11-28T23:00:00Z" },
    { couple_id: "c-07", raised_at: "2026-12-04T09:00:00Z" },
  ];
}

// ---------------------------------------------------------------------------------------------------------
// Pathway: 9 states, expected durations from research 02 section 2.1, mixed statuses per couple
// ---------------------------------------------------------------------------------------------------------

export const PATHWAY_STATE_KEYS: readonly PathwayStateKey[] = [
  "registration_consent",
  "physician_consult",
  "sample_collection",
  "lab_processing",
  "joint_report",
  "counselling",
  "declaration",
  "certificate",
  "judicial_handoff",
];

/**
 * Planning figures in hours, from research 02 section 2.1 (rows 5 and 7):
 *  - physician consultation about 15 minutes and consenting plus sample collection about 15 minutes each = 0.25;
 *  - lab_processing: the standard tests take 24 hours, the genetic panel 2 to 4 weeks. The genetic-panel stage is
 *    shown here as 336 hours (14 days, the typical figure in the Abu Dhabi workflow). It is a PARAMETER: the
 *    standards disagree (Abu Dhabi not more than 21 days in more than 90 percent of cases, Dubai around 4 weeks)
 *    and the backend supplies the per-emirate value in production;
 *  - joint_report: the interpreted report returns in 3 days (72 hours) in the same workflow;
 *  - null where the research gives no figure.
 */
export const EXPECTED_DURATION_HOURS: Readonly<Record<PathwayStateKey, number | null>> = {
  registration_consent: null,
  physician_consult: 0.25,
  sample_collection: 0.25,
  lab_processing: 336,
  joint_report: 72,
  counselling: null,
  declaration: null,
  certificate: null,
  judicial_handoff: null,
};

/** Standard tests only (a CBC-only work-up has no genetic panel): 24 hours. */
export const STANDARD_TEST_HOURS = 24;

/** Only these states carry a service-level timer; every other state reports not_applicable. */
export const TIMED_STATES: ReadonlySet<PathwayStateKey> = new Set<PathwayStateKey>(["lab_processing", "joint_report"]);

/** The event that completes each state. The demo fires these through POST /pathway/events. */
export const PATHWAY_EVENT_BY_STATE: Readonly<Record<PathwayStateKey, string>> = {
  registration_consent: "registered",
  physician_consult: "consult_completed",
  sample_collection: "sample_collected",
  lab_processing: "joint_report_ready",
  joint_report: "result_communicated",
  counselling: "counselling_completed",
  declaration: "declaration_signed",
  certificate: "certificate_issued",
  judicial_handoff: "judicial_handoff_sent",
};

const NEXT_ACTION_BY_STATE: Readonly<Record<PathwayStateKey, { key: string; owner: NextAction["owner"] }>> = {
  registration_consent: { key: "complete_registration", owner: "couple" },
  physician_consult: { key: "attend_physician_consult", owner: "clinic" },
  sample_collection: { key: "collect_samples", owner: "clinic" },
  lab_processing: { key: "await_laboratory_report", owner: "lab" },
  joint_report: { key: "communicate_result", owner: "clinic" },
  counselling: { key: "attend_counselling", owner: "counsellor" },
  declaration: { key: "sign_declaration", owner: "couple" },
  certificate: { key: "issue_certificate", owner: "clinic" },
  judicial_handoff: { key: "send_to_judicial_department", owner: "clinic" },
};

export function nextActionFor(key: PathwayStateKey, blocked: boolean): NextAction {
  if (blocked) {
    return { key: "await_partner_agreement", label: null, event: null, owner: "couple" };
  }
  const base = NEXT_ACTION_BY_STATE[key];
  return { key: base.key, label: null, event: PATHWAY_EVENT_BY_STATE[key], owner: base.owner };
}

interface PathwaySeed {
  couple_id: string;
  t0: string;
  /** Hours each completed state took, in order; its length is the index of the current state. */
  durations_h: readonly number[];
  blocked: boolean;
  current_sla: SlaStatus;
  lab_expected_h: number | null;
}

const PATHWAY_SEEDS: readonly PathwaySeed[] = [
  { couple_id: "c-01", t0: "2026-11-12T08:00:00Z", durations_h: [2, 26, 0.5, 300, 70], blocked: false, current_sla: "not_applicable", lab_expected_h: null },
  { couple_id: "c-02", t0: "2026-11-12T09:00:00Z", durations_h: [1, 22, 0.5, 290, 60, 0, 30], blocked: false, current_sla: "not_applicable", lab_expected_h: null },
  { couple_id: "c-03", t0: "2026-11-13T08:00:00Z", durations_h: [2, 20, 0.5, 310, 66, 0], blocked: false, current_sla: "not_applicable", lab_expected_h: null },
  { couple_id: "c-04", t0: "2026-11-12T12:00:00Z", durations_h: [3, 25, 0.5, 280, 64, 120, 28, 20], blocked: false, current_sla: "not_applicable", lab_expected_h: null },
  { couple_id: "c-05", t0: "2026-11-12T14:00:00Z", durations_h: [2, 24, 0.5, 270, 58, 96], blocked: false, current_sla: "not_applicable", lab_expected_h: null },
  { couple_id: "c-06", t0: "2026-11-13T09:00:00Z", durations_h: [2, 22, 0.5, 285, 60, 110, 26], blocked: false, current_sla: "not_applicable", lab_expected_h: null },
  // 321.5 hours into a 336-hour genetic-panel stage: about 96 percent elapsed, so the timer is at risk.
  { couple_id: "c-07", t0: "2026-11-21T08:00:00Z", durations_h: [2, 12, 0.5], blocked: false, current_sla: "at_risk", lab_expected_h: null },
  // Blocked on the partner's agreement. The timer is paused while it waits, so it reports not_applicable.
  { couple_id: "c-08", t0: "2026-11-18T08:00:00Z", durations_h: [2, 20, 0.5, 290], blocked: true, current_sla: "not_applicable", lab_expected_h: null },
  { couple_id: "c-09", t0: "2026-11-12T16:00:00Z", durations_h: [2, 24, 0.5, 280, 60, 72], blocked: false, current_sla: "not_applicable", lab_expected_h: null },
  // A CBC-only work-up: the standard-test turnaround (24 hours) applies and has been passed, so it is breached.
  { couple_id: "c-10", t0: "2026-11-26T08:00:00Z", durations_h: [2, 18, 0.5], blocked: false, current_sla: "breached", lab_expected_h: STANDARD_TEST_HOURS },
];

function buildPathway(seed: PathwaySeed): PathwayView {
  const current = seed.durations_h.length;
  let cursor = Date.parse(seed.t0);
  const states: PathwayState[] = PATHWAY_STATE_KEYS.map((key, index) => {
    const expected =
      key === "lab_processing" && seed.lab_expected_h !== null ? seed.lab_expected_h : EXPECTED_DURATION_HOURS[key];
    if (index < current) {
      const entered = cursor;
      cursor += (seed.durations_h[index] ?? 0) * HOUR_MS;
      return {
        key,
        label: null,
        status: "done",
        entered_at: isoFromMs(entered),
        completed_at: isoFromMs(cursor),
        expected_duration_hours: expected,
        sla_status: TIMED_STATES.has(key) ? "on_track" : "not_applicable",
        simulated: true,
      };
    }
    if (index === current) {
      return {
        key,
        label: null,
        status: seed.blocked ? "blocked" : "current",
        entered_at: isoFromMs(cursor),
        completed_at: null,
        expected_duration_hours: expected,
        sla_status: seed.current_sla,
        simulated: true,
      };
    }
    return {
      key,
      label: null,
      status: "upcoming",
      entered_at: null,
      completed_at: null,
      expected_duration_hours: expected,
      sla_status: "not_applicable",
      simulated: true,
    };
  });
  const currentKey = PATHWAY_STATE_KEYS[current];
  return {
    couple_id: seed.couple_id,
    states,
    next_action: currentKey === undefined ? null : nextActionFor(currentKey, seed.blocked),
    referral_target_met: null,
  };
}

export function makePathwayViews(): PathwayView[] {
  return PATHWAY_SEEDS.map(buildPathway);
}

// ---------------------------------------------------------------------------------------------------------
// Referral tasks (FHIR R5 Task shaped, simulated)
// ---------------------------------------------------------------------------------------------------------

export const COUNSELLING_TASK_SUFFIX = "-counselling";

function stateOf(view: PathwayView | undefined, key: PathwayStateKey): PathwayState | undefined {
  return view?.states.find((s) => s.key === key);
}

export function makeReferralTasks(views: readonly PathwayView[]): Record<string, ReferralTask[]> {
  const byCouple = new Map(views.map((v) => [v.couple_id, v] as const));
  const counselling = (coupleId: string, status: ReferralTask["status"]): ReferralTask => {
    const state = stateOf(byCouple.get(coupleId), "counselling");
    const authored = state?.entered_at ?? FIXTURE_CLOCK;
    const modified = status === "completed" ? (state?.completed_at ?? authored) : addHours(authored, 2);
    return {
      task_id: `task-${coupleId}${COUNSELLING_TASK_SUFFIX}`,
      destination: "Genetic counselling service (simulated)",
      status,
      authored_on: authored,
      last_modified: modified,
      simulated: true,
    };
  };
  const followUp = (
    coupleId: string,
    suffix: string,
    destination: string,
    status: ReferralTask["status"],
    afterHours: number,
  ): ReferralTask => {
    const state = stateOf(byCouple.get(coupleId), "counselling");
    const authored = state?.completed_at ?? state?.entered_at ?? FIXTURE_CLOCK;
    return {
      task_id: `task-${coupleId}-${suffix}`,
      destination,
      status,
      authored_on: authored,
      last_modified: addHours(authored, afterHours),
      simulated: true,
    };
  };
  return {
    "c-01": [counselling("c-01", "accepted")],
    "c-02": [],
    "c-03": [],
    "c-04": [counselling("c-04", "completed")],
    "c-05": [
      counselling("c-05", "completed"),
      followUp("c-05", "confirmatory", "Confirmatory testing laboratory (simulated)", "in-progress", 12),
    ],
    "c-06": [counselling("c-06", "completed")],
    "c-07": [],
    "c-08": [],
    "c-09": [
      counselling("c-09", "completed"),
      followUp("c-09", "specialist", "Clinical genetics service (simulated)", "accepted", 6),
    ],
    "c-10": [],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Consent ledger and audit seeds
// ---------------------------------------------------------------------------------------------------------

export function makeConsentSeeds(): ConsentRecord[] {
  return [
    {
      consent_id: "cons-0001",
      couple_id: "c-01",
      subject_person_id: "p-01a",
      recipient: "p-01b",
      scope: "couple_result_only",
      purpose: "counselling together",
      granted_at: "2026-11-29T09:00:00Z",
      expires_at: null,
      revoked_at: null,
    },
    {
      consent_id: "cons-0002",
      couple_id: "c-01",
      subject_person_id: "p-01b",
      recipient: "counsellor",
      scope: "gene_names_only",
      purpose: "counselling visit",
      granted_at: "2026-11-29T09:05:00Z",
      expires_at: null,
      revoked_at: null,
    },
    {
      consent_id: "cons-0003",
      couple_id: "c-08",
      subject_person_id: "p-08a",
      recipient: "p-08b",
      scope: "couple_result_only",
      purpose: "sharing with my partner",
      granted_at: "2026-12-01T10:00:00Z",
      expires_at: null,
      revoked_at: null,
    },
  ];
}

/** An audit event before it is chained: the handler assigns index, event_id, prev_hash and hash. */
export type AuditSeed = Pick<AuditEvent, "at" | "actor_id" | "action" | "couple_id" | "detail"> & {
  actor_role: Role;
};

export function makeAuditSeeds(): AuditSeed[] {
  return [
    {
      at: "2026-11-21T22:30:00Z",
      actor_role: "clinician",
      actor_id: "persona-clinician",
      action: "pathway_event",
      couple_id: "c-07",
      detail: "Event sample_collected: sample_collection done, lab_processing current (simulated).",
    },
    {
      at: "2026-11-29T04:30:00Z",
      actor_role: "clinician",
      actor_id: "persona-clinician",
      action: "pathway_event",
      couple_id: "c-02",
      detail: "Event declaration_signed: declaration done, certificate current (simulated).",
    },
    {
      at: "2026-11-29T09:00:00Z",
      actor_role: "couple_member",
      actor_id: "p-01a",
      action: "consent_granted",
      couple_id: "c-01",
      detail: "Consent cons-0001 granted: couple_result_only to p-01b for counselling together.",
    },
    {
      at: "2026-11-29T09:05:00Z",
      actor_role: "couple_member",
      actor_id: "p-01b",
      action: "consent_granted",
      couple_id: "c-01",
      detail: "Consent cons-0002 granted: gene_names_only to counsellor for the counselling visit.",
    },
    {
      at: "2026-11-29T10:00:00Z",
      actor_role: "counsellor",
      actor_id: "persona-counsellor",
      action: "result_disclosed",
      couple_id: "c-01",
      detail: "Staff view of the couple result for an assigned couple (synthetic case).",
    },
    {
      at: "2026-12-01T10:00:00Z",
      actor_role: "couple_member",
      actor_id: "p-08a",
      action: "consent_granted",
      couple_id: "c-08",
      detail: "Consent cons-0003 granted: couple_result_only to p-08b for sharing with my partner.",
    },
  ];
}

// ---------------------------------------------------------------------------------------------------------
// Explainer documents (templates, three languages, no runtime LLM)
// ---------------------------------------------------------------------------------------------------------

/**
 * Template constants (origin "template_constant") and the engine slots (origin "engine"). A digit may only
 * reach a rendered block through one of these slots, so every number in the text is listed in `numbers`.
 */
const TEMPLATE_CONSTANTS = {
  denominator: 100,
  law_number: 49,
  law_year: 2023,
  art_9: 9,
  art_9_para: 2,
  art_11: 11,
  art_12: 12,
} as const;

type SlotValues = Readonly<Record<string, number | string>>;

function fillTemplate(template: string, slots: SlotValues, prefix: string): { text: string; numbers: NumberRef[] } {
  const found = new Map<string, NumberRef>();
  const constants: Readonly<Record<string, number>> = TEMPLATE_CONSTANTS;
  const text = template.replace(/\{([a-z0-9_]+)\}/g, (_match: string, name: string): string => {
    const constant = constants[name];
    if (constant !== undefined) {
      found.set(name, { key: name, value: constant, origin: "template_constant" });
      return String(constant);
    }
    const value = slots[name];
    if (value === undefined) {
      throw new Error(`Template slot {${name}} has no value in the mock explainer.`);
    }
    if (typeof value === "number") {
      const key = prefix === "" ? name : `${prefix}.${name}`;
      found.set(key, { key, value, origin: "engine" });
    }
    return String(value);
  });
  return { text, numbers: [...found.values()] };
}

const GOOD_CHECK: CheckSummary = {
  ok: true,
  numeric_fidelity: true,
  polarity: true,
  banned_words_absent: true,
  messages: [],
};

interface AddOptions {
  tone?: Block["tone"];
  prefix?: string;
}

class DocBuilder {
  private readonly blocks: Block[] = [];
  private readonly numbers = new Map<string, NumberRef>();
  private readonly templateIds: string[] = [];
  private readonly locale: Locale;

  constructor(locale: Locale) {
    this.locale = locale;
  }

  private register(templateId: string, numbers: readonly NumberRef[]): void {
    this.templateIds.push(templateId);
    for (const n of numbers) this.numbers.set(n.key, n);
  }

  add(kind: BlockKind, templateId: string, template: string, slots: SlotValues = {}, options: AddOptions = {}): void {
    const { text, numbers } = fillTemplate(template, slots, options.prefix ?? "");
    this.register(templateId, numbers);
    this.blocks.push({
      kind,
      text,
      items: [],
      icon_array: null,
      tone: options.tone ?? "neutral",
      numbers,
    });
  }

  list(templateId: string, templates: readonly string[], slots: SlotValues = {}, options: AddOptions = {}): void {
    const items: string[] = [];
    const merged = new Map<string, NumberRef>();
    for (const template of templates) {
      const filled = fillTemplate(template, slots, options.prefix ?? "");
      items.push(filled.text);
      for (const n of filled.numbers) merged.set(n.key, n);
    }
    const numbers = [...merged.values()];
    this.register(templateId, numbers);
    this.blocks.push({
      kind: "list",
      text: "",
      items,
      icon_array: null,
      tone: options.tone ?? "neutral",
      numbers,
    });
  }

  iconArray(
    templateId: string,
    captionTemplate: string,
    counts: { affected: number; carrier: number; neither: number },
    prefix: string,
  ): void {
    const { text, numbers } = fillTemplate(captionTemplate, counts, prefix);
    const spec: IconArraySpec = {
      total: TEMPLATE_CONSTANTS.denominator,
      affected: counts.affected,
      carrier: counts.carrier,
      neither: counts.neither,
      caption: text,
    };
    this.register(templateId, numbers);
    this.blocks.push({
      kind: "icon_array",
      text: "",
      items: [],
      icon_array: spec,
      tone: "neutral",
      numbers,
    });
  }

  finish(glossaryKeys: readonly string[]): ExplainerDoc {
    return {
      locale: this.locale,
      language_status: "draft",
      blocks: this.blocks,
      glossary_keys: [...glossaryKeys],
      numbers_used: [...this.numbers.values()],
      template_ids: [...new Set(this.templateIds)],
      check: { ...GOOD_CHECK, messages: [] },
    };
  }
}

const DISCLAIMER = tri(
  "This page is for education and decision support. It is not clinical advice. Complex or high-impact findings are explained by an accredited health professional, such as a genetic counsellor or a trained physician.",
  "هذه الصفحة للتثقيف ولدعم اتخاذ القرار، وهي ليست نصيحة سريرية. أما النتائج المعقدة أو ذات الأثر الكبير فيشرحها مختص صحي معتمد، مثل المرشد الوراثي أو الطبيب المدرَّب.",
  "یہ صفحہ معلومات اور فیصلے میں مدد کے لیے ہے۔ یہ طبی مشورہ نہیں ہے۔ پیچیدہ یا بڑے اثر والے نتائج کی وضاحت کوئی تسلیم شدہ ماہرِ صحت کرتے ہیں، جیسے جینیاتی کونسلر یا تربیت یافتہ ڈاکٹر۔",
);

const RESULT_TEXT = {
  // ---- shared result found -------------------------------------------------------------------------------
  h_shared: tri("A shared result was found", "تم العثور على نتيجة مشتركة", "مشترک نتیجہ ملا ہے"),
  shared_summary: tri(
    "The screening report shows a result that the two of you share. It points to a chance of a child with an inherited condition. This is a statement about chance, not a diagnosis.",
    "يُظهر تقرير الفحص نتيجة يشترك فيها كلاكما. وهي تشير إلى احتمال أن يولد لكما طفل لديه حالة وراثية. هذه معلومة عن الاحتمال، وهي ليست تشخيصًا.",
    "اسکریننگ رپورٹ میں ایسا نتیجہ سامنے آیا ہے جو آپ دونوں میں مشترک ہے۔ اس سے موروثی بیماری والے بچے کے امکان کا اشارہ ملتا ہے۔ یہ امکان کی بات ہے، تشخیص نہیں۔",
  ),
  basis_both_carriers: tri(
    "Both of you carry the same inherited change, in the {gene} gene. A carrier has one changed copy of a gene and one usual copy. Being a carrier is not an illness: most carriers have no symptoms.",
    "كلاكما يحمل التغيّر الوراثي نفسه في جين {gene}. الحامل لديه نسخة واحدة متغيّرة من الجين ونسخة معتادة. وكون الشخص حاملًا ليس مرضًا: فمعظم الحاملين لا تظهر عليهم أعراض.",
    "آپ دونوں میں {gene} جین کی ایک ہی موروثی تبدیلی ہے اور آپ دونوں کیریئر ہیں۔ کیریئر کے پاس جین کی ایک بدلی ہوئی کاپی اور ایک عام کاپی ہوتی ہے۔ کیریئر ہونا بیماری نہیں ہے: زیادہ تر کیریئر افراد میں کوئی علامت نہیں ہوتی۔",
  ),
  basis_affected_carrier: tri(
    "One of you has changes in both copies of the {gene} gene, and the other carries one changed copy. A counsellor will explain what this means for each of you.",
    "لدى أحدكما تغيّرات في كلتا نسختي جين {gene}، ولدى الآخر نسخة واحدة متغيّرة. سيشرح لكما المرشد الوراثي ما يعنيه ذلك لكل منكما.",
    "آپ دونوں میں سے ایک کی رپورٹ میں {gene} جین کی دونوں کاپیوں میں تبدیلی درج ہے، اور دوسرے میں ایک بدلی ہوئی کاپی ہے۔ کونسلر سمجھائیں گے کہ آپ میں سے ہر ایک کے لیے اس کا کیا مطلب ہے۔",
  ),
  basis_x_carrier_female: tri(
    "The {gene} gene is on the X chromosome. The female partner carries one changed copy. This can affect sons and daughters in different ways.",
    "جين {gene} موجود على الكروموسوم X. الشريكة تحمل نسخة واحدة متغيّرة. وقد يؤثر ذلك في الأولاد والبنات بطرق مختلفة.",
    "{gene} جین X کروموسوم پر ہے۔ خاتون ساتھی میں اس کی ایک بدلی ہوئی کاپی ہے۔ اس کا اثر بیٹوں اور بیٹیوں پر مختلف طرح سے ہو سکتا ہے۔",
  ),
  basis_generic: tri(
    "A counsellor will explain what this result means for each of you.",
    "سيشرح لكما المرشد الوراثي ما تعنيه هذه النتيجة لكل منكما.",
    "کونسلر سمجھائیں گے کہ اس نتیجے کا آپ میں سے ہر ایک کے لیے کیا مطلب ہے۔",
  ),
  pregnancy_heading: tri(
    "What this can mean for a pregnancy",
    "ما قد يعنيه ذلك بالنسبة إلى الحمل",
    "حمل کے لیے اس کا کیا مطلب ہو سکتا ہے",
  ),
  pregnancy_intro: tri(
    "These numbers describe chances for a pregnancy. Each group below is counted out of {denominator} pregnancies.",
    "تصف هذه الأرقام احتمالات تتعلق بالحمل. وكل مجموعة أدناه محسوبة من بين {denominator} حالة حمل.",
    "یہ اعداد حمل کے امکانات بیان کرتے ہیں۔ نیچے ہر گروپ {denominator} حمل میں سے گنا گیا ہے۔",
  ),
  caption_any: tri(
    "On average, out of {denominator} pregnancies with this result, about {affected} would have the condition, about {carrier} would be carriers, and about {neither} would have neither.",
    "في المتوسط، من بين {denominator} حالة حمل بهذه النتيجة: في نحو {affected} منها يكون لدى الطفل الحالة، وفي نحو {carrier} منها يكون الطفل حاملًا، وفي نحو {neither} منها لا يكون الطفل حاملًا ولا لديه الحالة.",
    "اوسطاً، اس نتیجے والے {denominator} حمل میں سے تقریباً {affected} میں بچے کو یہ بیماری ہوتی ہے، تقریباً {carrier} میں بچہ کیریئر ہوتا ہے، اور تقریباً {neither} میں نہ بیماری ہوتی ہے اور نہ بچہ کیریئر ہوتا ہے۔",
  ),
  caption_son: tri(
    "Sons: on average, out of {denominator}, about {affected} would have the condition, about {carrier} would be carriers, and about {neither} would have neither.",
    "الأولاد: في المتوسط، من كل {denominator}، في نحو {affected} يكون لدى الولد الحالة، وفي نحو {carrier} يكون حاملًا، وفي نحو {neither} لا يكون حاملًا ولا لديه الحالة.",
    "بیٹے: اوسطاً، {denominator} میں سے تقریباً {affected} کو یہ بیماری ہوتی ہے، تقریباً {carrier} کیریئر ہوتے ہیں، اور تقریباً {neither} کو نہ بیماری ہوتی ہے اور نہ وہ کیریئر ہوتے ہیں۔",
  ),
  caption_daughter: tri(
    "Daughters: on average, out of {denominator}, about {affected} would have the condition, about {carrier} would be carriers, and about {neither} would have neither.",
    "البنات: في المتوسط، من كل {denominator}، في نحو {affected} يكون لدى البنت الحالة، وفي نحو {carrier} تكون حاملة، وفي نحو {neither} لا تكون حاملة ولا لديها الحالة.",
    "بیٹیاں: اوسطاً، {denominator} میں سے تقریباً {affected} کو یہ بیماری ہوتی ہے، تقریباً {carrier} کیریئر ہوتی ہیں، اور تقریباً {neither} کو نہ بیماری ہوتی ہے اور نہ وہ کیریئر ہوتی ہیں۔",
  ),
  lines_any: triList(
    [
      "{affected} out of {denominator} pregnancies: the child has the condition.",
      "{carrier} out of {denominator} pregnancies: the child is a carrier. Most carriers have no symptoms.",
      "{neither} out of {denominator} pregnancies: the child does not have the condition and is not a carrier.",
    ],
    [
      "{affected} من كل {denominator} حالة حمل: يكون لدى الطفل الحالة.",
      "{carrier} من كل {denominator} حالة حمل: يكون الطفل حاملًا للتغيّر. ومعظم الحاملين لا تظهر عليهم أعراض.",
      "{neither} من كل {denominator} حالة حمل: لا يكون لدى الطفل الحالة ولا يكون حاملًا.",
    ],
    [
      "{denominator} حمل میں سے {affected} میں: بچے کو یہ بیماری ہوتی ہے۔",
      "{denominator} حمل میں سے {carrier} میں: بچہ کیریئر ہوتا ہے۔ زیادہ تر کیریئر افراد میں کوئی علامت نہیں ہوتی۔",
      "{denominator} حمل میں سے {neither} میں: بچے کو یہ بیماری نہیں ہوتی اور وہ کیریئر بھی نہیں ہوتا۔",
    ],
  ),
  lines_son: triList(
    [
      "Sons: {affected} out of {denominator} would have the condition.",
      "Sons: {carrier} out of {denominator} would be carriers.",
      "Sons: {neither} out of {denominator} would have neither.",
    ],
    [
      "الأولاد: لدى {affected} من كل {denominator} الحالة.",
      "الأولاد: {carrier} من كل {denominator} حاملون للتغيّر.",
      "الأولاد: {neither} من كل {denominator} ليس لديهم الحالة وليسوا حاملين.",
    ],
    [
      "بیٹے: {denominator} میں سے {affected} کو یہ بیماری ہوتی ہے۔",
      "بیٹے: {denominator} میں سے {carrier} کیریئر ہوتے ہیں۔",
      "بیٹے: {denominator} میں سے {neither} کو نہ بیماری ہوتی ہے اور نہ وہ کیریئر ہوتے ہیں۔",
    ],
  ),
  lines_daughter: triList(
    [
      "Daughters: {affected} out of {denominator} would have the condition.",
      "Daughters: {carrier} out of {denominator} would be carriers.",
      "Daughters: {neither} out of {denominator} would have neither.",
    ],
    [
      "البنات: لدى {affected} من كل {denominator} الحالة.",
      "البنات: {carrier} من كل {denominator} حاملات للتغيّر.",
      "البنات: {neither} من كل {denominator} ليس لديهن الحالة وليسن حاملات.",
    ],
    [
      "بیٹیاں: {denominator} میں سے {affected} کو یہ بیماری ہوتی ہے۔",
      "بیٹیاں: {denominator} میں سے {carrier} کیریئر ہوتی ہیں۔",
      "بیٹیاں: {denominator} میں سے {neither} کو نہ بیماری ہوتی ہے اور نہ وہ کیریئر ہوتی ہیں۔",
    ],
  ),
  each_pregnancy: tri(
    "These numbers are averages across many pregnancies. Each pregnancy has the same chances, and earlier pregnancies do not change them.",
    "هذه الأرقام متوسطات تشمل حالات حمل كثيرة. ولكل حمل الاحتمالات نفسها، ولا تتغير بسبب حالات الحمل السابقة.",
    "یہ اعداد بہت سے حمل کی اوسط ہیں۔ ہر حمل کے امکانات ایک جیسے ہوتے ہیں، اور پہلے کے حمل انہیں نہیں بدلتے۔",
  ),
  not_heading: tri("What this result does not mean", "ما لا تعنيه هذه النتيجة", "اس نتیجے کا مطلب کیا نہیں ہے"),
  not_items: triList(
    [
      "It is a screening result, not a diagnosis.",
      "It is not a prediction for one particular pregnancy. The numbers describe averages.",
      "It is nobody's fault. People do not choose the changes they inherit.",
    ],
    [
      "هي نتيجة فحص وليست تشخيصًا.",
      "وهي ليست توقعًا لحمل بعينه، فالأرقام تصف متوسطات.",
      "ولا ذنب لأحد فيها، فالناس لا يختارون التغيّرات التي يرثونها.",
    ],
    [
      "یہ اسکریننگ کا نتیجہ ہے، تشخیص نہیں۔",
      "یہ کسی ایک خاص حمل کی پیش گوئی نہیں ہے۔ یہ اعداد اوسط بیان کرتے ہیں۔",
      "اس میں کسی کا قصور نہیں۔ لوگ ان تبدیلیوں کو خود نہیں چنتے جو انہیں وراثت میں ملتی ہیں۔",
    ],
  ),
  limits_heading: tri(
    "What this test can and cannot find",
    "ما يستطيع هذا الفحص كشفه وما لا يستطيع",
    "یہ ٹیسٹ کیا ڈھونڈ سکتا ہے اور کیا نہیں",
  ),
  limits_text: tri(
    "This test checks a chosen list of genes. No test finds every change, and this one does not cover every inherited condition. The detection rate used in this prototype is an assumption and is shown as illustrative; the clinical lead's sign-off is pending.",
    "يتحقق هذا الفحص من قائمة محددة من الجينات. ولا يكشف أي فحص كل التغيّرات، وهذا الفحص لا يشمل كل الحالات الوراثية. أما معدل الكشف المستخدم في هذا النموذج التجريبي فهو افتراض يُعرض بوصفه توضيحيًا، ومصادقة المسؤول السريري ما زالت في الانتظار.",
    "یہ ٹیسٹ جینز کی ایک منتخب فہرست دیکھتا ہے۔ کوئی بھی ٹیسٹ ہر تبدیلی نہیں ڈھونڈ سکتا، اور یہ ٹیسٹ ہر موروثی بیماری کا احاطہ نہیں کرتا۔ اس نمونے میں استعمال ہونے والی شرحِ شناخت ایک فرض کردہ قدر ہے جو محض مثال کے طور پر دکھائی گئی ہے، اور کلینیکل سربراہ کی تصدیق ابھی باقی ہے۔",
  ),
  next_shared: tri(
    "A genetic counsellor or a trained physician can go through this result with you, answer your questions and describe the choices that exist. What you decide is up to you.",
    "يستطيع مرشد وراثي أو طبيب مدرَّب أن يراجع معكما هذه النتيجة، ويجيب عن أسئلتكما، ويصف الخيارات المتاحة. وما تقرّرانه يعود إليكما.",
    "جینیاتی کونسلر یا تربیت یافتہ ڈاکٹر آپ کے ساتھ یہ نتیجہ دیکھ سکتے ہیں، آپ کے سوالوں کے جواب دے سکتے ہیں، اور بتا سکتے ہیں کہ کون سے اختیارات موجود ہیں۔ آپ جو بھی فیصلہ کریں، وہ آپ کی اپنی مرضی ہے۔",
  ),
  // ---- no shared change found ----------------------------------------------------------------------------
  h_no_shared: tri(
    "No shared change was found on this test",
    "لم يُعثر على تغيّر مشترك في هذا الفحص",
    "اس ٹیسٹ میں کوئی مشترک تبدیلی نہیں ملی",
  ),
  no_shared_summary: tri(
    "On this test, no change was found in a gene that both of you carry. This describes this test only.",
    "في هذا الفحص، لم يُعثر على تغيّر في جين يحمله كلاكما. وهذا وصف لهذا الفحص وحده.",
    "اس ٹیسٹ میں کوئی ایسی تبدیلی نہیں ملی جو آپ دونوں میں ایک ہی جین میں ہو۔ یہ بات صرف اسی ٹیسٹ کے بارے میں ہے۔",
  ),
  related_callout: tri(
    "Because the two of you are related, a test that finds nothing shared reassures less than it would for partners who are not related, and this page shows no number for that.",
    "بما أن بينكما صلة قرابة، فإن فحصًا لا يجد شيئًا مشتركًا يمنح طمأنينة أقل مما يمنحه لشريكين لا تربط بينهما قرابة، ولا تعرض هذه الصفحة رقمًا لذلك.",
    "چونکہ آپ دونوں آپس میں رشتے دار ہیں، اس لیے مشترک کچھ نہ ملنے والا ٹیسٹ اتنی تسلی نہیں دیتا جتنی ان ساتھیوں کو دیتا ہے جو رشتے دار نہیں، اور یہ صفحہ اس کے لیے کوئی عدد نہیں دکھاتا۔",
  ),
  no_shared_items: triList(
    [
      "It does not rule out every inherited condition. The test checks a chosen list of genes and cannot find every change.",
      "It does not mean that neither of you carries any gene change. Many people carry a change and never know it. What matters is whether both partners carry a change in the same gene.",
      "It is not a promise about any pregnancy.",
    ],
    [
      "لا تنفي هذه النتيجة كل الحالات الوراثية. فالفحص يتحقق من قائمة محددة من الجينات ولا يستطيع كشف كل التغيّرات.",
      "ولا تعني أن أيًّا منكما لا يحمل أي تغيّر جيني. فكثيرون يحملون تغيّرًا ولا يعرفون ذلك. والمهم هو ما إذا كان الشريكان يحملان تغيّرًا في الجين نفسه.",
      "وليست وعدًا بشأن أي حمل.",
    ],
    [
      "یہ نتیجہ ہر موروثی بیماری کو خارج نہیں کرتا۔ ٹیسٹ جینز کی ایک منتخب فہرست دیکھتا ہے اور ہر تبدیلی نہیں ڈھونڈ سکتا۔",
      "اس کا یہ مطلب نہیں کہ آپ میں سے کسی میں بھی جین کی کوئی تبدیلی نہیں۔ بہت سے لوگوں میں کوئی تبدیلی ہوتی ہے اور انہیں پتا نہیں چلتا۔ اہم بات یہ ہے کہ دونوں ساتھیوں میں ایک ہی جین میں تبدیلی ہے یا نہیں۔",
      "یہ کسی بھی حمل کے بارے میں کوئی وعدہ نہیں ہے۔",
    ],
  ),
  next_no_shared: tri(
    "If you have questions, or if a condition runs in your family, a genetic counsellor can talk with you. You can ask for this at any time.",
    "إذا كانت لديكما أسئلة، أو إذا كانت هناك حالة وراثية تتكرر في عائلتكما، يمكن لمرشد وراثي أن يتحدث معكما. وبإمكانكما طلب ذلك في أي وقت.",
    "اگر آپ کے سوالات ہیں، یا آپ کے خاندان میں کوئی موروثی بیماری چلی آ رہی ہے، تو جینیاتی کونسلر آپ سے بات کر سکتے ہیں۔ آپ کسی بھی وقت اس کے لیے کہہ سکتے ہیں۔",
  ),
  // ---- more information needed ---------------------------------------------------------------------------
  h_more_info: tri("More information is needed", "هناك حاجة إلى مزيد من المعلومات", "مزید معلومات درکار ہیں"),
  more_info_summary: tri(
    "The report contains a finding that needs more work before it can be called a result. For now it is not a result in either direction: it does not mean that something was found, and it does not mean that nothing was found.",
    "يتضمن التقرير أمرًا يحتاج إلى مزيد من العمل قبل أن يمكن اعتباره نتيجة. وهو الآن ليس نتيجة في أي اتجاه: فهو لا يعني أنه تم العثور على شيء، ولا يعني أنه لم يتم العثور على شيء.",
    "رپورٹ میں ایک ایسی بات ہے جس پر نتیجہ کہلانے سے پہلے مزید کام درکار ہے۔ فی الحال یہ کسی بھی سمت میں نتیجہ نہیں ہے: اس کا مطلب یہ نہیں کہ کچھ ملا ہے، اور یہ بھی نہیں کہ کچھ نہیں ملا۔",
  ),
  why_heading: tri(
    "Why more information is needed",
    "لماذا نحتاج إلى مزيد من المعلومات",
    "مزید معلومات کیوں درکار ہیں",
  ),
  reason_vus: tri(
    "A change of uncertain meaning was found. Doctors cannot yet say whether it is harmless or linked to a condition, so it is not counted as a result.",
    "عُثر على تغيّر غير واضح المعنى. لا يستطيع الأطباء حتى الآن القول إن كان غير ضار أم مرتبطًا بحالة، لذلك لا يُحتسب نتيجة.",
    "ایک ایسی تبدیلی ملی ہے جس کا مطلب واضح نہیں۔ ڈاکٹر ابھی یہ نہیں کہہ سکتے کہ یہ بے ضرر ہے یا کسی بیماری سے جڑی ہے، اس لیے اسے نتیجے میں شمار نہیں کیا جاتا۔",
  ),
  reason_cbc: tri(
    "Only a basic blood count was done. A basic blood count cannot show whether someone is a carrier, so more blood tests are needed.",
    "أُجري فقط فحص أساسي لتعداد الدم. والفحص الأساسي لتعداد الدم لا يبيّن ما إذا كان الشخص حاملًا، ولذلك يلزم إجراء المزيد من فحوص الدم.",
    "صرف خون کی بنیادی گنتی کی گئی ہے۔ بنیادی گنتی سے یہ پتا نہیں چل سکتا کہ کوئی کیریئر ہے یا نہیں، اس لیے خون کے مزید ٹیسٹ درکار ہیں۔",
  ),
  next_more_info: tri(
    "The next step is further testing or a specialist review, together with a visit to a genetic counsellor. They will tell you which extra test or review is needed and how long it may take.",
    "الخطوة التالية هي مزيد من الفحوص أو مراجعة أخصائي، مع زيارة لمرشد وراثي. سيخبركما بالفحص الإضافي أو المراجعة اللازمة وبالمدة التي قد يستغرقها ذلك.",
    "اگلا قدم مزید ٹیسٹ یا ماہر کا جائزہ ہے، اور اس کے ساتھ جینیاتی کونسلر سے ملاقات۔ وہ بتائیں گے کہ کون سا اضافی ٹیسٹ یا جائزہ درکار ہے اور اس میں کتنا وقت لگ سکتا ہے۔",
  ),
  callout_more_info: tri(
    "Until then, nothing here is counted as a result for either of you. This page says nothing about what the answer will be.",
    "إلى ذلك الحين، لا يُحتسب هنا أي شيء نتيجةً لأي منكما. وهذه الصفحة لا تقول شيئًا عمّا ستكون عليه الإجابة.",
    "تب تک یہاں کوئی چیز آپ دونوں میں سے کسی کے لیے نتیجہ شمار نہیں ہوتی۔ یہ صفحہ یہ نہیں بتاتا کہ جواب کیا ہوگا۔",
  ),
} as const;

export interface ResultDocInput {
  category: ResultCategory;
  related: boolean;
  shared: readonly SharedCondition[];
  reasons: readonly MoreInfoReason[];
}

function outcomeGroups(outcomes: readonly OutcomeLine[]): Map<OutcomeLine["applies_to"], { affected: number; carrier: number; neither: number }> {
  const groups = new Map<OutcomeLine["applies_to"], { affected: number; carrier: number; neither: number }>();
  for (const line of outcomes) {
    const group = groups.get(line.applies_to) ?? { affected: 0, carrier: 0, neither: 0 };
    group[line.label] = line.per_100;
    groups.set(line.applies_to, group);
  }
  return groups;
}

function basisTemplate(basis: SharedCondition["basis"], locale: Locale): { id: string; template: string } {
  switch (basis) {
    case "both_carriers":
      return { id: "shared.basis.both_carriers", template: RESULT_TEXT.basis_both_carriers[locale] };
    case "affected_partner_and_carrier":
      return { id: "shared.basis.affected_partner_and_carrier", template: RESULT_TEXT.basis_affected_carrier[locale] };
    case "x_linked_carrier_female":
      return { id: "shared.basis.x_linked_carrier_female", template: RESULT_TEXT.basis_x_carrier_female[locale] };
    case "both_affected":
    case "x_linked_affected_male":
      return { id: "shared.basis.generic", template: RESULT_TEXT.basis_generic[locale] };
  }
}

/** Builds the rendered explanation for one result category in one locale. The first heading is the headline. */
export function makeResultDoc(locale: Locale, input: ResultDocInput): ExplainerDoc {
  const doc = new DocBuilder(locale);
  const t = RESULT_TEXT;

  if (input.category === "shared_result_found") {
    doc.add("heading", "result.shared.heading", t.h_shared[locale]);
    doc.add("paragraph", "result.shared.summary", t.shared_summary[locale]);
    for (const condition of input.shared) {
      const basis = basisTemplate(condition.basis, locale);
      doc.add("paragraph", basis.id, basis.template, { gene: condition.gene });
    }
    doc.add("heading", "shared.pregnancy.heading", t.pregnancy_heading[locale]);
    doc.add("paragraph", "shared.outcomes.intro", t.pregnancy_intro[locale]);
    for (const condition of input.shared) {
      for (const [group, counts] of outcomeGroups(condition.outcomes)) {
        const captions = {
          any_child: t.caption_any[locale],
          son: t.caption_son[locale],
          daughter: t.caption_daughter[locale],
        } as const;
        const lines = {
          any_child: t.lines_any[locale],
          son: t.lines_son[locale],
          daughter: t.lines_daughter[locale],
        } as const;
        doc.iconArray(`icon_array.caption.${group}`, captions[group], counts, group);
        doc.list(`outcome.lines.${group}`, lines[group], counts, { prefix: group });
      }
    }
    doc.add("paragraph", "shared.outcomes.each_pregnancy", t.each_pregnancy[locale]);
    doc.add("heading", "meaning.not.heading", t.not_heading[locale]);
    doc.list("meaning.not.items", t.not_items[locale]);
    doc.add("heading", "limits.heading", t.limits_heading[locale]);
    doc.add("paragraph", "limits.panel_not_complete", t.limits_text[locale]);
    doc.add("paragraph", "shared.next", t.next_shared[locale]);
    doc.add("disclaimer", "boundary.education_decision_support", DISCLAIMER[locale], {}, { tone: "care" });
    return doc.finish(["carrier", "gene", "recessive", "natural_frequency", "detection_rate", "genetic_counsellor"]);
  }

  if (input.category === "no_shared_change_found") {
    doc.add("heading", "result.no_shared.heading", t.h_no_shared[locale]);
    doc.add("paragraph", "result.no_shared.summary", t.no_shared_summary[locale]);
    if (input.related) {
      doc.add("callout", "limits.related_couple", t.related_callout[locale], {}, { tone: "care" });
    }
    doc.add("heading", "meaning.not.heading", t.not_heading[locale]);
    doc.list("meaning.no_shared.items", t.no_shared_items[locale]);
    doc.add("heading", "limits.heading", t.limits_heading[locale]);
    doc.add("paragraph", "limits.panel_not_complete", t.limits_text[locale]);
    doc.add("paragraph", "no_shared.next", t.next_no_shared[locale]);
    doc.add("disclaimer", "boundary.education_decision_support", DISCLAIMER[locale], {}, { tone: "care" });
    return doc.finish(["gene", "detection_rate", "genetic_counsellor"]);
  }

  doc.add("heading", "result.more_info.heading", t.h_more_info[locale]);
  doc.add("paragraph", "result.more_info.summary", t.more_info_summary[locale]);
  doc.add("heading", "result.more_info.why", t.why_heading[locale]);
  const reasonTemplates = input.reasons.map((reason) =>
    reason === "vus_present" ? t.reason_vus[locale] : t.reason_cbc[locale],
  );
  doc.list("result.more_info.reasons", reasonTemplates);
  doc.add("paragraph", "more_info.next", t.next_more_info[locale]);
  doc.add("callout", "more_info.not_a_result", t.callout_more_info[locale], {}, { tone: "info" });
  doc.add("disclaimer", "boundary.education_decision_support", DISCLAIMER[locale], {}, { tone: "care" });
  return doc.finish(["carrier", "genetic_counsellor"]);
}

// ---- options pane (GET /v1/explain/options) -----------------------------------------------------------------

const OPTIONS_TEXT = {
  heading: tri("What you can do", "ما يمكنك فعله", "آپ کیا کر سکتے ہیں"),
  items: triList(
    [
      "Talk with a genetic counsellor or a trained physician about the result and what it means for your family.",
      "Ask about further testing, such as a confirmatory test or testing for a partner or relatives.",
      "Ask about testing before a pregnancy begins, at licensed reproduction centres (Federal Decree-Law {law_number}/{law_year}, Art. {art_11}).",
      "Ask about testing during a pregnancy to see whether a child has the condition.",
      "Take more time, and ask for information or another visit later, when you are ready.",
    ],
    [
      "التحدث مع مرشد وراثي أو طبيب مدرَّب عن النتيجة وعمّا تعنيه لعائلتك.",
      "السؤال عن فحوص إضافية، مثل فحص تأكيدي أو فحص للشريك أو للأقارب.",
      "السؤال عن الفحص قبل بدء الحمل في مراكز الإنجاب المرخّصة (المرسوم بقانون اتحادي رقم {law_number} لسنة {law_year}، المادة {art_11}).",
      "السؤال عن الفحص أثناء الحمل لمعرفة ما إذا كان لدى الطفل الحالة.",
      "أخذ مزيد من الوقت، وطلب معلومات أو زيارة أخرى لاحقًا حين تشاء.",
    ],
    [
      "جینیاتی کونسلر یا تربیت یافتہ ڈاکٹر سے نتیجے اور اپنے خاندان کے لیے اس کے مطلب پر بات کرنا۔",
      "مزید ٹیسٹ کے بارے میں پوچھنا، جیسے تصدیقی ٹیسٹ یا ساتھی یا رشتے داروں کا ٹیسٹ۔",
      "حمل شروع ہونے سے پہلے لائسنس یافتہ تولیدی مراکز میں ٹیسٹ کے بارے میں پوچھنا (وفاقی فرمان بقانون {law_number}/{law_year}، شق {art_11})۔",
      "حمل کے دوران ٹیسٹ کے بارے میں پوچھنا کہ آیا بچے کو یہ بیماری ہے۔",
      "مزید وقت لینا، اور جب آپ چاہیں بعد میں معلومات یا ایک اور ملاقات مانگنا۔",
    ],
  ),
  callout: tri(
    "None of these options is recommended. They are listed in a fixed order that is the same for everyone, and nobody here is telling you which one to take.",
    "لا يُوصى بأي من هذه الخيارات. وهي مرتبة ترتيبًا ثابتًا هو نفسه للجميع، ولا أحد هنا يحدد لك أيها تختار.",
    "ان میں سے کسی ایک کی سفارش نہیں کی جاتی۔ یہ ایک مقررہ ترتیب میں ہیں جو سب کے لیے ایک جیسی ہے، اور یہاں کوئی آپ کو یہ نہیں بتا رہا کہ کون سا چنیں۔",
  ),
  right_not_to_know: tri(
    "You may choose not to know some or all of your results. This is your right (Federal Decree-Law {law_number}/{law_year}, Art. {art_9}({art_9_para})), and you can change your mind later.",
    "يمكنك اختيار عدم معرفة بعض نتائجك أو كلها. وهذا حقك (المرسوم بقانون اتحادي رقم {law_number} لسنة {law_year}، المادة {art_9}({art_9_para}))، ويمكنك تغيير رأيك لاحقًا.",
    "آپ اپنے کچھ یا تمام نتائج نہ جاننے کا انتخاب کر سکتے ہیں۔ یہ آپ کا حق ہے (وفاقی فرمان بقانون {law_number}/{law_year}، شق {art_9}({art_9_para}))، اور آپ بعد میں اپنا فیصلہ بدل سکتے ہیں۔",
  ),
  prenatal: tri(
    "Prenatal diagnosis, which means testing during a pregnancy, is permitted by statute (Federal Decree-Law {law_number}/{law_year}, Art. {art_12}).",
    "التشخيص قبل الولادة، أي الفحص أثناء الحمل، مسموح به بموجب القانون (المرسوم بقانون اتحادي رقم {law_number} لسنة {law_year}، المادة {art_12}).",
    "پیدائش سے پہلے کی تشخیص، یعنی حمل کے دوران ٹیسٹ، قانون کے تحت جائز ہے (وفاقی فرمان بقانون {law_number}/{law_year}، شق {art_12})۔",
  ),
} as const;

export function makeOptionsDoc(locale: Locale): ExplainerDoc {
  const doc = new DocBuilder(locale);
  doc.add("heading", "options.heading", OPTIONS_TEXT.heading[locale]);
  doc.list("options.items", OPTIONS_TEXT.items[locale]);
  doc.add("callout", "options.order_note", OPTIONS_TEXT.callout[locale], {}, { tone: "info" });
  doc.add("paragraph", "options.rights", OPTIONS_TEXT.right_not_to_know[locale]);
  doc.add("paragraph", "options.prenatal_diagnosis", OPTIONS_TEXT.prenatal[locale]);
  doc.add("disclaimer", "boundary.education_decision_support", DISCLAIMER[locale], {}, { tone: "care" });
  return doc.finish(["genetic_counsellor"]);
}

// ---- glossary (GET /v1/explain/glossary) --------------------------------------------------------------------

interface GlossaryDef {
  key: string;
  term: Tri;
  definition: Tri;
}

const GLOSSARY_DEFS: readonly GlossaryDef[] = [
  {
    key: "carrier",
    term: tri("carrier", "الحامل للتغيّر", "کیریئر (carrier)"),
    definition: tri(
      "A carrier has one changed copy of a gene and one usual copy. For most inherited conditions that need two changed copies, a carrier has no symptoms.",
      "الحامل لديه نسخة واحدة متغيّرة من الجين ونسخة واحدة معتادة. وفي معظم الحالات الوراثية التي تتطلب نسختين متغيّرتين، لا تظهر على الحامل أعراض.",
      "کیریئر کے پاس جین کی ایک بدلی ہوئی کاپی اور ایک عام کاپی ہوتی ہے۔ زیادہ تر ان موروثی بیماریوں میں جن کے لیے دو بدلی ہوئی کاپیاں درکار ہوتی ہیں، کیریئر میں کوئی علامت نہیں ہوتی۔",
    ),
  },
  {
    key: "gene",
    term: tri("gene", "الجين", "جین (gene)"),
    definition: tri(
      "A gene is a set of instructions in your cells. You get one copy of each gene from each parent.",
      "الجين مجموعة تعليمات داخل خلاياك. يرث الإنسان نسخة من كل جين من كل من والديه.",
      "جین آپ کے خلیوں میں ہدایات کا ایک سیٹ ہے۔ ہر جین کی ایک کاپی آپ کو ماں سے اور ایک باپ سے ملتی ہے۔",
    ),
  },
  {
    key: "recessive",
    term: tri("recessive inheritance", "الوراثة المتنحية", "ریسیسو وراثت (recessive)"),
    definition: tri(
      "A recessive condition appears only when a child receives a changed copy of the gene from both parents. Each parent is usually a carrier and is usually well.",
      "تظهر الحالة المتنحية فقط عندما يرث الطفل نسخة متغيّرة من الجين من كلا الوالدين. وغالبًا ما يكون كل من الوالدين حاملًا وبصحة جيدة.",
      "ریسیسو بیماری تب ظاہر ہوتی ہے جب بچے کو جین کی بدلی ہوئی کاپی ماں اور باپ دونوں سے ملے۔ ماں اور باپ عموماً دونوں کیریئر ہوتے ہیں اور عموماً صحت مند ہوتے ہیں۔",
    ),
  },
  {
    key: "detection_rate",
    term: tri("detection rate", "معدل الكشف", "شرحِ شناخت (detection rate)"),
    definition: tri(
      "The detection rate tells how often a test finds a change that is really there. No test finds every change.",
      "يبيّن معدل الكشف عدد المرات التي يجد فيها الفحص تغيّرًا موجودًا فعلًا. ولا يكشف أي فحص كل التغيّرات.",
      "شرحِ شناخت بتاتی ہے کہ ٹیسٹ کتنی بار ایسی تبدیلی ڈھونڈ لیتا ہے جو واقعی موجود ہو۔ کوئی بھی ٹیسٹ ہر تبدیلی نہیں ڈھونڈ سکتا۔",
    ),
  },
  {
    key: "natural_frequency",
    term: tri(
      "chance out of 100 pregnancies",
      "الاحتمال من بين 100 حالة حمل",
      "100 حمل میں سے امکان",
    ),
    definition: tri(
      "We describe a chance as a number out of 100 pregnancies. A bigger number means a bigger chance. The same chances apply to every pregnancy.",
      "نصف الاحتمال بعدد من بين 100 حالة حمل. والعدد الأكبر يعني احتمالًا أكبر. ولكل حمل الاحتمالات نفسها.",
      "ہم امکان کو 100 حمل میں سے ایک عدد کے طور پر بیان کرتے ہیں۔ بڑا عدد بڑے امکان کو ظاہر کرتا ہے۔ ہر حمل کے امکانات ایک جیسے ہوتے ہیں۔",
    ),
  },
  {
    key: "genetic_counsellor",
    term: tri("genetic counsellor", "المرشد الوراثي", "جینیاتی کونسلر"),
    definition: tri(
      "A genetic counsellor is a health professional trained to explain genetic results and help families understand them. They do not tell you what to decide.",
      "المرشد الوراثي مختص صحي مدرَّب على شرح النتائج الوراثية ومساعدة العائلات على فهمها. ولا يقول لك ما تقرره.",
      "جینیاتی کونسلر ایک تربیت یافتہ ماہرِ صحت ہوتا ہے جو جینیاتی نتائج سمجھانے اور خاندانوں کو انہیں سمجھنے میں مدد دینے کا کام کرتا ہے۔ وہ آپ کو یہ نہیں بتاتا کہ آپ کیا فیصلہ کریں۔",
    ),
  },
];

export function makeGlossary(locale: Locale): GlossaryEntry[] {
  return GLOSSARY_DEFS.map((d) => ({ key: d.key, term: d.term[locale], definition: d.definition[locale] }));
}

// ---------------------------------------------------------------------------------------------------------
// Closure instruments (research 04 sections 2.1 to 2.3): 8 patient items, 12-field proforma, service interest.
// There is no marriage-decision field anywhere (research 04 section 2.2: the field is dropped).
// ---------------------------------------------------------------------------------------------------------

interface ChoiceDef {
  id: string;
  text: Tri;
}

interface PatientItemDef {
  id: string;
  kind: PatientItem["kind"];
  prompt: Tri;
  choices: readonly ChoiceDef[];
}

const TRUE_FALSE_UNSURE: readonly ChoiceDef[] = [
  { id: "true", text: tri("True", "صحيح", "درست") },
  { id: "false", text: tri("False", "خطأ", "غلط") },
  { id: "not_sure", text: tri("Not sure", "غير متأكد", "یقین نہیں") },
];

const AGREE_1_5: readonly ChoiceDef[] = [
  { id: "1", text: tri("1 (strongly disagree)", "1 (لا أوافق إطلاقًا)", "1 (بالکل متفق نہیں)") },
  { id: "2", text: tri("2", "2", "2") },
  { id: "3", text: tri("3", "3", "3") },
  { id: "4", text: tri("4", "4", "4") },
  { id: "5", text: tri("5 (strongly agree)", "5 (أوافق تمامًا)", "5 (مکمل متفق)") },
];

const PATIENT_ITEMS: readonly PatientItemDef[] = [
  {
    id: "own_words",
    kind: "free_text",
    prompt: tri(
      "In your own words, what does this result mean for the two of you?",
      "بكلماتك أنت، ماذا تعني هذه النتيجة لكما؟",
      "اپنے الفاظ میں بتائیں، اس نتیجے کا آپ دونوں کے لیے کیا مطلب ہے؟",
    ),
    choices: [],
  },
  {
    id: "out_of_100",
    kind: "integer_0_100",
    prompt: tri(
      "Out of 100 pregnancies of couples with this same result, about how many children would have the condition?",
      "من بين 100 حالة حمل لأزواج لديهم النتيجة نفسها، في كم حالة تقريبًا يكون لدى الطفل الحالة؟",
      "اسی نتیجے والے جوڑوں کے 100 حمل میں سے تقریباً کتنے بچوں کو یہ بیماری ہوگی؟",
    ),
    choices: [],
  },
  {
    id: "carrier_is_disease",
    kind: "true_false_unsure",
    prompt: tri(
      "Being a carrier means the person has the disease.",
      "أن يكون الشخص حاملًا للتغيّر يعني أنه مصاب بالمرض.",
      "کیریئر ہونے کا مطلب ہے کہ اس شخص کو بیماری ہے۔",
    ),
    choices: TRUE_FALSE_UNSURE,
  },
  {
    id: "negative_means_none",
    kind: "true_false_unsure",
    prompt: tri(
      "If the test found nothing shared, our children cannot have any inherited condition.",
      "إذا لم يجد الفحص شيئًا مشتركًا، فلا يمكن أن يكون لدى أطفالنا أي حالة وراثية.",
      "اگر ٹیسٹ میں کچھ مشترک نہیں ملا تو ہمارے بچوں کو کوئی موروثی بیماری ہو ہی نہیں سکتی۔",
    ),
    choices: TRUE_FALSE_UNSURE,
  },
  {
    id: "next_step",
    kind: "single_choice",
    prompt: tri(
      "What is the next step, and who is responsible for it?",
      "ما الخطوة التالية، ومن المسؤول عنها؟",
      "اگلا قدم کیا ہے، اور اس کی ذمہ داری کس پر ہے؟",
    ),
    choices: [
      {
        id: "counsellor_explains",
        text: tri(
          "A counsellor or doctor explains the result and the choices to us",
          "يشرح لنا مرشد أو طبيب النتيجة والخيارات",
          "کونسلر یا ڈاکٹر ہمیں نتیجہ اور اختیارات سمجھاتے ہیں",
        ),
      },
      {
        id: "centre_decides",
        text: tri(
          "The screening centre decides for us",
          "يقرر مركز الفحص نيابةً عنا",
          "اسکریننگ سینٹر ہماری طرف سے فیصلہ کرتا ہے",
        ),
      },
      {
        id: "nothing_more",
        text: tri("Nothing more happens", "لا يحدث شيء آخر", "اس کے بعد کچھ نہیں ہوتا"),
      },
      {
        id: "find_lab_yourself",
        text: tri(
          "We find a laboratory ourselves",
          "نبحث نحن عن مختبر بأنفسنا",
          "ہم خود کوئی لیبارٹری ڈھونڈتے ہیں",
        ),
      },
    ],
  },
  {
    id: "values_clarity",
    kind: "agree_1_5",
    prompt: tri(
      "I know what matters most to us when choosing what to do next.",
      "أعرف ما هو الأهم بالنسبة إلينا عند اختيار ما نفعله بعد ذلك.",
      "مجھے معلوم ہے کہ آگے کیا کرنا ہے، یہ چننے میں ہمارے لیے سب سے اہم بات کیا ہے۔",
    ),
    choices: AGREE_1_5,
  },
  {
    id: "felt_free",
    kind: "agree_1_5",
    prompt: tri(
      "I felt free to choose. Nobody pushed us in a direction.",
      "شعرتُ بحرية الاختيار. لم يدفعنا أحد في اتجاه معيّن.",
      "مجھے اختیار کی آزادی محسوس ہوئی۔ کسی نے ہمیں کسی خاص سمت میں نہیں دھکیلا۔",
    ),
    choices: AGREE_1_5,
  },
  {
    id: "who_can_see",
    kind: "single_choice",
    prompt: tri("Who can see our result?", "من يمكنه الاطّلاع على نتيجتنا؟", "ہمارا نتیجہ کون دیکھ سکتا ہے؟"),
    choices: [
      { id: "only_me", text: tri("Only me", "أنا فقط", "صرف میں") },
      { id: "me_and_partner", text: tri("Me and my partner", "أنا وشريك حياتي", "میں اور میرا ساتھی") },
      {
        id: "family_i_choose",
        text: tri("Family members I choose", "أفراد من العائلة أختارهم أنا", "میرے منتخب کردہ خاندان کے افراد"),
      },
      { id: "nobody_else", text: tri("Nobody else", "لا أحد آخر", "اور کوئی نہیں") },
    ],
  },
];

interface ProformaDef {
  id: string;
  number: number;
  label: Tri;
  filled_by: ProformaField["filled_by"];
  kind: ProformaField["kind"];
  choices: readonly ChoiceDef[];
  hint: Tri | null;
}

const SERVICE_OPTIONS: readonly ChoiceDef[] = [
  { id: "yes_now", text: tri("Yes, now", "نعم، الآن", "جی ہاں، ابھی") },
  {
    id: "yes_later",
    text: tri("Yes, later (remind me)", "نعم، لاحقًا (ذكّروني)", "جی ہاں، بعد میں (مجھے یاد دلائیں)"),
  },
  { id: "no_thanks", text: tri("No thank you", "لا، شكرًا", "نہیں، شکریہ") },
  { id: "prefer_not_to_say", text: tri("Prefer not to say", "أفضّل ألّا أجيب", "جواب دینا پسند نہیں") },
];

const SERVICE_TOPICS: readonly ChoiceDef[] = [
  {
    id: "preconception_counselling",
    text: tri("Counselling before pregnancy", "الإرشاد قبل الحمل", "حمل سے پہلے کونسلنگ"),
  },
  {
    id: "partner_or_relative_testing",
    text: tri("Testing for a partner or relatives", "فحص الشريك أو الأقارب", "ساتھی یا رشتے داروں کا ٹیسٹ"),
  },
  {
    id: "conception_options_information",
    text: tri(
      "Information about options for starting a family",
      "معلومات عن خيارات تكوين أسرة",
      "خاندان شروع کرنے کے اختیارات کے بارے میں معلومات",
    ),
  },
  {
    id: "prenatal_testing_information",
    text: tri(
      "Information about testing during pregnancy",
      "معلومات عن الفحوص أثناء الحمل",
      "حمل کے دوران ٹیسٹ کے بارے میں معلومات",
    ),
  },
  {
    id: "talk_to_counsellor_again",
    text: tri("Talk with a counsellor again", "التحدث مع مرشد مرة أخرى", "دوبارہ کونسلر سے بات کرنا"),
  },
];

const SERVICE_PROMPT = tri(
  "Would you like information about services for planning a pregnancy?",
  "هل ترغب في الحصول على معلومات عن خدمات التخطيط للحمل؟",
  "کیا آپ حمل کی منصوبہ بندی کی خدمات کے بارے میں معلومات چاہیں گے؟",
);

/** Consent wording from research 04 section 2.2 (original text). Nothing about not recording marriage plans is removed. */
const SERVICE_CONSENT = tri(
  "We can send you information about services for planning a pregnancy when you are ready, for example counselling before pregnancy, testing for a partner or relatives, and options for starting a family. This is your choice. Your answer does not change your result, is not shown to your partner, family, employer or insurer, and we do not record whether you plan to marry. You can say not now or no thank you, and you can change your mind at any time in Settings. If you say yes, we use only the contact method you choose, and only to send this information.",
  "يمكننا أن نرسل لك معلومات عن خدمات التخطيط للحمل حين ترغب في ذلك، مثل الإرشاد قبل الحمل، وفحص الشريك أو الأقارب، وخيارات تكوين أسرة. هذا قرارك أنت. وإجابتك لا تغيّر نتيجتك، ولا تُعرض على شريك حياتك أو عائلتك أو جهة عملك أو شركة التأمين عبر هذه الخدمة، ولا نسجّل ما إذا كنت تنوي الزواج. يمكنك أن تجيب بـ«ليس الآن» أو «لا، شكرًا»، ويمكنك تغيير رأيك في أي وقت من الإعدادات. وإذا اخترت «نعم»، فنستخدم وسيلة التواصل التي تختارها فقط، ولإرسال هذه المعلومات فقط.",
  "ہم آپ کو حمل کی منصوبہ بندی کی خدمات کے بارے میں معلومات بھیج سکتے ہیں، جب آپ تیار ہوں، مثلاً حمل سے پہلے کونسلنگ، ساتھی یا رشتے داروں کا ٹیسٹ، اور خاندان شروع کرنے کے اختیارات۔ یہ آپ کی اپنی مرضی ہے۔ آپ کا جواب آپ کا نتیجہ نہیں بدلتا، اس سروس کے ذریعے آپ کے ساتھی، خاندان، آجر یا بیمہ کمپنی کو نہیں دکھایا جاتا، اور ہم یہ ریکارڈ نہیں کرتے کہ آپ شادی کا ارادہ رکھتے ہیں یا نہیں۔ آپ «ابھی نہیں» یا «نہیں، شکریہ» کہہ سکتے ہیں، اور سیٹنگز میں جا کر کسی بھی وقت اپنا فیصلہ بدل سکتے ہیں۔ اگر آپ «ہاں» کہتے ہیں تو ہم صرف وہی رابطے کا طریقہ استعمال کرتے ہیں جو آپ چنیں، اور صرف یہی معلومات بھیجنے کے لیے۔",
);

const PROFORMA: readonly ProformaDef[] = [
  {
    id: "encounter",
    number: 1,
    label: tri("Visit", "الزيارة", "ملاقات"),
    filled_by: "system",
    kind: "datetime",
    choices: [],
    hint: tri(
      "Date, mode, length, session language and whether an interpreter was used. The system fills in the times; you confirm.",
      "التاريخ ونمط الزيارة ومدتها ولغة الجلسة، وهل استُعين بمترجم. يملأ النظام الأوقات ثم تؤكدها أنت.",
      "تاریخ، ملاقات کا طریقہ، دورانیہ، سیشن کی زبان، اور یہ کہ مترجم استعمال ہوا یا نہیں۔ اوقات نظام بھرتا ہے، آپ تصدیق کریں گے۔",
    ),
  },
  {
    id: "risk_signal",
    number: 2,
    label: tri("When the result was released", "وقت إصدار النتيجة", "نتیجہ جاری ہونے کا وقت"),
    filled_by: "system",
    kind: "system",
    choices: [],
    hint: tri(
      "Filled in by the system from the pathway record.",
      "يملؤه النظام من سجل المسار.",
      "نظام اسے مسار کے ریکارڈ سے بھرتا ہے۔",
    ),
  },
  {
    id: "findings_discussed",
    number: 3,
    label: tri("Findings discussed", "النتائج التي نُوقشت", "جن نتائج پر بات ہوئی"),
    filled_by: "clinician",
    kind: "checklist",
    choices: [
      {
        id: "shared_result_discussed",
        text: tri(
          "The couple-level result was discussed",
          "نوقشت نتيجة الزوجين معًا",
          "جوڑے کے مشترکہ نتیجے پر بات ہوئی",
        ),
      },
      {
        id: "explained_as_chance",
        text: tri(
          "Explained as a chance, not a diagnosis",
          "تم شرحها بوصفها احتمالًا لا تشخيصًا",
          "امکان کے طور پر سمجھایا گیا، تشخیص کے طور پر نہیں",
        ),
      },
      {
        id: "marked_uncertain",
        text: tri(
          "Uncertainty was explained where there was any",
          "شُرح عدم اليقين حيثما وُجد",
          "جہاں غیر یقینی تھی وہاں وضاحت کی گئی",
        ),
      },
    ],
    hint: tri(
      "Tick each finding that was discussed. Mark whether it was explained as a chance and not a diagnosis, and whether it was uncertain.",
      "ضع علامة على كل نتيجة جرت مناقشتها. وبيّن هل شُرحت بوصفها احتمالًا لا تشخيصًا، وهل كانت غير مؤكدة.",
      "جن نتائج پر بات ہوئی ان پر نشان لگائیں۔ بتائیں کہ آیا انہیں امکان کے طور پر سمجھایا گیا نہ کہ تشخیص کے طور پر، اور آیا وہ غیر یقینی تھیں۔",
    ),
  },
  {
    id: "information_given",
    number: 4,
    label: tri("Information given", "المعلومات المقدَّمة", "دی گئی معلومات"),
    filled_by: "clinician",
    kind: "checklist",
    choices: [
      {
        id: "carrier_vs_disease",
        text: tri(
          "A carrier is not ill, and a result is not a diagnosis",
          "الحامل للتغيّر ليس مريضًا، والنتيجة ليست تشخيصًا",
          "کیریئر بیمار نہیں ہوتا، اور نتیجہ تشخیص نہیں ہے",
        ),
      },
      {
        id: "couple_numbers",
        text: tri(
          "The couple numbers out of 100 pregnancies",
          "أرقام الزوجين من بين 100 حالة حمل",
          "100 حمل میں سے جوڑے کے اعداد",
        ),
      },
      {
        id: "test_limits",
        text: tri(
          "What the test can and cannot find",
          "ما يستطيع الفحص كشفه وما لا يستطيع",
          "ٹیسٹ کیا ڈھونڈ سکتا ہے اور کیا نہیں",
        ),
      },
      {
        id: "options_neutral_order",
        text: tri(
          "Choices that exist, in a neutral order",
          "الخيارات المتاحة بترتيب محايد",
          "موجود اختیارات، غیر جانب دار ترتیب میں",
        ),
      },
      {
        id: "right_not_to_know",
        text: tri("The right not to know", "الحق في عدم المعرفة", "نہ جاننے کا حق"),
      },
      {
        id: "who_can_see_result",
        text: tri("Who can see the result", "من يحق له الاطّلاع على النتيجة", "نتیجہ کون دیکھ سکتا ہے"),
      },
      {
        id: "how_to_reach_us",
        text: tri(
          "How to reach the counselling service",
          "كيفية التواصل مع خدمة الإرشاد",
          "کونسلنگ سروس سے رابطہ کیسے کریں",
        ),
      },
    ],
    hint: tri(
      "Tick each point that was explained.",
      "ضع علامة على كل نقطة جرى شرحها.",
      "جو نکتہ سمجھایا گیا اس پر نشان لگائیں۔",
    ),
  },
  {
    id: "options_discussed",
    number: 5,
    label: tri(
      "Choices discussed and next step",
      "الخيارات التي نوقشت والخطوة التالية",
      "زیرِ بحث اختیارات اور اگلا قدم",
    ),
    filled_by: "clinician",
    kind: "single_choice",
    choices: [
      {
        id: "decided",
        text: tri(
          "The next clinical step is decided",
          "تم تحديد الخطوة السريرية التالية",
          "اگلا طبی قدم طے ہو گیا",
        ),
      },
      {
        id: "still_deciding",
        text: tri("Still deciding", "ما زال القرار قيد التفكير", "ابھی فیصلہ زیرِ غور ہے"),
      },
      {
        id: "declined_to_discuss",
        text: tri(
          "Chose not to discuss it now",
          "اختارا عدم مناقشته الآن",
          "ابھی اس پر بات نہ کرنے کا انتخاب کیا",
        ),
      },
    ],
    hint: tri(
      "Choices are described in a fixed neutral order. None is recommended. Record only the status of the next clinical step.",
      "تُعرض الخيارات بترتيب ثابت ومحايد، ولا يُوصى بأي منها. سجّل فقط حالة الخطوة السريرية التالية.",
      "اختیارات ایک مقررہ غیر جانب دار ترتیب میں بتائے جاتے ہیں۔ کسی ایک کی سفارش نہیں کی جاتی۔ صرف اگلے طبی قدم کی کیفیت درج کریں۔",
    ),
  },
  {
    id: "teach_back",
    number: 6,
    label: tri("Teach-back", "إعادة الشرح (Teach-back)", "ٹیچ بیک (دہرا کر بتانا)"),
    filled_by: "clinician",
    kind: "single_choice",
    choices: [
      { id: "not_done", text: tri("Not done", "لم يُجرَ", "نہیں کیا گیا") },
      { id: "accurate", text: tri("Accurate", "دقيق", "درست") },
      { id: "partly", text: tri("Partly accurate", "دقيق جزئيًا", "جزوی طور پر درست") },
      {
        id: "repeat_needed",
        text: tri("Another explanation is needed", "يلزم شرح إضافي", "دوبارہ وضاحت درکار ہے"),
      },
    ],
    hint: tri(
      "Did the couple explain the result back in their own words? Record how accurate it was.",
      "هل أعاد الزوجان شرح النتيجة بكلماتهما؟ سجّل مدى دقة ذلك.",
      "کیا جوڑے نے نتیجہ اپنے الفاظ میں دہرایا؟ درج کریں کہ وہ کتنا درست تھا۔",
    ),
  },
  {
    id: "patient_questions",
    number: 7,
    label: tri("Questions", "الأسئلة", "سوالات"),
    filled_by: "clinician",
    kind: "yes_no",
    choices: [
      { id: "yes", text: tri("Yes", "نعم", "جی ہاں") },
      { id: "no", text: tri("No", "لا", "نہیں") },
    ],
    hint: tri(
      "Were questions invited, and were they answered?",
      "هل دُعي الزوجان إلى طرح الأسئلة، وهل أُجيب عنها؟",
      "کیا سوال پوچھنے کی دعوت دی گئی، اور کیا جواب دیے گئے؟",
    ),
  },
  {
    id: "plan",
    number: 8,
    label: tri("Plan", "الخطة", "منصوبہ"),
    filled_by: "clinician",
    kind: "action_list",
    choices: [
      { id: "confirmatory_test", text: tri("Confirmatory test", "فحص تأكيدي", "تصدیقی ٹیسٹ") },
      {
        id: "partner_testing",
        text: tri(
          "Testing for a partner or relative",
          "فحص للشريك أو أحد الأقارب",
          "ساتھی یا رشتے دار کا ٹیسٹ",
        ),
      },
      { id: "referral", text: tri("Referral", "إحالة", "ریفرل") },
      { id: "recontact", text: tri("Get in touch again", "التواصل مجددًا", "دوبارہ رابطہ") },
    ],
    hint: tri(
      "Each action has an owner and a due date.",
      "لكل إجراء مسؤول وموعد استحقاق.",
      "ہر کام کا ایک ذمہ دار اور آخری تاریخ ہوتی ہے۔",
    ),
  },
  {
    id: "referral_task",
    number: 9,
    label: tri("Referral tasks", "مهام الإحالة", "ریفرل ٹاسک"),
    filled_by: "system",
    kind: "system",
    choices: [],
    hint: tri(
      "Filled in by the system from the referral tasks.",
      "يملؤها النظام من مهام الإحالة.",
      "نظام اسے ریفرل ٹاسکس سے بھرتا ہے۔",
    ),
  },
  {
    id: "service_preference",
    number: 10,
    label: tri("Future services", "الخدمات المستقبلية", "مستقبل کی خدمات"),
    filled_by: "patient",
    kind: "single_choice",
    choices: SERVICE_OPTIONS,
    hint: tri(
      "The person's own opt-in answer. Filled in by the person, not by you.",
      "إجابة الشخص الاختيارية بنفسه. يملؤها الشخص نفسه، لا أنت.",
      "فرد کا اپنا اختیاری جواب۔ اسے وہ فرد خود بھرتا ہے، آپ نہیں۔",
    ),
  },
  {
    id: "sharing_and_consent",
    number: 11,
    label: tri("Sharing and consent", "المشاركة والموافقة", "شیئرنگ اور رضامندی"),
    filled_by: "system",
    kind: "system",
    choices: [],
    hint: tri(
      "Whether a copy was given to the patient. The system adds the consent record.",
      "هل أُعطيت نسخة للمريض. يضيف النظام سجل الموافقة.",
      "کیا مریض کو کاپی دی گئی۔ رضامندی کا ریکارڈ نظام شامل کرتا ہے۔",
    ),
  },
  {
    id: "completed_by",
    number: 12,
    label: tri("Completed by", "أُكمل بواسطة", "تکمیل کنندہ"),
    filled_by: "system",
    kind: "system",
    choices: [],
    hint: tri(
      "Filled in by the system: your role and the time.",
      "يملؤه النظام: دورك والوقت.",
      "نظام بھرتا ہے: آپ کا کردار اور وقت۔",
    ),
  },
];

const toChoices = (defs: readonly ChoiceDef[], locale: Locale): ClosureChoice[] =>
  defs.map((c) => ({ id: c.id, text: c.text[locale] }));

export function makeClosureSchema(locale: Locale): ClosureSchema {
  return {
    language_status: "draft",
    patient_items: PATIENT_ITEMS.map((item) => ({
      id: item.id,
      kind: item.kind,
      prompt: item.prompt[locale],
      choices: toChoices(item.choices, locale),
    })),
    proforma_fields: PROFORMA.map((field) => ({
      id: field.id,
      number: field.number,
      label: field.label[locale],
      filled_by: field.filled_by,
      kind: field.kind,
      choices: toChoices(field.choices, locale),
      hint: field.hint === null ? null : field.hint[locale],
    })),
    service_interest: {
      prompt: SERVICE_PROMPT[locale],
      options: toChoices(SERVICE_OPTIONS, locale),
      topics: toChoices(SERVICE_TOPICS, locale),
      consent_text: SERVICE_CONSENT[locale],
    },
  };
}

// ---------------------------------------------------------------------------------------------------------
// Teach-back quiz: 4 multiple-choice questions, three languages
// ---------------------------------------------------------------------------------------------------------

interface TeachBackDef {
  id: string;
  correct: string;
  prompt: Tri;
  choices: readonly ChoiceDef[];
  explanation: Tri;
}

const TEACHBACK: readonly TeachBackDef[] = [
  {
    id: "tb1",
    correct: "a",
    prompt: tri(
      "What does it mean to be a carrier?",
      "ماذا يعني أن يكون الشخص حاملًا للتغيّر؟",
      "کیریئر ہونے کا کیا مطلب ہے؟",
    ),
    choices: [
      {
        id: "a",
        text: tri(
          "The person has one changed copy of a gene and usually has no symptoms",
          "لديه نسخة واحدة متغيّرة من الجين، وغالبًا لا تظهر عليه أعراض",
          "اس کے پاس جین کی ایک بدلی ہوئی کاپی ہوتی ہے اور عموماً کوئی علامت نہیں ہوتی",
        ),
      },
      {
        id: "b",
        text: tri("The person has the condition", "لديه الحالة نفسها", "اسے خود بیماری ہوتی ہے"),
      },
      {
        id: "c",
        text: tri(
          "Every child of the person will have the condition",
          "سيكون لدى كل طفل من أطفاله الحالة",
          "اس کے ہر بچے کو بیماری ہوگی",
        ),
      },
    ],
    explanation: tri(
      "Correct answer: a carrier has one changed copy of a gene and one usual copy, and usually has no symptoms. A carrier is not the same as a person who has the condition.",
      "الإجابة الصحيحة: الحامل لديه نسخة واحدة متغيّرة من الجين ونسخة معتادة، وغالبًا لا تظهر عليه أعراض. والحامل ليس هو الشخص الذي لديه الحالة.",
      "درست جواب: کیریئر کے پاس جین کی ایک بدلی ہوئی اور ایک عام کاپی ہوتی ہے، اور عموماً کوئی علامت نہیں ہوتی۔ کیریئر اور بیماری والا شخص ایک جیسے نہیں ہوتے۔",
    ),
  },
  {
    id: "tb2",
    correct: "c",
    prompt: tri(
      "If no shared change was found on this test, what does that mean?",
      "إذا لم يُعثر على تغيّر مشترك في هذا الفحص، فماذا يعني ذلك؟",
      "اگر اس ٹیسٹ میں کوئی مشترک تبدیلی نہیں ملی تو اس کا کیا مطلب ہے؟",
    ),
    choices: [
      {
        id: "a",
        text: tri(
          "Their children cannot have any inherited condition",
          "لا يمكن أن يكون لدى أطفالهما أي حالة وراثية",
          "ان کے بچوں کو کوئی موروثی بیماری ہو ہی نہیں سکتی",
        ),
      },
      {
        id: "b",
        text: tri(
          "Neither partner carries any gene change",
          "لا أحد من الشريكين يحمل أي تغيّر جيني",
          "دونوں ساتھیوں میں سے کسی میں بھی جین کی کوئی تبدیلی نہیں",
        ),
      },
      {
        id: "c",
        text: tri(
          "On this test, no change was found in a gene that both partners carry. It does not rule out every inherited condition",
          "في هذا الفحص، لم يُعثر على تغيّر في جين يحمله كلا الشريكين. وهذا لا ينفي كل الحالات الوراثية",
          "اس ٹیسٹ میں کوئی ایسی تبدیلی نہیں ملی جو دونوں ساتھیوں میں ایک ہی جین میں ہو۔ یہ ہر موروثی بیماری کو خارج نہیں کرتا",
        ),
      },
    ],
    explanation: tri(
      "Correct answer: it describes this test only. No change was found in a gene that both partners carry, but a test checks a chosen list of genes and cannot find every change.",
      "الإجابة الصحيحة: هذا وصف لهذا الفحص وحده. لم يُعثر على تغيّر في جين يحمله كلا الشريكين، لكن الفحص يتحقق من قائمة محددة من الجينات ولا يستطيع كشف كل التغيّرات.",
      "درست جواب: یہ بات صرف اسی ٹیسٹ کے بارے میں ہے۔ دونوں ساتھیوں میں ایک ہی جین میں کوئی تبدیلی نہیں ملی، لیکن ٹیسٹ جینز کی ایک منتخب فہرست دیکھتا ہے اور ہر تبدیلی نہیں ڈھونڈ سکتا۔",
    ),
  },
  {
    id: "tb3",
    correct: "b",
    prompt: tri("Who can see your result?", "من يمكنه الاطّلاع على نتيجتك؟", "آپ کا نتیجہ کون دیکھ سکتا ہے؟"),
    choices: [
      {
        id: "a",
        text: tri(
          "Your employer can ask to see it",
          "يستطيع صاحب العمل أن يطلب الاطّلاع عليها",
          "آپ کا آجر اسے دیکھنے کا مطالبہ کر سکتا ہے",
        ),
      },
      {
        id: "b",
        text: tri(
          "You see your own result, and your partner sees details only if you agree. Employers and insurers may not ask for it or use it",
          "أنت تطّلع على نتيجتك، ولا يطّلع شريك حياتك على التفاصيل إلا إذا وافقت. ولا يحق لأصحاب العمل ولا لشركات التأمين أن يطلبوها أو يستخدموها",
          "آپ اپنا نتیجہ خود دیکھتے ہیں، اور آپ کا ساتھی تفصیل صرف تب دیکھتا ہے جب آپ رضامند ہوں۔ آجر اور بیمہ کمپنیاں اسے مانگ نہیں سکتیں اور استعمال نہیں کر سکتیں",
        ),
      },
      {
        id: "c",
        text: tri(
          "Any relative can ask to see it",
          "يستطيع أي قريب أن يطلب الاطّلاع عليها",
          "کوئی بھی رشتے دار اسے دیکھنے کا مطالبہ کر سکتا ہے",
        ),
      },
    ],
    explanation: tri(
      "Correct answer: you see your own result, and your partner sees details only if you agree. Employers and insurers may not require or use genetic results (Decree-Law 49/2023, Art. 19 to 21).",
      "الإجابة الصحيحة: أنت تطّلع على نتيجتك، ولا يطّلع شريك حياتك على التفاصيل إلا إذا وافقت. ولا يحق لأصحاب العمل ولا لشركات التأمين أن يطلبوا النتائج الجينية أو يستخدموها (المرسوم بقانون 49 لسنة 2023، المواد 19 إلى 21).",
      "درست جواب: آپ اپنا نتیجہ خود دیکھتے ہیں، اور آپ کا ساتھی تفصیل صرف تب دیکھتا ہے جب آپ رضامند ہوں۔ آجر اور بیمہ کمپنیاں جینیاتی نتائج مانگ نہیں سکتیں اور استعمال نہیں کر سکتیں (فرمان بقانون 49/2023، شقیں 19 تا 21)۔",
    ),
  },
  {
    id: "tb4",
    correct: "c",
    prompt: tri(
      "What is a next step that is offered after a result like this?",
      "ما الخطوة التالية المتاحة بعد نتيجة كهذه؟",
      "اس طرح کے نتیجے کے بعد اگلا کون سا قدم پیش کیا جاتا ہے؟",
    ),
    choices: [
      {
        id: "a",
        text: tri(
          "Nothing more happens, and the process is finished",
          "لا يحدث شيء آخر وتنتهي العملية",
          "اس کے بعد کچھ نہیں ہوتا اور عمل ختم ہو جاتا ہے",
        ),
      },
      {
        id: "b",
        text: tri(
          "The test is repeated at home",
          "يُعاد الفحص في المنزل",
          "ٹیسٹ گھر پر دوبارہ کیا جاتا ہے",
        ),
      },
      {
        id: "c",
        text: tri(
          "A visit with a genetic counsellor or a trained physician, who goes through the result and the choices that exist",
          "زيارة لمرشد وراثي أو طبيب مدرَّب يراجع النتيجة والخيارات المتاحة",
          "جینیاتی کونسلر یا تربیت یافتہ ڈاکٹر سے ملاقات، جو نتیجہ اور موجود اختیارات سمجھاتے ہیں",
        ),
      },
    ],
    explanation: tri(
      "Correct answer: a genetic counsellor or a trained physician can go through the result with you and describe the choices that exist. Screening is done at licensed centres, not at home.",
      "الإجابة الصحيحة: يستطيع مرشد وراثي أو طبيب مدرَّب أن يراجع معك النتيجة ويصف الخيارات المتاحة. ويُجرى الفحص في مراكز مرخّصة لا في المنزل.",
      "درست جواب: جینیاتی کونسلر یا تربیت یافتہ ڈاکٹر آپ کے ساتھ نتیجہ دیکھ سکتے ہیں اور موجود اختیارات بتا سکتے ہیں۔ اسکریننگ لائسنس یافتہ مراکز میں ہوتی ہے، گھر پر نہیں۔",
    ),
  },
];

export function makeTeachBackQuiz(coupleId: string, locale: Locale): TeachBackQuiz {
  const questions: TeachBackQuestion[] = TEACHBACK.map((q) => ({
    id: q.id,
    prompt: q.prompt[locale],
    choices: toChoices(q.choices, locale),
  }));
  return { couple_id: coupleId, locale, language_status: "draft", questions };
}

/** The answer key and the question ids, locale-neutral (used to validate and score a submission). */
export function teachBackKey(): { id: string; correct: string; choice_ids: string[] }[] {
  return TEACHBACK.map((q) => ({ id: q.id, correct: q.correct, choice_ids: q.choices.map((c) => c.id) }));
}

/** Each explanation restates the correct answer, whether or not the person got it right. */
export function teachBackExplanations(locale: Locale): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of TEACHBACK) out[q.id] = q.explanation[locale];
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Scoreboard (GET /v1/eval/scoreboard). Every value is a FIXTURE figure, labelled as such.
// ---------------------------------------------------------------------------------------------------------

export function makeScoreboard(generatedAt: string): Scoreboard {
  return {
    generated_at: generatedAt,
    synthetic: true,
    metrics: [
      {
        id: "oracle_agreement",
        name: "Oracle agreement on synthetic couples",
        value: "fixture: 300 of 300 synthetic couples classified the same as the independent oracle",
        n: 300,
        status: "measured",
        method:
          "Each synthetic couple is built by gene dropping through a defined pedigree, so the true category is known. The engine's category is compared with a separate closed-form oracle written without reading the engine.",
        does_not_show:
          "Synthetic couples are generated under the same assumptions as the engine, so agreement shows that the code matches its own model. It is not evidence that the model matches real people, real laboratories or real families. A regression gate that the team wrote itself is not safety evidence.",
      },
      {
        id: "numeric_fidelity",
        name: "Numeric fidelity of the explainer text",
        value:
          "fixture: 900 of 900 rendered explanations contain only numbers handed over by the engine or fixed template constants",
        n: 900,
        status: "measured",
        method:
          "A checker reads every rendered document in English, Arabic and Urdu and compares each number in the text with the numbers the engine supplied.",
        does_not_show:
          "It shows that the words repeat the engine's numbers faithfully. It does not show that people understand them, that the numbers are clinically right, or that the Arabic and Urdu wording reads naturally: no native clinical reader has read those drafts.",
      },
      {
        id: "polarity_banned_words",
        name: "Polarity and banned-word checks",
        value: "fixture: 0 flipped sentences and 0 banned words in 900 rendered explanations",
        n: 900,
        status: "measured",
        method:
          "A checker looks for sentences whose meaning is the reverse of the result category and scans every user-facing string against a closed list of verdict words in three languages.",
        does_not_show:
          "A word list catches the words on the list. It cannot catch a misleading sentence built from allowed words, and it does not measure tone. The list itself has not been read by a clinician.",
      },
      {
        id: "escalation_recall",
        name: "Escalation recall on synthetic edge cases",
        value: "fixture: 120 of 120 synthetic edge cases escalated as the rule library defines",
        n: 120,
        status: "measured",
        method:
          "Edge cases are generated from the trigger definitions themselves, then run through the escalation rules.",
        does_not_show:
          "Cases built from the triggers will always find the triggers. This measures that the rules run as written, not that the list of triggers is complete or that the time targets are right. The clinical lead's sign-off is pending.",
      },
      {
        id: "disclosure_property",
        name: "Disclosure property tests over random consent sequences",
        value: "fixture: 0 violations in 10000 randomised grant and revoke sequences",
        n: 10000,
        status: "measured",
        method:
          "A property-based test grants, revokes and expires consents in random order for random couples and compares every view with a separate reference model of the disclosure rules, under both emirate policies.",
        does_not_show:
          "It shows that the code follows the rules as written. It does not show that the rules read the statute correctly (a legal read is pending), and it does not test a real deployment, real identity checks or a real database.",
      },
      {
        id: "audit_tamper_detection",
        name: "Audit-chain tamper detection",
        value: "fixture: 500 of 500 injected edits detected at the first altered event",
        n: 500,
        status: "measured",
        method:
          "Random edits, deletions and reorderings are applied to a copy of the hash-chained audit log, then the chain is verified from the start.",
        does_not_show:
          "A hash chain shows that an edit happened, not who made it. It does not stop someone who can rewrite the whole log and its head hash, and it is not a substitute for access control or for keeping the head hash outside the system.",
      },
      {
        id: "pathway_timing_simulation",
        name: "Pathway timing simulation",
        value: "fixture: simulated median of 17 days from sample to counselling under assumed turnaround times",
        n: 1000,
        status: "measured",
        method:
          "A simulation of 1000 synthetic couples draws laboratory and referral times from assumed scenarios that mirror the two emirate standards.",
        does_not_show:
          "The inputs are assumptions, so the output is a what-if and not a measurement of any real service. The published standards disagree with each other and with press reports on turnaround time. No real appointment data was used.",
      },
      {
        id: "teachback_comprehension",
        name: "Human teach-back comprehension",
        value: "fixture: not run",
        n: null,
        status: "not_run",
        method:
          "A small usability test with a scripted protocol and original-wording items. It is planned and has not started.",
        does_not_show:
          "Nothing yet. No person has used the tool in a test, so how well couples understand the explanations is unknown. Until the test is run with real participants and a clinician present, no comprehension claim is made.",
      },
    ],
  };
}
