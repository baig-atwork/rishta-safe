import type {
  ClosureChoice,
  ClosureItemKind,
  ClosureRecord,
  ClosureSchema,
  Locale,
  PatientItem,
  ProformaField,
  TeachBackQuiz,
  TeachBackResult,
} from "../types";
import { makeClosureSchema } from "../mock/fixtures";
import { isRecord, parseReal } from "./errors";
import { closureRecordSchema, closureSchemaSchema, teachbackQuizSchema, teachbackResultSchema } from "./schemas";

/**
 * Closure schema, the two closure submissions, and teach-back.
 *
 * The real backend publishes the patient items and a 12-field proforma DEFINITION (labels and help only), while the
 * UI renders a proforma form from typed fields (kind, choices). This module owns that translation:
 *   - patient item ids are the real ids, so a UI answer maps to the real `ClosureAnswers` key one to one;
 *   - the real `ClinicianProforma` is a structured object (encounter, information_given, ...), so a few real fields are
 *     offered to the clinician as several UI fields (encounter x4, patient questions x2). The tables below are the
 *     single place that says how a UI answer id becomes a real field.
 * Words the backend does not publish (choice labels for visit mode, teach-back rating, ...) come from the mock's
 * UI copy (`makeClosureSchema`), which already has them in en, ar and ur.
 */

const donorCache = new Map<Locale, ClosureSchema>();
function donor(locale: Locale): ClosureSchema {
  let schema = donorCache.get(locale);
  if (schema === undefined) {
    schema = makeClosureSchema(locale);
    donorCache.set(locale, schema);
  }
  return schema;
}
function donorField(locale: Locale, id: string): ProformaField | undefined {
  return donor(locale).proforma_fields.find((field) => field.id === id);
}

export function localeFrom(value: unknown): Locale {
  return value === "ar" || value === "ur" ? value : "en";
}

function choices(record: Record<string, string>): ClosureChoice[] {
  return Object.entries(record).map(([id, text]) => ({ id, text }));
}

// ---- patient items ---------------------------------------------------------------------------------------

/** Real item `format` to the UI's `ClosureItemKind`. An unknown format is not rendered (GAP: it would have no control). */
const KIND_BY_FORMAT: Readonly<Record<string, ClosureItemKind>> = {
  free_text: "free_text",
  integer: "integer_0_100",
  true_false_not_sure: "true_false_unsure",
  single_choice: "single_choice",
  likert_1_5: "agree_1_5",
};

// ---- UI copy for clinician fields the backend only defines by id ------------------------------------------------

type Tri = Record<Locale, string>;

const COPY: Readonly<Record<string, { label: Tri; hint?: Tri }>> = {
  encounter_mode: { label: { en: "Visit mode", ar: "نمط الزيارة", ur: "ملاقات کا طریقہ" } },
  encounter_duration_minutes: {
    label: { en: "Visit length in minutes", ar: "مدة الزيارة بالدقائق", ur: "ملاقات کا دورانیہ منٹوں میں" },
    hint: { en: "A whole number from 1 to 480.", ar: "عدد صحيح من 1 إلى 480.", ur: "1 سے 480 تک ایک مکمل عدد۔" },
  },
  encounter_language: { label: { en: "Session language", ar: "لغة الجلسة", ur: "سیشن کی زبان" } },
  encounter_interpreter: { label: { en: "Interpreter used", ar: "هل استُعين بمترجم؟", ur: "کیا مترجم استعمال ہوا؟" } },
  patient_questions_invited: {
    label: { en: "Questions were invited", ar: "دُعي الزوجان إلى طرح الأسئلة", ur: "سوال پوچھنے کی دعوت دی گئی" },
  },
  patient_questions_answered: {
    label: { en: "Questions were answered", ar: "أُجيب عن الأسئلة", ur: "سوالوں کے جواب دیے گئے" },
    hint: { en: "Only if questions were invited.", ar: "فقط إذا دُعي إلى طرح الأسئلة.", ur: "صرف تب جب سوال کی دعوت دی گئی ہو۔" },
  },
  patient_copy_given: {
    label: { en: "A copy was given to the patient", ar: "أُعطيت نسخة للمريض", ur: "مریض کو کاپی دی گئی" },
  },
};

