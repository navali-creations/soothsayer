import { contextBridge, ipcRenderer } from "electron";
import {
  AnalyticsAPI,
  AppSetupAPI,
  CurrentSessionAPI,
  DataStoreAPI,
  MainWindowAPI,
  PoeLeaguesAPI,
  PoeNinjaAPI,
  PoeProcessAPI,
  SessionsAPI,
  SettingsStoreAPI,
} from "../electron/modules";

contextBridge.exposeInMainWorld("electron", {
  selectFile: (options: any) => ipcRenderer.invoke("select-file", options),

  divinationCards: {
    exportCsv: () => ipcRenderer.invoke("export-divination-cards-csv"),
  },

  session: CurrentSessionAPI,
  sessions: SessionsAPI,
  app: MainWindowAPI,
  appSetup: AppSetupAPI,
  poeProcess: PoeProcessAPI,
  dataStore: DataStoreAPI,
  poeNinja: PoeNinjaAPI,
  poeLeagues: PoeLeaguesAPI,
  settings: SettingsStoreAPI,
  analytics: AnalyticsAPI,
});
