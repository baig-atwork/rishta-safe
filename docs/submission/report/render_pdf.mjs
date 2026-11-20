// Render report.html to the A4 PDF with Playwright (chromium). Run: node render_pdf.mjs
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const require = createRequire('D:/dev/bayan/frontend/package.json');
const { chromium } = require('@playwright/test');

const HTML = 'D:/dev/bayan/docs/submission/report/report.html';
const OUT = process.argv[2] ?? 'D:/dev/bayan/docs/submission/technical-report.pdf';

const browser = await chromium.launch({ headless: true, timeout: 30000 });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(30000);
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: OUT, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false,
  });
  console.log('wrote', OUT);
} finally {
  await browser.close();
}