const MODE_CHOICES: Readonly<Record<Locale, readonly ClosureChoice[]>> = {
  en: [
    { id: "in_person", text: "In person" },
    { id: "virtual", text: "Virtual" },
  ],
  ar: [
    { id: "in_person", text: "حضوري" },
    { id: "virtual", text: "عن بُعد" },
  ],
  ur: [
    { id: "in_person", text: "بالمشافہ" },
    { id: "virtual", text: "ورچوئل" },
  ],
};

/** Language names are shown in their own script in every locale. */
const LANGUAGE_CHOICES: readonly ClosureChoice[] = [
  { id: "en", text: "English" },
  { id: "ar", text: "العربية" },
  { id: "ur", text: "اردو" },
];

const OWNER_CHOICES: Readonly<Record<Locale, readonly ClosureChoice[]>> = {
  en: [
    { id: "clinician", text: "Clinician" },
    { id: "counsellor", text: "Counsellor" },
    { id: "couple_member", text: "The couple" },
    { id: "programme", text: "Programme team" },
  ],
  ar: [
    { id: "clinician", text: "الطبيب" },
    { id: "counsellor", text: "المرشد" },
    { id: "couple_member", text: "الزوجان" },
    { id: "programme", text: "فريق البرنامج" },
  ],
  ur: [
    { id: "clinician", text: "معالج" },
    { id: "counsellor", text: "کونسلر" },
    { id: "couple_member", text: "جوڑا" },
    { id: "programme", text: "پروگرام ٹیم" },
  ],
};

