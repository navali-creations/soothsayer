import { contextBridge, ipcRenderer } from "electron";
import {
  AppSetupAPI,
  CurrentSessionAPI,
  DataStoreAPI,
  MainWindowAPI,
  PoeLeaguesAPI,
  PoeNinjaAPI,
  PoeProcessAPI,
  SettingsStoreAPI,
} from "../electron/modules";

contextBridge.exposeInMainWorld("electron", {
  selectFile: (options: any) => ipcRenderer.invoke("select-file", options),

  divinationCards: {
    exportCsv: () => ipcRenderer.invoke("export-divination-cards-csv"),
  },

  session: CurrentSessionAPI,
  app: MainWindowAPI,
  appSetup: AppSetupAPI,
  poeProcess: PoeProcessAPI,
  dataStore: DataStoreAPI,
  poeNinja: PoeNinjaAPI,
  poeLeagues: PoeLeaguesAPI,
  settings: SettingsStoreAPI,
});
