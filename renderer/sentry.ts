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

    // L7: Scrub GGG usernames from renderer console breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      if (
        breadcrumb.category === "console" &&
        breadcrumb.message?.includes("username=")
      ) {
        breadcrumb.message = breadcrumb.message.replace(
          /username=[^\s,)]+/g,
          "username=[redacted]",
        );
      }
      return breadcrumb;
    },
  });

  initialized = true;
}
