#!/usr/bin/env node

/**
 * Cross-platform helper that runs Vitest under Electron's Node.js runtime.
 *
 * Why this exists:
 *   Electron 40.8.0 ships a custom build of Node 24.14.0 with ABI (NODE_MODULE_VERSION) 143,
 *   while the system Node 24.14.0 uses ABI 137. Native modules like `better-sqlite3` are
 *   compiled for Electron's ABI by `electron-rebuild` (via `postinstall`), so they cannot be
 *   loaded by the system Node — and vice-versa.
 *
 *   Instead of flip-flopping between `pnpm rebuild better-sqlite3` (for vitest) and
 *   `electron-rebuild` (for the app / e2e tests), we run vitest itself inside Electron's
 *   Node runtime using the `ELECTRON_RUN_AS_NODE=1` flag. This way the Electron-rebuilt
 *   native modules load correctly in both the app and in tests, with zero rebuilds.
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
