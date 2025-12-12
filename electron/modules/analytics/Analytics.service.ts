import { ipcMain } from "electron";
import { DatabaseService } from "../database/Database.service";
import { AnalyticsChannel } from "./Analytics.channels";

interface CardStatistic {
  cardName: string;
  count: number;
  percentage: number;
}

interface CardPriceHistory {
  cardName: string;
  timestamp: string;
  chaosValue: number;
  divineValue: number;
  daysIntoLeague: number;
}

interface CardPricePeak {
  cardName: string;
  maxChaosValue: number;
  maxDivineValue: number;
  peakTimestamp: string;
  daysIntoLeague: number;
}

interface LeagueAnalytics {
  leagueName: string;
  totalCards: number;
  uniqueCards: number;
  mostCommon: CardStatistic[];
  highestValue: CardPricePeak[];
  sessionCount: number;
}

/**
 * Analytics service for advanced data analysis
 * Enables league-wide analytics, price history, session comparisons
 */
class AnalyticsService {
  private static _instance: AnalyticsService;
  private db: DatabaseService;

  static getInstance(): AnalyticsService {
    if (!AnalyticsService._instance) {
      AnalyticsService._instance = new AnalyticsService();
    }
    return AnalyticsService._instance;
  }

  constructor() {
    this.db = DatabaseService.getInstance();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    ipcMain.handle(
      AnalyticsChannel.GetMostCommonCards,
      (_event, game: string, league: string, limit: number) => {
        return this.getMostCommonCards(game, league, limit);
      },
    );

    ipcMain.handle(
      AnalyticsChannel.GetHighestValueCards,
      (
        _event,
        game: string,
        league: string,
        priceSource: string,
        limit: number,
      ) => {
        return this.getHighestValueCards(
          game,
          league,
          priceSource as "exchange" | "stash",
          limit,
        );
      },
    );

    ipcMain.handle(
      AnalyticsChannel.GetCardPriceHistory,
      (
        _event,
        game: string,
        league: string,
        cardName: string,
        priceSource: string,
      ) => {
        return this.getCardPriceHistory(
          game,
          league,
          cardName,
          priceSource as "exchange" | "stash",
        );
      },
    );

    ipcMain.handle(
      AnalyticsChannel.GetLeagueAnalytics,
      (_event, game: string, league: string) => {
        return this.getLeagueAnalytics(game, league);
      },
    );

    ipcMain.handle(
      AnalyticsChannel.CompareSessions,
      (_event, sessionId1: string, sessionId2: string) => {
        return this.compareSessions(sessionId1, sessionId2);
      },
    );

    ipcMain.handle(
      AnalyticsChannel.GetOccurrenceRatios,
      (_event, game: string, league: string) => {
        return this.getOccurrenceRatios(game, league);
      },
    );
  }

  /**
   * Get most common cards in a league
   */
  public getMostCommonCards(
    game: string,
    leagueName: string,
    limit = 10,
  ): CardStatistic[] {
    const dbInstance = this.db.getDb();

    const results = dbInstance
      .prepare(
        `SELECT
          card_name as cardName,
          count,
          CAST(count AS REAL) / (SELECT SUM(count) FROM cards WHERE game = ? AND scope = ?) * 100 as percentage
         FROM cards
         WHERE game = ? AND scope = ?
         ORDER BY count DESC
         LIMIT ?`,
      )
      .all(game, leagueName, game, leagueName, limit) as CardStatistic[];

    return results;
  }

  /**
   * Get highest value cards in a league (peak prices)
   */
  public getHighestValueCards(
    game: string,
    leagueName: string,
    priceSource: "exchange" | "stash" = "exchange",
    limit = 10,
  ): CardPricePeak[] {
    const dbInstance = this.db.getDb();

    const results = dbInstance
      .prepare(
        `SELECT
          scp.card_name as cardName,
          MAX(scp.chaos_value) as maxChaosValue,
          MAX(scp.divine_value) as maxDivineValue,
          s.fetched_at as peakTimestamp,
          CAST(julianday(s.fetched_at) - julianday(l.start_date) AS INTEGER) as daysIntoLeague
         FROM snapshot_card_prices scp
         JOIN snapshots s ON scp.snapshot_id = s.id
         JOIN leagues l ON s.league_id = l.id
         WHERE l.game = ?
           AND l.name = ?
           AND scp.price_source = ?
         GROUP BY scp.card_name
         ORDER BY maxChaosValue DESC
         LIMIT ?`,
      )
      .all(game, leagueName, priceSource, limit) as CardPricePeak[];

    return results;
  }

