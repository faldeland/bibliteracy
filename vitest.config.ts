import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    globals: false,
    // Default node env. Test files that need a DOM use the
    // `// @vitest-environment jsdom` per-file annotation (see e.g.
    // tests/grid/dotsStore.dom.test.ts).
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // Use forked workers so each test file gets its own process — this
    // sidesteps a hang when vitest's worker threads switch between the node
    // and jsdom environments inside the same worker.
    pool: "forks",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // We measure coverage on the pure, deterministic logic. The two
      // excluded modules below are thin wrappers around external services
      // (Supabase auth + dots, Supabase realtime + LiveKit) that we don't
      // attempt to mock in unit tests; their behavior is exercised in
      // integration tests run separately.
      include: ["lib/**/*.ts"],
      exclude: [
        "lib/supabase/**",
        "lib/grid/dotsApi.ts",
        "lib/bible/bollsApi.ts", // covered indirectly by route + parse tests
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
