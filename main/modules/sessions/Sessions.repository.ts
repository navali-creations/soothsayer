import { type Kysely, type SqlBool, sql, type Transaction } from "kysely";

import type { Database } from "~/main/modules/database";

import type {
  SessionCardDetailsDTO,
  SessionChartDataPointDTO,
  SessionDetailsDTO,
  SessionSummaryDTO,
} from "./Sessions.dto";
import { SessionsMapper } from "./Sessions.mapper";

/**
 * Escape SQL LIKE metacharacters so user input is treated as literal text.
 * Uses backslash as the escape character (requires ESCAPE '\\' clause in SQLite).
 */
function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

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
   * Get session summaries for CSV export.
   * Pass null for sessionIds to export every session in the game.
   */
  async getSessionsForExport(
    game: "poe1" | "poe2",
    sessionIds: string[] | null,
  ): Promise<SessionSummaryDTO[]> {
    if (sessionIds !== null && sessionIds.length === 0) return [];

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
        sql<number>`COALESCE(ss.total_decks_opened, s.total_count)`.as(
          "totalDecksOpened",
        ),
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
        sql<number>`COALESCE(ss.exchange_chaos_to_divine, snap.exchange_chaos_to_divine, 0)`.as(
          "exchangeChaosToDivine",
        ),
        sql<number>`COALESCE(ss.stash_chaos_to_divine, snap.stash_chaos_to_divine, 0)`.as(
          "stashChaosToDivine",
        ),
        sql<number>`COALESCE(ss.stacked_deck_chaos_cost, snap.stacked_deck_chaos_cost, 0)`.as(
          "stackedDeckChaosCost",
        ),
      ])
      .where("s.game", "=", game)
      .$if(sessionIds !== null, (qb) =>
        qb.where("s.id", "in", sessionIds ?? []),
      )
      .orderBy("s.started_at", "desc")
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
      .where(
        sql<SqlBool>`sc.card_name LIKE ${`%${escapeLike(
          cardName,
        )}%`} ESCAPE '\\'`,
      )
      .where("s.total_count", ">", 0);

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const sqlDirection = sortDirection === "asc" ? "asc" : "desc";

    // Apply sort using type-safe Kysely orderBy — no sql.raw() needed.
    // Each branch uses a known-safe column expression. The service layer
    // validates sortColumn against an enum allowlist before reaching here.
    let sorted = query.groupBy("s.id");
    switch (sortColumn) {
      case "league":
        sorted = sorted.orderBy("l.name", sqlDirection);
        break;
      case "found":
        sorted = sorted.orderBy("sc.count", sqlDirection);
        break;
      case "duration":
        sorted = sorted.orderBy(sql`durationMinutes`, sqlDirection);
        break;
      case "decks":
        sorted = sorted.orderBy(sql`totalDecksOpened`, sqlDirection);
        break;
      default:
        sorted = sorted.orderBy("s.started_at", sqlDirection);
        break;
    }

    const rows = await sorted.limit(limit).offset(offset).execute();

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
      .where(
        sql<SqlBool>`sc.card_name LIKE ${`%${escapeLike(
          cardName,
        )}%`} ESCAPE '\\'`,
      )
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
    totalDecksOpened: number;
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
      totalDecksOpened: row.totalDecksOpened,
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
    totalDecksOpened: number;
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
        sql<number>`COALESCE(ss.total_decks_opened, s.total_count)`.as(
          "totalDecksOpened",
        ),
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
      totalDecksOpened: row.totalDecksOpened,
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
    durationMinutes: number | null;
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
      durationMinutes: row.durationMinutes ?? null,
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
    return this.getSessionProfitHighlight(game, league, "worst");
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
    return this.getSessionProfitHighlight(game, league, "best");
  }

  private async getSessionProfitHighlight(
    game: "poe1" | "poe2",
    league: string | undefined,
    direction: "best" | "worst",
  ): Promise<{
    sessionId: string;
    date: string;
    totalDecksOpened: number;
    profit: number;
    league: string;
    chaosPerDivine: number;
  } | null> {
    const comparisonOp =
      direction === "worst" ? (">=" as const) : ("<=" as const);
    const sortOrder =
      direction === "worst" ? ("asc" as const) : ("desc" as const);

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
        comparisonOp,
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
      .orderBy("profit", sortOrder)
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

  async getTotalNetProfit(
    game: "poe1" | "poe2",
    league?: string,
  ): Promise<{
    totalProfit: number;
    avgChaosPerDivine: number;
    avgDeckCost: number;
  } | null> {
    let query = this.kysely
      .selectFrom("sessions as s")
      .leftJoin("session_summaries as ss", "s.id", "ss.session_id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .leftJoin("snapshots as snap", "s.snapshot_id", "snap.id")
      .select([
        sql<number>`SUM(
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
        )`.as("totalProfit"),
        sql<number>`AVG(COALESCE(ss.exchange_chaos_to_divine, snap.exchange_chaos_to_divine, 0))`.as(
          "avgChaosPerDivine",
        ),
        sql<number>`AVG(COALESCE(snap.stacked_deck_chaos_cost, 0))`.as(
          "avgDeckCost",
        ),
      ])
      .where("s.game", "=", game)
      .where("s.is_active", "=", 0)
      .where("s.total_count", ">", 0);

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const row = await query.executeTakeFirst();

    if (!row || row.totalProfit === null) return null;

    return {
      totalProfit: row.totalProfit,
      avgChaosPerDivine: row.avgChaosPerDivine,
      avgDeckCost: row.avgDeckCost ?? 0,
    };
  }

  /**
   * Get total stacked decks opened across all sessions
   * @param game - Game type filter
   * @param league - Optional league name filter
   */
  async getStackedDeckCardCount(
    game: "poe1" | "poe2",
    league?: string,
  ): Promise<number> {
    if (!league) {
      // All-time: count all cards for the game (no league pool to filter against)
      const result = await this.kysely
        .selectFrom("divination_cards as dc")
        .select(sql<number>`COUNT(*)`.as("count"))
        .where("dc.game", "=", game)
        .executeTakeFirstOrThrow();
      return (result as any).count;
    }

    // League-scoped: start from availability (the league pool).
    // No JOIN needed — availability table has all the filtering columns.
    const result = await this.kysely
      .selectFrom("divination_card_availability as dca")
      .select(sql<number>`COUNT(*)`.as("count"))
      .where("dca.game", "=", game)
      .where("dca.league", "=", league)
      .where("dca.from_boss", "=", 0)
      .where("dca.is_disabled", "=", 0)
      .executeTakeFirstOrThrow();

    return (result as any).count;
  }

  async getCardPoolBreakdown(
    game: "poe1" | "poe2",
    league?: string,
  ): Promise<{
    total: number;
    bossOnly: number;
    disabled: number;
    droppable: number;
  }> {
    if (!league) {
      // All-time: just count all cards
      const result = await this.kysely
        .selectFrom("divination_cards as dc")
        .select(sql<number>`COUNT(*)`.as("total"))
        .where("dc.game", "=", game)
        .executeTakeFirstOrThrow();
      const total = (result as any).total;
      return { total, bossOnly: 0, disabled: 0, droppable: total };
    }

    // League-scoped: query availability for full breakdown
    const result = await this.kysely
      .selectFrom("divination_card_availability as dca")
      .select([
        sql<number>`COUNT(*)`.as("total"),
        sql<number>`COALESCE(SUM(CASE WHEN dca.from_boss = 1 THEN 1 ELSE 0 END), 0)`.as(
          "boss_only",
        ),
        sql<number>`COALESCE(SUM(CASE WHEN dca.is_disabled = 1 THEN 1 ELSE 0 END), 0)`.as(
          "disabled",
        ),
        sql<number>`COALESCE(SUM(CASE WHEN dca.from_boss = 0 AND dca.is_disabled = 0 THEN 1 ELSE 0 END), 0)`.as(
          "droppable",
        ),
      ])
      .where("dca.game", "=", game)
      .where("dca.league", "=", league)
      .executeTakeFirstOrThrow();

    return {
      total: (result as any).total,
      bossOnly: (result as any).boss_only,
      disabled: (result as any).disabled,
      droppable: (result as any).droppable,
    };
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
  async getStackedDeckCardNames(
    game: "poe1" | "poe2",
    league?: string,
  ): Promise<string[]> {
    if (!league) {
      // All-time: return all cards for the game
      const rows = await this.kysely
        .selectFrom("divination_cards as dc")
        .select("dc.name")
        .where("dc.game", "=", game)
        .orderBy("dc.name", "asc")
        .execute();
      return rows.map((r: any) => r.name);
    }

    // League-scoped: start from availability (the league pool)
    const rows = await this.kysely
      .selectFrom("divination_card_availability as dca")
      .select("dca.card_name as name")
      .where("dca.game", "=", game)
      .where("dca.league", "=", league)
      .where("dca.from_boss", "=", 0)
      .where("dca.is_disabled", "=", 0)
      .orderBy("dca.card_name", "asc")
      .execute();

    return rows.map((r: any) => r.name);
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

    if (!league) {
      // All-time: return all uncollected cards for the game
      const rows = await this.kysely
        .selectFrom("divination_cards as dc")
        .select("dc.name")
        .where("dc.game", "=", game)
        .where("dc.name", "not in", collectedSubquery)
        .orderBy("dc.name", "asc")
        .execute();
      return rows.map((r: any) => r.name);
    }

    // League-scoped: start from availability (the league pool)
    const rows = await this.kysely
      .selectFrom("divination_card_availability as dca")
      .select("dca.card_name as name")
      .where("dca.game", "=", game)
      .where("dca.league", "=", league)
      .where("dca.from_boss", "=", 0)
      .where("dca.is_disabled", "=", 0)
      .where("dca.card_name", "not in", collectedSubquery)
      .orderBy("dca.card_name", "asc")
      .execute();

    return rows.map((r: any) => r.name);
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

  async getTotalTimeSpent(
    game: "poe1" | "poe2",
    league?: string,
  ): Promise<{
    totalMinutes: number;
  } | null> {
    let query = this.kysely
      .selectFrom("sessions as s")
      .leftJoin("session_summaries as ss", "s.id", "ss.session_id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .select([
        sql<number>`SUM(
          COALESCE(
            ss.duration_minutes,
            CASE
              WHEN s.ended_at IS NOT NULL
              THEN CAST((JULIANDAY(s.ended_at) - JULIANDAY(s.started_at)) * 24 * 60 AS INTEGER)
              ELSE NULL
            END
          )
        )`.as("totalMinutes"),
      ])
      .where("s.game", "=", game)
      .where("s.is_active", "=", 0)
      .where("s.total_count", ">", 0);

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const row = await query.executeTakeFirst();

    if (!row || row.totalMinutes === null) return null;

    return {
      totalMinutes: row.totalMinutes,
    };
  }

  async getWinRate(
    game: "poe1" | "poe2",
    league?: string,
  ): Promise<{
    profitableSessions: number;
    totalSessions: number;
    winRate: number;
  } | null> {
    let query = this.kysely
      .selectFrom("sessions as s")
      .leftJoin("session_summaries as ss", "s.id", "ss.session_id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .leftJoin("snapshots as snap", "s.snapshot_id", "snap.id")
      .select([
        sql<number>`COUNT(*)`.as("totalSessions"),
        sql<number>`SUM(
          CASE WHEN COALESCE(
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
          ) > 0 THEN 1 ELSE 0 END
        )`.as("profitableSessions"),
      ])
      .where("s.game", "=", game)
      .where("s.is_active", "=", 0)
      .where("s.total_count", ">", 0);

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const row = await query.executeTakeFirst();

    if (!row || row.totalSessions === 0) return null;

    return {
      profitableSessions: row.profitableSessions,
      totalSessions: row.totalSessions,
      winRate: row.profitableSessions / row.totalSessions,
    };
  }

  /**
   * Get stacked deck chaos cost for multiple sessions.
   * Returns a Map of sessionId → deckCost.
   */
  async getDeckCosts(sessionIds: string[]): Promise<Map<string, number>> {
    if (sessionIds.length === 0) return new Map();

    const rows = await this.kysely
      .selectFrom("sessions as s")
      .leftJoin("snapshots as snap", "s.snapshot_id", "snap.id")
      .select([
        "s.id as sessionId",
        sql<number>`COALESCE(snap.stacked_deck_chaos_cost, 0)`.as("deckCost"),
      ])
      .where("s.id", "in", sessionIds)
      .execute();

    const result = new Map<string, number>();
    for (const row of rows) {
      result.set(row.sessionId, row.deckCost);
    }
    return result;
  }

  /**
   * Get lightweight sparkline line points for multiple sessions.
   * Groups card events into 10-second buckets and computes cumulative profit.
   * Returns a map of sessionId → LinePoint[].
   */
  async getSparklineData(
    sessionIds: string[],
  ): Promise<Record<string, { x: number; profit: number }[]>> {
    if (sessionIds.length === 0) return {};

    // Query all card events for the given sessions, ordered by time
    const rows = await this.kysely
      .selectFrom("session_card_events")
      .select(["session_id", "chaos_value", "dropped_at"])
      .where("session_id", "in", sessionIds)
      .orderBy("session_id")
      .orderBy("dropped_at", "asc")
      .orderBy("id", "asc")
      .execute();

    // Group events by session → 10-second buckets → cumulative values
    const result: Record<string, { x: number; profit: number }[]> = {};

    // Group rows by session_id
    const bySession = new Map<string, typeof rows>();
    for (const row of rows) {
      const sid = row.session_id;
      let arr = bySession.get(sid);
      if (!arr) {
        arr = [];
        bySession.set(sid, arr);
      }
      arr.push(row);
    }

    for (const [sessionId, events] of bySession) {
      let cumDrops = 0;
      let cumChaos = 0;

      // Bucket events by 10-second intervals
      const bucketMap = new Map<
        string,
        { dropCount: number; cumChaos: number }
      >();

      for (const event of events) {
        cumDrops++;
        cumChaos += event.chaos_value ?? 0;

        // 10-second bucket key
        const dt = new Date(event.dropped_at);
        const s = dt.getSeconds();
        dt.setSeconds(s - (s % 10), 0);
        const bucketKey = dt.toISOString();

        bucketMap.set(bucketKey, { dropCount: cumDrops, cumChaos });
      }

      // Build line points: origin + one point per bucket boundary
      const points: { x: number; profit: number }[] = [{ x: 0, profit: 0 }];
      const sortedBuckets = Array.from(bucketMap.values());
      for (const bucket of sortedBuckets) {
        points.push({ x: bucket.dropCount, profit: bucket.cumChaos });
      }

      result[sessionId] = points;
    }

    return result;
  }

  /**
   * Get aggregated card drops across multiple sessions.
   * Returns a map of card_name → total count.
   */
  async getCardDropsForSessions(
    game: "poe1" | "poe2",
    sessionIds: string[],
  ): Promise<Record<string, number>> {
    return this.getCardDropsForExport(game, sessionIds);
  }

  /**
   * Get aggregated card drops for CSV export.
   * Pass null for sessionIds to aggregate every session in the game.
   */
  async getCardDropsForExport(
    game: "poe1" | "poe2",
    sessionIds: string[] | null,
  ): Promise<Record<string, number>> {
    if (sessionIds !== null && sessionIds.length === 0) return {};

    const rows = await this.kysely
      .selectFrom("session_cards as sc")
      .innerJoin("sessions as s", "sc.session_id", "s.id")
      .select(["sc.card_name", sql<number>`SUM(sc.count)`.as("total")])
      .where("s.game", "=", game)
      .$if(sessionIds !== null, (qb) =>
        qb.where("sc.session_id", "in", sessionIds ?? []),
      )
      .groupBy("sc.card_name")
      .orderBy("sc.card_name", "asc")
      .execute();

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.card_name] = Number(row.total);
    }
    return result;
  }

  /**
   * Get all session IDs for a game, ordered by started_at desc.
   */
  async getAllSessionIds(game: "poe1" | "poe2"): Promise<string[]> {
    const rows = await this.kysely
      .selectFrom("sessions")
      .select("id")
      .where("game", "=", game)
      .orderBy("started_at", "desc")
      .execute();

    return rows.map((r) => r.id);
  }

  async deleteSessions(
    game: "poe1" | "poe2",
    sessionIds: string[],
  ): Promise<
    { success: true; deletedCount: number } | { success: false; error: string }
  > {
    const uniqueSessionIds = Array.from(new Set(sessionIds));

    if (uniqueSessionIds.length === 0) {
      return { success: false, error: "No sessions were selected." };
    }

    return this.kysely.transaction().execute(async (trx) => {
      const selectedSessions = await trx
        .selectFrom("sessions as s")
        .innerJoin("leagues as l", "s.league_id", "l.id")
        .select([
          "s.id",
          "s.game",
          "s.is_active as isActive",
          "l.name as league",
        ])
        .where("s.id", "in", uniqueSessionIds)
        .execute();

      if (selectedSessions.length !== uniqueSessionIds.length) {
        return {
          success: false,
          error: "One or more selected sessions were not found.",
        };
      }

      if (selectedSessions.some((session) => session.game !== game)) {
        return {
          success: false,
          error:
            "One or more selected sessions do not belong to the active game.",
        };
      }

      if (selectedSessions.some((session) => session.isActive === 1)) {
        return {
          success: false,
          error: "Active sessions cannot be deleted.",
        };
      }

      const affectedScopes = Array.from(
        new Set([
          "all-time",
          ...selectedSessions.map((session) => session.league),
        ]),
      );

      const deleteResult = await trx
        .deleteFrom("sessions")
        .where("id", "in", uniqueSessionIds)
        .executeTakeFirst();

      await this.recomputeCardAggregates(trx, game, affectedScopes);
      await this.recomputeTotalStackedDecksOpened(trx);

      return {
        success: true,
        deletedCount: Number(deleteResult.numDeletedRows ?? 0),
      };
    });
  }

  private async recomputeCardAggregates(
    db: Kysely<Database> | Transaction<Database>,
    game: "poe1" | "poe2",
    scopes: string[],
  ): Promise<void> {
    if (scopes.length === 0) return;

    await db
      .deleteFrom("cards")
      .where("game", "=", game)
      .where("scope", "in", scopes)
      .execute();

    const now = new Date().toISOString();

    const rowsToInsert: Array<{
      game: "poe1" | "poe2";
      scope: string;
      card_name: string;
      count: number;
      last_updated: string;
    }> = [];

    if (scopes.includes("all-time")) {
      const allTimeRows = await db
        .selectFrom("session_cards as sc")
        .innerJoin("sessions as s", "sc.session_id", "s.id")
        .select([
          "sc.card_name as cardName",
          sql<number>`SUM(sc.count)`.as("count"),
        ])
        .where("s.game", "=", game)
        .groupBy("sc.card_name")
        .execute();

      rowsToInsert.push(
        ...allTimeRows.map((row) => ({
          game,
          scope: "all-time",
          card_name: row.cardName,
          count: Number(row.count),
          last_updated: now,
        })),
      );
    }

    const leagueScopes = scopes.filter((scope) => scope !== "all-time");
    if (leagueScopes.length > 0) {
      const leagueRows = await db
        .selectFrom("session_cards as sc")
        .innerJoin("sessions as s", "sc.session_id", "s.id")
        .innerJoin("leagues as l", "s.league_id", "l.id")
        .select([
          "l.name as scope",
          "sc.card_name as cardName",
          sql<number>`SUM(sc.count)`.as("count"),
        ])
        .where("s.game", "=", game)
        .where("l.name", "in", leagueScopes)
        .groupBy(["l.name", "sc.card_name"])
        .execute();

      rowsToInsert.push(
        ...leagueRows.map((row) => ({
          game,
          scope: row.scope,
          card_name: row.cardName,
          count: Number(row.count),
          last_updated: now,
        })),
      );
    }

    if (rowsToInsert.length > 0) {
      await db.insertInto("cards").values(rowsToInsert).execute();
    }
  }

  private async recomputeTotalStackedDecksOpened(
    db: Kysely<Database> | Transaction<Database>,
  ): Promise<void> {
    const row = await db
      .selectFrom("sessions")
      .select(sql<number>`COALESCE(SUM(total_count), 0)`.as("total"))
      .executeTakeFirst();

    await db
      .insertInto("global_stats")
      .values({
        key: "totalStackedDecksOpened",
        value: Number(row?.total ?? 0),
      })
      .onConflict((oc) =>
        oc.column("key").doUpdateSet({
          value: Number(row?.total ?? 0),
        }),
      )
      .execute();
  }
}
