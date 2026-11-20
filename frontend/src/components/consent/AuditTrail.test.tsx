import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/transport";
import type { AuditEvent, AuditVerification } from "@/lib/api/types";
import { shortHash } from "@/lib/format";
import { renderWithIntl } from "@/test/render";
import { AuditTrail } from "./AuditTrail";

const api = vi.hoisted(() => ({
  audit: vi.fn(),
  verifyAudit: vi.fn(),
  consents: vi.fn(),
}));
vi.mock("@/lib/api/client", () => ({ clientApi: api }));

const hash = (n: number) => String(n).repeat(64).slice(0, 64);

function events(count: number): AuditEvent[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    event_id: `e-${i}`,
    at: `2026-11-0${(i % 9) + 1}T09:00:00Z`,
    actor_role: i % 2 === 0 ? "couple_member" : "counsellor",
    actor_id: `actor-${i}`,
    action: i % 2 === 0 ? "consent.granted" : "result.viewed",
    couple_id: "c-01",
    detail: `Event number ${i}`,
    prev_hash: i === 0 ? "" : hash(i - 1),
    hash: hash(i),
  }));
}

function renderTrail(list: AuditEvent[], locale: "en" | "ar" = "en") {
  api.audit.mockResolvedValue(list);
  return renderWithIntl(<AuditTrail initialEvents={list} coupleId="c-01" locale={locale} />, locale);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuditTrail", () => {
  it("lists events with shortened hashes in left-to-right code runs", () => {
    renderTrail(events(3));
    const table = screen.getByRole("table", { name: /events recorded for this couple/i });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(7);
    expect(within(table).getAllByRole("row")).toHaveLength(1 + 3);

    const short = screen.getAllByText(shortHash(hash(1)));
    expect(short.length).toBeGreaterThan(0);
    for (const node of short) {
      expect(node.tagName).toBe("CODE");
      expect(node).toHaveClass("ltr-run", "font-mono");
      expect(node).toHaveAttribute("title", hash(1));
    }
    // The first event has no previous hash; it says so in words rather than showing an empty cell.
    expect(within(screen.getByText("Event number 0").closest("tr") as HTMLElement).getByText("none")).toBeInTheDocument();
  });

  it("folds consecutive identical events into one counted row", () => {
    const list = events(2).concat(
      Array.from({ length: 12 }, (_, i) => ({ ...events(1)[0]!, index: 2 + i, event_id: `t-${i}`, action: "token_issued", actor_role: "couple_member" as const, detail: `token ${i}` })),
    );
    renderTrail(list);
    const table = screen.getByRole("table", { name: /events recorded for this couple/i });
    // header + result.viewed(1) + one folded run of 12 + consent.granted(0)
    expect(within(table).getAllByRole("row")).toHaveLength(1 + 3);
    expect(within(table).getByText("× 12")).toBeInTheDocument();
    expect(within(table).getByText("2-13")).toBeInTheDocument();
  });

  it("keeps a 600-event log short: verify first, newest 20 rows open, the next 100 behind a disclosure", () => {
    const { container } = renderTrail(events(600));
    const verify = screen.getByRole("button", { name: "Verify chain" });
    const open = screen.getByRole("table", { name: /^events recorded for this couple/i });
    expect(within(open).getAllByRole("row")).toHaveLength(1 + 20);
    // Verify sits above the list.
    expect(verify.compareDocumentPosition(open) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const details = container.querySelector("details.audit-earlier") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(within(details).getByText("Show earlier events (580)")).toBeInTheDocument();
    expect(within(details).getAllByRole("row", { hidden: true })).toHaveLength(1 + 100);
    expect(within(details).getByText(/480 older events are in the log but not listed here/, { exact: false })).toBeInTheDocument();
    // 121 rows in the DOM at most, never 600.
    expect(container.querySelectorAll("tbody tr")).toHaveLength(120);
  });

  it("shows an empty state when there are no events", () => {
    renderTrail([]);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(/no events are recorded for this couple yet/i)).toBeInTheDocument();
  });

  it("verifies the chain and reports exactly what the API returned", async () => {
    const user = userEvent.setup();
    const ok: AuditVerification = { ok: true, length: 42, head_hash: hash(7), first_bad_index: null };
    api.verifyAudit.mockResolvedValue(ok);
    renderTrail(events(3));

    await user.click(screen.getByRole("button", { name: "Verify chain" }));

    expect(await screen.findByText("Chain verified")).toBeInTheDocument();
    expect(screen.getByText(/Events in the chain: 42/)).toBeInTheDocument();
    expect(screen.getAllByText(shortHash(hash(7))).length).toBeGreaterThan(0);
    expect(screen.queryByText("Chain broken")).toBeNull();
    expect(screen.getByRole("button", { name: "Verify chain" })).toBeEnabled();
  });

  it("shows only the number of events about the couple for a couple member (reduced verification, no chain length or hash)", async () => {
    const user = userEvent.setup();
    const reduced: AuditVerification = { ok: true, scope: "own_couple", own_events: 3, length: null, head_hash: null, first_bad_index: null, problem: null };
    api.verifyAudit.mockResolvedValue(reduced);
    renderTrail(events(3));

    await user.click(screen.getByRole("button", { name: "Verify chain" }));

    expect(await screen.findByText("Chain verified")).toBeInTheDocument();
    expect(screen.getByText(/Events about your couple that were checked: 3/)).toBeInTheDocument();
    expect(screen.queryByText(/Events in the chain/)).toBeNull();
    expect(screen.queryByText(/Head hash/)).toBeNull();
  });

  it("ticks the rows in sequence while verifying, capped at the first twelve", async () => {
    const user = userEvent.setup();
    let resolve: (value: AuditVerification) => void = () => undefined;
    api.verifyAudit.mockReturnValue(new Promise<AuditVerification>((done) => (resolve = done)));
    const { container } = renderTrail(events(15));

    await user.click(screen.getByRole("button", { name: "Verify chain" }));
    expect(screen.getByText("Checking the chain…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify chain" })).toBeDisabled();

    // 12 rows at a 40 ms stagger need about 0.5 s of real time; under a loaded full-suite run the default 1 s window is too tight.
    await waitFor(() => expect(container.querySelectorAll('tr[data-mark="ticking"]')).toHaveLength(12), { timeout: 5000 });
    expect(container.querySelectorAll('tr[data-mark="none"]')).toHaveLength(3);
    expect(screen.queryByText("Chain verified")).toBeNull();

    resolve({ ok: true, length: 15, head_hash: hash(9), first_bad_index: null });
    expect(await screen.findByText("Chain verified")).toBeInTheDocument();
  });

  it("marks the first bad index when the chain is broken, and never claims the rows after it were checked", async () => {
    const user = userEvent.setup();
    api.verifyAudit.mockResolvedValue({ ok: false, length: 5, head_hash: hash(4), first_bad_index: 2 } satisfies AuditVerification);
    const { container } = renderTrail(events(5));

    await user.click(screen.getByRole("button", { name: "Verify chain" }));

    expect(await screen.findByText("Chain broken")).toBeInTheDocument();
    expect(screen.getByText(/does not match is number 2/)).toBeInTheDocument();
    expect(screen.queryByText("Chain verified")).toBeNull();
    await waitFor(() => expect(container.querySelectorAll('tr[data-mark="mismatch"]')).toHaveLength(1));
    expect(container.querySelectorAll('tr[data-mark="checked"]')).toHaveLength(2);
    expect(container.querySelectorAll('tr[data-mark="none"]')).toHaveLength(2);
    expect(within(screen.getByText("Event number 2").closest("tr") as HTMLElement).getByText("First mismatch")).toBeInTheDocument();
  });

  it("shows the problem title and correlation id when verification fails", async () => {
    const user = userEvent.setup();
    api.verifyAudit.mockRejectedValue(new ApiError({ type: "about:blank", title: "Audit service unavailable", status: 503, correlation_id: "corr-9" }));
    renderTrail(events(2));

    await user.click(screen.getByRole("button", { name: "Verify chain" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Audit service unavailable");
    expect(alert).toHaveTextContent("corr-9");
    expect(screen.queryByText("Chain verified")).toBeNull();
  });

  it("renders in Arabic right-to-left with hashes still left-to-right", () => {
    renderTrail(events(2), "ar");
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByRole("heading", { name: "ما جرى لمعلوماتك" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "التحقق من السلسلة" })).toBeInTheDocument();
    for (const node of screen.getAllByText(shortHash(hash(1)))) expect(node).toHaveClass("ltr-run");
    expect(document.body.textContent).not.toMatch(/\bsharing\.[a-z]/);
  });
});
