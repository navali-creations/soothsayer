import { type Kysely, sql } from "kysely";

import type { Database } from "~/main/modules/database";

import type {
  SessionCardDetailsDTO,
  SessionChartDataPointDTO,
  SessionDetailsDTO,
  SessionSummaryDTO,
} from "./Sessions.dto";
import { SessionsMapper } from "./Sessions.mapper";

/**
 * Repository for Sessions
 * Handles all database operations using Kysely
 */
export class SessionsRepository {
  constructor(private kysely: Kysely<Database>) {}

  /**
   * Get total count of sessions for a game
   */
  async getSessionCount(game: "poe1" | "poe2"): Promise<number> {
    const result = await this.kysely
      .selectFrom("sessions")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("game", "=", game)
      .executeTakeFirst();

    return result?.count ?? 0;
  }

  /**
   * Get paginated sessions for a game with calculated values
   */
  async getSessionsPage(
    game: "poe1" | "poe2",
    limit: number,
    offset: number,
  ): Promise<SessionSummaryDTO[]> {
    const rows = await this.kysely
      .selectFrom("sessions as s")
      .leftJoin("session_summaries as ss", "s.id", "ss.session_id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .leftJoin("snapshots as snap", "s.snapshot_id", "snap.id")
      .select([
        "s.id as sessionId",
        "s.game as game",
        "l.name as league",
        "s.started_at as startedAt",
        "s.ended_at as endedAt",
        "s.is_active as isActive",
        // Duration: use summary if exists, otherwise calculate
        sql<number>`
          COALESCE(
            ss.duration_minutes,
            CASE
              WHEN s.ended_at IS NOT NULL
              THEN CAST((JULIANDAY(s.ended_at) - JULIANDAY(s.started_at)) * 24 * 60 AS INTEGER)
              ELSE NULL
            END
          )
        `.as("durationMinutes"),
        // Total decks: use summary if exists, otherwise use session total_count
        sql<number>`COALESCE(ss.total_decks_opened, s.total_count)`.as(
          "totalDecksOpened",
        ),
        // Exchange value: use summary if exists, otherwise calculate from session_cards + snapshot_card_prices
        sql<number>`
          COALESCE(
            ss.total_exchange_value,
            (
              SELECT COALESCE(SUM(sc.count * scp.chaos_value), 0)
              FROM session_cards sc
              LEFT JOIN snapshot_card_prices scp
                ON scp.snapshot_id = s.snapshot_id
                AND scp.card_name = sc.card_name
                AND scp.price_source = 'exchange'
              WHERE sc.session_id = s.id
                AND sc.hide_price_exchange = 0
            )
          )
        `.as("totalExchangeValue"),
        // Stash value: use summary if exists, otherwise calculate
        sql<number>`
          COALESCE(
            ss.total_stash_value,
            (
              SELECT COALESCE(SUM(sc.count * scp.chaos_value), 0)
              FROM session_cards sc
              LEFT JOIN snapshot_card_prices scp
                ON scp.snapshot_id = s.snapshot_id
                AND scp.card_name = sc.card_name
                AND scp.price_source = 'stash'
              WHERE sc.session_id = s.id
                AND sc.hide_price_stash = 0
            )
          )
        `.as("totalStashValue"),
        // Net profit: use summary if exists, otherwise calculate (total value - deck cost * deck count)
        sql<number>`
          COALESCE(
            ss.total_exchange_net_profit,
            (
              SELECT COALESCE(SUM(sc.count * scp.chaos_value), 0)
              FROM session_cards sc
              LEFT JOIN snapshot_card_prices scp
                ON scp.snapshot_id = s.snapshot_id
                AND scp.card_name = sc.card_name
                AND scp.price_source = 'exchange'
              WHERE sc.session_id = s.id
                AND sc.hide_price_exchange = 0
            ) - COALESCE(snap.stacked_deck_chaos_cost, 0) * s.total_count
          )
        `.as("totalExchangeNetProfit"),
        sql<number>`
          COALESCE(
            ss.total_stash_net_profit,
            (
              SELECT COALESCE(SUM(sc.count * scp.chaos_value), 0)
              FROM session_cards sc
              LEFT JOIN snapshot_card_prices scp
                ON scp.snapshot_id = s.snapshot_id
                AND scp.card_name = sc.card_name
                AND scp.price_source = 'stash'
              WHERE sc.session_id = s.id
                AND sc.hide_price_stash = 0
            ) - COALESCE(snap.stacked_deck_chaos_cost, 0) * s.total_count
          )
        `.as("totalStashNetProfit"),
        // Chaos to Divine ratios from snapshot
        sql<number>`COALESCE(ss.exchange_chaos_to_divine, snap.exchange_chaos_to_divine, 0)`.as(
          "exchangeChaosToDivine",
        ),
        sql<number>`COALESCE(ss.stash_chaos_to_divine, snap.stash_chaos_to_divine, 0)`.as(
          "stashChaosToDivine",
        ),
        // Stacked deck chaos cost
        sql<number>`COALESCE(ss.stacked_deck_chaos_cost, snap.stacked_deck_chaos_cost, 0)`.as(
          "stackedDeckChaosCost",
        ),
      ])
      .where("s.game", "=", game)
      .orderBy("s.started_at", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    return rows.map(SessionsMapper.toSessionSummaryDTO);
  }

  /**
   * Get session details by ID
   */
  async getSessionById(sessionId: string): Promise<SessionDetailsDTO | null> {
    const row = await this.kysely
      .selectFrom("sessions as s")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .select([
        "s.id",
        "s.game",
        "s.league_id as leagueId",
        "l.name as league",
        "s.snapshot_id as snapshotId",
        "s.started_at as startedAt",
        "s.ended_at as endedAt",
        "s.total_count as totalCount",
        "s.is_active as isActive",
      ])
      .where("s.id", "=", sessionId)
      .executeTakeFirst();

    if (!row) return null;

    return {
      id: row.id,
      game: row.game,
      leagueId: row.leagueId,
      league: row.league,
      snapshotId: row.snapshotId,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      totalCount: row.totalCount,
      isActive: row.isActive === 1,
    };
  }

  /**
   * Get session cards by session ID with divination card metadata
   */
  async getSessionCards(sessionId: string): Promise<SessionCardDetailsDTO[]> {
    const rows = await this.kysely
      .selectFrom("session_cards as sc")
      .leftJoin("sessions as s", "sc.session_id", "s.id")
      .leftJoin("leagues as l", "s.league_id", "l.id")
      .leftJoin("divination_cards as dc", (join) =>
        join
          .onRef("dc.name", "=", "sc.card_name")
          .onRef("dc.game", "=", "s.game"),
      )
      .leftJoin("divination_card_rarities as dcr", (join) =>
        join
          .onRef("dcr.card_name", "=", "sc.card_name")
          .onRef("dcr.game", "=", "s.game")
          .onRef("dcr.league", "=", "l.name"),
      )
      .select([
        "sc.card_name as cardName",
        "sc.count",
        "sc.hide_price_exchange as hidePriceExchange",
        "sc.hide_price_stash as hidePriceStash",
        // Divination card metadata
        "dc.id as divinationCardId",
        "dc.stack_size as stackSize",
        "dc.description",
        "dc.reward_html as rewardHtml",
        "dc.art_src as artSrc",
        "dc.flavour_html as flavourHtml",
        sql<number>`COALESCE(dcr.rarity, 4)`.as("rarity"),
      ])
      .where("sc.session_id", "=", sessionId)
      .execute();

    return rows.map((row) => ({
      cardName: row.cardName,
      count: row.count,
      hidePriceExchange: row.hidePriceExchange === 1,
      hidePriceStash: row.hidePriceStash === 1,
      divinationCard: row.divinationCardId
        ? {
            id: row.divinationCardId,
            stackSize: row.stackSize,
            description: row.description,
            rewardHtml: row.rewardHtml,
            artSrc: row.artSrc,
            flavourHtml: row.flavourHtml,
            rarity: row.rarity,
          }
        : undefined,
    }));
  }

  /**
   * Search sessions by card name, with optional sorting.
   *
   * @param sortColumn - Column to sort by. Defaults to "date".
   * @param sortDirection - Sort direction. Defaults to "desc".
   */
  async searchSessionsByCard(
    game: "poe1" | "poe2",
    cardName: string,
    limit: number,
    offset: number,
    league?: string,
    sortColumn: "date" | "league" | "found" | "duration" | "decks" = "date",
    sortDirection: "asc" | "desc" = "desc",
  ): Promise<SessionSummaryDTO[]> {
    let query = this.kysely
      .selectFrom("sessions as s")
      .leftJoin("session_summaries as ss", "s.id", "ss.session_id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .leftJoin("snapshots as snap", "s.snapshot_id", "snap.id")
      .innerJoin("session_cards as sc", "s.id", "sc.session_id")
      .select([
        "s.id as sessionId",
        "s.game as game",
        "l.name as league",
        "s.started_at as startedAt",
        "s.ended_at as endedAt",
        "s.is_active as isActive",
        "sc.count as cardCount",
        // Duration: use summary if exists, otherwise calculate
        sql<number>`
          COALESCE(
            ss.duration_minutes,
            CASE
              WHEN s.ended_at IS NOT NULL
              THEN CAST((JULIANDAY(s.ended_at) - JULIANDAY(s.started_at)) * 24 * 60 AS INTEGER)
              ELSE NULL
            END
          )
        `.as("durationMinutes"),
        // Total decks: use summary if exists, otherwise use session total_count
        sql<number>`COALESCE(ss.total_decks_opened, s.total_count)`.as(
          "totalDecksOpened",
        ),
        // Exchange value: use summary if exists, otherwise calculate from session_cards + snapshot_card_prices
        sql<number>`
          COALESCE(
            ss.total_exchange_value,
            (
              SELECT COALESCE(SUM(sc2.count * scp.chaos_value), 0)
              FROM session_cards sc2
              LEFT JOIN snapshot_card_prices scp
                ON scp.snapshot_id = s.snapshot_id
                AND scp.card_name = sc2.card_name
                AND scp.price_source = 'exchange'
              WHERE sc2.session_id = s.id
                AND sc2.hide_price_exchange = 0
            )
          )
        `.as("totalExchangeValue"),
        // Stash value: use summary if exists, otherwise calculate
        sql<number>`
          COALESCE(
            ss.total_stash_value,
            (
              SELECT COALESCE(SUM(sc2.count * scp.chaos_value), 0)
              FROM session_cards sc2
              LEFT JOIN snapshot_card_prices scp
                ON scp.snapshot_id = s.snapshot_id
                AND scp.card_name = sc2.card_name
                AND scp.price_source = 'stash'
              WHERE sc2.session_id = s.id
                AND sc2.hide_price_stash = 0
            )
          )
        `.as("totalStashValue"),
        // Net profit: use summary if exists, otherwise calculate (total value - deck cost * deck count)
        sql<number>`
          COALESCE(
            ss.total_exchange_net_profit,
            (
              SELECT COALESCE(SUM(sc2.count * scp.chaos_value), 0)
              FROM session_cards sc2
              LEFT JOIN snapshot_card_prices scp
                ON scp.snapshot_id = s.snapshot_id
                AND scp.card_name = sc2.card_name
                AND scp.price_source = 'exchange'
              WHERE sc2.session_id = s.id
                AND sc2.hide_price_exchange = 0
            ) - COALESCE(snap.stacked_deck_chaos_cost, 0) * s.total_count
          )
        `.as("totalExchangeNetProfit"),
        sql<number>`
          COALESCE(
            ss.total_stash_net_profit,
            (
              SELECT COALESCE(SUM(sc2.count * scp.chaos_value), 0)
              FROM session_cards sc2
              LEFT JOIN snapshot_card_prices scp
                ON scp.snapshot_id = s.snapshot_id
                AND scp.card_name = sc2.card_name
                AND scp.price_source = 'stash'
              WHERE sc2.session_id = s.id
                AND sc2.hide_price_stash = 0
            ) - COALESCE(snap.stacked_deck_chaos_cost, 0) * s.total_count
          )
        `.as("totalStashNetProfit"),
        // Chaos to Divine ratios from snapshot
        sql<number>`COALESCE(ss.exchange_chaos_to_divine, snap.exchange_chaos_to_divine, 0)`.as(
          "exchangeChaosToDivine",
        ),
        sql<number>`COALESCE(ss.stash_chaos_to_divine, snap.stash_chaos_to_divine, 0)`.as(
          "stashChaosToDivine",
        ),
        // Stacked deck chaos cost
        sql<number>`COALESCE(ss.stacked_deck_chaos_cost, snap.stacked_deck_chaos_cost, 0)`.as(
          "stackedDeckChaosCost",
        ),
      ])
      .where("s.game", "=", game)
      .where("sc.card_name", "like", `%${cardName}%`)
      .where("s.total_count", ">", 0);

    if (league) {
      query = query.where("l.name", "=", league);
    }

    // Map UI sort column names to SQL expressions
    const sortColumnMap: Record<string, string> = {
      date: "s.started_at",
      league: "l.name",
      found: "sc.count",
      duration: "durationMinutes",
      decks: "totalDecksOpened",
    };

    const sqlColumn = sortColumnMap[sortColumn] ?? "s.started_at";
    const sqlDirection = sortDirection === "asc" ? "asc" : "desc";

    const rows = await query
      .groupBy("s.id")
      .orderBy(sql.raw(sqlColumn), sqlDirection)
      .limit(limit)
      .offset(offset)
      .execute();

    return rows.map(SessionsMapper.toSessionSummaryDTO);
  }

  /**
   * Get count of sessions containing a specific card
   */
  async getSessionCountByCard(
    game: "poe1" | "poe2",
    cardName: string,
    league?: string,
  ): Promise<number> {
    let query = this.kysely
      .selectFrom("sessions as s")
      .innerJoin("session_cards as sc", "s.id", "sc.session_id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("s.game", "=", game)
      .where("sc.card_name", "like", `%${cardName}%`)
      .where("s.total_count", ">", 0);

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const result = await query.groupBy("s.id").execute();

    return result.length;
  }

  /**
   * Get the most profitable session (by exchange net profit)
   * @param game - Game type filter
   * @param league - Optional league name filter
   */
  async getMostProfitableSession(
    game: "poe1" | "poe2",
    league?: string,
  ): Promise<{
    sessionId: string;
    date: string;
    profit: number;
    league: string;
    chaosPerDivine: number;
  } | null> {
    let query = this.kysely
      .selectFrom("sessions as s")
      .leftJoin("session_summaries as ss", "s.id", "ss.session_id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .leftJoin("snapshots as snap", "s.snapshot_id", "snap.id")
      .select([
        "s.id as sessionId",
        "s.started_at as date",
        "l.name as league",
        sql<number>`
          COALESCE(
            ss.total_exchange_net_profit,
            (
              SELECT COALESCE(SUM(sc.count * scp.chaos_value), 0)
              FROM session_cards sc
              LEFT JOIN snapshot_card_prices scp
                ON scp.snapshot_id = s.snapshot_id
                AND scp.card_name = sc.card_name
                AND scp.price_source = 'exchange'
              WHERE sc.session_id = s.id
                AND sc.hide_price_exchange = 0
            ) - COALESCE(snap.stacked_deck_chaos_cost, 0) * s.total_count
          )
        `.as("profit"),
        sql<number>`COALESCE(ss.exchange_chaos_to_divine, snap.exchange_chaos_to_divine, 0)`.as(
          "chaosPerDivine",
        ),
        sql<number>`
          CASE
            WHEN COALESCE(ss.exchange_chaos_to_divine, snap.exchange_chaos_to_divine, 0) > 0
            THEN (
              COALESCE(
                ss.total_exchange_net_profit,
                (
                  SELECT COALESCE(SUM(sc.count * scp.chaos_value), 0)
                  FROM session_cards sc
                  LEFT JOIN snapshot_card_prices scp
                    ON scp.snapshot_id = s.snapshot_id
                    AND scp.card_name = sc.card_name
                    AND scp.price_source = 'exchange'
                  WHERE sc.session_id = s.id
                    AND sc.hide_price_exchange = 0
                ) - COALESCE(snap.stacked_deck_chaos_cost, 0) * s.total_count
              ) / COALESCE(ss.exchange_chaos_to_divine, snap.exchange_chaos_to_divine, 1)
            )
            ELSE COALESCE(
              ss.total_exchange_net_profit,
              (
                SELECT COALESCE(SUM(sc.count * scp.chaos_value), 0)
                FROM session_cards sc
                LEFT JOIN snapshot_card_prices scp
                  ON scp.snapshot_id = s.snapshot_id
                  AND scp.card_name = sc.card_name
                  AND scp.price_source = 'exchange'
                WHERE sc.session_id = s.id
                  AND sc.hide_price_exchange = 0
              ) - COALESCE(snap.stacked_deck_chaos_cost, 0) * s.total_count
            )
          END
        `.as("profitInDivines"),
      ])
      .where("s.game", "=", game)
      .where("s.is_active", "=", 0)
      .where("s.total_count", ">", 0);

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const row = await query
      .orderBy("profitInDivines", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!row) return null;

    return {
      sessionId: row.sessionId,
      date: row.date,
      profit: row.profit,
      league: row.league,
      chaosPerDivine: row.chaosPerDivine,
    };
  }

  /**
   * Get the longest session
   * @param game - Game type filter
   * @param league - Optional league name filter
   */
  async getLongestSession(
    game: "poe1" | "poe2",
    league?: string,
  ): Promise<{
    sessionId: string;
    date: string;
    durationMinutes: number;
  } | null> {
    let query = this.kysely
      .selectFrom("sessions as s")
      .leftJoin("session_summaries as ss", "s.id", "ss.session_id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .select([
        "s.id as sessionId",
        "s.started_at as date",
        sql<number>`
          COALESCE(
            ss.duration_minutes,
            CASE
              WHEN s.ended_at IS NOT NULL
              THEN CAST((JULIANDAY(s.ended_at) - JULIANDAY(s.started_at)) * 24 * 60 AS INTEGER)
              ELSE NULL
            END
          )
        `.as("durationMinutes"),
      ])
      .where("s.game", "=", game)
      .where("s.is_active", "=", 0)
      .where("s.total_count", ">", 0)
      .where("s.ended_at", "is not", null);

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const row = await query
      .orderBy("durationMinutes", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!row) return null;

    return {
      sessionId: row.sessionId,
      date: row.date,
      durationMinutes: row.durationMinutes,
    };
  }

  /**
   * Get the session with the most decks opened
   * @param game - Game type filter
   * @param league - Optional league name filter
   */
  async getMostDecksOpenedSession(
    game: "poe1" | "poe2",
    league?: string,
  ): Promise<{
    sessionId: string;
    date: string;
    totalDecksOpened: number;
  } | null> {
    let query = this.kysely
      .selectFrom("sessions as s")
      .leftJoin("session_summaries as ss", "s.id", "ss.session_id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .select([
        "s.id as sessionId",
        "s.started_at as date",
        sql<number>`COALESCE(ss.total_decks_opened, s.total_count)`.as(
          "totalDecksOpened",
        ),
      ])
      .where("s.game", "=", game)
      .where("s.is_active", "=", 0)
      .where("s.total_count", ">", 0);

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const row = await query
      .orderBy("totalDecksOpened", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!row) return null;

    return {
      sessionId: row.sessionId,
      date: row.date,
      totalDecksOpened: row.totalDecksOpened,
    };
  }

  /**
   * Get the worst grind session — the session with the worst profit-per-deck ratio
   * among sessions that opened more decks than the average.
   * @param game - Game type filter
   * @param league - Optional league name filter
   */
  async getBiggestLetdownSession(
    game: "poe1" | "poe2",
    league?: string,
  ): Promise<{
    sessionId: string;
    date: string;
    totalDecksOpened: number;
    profit: number;
    league: string;
    chaosPerDivine: number;
  } | null> {
    let query = this.kysely
      .selectFrom("sessions as s")
      .leftJoin("session_summaries as ss", "s.id", "ss.session_id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .leftJoin("snapshots as snap", "s.snapshot_id", "snap.id")
      .select([
        "s.id as sessionId",
        "s.started_at as date",
        "l.name as league",
        sql<number>`COALESCE(ss.total_decks_opened, s.total_count)`.as(
          "totalDecksOpened",
        ),
        sql<number>`
          COALESCE(
            ss.total_exchange_net_profit,
            (
              SELECT COALESCE(SUM(sc.count * scp.chaos_value), 0)
              FROM session_cards sc
              LEFT JOIN snapshot_card_prices scp
                ON scp.snapshot_id = s.snapshot_id
                AND scp.card_name = sc.card_name
                AND scp.price_source = 'exchange'
              WHERE sc.session_id = s.id
                AND sc.hide_price_exchange = 0
            ) - COALESCE(snap.stacked_deck_chaos_cost, 0) * s.total_count
          )
        `.as("profit"),
        sql<number>`COALESCE(ss.exchange_chaos_to_divine, snap.exchange_chaos_to_divine, 0)`.as(
          "chaosPerDivine",
        ),
      ])
      .where("s.game", "=", game)
      .where("s.is_active", "=", 0)
      .where("s.total_count", ">", 0)
      .where(
        sql`COALESCE(ss.total_decks_opened, s.total_count)`,
        ">=",
        sql`(
          SELECT AVG(COALESCE(ss2.total_decks_opened, s2.total_count))
          FROM sessions s2
          LEFT JOIN session_summaries ss2 ON s2.id = ss2.session_id
          INNER JOIN leagues l2 ON s2.league_id = l2.id
          WHERE s2.game = ${game}
            AND s2.is_active = 0
            AND s2.total_count > 0
            ${league ? sql`AND l2.name = ${league}` : sql``}
        )`,
      );

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const row = await query
      .orderBy("profit", "asc")
      .limit(1)
      .executeTakeFirst();

    if (!row) return null;

    return {
      sessionId: row.sessionId,
      date: row.date,
      totalDecksOpened: row.totalDecksOpened,
      profit: row.profit,
      league: row.league,
      chaosPerDivine: row.chaosPerDivine,
    };
  }

  async getLuckyBreakSession(
    game: "poe1" | "poe2",
    league?: string,
  ): Promise<{
    sessionId: string;
    date: string;
    totalDecksOpened: number;
    profit: number;
    league: string;
    chaosPerDivine: number;
  } | null> {
    let query = this.kysely
      .selectFrom("sessions as s")
      .leftJoin("session_summaries as ss", "s.id", "ss.session_id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .leftJoin("snapshots as snap", "s.snapshot_id", "snap.id")
      .select([
        "s.id as sessionId",
        "s.started_at as date",
        "l.name as league",
        sql<number>`COALESCE(ss.total_decks_opened, s.total_count)`.as(
          "totalDecksOpened",
        ),
        sql<number>`
          COALESCE(
            ss.total_exchange_net_profit,
            (
              SELECT COALESCE(SUM(sc.count * scp.chaos_value), 0)
              FROM session_cards sc
              LEFT JOIN snapshot_card_prices scp
                ON scp.snapshot_id = s.snapshot_id
                AND scp.card_name = sc.card_name
                AND scp.price_source = 'exchange'
              WHERE sc.session_id = s.id
                AND sc.hide_price_exchange = 0
            ) - COALESCE(snap.stacked_deck_chaos_cost, 0) * s.total_count
          )
        `.as("profit"),
        sql<number>`COALESCE(ss.exchange_chaos_to_divine, snap.exchange_chaos_to_divine, 0)`.as(
          "chaosPerDivine",
        ),
      ])
      .where("s.game", "=", game)
      .where("s.is_active", "=", 0)
      .where("s.total_count", ">", 0)
      .where(
        sql`COALESCE(ss.total_decks_opened, s.total_count)`,
        "<=",
        sql`(
          SELECT AVG(COALESCE(ss2.total_decks_opened, s2.total_count))
          FROM sessions s2
          LEFT JOIN session_summaries ss2 ON s2.id = ss2.session_id
          INNER JOIN leagues l2 ON s2.league_id = l2.id
          WHERE s2.game = ${game}
            AND s2.is_active = 0
            AND s2.total_count > 0
            ${league ? sql`AND l2.name = ${league}` : sql``}
        )`,
      );

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const row = await query
      .orderBy("profit", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!row) return null;

    return {
      sessionId: row.sessionId,
      date: row.date,
      totalDecksOpened: row.totalDecksOpened,
      profit: row.profit,
      league: row.league,
      chaosPerDivine: row.chaosPerDivine,
    };
  }

  async getSessionAverages(
    game: "poe1" | "poe2",
    league?: string,
  ): Promise<{
    avgProfit: number;
    avgDecksOpened: number;
    avgDurationMinutes: number;
    avgChaosPerDivine: number;
    sessionCount: number;
  } | null> {
    let query = this.kysely
      .selectFrom("sessions as s")
      .leftJoin("session_summaries as ss", "s.id", "ss.session_id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .leftJoin("snapshots as snap", "s.snapshot_id", "snap.id")
      .select([
        sql<number>`AVG(
          COALESCE(
            ss.total_exchange_net_profit,
            (
              SELECT COALESCE(SUM(sc.count * scp.chaos_value), 0)
              FROM session_cards sc
              LEFT JOIN snapshot_card_prices scp
                ON scp.snapshot_id = s.snapshot_id
                AND scp.card_name = sc.card_name
                AND scp.price_source = 'exchange'
              WHERE sc.session_id = s.id
                AND sc.hide_price_exchange = 0
            ) - COALESCE(snap.stacked_deck_chaos_cost, 0) * s.total_count
          )
        )`.as("avgProfit"),
        sql<number>`AVG(COALESCE(ss.total_decks_opened, s.total_count))`.as(
          "avgDecksOpened",
        ),
        sql<number>`AVG(
          COALESCE(
            ss.duration_minutes,
            CASE
              WHEN s.ended_at IS NOT NULL
              THEN CAST((JULIANDAY(s.ended_at) - JULIANDAY(s.started_at)) * 24 * 60 AS INTEGER)
              ELSE NULL
            END
          )
        )`.as("avgDurationMinutes"),
        sql<number>`AVG(
          CASE
            WHEN COALESCE(ss.exchange_chaos_to_divine, snap.exchange_chaos_to_divine, 0) > 0
            THEN COALESCE(ss.exchange_chaos_to_divine, snap.exchange_chaos_to_divine, 0)
            ELSE NULL
          END
        )`.as("avgChaosPerDivine"),
        sql<number>`COUNT(*)`.as("sessionCount"),
      ])
      .where("s.game", "=", game)
      .where("s.is_active", "=", 0)
      .where("s.total_count", ">", 0);

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const row = await query.executeTakeFirst();

    if (!row) return null;

    return {
      avgProfit: row.avgProfit ?? 0,
      avgDecksOpened: row.avgDecksOpened ?? 0,
      avgDurationMinutes: row.avgDurationMinutes ?? 0,
      avgChaosPerDivine: row.avgChaosPerDivine ?? 0,
      sessionCount: row.sessionCount ?? 0,
    };
  }

  /**
   * Get total stacked decks opened across all sessions
   * @param game - Game type filter
   * @param league - Optional league name filter
   */
  async getStackedDeckCardCount(game: "poe1" | "poe2"): Promise<number> {
    const result = await this.kysely
      .selectFrom("divination_cards")
      .select(sql<number>`COUNT(*)`.as("count"))
      .where("game", "=", game)
      .where("from_boss", "=", 0)
      .executeTakeFirstOrThrow();

    return result.count;
  }

  async getTotalDecksOpened(
    game: "poe1" | "poe2",
    league?: string,
  ): Promise<number> {
    let query = this.kysely
      .selectFrom("sessions as s")
      .leftJoin("session_summaries as ss", "s.id", "ss.session_id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .select(
        sql<number>`COALESCE(SUM(COALESCE(ss.total_decks_opened, s.total_count)), 0)`.as(
          "totalDecks",
        ),
      )
      .where("s.game", "=", game)
      .where("s.is_active", "=", 0)
      .where("s.total_count", ">", 0);

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const result = await query.executeTakeFirst();

    return result?.totalDecks ?? 0;
  }

  /**
   * Get all card names that can drop from stacked decks (excluding boss-only drops)
   * @param game - Game type filter
   */
  async getStackedDeckCardNames(game: "poe1" | "poe2"): Promise<string[]> {
    const rows = await this.kysely
      .selectFrom("divination_cards")
      .select("name")
      .where("game", "=", game)
      .where("from_boss", "=", 0)
      .orderBy("name", "asc")
      .execute();

    return rows.map((r) => r.name);
  }

  /**
   * Get stacked-deck-eligible card names that the user has NOT collected.
   * When a league is specified, only cards collected in that league are excluded.
   * @param game - Game type filter
   * @param league - Optional league name; when provided, only cards found in this league are considered "collected"
   */
  async getUncollectedCardNames(
    game: "poe1" | "poe2",
    league?: string,
  ): Promise<string[]> {
    let collectedSubquery = this.kysely
      .selectFrom("cards")
      .select("card_name")
      .where("game", "=", game)
      .where("count", ">", 0);

    if (league) {
      collectedSubquery = collectedSubquery.where("scope", "=", league);
    }

    const rows = await this.kysely
      .selectFrom("divination_cards")
      .select("name")
      .where("game", "=", game)
      .where("from_boss", "=", 0)
      .where("name", "not in", collectedSubquery)
      .orderBy("name", "asc")
      .execute();

    return rows.map((r) => r.name);
  }

  async getSessionChartData(
    game: "poe1" | "poe2",
    league?: string,
  ): Promise<SessionChartDataPointDTO[]> {
    let query = this.kysely
      .selectFrom("sessions as s")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .leftJoin("session_summaries as ss", "s.id", "ss.session_id")
      .leftJoin("snapshots as snap", "s.snapshot_id", "snap.id")
      .select([
        "s.started_at as sessionDate",
        "l.name as league",
        sql<number>`
          COALESCE(
            ss.duration_minutes,
            CASE
              WHEN s.ended_at IS NOT NULL
              THEN CAST((JULIANDAY(s.ended_at) - JULIANDAY(s.started_at)) * 24 * 60 AS INTEGER)
              ELSE 0
            END
          )
        `.as("durationMinutes"),
        sql<number>`COALESCE(ss.total_decks_opened, s.total_count)`.as(
          "totalDecksOpened",
        ),
        sql<number>`
          COALESCE(
            ss.total_exchange_net_profit,
            (
              SELECT COALESCE(SUM(sc.count * scp.chaos_value), 0)
              FROM session_cards sc
              LEFT JOIN snapshot_card_prices scp
                ON scp.snapshot_id = s.snapshot_id
                AND scp.card_name = sc.card_name
                AND scp.price_source = 'exchange'
              WHERE sc.session_id = s.id
                AND sc.hide_price_exchange = 0
            ) - COALESCE(snap.stacked_deck_chaos_cost, 0) * s.total_count
          )
        `.as("exchangeNetProfit"),
        sql<number>`COALESCE(ss.exchange_chaos_to_divine, snap.exchange_chaos_to_divine, 0)`.as(
          "chaosPerDivine",
        ),
      ])
      .where("s.game", "=", game)
      .where("s.is_active", "=", 0 as any)
      .where("s.total_count", ">", 0)
      .orderBy("s.started_at", "asc");

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const rows = await query.execute();

    return rows.map((row, index) => ({
      sessionIndex: index + 1,
      sessionDate: row.sessionDate as string,
      league: row.league as string,
      durationMinutes: Number(row.durationMinutes) || 0,
      totalDecksOpened: Number(row.totalDecksOpened) || 0,
      exchangeNetProfit: Number(row.exchangeNetProfit) || 0,
      chaosPerDivine: Number(row.chaosPerDivine) || 0,
    }));
  }
}
