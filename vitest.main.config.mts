import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "~/renderer": resolve(__dirname, "./renderer"),
      "~/main": resolve(__dirname, "./main"),
      "~/types": resolve(__dirname, "./types"),
      "~/enums": resolve(__dirname, "./enums"),
      "@types": resolve(__dirname, "./types"),
      "@enums": resolve(__dirname, "./enums"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./main/__test-setup__/setup.ts"],
    include: ["main/**/__tests__/**/*.test.ts", "main/**/*.test.ts"],
    exclude: ["node_modules", "out", ".vite"],
    testTimeout: 10_000,
    pool: "forks",
    onConsoleLog() {
      // Suppress all console output (stdout + stderr) during test runs.
      // Production code logs liberally (e.g. [Init], [Service] messages and
      // expected console.error calls in error-path tests) which creates a
      // wall of noise. Vitest still reports actual test failures regardless.
      // To see logs while debugging, run the individual test file directly.
      return false;
    },
    coverage: {
      provider: "v8",
      include: ["main/modules/**/*.ts", "main/utils/**/*.ts"],
      exclude: [
        "main/modules/**/__tests__/**",
        "main/modules/**/index.ts",
        "main/modules/**/*.api.ts",
        "main/modules/**/*.channels.ts",
      ],
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
    },
  },
});
