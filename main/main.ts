import * as Sentry from "@sentry/electron/main";

import { SentryService } from "./modules/sentry";

if (process.env.E2E_TESTING !== "true") {
  SentryService.getInstance().initialize();
}

import { app as electronApp } from "electron";
import { installExtension, REDUX_DEVTOOLS } from "electron-devtools-installer";
import started from "electron-squirrel-startup";

import {
  AppService,
  AppSetupService,
  DiagLogService,
  MainWindowService,
  OverlayService,
  ProfitForecastService,
  RarityInsightsService,
  StorageService,
  SupabaseClientService,
} from "./modules";
import { SettingsKey, SettingsStoreService } from "./modules/settings-store";

// Handle Squirrel.Windows installer events (creates/removes shortcuts, etc.)
// This must be called early — if it returns true, the app is being run by the
// Squirrel installer and should quit immediately.
if (started) {
  electronApp.quit();
}

// Initialize diagnostic logging as early as possible so all subsequent
// console.log/warn/error calls are captured to diag.log. The constructor
// truncates the file, so it only contains entries from this session.
const _diagLog = DiagLogService.getInstance();

const app = AppService.getInstance();
const mainWindow = MainWindowService.getInstance();
const overlay = OverlayService.getInstance();
const _appSetup = AppSetupService.getInstance();
const _filterService = RarityInsightsService.getInstance();
const _profitForecast = ProfitForecastService.getInstance();
const supabase = SupabaseClientService.getInstance();
const _storageService = StorageService.getInstance();

async function initializeSupabase() {
  if (process.env.E2E_TESTING === "true") {
    console.log(
      "[Main] E2E_TESTING detected — skipping Supabase initialization",
    );
    return;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  console.log(
    `[Main] initializeSupabase — URL present: ${!!supabaseUrl}, ANON_KEY present: ${!!supabaseAnonKey}, isPackaged: ${
      electronApp.isPackaged
    }`,
  );

  if (supabaseUrl && supabaseAnonKey) {
    console.log("[Main] Configuring Supabase from environment variables");
    try {
      await supabase.configure(supabaseUrl, supabaseAnonKey);
      console.log("[Main] Supabase configured successfully");
    } catch (error) {
      console.error(
        "[Main] Supabase authentication failed after retries:",
        error,
      );
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          tags: { module: "main", operation: "supabase-init" },
        },
      );
      // App continues — leagues will use fallback
    }
  } else {
    console.warn(
      "[Main] Supabase credentials not found in environment. " +
        "Set SUPABASE_URL and SUPABASE_ANON_KEY, or configure via settings. " +
        "The build likely did not embed VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.",
    );
  }
}

// Skip single-instance lock in E2E mode — parallel Playwright workers each
// launch their own Electron process with an isolated --user-data-dir, but
// requestSingleInstanceLock() uses the app name (not user-data dir) for the
// lock socket on Linux, so the 2nd/3rd workers would immediately quit.
const singleInstanceLocked =
  process.env.E2E_TESTING === "true" || electronApp.requestSingleInstanceLock();

if (!singleInstanceLocked) {
  // Quit any new instance created to prevent multiple instances of the same app
  app.quit();
} else {
  electronApp.whenReady().then(async () => {
    if (!electronApp.isPackaged) {
      installExtension(REDUX_DEVTOOLS)
        .then((ext) => console.log(`Added Extension:  ${ext.name}`))
        .catch((err) => console.log("An error occurred: ", err));
    }

    await initializeSupabase();

    // Disable Sentry if the user has opted out of crash reporting.
    // Sentry was eagerly initialized above to catch startup crashes;
    // PII scrubbing in beforeSend/beforeBreadcrumb protects the brief
    // window before this check runs.
    try {
      const settingsStore = SettingsStoreService.getInstance();
      const crashReportingEnabled = await settingsStore.get(
        SettingsKey.TelemetryCrashReporting,
      );
      if (!crashReportingEnabled) {
        await SentryService.getInstance().disable();
      }
    } catch (error) {
      console.warn(
        "[Main] Could not check telemetry settings, Sentry remains active:",
        error,
      );
    }

    await mainWindow.createMainWindow();
    app.emitSecondInstance(mainWindow);
    app.emitRestart();
    app.emitGetVersion();
  });
}

app.emitActivate(mainWindow);
app.quitOnAllWindowsClosed([mainWindow, overlay]);
app.beforeQuitCloseWindowsAndDestroyElements();
