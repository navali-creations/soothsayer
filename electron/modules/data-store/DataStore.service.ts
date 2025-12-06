import { ipcMain } from "electron";
import Store from "electron-store";
import type { GameType, GlobalStats } from "../../../types/data-stores";
import { PerformanceLoggerService } from "../../modules";
import { DataStoreChannel } from "./DataStore.channels";
import type { SimpleDivinationCardStats } from "./DataStore.schemas";

class DataStoreService {
  private static _instance: DataStoreService;
  private perfLogger: PerformanceLoggerService;

  // Store instances
  private globalStore: Store<GlobalStats>;
  private poe1AllTimeStore: Store<SimpleDivinationCardStats>;
  private poe2AllTimeStore: Store<SimpleDivinationCardStats>;
  private poe1LeagueStores: Map<string, Store<SimpleDivinationCardStats>>;
  private poe2LeagueStores: Map<string, Store<SimpleDivinationCardStats>>;

  static getInstance() {
    if (!DataStoreService._instance) {
      DataStoreService._instance = new DataStoreService();
    }

    return DataStoreService._instance;
  }

  constructor() {
    this.perfLogger = PerformanceLoggerService.getInstance();

    // Initialize global stats store
    this.globalStore = new Store<GlobalStats>({
      name: "global-stats",
      defaults: {
        totalStackedDecksOpened: 0,
      },
    });

    // Initialize PoE 1 all-time store
    this.poe1AllTimeStore = new Store<SimpleDivinationCardStats>({
      name: "poe1-data/all-time",
      defaults: {
        totalCount: 0,
        cards: {},
      },
    });

    // Initialize PoE 2 all-time store
    this.poe2AllTimeStore = new Store<SimpleDivinationCardStats>({
      name: "poe2-data/all-time",
      defaults: {
        totalCount: 0,
        cards: {},
      },
    });

    // Initialize league store maps
    this.poe1LeagueStores = new Map();
    this.poe2LeagueStores = new Map();

    this.setupHandlers();
  }

  /**
   * Setup IPC handlers for data access from renderer
   */
  private setupHandlers() {
    // Get all-time stats
    ipcMain.handle(
      DataStoreChannel.GetAllTimeStats,
      (_event, game: GameType) => {
        return this.getAllTimeStats(game);
      },
    );

    // Get league stats
    ipcMain.handle(
      DataStoreChannel.GetLeagueStats,
      (_event, game: GameType, league: string) => {
        return this.getLeagueStats(game, league);
      },
    );

    // Get available leagues
    ipcMain.handle("data-store:get-leagues", (_event, game: GameType) => {
      return this.getAvailableLeagues(game);
    });

    // Get global stats
    ipcMain.handle("data-store:get-global", () => {
      return this.getGlobalStats();
    });
  }

  /**
   * Get or create a league-specific store
   */
  private getLeagueStore(
    game: GameType,
    league: string,
  ): Store<SimpleDivinationCardStats> {
    const storeMap =
      game === "poe1" ? this.poe1LeagueStores : this.poe2LeagueStores;

    if (!storeMap.has(league)) {
      const store = new Store<SimpleDivinationCardStats>({
        name: `${game}-data/${league}`,
        defaults: {
          totalCount: 0,
          cards: {},
        },
      });
      storeMap.set(league, store);
    }

    return storeMap.get(league)!;
  }

  /**
   * Add a card to all relevant stores (cascading update)
   */
  public addCard(game: GameType, league: string, cardName: string): void {
    const perf = this.perfLogger.startTimers();

    // 1. Update global stats (single atomic write)
    perf?.start("global");
    const globalStats = this.globalStore.store;
    this.globalStore.store = {
      totalStackedDecksOpened: globalStats.totalStackedDecksOpened + 1,
    };
    const globalTime = perf?.end("global") ?? 0;

    // 2. Update all-time stats (already optimized - single atomic write)
    perf?.start("allTime");
    const allTimeStore =
      game === "poe1" ? this.poe1AllTimeStore : this.poe2AllTimeStore;
    this.incrementCardInStore(allTimeStore, cardName);
    const allTimeTime = perf?.end("allTime") ?? 0;

    // 3. Update league stats (already optimized - single atomic write)
    perf?.start("league");
    const leagueStore = this.getLeagueStore(game, league);
    this.incrementCardInStore(leagueStore, cardName);
    const leagueTime = perf?.end("league") ?? 0;

    this.perfLogger.log("Cascade stores", {
      Global: globalTime,
      AllTime: allTimeTime,
      League: leagueTime,
      Total: globalTime + allTimeTime + leagueTime,
    });
  }

  /**
   * Helper to increment a card count in a simple store
   * Already optimized - single atomic write
   */
  private incrementCardInStore(
    store: Store<SimpleDivinationCardStats>,
    cardName: string,
  ): void {
    const stats = store.store;
    const cards = { ...stats.cards };

    if (cards[cardName]) {
      cards[cardName] = { count: cards[cardName].count + 1 };
    } else {
      cards[cardName] = { count: 1 };
    }

    store.store = {
      cards,
      totalCount: stats.totalCount + 1,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get global stats
   */
  public getGlobalStats(): GlobalStats {
    return this.globalStore.store;
  }

  /**
   * Get all-time stats for a game
   */
  public getAllTimeStats(game: GameType): SimpleDivinationCardStats {
    const store =
      game === "poe1" ? this.poe1AllTimeStore : this.poe2AllTimeStore;
    return store.store;
  }

  /**
   * Get league stats for a game
   */
  public getLeagueStats(
    game: GameType,
    league: string,
  ): SimpleDivinationCardStats {
    const leagueStore = this.getLeagueStore(game, league);
    return leagueStore.store;
  }

  /**
   * Reset all-time stats for a game
   */
  public resetAllTimeStats(game: GameType): void {
    const store =
      game === "poe1" ? this.poe1AllTimeStore : this.poe2AllTimeStore;
    store.set("totalCount", 0);
    store.set("cards", {});
    store.set("lastUpdated", new Date().toISOString());
  }

  /**
   * Reset league stats
   */
  public resetLeagueStats(game: GameType, league: string): void {
    const leagueStore = this.getLeagueStore(game, league);
    leagueStore.set("totalCount", 0);
    leagueStore.set("cards", {});
    leagueStore.set("lastUpdated", new Date().toISOString());
  }

  /**
   * Reset global stats
   */
  public resetGlobalStats(): void {
    this.globalStore.set("totalStackedDecksOpened", 0);
  }

  /**
   * Get all available leagues for a game
   */
  public getAvailableLeagues(game: GameType): string[] {
    const storeMap =
      game === "poe1" ? this.poe1LeagueStores : this.poe2LeagueStores;
    return Array.from(storeMap.keys());
  }

  /**
   * Export data for a specific scope
   */
  public exportData(
    game: GameType,
    scope: "all-time" | string,
  ): SimpleDivinationCardStats {
    if (scope === "all-time") {
      return this.getAllTimeStats(game);
    } else {
      return this.getLeagueStats(game, scope);
    }
  }
}

export { DataStoreService };
