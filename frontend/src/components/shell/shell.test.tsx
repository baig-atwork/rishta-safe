import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/api/types";
import { renderWithIntl } from "@/test/render";
import { HonestyRail } from "./HonestyRail";
import { LensControl } from "./LensControl";
import { navItemsFor } from "./SiteHeader";

const start = vi.fn();
vi.mock("@/app/[locale]/actions", () => ({
  startSession: (...args: unknown[]) => start(...args),
  endSession: vi.fn(),
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
  usePathname: () => "/couple",
}));

describe("navItemsFor", () => {
  it("never offers more than five items and never repeats a destination", () => {
    const roles: (Role | null)[] = [null, "couple_member", "counsellor", "clinician", "programme", "judge", "external"];
    for (const role of roles) {
      const items = navItemsFor(role);
      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(5);
      expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
    }
  });

  it("shows the haematology aid only to the clinician and the programme page only to the programme role", () => {
    const has = (role: Role | null, href: string) => navItemsFor(role).some((i) => i.href === href);
    expect(has("clinician", "/clinician")).toBe(true);
    for (const role of ["counsellor", "couple_member", "judge", "programme", null] as const) expect(has(role, "/clinician")).toBe(false);
    expect(has("programme", "/programme")).toBe(true);
    for (const role of ["counsellor", "clinician", "couple_member", "judge", null] as const) expect(has(role, "/programme")).toBe(false);
  });
});

describe("HonestyRail", () => {
  it("states the honesty facts and links to the limits", () => {
    renderWithIntl(<HonestyRail />);
    expect(screen.getByText("Synthetic data")).toBeInTheDocument();
    expect(screen.getByText("Arabic and Urdu: draft translations")).toBeInTheDocument();
    expect(screen.getByText("Clinical rules pending sign-off")).toBeInTheDocument();
    expect(screen.getByText("Not clinical advice")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Limits" })).toHaveAttribute("href", "/governance#limits");
  });
});

describe("LensControl", () => {
  const options = [
    { id: "persona-a", displayName: "Amal (synthetic)", role: "couple_member" as const, coupleId: "cpl-demo-02" },
    { id: "persona-b", displayName: "Counsellor (synthetic)", role: "counsellor" as const, coupleId: null },
  ];

  it("names the lens and keeps the dialog body out of the DOM until opened", async () => {
    renderWithIntl(<LensControl persona={{ id: "persona-a", displayName: "Amal (synthetic)", coupleId: "cpl-demo-02" }} options={options} />);
    const button = screen.getByRole("button", { name: /Lens.*Amal \(synthetic\).*cpl-demo-02/ });
    expect(screen.queryByTestId("lens-dialog")).not.toBeInTheDocument();
    await userEvent.click(button);
    const dialog = screen.getByTestId("lens-dialog");
    expect(within(dialog).getByRole("heading", { name: "Choose a case and a lens" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Leave this lens" })).toBeInTheDocument();
  });

  it("falls back to a persona list when the slot is empty and starts the chosen session", async () => {
    renderWithIntl(<LensControl persona={null} options={options} />);
    expect(screen.getByRole("button", { name: /Lens.*pick a case/ })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("lens-control"));
    expect(screen.queryByRole("button", { name: "Leave this lens" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Enter as Counsellor (synthetic)" }));
    expect(start).toHaveBeenCalledWith("persona-b", "en");
  });

  it("shows the slot instead of the fallback list when one is provided", async () => {
    renderWithIntl(
      <LensControl persona={null} options={options}>
        <p>COMPACT-BENCH</p>
      </LensControl>,
    );
    await userEvent.click(screen.getByTestId("lens-control"));
    expect(screen.getByText("COMPACT-BENCH")).toBeInTheDocument();
    expect(screen.queryByTestId("lens-fallback")).not.toBeInTheDocument();
  });
});
