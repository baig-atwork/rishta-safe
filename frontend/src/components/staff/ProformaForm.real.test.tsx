import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import closureSchema from "@/lib/api/real/__fixtures__/closure_schema_en.json";
import { fromBackendResponse, toBackendRequest } from "@/lib/api/real/adapter";
import type { ClinicianProformaInput, ClosureRecord, ClosureSchema } from "@/lib/api/types";
import { renderWithIntl } from "@/test/render";
import { ProformaForm } from "./ProformaForm";

/** The proforma form against the field list the REAL closure schema produces (through the adapter), not a hand-made one. */

const submitProforma = vi.hoisted(() => vi.fn<(coupleId: string, input: ClinicianProformaInput) => Promise<ClosureRecord>>());
vi.mock("@/lib/api/client", () => ({ clientApi: { submitProforma } }));

const schema = fromBackendResponse({ method: "GET", path: "/v1/closure/schema", query: { locale: "en" } }, closureSchema) as ClosureSchema;

const RECORD: ClosureRecord = { record_id: "rec-real-1", couple_id: "cpl-demo-02", kind: "clinician", submitted_at: "2026-11-20T08:00:00Z", simulated: true };

beforeEach(() => {
  submitProforma.mockReset();
});

function group(name: RegExp): HTMLElement {
  return screen.getByRole("group", { name });
}

describe("ProformaForm with the real closure schema", () => {
  it("renders all 12 numbered proforma fields, under the ids the real backend maps", () => {
    const { container } = renderWithIntl(<ProformaForm coupleId="cpl-demo-02" fields={schema.proforma_fields} draft />);

    const numbers = new Set([...container.querySelectorAll("span.font-mono")].map((node) => node.textContent));
    for (let n = 1; n <= 12; n += 1) expect(numbers.has(String(n)), `field ${n}`).toBe(true);

    const ids = schema.proforma_fields.map((field) => field.id);
    expect(ids).toEqual(expect.arrayContaining(["risk_signal", "findings_discussed", "information_given", "next_step_status", "teach_back", "plan", "referral_task", "service_preference", "completed_by"]));
    // The system fields are read-only, the patient's own field is left to the patient.
    expect(screen.getAllByText("Filled by the system").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Completed by the patient")).toBeInTheDocument();
    expect(screen.queryAllByLabelText(/marry|marriage/i)).toHaveLength(0);
  });

  it("offers the plan owner as a select of the roles the server accepts, and sends the role id", async () => {
    submitProforma.mockResolvedValue(RECORD);
    const user = userEvent.setup();
    renderWithIntl(<ProformaForm coupleId="cpl-demo-02" fields={schema.proforma_fields} />);

    await user.click(screen.getByRole("button", { name: "Add an action" }));
    const owner = screen.getByLabelText("Owner");
    expect(owner.tagName).toBe("SELECT");
    expect(within(owner).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual(["", "clinician", "counsellor", "couple_member", "programme"]);

    await user.selectOptions(screen.getByLabelText("Action"), "referral");
    await user.selectOptions(owner, "counsellor");
    await user.type(screen.getByLabelText("Due date"), "2026-12-01");
    await user.click(screen.getByRole("button", { name: "Save proforma" }));

    await screen.findByRole("status");
    expect(submitProforma).toHaveBeenCalledWith("cpl-demo-02", {
      answers: expect.objectContaining({ plan: [JSON.stringify({ action: "referral", owner: "counsellor", due: "2026-12-01" })] }) as ClinicianProformaInput["answers"],
    });
  });

  it("does not save an action whose owner was left unchosen", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ProformaForm coupleId="cpl-demo-02" fields={schema.proforma_fields} />);

    await user.click(screen.getByRole("button", { name: "Add an action" }));
    await user.selectOptions(screen.getByLabelText("Action"), "referral");
    await user.type(screen.getByLabelText("Due date"), "2026-12-01");
    await user.click(screen.getByRole("button", { name: "Save proforma" }));

    expect(await screen.findByText("Complete the action, owner and due date, or remove the row.")).toBeInTheDocument();
    expect(submitProforma).not.toHaveBeenCalled();
  });

  it("fills in end to end: the answers the form sends become a complete real ClinicianProforma", async () => {
    submitProforma.mockResolvedValue(RECORD);
    const user = userEvent.setup();
    renderWithIntl(<ProformaForm coupleId="cpl-demo-02" fields={schema.proforma_fields} />);

    await user.click(within(group(/Visit mode/)).getByRole("radio", { name: "In person" }));
    await user.type(screen.getByRole("textbox", { name: /Visit length in minutes/ }), "30");
    await user.click(within(group(/Session language/)).getByRole("radio", { name: "English" }));
    await user.click(within(group(/Interpreter used/)).getByRole("radio", { name: "No" }));
    await user.click(screen.getByRole("checkbox", { name: "The couple-level result was discussed" }));
    await user.click(screen.getByRole("checkbox", { name: "A carrier is not ill, and a result is not a diagnosis" }));
    await user.click(within(group(/Choices discussed/)).getByRole("radio", { name: "The next clinical step is decided" }));
    await user.click(within(group(/Teach-back/)).getByRole("radio", { name: "Accurate" }));
    await user.click(within(group(/Questions were invited/)).getByRole("radio", { name: "Yes" }));
    await user.click(within(group(/Questions were answered/)).getByRole("radio", { name: "Yes" }));
    await user.click(within(group(/A copy was given/)).getByRole("radio", { name: "Yes" }));
    await user.click(screen.getByRole("button", { name: "Save proforma" }));

    await screen.findByRole("status");
    const call = submitProforma.mock.calls[0];
    expect(call?.[0]).toBe("cpl-demo-02");
    const real = toBackendRequest({ method: "POST", path: "/v1/couples/cpl-demo-02/closure/clinician", body: call?.[1] });
    expect(real.body).toMatchObject({
      encounter: { mode: "in_person", duration_minutes: 30, session_language: "en", interpreter_used: false },
      findings_discussed: [{ finding_ref: "couple_result", explained_as_chance_not_diagnosis: false, flagged_uncertain: false }],
      information_given: { carrier_vs_disease: true, couple_numbers: false },
      next_step_status: "decided",
      teach_back_done: true,
      teach_back_result: "accurate",
      patient_questions_invited: true,
      patient_questions_answered: true,
      plan: [],
      patient_copy_given: true,
    });
  });

  it("shows a server-side missing-field error on the UI field it came from", async () => {
    submitProforma.mockRejectedValue(
      Object.assign(new Error("Validation failed"), {
        name: "ApiError",
        problem: {
          type: "about:blank",
          title: "Validation failed",
          status: 422,
          errors: [{ field: "answers.next_step_status", message: "Field required" }],
        },
      }),
    );
    const user = userEvent.setup();
    renderWithIntl(<ProformaForm coupleId="cpl-demo-02" fields={schema.proforma_fields} />);

    await user.click(screen.getByRole("checkbox", { name: "The couple-level result was discussed" }));
    await user.click(screen.getByRole("button", { name: "Save proforma" }));

    expect(await screen.findByText("Field required")).toBeInTheDocument();
  });
});
