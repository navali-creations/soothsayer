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
    environment: "jsdom",
    setupFiles: ["./renderer/__test-setup__/setup.ts"],
    include: [
      "renderer/**/__tests__/**/*.test.{ts,tsx}",
      "renderer/**/*.test.{ts,tsx}",
    ],
    exclude: ["node_modules", "out", ".vite"],
    testTimeout: 10_000,
    pool: "forks",
    onConsoleLog() {
      // Suppress all console output (stdout + stderr) during test runs.
      // Production code logs liberally (e.g. [Slice], [Service] messages and
      // expected console.error calls in error-path tests) which creates a
      // wall of noise. Vitest still reports actual test failures regardless.
      // To see logs while debugging, run the individual test file directly.
      return false;
    },
    coverage: {
      provider: "v8",
      include: [
        "renderer/modules/**/*.ts",
        "renderer/modules/**/*.tsx",
        "renderer/hooks/**/*.ts",
        "renderer/components/**/*.ts",
        "renderer/components/**/*.tsx",
        "renderer/utils.ts",
        "renderer/sanitize.ts",
      ],
      exclude: [
        "renderer/**/__tests__/**",
        "renderer/**/__test-setup__/**",
        "renderer/**/index.ts",
        "renderer/routeTree.gen.ts",
        "renderer/renderer.tsx",
        "renderer/preload.ts",
        "renderer/sentry.ts",
        "renderer/modules/umami/**",
        "renderer/**/*.types.ts",
        "renderer/**/types.ts",
        "renderer/**/*.beacon.tsx",
        "renderer/**/*Beacon.tsx",
      ],
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage-renderer",
    },
  },
});
