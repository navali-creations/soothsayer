import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.test.ts",

  forbidOnly: !!process.env.CI,
  retries: 1,
  // Each test file gets its own worker-scoped Electron instance, so more
  // workers = more files running in parallel.  The slowest suites (settings,
  // onboarding, profit-forecast) are each split into multiple files so they
  // can run on separate workers and stay under ~1 minute each.  3 workers
  // balances parallelism with resource usage on both local and CI machines.
  workers: 3,
  // Do NOT enable fullyParallel — tests within a file share a single
  // worker-scoped Electron instance and page, so running them concurrently
  // would cause race conditions.  Parallelism is between files (workers) only.
  fullyParallel: false,

  reportSlowTests: { max: 0, threshold: 30_000 },

  timeout: 45_000,
  expect: { timeout: 8_000 },

  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "never" }], ["list"]],

  outputDir: "./e2e/test-results",

  use: {
    screenshot: "off",
    trace: "off",
    video: "off",
  },

  // Electron receives the matching URL through SOOTHSAYER_E2E_RENDERER_URL.
  // A strict, dedicated server prevents stale Forge builds or another Vite
  // app on this port from producing an empty or unrelated renderer.
  webServer: {
    command:
      "pnpm exec vite --config vite.renderer.config.mts --port 5173 --strictPort",
    port: 5173,
    timeout: 30_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
  },
});
