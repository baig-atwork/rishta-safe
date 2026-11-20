import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { IconArraySpec } from "@/lib/api/types";
import { renderWithIntl } from "@/test/render";
import { TallyGrid } from "./TallyGrid";

const spec = (over: Partial<IconArraySpec> = {}): IconArraySpec => ({
  total: 100,
  affected: 25,
  carrier: 50,
  neither: 25,
  caption: "CAPTION-FROM-API",
  ...over,
});
const legend = { affected: "would have the condition", carrier: "would be carriers", neither: "would have neither" };

describe("TallyGrid", () => {
  it("draws one cell per pregnancy in three fills, labelled by the API caption", () => {
    renderWithIntl(
      <>
        <p id="cap">CAPTION-FROM-API</p>
        <TallyGrid spec={spec()} captionId="cap" legend={legend} />
      </>,
    );
    const grid = screen.getByTestId("tally-grid");
    expect(grid).toHaveAttribute("role", "img");
    expect(grid).toHaveAttribute("aria-labelledby", "cap");
    expect(grid.querySelectorAll(".cell")).toHaveLength(100);
    expect(grid.querySelectorAll('[data-fill="solid"]')).toHaveLength(25);
    expect(grid.querySelectorAll('[data-fill="hatch"]')).toHaveLength(50);
    expect(grid.querySelectorAll('[data-fill="open"]')).toHaveLength(25);
    // Counts in the legend come from the API numbers, labels from the caller.
    expect(screen.getByText("would be carriers").previousElementSibling).toHaveTextContent("50");
  });

  it("does not draw a grid whose parts do not add up to the whole", () => {
    renderWithIntl(<TallyGrid spec={spec({ carrier: 40 })} captionId="cap" legend={legend} invalidLabel="NUMBERS-DO-NOT-ADD-UP" />);
    expect(screen.queryByTestId("tally-grid")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("NUMBERS-DO-NOT-ADD-UP");
  });
});
