// Measures route JS (gzip, all script responses), LCP and CLS per page against the budgets
// (JS <= 170 KB gzip, LCP <= 2.5 s, CLS <= 0.1). Usage: BASE_URL=http://localhost:3100 node scripts/measure-budget.mjs
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3100";
const locales = (process.env.LOCALES ?? "en,ar,ur").split(",");
const personas = {
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
  { name: "couple-home", path: "/couple", persona: personas.couple },
  { name: "result", path: "/couple/result", persona: personas.couple },
  { name: "sharing", path: "/couple/sharing", persona: personas.couple },
  { name: "closure", path: "/couple/closure", persona: personas.couple },
  { name: "teach-back", path: "/couple/teach-back", persona: personas.couple },
  { name: "staff", path: "/staff", persona: personas.staff },
  { name: "clinician", path: "/clinician", persona: personas.clinician },
  { name: "programme", path: "/programme", persona: personas.programme },
  { name: "judge", path: "/judge", persona: personas.judge },
];

const rows = [];
const browser = await chromium.launch();
try {
  for (const locale of locales) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__cls = 0;
      window.__lcp = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__lcp = e.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    });
    let current = null;
    for (const entry of pages) {
      if (entry.persona && entry.persona !== current) {
        await page.goto(`${base}/${locale}/demo`);
        await page.locator(`[data-persona-id="${entry.persona}"]`).click();
        await page.waitForURL((url) => !url.pathname.endsWith("/demo"));
        current = entry.persona;
      }
      let jsBytes = 0;
      const seenScripts = new Set();
      const pending = [];
      const onResponse = (res) => {
        if (res.request().resourceType() === "script" && !seenScripts.has(res.url())) { seenScripts.add(res.url()); pending.push(res.body().then((b) => { jsBytes += gzipSync(b).length; }).catch(() => {})); }
      };
      page.on("response", onResponse);
      await page.goto(`${base}/${locale}${entry.path}`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      await Promise.all(pending);
      page.off("response", onResponse);
      const { cls, lcp } = await page.evaluate(() => ({ cls: window.__cls, lcp: window.__lcp }));
      rows.push({ locale, page: entry.name, jsKB: +(jsBytes / 1024).toFixed(1), lcpMs: Math.round(lcp), cls: +cls.toFixed(3) });
    }
    await context.close();
  }
} finally {
  await browser.close();
}
console.table(rows);
const worst = (key) => rows.reduce((a, r) => (r[key] > a[key] ? r : a));
console.log("worst JS:", worst("jsKB"), "\nworst LCP:", worst("lcpMs"), "\nworst CLS:", worst("cls"));
const over = rows.filter((r) => r.jsKB > 170 || r.lcpMs > 2500 || r.cls > 0.1);
console.log(over.length ? `OVER BUDGET: ${over.length} rows` : "all rows within budget");
