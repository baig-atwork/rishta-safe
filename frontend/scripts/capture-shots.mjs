// Captures 390, 768 and 1440 px screenshots of the main pages in English and Arabic into docs/design/shots/.
// Usage: BASE_URL=http://localhost:3100 node scripts/capture-shots.mjs   (server started with BAYAN_MOCK=1)
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3100";
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "design", "shots");
const locales = (process.env.LOCALES ?? "en,ar").split(",");
const allWidths = [
  { w: 390, h: 844 },
  { w: 768, h: 1024 },
  { w: 1440, h: 900 },
];
const widths = process.env.WIDTHS ? allWidths.filter((x) => process.env.WIDTHS.split(",").includes(String(x.w))) : allWidths;

// BAYAN_REAL=1: the real backend's seeded personas (cpl-demo-02-a has the released shared result).
const real = process.env.BAYAN_REAL === "1";
const personaIds = real
  ? { couple: "cpl-demo-02-a", staff: "counsellor", clinician: "clinician", programme: "programme", judge: "judge" }
  : {
  couple: "persona-amal",
  staff: "persona-counsellor",
  clinician: "persona-clinician",
  programme: "persona-programme",
  judge: "persona-judge",
};

const pages = [
  { name: "landing", path: "", persona: null },
  { name: "how-it-works", path: "/how-it-works", persona: null },
  { name: "governance", path: "/governance", persona: null },
  { name: "demo", path: "/demo", persona: null },
  { name: "couple-home", path: "/couple", persona: personaIds.couple },
  { name: "threshold", path: "/couple/result", persona: personaIds.couple },
  { name: "result", path: "/couple/result?enter=now", persona: personaIds.couple },
  { name: "sharing", path: "/couple/sharing", persona: personaIds.couple },
  { name: "closure", path: "/couple/closure", persona: personaIds.couple },
  { name: "teach-back", path: "/couple/teach-back", persona: personaIds.couple },
  { name: "staff-queue", path: "/staff", persona: personaIds.staff },
  { name: "staff-brief", path: real ? "/staff/couples/cpl-demo-05" : "/staff/couples/c-01", persona: personaIds.staff },
  { name: "clinician", path: "/clinician", persona: personaIds.clinician },
  { name: "programme", path: "/programme", persona: personaIds.programme },
  { name: "judge", path: "/judge", persona: personaIds.judge },
];

const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const selected = only ? pages.filter((p) => only.includes(p.name)) : pages;
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const locale of locales) {
    for (const { w, h } of widths) {
      const context = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce", colorScheme: "light" });
      const page = await context.newPage();
      let current = null;
      for (const entry of selected) {
        if (entry.persona && entry.persona !== current) {
          await page.goto(`${base}/${locale}/demo`);
          await page.locator(`[data-persona-id="${entry.persona}"]`).click();
          await page.waitForURL((url) => !url.pathname.endsWith("/demo"));
          current = entry.persona;
        }
        await page.goto(`${base}/${locale}${entry.path}`, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(600);
        await page.screenshot({ path: join(out, `${locale}-${entry.name}-${w}.png`), fullPage: true });
      }
      await context.close();
    }
  }
  console.log(`wrote screenshots to ${out}`);
} finally {
  await browser.close();
}
