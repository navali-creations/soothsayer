import * as Sentry from "@sentry/electron/renderer";

let initialized = false;

export function initSentry() {
  if (initialized) {
    return;
  }

  Sentry.init({
    dsn: "https://c6b4bfe8b20513cdc8016e60aab96365@o4510771036291072.ingest.de.sentry.io/4510771040157776",
  });

  initialized = true;
}
