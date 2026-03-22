#!/usr/bin/env node

/**
 * Build main + preload for E2E tests (CI or local).
 *
 * Why this exists:
 *   `electron-forge start` uses its VitePlugin to inject `build.lib.entry`
 *   and output paths into `vite.main.config.mts` / `vite.preload.config.mts`
 *   at runtime.  The config files themselves don't contain entry points, so a
 *   bare `vite build --config vite.main.config.mts` produces nothing useful.
 *
 *   We also can't use `build.lib` with `formats: ["cjs"]` because Vite 8
 *   deprecated CJS lib output and throws "i.deprecate is not a function".
 *
 *   Instead, this script uses Vite's `--ssr` flag via the JS API, which:
 *   - Targets Node.js (no browser externalization of fs, path, etc.)
 *   - Produces CJS output by default
 *   - Doesn't go through the broken `build.lib` CJS codepath
 *
 *   The result lands in `.vite/build/main.js` and `.vite/build/preload.js`
 *   — exactly where the E2E test fixture expects them.
 *
 * Usage:
 *   node scripts/build-e2e.mjs
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const outDir = resolve(root, ".vite/build");

// ── Build main process ────────────────────────────────────────────────────────

console.log("[build-e2e] Building main process…");

await build({
  configFile: resolve(root, "vite.main.config.mts"),
  root,
  // Replicate the `define` constants that Forge's VitePlugin injects.
  // The main process uses these to decide whether to load from the dev
  // server (VITE_DEV_SERVER_URL is set) or from a file on disk.
  // In E2E mode the Vite dev server runs on localhost:5173 (started by
  // Playwright's webServer config), so we point Electron there.
  define: {
    MAIN_WINDOW_VITE_DEV_SERVER_URL: JSON.stringify("http://localhost:5173"),
    MAIN_WINDOW_VITE_NAME: JSON.stringify("main_window"),
  },
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: true,
    ssr: resolve(root, "main/main.ts"),
    rollupOptions: {
      output: {
        format: "cjs",
        entryFileNames: "main.js",
      },
    },
    // Keep everything in a single chunk — Electron loads a single file.
    codeSplitting: false,
  },
});

console.log("[build-e2e] ✓ main.js");

// ── Build preload ─────────────────────────────────────────────────────────────

console.log("[build-e2e] Building preload…");

await build({
  configFile: resolve(root, "vite.preload.config.mts"),
  root,
  build: {
    outDir,
    emptyOutDir: false,
    sourcemap: true,
    ssr: resolve(root, "renderer/preload.ts"),
    rollupOptions: {
      output: {
        format: "cjs",
        entryFileNames: "preload.js",
      },
    },
    codeSplitting: false,
  },
});

console.log("[build-e2e] ✓ preload.js");
console.log("[build-e2e] Done.");
