import { ipcMain } from "electron";
import Store from "electron-store";
import {
  AppExitAction,
  LocalStorageEvent,
  LocalStorageKey,
  ReleaseChannel,
} from "../../enums";
import type {
  AppExitActions,
  LocalStorageKeys,
  ReleaseChannels,
} from "../../types";
import type { MainWindowEngine } from "./MainWindowEngine";

export interface CardEntry {
  count: number;
  processedIds: string[];
}

export interface DivinationCardStats {
  totalCount: number;
  cards: Record<string, CardEntry>;
  lastUpdated?: string;
}

type StoreSchema = {
  [LocalStorageKey.ReleaseChannel]: ReleaseChannels;
  [LocalStorageKey.AppExitAction]: AppExitActions;
  [LocalStorageKey.Poe1Path]: undefined | string;
  [LocalStorageKey.Poe1ClientTxtPath]: undefined | string;
  [LocalStorageKey.Poe2ClientTxtPath]: undefined | string;
  [LocalStorageKey.CollectionPath]: undefined | string;
  [LocalStorageKey.AppOpenAtLogin]: boolean;
  [LocalStorageKey.AppOpenAtLoginMinimized]: boolean;
  [LocalStorageKey.DivinationCards]: DivinationCardStats;
  [LocalStorageKey.SelectedLeague]: string;
};

const defaultLocalStorageValues: StoreSchema = {
  [LocalStorageKey.ReleaseChannel]: ReleaseChannel.Stable,
  [LocalStorageKey.AppExitAction]: AppExitAction.MinimizeToTray,
  [LocalStorageKey.Poe1Path]: undefined,
  [LocalStorageKey.Poe1ClientTxtPath]: undefined,
  [LocalStorageKey.Poe2ClientTxtPath]: undefined,
  [LocalStorageKey.CollectionPath]: undefined,
  [LocalStorageKey.AppOpenAtLogin]: false,
  [LocalStorageKey.AppOpenAtLoginMinimized]: false,
  [LocalStorageKey.DivinationCards]: {
    totalCount: 0,
    cards: {},
  },
  [LocalStorageKey.SelectedLeague]: "Standard",
};

class LocalStorageEngine {
  private static _instance: LocalStorageEngine;
  public store = new Store<StoreSchema>({
    defaults: defaultLocalStorageValues,
  });

  static getInstance() {
    if (!LocalStorageEngine._instance) {
      LocalStorageEngine._instance = new LocalStorageEngine();
    }

    return LocalStorageEngine._instance;
  }

  constructor() {
    this.loadUserSettings();
    this.emitSet();
    this.setupDivinationCardHandlers();
    this.setupLeagueHandlers();
    this.setupClientTxtPathHandlers();
    this.migrateDivinationCardsIfNeeded();
  }

  // Migrate old data format to new format
  private migrateDivinationCardsIfNeeded() {
    const existing = this.store.get(LocalStorageKey.DivinationCards);

    // Check if we have old format (cards as Record<string, number>)
    let needsMigration = false;
    for (const [cardName, value] of Object.entries(existing.cards)) {
      if (typeof value === "number") {
        needsMigration = true;
        break;
      }
    }

    if (needsMigration) {
      console.log("Migrating divination cards to new format...");
      // Reset to new format
      this.store.set(LocalStorageKey.DivinationCards, {
        totalCount: 0,
        cards: {},
        lastUpdated: new Date().toISOString(),
      });
      console.log("Migration complete - old data cleared");
    }
  }

  public listenOnAndSet(key: LocalStorageKeys, mainWindow?: MainWindowEngine) {
    ipcMain.on(key, (_event, value) => {
      this.store.set(key, value);

      mainWindow?.webContents?.send(key, this.store.get(key));
    });
  }

  public emitSet() {
    ipcMain.handle(LocalStorageEvent.SetSetting, (_event, { key, value }) => {
      this.store.set(key, value);

      return this.store.get(key);
    });
  }

  public set(key: LocalStorageKeys, value: string) {
    this.store.set(key, value);
  }

