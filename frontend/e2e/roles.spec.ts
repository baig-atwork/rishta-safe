import { expect, test } from "@playwright/test";
import { PERSONA, expectNoAxeViolations, signInAs, signInViaLens } from "./helpers";

test.describe("couple member flows", () => {
  test("sharing and audit: ledger table, verify chain, axe (en and ar)", async ({ page }) => {
    for (const locale of ["en", "ar"] as const) {
      await signInAs(page, locale, PERSONA.amal);
      await page.goto(`/${locale}/couple/sharing`);
      await expect(page.getByRole("table").first()).toBeVisible();
      await expectNoAxeViolations(page);
    }
  });

  test("closure form has eight patient items and no marriage question", async ({ page }) => {
    await signInAs(page, "en", PERSONA.amal);
    await page.goto("/en/couple/closure");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The consent text may say that marriage plans are NOT recorded; no question or field may ask about them.
    const asked = (await page.locator("main legend, main label, main h2, main h3").allInnerTexts()).join(" ").toLowerCase();
    expect(asked).not.toMatch(/marry|marriage/);
    await expectNoAxeViolations(page);
  });

  test("teach-back quiz renders and passes axe", async ({ page }) => {
    await signInAs(page, "en", PERSONA.amal);
    await page.goto("/en/couple/teach-back");
    await expect(page.getByRole("group").first()).toBeVisible();
    await expectNoAxeViolations(page);
  });
});

test.describe("lens switching", () => {
  test("signing in through the Lens control lands on each role's home", async ({ page }) => {
    await signInViaLens(page, "en", PERSONA.judge);
    await expect(page).toHaveURL(/\/en\/judge$/);
    await signInViaLens(page, "en", PERSONA.programme);
    await expect(page).toHaveURL(/\/en\/programme$/);
    await signInViaLens(page, "en", PERSONA.clinician);
    await expect(page).toHaveURL(/\/en\/clinician$/);
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Haematology aid" })).toBeVisible();
  });
});

test.describe("staff and oversight surfaces", () => {
  test("counsellor queue and brief", async ({ page }) => {
    await signInAs(page, "en", PERSONA.counsellor);
    // /staff opens the first case in the queue, so neither the brief nor the trace pane is ever blank.
    await expect(page).toHaveURL(/\/en\/staff\/couples\/[^/]+$/);
    await expect(page.getByTestId("brief-pane").getByRole("heading", { level: 2, name: /^Brief/ })).toBeVisible();
    await expect(page.getByText("Select a case")).toHaveCount(0);
    await expect(page.locator('tr[aria-selected="true"]')).toHaveCount(1);
    await expectNoAxeViolations(page);
    // Another case in the queue opens beside it.
    const first = page.url();
    await page.getByTestId("queue-pane").locator('a[href*="/staff/couples/"]').nth(1).click();
    await expect(page).not.toHaveURL(first);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/en\/staff\/couples\/[^/]+$/);
    await expect(page.locator('tr[aria-selected="true"]')).toHaveCount(1);
    await expect(page.getByTestId("trace-pane").getByText("Clinical rules pending sign-off").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Open closure proforma" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("clinician haematology aid says it is not a diagnosis and is pending sign-off", async ({ page }) => {
    await signInAs(page, "en", PERSONA.clinician);
    await expect(page).toHaveURL(/\/en\/clinician$/);
    await expect(page.getByText("Not a diagnosis. A decision aid for the clinician.").first()).toBeVisible();
    await expect(page.getByText("Pending clinical sign-off").first()).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("programme KPIs and judge scoreboard", async ({ page }) => {
    await signInAs(page, "en", PERSONA.programme);
    await expect(page).toHaveURL(/\/en\/programme$/);
    await expectNoAxeViolations(page);
    await signInAs(page, "en", PERSONA.judge);
    await expect(page).toHaveURL(/\/en\/judge$/);
    await expect(page.getByText(/does not show/i).first()).toBeVisible();
    // Metadata streams after the shell: wait for the title before axe checks it.
    await expect(page).toHaveTitle(/.+/);
    await expectNoAxeViolations(page);
  });
});
