import type {
  AppControlsAPI,
  FilePathsSectionItemType,
  IpcRendererOnEvent,
  LocalStorageKeys,
  Settings,
} from ".";
import type { PoeNinjaPriceData } from "./poe-ninja";
import type { PoeLeague } from "./poe-league";

export interface CardEntry {
  count: number;
  processedIds: string[];
}

export interface DivinationCardStats {
  totalCount: number;
  cards: Record<string, CardEntry>;
  lastUpdated?: string;
}

export interface DivinationCardsAPI {
  getStats: () => Promise<DivinationCardStats>;
  reset: () => Promise<{ success: boolean }>;
  onUpdate: (callback: (stats: DivinationCardStats) => void) => () => void; // Returns cleanup function
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
}

export interface PoeNinjaAPI {
  fetchExchangePrices: (league?: string) => Promise<PoeNinjaPriceData>;
  fetchStashPrices: (league?: string) => Promise<PoeNinjaPriceData>;
}

export interface PoeLeaguesAPI {
  fetchLeagues: () => Promise<PoeLeague[]>;
  getSelected: () => Promise<string>;
  setSelected: (
    leagueId: string,
  ) => Promise<{ success: boolean; league: string }>;
}

export interface ClientTxtPathsAPI {
  get: () => Promise<{ poe1?: string; poe2?: string }>;
  set: (paths: {
    poe1?: string;
    poe2?: string;
  }) => Promise<{ success: boolean }>;
}

export interface PoeProcessAPI {
  getState: () => Promise<any>;
  onStart: (callback: (state: any) => void) => () => void; // Returns cleanup function
  onStop: (callback: (state: any) => void) => () => void; // Returns cleanup function
  onState: (callback: (state: any) => void) => () => void; // Returns cleanup function
  onError: (callback: (error: any) => void) => () => void; // Returns cleanup function
}

export type ElectronAPI = {
  app: AppControlsAPI;
  collection: any;
  getIsPoeRunning: (listener: IpcRendererOnEvent<boolean>) => void;
  settings: {
    getSettings: () => Promise<Settings>;
    set: (
      item: FilePathsSectionItemType | LocalStorageKeys,
      value: string | boolean | null,
    ) => Promise<ReleaseChannel | AppExitAction | FilePathsSectionItemType>;
  };
  divinationCards: DivinationCardsAPI;
  session: SessionAPI;
  poeNinja: PoeNinjaAPI;
  poeLeagues: PoeLeaguesAPI;
  clientTxtPaths: ClientTxtPathsAPI;
  recordingOverlay: {
    show: () => Promise<void>;
    close: () => Promise<void>;
    isVisible: () => void;
  };
  appUpdater: {
    checkIfUpdateIsAvailable: (
      listener: IpcRendererOnEvent<UpdateAvailable>,
    ) => void;
  };
  removeListener: (listener: Listeners) => void;
  selectFile?: (options: any) => Promise<string | null>;
  saveConfig?: (config: any) => Promise<any>;
  getConfig?: () => Promise<any>;
  getConfigValue?: (key: string) => Promise<any>;
  setConfigValue?: (key: string, value: any) => Promise<any>;
  resetConfig?: () => Promise<any>;
  checkClientTxtForCode?: (filePath: string, code: string) => Promise<boolean>;
  poeProcess?: PoeProcessAPI;
};

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
