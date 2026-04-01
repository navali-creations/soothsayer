import { contextBridge, ipcRenderer } from "electron";

import { AnalyticsAPI } from "~/main/modules/analytics/Analytics.api";
import { AppAPI } from "~/main/modules/app/App.api";
import { AppSetupAPI } from "~/main/modules/app-setup/AppSetup.api";
import { CardDetailsAPI } from "~/main/modules/card-details/CardDetails.api";
import { CsvAPI } from "~/main/modules/csv/Csv.api";
import { CurrentSessionAPI } from "~/main/modules/current-session/CurrentSession.api";
import { DataStoreAPI } from "~/main/modules/data-store/DataStore.api";
import { DiagLogAPI } from "~/main/modules/diag-log/DiagLog.api";
import { DivinationCardsApi } from "~/main/modules/divination-cards/DivinationCards.api";
import { MainWindowAPI } from "~/main/modules/main-window/MainWindow.api";
import { OverlayAPI } from "~/main/modules/overlay/Overlay.api";
import { PoeLeaguesAPI } from "~/main/modules/poe-leagues/PoeLeagues.api";
import { PoeProcessAPI } from "~/main/modules/poe-process/PoeProcess.api";
import { ProfitForecastAPI } from "~/main/modules/profit-forecast/ProfitForecast.api";
import { ProhibitedLibraryAPI } from "~/main/modules/prohibited-library/ProhibitedLibrary.api";
import { RarityInsightsAPI } from "~/main/modules/rarity-insights/RarityInsights.api";
import { SessionsAPI } from "~/main/modules/sessions/Sessions.api";
import { SettingsStoreAPI } from "~/main/modules/settings-store/SettingsStore.api";
import { SnapshotAPI } from "~/main/modules/snapshots/Snapshot.api";
import { StorageAPI } from "~/main/modules/storage/Storage.api";
import { UpdaterAPI } from "~/main/modules/updater/Updater.api";

contextBridge.exposeInMainWorld("electron", {
  selectFile: (options: any) => ipcRenderer.invoke("select-file", options),

  // ── E2E-only test bridge ─────────────────────────────────────────────
  // Expose a scoped ipcRenderer.invoke for e2e test-only IPC channels,
  // plus a flag the renderer store uses to decide whether to expose
  // the Zustand store on `window.__zustandStore`.
  //
  // Defence-in-depth:
  //   1. The allowlist below restricts callable channels to e2e:db-*
  //   2. The main-process handlers only register when BOTH
  //      `E2E_TESTING=true` AND `!app.isPackaged` (see Database.service)
  //   3. The handlers reject destructive SQL (DROP, ALTER, etc.)
  //
  // This block is intentionally unconditional because Vite's bundler
  // replaces `process.env` with `{}` in preload builds, making runtime
  // env-var checks unreliable. The main-process guards are the true
  // security boundary — if the handlers aren't registered, these calls
  // are harmless no-ops that reject with "No handler registered".
  __E2E_TESTING: true as const,
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => {
      const allowedChannels = ["e2e:db-exec", "e2e:db-query"];
      if (allowedChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      throw new Error(
        `ipcRenderer.invoke: channel "${channel}" is not allowed`,
      );
    },
  },

  csv: CsvAPI,

  cardDetails: CardDetailsAPI,
  diagLog: DiagLogAPI,
  session: CurrentSessionAPI,
  sessions: SessionsAPI,
  snapshots: SnapshotAPI,
  mainWindow: MainWindowAPI,
  app: AppAPI,
  overlay: OverlayAPI,
  appSetup: AppSetupAPI,
  poeProcess: PoeProcessAPI,
  dataStore: DataStoreAPI,
  poeLeagues: PoeLeaguesAPI,
  settings: SettingsStoreAPI,
  analytics: AnalyticsAPI,
  divinationCards: DivinationCardsApi,
  updater: UpdaterAPI,
  rarityInsights: RarityInsightsAPI,
  prohibitedLibrary: ProhibitedLibraryAPI,
  profitForecast: ProfitForecastAPI,
  storage: StorageAPI,
});
