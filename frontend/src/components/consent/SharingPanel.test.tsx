import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/transport";
import type { ConsentRecord, Partner } from "@/lib/api/types";
import { renderWithIntl } from "@/test/render";
import { SharingPanel } from "./SharingPanel";

const api = vi.hoisted(() => ({
  consents: vi.fn(),
  grantConsent: vi.fn(),
  revokeConsent: vi.fn(),
  audit: vi.fn(),
  verifyAudit: vi.fn(),
}));
vi.mock("@/lib/api/client", () => ({ clientApi: api }));

const VIEWER = "p-amira";
const PARTNERS: Partner[] = [
  { person_id: "p-amira", display_name: "Amira Test", sex: "female" },
  { person_id: "p-nabil", display_name: "Nabil Test", sex: "male" },
];

function record(overrides: Partial<ConsentRecord> & Pick<ConsentRecord, "consent_id" | "purpose">): ConsentRecord {
  return {
    couple_id: "c-01",
    subject_person_id: VIEWER,
    recipient: "p-nabil",
    scope: "couple_result_only",
    granted_at: "2026-11-01T09:00:00Z",
    expires_at: null,
    revoked_at: null,
    ...overrides,
  };
}

function fixture(): ConsentRecord[] {
  return [
    record({ consent_id: "c-1", purpose: "Own active share" }),
    record({ consent_id: "c-2", purpose: "Partner share", subject_person_id: "p-nabil", recipient: VIEWER, scope: "gene_names_only" }),
    record({ consent_id: "c-3", purpose: "Own expired share", recipient: "counsellor", expires_at: "2000-01-01T00:00:00Z" }),
    record({ consent_id: "c-4", purpose: "Own revoked share", recipient: "counsellor", revoked_at: "2026-11-05T09:00:00Z" }),
  ];
}

/** A stateful stand-in for the server so refetches after a mutation return what the mutation did. */
function mockServer(initial: ConsentRecord[]) {
  let rows = initial;
  api.consents.mockImplementation(() => Promise.resolve(rows));
  api.revokeConsent.mockImplementation((id: string) => {
    const current = rows.find((row) => row.consent_id === id);
    if (!current) return Promise.reject(new Error("unknown consent"));
    const updated = { ...current, revoked_at: "2026-11-20T10:00:00Z" };
    rows = rows.map((row) => (row.consent_id === id ? updated : row));
    return Promise.resolve(updated);
  });
  api.grantConsent.mockImplementation((_coupleId: string, input: { recipient_role: string; scope: ConsentRecord["scope"]; purpose: string; expires_at: string | null }) => {
    const created = record({ consent_id: "c-new", purpose: input.purpose, recipient: input.recipient_role, scope: input.scope, expires_at: input.expires_at });
    rows = [...rows, created];
    return Promise.resolve(created);
  });
}

function renderPanel(consents: ConsentRecord[], locale: "en" | "ar" | "ur" = "en") {
  mockServer(consents);
  return renderWithIntl(<SharingPanel initialConsents={consents} viewerPersonId={VIEWER} partners={PARTNERS} coupleId="c-01" locale={locale} />, locale);
}

