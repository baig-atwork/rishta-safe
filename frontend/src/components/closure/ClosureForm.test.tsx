import { screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/transport";
import type { ClosureSchema } from "@/lib/api/types";
import { renderWithIntl } from "@/test/render";
import { ClosureForm } from "./ClosureForm";

const api = vi.hoisted(() => ({ submitPatientClosure: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ clientApi: api }));

function schemaFixture(status: ClosureSchema["language_status"] = "draft"): ClosureSchema {
  return {
    language_status: status,
    patient_items: [
      { id: "own_words", kind: "free_text", prompt: "In your own words, what does this result mean for the two of you?", choices: [] },
      { id: "out_of_100", kind: "integer_0_100", prompt: "Out of 100 pregnancies of couples with this same result, about how many children would have the condition?", choices: [] },
      { id: "carrier_is_disease", kind: "true_false_unsure", prompt: "Being a carrier means the person has the disease.", choices: [] },
      { id: "negative_means_none", kind: "true_false_unsure", prompt: "If the test found nothing shared, our children cannot have any inherited condition.", choices: [] },
      {
        id: "next_step",
        kind: "single_choice",
        prompt: "What is the next step, and who is responsible for it?",
        choices: [
          { id: "counsellor_explains", text: "A counsellor or doctor explains the result and the choices to us" },
          { id: "centre_decides", text: "The screening centre decides for us" },
          { id: "nothing_more", text: "Nothing more happens" },
          { id: "find_lab_yourself", text: "We find a laboratory ourselves" },
        ],
      },
      { id: "values_clarity", kind: "agree_1_5", prompt: "I know what matters most to us when choosing what to do next.", choices: [] },
      { id: "felt_free", kind: "agree_1_5", prompt: "I felt free to choose. Nobody pushed us in a direction.", choices: [] },
      {
        id: "who_can_see",
        kind: "single_choice",
        prompt: "Who can see our result?",
        choices: [
          { id: "only_me", text: "Only me" },
          { id: "me_and_partner", text: "Me and my partner" },
          { id: "family_i_choose", text: "Family members I choose" },
          { id: "nobody_else", text: "Nobody else" },
        ],
      },
    ],
    proforma_fields: [],
    service_interest: {
      prompt: "Would you like information about services for planning a pregnancy?",
      // The real consent text promises that no marriage intention is recorded; that sentence is not a question.
      consent_text: "This is your choice. Your answer does not change your result, and we do not record whether you plan to marry.",
      options: [
        { id: "yes_now", text: "Yes, now" },
        { id: "yes_later", text: "Yes, later (remind me)" },
        { id: "no_thanks", text: "No thank you" },
        { id: "prefer_not_to_say", text: "Prefer not to say" },
      ],
      topics: [
        { id: "preconception_counselling", text: "Counselling before pregnancy" },
        { id: "partner_or_relative_testing", text: "Testing for a partner or relatives" },
      ],
    },
  };
}

const RECORD = { record_id: "rec-1", couple_id: "c-01", kind: "patient" as const, submitted_at: "2026-11-20T10:00:00Z", simulated: true };

function renderForm(locale: "en" | "ar" | "ur" = "en", schema: ClosureSchema = schemaFixture()) {
  return renderWithIntl(<ClosureForm schema={schema} coupleId="c-01" personId="p-amira" />, locale);
}

function group(name: string | RegExp): HTMLElement {
  return screen.getByRole("group", { name });
}

/** Answers every required item with fixed choices; the free-text item and the services question stay untouched. */
async function answerRequired(user: UserEvent) {
  await user.type(screen.getByRole("spinbutton"), "25");
  await user.click(within(group(/Being a carrier/)).getByRole("radio", { name: "False" }));
  await user.click(within(group(/nothing shared/)).getByRole("radio", { name: "False" }));
  await user.click(within(group(/next step/)).getByRole("radio", { name: /counsellor or doctor explains/ }));
  await user.click(within(group(/what matters most/)).getByRole("radio", { name: /^4/ }));
  await user.click(within(group(/felt free/)).getByRole("radio", { name: /^5/ }));
  await user.click(within(group(/Who can see our result/)).getByRole("radio", { name: "Me and my partner" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.submitPatientClosure.mockResolvedValue(RECORD);
});

describe("ClosureForm in English", () => {
  it("renders the eight items by kind, from the schema", () => {
    renderForm();
    expect(screen.getByRole("textbox", { name: /in your own words/i })).toBeInTheDocument();
    const number = screen.getByRole("spinbutton");
    expect(number).toHaveAttribute("min", "0");
    expect(number).toHaveAttribute("max", "100");
    expect(number).toHaveAttribute("inputmode", "numeric");
    expect(within(group(/Being a carrier/)).getAllByRole("radio").map((radio) => (radio as HTMLInputElement).value)).toEqual(["true", "false", "not_sure"]);
    expect(within(group(/next step/)).getAllByRole("radio")).toHaveLength(4);
    expect(within(group(/what matters most/)).getAllByRole("radio")).toHaveLength(5);
    expect(screen.getAllByText("Strongly disagree").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Strongly agree").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Question \d of 8$/)).toHaveLength(8);
    // Nothing is selected by default, including the optional services question.
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
  });

  it("asks no question about marriage: no legend, label or prompt mentions it", () => {
    const { container } = renderForm();
    const asked = Array.from(container.querySelectorAll("legend, label")).map((node) => node.textContent ?? "");
    expect(asked.length).toBeGreaterThan(8);
    for (const text of asked) expect(text).not.toMatch(/marry|marriage/i);
    // The consent sentence may say that nothing about marriage is recorded; it is a statement, not a field.
    expect(container.querySelectorAll("fieldset, [role='group']").length).toBeGreaterThan(0);
    expect(container.querySelector('[name*="marr" i]')).toBeNull();
  });

  it("blocks submit while a required item is unanswered and says which", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Send my answers" }));

    expect(api.submitPatientClosure).not.toHaveBeenCalled();
    // Seven required items, the free-text one is optional.
    expect(await screen.findAllByText("Please answer this question.")).toHaveLength(7);
    expect(screen.getByRole("alert")).toHaveTextContent("(7)");
    expect(screen.getByRole("spinbutton")).toHaveFocus();
    expect(screen.getByRole("spinbutton")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Send my answers" })).toBeEnabled();
  });

  it("rejects a number outside 0 to 100", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByRole("spinbutton"), "150");
    await user.click(screen.getByRole("button", { name: "Send my answers" }));

    expect(await screen.findByText("Enter a number between 0 and 100.")).toBeInTheDocument();
    expect(api.submitPatientClosure).not.toHaveBeenCalled();
  });

  it("submits the answers with no services choice when the optional question is left alone", async () => {
    const user = userEvent.setup();
    renderForm();

    await answerRequired(user);
    await user.click(screen.getByRole("button", { name: "Send my answers" }));

    await waitFor(() =>
      expect(api.submitPatientClosure).toHaveBeenCalledWith("c-01", {
        person_id: "p-amira",
        answers: {
          out_of_100: "25",
          carrier_is_disease: "false",
          negative_means_none: "false",
          next_step: "counsellor_explains",
          values_clarity: "4",
          felt_free: "5",
          who_can_see: "me_and_partner",
        },
        service_interest: "",
        topics: [],
      }),
    );
    expect(await screen.findByRole("heading", { name: "Thank you" })).toBeInTheDocument();
    expect(screen.getByText("Your answers are saved in this demo only.")).toBeInTheDocument();
    expect(screen.getByText("rec-1")).toHaveClass("ltr-run");
  });

  it("shows topics only after a yes answer, and sends them with it", async () => {
    const user = userEvent.setup();
    renderForm();

    expect(screen.queryByText("Which topics interest you?")).toBeNull();
    await user.click(screen.getByRole("radio", { name: "No thank you" }));
    expect(screen.queryByText("Which topics interest you?")).toBeNull();

    await user.click(screen.getByRole("radio", { name: "Yes, now" }));
    expect(screen.getByText("Which topics interest you?")).toBeInTheDocument();
    const topic = screen.getByRole("button", { name: "Counselling before pregnancy" });
    expect(topic).toHaveAttribute("aria-pressed", "false");
    await user.click(topic);
    expect(topic).toHaveAttribute("aria-pressed", "true");

    await answerRequired(user);
    await user.click(screen.getByRole("button", { name: "Send my answers" }));

    await waitFor(() => expect(api.submitPatientClosure).toHaveBeenCalledTimes(1));
    expect(api.submitPatientClosure.mock.calls[0]?.[1]).toMatchObject({ service_interest: "yes_now", topics: ["preconception_counselling"] });
  });

  it("drops topics when the answer changes away from yes, and can clear the answer", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("radio", { name: "Yes, later (remind me)" }));
    await user.click(screen.getByRole("button", { name: "Testing for a partner or relatives" }));
    await user.click(screen.getByRole("radio", { name: "Prefer not to say" }));
    expect(screen.queryByText("Which topics interest you?")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Clear my answer" }));
    for (const radio of within(group(/planning a pregnancy/)).getAllByRole("radio")) expect(radio).not.toBeChecked();

    await answerRequired(user);
    await user.click(screen.getByRole("button", { name: "Send my answers" }));
    await waitFor(() => expect(api.submitPatientClosure).toHaveBeenCalledTimes(1));
    expect(api.submitPatientClosure.mock.calls[0]?.[1]).toMatchObject({ service_interest: "", topics: [] });
  });

  it("shows the problem title and correlation id on failure, keeps the answers, and retries", async () => {
    const user = userEvent.setup();
    api.submitPatientClosure.mockRejectedValueOnce(new ApiError({ type: "about:blank", title: "Closure store unavailable", status: 503, correlation_id: "corr-77" }));
    renderForm();

    await answerRequired(user);
    await user.click(screen.getByRole("button", { name: "Send my answers" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your answers were not sent");
    expect(alert).toHaveTextContent("Closure store unavailable");
    expect(alert).toHaveTextContent("corr-77");
    expect(screen.getByRole("spinbutton")).toHaveValue(25);

    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Thank you" })).toBeInTheDocument();
    expect(api.submitPatientClosure).toHaveBeenCalledTimes(2);
    expect(api.submitPatientClosure.mock.calls[1]?.[1]).toEqual(api.submitPatientClosure.mock.calls[0]?.[1]);
  });

  it("shows the draft-translation chip only when the schema is a draft", () => {
    const { unmount } = renderForm("en", schemaFixture("draft"));
    expect(screen.getByText(/draft translation/i)).toHaveClass("stamp");
    unmount();
    renderForm("en", schemaFixture("reviewed"));
    expect(screen.queryByText(/draft translation/i)).toBeNull();
  });
});

describe("ClosureForm in Arabic (RTL)", () => {
  it("renders Arabic labels and validation messages, right-to-left, with no raw keys", async () => {
    const user = userEvent.setup();
    renderForm("ar");
    expect(document.documentElement.dir).toBe("rtl");

    expect(screen.getByRole("button", { name: "إرسال إجاباتي" })).toBeInTheDocument();
    expect(screen.getAllByText(/^السؤال \d من 8$/)).toHaveLength(8);
    expect(screen.getAllByText("لا أوافق إطلاقاً").length).toBeGreaterThan(0);
    expect(within(group(/Being a carrier/)).getByRole("radio", { name: "صحيح" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "إرسال إجاباتي" }));
    expect(await screen.findAllByText("يرجى الإجابة عن هذا السؤال.")).toHaveLength(7);
    expect(api.submitPatientClosure).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toMatch(/\b(closure|quiz)\.[a-z]/);
  });
});
