// Lists the script chunks one page loads (gzip size, and which libraries each chunk contains).
// Usage: PATH_=/en/couple/sharing PERSONA=persona-amal node scripts/chunk-report.mjs
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3100";
const path = process.env.PATH_ ?? "/en";
const persona = process.env.PERSONA ?? null;
const markers = {
  "react-dom": "react-dom",
  next: "next/dist/client",
  "next-intl": "next-intl",
  tanstack: "@tanstack/query",
  "react-hook-form": "react-hook-form",
  zod: "zod",
  motion: "motion-dom",
  "base-ui": "@base-ui",
  lucide: "lucide",
};

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
if (persona) {
  await page.goto(`${base}/en/demo`);
  await page.locator(`[data-persona-id="${persona}"]`).click();
  await page.waitForURL((u) => !u.pathname.endsWith("/demo"));
}
const rows = [];
const pending = [];
page.on("response", (res) => {
  if (res.request().resourceType() !== "script") return;
  pending.push(
    res.body().then((b) => {
      const text = b.toString("utf8");
      const libs = Object.entries(markers)
        .filter(([, m]) => text.includes(m))
        .map(([k]) => k);
      rows.push({ file: res.url().split("/").slice(-1)[0].slice(0, 40), gzKB: +(gzipSync(b).length / 1024).toFixed(1), libs: libs.join(",") });
    }),
  );
});
await page.goto(`${base}${path}`, { waitUntil: "load" });
await page.waitForTimeout(800);
await Promise.all(pending);
rows.sort((a, b) => b.gzKB - a.gzKB);
console.table(rows.slice(0, 14));
console.log("total gzip KB:", rows.reduce((s, r) => s + r.gzKB, 0).toFixed(1));
await browser.close();
