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
      dsn: import.meta.env.SENTRY_DSN,
    });

    this.initialized = true;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}

export { SentryService };
