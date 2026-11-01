import { defineConfig } from "vite";

const api = process.env.DPDPKIT_E2E_API ?? "http://127.0.0.1:18775";

// Serves the production build from dist/ with the API on the same origin, as the adapters do.
export default defineConfig({
  build: { outDir: "dist" },
  preview: { proxy: { "/dpdp": api } },
});
