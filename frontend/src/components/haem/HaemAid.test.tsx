import { screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/transport";
import type { CbcInput, HaemInterpretation, HaemLabel, HplcInput } from "@/lib/api/types";
import enMessages from "@/test/messages-en";
import { renderWithIntl } from "@/test/render";
import { HaemAid } from "./HaemAid";

const haemInterpret = vi.hoisted(() => vi.fn<(cbc: CbcInput, hplc: HplcInput | null) => Promise<HaemInterpretation>>());
vi.mock("@/lib/api/client", () => ({ clientApi: { haemInterpret } }));

const STATEMENT = "Not a diagnosis. A decision aid for the clinician.";
const SIGNOFF = "Pending clinical sign-off";

/** Exhaustive on purpose: adding a key to HaemLabel breaks this record until the message exists too. */
const LABEL_KEYS: Record<HaemLabel, true> = {
  indices_reduced: true,
  indices_not_flagged: true,
  cbc_incomplete: true,
  pattern_suggests_beta_thal_trait: true,
  pattern_suggests_alpha_thal_trait: true,
  pattern_suggests_hb_variant_trait: true,
  pattern_suggests_iron_deficiency_first: true,
  pattern_suggests_possible_compound_or_affected: true,
  pattern_unclear_refer_for_molecular: true,
  no_pattern_flagged_on_this_work_up: true,
  work_up_incomplete: true,
};

function reading(overrides: Partial<HaemInterpretation> = {}): HaemInterpretation {
  return {
    label: "indices_reduced",
    label_text: null,
    rule_trace: [
      {
        rule_id: "R-DEMO-01",
        description: "Demo rule description.",
        source: { title: "Demo source", year: 2020, url: "https://example.org/demo", illustrative: false },
      },
    ],
    flags: ["demo_flag"],
    needs_clinician_signoff: true,
    sources: [{ title: "Illustrative table", year: null, url: null, illustrative: true }],
    ...overrides,
  };
}

function flatStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") out.push(node);
  else if (typeof node === "object" && node !== null) for (const value of Object.values(node)) flatStrings(value, out);
  return out;
}

async function fillCbc(user: UserEvent) {
  await user.selectOptions(screen.getByLabelText("Sex"), "female");
  await user.type(screen.getByLabelText("Haemoglobin (Hb)"), "11.2");
  await user.type(screen.getByLabelText("Mean cell volume (MCV)"), "70");
  await user.type(screen.getByLabelText("Mean cell haemoglobin (MCH)"), "22");
}

beforeEach(() => {
  haemInterpret.mockReset();
});

