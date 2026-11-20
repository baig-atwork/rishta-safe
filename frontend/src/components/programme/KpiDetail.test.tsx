import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import kpisFixture from "@/lib/api/real/__fixtures__/kpis.json";
import { fromBackendResponse } from "@/lib/api/real/adapter";
import type { ProgrammeKpiDetail, ProgrammeKpis } from "@/lib/api/types";
import { renderWithIntl } from "@/test/render";
import { KpiDetail, ProgrammeFigures } from "./KpiDetail";

const kpis = fromBackendResponse({ method: "GET", path: "/v1/programme/kpis" }, kpisFixture) as ProgrammeKpis;
const detail = kpis.detail as ProgrammeKpiDetail;

describe("ProgrammeFigures (the three large figures)", () => {
  it("shows three figures, each with a plain label and a simulated stamp, and the target beside the referral share", () => {
    renderWithIntl(<ProgrammeFigures kpis={kpis} locale="en" />);

    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(within(list).getAllByText("Simulated")).toHaveLength(3);
    expect(within(items[0] as HTMLElement).getByText("Flagged cases referred")).toBeInTheDocument();
    expect(within(items[0] as HTMLElement).getByText(/Target: 90%/)).toBeInTheDocument();
    expect(within(items[0] as HTMLElement).getByRole("img", { name: /Flagged cases referred/ })).toBeInTheDocument();
    expect(within(items[1] as HTMLElement).getByText("Median time to result")).toBeInTheDocument();
    expect(within(items[2] as HTMLElement).getByText("Counselling completed")).toBeInTheDocument();
  });

  it("converts a median over 72 hours to days and keeps the unit visible", () => {
    const long = { ...kpis, detail: { ...detail, time_to_result: { n: 10, median_hours: 267, p90_hours: 269.4 } } };
    renderWithIntl(<ProgrammeFigures kpis={long} locale="en" />);
    const item = screen.getByText("Median time to result").closest("li") as HTMLElement;
    expect(within(item).getByText("11.1")).toBeInTheDocument();
    expect(within(item).getByText("days")).toBeInTheDocument();
    expect(within(item).getByText(/90th percentile 11\.2 days/)).toBeInTheDocument();
  });

  it("keeps hours as hours at or under 72 and says 'No data' rather than inventing a value", () => {
    const short = { ...kpis, detail: { ...detail, time_to_result: { n: 3, median_hours: 48, p90_hours: 60 } } };
    const { unmount } = renderWithIntl(<ProgrammeFigures kpis={short} locale="en" />);
    expect(within(screen.getByText("Median time to result").closest("li") as HTMLElement).getByText("hours")).toBeInTheDocument();
    unmount();

    const none = { ...kpis, detail: { ...detail, share_referred: null, time_to_result: { n: 0, median_hours: null, p90_hours: null } } };
    renderWithIntl(<ProgrammeFigures kpis={none} locale="en" />);
    expect(screen.getAllByText("No data").length).toBeGreaterThanOrEqual(2);
  });
});

describe("KpiDetail (the rest, as a ruled table)", () => {
  it("lists counselling counts with their share of flagged cases, and times with the unit", () => {
    renderWithIntl(<KpiDetail detail={detail} locale="en" />);

    const table = screen.getByRole("table", { name: /Further programme measures/ });
    const booked = within(table).getByRole("row", { name: /Counselling: Booked/ });
    expect(within(booked).getByText(String(detail.counselling_booked))).toBeInTheDocument();
    const result = within(table).getByRole("row", { name: /Time to result, Median/ });
    expect(within(result).getByText(String(detail.time_to_result.n))).toBeInTheDocument();
    expect(result.textContent ?? "").toMatch(/days|hours/);
    expect(within(table).getByRole("row", { name: /Open referral tasks/ })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /Stale referral tasks/ })).toBeInTheDocument();
  });

  it("marks the illustrative time limit as such and shows the backend's own statement of how the figures are computed", () => {
    renderWithIntl(<KpiDetail detail={detail} locale="en" />);
    expect(screen.getByText(`The ${detail.referral_standard_days}-day limit is illustrative. No published standard states one.`)).toBeInTheDocument();
    expect(screen.getByText(detail.basis)).toBeInTheDocument();
  });

  it("says 'No data' for a figure with no cases behind it, and never invents a share", () => {
    const empty: ProgrammeKpiDetail = {
      ...detail,
      share_referred: null,
      share_referred_within_standard: null,
      meets_referral_target: null,
      counselling_uptake_booked_share: null,
      counselling_uptake_completed_share: null,
      time_to_result: { n: 0, median_hours: null, p90_hours: null },
      time_to_referral: { n: 0, median_hours: null, p90_hours: null },
    };
    renderWithIntl(<KpiDetail detail={empty} locale="en" />);

    expect(screen.getAllByText("No data").length).toBeGreaterThanOrEqual(5);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Referred within/ })).not.toBeInTheDocument();
  });

  it("claims no national statistics anywhere on the block", () => {
    const { container } = renderWithIntl(
      <>
        <ProgrammeFigures kpis={kpis} locale="en" />
        <KpiDetail detail={detail} locale="en" />
      </>,
    );
    expect(container.textContent ?? "").not.toMatch(/national|nationwide|population|UAE-wide/i);
  });

  it.each(["ar", "ur"] as const)("renders in %s with no raw message keys and Western digits", (locale) => {
    const { container } = renderWithIntl(
      <>
        <ProgrammeFigures kpis={kpis} locale={locale} />
        <KpiDetail detail={detail} locale={locale} />
      </>,
      locale,
    );
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\bprogramme\.|\bdetail\.[a-z]|\bhero\.|\brest\./);
    expect(text).not.toMatch(/[٠-٩۰-۹]/);
    expect(document.documentElement.dir).toBe("rtl");
  });
});
