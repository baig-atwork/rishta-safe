import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/transport";
import type { ClinicianProformaInput, ClosureRecord, ProformaField } from "@/lib/api/types";
import { renderWithIntl } from "@/test/render";
import { ProformaForm } from "./ProformaForm";

const submitProforma = vi.hoisted(() => vi.fn<(coupleId: string, input: ClinicianProformaInput) => Promise<ClosureRecord>>());
vi.mock("@/lib/api/client", () => ({ clientApi: { submitProforma } }));

const FIELDS: ProformaField[] = [
  { id: "encounter", number: 1, label: "Encounter details", filled_by: "system", kind: "system", choices: [], hint: null },
  {
    id: "information_given",
    number: 4,
    label: "Information given",
    filled_by: "clinician",
    kind: "checklist",
    choices: [
      { id: "carrier_vs_disease", text: "Carrier is not the same as having the disease" },
      { id: "test_limits", text: "The limits of the test" },
    ],
    hint: "Tick each item that was explained.",
  },
  {
    id: "next_step",
    number: 5,
    label: "Next clinical step",
    filled_by: "clinician",
    kind: "single_choice",
    choices: [
      { id: "decided", text: "Decided" },
      { id: "still_deciding", text: "Still deciding" },
    ],
    hint: null,
  },
  { id: "teach_back_done", number: 6, label: "Teach-back done", filled_by: "clinician", kind: "yes_no", choices: [], hint: null },
  { id: "note", number: 7, label: "Summary note", filled_by: "clinician", kind: "text", choices: [], hint: null },
  {
    id: "plan",
    number: 8,
    label: "Plan",
    filled_by: "clinician",
    kind: "action_list",
    choices: [
      { id: "confirmatory_test", text: "Confirmatory test" },
      { id: "recontact", text: "Recontact" },
    ],
    hint: null,
  },
  { id: "service_preference", number: 10, label: "Service preference", filled_by: "patient", kind: "single_choice", choices: [], hint: null },
];

const RECORD: ClosureRecord = {
  record_id: "rec-demo-1",
  couple_id: "c-01",
  kind: "clinician",
  submitted_at: "2026-11-20T08:00:00Z",
  simulated: true,
};

beforeEach(() => {
  submitProforma.mockReset();
});

describe("ProformaForm", () => {
  it("has no marriage field, shows system fields read-only, and leaves patient fields to the patient", () => {
    renderWithIntl(<ProformaForm coupleId="c-01" fields={FIELDS} />);

    expect(screen.queryAllByLabelText(/marry|marriage/i)).toHaveLength(0);
    const form = screen.getByRole("form", { name: "Closure proforma" });
    expect(within(form).queryByText(/marry|marriage/i)).not.toBeInTheDocument();

    const system = screen.getByLabelText(/Encounter details/);
    expect(system).toHaveAttribute("readonly");
    expect(system).toHaveValue("Recorded by the system when the form is saved");
    expect(screen.getByText("Filled by the system")).toBeInTheDocument();

    expect(screen.getByText("Completed by the patient")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Service preference/)).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Service preference/ })).not.toBeInTheDocument();

    for (const control of screen.getAllByRole("textbox")) {
      if (control.getAttribute("readonly") === null) expect(control).not.toHaveAccessibleName(/Encounter details/);
    }
  });

  it("renders each clinician kind as the matching control", () => {
    renderWithIntl(<ProformaForm coupleId="c-01" fields={FIELDS} />);

    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
    expect(screen.getByRole("group", { name: /Next clinical step/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Decided" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Summary note/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add an action" })).toBeInTheDocument();
  });

  it("will not save an empty form", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ProformaForm coupleId="c-01" fields={FIELDS} />);

    await user.click(screen.getByRole("button", { name: "Save proforma" }));

    expect(await screen.findByText("Complete at least one field before saving.")).toBeInTheDocument();
    expect(submitProforma).not.toHaveBeenCalled();
  });

  it("collects checklist, choice, text and repeatable action rows into the answers", async () => {
    submitProforma.mockResolvedValue(RECORD);
    const user = userEvent.setup();
    renderWithIntl(<ProformaForm coupleId="c-01" fields={FIELDS} />);

    await user.click(screen.getByRole("checkbox", { name: "The limits of the test" }));
    await user.click(screen.getByRole("radio", { name: "Still deciding" }));
    await user.click(screen.getByRole("radio", { name: "Yes" }));
    await user.type(screen.getByRole("textbox", { name: /Summary note/ }), "Discussed in plain language.");

    await user.click(screen.getByRole("button", { name: "Add an action" }));
    await user.selectOptions(screen.getByLabelText("Action"), "recontact");
    await user.type(screen.getByLabelText("Owner"), "counsellor");
    await user.type(screen.getByLabelText("Due date"), "2026-12-01");

    await user.click(screen.getByRole("button", { name: "Save proforma" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Proforma saved");
    expect(screen.getByText("rec-demo-1")).toBeInTheDocument();
    expect(screen.getByText("Simulated store")).toBeInTheDocument();
    expect(submitProforma).toHaveBeenCalledWith("c-01", {
      answers: {
        information_given: ["test_limits"],
        next_step: "still_deciding",
        teach_back_done: "yes",
        note: "Discussed in plain language.",
        plan: [JSON.stringify({ action: "recontact", owner: "counsellor", due: "2026-12-01" })],
      },
    });
  });

  it("adds and removes action rows, and blocks an incomplete row", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ProformaForm coupleId="c-01" fields={FIELDS} />);

    await user.click(screen.getByRole("button", { name: "Add an action" }));
    await user.click(screen.getByRole("button", { name: "Add an action" }));
    expect(screen.getAllByRole("group", { name: /^Action \d$/ })).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Remove action 2" }));
    expect(screen.getAllByRole("group", { name: /^Action \d$/ })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Save proforma" }));
    expect(await screen.findByText("Complete the action, owner and due date, or remove the row.")).toBeInTheDocument();
    expect(submitProforma).not.toHaveBeenCalled();
  });

  it("shows server problems with the correlation id and a retry", async () => {
    submitProforma.mockRejectedValueOnce(
      new ApiError({
        type: "about:blank",
        title: "Validation failed",
        status: 422,
        correlation_id: "corr-proforma-1",
        errors: [{ field: "answers.next_step", message: "A next step is needed" }],
      }),
    );
    const user = userEvent.setup();
    renderWithIntl(<ProformaForm coupleId="c-01" fields={FIELDS} />);

    await user.type(screen.getByRole("textbox", { name: /Summary note/ }), "x");
    await user.click(screen.getByRole("button", { name: "Save proforma" }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("corr-proforma-1")).toBeInTheDocument();
    expect(screen.getByText("A next step is needed")).toBeInTheDocument();

    submitProforma.mockResolvedValueOnce(RECORD);
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Proforma saved");
    expect(submitProforma).toHaveBeenCalledTimes(2);
  });
});
