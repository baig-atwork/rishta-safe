import { describe, expect, it } from "vitest";
import { RESULT_CATEGORIES } from "@/lib/api/types";
import { renderWithIntl } from "@/test/render";
import { CategoryChip } from "./CategoryChip";

describe("CategoryChip", () => {
  it("gives each closed category two cells and a label, so colour is never the only channel", () => {
    const expected = {
      shared_result_found: ["hatch", "hatch"],
      no_shared_change_found: ["open", "open"],
      more_information_needed: ["open", "open"],
    } as const;
    for (const category of RESULT_CATEGORIES) {
      const { container, unmount } = renderWithIntl(<CategoryChip category={category} />);
      const cells = [...container.querySelectorAll(".cell")];
      expect(cells.map((c) => c.getAttribute("data-fill"))).toEqual(expected[category]);
      expect(container.querySelector(".chip")).toHaveAttribute("data-cat", category);
      expect(container.querySelector(".chip > span:last-child")?.textContent?.length ?? 0).toBeGreaterThan(5);
      unmount();
    }
  });

  it("marks the second cell dashed for more_information_needed only", () => {
    const { container } = renderWithIntl(<CategoryChip category="more_information_needed" />);
    const [first, second] = [...container.querySelectorAll(".cell")];
    expect(first).not.toHaveAttribute("data-dashed");
    expect(second).toHaveAttribute("data-dashed", "true");
  });

  it("takes the label from the catalogue of the page locale", () => {
    const en = renderWithIntl(<CategoryChip category="shared_result_found" />, "en");
    const enText = en.container.querySelector(".chip > span:last-child")?.textContent;
    en.unmount();
    const ar = renderWithIntl(<CategoryChip category="shared_result_found" />, "ar");
    const arText = ar.container.querySelector(".chip > span:last-child")?.textContent;
    expect(enText).toBe("Shared result found");
    expect(arText).not.toBe(enText);
  });
});
