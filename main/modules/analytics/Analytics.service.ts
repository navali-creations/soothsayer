import { ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";

import { AnalyticsChannel } from "./Analytics.channels";
import type {
  CardOccurrenceRatio,
  CardPriceHistory,
  CardPricePeak,
  CardStatistic,
  LeagueAnalytics,
  SessionComparison,
} from "./Analytics.mapper";
import { AnalyticsRepository } from "./Analytics.repository";

/**
 * Analytics Service - Refactored with Kysely + Repository Pattern
 * Enables league-wide analytics, price history, session comparisons
 */
class AnalyticsService {
  private static _instance: AnalyticsService;
  private repository: AnalyticsRepository;

  static getInstance(): AnalyticsService {
    if (!AnalyticsService._instance) {
      AnalyticsService._instance = new AnalyticsService();
    }
    return AnalyticsService._instance;
  }

  constructor() {
    const db = DatabaseService.getInstance();
    this.repository = new AnalyticsRepository(db.getKysely());
    this.setupHandlers();
  }

  private setupHandlers(): void {
    ipcMain.handle(
      AnalyticsChannel.GetMostCommonCards,
      async (_event, game: string, league: string, limit: number) => {
        return this.getMostCommonCards(game, league, limit);
      },
    );

    ipcMain.handle(
      AnalyticsChannel.GetHighestValueCards,
      async (
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
      async (
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
      async (_event, game: string, league: string) => {
        return this.getLeagueAnalytics(game, league);
      },
    );

    ipcMain.handle(
      AnalyticsChannel.CompareSessions,
      async (_event, sessionId1: string, sessionId2: string) => {
        return this.compareSessions(sessionId1, sessionId2);
      },
    );

    ipcMain.handle(
      AnalyticsChannel.GetOccurrenceRatios,
      async (_event, game: string, league: string) => {
        return this.getOccurrenceRatios(game, league);
      },
    );
  }

  /**
   * Get most common cards in a league
   */
  public async getMostCommonCards(
    game: string,
    leagueName: string,
    limit = 10,
  ): Promise<CardStatistic[]> {
    return this.repository.getMostCommonCards(game, leagueName, limit);
  }

  /**
   * Get highest value cards in a league (peak prices)
   */
  public async getHighestValueCards(
    game: string,
    leagueName: string,
    priceSource: "exchange" | "stash" = "exchange",
    limit = 10,
  ): Promise<CardPricePeak[]> {
    return this.repository.getHighestValueCards(
      game,
      leagueName,
      priceSource,
      limit,
    );
  }

  /**
   * Get price history for a specific card
   */
  public async getCardPriceHistory(
    game: string,
    leagueName: string,
    cardName: string,
    priceSource: "exchange" | "stash" = "exchange",
  ): Promise<CardPriceHistory[]> {
    return this.repository.getCardPriceHistory(
      game,
      leagueName,
      cardName,
      priceSource,
    );
  }

  /**
   * Get comprehensive league analytics
   */
  public async getLeagueAnalytics(
    game: string,
    leagueName: string,
  ): Promise<LeagueAnalytics> {
    const stats = await this.repository.getLeagueStats(game, leagueName);
    const sessionCount = await this.repository.getLeagueSessionCount(
      game,
      leagueName,
    );

    return {
      leagueName,
      totalCards: stats?.totalCards || 0,
      uniqueCards: stats?.uniqueCards || 0,
      mostCommon: await this.getMostCommonCards(game, leagueName, 10),
      highestValue: await this.getHighestValueCards(
        game,
        leagueName,
        "exchange",
        10,
      ),
      sessionCount,
    };
  }

  /**
   * Compare two sessions
   */
  public async compareSessions(
    sessionId1: string,
    sessionId2: string,
  ): Promise<SessionComparison[]> {
    return this.repository.compareSessions(sessionId1, sessionId2);
  }

  /**
   * Get occurrence ratio for all cards in a league
   */
  public async getOccurrenceRatios(
    game: string,
    leagueName: string,
  ): Promise<CardOccurrenceRatio[]> {
    return this.repository.getOccurrenceRatios(game, leagueName);
  }
}

export { AnalyticsService };
