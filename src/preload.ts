import { contextBridge, ipcRenderer } from "electron";
import {
  DataStoreAPI,
  MainWindowAPI,
  PoeLeaguesAPI,
  PoeNinjaAPI,
  PoeProcessAPI,
  SettingsStoreAPI,
} from "../electron/modules";

contextBridge.exposeInMainWorld("electron", {
  selectFile: (options: any) => ipcRenderer.invoke("select-file", options),

  clientTxtPaths: {
    get: () =>
      SettingsStoreAPI.getPoe1ClientPath().then((poe1) =>
        SettingsStoreAPI.getPoe2ClientPath().then((poe2) => ({ poe1, poe2 })),
      ),
    set: (paths: { poe1?: string; poe2?: string }) => {
      const promises = [];
      if (paths.poe1 !== undefined) {
        promises.push(SettingsStoreAPI.setPoe1ClientPath(paths.poe1));
      }
      if (paths.poe2 !== undefined) {
        promises.push(SettingsStoreAPI.setPoe2ClientPath(paths.poe2));
      }
      return Promise.all(promises);
    },
  },

  divinationCards: {
    exportCsv: () => ipcRenderer.invoke("export-divination-cards-csv"),
  },

  // Session API
  session: {
    start: (game: "poe1" | "poe2", league: string) =>
      ipcRenderer.invoke("session:start", game, league),
    stop: (game: "poe1" | "poe2") => ipcRenderer.invoke("session:stop", game),
    isActive: (game: "poe1" | "poe2") =>
      ipcRenderer.invoke("session:is-active", game),
    getCurrent: (game: "poe1" | "poe2") =>
      ipcRenderer.invoke("session:get-current", game),
    getInfo: (game: "poe1" | "poe2") =>
      ipcRenderer.invoke("session:get-info", game),
    getAll: (game: "poe1" | "poe2") =>
      ipcRenderer.invoke("session:get-all", game),
    getById: (game: "poe1" | "poe2", sessionId: string) =>
      ipcRenderer.invoke("session:get-by-id", game, sessionId),
    updateCardPriceVisibility: (
      game: "poe1" | "poe2",
      sessionId: string,
      priceSource: "exchange" | "stash",
      cardName: string,
      hidePrice: boolean,
    ) =>
      ipcRenderer.invoke(
        "session:update-card-price-visibility",
        game,
        sessionId,
        priceSource,
        cardName,
        hidePrice,
      ),
    onStateChanged: (
      callback: (data: {
        game: string;
        isActive: boolean;
        sessionInfo: any;
      }) => void,
    ) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on("session:state-changed", handler);
      return () => ipcRenderer.removeListener("session:state-changed", handler);
    },
    onDataUpdated: (callback: (data: { game: string; data: any }) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on("session:data-updated", handler);
      return () => ipcRenderer.removeListener("session:data-updated", handler);
    },
  },

  app: MainWindowAPI,
  poeProcess: PoeProcessAPI,
  dataStore: DataStoreAPI,
  poeNinja: PoeNinjaAPI,
  poeLeagues: PoeLeaguesAPI,
  settings: SettingsStoreAPI,
});
