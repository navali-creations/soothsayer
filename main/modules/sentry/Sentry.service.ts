import * as Sentry from "@sentry/electron/main";
import { app } from "electron";

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
      dsn: import.meta.env.VITE_SENTRY_DSN,
      release: `soothsayer@${app.getVersion()}`,
      environment: app.isPackaged ? "production" : "development",
    });

    this.initialized = true;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }
}

export { SentryService };
