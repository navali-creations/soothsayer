#!/usr/bin/env node

/**
 * Cross-platform helper that runs Vitest under Electron's Node.js runtime.
 *
 * Why this exists:
 *   Main-process tests run inside Electron's Node-compatible runtime using the
 *   `ELECTRON_RUN_AS_NODE=1` flag. This keeps their runtime aligned with the packaged app.
 *
 *   `better-sqlite3` v13 uses N-API and ships cross-runtime prebuilt binaries, so the same
 *   addon now works in system Node and Electron without an Electron-specific rebuild.
 *
 * Usage (from package.json scripts):
 *   "test:main": "node scripts/vitest-electron.mjs run --config vitest.main.config.mts"
 *
 * All arguments after the script name are forwarded to vitest verbatim.
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);

// Resolve the absolute path to the Electron binary installed in node_modules.
// The `electron` package exports its binary path when required.
const electronBinary = require("electron");

// Resolve the vitest entry-point (the .mjs CLI wrapper).
const vitestEntry = resolve(
  import.meta.dirname,
  "..",
  "node_modules",
  "vitest",
  "vitest.mjs",
);

// Forward every CLI argument after `vitest-electron.mjs` to vitest.
const args = [vitestEntry, ...process.argv.slice(2)];

const child = spawn(electronBinary, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    // Makes the Electron binary behave as a plain Node.js runtime.
    ELECTRON_RUN_AS_NODE: "1",
  },
  // On Windows, electron.exe is a native binary (not a shell script),
  // so we must NOT use `shell: true` — it would break argument quoting.
  windowsHide: true,
});

child.on("close", (code, signal) => {
  if (code !== null) {
    process.exit(code);
  }
  // If terminated by signal, mirror it.
  process.kill(process.pid, signal);
});

// Relay termination signals so vitest can clean up gracefully.
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sig, () => {
    if (!child.killed) {
      child.kill(sig);
    }
  });
}
