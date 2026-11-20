import { expect, test } from "@playwright/test";
import { DIR, LOCALES, PERSONA, expectNoAxeViolations, signInAs } from "./helpers";

/** axe (WCAG 2.2 AA) on every couple screen in en, ar and ur; the threshold and the result have their own specs. */
for (const locale of LOCALES) {
  for (const path of ["/couple", "/couple/sharing", "/couple/teach-back", "/couple/closure", "/couple/result"]) {
    test(`${path} in ${locale}: renders in ${DIR[locale]} and passes axe`, async ({ page }) => {
      await signInAs(page, locale, PERSONA.amal);
      await page.goto(`/${locale}${path}`);
      await expect(page.locator("html")).toHaveAttribute("dir", DIR[locale]);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expectNoAxeViolations(page);
    });
  }
}

test("the sharing matrix is a table, the fixed cells have no controls, and Share then Revoke leave two audit rows", async ({ page }) => {
  test.skip(process.env["BAYAN_E2E_REAL"] === "1", "mock-mode check: it changes the ledger");
  await signInAs(page, "en", "persona-dana");
  await page.goto("/en/couple/sharing");
  const matrix = page.getByTestId("visibility-matrix");
  await expect(matrix.getByRole("table")).toBeVisible();
  expect(await matrix.locator("[data-fixed] button, [data-fixed] a, [data-fixed] input").count()).toBe(0);
  const before = await page.locator("#audit tbody tr").count();
  await page.getByRole("switch", { name: /Share.*Gene names/ }).click();
  await expect(page.getByRole("switch", { name: /Revoke.*Gene names/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#audit tbody tr")).toHaveCount(before + 1);
  await page.getByRole("switch", { name: /Revoke.*Gene names/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Revoke sharing" }).click();
  await expect(page.getByRole("switch", { name: /Share.*Gene names/ })).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("#audit tbody tr")).toHaveCount(before + 2);
  await page.getByRole("button", { name: "Verify chain" }).click();
  await expect(page.getByText("Chain verified")).toBeVisible();
});

/** At 390px nothing may scroll sideways on a couple screen, in any language; the result page reads one language first. */
for (const locale of LOCALES) {
  test(`couple screens at 390px in ${locale}: no horizontal scroll, result shows the next step before the accordions`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAs(page, locale, PERSONA.amal);
    for (const path of ["/couple", "/couple/result?enter=now", "/couple/sharing", "/couple/teach-back", "/couple/closure"]) {
      await page.goto(`/${locale}${path}`);
      await expect(page.locator("main h1").first()).toBeVisible();
      const [scrollWidth, innerWidth] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      expect(scrollWidth, `${path} scrolls sideways`).toBeLessThanOrEqual(innerWidth);
    }
    await page.goto(`/${locale}/couple/result?enter=now`);
    const next = page.getByTestId("layer-3");
    const accordions = page.getByTestId("layer-2");
    await expect(next).toBeVisible();
    const [nextTop, accordionTop] = await Promise.all([next.boundingBox(), accordions.boundingBox()]);
    expect(nextTop!.y).toBeLessThan(accordionTop!.y);
    // One language by default on a phone: a single headline, with a way to show both.
    await expect(page.locator('[data-testid="layer-1"] h2')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Show both languages|عرض اللغتين معًا|دونوں زبانیں دکھائیں/ })).toBeVisible();
  });
}

test("on a desktop the next-step panel does not stretch and stays in view while the accordions scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(page, "en", PERSONA.amal);
  await page.goto("/en/couple/result?enter=now");
  const next = page.getByTestId("layer-3");
  await expect(next).toBeVisible();
  await expect(next).toHaveCSS("position", "sticky");
  await expect(next).toHaveCSS("align-self", /start/);
  const [panel, column] = await Promise.all([next.boundingBox(), page.getByTestId("layer-2").boundingBox()]);
  expect(panel!.height).toBeLessThan(column!.height);
});
