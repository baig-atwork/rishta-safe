import { expect, test } from "@playwright/test";
import { PERSONA, REAL, signInAs } from "./helpers";

/** The result sits behind the threshold; ?enter=now is the labelled "skip the choice" entry. */
const RESULT = "couple/result?enter=now";

const DASHES = /[–—]/;

test.describe("result page: localised text only, stated once", () => {
  for (const locale of ["ar", "ur"] as const) {
    test(`${locale}: the engine's English detection sentences are not printed`, async ({ page }) => {
      await signInAs(page, locale, PERSONA.amal);
      await page.goto(`/${locale}/${RESULT}`);
      await expect(page.getByTestId("layer-1")).toBeVisible();
      // Read together shows two languages on purpose, so the English column legitimately holds English text. What must
      // never happen is the engine's English sentences inside the column that is meant to be in the page language.
      const column = page.locator(`main [lang="${locale}"]`);
      expect(await column.count(), "a column in the page language").toBeGreaterThan(0);
      const text = (await column.allInnerTexts()).join(" ");
      expect(text).not.toMatch(/assumed and illustrative|about \d+ in \d+ of the known|not a measured rate/i);
    });
  }

  test("en: each column's draft status once, boundary once, closing statements once, glossary limited to the document's terms", async ({ page }) => {
    await signInAs(page, "en", PERSONA.amal);
    await page.goto(`/en/${RESULT}`);
    await expect(page.getByTestId("layer-1")).toBeVisible();
    const text = await page.locator("main").innerText();
    expect(text).not.toContain("This explanation is a draft");
    // Each language column carries its own status stamp, once: the page language and the second language.
    await expect(page.getByTestId("layer-1").locator(".stamp")).toHaveCount(2);
    await expect(page.getByTestId("boundary")).toHaveCount(1);
    const disclaimer = page.getByTestId("disclaimer");
    if ((await disclaimer.count()) > 0) {
      const lines = (await disclaimer.first().locator("p").allInnerTexts()).map((l) => l.trim());
      expect(new Set(lines).size).toBe(lines.length);
    }
    expect(await page.locator("main dt").count()).toBeLessThanOrEqual(REAL ? 9 : 6);
    expect(text).not.toMatch(DASHES);
  });
});

test.describe("couple home, staff queue and header", () => {
  test("greeting uses the given name only", async ({ page }) => {
    await signInAs(page, "en", PERSONA.amal);
    const title = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
    expect(title).toMatch(/^Hello, \S+$/);
    expect(title).not.toMatch(/synthetic|\(/i);
  });

  test("the headline next step is never a branch event; branch events sit in a collapsed list", async ({ page }) => {
    test.skip(!REAL, "the real backend publishes allowed events with roles");
    await signInAs(page, "en", PERSONA.amal);
    await expect(page.locator("#next-title")).toContainText("Waiting for the clinician");
    await expect(page.locator("#next-title")).not.toContainText("partner chose not to share");
    const other = page.locator("details", { hasText: "Other things that can happen" });
    await expect(other).toBeVisible();
    expect(await other.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
  });

  test("counsellor queue: one row per couple, rules with the most urgent due-by hint lead, routine-only couples come last", async ({ page }) => {
    test.skip(!REAL, "uses the real backend's escalation rules");
    await signInAs(page, "en", PERSONA.counsellor);
    // /staff opens the first queue case, so wait for the redirect and scope to the queue pane (the brief has tables too).
    await page.waitForURL(/\/en\/staff\/couples\//);
    const rows = page.getByTestId("queue-pane").locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    const texts = (await rows.allInnerTexts()).map((t) => t.toLowerCase());
    const ids = texts.map((t) => /cpl-demo-\d+/.exec(t)?.[0] ?? "");
    expect(new Set(ids).size, "one row per couple").toBe(ids.length);
    const at = (id: string) => ids.indexOf(id);
    for (const routineOnly of ["cpl-demo-01", "cpl-demo-07"]) {
      for (const fastTrack of ["cpl-demo-02", "cpl-demo-05", "cpl-demo-09"]) {
        expect(at(fastTrack), `${fastTrack} before ${routineOnly}`).toBeLessThan(at(routineOnly));
      }
    }
    // The instrument's queue row shows priority, the first rule fired and the waiting time; the due-by hint lives in the
    // trace pane. The most urgent rule is the one a row shows first, and the trace pane of that case states its hint.
    expect(texts[at("cpl-demo-09")]).toContain("priority");
    expect(texts[at("cpl-demo-01")]).toContain("routine");
    await page.goto("/en/staff/couples/cpl-demo-09");
    await expect(page.getByText(/fast track/i).first()).toBeVisible();
    await page.goto("/en/staff/couples/cpl-demo-01");
    await expect(page.getByText(/routine/i).first()).toBeVisible();
  });

  test("the Lens control is visible, not truncated, and its accessible name contains the person's name", async ({ page }) => {
    await signInAs(page, "en", PERSONA.amal);
    const lens = page.getByTestId("lens-control");
    await expect(lens).toBeVisible();
    await expect(lens).toHaveAccessibleName(REAL ? /Lens.*Layla/ : /Lens.*Amal/);
    // Nothing inside the control is clipped: every element shows all of its content.
    const clipped = await lens.evaluate((el) =>
      [el, ...Array.from(el.querySelectorAll("*"))].filter((node) => !node.classList.contains("sr-only") && node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflow !== "visible").length,
    );
    expect(clipped, "clipped elements inside the Lens control").toBe(0);
    const box = await lens.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(120);
  });
});
