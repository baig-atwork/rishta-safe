import { expect, test } from "@playwright/test";
import { DIR, LOCALES, STAMP_COUNT, expectNoAxeViolations } from "./helpers";

for (const locale of LOCALES) {
  test.describe(`landing (${locale})`, () => {
    test("renders with the right direction, language and persistent status stamps", async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", DIR[locale]);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Three honesty stamps and the boundary line are present on every page.
      await expect(page.locator("ul[aria-label] li.stamp")).toHaveCount(STAMP_COUNT);
      await expect(page.locator(`a[href="/${locale}/demo"]`).first()).toBeVisible();
    });

    test("has no WCAG 2.2 AA violations", async ({ page }) => {
      await page.goto(`/${locale}`);
      await expectNoAxeViolations(page);
    });
  });
}

test("the English landing leads with one statement, one action and a real recorded product sheet", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Read a screening result when you choose, in both your languages.");
  await expect(page.getByRole("link", { name: "Open the case bench" })).toHaveAttribute("href", "/en/demo");
  await expect(page.getByRole("link", { name: /See the evidence/ })).toHaveAttribute("href", "/en/judge");
  // The product sheet is the API's own wording in two languages, labelled as recorded; the tally has 100 cells.
  const sheet = page.getByRole("figure");
  await expect(sheet).toContainText("From a recorded response");
  await expect(sheet.getByRole("heading", { name: "A shared result was found" })).toBeVisible();
  await expect(sheet.locator('[lang="ar"]').first()).toBeVisible();
  await expect(page.getByTestId("tally-grid").locator(".cell")).toHaveCount(100);
  // Evidence on the landing keeps the "does not show" line and a hatched NOT RUN cell.
  await expect(page.getByText(/does not show/i).first()).toBeVisible();
  await expect(page.locator('[data-status="not_run"]').first()).toBeVisible();
});

test("the limits anchor that the honesty rail points to exists", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "Limits", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/governance#limits$/);
  await expect(page.locator("#limits")).toBeVisible();
});

test("how it works and governance pages pass axe in English and Arabic", async ({ page }) => {
  for (const locale of ["en", "ar"] as const) {
    for (const path of ["how-it-works", "governance"]) {
      await page.goto(`/${locale}/${path}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoAxeViolations(page);
    }
  }
});

test("the locale switcher keeps the current page", async ({ page }) => {
  await page.goto("/en/governance");
  await page.getByRole("link", { name: "العربية" }).click();
  await expect(page).toHaveURL(/\/ar\/governance$/);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});
