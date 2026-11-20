import { expect, test, type Page } from "@playwright/test";
import { PERSONA, REAL, signInAs } from "./helpers";

/**
 * Consent release, end to end, through the UI and the REAL backend.
 *
 * The seeded case cpl-demo-04 is an alpha-thalassaemia carrier pair under the Dubai policy: each person is told their own
 * result first, and the joint result is not released to one partner until the other has agreed to share (backend:
 * governance/disclosure.py, "awaiting_partner_consent"; backend/tests/integration/test_demo_flow.py
 * test_partner_consent_is_required_under_dubai_policy). So:
 *   1. cpl-demo-04-b opens the result and sees the withheld notice, with no layer-1;
 *   2. cpl-demo-04-a grants consent to the partner through the sharing form;
 *   3. cpl-demo-04-b opens the result again and now sees layer-1 with a category.
 *
 * The mock has no such rule, so this runs only with BAYAN_E2E_REAL=1 against a running backend.
 */
test.skip(!REAL, "Consent release is a backend rule: this spec runs only against the real backend (BAYAN_E2E_REAL=1).");

const LOCALE = "en";
const PARTNER_A = "cpl-demo-04-a";
const PARTNER_B = "cpl-demo-04-b";
/** The pseudonymous person id the backend gives member B of case 4 (see /v1/demo/cases: partner_persona_ids). */
const PARTNER_B_PERSON_ID = "prs-04b";

/**
 * Puts the demo back to its seed so the spec is repeatable: an earlier run's consent would otherwise release the result
 * before step 1. The backend rate-limits resets (one per 20 s) and answers 409 inside that window, so it waits and retries.
 */
async function resetDemo(page: Page): Promise<void> {
  await signInAs(page, LOCALE, PERSONA.judge);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await page.request.post("/api/v1/demo/reset");
    if (response.ok()) return;
    expect(response.status(), "reset is only ever refused for rate limiting").toBe(409);
    await page.waitForTimeout(21_000);
  }
  throw new Error("The demo could not be reset after three attempts.");
}

test("under the Dubai policy a joint result stays withheld until the partner consents, then it is released", async ({ page }) => {
  test.setTimeout(120_000);
  await resetDemo(page);

  // 1. Before the partner has agreed: the withheld notice, and nothing of the result.
  await signInAs(page, LOCALE, PARTNER_B);
  await page.goto(`/${LOCALE}/couple/result`);
  await expect(page.getByRole("heading", { level: 1, name: "Your result is not shown yet" })).toBeVisible();
  await expect(page.getByText("Your partner has not yet agreed to share.")).toBeVisible();
  await expect(page.getByTestId("layer-1")).toHaveCount(0);
  await expect(page.getByTestId("tally-grid")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Review sharing" })).toBeVisible();

  // 2. The partner shares the couple result with B: the "Share" switch in the "Couple result" row of the matrix (to B, at the
  //    narrowest level, for the partner-disclosure purpose), then the ledger (inside its disclosure) shows the record.
  await signInAs(page, LOCALE, PARTNER_A);
  await page.goto(`/${LOCALE}/couple/sharing`);
  const share = page.getByRole("switch", { name: /Share.*Couple result/ });
  await expect(share).toHaveAttribute("aria-checked", "false");
  await share.click();
  await expect(page.getByRole("switch", { name: /Revoke.*Couple result/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Recorded: consent_granted")).toBeVisible();

  await page.getByText("Consent ledger (table)").click();
  const ledger = page.getByRole("table", { name: /Every sharing choice recorded/ });
  await expect(ledger.getByRole("cell", { name: "Share my findings with my partner, to the level I choose" })).toBeVisible();
  await expect(ledger.getByText("Active")).toBeVisible();
  expect(PARTNER_B_PERSON_ID).toBe("prs-04b");

  // 3. The partner opens the result again: layer-1 is there, with one of the three categories.
  await signInAs(page, LOCALE, PARTNER_B);
  await page.goto(`/${LOCALE}/couple/result?enter=now`);
  const layer1 = page.getByTestId("layer-1");
  await expect(layer1).toBeVisible();
  await expect(layer1).toHaveAttribute("data-cat", /^(shared_result_found|no_shared_change_found|more_information_needed)$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your result is not shown yet" })).toHaveCount(0);
});
