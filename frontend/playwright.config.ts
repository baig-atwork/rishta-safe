import { defineConfig, devices } from "@playwright/test";

const real = process.env["BAYAN_E2E_REAL"] === "1";
const port = Number(process.env.PORT ?? (real ? 3101 : 3100));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Production build served with fixtures (no backend needed), or with BAYAN_E2E_REAL=1 against a running backend.
    // Run `pnpm build` first.
    command: `pnpm start -p ${port}`,
    url: `http://localhost:${port}/en`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: real
      ? { BAYAN_API_URL: process.env["BAYAN_API_URL"] ?? "http://127.0.0.1:8000", BAYAN_INSECURE_COOKIE: "1" }
      : { BAYAN_MOCK: "1", BAYAN_INSECURE_COOKIE: "1" },
  },
});
