// Every screen against a real backend: examples/fastapi_shop from a dpdpkit-fastapi checkout.
//   DPDPKIT_FASTAPI_DIR  path to the dpdpkit-fastapi checkout (default ../dpdpkit-fastapi)
//   DPDPKIT_PYTHON       Python with dpdpkit-fastapi installed (default python)
// Uses the installed Chrome, so there is no browser to download.
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const shop = resolve(process.env.DPDPKIT_FASTAPI_DIR ?? "../dpdpkit-fastapi", "examples/fastapi_shop");
const python = process.env.DPDPKIT_PYTHON ?? "python";

// One database file inside node_modules, replaced on each run, so nothing piles up in the temp folder.
const cache = resolve("node_modules/.cache/dpdpkit-admin-e2e");
const db = resolve(cache, "e2e.db").replaceAll("\\", "/");
if (process.env.TEST_WORKER_INDEX === undefined) {
  mkdirSync(cache, { recursive: true });
  rmSync(db, { force: true });
}

const apiPort = "18775";
const port = "15184";
const api = `http://127.0.0.1:${apiPort}`;
const preview = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    channel: "chrome",
    baseURL: preview,
    extraHTTPHeaders: { "X-User": "staff" }, // fastapi_shop's stand-in for a signed-in admin
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `"${python}" -m uvicorn app:app --host 127.0.0.1 --port ${apiPort}`,
      cwd: shop,
      env: { DATABASE_URL: `sqlite:///${db}`, PYTHONIOENCODING: "utf-8" },
      url: `${api}/dpdp/notices/current`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite preview --config e2e/vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
      env: { DPDPKIT_E2E_API: api },
      url: preview,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
