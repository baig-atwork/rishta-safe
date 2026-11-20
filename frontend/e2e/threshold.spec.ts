import { expect, test } from "@playwright/test";
import { REAL, expectNoAxeViolations, signInAs } from "./helpers";

/**
 * The threshold, end to end (mock mode): the result is not in the page before a choice; "I prefer not to know" is
 * confirmed, issues one PUT (one new audit row on the tape) and shows the declared state, which survives a reload because
 * the server holds it; the sharing page agrees; withdrawing (DELETE) returns to the threshold. Uses Idris (case 2), a
 * couple member no other spec touches, because the mock store is shared by every test in the run.
 */
// Real backend: Anwar (cpl-demo-02-b) is the partner of the member other specs read; his right-not-to-know is declared and
// withdrawn within the first test, so the seed is left as it was found.
const IDRIS = REAL ? "cpl-demo-02-b" : "persona-idris";

test("threshold, then right not to know, declared, withdraw", async ({ page }) => {
  await signInAs(page, "en", IDRIS);
  await page.goto("/en/couple/result");

  // Before a choice: the threshold, with no result in the DOM at all.
  await expect(page.getByTestId("threshold")).toBeVisible();
  await expect(page.getByTestId("layer-1")).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(4);
  await expectNoAxeViolations(page);

  // Keyboard: arrows move between options; Enter on Continue.
  await page.getByRole("radio", { name: /Read it now/ }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio", { name: /counsellor first/ })).toBeChecked();

  // The right not to know asks first, quoting the articles.
  await page.getByRole("radio", { name: /prefer not to know/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Art. 9(2)");
  await expect(dialog).toContainText("Art. 26(2)");
  await expectNoAxeViolations(page);
  const puts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().includes("right-not-to-know")) puts.push(request.url());
  });
  await dialog.getByRole("button", { name: "Record my choice" }).click();

  // Declared: the server's state, shown again after a reload; the audit tape has the new row.
  await expect(page.getByRole("heading", { name: "You chose not to know this result" })).toBeVisible();
  expect(puts).toHaveLength(1);
  await expect(page.locator(".tape")).toContainText("rntk_declared");
  await page.reload();
  await expect(page.getByRole("heading", { name: "You chose not to know this result" })).toBeVisible();
  await expect(page.getByTestId("layer-1")).toHaveCount(0);
  await expectNoAxeViolations(page);

  // The sharing page shows the same status and offers the same withdrawal.
  await page.goto("/en/couple/sharing");
  await expect(page.getByTestId("rntk-state")).toHaveText("declared");
  await page.goto("/en/couple/result");

  // Withdraw: one DELETE, back to the threshold, then the result opens through "Read it now".
  await page.getByRole("button", { name: "I want to see my result" }).click();
  await expect(page.getByTestId("threshold")).toBeVisible();
  await expect(page.locator(".tape")).toContainText("rntk_withdrawn");
  await page.getByRole("radio", { name: /Read it now/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("layer-1")).toBeVisible();
  await expectNoAxeViolations(page);

  // "Change how I meet it" reopens the threshold.
  await page.getByRole("button", { name: "Change how I meet it" }).click();
  await expect(page.getByTestId("threshold")).toBeVisible();
});

test("?enter=now skips the choice, and 'with a counsellor first' keeps the result closed", async ({ page }) => {
  await signInAs(page, "en", IDRIS);
  await page.goto("/en/couple/result?enter=now");
  await expect(page.getByTestId("layer-1")).toBeVisible();

  await page.goto("/en/couple/result");
  await page.getByRole("radio", { name: /counsellor first/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByTestId("closed-counsellor")).toBeVisible();
  await expect(page.getByTestId("layer-1")).toHaveCount(0);
  await page.getByRole("button", { name: "Change how I meet my result" }).click();
  await expect(page.getByTestId("threshold")).toBeVisible();
});
