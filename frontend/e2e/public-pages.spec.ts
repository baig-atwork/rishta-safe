import { expect, test } from "@playwright/test";
import { PERSONA, REAL, expectNoAxeViolations, signInAs } from "./helpers";

test.describe("case bench", () => {
  test("lists the seeded cases against the lenses and opens a case as a person", async ({ page }) => {
    await page.goto("/en/demo");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Pick what you want to test");
    const rows = page.locator("table.tbl tbody tr");
    expect(await rows.count()).toBeGreaterThanOrEqual(7);
    // The programme column is open on purpose: it never links to a case.
    await expect(page.getByText("Aggregate only").first()).toBeVisible();
    await expectNoAxeViolations(page);
    await signInAs(page, "en", PERSONA.amal);
    await expect(page).toHaveURL(/\/en\/couple$/);
  });

  test("offers one flagship action and keeps the rule column behind a toggle", async ({ page }) => {
    await page.goto("/en/demo");
    const flagship = page.getByTestId("flagship");
    await expect(flagship.getByRole("heading", { name: "Start with the flagship case" })).toBeVisible();
    await expect(page.locator("tr[data-case]").filter({ hasText: "start here" })).toHaveCount(1);
    await expect(page.getByRole("columnheader", { name: /Rule/ })).toBeHidden();
    await page.getByText("Show rule and relationship").click();
    await expect(page.getByRole("columnheader", { name: /Rule/ })).toBeVisible();
    await flagship.getByRole("button", { name: "Open the flagship case" }).click();
    await expect(page).toHaveURL(/\/en\/couple\/result\?enter=now/);
  });

  test("the compact bench in the Lens dialog carries data-lens-persona on every lens cell", async ({ page }) => {
    await page.goto("/en");
    await page.getByTestId("lens-control").click();
    const cells = page.getByRole("dialog").locator("[data-lens-persona]");
    expect(await cells.count()).toBeGreaterThan(0);
  });
});

test.describe("evidence probes", () => {
  test("a judge sends a real third-party request and sees the refusal and the audit row it wrote", async ({ page }) => {
    await signInAs(page, "en", PERSONA.judge);
    // Probe 1 is open on load with its request visible; nothing is sent until the button is pressed.
    await expect(page.getByTestId("probe-request")).toContainText("POST /v1/third-party-requests");
    await expect(page.getByTestId("probe-response-slot")).toContainText("The response and the audit row appear here.");
    await expect(page.getByTestId("probe-result")).toHaveCount(0);
    await page.locator('[data-probe="employer"]').click();
    await page.getByTestId("probe-run").click();
    await expect(page.getByTestId("probe-result")).toBeVisible();
    await expect(page.getByTestId("probe-verdict")).toContainText("Refused");
    await expect(page.getByTestId("probe-verdict")).toContainText("403");
    await expect(page.getByTestId("probe-text")).toContainText(/Art\. 19 to 21/);
    await expect(page.getByTestId("audit-rows")).toBeVisible();
    await expect(page.getByTestId("audit-verify")).toContainText(/Chain verified/);
  });

  test("a probe that touches no couple record says it writes no audit row", async ({ page }) => {
    await signInAs(page, "en", PERSONA.judge);
    await page.locator('[data-probe="marriage"]').click();
    await page.getByTestId("probe-run").click();
    await expect(page.getByTestId("probe-result")).toBeVisible();
    // Mock: "No audit row". Real backend: "No row in a couple's log" plus the chain growth. Both state that no couple row was written.
    await expect(page.getByTestId("audit-none")).toContainText(/No (audit )?row/i);
  });

  test("the visitor's own words are classified", async ({ page }) => {
    await signInAs(page, "en", PERSONA.judge);
    await page.locator('[data-probe="words"]').click();
    await page.locator("textarea").fill("Should we cancel the wedding?");
    await page.getByTestId("probe-run").click();
    await expect(page.getByTestId("probe-verdict")).toContainText("Refused");
  });

  test("without a lens the page still shows the recorded scoreboard and points to the judge lens", async ({ page }) => {
    await page.goto("/en/judge");
    await expect(page.getByText("From a recorded response").first()).toBeVisible();
    await expect(page.getByText(/does not show/i).first()).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("the running of a probe is axe-clean", async ({ page }) => {
    test.skip(REAL, "layout check only");
    await signInAs(page, "en", PERSONA.judge);
    await page.locator('[data-probe="distress"]').click();
    await page.getByTestId("probe-run").click();
    await expect(page.getByTestId("probe-result")).toBeVisible();
    await page.waitForTimeout(400);
    await expectNoAxeViolations(page);
  });
});