export function mapClosureSchema(body: unknown, locale: Locale): ClosureSchema {
  const real = parseReal(closureSchemaSchema, body, "closure/schema");
  // GAP: the optional SILS stratifier (sils_prompt/sils_options) is not offered: the UI form treats every non-free-text
  // item as required, but the backend marks SILS optional, so it cannot be shown honestly as a patient item.
  const patient_items: PatientItem[] = [];
  for (const item of real.patient_items) {
    const kind = KIND_BY_FORMAT[item.format];
    if (kind === undefined) continue;
    patient_items.push({ id: item.id, kind, prompt: item.prompt, choices: choices(item.options) });
  }

  const fieldById = new Map(real.clinician_fields.map((field) => [field.id, field] as const));
  const labelOf = (id: string, donorId: string): string =>
    fieldById.get(id)?.label ?? donorField(locale, donorId)?.label ?? id;
  const helpOf = (id: string): string | null => fieldById.get(id)?.help ?? null;
  const numberOf = (id: string, fallback: number): number => fieldById.get(id)?.no ?? fallback;

  const sub = (id: string, number: number, base: string, kind: ProformaField["kind"], extra: Partial<ProformaField> = {}): ProformaField => {
    const copy = COPY[id];
    return {
      id,
      number,
      label: copy ? `${base}: ${copy.label[locale]}` : base,
      filled_by: "clinician",
      kind,
      choices: [],
      hint: copy?.hint ? copy.hint[locale] : null,
      ...extra,
    };
  };

  const system = (id: string, fallbackNumber: number): ProformaField => ({
    id,
    number: numberOf(id, fallbackNumber),
    label: labelOf(id, id),
    filled_by: "system",
    kind: "system",
    choices: [],
    hint: helpOf(id),
  });

  const visit = labelOf("encounter", "encounter");
  const visitNo = numberOf("encounter", 1);
  const questions = labelOf("patient_questions", "patient_questions");
  const questionsNo = numberOf("patient_questions", 7);

  const proforma_fields: ProformaField[] = [
    // 1 encounter: the real proforma requires mode, length, language and interpreter from the clinician.
    sub("encounter_mode", visitNo, visit, "single_choice", { choices: [...MODE_CHOICES[locale]], hint: helpOf("encounter") }),
    sub("encounter_duration_minutes", visitNo, visit, "text"),
    sub("encounter_language", visitNo, visit, "single_choice", { choices: [...LANGUAGE_CHOICES] }),
    sub("encounter_interpreter", visitNo, visit, "yes_no"),
    system("risk_signal", 2),
    {
      id: "findings_discussed",
      number: numberOf("findings_discussed", 3),
      label: labelOf("findings_discussed", "findings_discussed"),
      filled_by: "clinician",
      kind: "checklist",
      choices: donorField(locale, "findings_discussed")?.choices ?? [],
      hint: helpOf("findings_discussed"),
    },
    {
      id: "information_given",
      number: numberOf("information_given", 4),
      label: labelOf("information_given", "information_given"),
      filled_by: "clinician",
      kind: "checklist",
      choices: choices(real.information_ticks),
      hint: helpOf("information_given"),
    },
    {
      // Real field 5 lists the choices discussed; the backend also REQUIRES the status of the next clinical step, which
      // the UI collects here. GAP: the list of options discussed (prenatal diagnosis, ...) is not offered; it defaults to none.
      id: "next_step_status",
      number: numberOf("options_discussed", 5),
      label: donorField(locale, "options_discussed")?.label ?? labelOf("options_discussed", "options_discussed"),
      filled_by: "clinician",
      kind: "single_choice",
      choices: donorField(locale, "options_discussed")?.choices ?? [],
      hint: donorField(locale, "options_discussed")?.hint ?? helpOf("options_discussed"),
    },
    {
      id: "teach_back",
      number: numberOf("teach_back", 6),
      label: labelOf("teach_back", "teach_back"),
      filled_by: "clinician",
      kind: "single_choice",
      choices: donorField(locale, "teach_back")?.choices ?? [],
      hint: helpOf("teach_back"),
    },
    sub("patient_questions_invited", questionsNo, questions, "yes_no", { hint: helpOf("patient_questions") }),
    sub("patient_questions_answered", questionsNo, questions, "yes_no"),
    {
      id: "plan",
      number: numberOf("plan", 8),
      label: labelOf("plan", "plan"),
      filled_by: "clinician",
      kind: "action_list",
      choices: donorField(locale, "plan")?.choices ?? [],
      hint: helpOf("plan"),
      owner_choices: [...OWNER_CHOICES[locale]],
    },
    system("referral_task", 9),
    {
      id: "service_preference",
      number: numberOf("service_preference", 10),
      label: labelOf("service_preference", "service_preference"),
      filled_by: "patient",
      kind: "single_choice",
      choices: choices(real.service_interest_values),
      hint: helpOf("service_preference"),
    },
    sub("patient_copy_given", numberOf("sharing_and_consent", 11), labelOf("sharing_and_consent", "sharing_and_consent"), "yes_no", {
      hint: helpOf("sharing_and_consent"),
    }),
    system("completed_by", 12),
  ];

  return {
    language_status: real.language_status,
    patient_items,
    proforma_fields,
    service_interest: {
      prompt: real.service_interest_prompt,
      options: choices(real.service_interest_values),
      topics: choices(real.service_interest_topics),
      consent_text: real.service_interest_consent_text,
    },
  };
}

// ---- patient closure submission ---------------------------------------------------------------------------

const INTEGER_ITEMS: ReadonlySet<string> = new Set(["out_of_100", "values_clarity", "felt_free"]);
const TEXT_AND_CHOICE_ITEMS: ReadonlySet<string> = new Set([
  "own_words",
  "carrier_is_disease",
  "negative_means_none",
  "next_step",
  "who_can_see",
]);
const YES_VALUES: ReadonlySet<string> = new Set(["yes_now", "yes_later"]);

