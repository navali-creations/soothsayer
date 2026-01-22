import { resolve } from "node:path";
import { defineConfig } from "vite";
import { externalizeDeps } from "vite-plugin-externalize-deps";

export default defineConfig({
  resolve: {
    alias: {
      "~/src": resolve(__dirname, "./src"),
      "~/electron": resolve(__dirname, "./electron"),
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
        // Scraper-only deps (not used in Electron app)
        "cheerio",
        "puppeteer",
      ],
      output: {
        format: "cjs",
      },
    },
    // Ensure source maps work in development
    sourcemap: true,
  },
});
