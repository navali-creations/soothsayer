import { sentryVitePlugin } from "@sentry/vite-plugin";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

import { defineConfig } from "vite";
import { externalizeDeps } from "vite-plugin-externalize-deps";

const { version } = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8")
);

export default defineConfig({
  resolve: {
    alias: {
      "~/renderer": resolve(__dirname, "./renderer"),
      "~/main": resolve(__dirname, "./main"),
      "@types": resolve(__dirname, "./types"),
      "@enums": resolve(__dirname, "./enums"),
    },
    // Some libs that can run in both Web and Node.js envs
    // will export different bundles based on this
    mainFields: ["module", "jsnext:main", "jsnext"],
  },

  build: {
    rollupOptions: {
      plugins: [externalizeDeps()],
      external: [
        // Native modules
        "better-sqlite3",
      ],
      output: {
        format: "cjs",
      },
    },
    // Ensure source maps work in development
    sourcemap: true,
  },

  plugins: [
    sentryVitePlugin({
      org: "navali-creations",
      project: "electron",
      release: {
        name: `soothsayer@${version}`,
      },
    }),
  ],
});