/** A whole number as a number; anything else is sent unchanged so the backend answers with a field-level 422. */
function intOrRaw(value: string): number | string {
  const trimmed = value.trim();
  return /^-?\d+$/.test(trimmed) ? Number(trimmed) : value;
}

/** UI `{person_id, answers, service_interest, topics}` to the real `PatientClosureRequest`. */
export function toRealPatientClosure(body: unknown): unknown {
  if (!isRecord(body)) return body;
  const answers: Record<string, unknown> = {};
  if (isRecord(body["answers"])) {
    for (const [id, value] of Object.entries(body["answers"])) {
      if (typeof value !== "string") continue;
      if (INTEGER_ITEMS.has(id)) answers[id] = intOrRaw(value);
      else if (TEXT_AND_CHOICE_ITEMS.has(id)) answers[id] = value;
    }
  }
  const interest = body["service_interest"];
  if (typeof interest === "string" && interest !== "") {
    const yes = YES_VALUES.has(interest);
    const topics = Array.isArray(body["topics"]) ? body["topics"].filter((t): t is string => typeof t === "string") : [];
    answers["service_interest"] = {
      value: interest,
      // GAP: the form shows the consent text directly above the options and has no separate tick box, so choosing a
      // "yes" is treated as acknowledging that text (consent_version 1). A tick box in the UI would be stricter.
      consent_acknowledged: yes,
      consent_version: 1,
      topics: yes ? topics : [],
      // GAP: the form has no reminder-interval control; "yes_later" needs one, so the shortest server-offered
      // interval (3 months) is used. This records a preference the person did not state.
      ...(interest === "yes_later" ? { reminder_months: 3 } : {}),
    };
  }
  return { person_id: body["person_id"], answers };
}

// ---- clinician proforma submission --------------------------------------------------------------------------

const INFORMATION_KEYS = [
  "carrier_vs_disease",
  "couple_numbers",
  "test_limits",
  "options_neutral_order",
  "right_not_to_know",
  "who_can_see_result",
  "how_to_reach_us",
] as const;

function textOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function listOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
function yesNo(value: unknown): boolean | null {
  return value === "yes" ? true : value === "no" ? false : null;
}

function parsePlanRow(raw: string): unknown {
  try {
    const row: unknown = JSON.parse(raw);
    if (isRecord(row)) {
      const owner = typeof row["owner"] === "string" ? row["owner"].trim().toLowerCase() : row["owner"];
      return { action: row["action"], owner_role: owner, due_date: row["due"] };
    }
  } catch {
    // fall through: send the raw text so the backend reports the row as invalid
  }
  return raw;
}

/** UI `{answers}` (keyed by UI field id) to the real `ClinicianProforma`. A field the clinician left out is left out. */
export function toRealProforma(body: unknown): unknown {
  if (!isRecord(body) || !isRecord(body["answers"])) return body;
  const a = body["answers"];
  const out: Record<string, unknown> = {};

  const encounter: Record<string, unknown> = {};
  const mode = textOf(a["encounter_mode"]);
  if (mode !== null) encounter["mode"] = mode;
  const minutes = textOf(a["encounter_duration_minutes"]);
  if (minutes !== null) encounter["duration_minutes"] = intOrRaw(minutes);
  const language = textOf(a["encounter_language"]);
  if (language !== null) encounter["session_language"] = language;
  const interpreter = yesNo(a["encounter_interpreter"]);
  if (interpreter !== null) encounter["interpreter_used"] = interpreter;
  if (Object.keys(encounter).length > 0) out["encounter"] = encounter;

  if ("findings_discussed" in a) {
    const ticked = listOf(a["findings_discussed"]);
    out["findings_discussed"] = ticked.includes("shared_result_discussed")
      ? [
          {
            // finding_ref names what was discussed; the UI offers one couple-level result, so the reference is fixed.
            finding_ref: "couple_result",
            explained_as_chance_not_diagnosis: ticked.includes("explained_as_chance"),
            flagged_uncertain: ticked.includes("marked_uncertain"),
          },
        ]
      : [];
  }

  if ("information_given" in a) {
    const ticked = listOf(a["information_given"]);
    out["information_given"] = Object.fromEntries(INFORMATION_KEYS.map((key) => [key, ticked.includes(key)]));
  }

  const nextStep = textOf(a["next_step_status"]);
  if (nextStep !== null) out["next_step_status"] = nextStep;

  const teachBack = textOf(a["teach_back"]);
  if (teachBack !== null) {
    out["teach_back_done"] = teachBack !== "not_done";
    if (teachBack !== "not_done") out["teach_back_result"] = teachBack;
  }

  const invited = yesNo(a["patient_questions_invited"]);
  if (invited !== null) {
    out["patient_questions_invited"] = invited;
    // answered is required exactly when questions were invited; it is dropped when they were not.
    out["patient_questions_answered"] = invited ? yesNo(a["patient_questions_answered"]) : null;
  }

  if ("plan" in a) out["plan"] = listOf(a["plan"]).map(parsePlanRow);

  const copy = yesNo(a["patient_copy_given"]);
  if (copy !== null) out["patient_copy_given"] = copy;

  return out;
}

