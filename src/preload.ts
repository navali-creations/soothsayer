import { contextBridge, ipcRenderer } from "electron";
import { LocalStorageEvent, MainWindowEvent } from "../enums";

contextBridge.exposeInMainWorld("electron", {
  // App Controls API
  app: {
    minimize: () => ipcRenderer.invoke(MainWindowEvent.HandleWindowMinimize),
    maximize: () => ipcRenderer.invoke(MainWindowEvent.HandleWindowMaximize),
    unmaximize: () =>
      ipcRenderer.invoke(MainWindowEvent.HandleWindowUnmaximize),
    isMaximized: () => ipcRenderer.invoke(MainWindowEvent.IsWindowMaximized),
    close: () => ipcRenderer.invoke(MainWindowEvent.HandleWindowClose),
  },

  // Settings API
  settings: {
    getSettings: () => ipcRenderer.invoke(LocalStorageEvent.FetchLocalSettings),
    set: (key: string, value: any) =>
      ipcRenderer.invoke(LocalStorageEvent.SetSetting, { key, value }),
  },

  // PoE Process API
  poeProcess: {
    getState: () => ipcRenderer.invoke("is-poe-running"),
    onStart: (callback: (state: any) => void) => {
      ipcRenderer.on("poe-process-start", (_event, state) => callback(state));
    },
    onStop: (callback: (state: any) => void) => {
      ipcRenderer.on("poe-process-stop", (_event, state) => callback(state));
    },
    onState: (callback: (state: any) => void) => {
      ipcRenderer.on("poe-process-state", (_event, state) => callback(state));
    },
    onError: (callback: (error: any) => void) => {
      ipcRenderer.on("poe-process-error", (_event, error) => callback(error));
    },
  },

  // File & Config API (for setup page)
  selectFile: (options: any) => ipcRenderer.invoke("select-file", options),
  saveConfig: (config: any) => ipcRenderer.invoke("save-config", config),
  getConfig: () => ipcRenderer.invoke("get-config"),
  getConfigValue: (key: string) => ipcRenderer.invoke("get-config-value", key),
  setConfigValue: (key: string, value: any) =>
    ipcRenderer.invoke("set-config-value", key, value),
  resetConfig: () => ipcRenderer.invoke("reset-config"),
  checkClientTxtForCode: (filePath: string, code: string) =>
    ipcRenderer.invoke("check-client-txt-for-code", filePath, code),

  clientTxtPaths: {
    get: () => ipcRenderer.invoke(LocalStorageEvent.GetClientTxtPaths),
    set: (paths: { poe1?: string; poe2?: string }) =>
      ipcRenderer.invoke(LocalStorageEvent.SetClientTxtPaths, paths),
  },

  divinationCards: {
    getStats: () => ipcRenderer.invoke(LocalStorageEvent.GetDivinationCards),
    reset: () => ipcRenderer.invoke(LocalStorageEvent.ResetDivinationCards),
    onUpdate: (callback: (stats: any) => void) => {
      const handler = (_event: any, stats: any) => callback(stats);
      ipcRenderer.on("divination-cards-update", handler);
      // Return cleanup function
      return () =>
        ipcRenderer.removeListener("divination-cards-update", handler);
    },
    exportCsv: () => ipcRenderer.invoke("export-divination-cards-csv"),
  },

  dataStore: {
    getAllTime: (game: "poe1" | "poe2") =>
      ipcRenderer.invoke("data-store:get-all-time", game),
    getLeague: (game: "poe1" | "poe2", league: string) =>
      ipcRenderer.invoke("data-store:get-league", game, league),
    getLeagues: (game: "poe1" | "poe2") =>
      ipcRenderer.invoke("data-store:get-leagues", game),
    getGlobal: () => ipcRenderer.invoke("data-store:get-global"),
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
  },

  poeNinja: {
    fetchExchangePrices: (league: string = "Keepers") =>
      ipcRenderer.invoke("poe-ninja:fetch-exchange-prices", league),
    fetchStashPrices: (league: string = "Keepers") =>
      ipcRenderer.invoke("poe-ninja:fetch-stash-prices", league),
  },

  poeLeagues: {
    fetchLeagues: () => ipcRenderer.invoke("poe-leagues:fetch-leagues"),
    getSelected: () => ipcRenderer.invoke("poe-leagues:get-selected"),
    setSelected: (leagueId: string) =>
      ipcRenderer.invoke("poe-leagues:set-selected", leagueId),
  },
});
