// Runs the Playwright suite against the REAL backend (BAYAN_API_URL, default http://127.0.0.1:8000).
// Start the backend first: cd ../backend && uv run python -m uvicorn "bayan.api.app:create_app" --factory --port 8000
import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: { ...process.env, BAYAN_E2E_REAL: "1" },
});
process.exit(result.status ?? 1);
