import type { Kysely } from "kysely";
import { sql } from "kysely";

import type { Database } from "~/main/modules/database";

import type {
  CardOccurrenceRatioDTO,
  CardPriceHistoryDTO,
  CardPricePeakDTO,
  CardStatisticDTO,
  LeagueStatsDTO,
  SessionComparisonDTO,
} from "./Analytics.dto";

/**
 * Analytics Repository
 * Handles complex analytical queries using Kysely
 */
export class AnalyticsRepository {
  constructor(private kysely: Kysely<Database>) {}

  // ============================================================================
  // Card Statistics Queries
  // ============================================================================

  /**
   * Get most common cards in a league with percentage calculations
   */
  async getMostCommonCards(
    game: string,
    leagueName: string,
    limit: number,
  ): Promise<CardStatisticDTO[]> {
    // Subquery for total count
    const totalCountSubquery = this.kysely
      .selectFrom("cards")
      .select(({ fn }) => fn.sum<number>("count").as("total"))
      .where("game", "=", game)
      .where("scope", "=", leagueName);

    const results = await this.kysely
      .selectFrom("cards")
      .select([
        "card_name as cardName",
        "count",
        sql<number>`CAST(count AS REAL) / (${totalCountSubquery}) * 100`.as(
          "percentage",
        ),
      ])
      .where("game", "=", game)
      .where("scope", "=", leagueName)
      .orderBy("count", "desc")
      .limit(limit)
      .execute();

    return results;
  }

  /**
   * Get highest value cards by peak prices
   */
  async getHighestValueCards(
    game: string,
    leagueName: string,
    priceSource: "exchange" | "stash",
    limit: number,
  ): Promise<CardPricePeakDTO[]> {
    const results = await this.kysely
      .selectFrom("snapshot_card_prices as scp")
      .innerJoin("snapshots as s", "scp.snapshot_id", "s.id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .select(({ fn }) => [
        "scp.card_name as cardName",
        fn.max("scp.chaos_value").as("maxChaosValue"),
        fn.max("scp.divine_value").as("maxDivineValue"),
        "s.fetched_at as peakTimestamp",
        sql<number>`CAST(julianday(s.fetched_at) - julianday(l.start_date) AS INTEGER)`.as(
          "daysIntoLeague",
        ),
      ])
      .where("l.game", "=", game)
      .where("l.name", "=", leagueName)
      .where("scp.price_source", "=", priceSource)
      .groupBy("scp.card_name")
      .orderBy("maxChaosValue", "desc")
      .limit(limit)
      .execute();

    return results;
  }

  /**
   * Get price history for a specific card
   */
  async getCardPriceHistory(
    game: string,
    leagueName: string,
    cardName: string,
    priceSource: "exchange" | "stash",
  ): Promise<CardPriceHistoryDTO[]> {
    const results = await this.kysely
      .selectFrom("snapshot_card_prices as scp")
      .innerJoin("snapshots as s", "scp.snapshot_id", "s.id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .select([
        "scp.card_name as cardName",
        "s.fetched_at as timestamp",
        "scp.chaos_value as chaosValue",
        "scp.divine_value as divineValue",
        sql<number>`CAST(julianday(s.fetched_at) - julianday(l.start_date) AS INTEGER)`.as(
          "daysIntoLeague",
        ),
      ])
      .where("l.game", "=", game)
      .where("l.name", "=", leagueName)
      .where("scp.card_name", "=", cardName)
      .where("scp.price_source", "=", priceSource)
      .orderBy("s.fetched_at", "asc")
      .execute();

    return results;
  }

  // ============================================================================
  // League Analytics Queries
  // ============================================================================

  /**
   * Get league-wide card statistics
   */
  async getLeagueStats(
    game: string,
    leagueName: string,
  ): Promise<LeagueStatsDTO | null> {
    const result = await this.kysely
      .selectFrom("cards")
      .select(({ fn }) => [
        fn.sum<number>("count").as("totalCards"),
        fn.countAll<number>().as("uniqueCards"),
      ])
      .where("game", "=", game)
      .where("scope", "=", leagueName)
      .executeTakeFirst();

    return result || null;
  }

  /**
   * Get session count for a league
   */
  async getLeagueSessionCount(
    game: string,
    leagueName: string,
  ): Promise<number> {
    const result = await this.kysely
      .selectFrom("sessions as s")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .select(({ fn }) => fn.countAll<number>().as("count"))
      .where("l.game", "=", game)
      .where("l.name", "=", leagueName)
      .executeTakeFirst();

    return result?.count || 0;
  }

  // ============================================================================
  // Session Comparison Queries
  // ============================================================================

  /**
   * Compare cards between two sessions
   * Note: SQLite doesn't support FULL OUTER JOIN directly,
   * so we'll use a UNION approach
   */
  async compareSessions(
    sessionId1: string,
    sessionId2: string,
  ): Promise<SessionComparisonDTO[]> {
    // Get all unique card names from both sessions
    const cardNames = await this.kysely
      .selectFrom("session_cards")
      .select("card_name")
      .where("session_id", "in", [sessionId1, sessionId2])
      .distinct()
      .execute();

    // For each card, get counts from both sessions
    const results: SessionComparisonDTO[] = [];

    for (const { card_name } of cardNames) {
      const session1Card = await this.kysely
        .selectFrom("session_cards")
        .select("count")
        .where("session_id", "=", sessionId1)
        .where("card_name", "=", card_name)
        .executeTakeFirst();

      const session2Card = await this.kysely
        .selectFrom("session_cards")
        .select("count")
        .where("session_id", "=", sessionId2)
        .where("card_name", "=", card_name)
        .executeTakeFirst();

      const session1Count = session1Card?.count || 0;
      const session2Count = session2Card?.count || 0;

      results.push({
        cardName: card_name,
        session1Count,
        session2Count,
        difference: session2Count - session1Count,
      });
    }

    // Sort by absolute difference descending
    return results.sort(
      (a, b) => Math.abs(b.difference) - Math.abs(a.difference),
    );
  }

  // ============================================================================
  // Occurrence Ratio Queries
  // ============================================================================

  /**
   * Get occurrence ratios for all cards in a league
   */
  async getOccurrenceRatios(
    game: string,
    leagueName: string,
  ): Promise<CardOccurrenceRatioDTO[]> {
    // Subquery for total count
    const totalCountSubquery = this.kysely
      .selectFrom("cards")
      .select(({ fn }) => fn.sum<number>("count").as("total"))
      .where("game", "=", game)
      .where("scope", "=", leagueName);

    const results = await this.kysely
      .selectFrom("cards")
      .select([
        "card_name as cardName",
        "count",
        sql<number>`CAST(count AS REAL) / (${totalCountSubquery})`.as("ratio"),
        sql<number>`CAST(count AS REAL) / (${totalCountSubquery}) * 100`.as(
          "percentage",
        ),
      ])
      .where("game", "=", game)
      .where("scope", "=", leagueName)
      .orderBy("count", "desc")
      .execute();

    return results;
  }
}
