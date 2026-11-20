import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/transport";
import type { TeachBackQuiz, TeachBackResult } from "@/lib/api/types";
import { renderWithIntl } from "@/test/render";
import { TeachBack } from "./TeachBack";

const api = vi.hoisted(() => ({ submitTeachback: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ clientApi: api }));

const QUIZ: TeachBackQuiz = {
  couple_id: "c-01",
  locale: "en",
  language_status: "draft",
  questions: [
    {
      id: "q1",
      prompt: "What does a shared result mean?",
      choices: [
        { id: "a", text: "A chance of a child with a condition" },
        { id: "b", text: "One of you is ill now" },
        { id: "c", text: "A marriage is not allowed" },
      ],
    },
    { id: "q2", prompt: "Being a carrier means a person is ill.", choices: [] },
    {
      id: "q3",
      prompt: "Who decides what to do next?",
      choices: [
        { id: "a", text: "The screening centre decides" },
        { id: "b", text: "You decide, with support if you want it" },
      ],
    },
  ],
};

const RESULT: TeachBackResult = {
  couple_id: "c-01",
  correct: 2,
  total: 3,
  items: [
    { id: "q1", correct: true, explanation: "A shared result points to a chance for a child. It is not a diagnosis." },
    { id: "q2", correct: true, explanation: "A carrier has one changed copy of a gene." },
    { id: "q3", correct: false, explanation: "The choice is yours." },
  ],
};

function renderQuiz(locale: "en" | "ar" | "ur" = "en", quiz: TeachBackQuiz = QUIZ) {
  return renderWithIntl(<TeachBack quiz={quiz} coupleId="c-01" locale={locale} />, locale);
}

/** One question per view: answer the first, step on, answer the second, step on to the last (left blank). */
async function answerTwo(user: ReturnType<typeof userEvent.setup>, falseLabel = "False", nextLabel = "Next question") {
  await user.click(within(screen.getByRole("group", { name: /shared result mean/ })).getByRole("radio", { name: /chance of a child/ }));
  await user.click(screen.getByRole("button", { name: nextLabel }));
  await user.click(within(screen.getByRole("group", { name: /carrier means/ })).getByRole("radio", { name: falseLabel }));
  await user.click(screen.getByRole("button", { name: nextLabel }));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.submitTeachback.mockResolvedValue(RESULT);
});