function rowFor(purpose: string): HTMLElement {
  const row = screen.getByText(purpose).closest("tr");
  if (!row) throw new Error(`no row for ${purpose}`);
  return row;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SharingPanel in English (LTR)", () => {
  it("renders the consent ledger as a real table with a caption, eight columns and a status tag per row", () => {
    renderPanel(fixture());
    expect(document.documentElement.dir).toBe("ltr");

    const table = screen.getByRole("table", { name: /sharing choice recorded/i });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(8);
    expect(within(table).getAllByRole("row")).toHaveLength(1 + 4);

    expect(within(rowFor("Own active share")).getByText("Active")).toBeInTheDocument();
    expect(within(rowFor("Own expired share")).getByText("Expired")).toBeInTheDocument();
    expect(within(rowFor("Own revoked share")).getByText("Revoked")).toBeInTheDocument();
    // Cells carry their column label so the stacked layout below 40rem stays readable.
    expect(rowFor("Own active share").querySelector('td[data-label="Purpose"]')).not.toBeNull();
  });

  it("says plainly that the state is a statutory recipient and never claims to hide data from it", () => {
    renderPanel(fixture());
    expect(screen.getByText(/statutory recipient of screening data/i)).toBeInTheDocument();
    expect(screen.getByText(/never claims to/i)).toBeInTheDocument();
    expect(screen.getByText(/right not to know/i)).toBeInTheDocument();
  });

  it("offers revoke only on the viewer's own active row; a partner's row is read-only", () => {
    renderPanel(fixture());
    expect(within(rowFor("Partner share")).queryByRole("button")).toBeNull();
    expect(within(rowFor("Partner share")).getByText(/only .*nabil.* can change this row/i)).toBeInTheDocument();
    expect(within(rowFor("Own expired share")).queryByRole("button")).toBeNull();
    expect(within(rowFor("Own revoked share")).queryByRole("button")).toBeNull();
    expect(within(rowFor("Own active share")).getByRole("button", { name: /revoke/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /revoke/i })).toHaveLength(1);
  });

  it("asks for confirmation, revokes through the API, and announces the change", async () => {
    const user = userEvent.setup();
    renderPanel(fixture());

    await user.click(within(rowFor("Own active share")).getByRole("button", { name: /revoke/i }));
    const dialog = await screen.findByRole("dialog", { name: /stop sharing with/i });
    expect(api.revokeConsent).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Revoke sharing" }));

    await waitFor(() => expect(api.revokeConsent).toHaveBeenCalledWith("c-1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await within(rowFor("Own active share")).findByText("Revoked")).toBeInTheDocument();
    expect(within(rowFor("Own active share")).queryByRole("button")).toBeNull();
    expect(await screen.findByText(/sharing revoked: couple result only/i)).toBeInTheDocument();
  });

  it("keeps sharing when the dialog is dismissed, and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderPanel(fixture());

    const trigger = within(rowFor("Own active share")).getByRole("button", { name: /revoke/i });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Keep sharing" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(api.revokeConsent).not.toHaveBeenCalled();
    expect(within(rowFor("Own active share")).getByText("Active")).toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("shows inline errors for an empty purpose and no recipient, and does not call the API", async () => {
    const user = userEvent.setup();
    renderPanel(fixture());

    const submit = screen.getByRole("button", { name: "Grant sharing" });
    await user.click(submit);

    expect(await screen.findByText("Choose a purpose.")).toBeInTheDocument();
    expect(screen.getByText("Choose who to share with.")).toBeInTheDocument();
    expect(screen.getByLabelText("Purpose")).toHaveAttribute("aria-invalid", "true");
    expect(api.grantConsent).not.toHaveBeenCalled();
    expect(submit).toBeEnabled();
  });

  it("grants a share with the viewer as the subject and shows the new row", async () => {
    const user = userEvent.setup();
    renderPanel(fixture());

    await user.selectOptions(screen.getByLabelText("Share with"), "counsellor");
    await user.selectOptions(screen.getByLabelText("Purpose"), "couple_counselling");
    await user.click(screen.getByRole("button", { name: "Grant sharing" }));

    await waitFor(() =>
      expect(api.grantConsent).toHaveBeenCalledWith("c-01", {
        subject_person_id: VIEWER,
        recipient_role: "counsellor",
        scope: "couple_result_only",
        purpose: "couple_counselling",
        expires_at: null,
      }),
    );
    // The ledger shows the purpose as its label, not the id.
    expect(await within(screen.getByRole("table")).findByText("Share my findings with the counsellor or clinician for our counselling")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).queryByText("couple_counselling")).not.toBeInTheDocument();
    expect(await screen.findByText(/sharing granted: couple result only with counsellor/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Purpose")).toHaveValue("");
  });

  it("offers exactly the purposes the backend accepts, and no free-text purpose box", () => {
    renderPanel(fixture());

    const purpose = screen.getByLabelText("Purpose");
    expect(purpose.tagName).toBe("SELECT");
    expect(within(purpose).getAllByRole("option").map((option) => option.getAttribute("value"))).toEqual([
      "",
      "partner_disclosure",
      "couple_counselling",
      "service_referral",
      "service_interest_follow_up",
      "research_secondary_use",
    ]);
  });

  it("shows a recorded purpose id as its label and older free text as written", () => {
    renderPanel([...fixture(), record({ consent_id: "c-5", purpose: "partner_disclosure" })]);

    expect(within(screen.getByRole("table")).getByText("Share my findings with my partner, to the level I choose")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Own active share")).toBeInTheDocument();
  });

  it("rejects an expiry date in the past", async () => {
    const user = userEvent.setup();
    renderPanel(fixture());

    await user.selectOptions(screen.getByLabelText("Share with"), "counsellor");
    await user.selectOptions(screen.getByLabelText("Purpose"), "couple_counselling");
    await user.type(screen.getByLabelText(/Ends on/), "2001-01-01");
    await user.click(screen.getByRole("button", { name: "Grant sharing" }));

    expect(await screen.findByText("Choose a date after today.")).toBeInTheDocument();
    expect(api.grantConsent).not.toHaveBeenCalled();
  });

  it("shows the API problem title and correlation id when granting fails", async () => {
    const user = userEvent.setup();
    renderPanel(fixture());
    api.grantConsent.mockRejectedValueOnce(
      new ApiError({ type: "about:blank", title: "Consent store unavailable", status: 503, correlation_id: "corr-1234" }),
    );

    await user.selectOptions(screen.getByLabelText("Share with"), "counsellor");
    await user.selectOptions(screen.getByLabelText("Purpose"), "partner_disclosure");
    await user.click(screen.getByRole("button", { name: "Grant sharing" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Consent store unavailable");
    expect(alert).toHaveTextContent("corr-1234");
    expect(screen.getByRole("button", { name: "Grant sharing" })).toBeEnabled();
  });

  it("shows an onboarding empty state whose call to action focuses the grant form", async () => {
    const user = userEvent.setup();
    renderPanel([]);

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("heading", { name: "Nothing is shared yet" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Choose who sees what" }));
    expect(screen.getByLabelText("Share with")).toHaveFocus();
  });
});

describe("SharingPanel in Arabic (RTL)", () => {
  it("lays out right-to-left and renders Arabic strings with no raw message keys", () => {
    const { container } = renderPanel(fixture(), "ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull();

    expect(screen.getByRole("heading", { name: "سجل المشاركة" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "شارك تقريرك" })).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(8);
    expect(within(table).getByText("تاريخ المنح")).toBeInTheDocument();
    expect(within(rowFor("Own active share")).getByText("سارية")).toBeInTheDocument();
    expect(within(rowFor("Own expired share")).getByText("منتهية")).toBeInTheDocument();
    expect(within(rowFor("Own revoked share")).getByText("مسحوبة")).toBeInTheDocument();

    expect(screen.queryByText(/^sharing\./)).toBeNull();
    expect(document.body.textContent).not.toMatch(/\bsharing\.[a-z]/);
    // Latin-script English fallbacks would mean a missing Arabic string.
    expect(screen.queryByText("Sharing ledger")).toBeNull();
  });

  it("keeps the same rules in Arabic: partner row read-only, own row revokes through a confirm dialog", async () => {
    const user = userEvent.setup();
    renderPanel(fixture(), "ar");

    expect(within(rowFor("Partner share")).queryByRole("button")).toBeNull();
    await user.click(within(rowFor("Own active share")).getByRole("button", { name: /سحب/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/إيقاف المشاركة مع/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "سحب المشاركة" }));

    await waitFor(() => expect(api.revokeConsent).toHaveBeenCalledWith("c-1"));
    expect(await within(rowFor("Own active share")).findByText("مسحوبة")).toBeInTheDocument();
  });

  it("shows validation errors in Arabic for an empty purpose", async () => {
    const user = userEvent.setup();
    renderPanel(fixture(), "ar");

    await user.click(screen.getByRole("button", { name: "منح المشاركة" }));
    expect(await screen.findByText("اختر غرضاً.")).toBeInTheDocument();
    expect(screen.getByText("اختر من تشارك معه.")).toBeInTheDocument();
    expect(api.grantConsent).not.toHaveBeenCalled();
  });
});

describe("SharingPanel in Urdu (RTL)", () => {
  it("renders Urdu strings with no raw message keys", () => {
    renderPanel(fixture(), "ur");
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByRole("heading", { name: "شیئرنگ کا ریکارڈ" })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\bsharing\.[a-z]/);
  });
});
