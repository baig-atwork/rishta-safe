import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const LOCALES = ["en", "ar", "ur"] as const;
export type Locale = (typeof LOCALES)[number];

export const DIR: Record<Locale, "ltr" | "rtl"> = { en: "ltr", ar: "rtl", ur: "rtl" };

export const REAL = process.env["BAYAN_E2E_REAL"] === "1";

/**
 * Honesty rail items (`ul[aria-label] li.stamp`): synthetic, draft translations, pending sign-off and not clinical
 * advice always; a fifth ("Fixture mode") exists only when the mock serves the data.
 */
export const STAMP_COUNT = REAL ? 4 : 5;

/**
 * Persona ids. Fixture mode (default) uses the in-process mock; BAYAN_E2E_REAL=1 runs the same specs against the
 * real backend, whose seeded personas are cpl-demo-NN-a|b (couples) and clinician, counsellor, programme, judge.
 * cpl-demo-02-a is the released shared-result case in the real seed.
 */
export const PERSONA = REAL
  ? { amal: "cpl-demo-02-a", counsellor: "counsellor", clinician: "clinician", programme: "programme", judge: "judge" }
  : { amal: "persona-amal", counsellor: "persona-counsellor", clinician: "persona-clinician", programme: "persona-programme", judge: "persona-judge" };

/** WCAG 2.2 AA axe pass. Fails the test with the violation list so a regression is readable. */
export async function expectNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(summary, "axe violations").toEqual([]);
}

/** Chooses a seeded persona on the demo page; lands on the role's home. */
export async function signInAs(page: Page, locale: Locale, personaId: string): Promise<void> {
  await page.goto(`/${locale}/demo`);
  await page.locator(`[data-persona-id="${personaId}"]`).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/demo"));
}

/**
 * Chooses a persona through the Lens control in the header (the dialog), the way a person does on any route. The dialog
 * lists personas as `[data-lens-persona]` buttons (its fallback list) or, once the compact Case bench fills the slot, as
 * bench cells that carry the same attribute. Lands on the role's home.
 */
export async function signInViaLens(page: Page, locale: Locale, personaId: string): Promise<void> {
  await page.goto(`/${locale}`);
  await page.getByTestId("lens-control").click();
  await page.locator(`[data-lens-persona="${personaId}"]`).click();
  await page.waitForURL((url) => url.pathname !== `/${locale}`);
}
