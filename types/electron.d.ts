import type { DataStoreAPI } from "../electron/modules/data-store";
import type { MainWindowAPI } from "../electron/modules/main-window";
import type { PoeLeaguesAPI } from "../electron/modules/poe-leagues";
import type { PoeNinjaAPI } from "../electron/modules/poe-ninja";
import type { PoeProcessAPI } from "../electron/modules/poe-process";
import type {
  DivinationCardStats,
  SettingsStoreAPI,
} from "../electron/modules/settings-store";

/**
 * Divination Cards API
 * Manages divination card CSV exports
 */
export interface DivinationCardsAPI {
  exportCsv: () => Promise<{
    success: boolean;
    filePath?: string;
    canceled?: boolean;
    error?: string;
  }>;
}

export interface SessionAPI {
  start: (
    game: "poe1" | "poe2",
    league: string,
  ) => Promise<{ success: boolean; error?: string }>;
  stop: (
    game: "poe1" | "poe2",
  ) => Promise<{ success: boolean; error?: string }>;
  isActive: (game: "poe1" | "poe2") => Promise<boolean>;
  getCurrent: (game: "poe1" | "poe2") => Promise<DivinationCardStats | null>;
  getInfo: (
    game: "poe1" | "poe2",
  ) => Promise<{ league: string; startedAt: string } | null>;
  getAll: (game: "poe1" | "poe2") => Promise<any>;
  getById: (game: "poe1" | "poe2", sessionId: string) => Promise<any>;
  updateCardPriceVisibility: (
    game: "poe1" | "poe2",
    sessionId: string,
    priceSource: "exchange" | "stash",
    cardName: string,
    hidePrice: boolean,
  ) => Promise<void>;
  onStateChanged: (
    callback: (data: {
      game: string;
      isActive: boolean;
      sessionInfo: any;
    }) => void,
  ) => () => void;
  onDataUpdated: (
    callback: (data: {
      game: string;
      data: DivinationCardStats | null;
    }) => void,
  ) => () => void;
}

/**
 * Client.txt Paths API
 * Manages paths to PoE client.txt files
 */
export interface ClientTxtPathsAPI {
  get: () => Promise<{ poe1?: string; poe2?: string }>;
  set: (paths: { poe1?: string; poe2?: string }) => Promise<void>;
}

/**
 * Main Electron API exposed to renderer process
 */
export type ElectronAPI = {
  app: typeof MainWindowAPI;
  settings: typeof SettingsStoreAPI;
  divinationCards: DivinationCardsAPI;
  session: SessionAPI;
  poeNinja: typeof PoeNinjaAPI;
  poeLeagues: typeof PoeLeaguesAPI;
  clientTxtPaths: ClientTxtPathsAPI;
  dataStore: typeof DataStoreAPI;
  poeProcess: typeof PoeProcessAPI;
  selectFile: (options: any) => Promise<string | null>;
};

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
