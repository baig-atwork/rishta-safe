import { expect, test } from "@playwright/test";
import { DIR, LOCALES, PERSONA, STAMP_COUNT, expectNoAxeViolations, signInAs } from "./helpers";

test.describe("persona picker", () => {
  test("the case bench lists seeded cases against lenses, and choosing a couple member lands on their pathway", async ({ page }) => {
    await page.goto("/en/demo");
    await expect(page.getByRole("heading", { level: 1, name: "Pick what you want to test, then the lens to test it through." })).toBeVisible();
    await expect(page.locator("[data-persona-id]").first()).toBeVisible();
    await expectNoAxeViolations(page);

    await page.locator(`[data-persona-id="${PERSONA.amal}"]`).click();
    await expect(page).toHaveURL(/\/en\/couple$/);
    await expect(page.getByRole("list", { name: "Your pathway, in order" })).toBeVisible();
    await expect(page.locator("#next-title")).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("a role page without a persona is an actionable empty state, not a dead end", async ({ page }) => {
    await page.goto("/en/couple");
    await expect(page.getByRole("heading", { name: "Choose a demo persona to continue" })).toBeVisible();
    await page.getByRole("link", { name: "Choose a persona" }).click();
    await expect(page).toHaveURL(/\/en\/demo$/);
  });
});

test.describe("lens control", () => {
  test("opens a dialog, switches the lens (home and navigation follow) and leaves it", async ({ page }) => {
    await page.goto("/en");
    const lens = page.getByTestId("lens-control");
    await expect(lens).toContainText("pick a case");
    await lens.click();
    const dialog = page.getByRole("dialog", { name: "Choose a case and a lens" });
    await expect(dialog).toBeVisible();
    await expectNoAxeViolations(page);

    await dialog.locator(`[data-lens-persona="${PERSONA.amal}"]`).click();
    await expect(page).toHaveURL(/\/en\/couple$/);
    await expect(dialog).toBeHidden();
    await expect(lens).not.toContainText("pick a case");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Who sees what" })).toBeVisible();

    await lens.click();
    await page.getByRole("dialog").locator(`[data-lens-persona="${PERSONA.counsellor}"]`).click();
    await expect(page).toHaveURL(/\/en\/staff(\/couples\/[^/]+)?$/);
    await expect(nav.getByRole("link", { name: "Queue" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Who sees what" })).toHaveCount(0);

    await lens.click();
    await page.getByRole("button", { name: "Leave this lens" }).click();
    await expect(page).toHaveURL(/\/en\/demo$/);
    await expect(lens).toContainText("pick a case");
  });

  test("Escape closes the dialog and returns focus to the control", async ({ page }) => {
    await page.goto("/en");
    const lens = page.getByTestId("lens-control");
    await lens.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(lens).toBeFocused();
  });
});

for (const locale of LOCALES) {
  test(`shell in ${locale}: 52 px header, 28 px honesty rail, language switch, axe`, async ({ page }) => {
    for (const path of ["", "/demo", "/governance"]) {
      await page.goto(`/${locale}${path}`);
      await expect(page.locator("html")).toHaveAttribute("dir", DIR[locale]);
      expect(await page.locator("header.site-header").evaluate((el) => el.getBoundingClientRect().height)).toBe(52);
      const rail = page.locator(".rail");
      expect(await rail.evaluate((el) => el.getBoundingClientRect().height)).toBe(28);
      await expect(rail.locator("li.stamp")).toHaveCount(STAMP_COUNT);
      await expect(page.locator(".locale-seg a[aria-current='true']")).toHaveAttribute("lang", locale);
    }
    await page.goto(`/${locale}/demo`);
    await expectNoAxeViolations(page);
  });
}

for (const locale of LOCALES) {
  test(`result page in ${locale}: read together, tally, disclosures, next step, axe`, async ({ page }) => {
    await signInAs(page, locale, PERSONA.amal);
    // The result sits behind the threshold; ?enter=now is the labelled "skip the choice" entry.
    await page.goto(`/${locale}/couple/result?enter=now`);
    await expect(page.locator("html")).toHaveAttribute("dir", DIR[locale]);
    await expect(page.getByTestId("layer-1")).toBeVisible();
    await expect(page.getByTestId("layer-2")).toBeVisible();
    await expect(page.getByTestId("layer-3")).toBeVisible();
    await expect(page.getByTestId("boundary").first()).toBeVisible();
    const tally = page.getByTestId("tally-grid");
    await expect(tally).toBeVisible();
    expect(await tally.locator(".cell").count()).toBe(100);
    await expect(page.getByTestId("layer-1")).toHaveAttribute("data-cat", /shared_result_found|no_shared_change_found|more_information_needed/);
    // Read together: the page language and a second language, each column with its own lang.
    await expect(page.getByTestId("layer-1").locator("h1")).toHaveAttribute("lang", locale);
    await expect(page.getByTestId("layer-1").locator("h2[lang]")).toHaveCount(1);
    await expectNoAxeViolations(page);
  });
}
