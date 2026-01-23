import { ipcMain } from "electron";

import { DatabaseService } from "~/electron/modules/database";
import { PerformanceLoggerService } from "~/electron/modules/performance-logger";

import type { GameType, GlobalStats } from "../../../types/data-stores";
import { DataStoreChannel } from "./DataStore.channels";
import { DataStoreRepository } from "./DataStore.repository";
import type { SimpleDivinationCardStats } from "./DataStore.schemas";

/**
 * SQLite-based DataStore service - Refactored with Kysely
 * Manages all-time and league statistics
 */
class DataStoreService {
  private static _instance: DataStoreService;
  private repository: DataStoreRepository;
  private perfLogger: PerformanceLoggerService;

  static getInstance(): DataStoreService {
    if (!DataStoreService._instance) {
      DataStoreService._instance = new DataStoreService();
    }
    return DataStoreService._instance;
  }

  constructor() {
    const db = DatabaseService.getInstance();
    this.repository = new DataStoreRepository(db.getKysely());
    this.perfLogger = PerformanceLoggerService.getInstance();

    this.setupHandlers();
  }

  /**
   * Setup IPC handlers for data access from renderer
   */
  private setupHandlers(): void {
    // Get all-time stats
    ipcMain.handle(
      DataStoreChannel.GetAllTimeStats,
      async (_event, game: GameType) => {
        return this.getAllTimeStats(game);
      },
    );

    // Get league stats
    ipcMain.handle(
      DataStoreChannel.GetLeagueStats,
      async (_event, game: GameType, league: string) => {
        return this.getLeagueStats(game, league);
      },
    );

    // Get available leagues
    ipcMain.handle("data-store:get-leagues", async (_event, game: GameType) => {
      return this.getAvailableLeagues(game);
    });

    // Get global stats
    ipcMain.handle("data-store:get-global", async () => {
      return this.getGlobalStats();
    });
  }

  /**
   * Add a card to all relevant stores (cascading update)
   */
  public async addCard(
    game: GameType,
    league: string,
    cardName: string,
  ): Promise<void> {
    const perf = this.perfLogger.startTimers();
    const now = new Date().toISOString();

    // Execute all updates in a single transaction
    await this.repository.kysely.transaction().execute(async (trx) => {
      const repo = new DataStoreRepository(trx);

      // 1. Update global stats
      perf?.start("global");
      await repo.incrementGlobalStat("totalStackedDecksOpened", 1);
      const globalTime = perf?.end("global") ?? 0;

      // 2. Update all-time stats
      perf?.start("allTime");
      await repo.upsertCard({
        game,
        scope: "all-time",
        cardName,
        timestamp: now,
      });
      const allTimeTime = perf?.end("allTime") ?? 0;

      // 3. Update league stats
      perf?.start("league");
      await repo.upsertCard({
        game,
        scope: league,
        cardName,
        timestamp: now,
      });
      const leagueTime = perf?.end("league") ?? 0;

      this.perfLogger.log("Cascade stores (Kysely)", {
        Global: globalTime,
        AllTime: allTimeTime,
        League: leagueTime,
        Total: globalTime + allTimeTime + leagueTime,
      });
    });
  }

  /**
   * Get global stats
   */
  public async getGlobalStats(): Promise<GlobalStats> {
    const stat = await this.repository.getGlobalStat("totalStackedDecksOpened");

    return {
      totalStackedDecksOpened: stat?.value ?? 0,
    };
  }

  /**
   * Get all-time stats for a game
   */
  public async getAllTimeStats(
    game: GameType,
  ): Promise<SimpleDivinationCardStats> {
    return this.getStatsForScope(game, "all-time");
  }

  /**
   * Get league stats for a game
   */
  public async getLeagueStats(
    game: GameType,
    league: string,
  ): Promise<SimpleDivinationCardStats> {
    return this.getStatsForScope(game, league);
  }

  /**
   * Helper to get stats for a specific scope
   */
  private async getStatsForScope(
    game: GameType,
    scope: string,
  ): Promise<SimpleDivinationCardStats> {
    // Get all cards for this scope
    const cards = await this.repository.getCardsByScope(game, scope);

    // Get total count
    const totalCount = await this.repository.getTotalCountByScope(game, scope);

    // Get last updated timestamp
    const lastUpdated = await this.repository.getLastUpdatedByScope(
      game,
      scope,
    );

    // Build the cards object
    const cardsObj: Record<string, { count: number }> = {};
    for (const card of cards) {
      cardsObj[card.cardName] = { count: card.count };
    }

    return {
      totalCount,
      cards: cardsObj,
      lastUpdated: lastUpdated ?? undefined,
    };
  }

  /**
   * Reset all-time stats for a game
   */
  public async resetAllTimeStats(game: GameType): Promise<void> {
    await this.repository.deleteCardsByScope(game, "all-time");
  }

  /**
   * Reset league stats
   */
  public async resetLeagueStats(game: GameType, league: string): Promise<void> {
    await this.repository.deleteCardsByScope(game, league);
  }

  /**
   * Reset global stats
   */
  public async resetGlobalStats(): Promise<void> {
    await this.repository.resetGlobalStat("totalStackedDecksOpened");
  }

  /**
   * Get all available leagues for a game
   */
  public async getAvailableLeagues(game: GameType): Promise<string[]> {
    return this.repository.getAvailableLeagues(game);
  }

  /**
   * Export data for a specific scope
   */
  public async exportData(
    game: GameType,
    scope: "all-time" | string,
  ): Promise<SimpleDivinationCardStats> {
    if (scope === "all-time") {
      return this.getAllTimeStats(game);
    } else {
      return this.getLeagueStats(game, scope);
    }
  }
}

export { DataStoreService };