describe("HaemAid", () => {
  it("shows the persistent statements and onboarding copy before anything is submitted", () => {
    renderWithIntl(<HaemAid />);
    const boundary = screen.getByRole("region", { name: "Read this first" });
    expect(within(boundary).getByText(STATEMENT)).toBeInTheDocument();
    expect(within(boundary).getByText(SIGNOFF)).toBeInTheDocument();
    const result = screen.getByRole("region", { name: "Reading" });
    expect(within(result).getByText(/A CBC alone can never give a carrier statement/)).toBeInTheDocument();
  });

  it("submits the CBC alone and shows a closed-vocabulary label with the persistent statements", async () => {
    haemInterpret.mockResolvedValue(reading());
    const user = userEvent.setup();
    renderWithIntl(<HaemAid />);

    await fillCbc(user);
    await user.click(screen.getByRole("button", { name: "Interpret CBC alone" }));

    const result = await screen.findByRole("article", { name: "Indices reduced" });
    expect(haemInterpret).toHaveBeenCalledWith(
      { sex: "female", hb_g_dl: 11.2, mcv_fl: 70, mch_pg: 22, rbc_10e12_l: null, ferritin_ug_l: null },
      null,
    );
    expect(within(result).getByText(STATEMENT)).toBeInTheDocument();
    expect(within(result).getByText(SIGNOFF)).toBeInTheDocument();
    expect(within(result).getByText("Needs clinician sign-off")).toBeInTheDocument();
    expect(within(result).getByText("Based on the CBC alone")).toBeInTheDocument();
    expect(within(result).getByText("R-DEMO-01")).toBeInTheDocument();
    expect(within(result).getByRole("link", { name: /Demo source/ })).toHaveAttribute("href", "https://example.org/demo");
    expect(within(result).getByText("Illustrative")).toBeInTheDocument();
  });

  it("prefers label_text from the API over the message for the label key", async () => {
    haemInterpret.mockResolvedValue(reading({ label_text: "Wording supplied by the API", needs_clinician_signoff: false }));
    const user = userEvent.setup();
    renderWithIntl(<HaemAid />);

    await fillCbc(user);
    await user.click(screen.getByRole("button", { name: "Interpret CBC alone" }));

    const result = await screen.findByRole("article", { name: "Wording supplied by the API" });
    expect(within(result).queryByText("Needs clinician sign-off")).not.toBeInTheDocument();
  });

  it("sends no answer for a question left unanswered (the backend reads it as unknown)", async () => {
    haemInterpret.mockResolvedValue(reading());
    const user = userEvent.setup();
    renderWithIntl(<HaemAid />);

    await fillCbc(user);
    await user.click(screen.getByRole("button", { name: "Interpret CBC alone" }));
    await screen.findByRole("article", { name: "Indices reduced" });

    const cbc = haemInterpret.mock.calls[0]?.[0];
    for (const key of ["age_years", "pregnant", "transfused_last_4_months", "ferritin_status"]) expect(cbc).not.toHaveProperty(key);
    expect(screen.getByLabelText("Pregnant")).toHaveValue("");
    expect(screen.getByLabelText("Blood transfusion in the last 4 months")).toHaveValue("");
  });

  it("sends the answers the aid needs (age, pregnancy, transfusion, ferritin flag) with the CBC", async () => {
    haemInterpret.mockResolvedValue(reading());
    const user = userEvent.setup();
    renderWithIntl(<HaemAid />);

    await fillCbc(user);
    await user.type(screen.getByLabelText(/^Age/), "28");
    await user.selectOptions(screen.getByLabelText("Pregnant"), "no");
    await user.selectOptions(screen.getByLabelText("Blood transfusion in the last 4 months"), "unknown");
    await user.selectOptions(screen.getByLabelText("Ferritin flag from the laboratory"), "not_low");
    await user.click(screen.getByRole("button", { name: "Interpret CBC alone" }));

    await screen.findByRole("article", { name: "Indices reduced" });
    expect(haemInterpret).toHaveBeenCalledWith(
      { sex: "female", hb_g_dl: 11.2, mcv_fl: 70, mch_pg: 22, rbc_10e12_l: null, ferritin_ug_l: null, age_years: 28, pregnant: false, transfused_last_4_months: "unknown", ferritin_status: "not_low" },
      null,
    );
  });

  it("sends the two HPLC attestations only when they were answered", async () => {
    haemInterpret.mockResolvedValue(reading({ label: "pattern_suggests_beta_thal_trait" }));
    const user = userEvent.setup();
    renderWithIntl(<HaemAid />);

    await fillCbc(user);
    await user.click(screen.getByRole("button", { name: /Next: HPLC/ }));
    await user.type(screen.getByLabelText("HbA2"), "5.1");
    await user.type(screen.getByLabelText("HbF"), "1.2");
    await user.selectOptions(screen.getByLabelText("HbA2 is the total HbA2"), "yes");
    await user.click(screen.getByRole("button", { name: "Interpret CBC and HPLC" }));

    await screen.findByRole("article", { name: "Pattern suggests beta-thalassaemia trait" });
    const hplc = haemInterpret.mock.calls[0]?.[1];
    expect(hplc).toEqual({ hba2_percent: 5.1, hbf_percent: 1.2, variant_hb_percent: null, variant_hb_name: null, hba2_is_total: true });
    expect(hplc).not.toHaveProperty("single_hba_band_only");
  });

  it("moves to the HPLC step and submits both", async () => {
    haemInterpret.mockResolvedValue(reading({ label: "pattern_suggests_beta_thal_trait" }));
    const user = userEvent.setup();
    renderWithIntl(<HaemAid />);

    await fillCbc(user);
    await user.click(screen.getByRole("button", { name: /Next: HPLC/ }));
    expect(screen.queryByLabelText("Sex")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "HPLC" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("HbA2"), "5.1");
    await user.type(screen.getByLabelText("HbF"), "1.2");
    await user.click(screen.getByRole("button", { name: "Interpret CBC and HPLC" }));

    await screen.findByRole("article", { name: "Pattern suggests beta-thalassaemia trait" });
    expect(haemInterpret).toHaveBeenCalledWith(
      expect.objectContaining({ sex: "female", hb_g_dl: 11.2 }),
      { hba2_percent: 5.1, hbf_percent: 1.2, variant_hb_percent: null, variant_hb_name: null },
    );
  });

  it("validates only 'a number greater than 0' on the client", async () => {
    const user = userEvent.setup();
    renderWithIntl(<HaemAid />);

    await user.click(screen.getByRole("button", { name: "Interpret CBC alone" }));

    expect(await screen.findAllByText("Enter a number greater than 0.")).toHaveLength(3);
    expect(screen.getByText("Choose an option.")).toBeInTheDocument();
    expect(haemInterpret).not.toHaveBeenCalled();
  });

  it("shows an API 422 problem inline with the correlation id and keeps the retry", async () => {
    haemInterpret.mockRejectedValue(
      new ApiError({
        type: "about:blank",
        title: "Validation failed",
        status: 422,
        correlation_id: "corr-422-demo",
        errors: [{ field: "cbc.hb_g_dl", message: "Value not accepted by the service" }],
      }),
    );
    const user = userEvent.setup();
    renderWithIntl(<HaemAid />);

    await fillCbc(user);
    await user.click(screen.getByRole("button", { name: "Interpret CBC alone" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("corr-422-demo")).toBeInTheDocument();
    const hb = screen.getByLabelText("Haemoglobin (Hb)");
    expect(hb).toBeInvalid();
    expect(hb).toHaveAccessibleDescription("Value not accepted by the service");

    haemInterpret.mockResolvedValue(reading());
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    await screen.findByRole("article", { name: "Indices reduced" });
    expect(haemInterpret).toHaveBeenCalledTimes(2);
  });

  it("marks the submit button busy while the request is in flight", async () => {
    haemInterpret.mockReturnValue(new Promise<HaemInterpretation>(() => undefined));
    const user = userEvent.setup();
    renderWithIntl(<HaemAid />);

    await fillCbc(user);
    const submit = screen.getByRole("button", { name: "Interpret CBC alone" });
    await user.click(submit);

    expect(submit).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Interpreting the values");
  });
});

describe("haem messages (en)", () => {
  const haem = (enMessages as { haem: { label: Record<string, string> } }).haem;

  it("has a message for every HaemLabel key", () => {
    for (const key of Object.keys(LABEL_KEYS)) {
      expect(haem.label[key], key).toEqual(expect.any(String));
      expect(haem.label[key]?.trim().length, key).toBeGreaterThan(0);
    }
    expect(Object.keys(haem.label).sort()).toEqual(Object.keys(LABEL_KEYS).sort());
  });

  it("never uses a diagnosis-affirming phrase", () => {
    const affirming = /\byou (have|are|carry|will|do not have)\b|\bdiagnosed with\b|\bconfirms?\b|\bis affected\b/i;
    for (const text of flatStrings(haem)) expect(text, text).not.toMatch(affirming);
  });

  it("never renders an affirming phrase in a reading either", async () => {
    haemInterpret.mockResolvedValue(reading({ label: "pattern_suggests_possible_compound_or_affected" }));
    const user = userEvent.setup();
    const { container } = renderWithIntl(<HaemAid />);

    await fillCbc(user);
    await user.click(screen.getByRole("button", { name: "Interpret CBC alone" }));
    await screen.findByRole("article");

    expect(container.textContent ?? "").not.toMatch(/\byou (have|are|carry)\b/i);
  });
});