/**
 * Real error location of a proforma submission to the UI field id the form can attach it to. The result is a path
 * the form's own matcher understands (`answers.<field id>`), or null when the location names no clinician field.
 */
export function proformaFieldPath(loc: readonly (string | number)[]): string | null {
  const parts = loc[0] === "body" ? loc.slice(1) : loc;
  const [head, second] = parts;
  if (typeof head !== "string") return null;
  const rest = parts.slice(1).map((part) => (typeof part === "number" ? `[${part}]` : `.${part}`)).join("");
  const ui = ((): string => {
    switch (head) {
      case "encounter":
        switch (second) {
          case "duration_minutes":
            return "encounter_duration_minutes";
          case "session_language":
            return "encounter_language";
          case "interpreter_used":
            return "encounter_interpreter";
          default:
            return "encounter_mode";
        }
      case "teach_back_done":
      case "teach_back_result":
        return "teach_back";
      default:
        return head;
    }
  })();
  return head === "encounter" ? `answers.${ui}` : `answers.${ui}${rest}`;
}

// ---- records and teach-back --------------------------------------------------------------------------------

export function mapClosureRecord(body: unknown): ClosureRecord {
  const real = parseReal(closureRecordSchema, body, "closure record");
  return {
    record_id: real.record_id,
    couple_id: real.couple_id,
    kind: real.kind,
    submitted_at: real.submitted_at,
    // Every record in this prototype is synthetic and nothing leaves the system.
    simulated: true,
  };
}

export function mapTeachbackQuiz(body: unknown): TeachBackQuiz {
  const real = parseReal(teachbackQuizSchema, body, "teachback");
  return {
    couple_id: real.couple_id,
    locale: real.locale,
    language_status: real.language_status,
    questions: real.items.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      choices: item.options.map((option) => ({ id: option.id, text: option.label })),
    })),
  };
}

export function mapTeachbackResult(body: unknown): TeachBackResult {
  const real = parseReal(teachbackResultSchema, body, "teachback result");
  return {
    couple_id: real.couple_id,
    correct: real.correct_count,
    total: real.item_count,
    items: real.items.map((item) => ({ id: item.item_id, correct: item.correct, explanation: item.explanation })),
  };
}

/** UI `{answers, locale?}` to the real `TeachBackSubmission`, which requires the locale (GAP: "en" when the UI sent none). */
export function toRealTeachback(body: unknown, queryLocale: string | undefined): unknown {
  const answers = isRecord(body) && isRecord(body["answers"]) ? body["answers"] : {};
  const locale = localeFrom(isRecord(body) && typeof body["locale"] === "string" ? body["locale"] : queryLocale);
  return { answers, locale };
}
