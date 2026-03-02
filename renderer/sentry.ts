import * as Sentry from "@sentry/electron/renderer";

let initialized = false;

/**
 * Initialize Sentry in the renderer process.
 *
 * @param enabled  When `false`, initialization is skipped entirely.
 *                 Defaults to `true` for backward compatibility.
 */
export function initSentry(enabled = true) {
  if (!enabled) {
    console.info("[Sentry] Crash reporting disabled by user preference");
    return;
  }

  if (initialized) {
    return;
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
  });

  initialized = true;
}
