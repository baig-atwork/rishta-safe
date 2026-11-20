import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/transport";
import type { CounsellorBrief } from "@/lib/api/types";
import { buildBriefView } from "@/lib/staff-brief";
import { renderWithIntl } from "@/test/render";
import { BriefActions } from "./BriefActions";
import { BriefEmpty, BriefPane } from "./BriefPane";
import { QueuePane, type QueueRow } from "./QueuePane";
import { TraceChip } from "./TraceChip";
import { TracePane } from "./TracePane";

const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const advancePathway = vi.hoisted(() => vi.fn<(coupleId: string, event: string) => Promise<unknown>>());

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/api/client", () => ({ clientApi: { advancePathway } }));

const ROWS: QueueRow[] = [
  { coupleId: "cpl-demo-09", label: "cpl-demo-09", priority: "urgent", ruleId: "pregnancy_in_progress", moreRules: 2, waiting: { n: 6, unit: "d" } },
  { coupleId: "cpl-demo-05", label: "cpl-demo-05", priority: "urgent", ruleId: "referral_clock_breached", moreRules: 1, waiting: { n: 21, unit: "d" } },
  { coupleId: "cpl-demo-01", label: "cpl-demo-01", priority: "routine", ruleId: null, moreRules: 0, waiting: { n: 5, unit: "h" } },
];

const selectedRows = () => screen.getAllByRole("row").filter((row) => row.getAttribute("aria-selected") === "true");

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
  advancePathway.mockReset();
});