  /**
   * Get price history for a specific card
   */
  public getCardPriceHistory(
    game: string,
    leagueName: string,
    cardName: string,
    priceSource: "exchange" | "stash" = "exchange",
  ): CardPriceHistory[] {
    const dbInstance = this.db.getDb();

    const results = dbInstance
      .prepare(
        `SELECT
          scp.card_name as cardName,
          s.fetched_at as timestamp,
          scp.chaos_value as chaosValue,
          scp.divine_value as divineValue,
          CAST(julianday(s.fetched_at) - julianday(l.start_date) AS INTEGER) as daysIntoLeague
         FROM snapshot_card_prices scp
         JOIN snapshots s ON scp.snapshot_id = s.id
         JOIN leagues l ON s.league_id = l.id
         WHERE l.game = ?
           AND l.name = ?
           AND scp.card_name = ?
           AND scp.price_source = ?
         ORDER BY s.fetched_at ASC`,
      )
      .all(game, leagueName, cardName, priceSource) as CardPriceHistory[];

    return results;
  }

  /**
   * Get comprehensive league analytics
   */
  public getLeagueAnalytics(game: string, leagueName: string): LeagueAnalytics {
    const dbInstance = this.db.getDb();

    // Total cards and unique cards
    const stats = dbInstance
      .prepare(
        `SELECT
          SUM(count) as totalCards,
          COUNT(DISTINCT card_name) as uniqueCards
         FROM cards
         WHERE game = ? AND scope = ?`,
      )
      .get(game, leagueName) as
      | { totalCards: number; uniqueCards: number }
      | undefined;

    // Session count
    const sessionCount = dbInstance
      .prepare(
        `SELECT COUNT(*) as count
         FROM sessions s
         JOIN leagues l ON s.league_id = l.id
         WHERE l.game = ? AND l.name = ?`,
      )
      .get(game, leagueName) as { count: number } | undefined;

    return {
      leagueName,
      totalCards: stats?.totalCards || 0,
      uniqueCards: stats?.uniqueCards || 0,
      mostCommon: this.getMostCommonCards(game, leagueName, 10),
      highestValue: this.getHighestValueCards(game, leagueName, "exchange", 10),
      sessionCount: sessionCount?.count || 0,
    };
  }

  /**
   * Compare two sessions
   */
  public compareSessions(sessionId1: string, sessionId2: string) {
    const dbInstance = this.db.getDb();

    const comparison = dbInstance
      .prepare(
        `SELECT
          COALESCE(s1.card_name, s2.card_name) as cardName,
          COALESCE(s1.count, 0) as session1Count,
          COALESCE(s2.count, 0) as session2Count,
          (COALESCE(s2.count, 0) - COALESCE(s1.count, 0)) as difference
         FROM session_cards s1
         FULL OUTER JOIN session_cards s2
           ON s1.card_name = s2.card_name
         WHERE (s1.session_id = ? OR s1.session_id IS NULL)
           AND (s2.session_id = ? OR s2.session_id IS NULL)
         ORDER BY ABS(COALESCE(s2.count, 0) - COALESCE(s1.count, 0)) DESC`,
      )
      .all(sessionId1, sessionId2);

    return comparison;
  }

  /**
   * Get occurrence ratio for all cards in a league
   */
  public getOccurrenceRatios(game: string, leagueName: string) {
    const dbInstance = this.db.getDb();

    const results = dbInstance
      .prepare(
        `SELECT
          card_name as cardName,
          count,
          CAST(count AS REAL) / (SELECT SUM(count) FROM cards WHERE game = ? AND scope = ?) as ratio,
          CAST(count AS REAL) / (SELECT SUM(count) FROM cards WHERE game = ? AND scope = ?) * 100 as percentage
         FROM cards
         WHERE game = ? AND scope = ?
         ORDER BY count DESC`,
      )
      .all(game, leagueName, game, leagueName, game, leagueName);

    return results;
  }
}

export { AnalyticsService };
