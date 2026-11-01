import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Relative asset URLs: the same dist/ is served by each adapter at its own mount (e.g. /dpdp/admin/).
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2020",
  },
  test: { environment: "jsdom", globals: false, include: ["test/**/*.test.{ts,tsx}"] },
});
