import { screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEvent, AuditVerification } from "@/lib/api/types";
import { renderWithIntl } from "@/test/render";
import { AuditTape } from "./AuditTape";

const api = vi.hoisted(() => ({ audit: vi.fn(), verifyAudit: vi.fn() }));
const nav = vi.hoisted(() => ({ pathname: "/couple/result" }));
vi.mock("@/lib/api/client", () => ({ clientApi: api }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => nav.pathname,
}));

const event = (index: number, action: string): AuditEvent => ({
  index,
  event_id: `e-${index}`,
  at: "2026-11-20T10:02:00Z",
  actor_role: "couple_member",
  actor_id: "p",
  action,
  couple_id: "c",
  detail: "",
  prev_hash: "a",
  hash: "b",
});
const verification = (over: Partial<AuditVerification> = {}): AuditVerification => ({
  ok: true,
  scope: "own_couple",
  own_events: 3,
  length: null,
  head_hash: null,
  first_bad_index: null,
  ...over,
});

describe("AuditTape", () => {
  beforeEach(() => {
    api.audit.mockReset();
    api.verifyAudit.mockReset();
    nav.pathname = "/couple/result";
  });

  it("shows the last two events newest first, links to the audit table and reports the verified count", async () => {
    api.audit.mockResolvedValue([event(1, "consent_granted"), event(2, "result_viewed"), event(3, "consent_revoked")]);
    api.verifyAudit.mockResolvedValue(verification({ own_events: 3 }));
    renderWithIntl(<AuditTape coupleId="cpl-1" />);
    expect(await screen.findByText(/#3 consent_revoked/)).toBeInTheDocument();
    expect(screen.getByText(/#2 result_viewed/)).toBeInTheDocument();
    expect(screen.queryByText(/#1 consent_granted/)).not.toBeInTheDocument();
    expect(await screen.findByText("hash chain intact, 3 events")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/couple/sharing#audit");
  });

  it.each([
    ["en", 1, "hash chain intact, 1 event"],
    ["ar", 1, "سلسلة التجزئة سليمة، حدث واحد"],
    ["ar", 2, "سلسلة التجزئة سليمة، حدثان"],
    ["ar", 3, "سلسلة التجزئة سليمة، 3 أحداث"],
    ["ar", 11, "سلسلة التجزئة سليمة، 11 حدثًا"],
    ["ar", 100, "سلسلة التجزئة سليمة، 100 حدث"],
    ["ur", 766, "ہیش چین برقرار، 766 واقعات"],
  ] as const)("counts the events with the right plural form in %s (%i)", async (locale, count, text) => {
    api.audit.mockResolvedValue([event(1, "x")]);
    api.verifyAudit.mockResolvedValue(verification({ own_events: count }));
    renderWithIntl(<AuditTape coupleId="cpl-1" />, locale);
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it("states the first bad index when the chain does not verify", async () => {
    api.audit.mockResolvedValue([event(1, "x")]);
    api.verifyAudit.mockResolvedValue(verification({ ok: false, first_bad_index: 7 }));
    renderWithIntl(<AuditTape coupleId="cpl-1" />);
    expect(await screen.findByText("chain check failed at #7")).toBeInTheDocument();
  });

  it("says there are no events yet", async () => {
    api.audit.mockResolvedValue([]);
    api.verifyAudit.mockResolvedValue(verification({ own_events: 0 }));
    renderWithIntl(<AuditTape coupleId="cpl-1" />);
    expect(await screen.findByText("No events yet")).toBeInTheDocument();
  });

  it("offers a retry when the audit log cannot be read, and keeps events with 'not checked' when only verification fails", async () => {
    api.audit.mockRejectedValueOnce(new Error("down"));
    renderWithIntl(<AuditTape coupleId="cpl-1" />);
    expect(await screen.findByText("Audit unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "retry" })).toBeInTheDocument();

    api.audit.mockResolvedValue([event(1, "result_viewed")]);
    api.verifyAudit.mockRejectedValue(new Error("down"));
    renderWithIntl(<AuditTape coupleId="cpl-2" />);
    expect(await screen.findByText("chain not checked")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(/#1 result_viewed/).length).toBeGreaterThan(0));
  });

  it("renders nothing outside the couple routes", () => {
    nav.pathname = "/staff";
    const { container } = renderWithIntl(<AuditTape coupleId="cpl-1" />);
    expect(container.querySelector(".tape")).toBeNull();
    expect(api.audit).not.toHaveBeenCalled();
  });
});
