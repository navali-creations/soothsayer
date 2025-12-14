import { contextBridge, ipcRenderer } from "electron";
import { AnalyticsAPI } from "../electron/modules/analytics/Analytics.api";
import { AppSetupAPI } from "../electron/modules/app-setup/AppSetup.api";
import { CurrentSessionAPI } from "../electron/modules/current-session/CurrentSession.api";
import { DataStoreAPI } from "../electron/modules/data-store/DataStore.api";
import { MainWindowAPI } from "../electron/modules/main-window/MainWindow.api";
import { OverlayAPI } from "../electron/modules/overlay/Overlay.api";
import { PoeLeaguesAPI } from "../electron/modules/poe-leagues/PoeLeagues.api";
import { PoeNinjaAPI } from "../electron/modules/poe-ninja/PoeNinja.api";
import { PoeProcessAPI } from "../electron/modules/poe-process/PoeProcess.api";
import { SessionsAPI } from "../electron/modules/sessions/Sessions.api";
import { SettingsStoreAPI } from "../electron/modules/settings-store/SettingsStore.api";

contextBridge.exposeInMainWorld("electron", {
  selectFile: (options: any) => ipcRenderer.invoke("select-file", options),

  divinationCards: {
    exportCsv: () => ipcRenderer.invoke("export-divination-cards-csv"),
  },

  session: CurrentSessionAPI,
  sessions: SessionsAPI,
  app: MainWindowAPI,
  overlay: OverlayAPI,
  appSetup: AppSetupAPI,
  poeProcess: PoeProcessAPI,
  dataStore: DataStoreAPI,
  poeNinja: PoeNinjaAPI,
  poeLeagues: PoeLeaguesAPI,
  settings: SettingsStoreAPI,
  analytics: AnalyticsAPI,
});
