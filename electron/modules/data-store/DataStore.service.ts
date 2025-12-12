import { ipcMain } from "electron";
import type { GameType, GlobalStats } from "../../../types/data-stores";
import { DatabaseService } from "../database/Database.service";
import { PerformanceLoggerService } from "../performance-logger/PerformanceLogger.service";
import { DataStoreChannel } from "./DataStore.channels";
import type { SimpleDivinationCardStats } from "./DataStore.schemas";

/**
 * SQLite-based DataStore service
 * Replaces electron-store with better-sqlite3 for improved performance
 */
class DataStoreService {
  private static _instance: DataStoreService;
  private db: DatabaseService;
  private perfLogger: PerformanceLoggerService;

  // Prepared statements for performance
  private statements: {
    getGlobalStat: ReturnType<
      typeof DatabaseService.prototype.getDb
    >["prepare"];
    updateGlobalStat: ReturnType<
      typeof DatabaseService.prototype.getDb
    >["prepare"];
    getCard: ReturnType<typeof DatabaseService.prototype.getDb>["prepare"];
    upsertCard: ReturnType<typeof DatabaseService.prototype.getDb>["prepare"];
    getAllCards: ReturnType<typeof DatabaseService.prototype.getDb>["prepare"];
    getTotalCount: ReturnType<
      typeof DatabaseService.prototype.getDb
    >["prepare"];
    resetCards: ReturnType<typeof DatabaseService.prototype.getDb>["prepare"];
  };

  static getInstance(): DataStoreService {
    if (!DataStoreService._instance) {
      DataStoreService._instance = new DataStoreService();
    }
    return DataStoreService._instance;
  }

  constructor() {
    this.db = DatabaseService.getInstance();
    this.perfLogger = PerformanceLoggerService.getInstance();

    // Prepare statements for better performance
    const dbInstance = this.db.getDb();

    this.statements = {
      getGlobalStat: dbInstance.prepare(
        "SELECT value FROM global_stats WHERE key = ?",
      ),
      updateGlobalStat: dbInstance.prepare(
        "UPDATE global_stats SET value = value + ? WHERE key = ?",
      ),
      getCard: dbInstance.prepare(
        "SELECT count FROM cards WHERE game = ? AND scope = ? AND card_name = ?",
      ),
      upsertCard: dbInstance.prepare(`
        INSERT INTO cards (game, scope, card_name, count, last_updated)
        VALUES (?, ?, ?, 1, ?)
        ON CONFLICT(game, scope, card_name)
        DO UPDATE SET
          count = count + 1,
          last_updated = ?
      `),
      getAllCards: dbInstance.prepare(
        "SELECT card_name, count FROM cards WHERE game = ? AND scope = ?",
      ),
      getTotalCount: dbInstance.prepare(
        "SELECT COALESCE(SUM(count), 0) as total FROM cards WHERE game = ? AND scope = ?",
      ),
      resetCards: dbInstance.prepare(
        "DELETE FROM cards WHERE game = ? AND scope = ?",
      ),
    };

    this.setupHandlers();
  }

  /**
   * Setup IPC handlers for data access from renderer
   */
  private setupHandlers(): void {
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
   * Add a card to all relevant stores (cascading update)
   */
  public addCard(game: GameType, league: string, cardName: string): void {
    const perf = this.perfLogger.startTimers();

    // Execute all updates in a single transaction
    this.db.transaction(() => {
      const now = new Date().toISOString();

      // 1. Update global stats
      perf?.start("global");
      this.statements.updateGlobalStat.run(1, "totalStackedDecksOpened");
      const globalTime = perf?.end("global") ?? 0;

      // 2. Update all-time stats
      perf?.start("allTime");
      this.statements.upsertCard.run(game, "all-time", cardName, now, now);
      const allTimeTime = perf?.end("allTime") ?? 0;

      // 3. Update league stats
      perf?.start("league");
      this.statements.upsertCard.run(game, league, cardName, now, now);
      const leagueTime = perf?.end("league") ?? 0;

      this.perfLogger.log("Cascade stores (SQLite)", {
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
  public getGlobalStats(): GlobalStats {
    const result = this.statements.getGlobalStat.get(
      "totalStackedDecksOpened",
    ) as { value: number } | undefined;

    return {
      totalStackedDecksOpened: result?.value ?? 0,
    };
  }

  /**
   * Get all-time stats for a game
   */
  public getAllTimeStats(game: GameType): SimpleDivinationCardStats {
    return this.getStatsForScope(game, "all-time");
  }

  /**
   * Get league stats for a game
   */
  public getLeagueStats(
    game: GameType,
    league: string,
  ): SimpleDivinationCardStats {
    return this.getStatsForScope(game, league);
  }

  /**
   * Helper to get stats for a specific scope
   */
  private getStatsForScope(
    game: GameType,
    scope: string,
  ): SimpleDivinationCardStats {
    // Get all cards for this scope
    const cards = this.statements.getAllCards.all(game, scope) as Array<{
      card_name: string;
      count: number;
    }>;

    // Get total count
    const totalResult = this.statements.getTotalCount.get(game, scope) as {
      total: number;
    };

    // Get last updated timestamp
    const lastUpdatedResult = this.db
      .getDb()
      .prepare(
        "SELECT last_updated FROM cards WHERE game = ? AND scope = ? ORDER BY last_updated DESC LIMIT 1",
      )
      .get(game, scope) as { last_updated: string } | undefined;

    // Build the cards object
    const cardsObj: Record<string, { count: number }> = {};
    for (const card of cards) {
      cardsObj[card.card_name] = { count: card.count };
    }

    return {
      totalCount: totalResult.total,
      cards: cardsObj,
      lastUpdated: lastUpdatedResult?.last_updated,
    };
  }

  /**
   * Reset all-time stats for a game
   */
  public resetAllTimeStats(game: GameType): void {
    this.statements.resetCards.run(game, "all-time");
  }

  /**
   * Reset league stats
   */
  public resetLeagueStats(game: GameType, league: string): void {
    this.statements.resetCards.run(game, league);
  }

  /**
   * Reset global stats
   */
  public resetGlobalStats(): void {
    this.db
      .getDb()
      .prepare(
        "UPDATE global_stats SET value = 0 WHERE key = 'totalStackedDecksOpened'",
      )
      .run();
  }

  /**
   * Get all available leagues for a game
   */
  public getAvailableLeagues(game: GameType): string[] {
    const result = this.db
      .getDb()
      .prepare(
        "SELECT DISTINCT scope FROM cards WHERE game = ? AND scope != 'all-time' ORDER BY scope",
      )
      .all(game) as Array<{ scope: string }>;

    return result.map((row) => row.scope);
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