  public loadUserSettings() {
    ipcMain.handle(
      LocalStorageEvent.FetchLocalSettings,
      (_event): StoreSchema => {
        return {
          [LocalStorageKey.ReleaseChannel]: this.store.get(
            LocalStorageKey.ReleaseChannel,
          ),
          [LocalStorageKey.AppExitAction]: this.store.get(
            LocalStorageKey.AppExitAction,
          ),
          [LocalStorageKey.Poe1Path]: this.store.get(LocalStorageKey.Poe1Path),
          [LocalStorageKey.CollectionPath]: this.store.get(
            LocalStorageKey.CollectionPath,
          ),
          [LocalStorageKey.AppOpenAtLogin]: this.store.get(
            LocalStorageKey.AppOpenAtLogin,
          ),
          [LocalStorageKey.AppOpenAtLoginMinimized]: this.store.get(
            LocalStorageKey.AppOpenAtLoginMinimized,
          ),
          [LocalStorageKey.DivinationCards]: this.store.get(
            LocalStorageKey.DivinationCards,
          ),
        };
      },
    );
  }

  public get(key: keyof StoreSchema) {
    return this.store.get(key);
  }

  private setupDivinationCardHandlers() {
    // Get divination cards
    ipcMain.handle(LocalStorageEvent.GetDivinationCards, () => {
      return this.store.get(LocalStorageKey.DivinationCards);
    });

    // Reset divination cards
    ipcMain.handle(LocalStorageEvent.ResetDivinationCards, () => {
      this.store.set(LocalStorageKey.DivinationCards, {
        totalCount: 0,
        cards: {},
        lastUpdated: new Date().toISOString(),
      });
      return { success: true };
    });
  }

  // Method to merge new cards with existing stats
  public mergeCards(newCards: DivinationCardStats): DivinationCardStats {
    const existing = this.store.get(LocalStorageKey.DivinationCards);

    const mergedCards: Record<string, CardEntry> = {};

    // First, copy existing cards (ensuring they're in the right format)
    for (const [cardName, value] of Object.entries(existing.cards)) {
      if (typeof value === "object" && "processedIds" in value) {
        mergedCards[cardName] = { ...value };
      }
    }

    // Merge card counts and IDs
    for (const [cardName, newEntry] of Object.entries(newCards.cards)) {
      if (mergedCards[cardName]) {
        // Card already exists - merge
        const existingEntry = mergedCards[cardName];
        const allIds = [
          ...(existingEntry.processedIds || []),
          ...(newEntry.processedIds || []),
        ];
        const uniqueIds = Array.from(new Set(allIds));

        mergedCards[cardName] = {
          count: uniqueIds.length,
          processedIds: uniqueIds,
        };
      } else {
        // New card
        mergedCards[cardName] = {
          count: newEntry.count,
          processedIds: [...(newEntry.processedIds || [])],
        };
      }
    }

    const merged: DivinationCardStats = {
      totalCount: Object.values(mergedCards).reduce(
        (sum, entry) => sum + entry.count,
        0,
      ),
      cards: mergedCards,
      lastUpdated: new Date().toISOString(),
    };

    this.store.set(LocalStorageKey.DivinationCards, merged);
    return merged;
  }

  // Get processed IDs from all cards
  public getProcessedIds(): Set<string> {
    const stats = this.store.get(LocalStorageKey.DivinationCards);
    const allIds = new Set<string>();

    for (const cardEntry of Object.values(stats.cards)) {
      if (cardEntry.processedIds) {
        cardEntry.processedIds.forEach((id) => allIds.add(id));
      }
    }

    return allIds;
  }
  private setupLeagueHandlers() {
    // Get selected league
    ipcMain.handle(LocalStorageEvent.GetSelectedLeague, () => {
      return this.store.get(LocalStorageKey.SelectedLeague);
    });

    // Set selected league
    ipcMain.handle(
      LocalStorageEvent.SetSelectedLeague,
      (_event, league: string) => {
        this.store.set(LocalStorageKey.SelectedLeague, league);
        return { success: true, league };
      },
    );
  }
  private setupClientTxtPathHandlers() {
    // Get client txt paths
    ipcMain.handle(LocalStorageEvent.GetClientTxtPaths, () => {
      return {
        poe1: this.store.get(LocalStorageKey.Poe1ClientTxtPath),
        poe2: this.store.get(LocalStorageKey.Poe2ClientTxtPath),
      };
    });

    // Set client txt paths
    ipcMain.handle(
      LocalStorageEvent.SetClientTxtPaths,
      (_event, paths: { poe1?: string; poe2?: string }) => {
        if (paths.poe1 !== undefined) {
          this.store.set(LocalStorageKey.Poe1ClientTxtPath, paths.poe1);
        }
        if (paths.poe2 !== undefined) {
          this.store.set(LocalStorageKey.Poe2ClientTxtPath, paths.poe2);
        }
        return { success: true };
      },
    );
  }
}

export { LocalStorageEngine };
