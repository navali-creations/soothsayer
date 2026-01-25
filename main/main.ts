import { SentryService } from "./modules/sentry";

SentryService.getInstance().initialize();

import { app as electronApp } from "electron";
import { installExtension, REDUX_DEVTOOLS } from "electron-devtools-installer";

import {
  AppService,
  AppSetupService,
  MainWindowService,
  OverlayService,
  SupabaseClientService,
} from "./modules";

const app = AppService.getInstance();
const mainWindow = MainWindowService.getInstance();
const overlay = OverlayService.getInstance();
const _appSetup = AppSetupService.getInstance();
const supabase = SupabaseClientService.getInstance();

function initializeSupabase() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    console.log("[Main] Configuring Supabase from environment variables");
    supabase.configure(supabaseUrl, supabaseAnonKey);
  } else {
    console.warn(
      "[Main] Supabase credentials not found in environment. " +
        "Set SUPABASE_URL and SUPABASE_ANON_KEY, or configure via settings.",
    );
  }
}

if (!electronApp.requestSingleInstanceLock()) {
  // Quit any new instance created to prevent multiple instances of the same app
  app.quit();
} else {
  electronApp.whenReady().then(async () => {
    installExtension(REDUX_DEVTOOLS)
      .then((ext) => console.log(`Added Extension:  ${ext.name}`))
      .catch((err) => console.log("An error occurred: ", err));

    initializeSupabase();

    await mainWindow.createMainWindow(app.isQuitting);
    app.emitSecondInstance(mainWindow);
    app.emitRestart();
  });
}

app.emitActivate(mainWindow);
app.quitOnAllWindowsClosed([mainWindow, overlay]);
app.beforeQuitCloseWindowsAndDestroyElements();