describe("TeachBack in English", () => {
  it("shows one question per view; a question with no options gets true, false and not sure", async () => {
    const user = userEvent.setup();
    renderQuiz();
    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check my answers" })).toBeNull();
    expect(within(screen.getByRole("group", { name: /shared result mean/ })).getAllByRole("radio")).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByText("Question 2 of 3")).toBeInTheDocument();
    const tfu = within(screen.getByRole("group", { name: /carrier means/ })).getAllByRole("radio");
    expect(tfu.map((radio) => (radio as HTMLInputElement).value)).toEqual(["true", "false", "not_sure"]);
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "Previous question" }));
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
  });

  it("is framed as practice for understanding, with no marks and no score", () => {
    renderQuiz();
    expect(screen.getByText(/no marks to earn/i)).toBeInTheDocument();
    expect(screen.getByText(/nobody is judging your answers/i)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("meter")).toBeNull();
    expect(document.body.textContent).not.toMatch(/%|score|grade|pass|fail/i);
  });

  it("submits the chosen answers, then shows N of M and each question with its explanation", async () => {
    const user = userEvent.setup();
    renderQuiz();

    await answerTwo(user);
    expect(screen.getByText("Answered 2 of 3. You can leave any question blank.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check my answers" }));

    await waitFor(() => expect(api.submitTeachback).toHaveBeenCalledWith("c-01", { q1: "a", q2: "false" }, "en"));
    const summary = await screen.findByRole("heading", { name: "2 of 3 answers matched the explanation" });
    expect(summary).toHaveFocus();
    expect(document.body.textContent).not.toMatch(/%/);
    expect(screen.queryByRole("group")).toBeNull();

    // The result is also a row of cells, one per question: solid = matches, dashed open = different.
    const cells = within(screen.getByTestId("quiz-cells")).getAllByRole("img");
    expect(cells).toHaveLength(3);
    expect(cells.map((cell) => cell.getAttribute("data-fill"))).toEqual(["solid", "solid", "open"]);
    expect(cells[2]).toHaveAccessibleName("Question 3 of 3: not answered");

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);

    const matched = items[0] as HTMLElement;
    expect(matched).toHaveAttribute("data-correct", "true");
    expect(within(matched).getByText("Matches the explanation")).toBeInTheDocument();
    expect(matched.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(within(matched).getByText(/points to a chance for a child/)).toBeInTheDocument();
    expect(within(matched).getByText(/A chance of a child with a condition/)).toBeInTheDocument();

    const different = items[2] as HTMLElement;
    expect(different).toHaveAttribute("data-correct", "false");
    expect(within(different).getByText("Different from the explanation")).toBeInTheDocument();
    expect(different.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(within(different).getByText("Not answered")).toBeInTheDocument();
    expect(within(different).getByText("The choice is yours.")).toBeInTheDocument();
  });

  it("resets for another go and puts focus back at the top", async () => {
    const user = userEvent.setup();
    renderQuiz();
    await answerTwo(user);
    await user.click(screen.getByRole("button", { name: "Check my answers" }));
    await screen.findByRole("heading", { name: /2 of 3/ });

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
    expect(screen.getByRole("heading", { name: "Check that the explanation made sense" })).toHaveFocus();
    expect(screen.queryByText(/answers matched/)).toBeNull();
  });

  it("shows the problem title and correlation id on failure and retries with the same answers", async () => {
    const user = userEvent.setup();
    api.submitTeachback.mockRejectedValueOnce(new ApiError({ type: "about:blank", title: "Quiz service unavailable", status: 503, correlation_id: "corr-5" }));
    renderQuiz();
    await answerTwo(user);

    await user.click(screen.getByRole("button", { name: "Check my answers" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Quiz service unavailable");
    expect(alert).toHaveTextContent("corr-5");
    expect(screen.getAllByRole("group")).toHaveLength(1);

    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: /2 of 3/ })).toBeInTheDocument();
    expect(api.submitTeachback).toHaveBeenCalledTimes(2);
    expect(api.submitTeachback.mock.calls[1]?.[1]).toEqual({ q1: "a", q2: "false" });
  });

  it("shows the draft-translation chip when the quiz is a draft", () => {
    renderQuiz();
    expect(screen.getByText(/draft translation/i)).toHaveClass("stamp");
  });
});

describe("TeachBack in Arabic and Urdu (RTL)", () => {
  it("renders Arabic right-to-left and keeps Western digits in N of M", async () => {
    const user = userEvent.setup();
    renderQuiz("ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByRole("button", { name: "السؤال التالي" })).toBeInTheDocument();

    await answerTwo(user, "خطأ", "السؤال التالي");
    await user.click(screen.getByRole("button", { name: "تحقق من إجاباتي" }));

    const summary = await screen.findByRole("heading", { name: "2 من 3 إجابات طابقت الشرح" });
    expect(api.submitTeachback).toHaveBeenCalledWith("c-01", { q1: "a", q2: "false" }, "ar");
    expect(summary.textContent).not.toMatch(/[٠-٩]/);
    expect(screen.getAllByText("تطابق الشرح").length).toBeGreaterThan(0);
    expect(screen.getByText("تختلف عن الشرح")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bquiz\.[a-z]/);
    expect(document.body.textContent).not.toMatch(/%/);
  });

  it("renders Urdu right-to-left and keeps Western digits in N of M", async () => {
    const user = userEvent.setup();
    renderQuiz("ur");
    expect(document.documentElement.dir).toBe("rtl");

    await answerTwo(user, "غلط", "اگلا سوال");
    await user.click(screen.getByRole("button", { name: "میرے جوابات جانچیں" }));

    const summary = await screen.findByRole("heading", { name: "3 میں سے 2 جوابات وضاحت سے میل کھاتے ہیں" });
    expect(api.submitTeachback).toHaveBeenCalledWith("c-01", { q1: "a", q2: "false" }, "ur");
    expect(summary.textContent).not.toMatch(/[۰-۹٠-٩]/);
  });
});