describe("QueuePane", () => {
  it("is a real table with column headers, a row header per case and dense waiting text", () => {
    renderWithIntl(<QueuePane rows={ROWS} selectedId={null} />);
    const table = screen.getByRole("table", { name: "Cases waiting for review" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Case", "Priority", "Rule fired", "Waiting"]);
    expect(within(table).getByRole("rowheader", { name: "cpl-demo-09" })).toBeInTheDocument();
    expect(within(table).getByText("6 d")).toBeInTheDocument();
    expect(within(table).getByText("5 h")).toBeInTheDocument();
    expect(within(table).getByText("and 2 more")).toBeInTheDocument();
    expect(screen.getByText("3 open · sorted by priority, then waiting")).toBeInTheDocument();
  });

  it("selects nothing without a selected case and preselects the opened case", () => {
    const { unmount } = renderWithIntl(<QueuePane rows={ROWS} selectedId={null} />);
    expect(selectedRows()).toHaveLength(0);
    unmount();
    renderWithIntl(<QueuePane rows={ROWS} selectedId="cpl-demo-05" />);
    expect(selectedRows().map((r) => r.getAttribute("data-couple-id"))).toEqual(["cpl-demo-05"]);
    expect(screen.getByRole("link", { name: "cpl-demo-05" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "cpl-demo-09" })).not.toHaveAttribute("aria-current");
  });

  it("moves the cursor with J and K without wrapping, and opens the case under it with Enter", async () => {
    const user = userEvent.setup();
    renderWithIntl(<QueuePane rows={ROWS} selectedId={null} />);
    const cursor = () => selectedRows().map((r) => r.getAttribute("data-couple-id"));

    await user.keyboard("j");
    expect(cursor()).toEqual(["cpl-demo-09"]);
    await user.keyboard("jj");
    expect(cursor()).toEqual(["cpl-demo-01"]);
    await user.keyboard("j");
    expect(cursor()).toEqual(["cpl-demo-01"]);
    await user.keyboard("k");
    expect(cursor()).toEqual(["cpl-demo-05"]);

    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/staff/couples/cpl-demo-05");
  });

  it("starts from the opened case, so K goes to the row above it", async () => {
    const user = userEvent.setup();
    renderWithIntl(<QueuePane rows={ROWS} selectedId="cpl-demo-05" />);
    await user.keyboard("k");
    expect(selectedRows().map((r) => r.getAttribute("data-couple-id"))).toEqual(["cpl-demo-09"]);
  });

  it("moves focus between case links with J and K and leaves Enter to the focused link", async () => {
    const user = userEvent.setup();
    renderWithIntl(<QueuePane rows={ROWS} selectedId={null} />);
    screen.getByRole("link", { name: "cpl-demo-09" }).focus();
    await user.keyboard("j");
    expect(screen.getByRole("link", { name: "cpl-demo-05" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(push).not.toHaveBeenCalled();
  });

  it("ignores the keys while typing in a field", async () => {
    const user = userEvent.setup();
    renderWithIntl(
      <>
        <input aria-label="note" />
        <QueuePane rows={ROWS} selectedId={null} />
      </>,
    );
    await user.type(screen.getByLabelText("note"), "jk");
    expect(selectedRows()).toHaveLength(0);
  });

  it("links every row to its case route", () => {
    renderWithIntl(<QueuePane rows={ROWS} selectedId={null} />);
    expect(screen.getByRole("link", { name: "cpl-demo-01" })).toHaveAttribute("href", "/staff/couples/cpl-demo-01");
  });

  it("shows the queue in Arabic with Western digits and a left-to-right case id", () => {
    renderWithIntl(<QueuePane rows={ROWS} selectedId={null} />, "ar");
    expect(screen.getByText(/6 يوم/)).toBeInTheDocument();
    expect(screen.getByText("cpl-demo-09").closest("bdi")).toHaveAttribute("dir", "ltr");
  });
});

function briefFixture(): CounsellorBrief {
  return {
    couple_id: "cpl-demo-09",
    generated_at: "2026-11-20T10:00:00Z",
    review_priority: "urgent",
    category: "shared_result_found",
    relationship: "first_cousin_once_removed",
    shared: [],
    detection: [],
    trace: ["E10 beta_thalassaemia: both carriers"],
    escalations: [
      {
        rule_id: "pregnancy_in_progress",
        priority: "priority",
        reason: "pregnancy in progress (tier: accredited geneticist)",
        source: "R03 2.7 row 5. ACMG 2021.",
        due_by_hint: "fast_track",
        tier: "accredited_geneticist",
        needs_clinician_signoff: true,
        needs_legal_read: true,
      },
    ],
    referral_tasks: [],
    grounded_in: [],
    members: [
      { display_name: "Joud Demo (synthetic)", sex: "female", age: 29, language: "en", family_history: ["thalassaemia_in_family"] },
      { display_name: "Adel Demo (synthetic)", sex: "male", age: 32, language: "ar", family_history: [] },
    ],
    emirate_policy: "abu_dhabi",
    pathway_state: "counselling_pending",
    consent_count: 0,
    sections: [
      { key: "result", title: "Result on file", lines: ["Category: shared_result_found", "Ruleset: rishta-safe-couple-1.0", "beta_thalassaemia (HBB, AR): 25 of 100 affected"] },
      { key: "why", title: "Why a human is asked to look", lines: ["pregnancy_in_progress: tier accredited_geneticist, due fast_track"] },
      { key: "sharing", title: "Who may see what", lines: ["No sharing consent recorded."] },
      { key: "open", title: "Open items", lines: ["Next: Book counselling"] },
    ],
  };
}

describe("TraceChip", () => {
  it("shows the id, links to its trace entry and keeps the id in the accessible name", () => {
    renderWithIntl(<TraceChip id="R1" href="#trace-R1" />);
    const chip = screen.getByRole("link", { name: /^R1/ });
    expect(chip).toHaveAttribute("href", "#trace-R1");
    expect(chip).toHaveTextContent("R1");
  });
});

describe("brief and trace panes", () => {
  it("gives every brief line a chip that resolves to an entry in the trace pane", () => {
    const brief = briefFixture();
    const view = buildBriefView(brief);
    renderWithIntl(
      <>
        <BriefPane brief={brief} view={view} locale="en" briefLocale="en" actions={null} />
        <TracePane entries={view.entries} coupleId={brief.couple_id} />
      </>,
    );
    const lineCount = view.sections.reduce((n, s) => n + s.lines.length, 0);
    const chips = within(screen.getByTestId("brief-pane")).getAllByRole("link", { name: /trace entry/ });
    expect(chips).toHaveLength(lineCount);
    for (const chip of chips) {
      const target = document.getElementById(chip.getAttribute("href")!.slice(1));
      expect(target, chip.getAttribute("href")!).not.toBeNull();
      expect(screen.getByTestId("trace-pane").contains(target)).toBe(true);
    }
  });

  it("renders the rule id, the source and both stamps for an escalation entry, from the API data", () => {
    const brief = briefFixture();
    renderWithIntl(<TracePane entries={buildBriefView(brief).entries} coupleId={brief.couple_id} />);
    const entry = screen.getByTestId("trace-pane").querySelector('[data-trace-entry="T1"]') as HTMLElement;
    expect(within(entry).getByText("pregnancy_in_progress")).toBeInTheDocument();
    expect(within(entry).getByText("accredited_geneticist")).toBeInTheDocument();
    expect(within(entry).getByText("fast_track")).toBeInTheDocument();
    expect(entry).toHaveTextContent("R03 2.7 row 5. ACMG 2021.");
    expect(within(entry).getByText("sign-off pending")).toBeInTheDocument();
    expect(within(entry).getByText("legal read needed")).toBeInTheDocument();
  });

  it("keeps the pending sign-off stamp and the not-generated footer visible, with and without a case", () => {
    const brief = briefFixture();
    const { unmount } = renderWithIntl(<TracePane entries={null} coupleId={null} />);
    expect(screen.getByText("Clinical rules pending sign-off")).toBeInTheDocument();
    expect(screen.getByText(/Select a case to see the rule, source and sign-off/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing in this brief is generated/)).toBeInTheDocument();
    unmount();
    renderWithIntl(<TracePane entries={buildBriefView(brief).entries} coupleId={brief.couple_id} />);
    expect(screen.getByText("Clinical rules pending sign-off")).toBeInTheDocument();
    expect(screen.getByText(/Nothing in this brief is generated/)).toBeInTheDocument();
  });

  it("shows the category through the closed vocabulary and the API's section text unchanged", () => {
    const brief = briefFixture();
    renderWithIntl(<BriefPane brief={brief} view={buildBriefView(brief)} locale="en" briefLocale="en" actions={null} />);
    expect(screen.getByText("Shared result found")).toBeInTheDocument();
    expect(screen.getByText("Ruleset: rishta-safe-couple-1.0")).toBeInTheDocument();
    expect(screen.getByText("Result on file")).toBeInTheDocument();
    expect(screen.getByText("Abu Dhabi disclosure rule")).toBeInTheDocument();
  });

  it("offers the brief in each partner's language and marks the current one", () => {
    const brief = briefFixture();
    renderWithIntl(<BriefPane brief={brief} view={buildBriefView(brief)} locale="en" briefLocale="ar" actions={null} />);
    expect(screen.getByRole("link", { name: "Arabic" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", "/staff/couples/cpl-demo-09?briefLang=en");
  });

  it("says Select a case in the empty brief pane", () => {
    renderWithIntl(<BriefEmpty />);
    expect(screen.getByRole("heading", { name: "Select a case" })).toBeInTheDocument();
    expect(screen.getByText("Select a case from the queue. The brief and its trace open here.")).toBeInTheDocument();
  });
});

describe("BriefActions", () => {
  it("fires only the pathway event of the verb pressed, then refreshes the brief", async () => {
    advancePathway.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithIntl(<BriefActions coupleId="cpl-demo-09" verbs={["counselling_booked"]} proforma={<p>form</p>} />);
    await user.click(screen.getByRole("button", { name: "Record counselling booked" }));
    expect(advancePathway).toHaveBeenCalledExactlyOnceWith("cpl-demo-09", "counselling_booked");
    expect(await screen.findByText("Recorded: Record counselling booked")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the problem and the correlation id when the step cannot be recorded", async () => {
    advancePathway.mockRejectedValue(new ApiError({ type: "t", title: "Conflict", status: 409, detail: "The step does not apply.", correlation_id: "corr-409" }));
    const user = userEvent.setup();
    renderWithIntl(<BriefActions coupleId="cpl-demo-09" verbs={["counselling_completed"]} proforma={null} />);
    await user.click(screen.getByRole("button", { name: "Record counselling done" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("The step does not apply.")).toBeInTheDocument();
    expect(within(alert).getByText("corr-409")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("hosts the closure proforma in the pane on request and says so when no step is offered", async () => {
    const user = userEvent.setup();
    renderWithIntl(<BriefActions coupleId="cpl-demo-09" verbs={[]} proforma={<p>the proforma form</p>} />);
    expect(screen.getByText("No pathway step can be recorded here right now.")).toBeInTheDocument();
    expect(screen.queryByText("the proforma form")).not.toBeInTheDocument();
    const open = screen.getByRole("button", { name: "Open closure proforma" });
    await user.click(open);
    expect(open).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("the proforma form")).toBeInTheDocument();
  });
});
