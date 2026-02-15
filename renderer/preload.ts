import { contextBridge, ipcRenderer } from "electron";

import { AnalyticsAPI } from "~/main/modules/analytics/Analytics.api";
import { AppAPI } from "~/main/modules/app/App.api";
import { AppSetupAPI } from "~/main/modules/app-setup/AppSetup.api";
import { CurrentSessionAPI } from "~/main/modules/current-session/CurrentSession.api";
import { DataStoreAPI } from "~/main/modules/data-store/DataStore.api";
import { DivinationCardsApi } from "~/main/modules/divination-cards/DivinationCards.api";
import { FilterAPI } from "~/main/modules/filters/Filter.api";
import { MainWindowAPI } from "~/main/modules/main-window/MainWindow.api";
import { OverlayAPI } from "~/main/modules/overlay/Overlay.api";
import { PoeLeaguesAPI } from "~/main/modules/poe-leagues/PoeLeagues.api";
import { PoeProcessAPI } from "~/main/modules/poe-process/PoeProcess.api";
import { SessionsAPI } from "~/main/modules/sessions/Sessions.api";
import { SettingsStoreAPI } from "~/main/modules/settings-store/SettingsStore.api";
import { SnapshotAPI } from "~/main/modules/snapshots/Snapshot.api";
import { UpdaterAPI } from "~/main/modules/updater/Updater.api";

contextBridge.exposeInMainWorld("electron", {
  selectFile: (options: any) => ipcRenderer.invoke("select-file", options),

  csv: {
    export: () => ipcRenderer.invoke("export-divination-cards-csv"),
  },

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
  filters: FilterAPI,
});
