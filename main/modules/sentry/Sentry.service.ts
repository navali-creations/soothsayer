import * as Sentry from "@sentry/electron";

class SentryService {
  private static _instance: SentryService;
  private initialized = false;

  static getInstance() {
    if (!SentryService._instance) {
      SentryService._instance = new SentryService();
    }

    return SentryService._instance;
  }

  public initialize() {
    if (this.initialized) {
      return;
    }

    Sentry.init({
      dsn: "https://c6b4bfe8b20513cdc8016e60aab96365@o4510771036291072.ingest.de.sentry.io/4510771040157776",
    });

    this.initialized = true;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}

export { SentryService };
