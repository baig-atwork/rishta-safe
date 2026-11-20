import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsentRecord, Partner } from "@/lib/api/types";
import { renderWithIntl } from "@/test/render";
import { VisibilityMatrix } from "./VisibilityMatrix";

const api = vi.hoisted(() => ({ consents: vi.fn(), grantConsent: vi.fn(), revokeConsent: vi.fn(), audit: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ clientApi: api }));

const partner: Partner = { person_id: "prs-02b", display_name: "Anwar Demo (synthetic)", sex: "male", language: "ar" };
const seeded: ConsentRecord = {
  consent_id: "consent-00001",
  couple_id: "cpl-demo-02",
  subject_person_id: "prs-02a",
  recipient: "prs-02b",
  scope: "couple_result_only",
  purpose: "partner_disclosure",
  granted_at: "2026-11-20T01:58:38Z",
  expires_at: null,
  revoked_at: null,
};

function renderMatrix(consents: ConsentRecord[], locale: "en" | "ar" | "ur" = "en") {
  api.consents.mockResolvedValue(consents);
  return renderWithIntl(<VisibilityMatrix coupleId="cpl-demo-02" meId="prs-02a" partner={partner} initialConsents={consents} policy="abu_dhabi" />, locale);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.audit.mockResolvedValue([]);
});

describe("VisibilityMatrix", () => {
  it("is a real table: scope headers, three layer rows, the partner column then the four fixed columns", () => {
    renderMatrix([seeded]);
    const table = screen.getByRole("table", { name: /who can see which part/i });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(6);
    expect(within(table).getAllByRole("rowheader")).toHaveLength(3);
    expect(screen.getByRole("region", { name: /scrolls sideways/ })).toHaveAttribute("tabindex", "0");
    for (const scope of ["couple_result_only", "gene_names_only", "full_variant_detail"]) expect(screen.getByText(scope)).toBeInTheDocument();
  });

  it("the switch states equal the ledger for seeded case 2: shared for the couple result, off for the other two", () => {
    renderMatrix([seeded]);
    const switches = screen.getAllByRole("switch");
    expect(switches.map((s) => s.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    expect(switches[0]).toHaveTextContent("Shared with Anwar");
    expect(switches[0]).toHaveTextContent("Revoke");
    expect(switches[1]).toHaveTextContent("Not shared");
    expect(switches[1]).toHaveAccessibleName(/Share.*Gene names/);
  });

  it("the fixed cells carry text and a glyph and no focusable control", () => {
    renderMatrix([seeded]);
    const fixed = document.querySelectorAll("[data-fixed]");
    expect(fixed).toHaveLength(12);
    for (const cell of Array.from(fixed)) {
      expect(cell.querySelector("button, a, input, select, [tabindex]")).toBeNull();
      expect(cell.querySelector(".cell")).not.toBeNull();
      expect(cell.textContent).toMatch(/fixed/i);
    }
    expect(screen.getAllByText("Receives by law")).toHaveLength(3);
    expect(screen.getAllByText("Never")).toHaveLength(6);
    // the care team cell cites the emirate's disclosure rule
    expect(screen.getAllByText("Sees what the Abu Dhabi rule allows, for your care")).toHaveLength(3);
  });

  it("Share grants one partner_disclosure consent to the partner and announces the recorded action", async () => {
    const user = userEvent.setup();
    const granted = { ...seeded, consent_id: "consent-00002", scope: "gene_names_only" } as const;
    api.grantConsent.mockImplementation(async () => {
      api.consents.mockResolvedValue([seeded, granted]); // the server's ledger now has the new row
      return granted;
    });
    renderMatrix([seeded]);
    await user.click(screen.getByRole("switch", { name: /Share.*Gene names/ }));
    await waitFor(() => expect(api.grantConsent).toHaveBeenCalledTimes(1));
    expect(api.grantConsent).toHaveBeenCalledWith("cpl-demo-02", {
      subject_person_id: "prs-02a",
      recipient_role: "prs-02b",
      scope: "gene_names_only",
      purpose: "partner_disclosure",
      expires_at: null,
    });
    expect(await screen.findByText("Recorded: consent_granted")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("switch").map((s) => s.getAttribute("aria-checked"))).toEqual(["true", "true", "false"]));
  });

  it("Revoke asks first, then revokes through the API and the switch turns off", async () => {
    const user = userEvent.setup();
    const revoked = { ...seeded, revoked_at: "2026-11-20T02:00:00Z" };
    api.revokeConsent.mockImplementation(async () => {
      api.consents.mockResolvedValue([revoked]);
      return revoked;
    });
    renderMatrix([seeded]);
    await user.click(screen.getByRole("switch", { name: /Revoke.*Couple result/ }));
    const dialog = await screen.findByRole("dialog");
    expect(api.revokeConsent).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Revoke sharing" }));
    await waitFor(() => expect(api.revokeConsent).toHaveBeenCalledWith("consent-00001"));
    expect(await screen.findByText("Recorded: consent_revoked")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("switch").every((s) => s.getAttribute("aria-checked") === "false")).toBe(true));
  });

  it("a failed change leaves the switch as it was and says so in that row", async () => {
    const user = userEvent.setup();
    api.grantConsent.mockRejectedValue(Object.assign(new Error("x"), { problem: { type: "about:blank", title: "Service unavailable", status: 503 }, correlationId: "corr-3" }));
    renderMatrix([]);
    expect(screen.getByTestId("matrix-empty")).toHaveTextContent("Nothing is shared yet. Use Share in the first column.");
    await user.click(screen.getByRole("switch", { name: /Share.*Couple result/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That change was not saved.");
    expect(screen.getAllByRole("switch").every((s) => s.getAttribute("aria-checked") === "false")).toBe(true);
  });

  it.each(["ar", "ur"] as const)("renders in %s right-to-left with no raw message keys", (locale) => {
    renderMatrix([seeded], locale);
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.body.textContent).not.toMatch(/\bsharing\.[a-z]/);
    expect(screen.getAllByRole("switch")).toHaveLength(3);
  });
});
