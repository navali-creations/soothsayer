import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { app } from "electron";

let logPath: string | null = null;

export function getLogPath(): string {
  if (!logPath) {
    const logDir = app.getPath("userData");
    mkdirSync(logDir, { recursive: true });
    logPath = join(logDir, "diag.log");
  }
  return logPath;
}

/**
 * Truncate the diagnostic log file so it only contains entries from the
 * current app session. Call once at startup before any `diagLog()` calls.
 */
export function clearDiagLog(): void {
  try {
    writeFileSync(getLogPath(), "", "utf-8");
  } catch {
    // Best-effort — never crash the app for a diagnostic log
  }
}

/**
 * Append a timestamped line to a diagnostic log file in the app's userData
 * directory. This survives packaged builds where stdout is not visible.
 *
 * The log file lives at:
 * - Windows: %AppData%/Soothsayer/diag.log
 * - macOS:   ~/Library/Application Support/Soothsayer/diag.log
 * - Linux:   ~/.config/Soothsayer/diag.log
 */
export function diagLog(message: string): void {
  try {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    appendFileSync(getLogPath(), line, "utf-8");
  } catch {
    // Best-effort — never crash the app for a diagnostic log
  }
}
