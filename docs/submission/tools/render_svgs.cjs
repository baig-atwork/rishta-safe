// Render the SVG diagrams in docs/diagrams to 2x PNG with Playwright (no network; every navigation has a timeout).
//   node render_svgs.cjs            (run from anywhere; uses the frontend's Playwright install)
const { createRequire } = require("module");
const fs = require("fs");
const path = require("path");
const req = createRequire(path.resolve(__dirname, "../../../frontend/package.json"));
const { chromium } = req("@playwright/test");

const DIR = path.resolve(__dirname, "../../diagrams");
const FONT = "file:///D:/tools/fonts/Outfit%5Bwght%5D.ttf";

(async () => {
  const browser = await chromium.launch();
  try {
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".svg"));
    for (const f of files) {
      const svg = fs.readFileSync(path.join(DIR, f), "utf8");
      const m = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
      const w = Number(m[1]);
      const h = Number(m[2]);
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Outfit";src:url("${FONT}");font-weight:100 900;}
html,body{margin:0;padding:0;background:#f8f9fb}svg{display:block}</style></head><body>${svg}</body></html>`;
      const tmp = path.join(DIR, "_render.html");
      fs.writeFileSync(tmp, html);
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
      ctx.setDefaultNavigationTimeout(20000);
      const page = await ctx.newPage();
      await page.goto("file:///" + tmp.replace(/\\/g, "/"), { waitUntil: "load", timeout: 20000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(DIR, f.replace(/\.svg$/, "@2x.png")), clip: { x: 0, y: 0, width: w, height: h } });
      await ctx.close();
      fs.unlinkSync(tmp);
      console.log("rendered", f);
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
