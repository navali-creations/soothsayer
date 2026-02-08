import * as Sentry from "@sentry/electron/renderer";

let initialized = false;

export function initSentry() {
  if (initialized) {
    return;
  }

  Sentry.init({
    dsn: import.meta.env.SENTRY_DSN,
  });

  initialized = true;
}
