import { sql, type Kysely } from "kysely";
import type { Database } from "../database/Database.types";
import type { GameVersion } from "../settings-store/SettingsStore.schemas";
import type {
  SessionSummaryDTO,
  SessionDetailsDTO,
  SessionCardDetailsDTO,
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
  async getSessionCount(game: GameVersion): Promise<number> {
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
    game: GameVersion,
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
        // Chaos to Divine ratios from snapshot
        sql<number>`COALESCE(ss.exchange_chaos_to_divine, snap.exchange_chaos_to_divine, 0)`.as(
          "exchangeChaosToDivine",
        ),
        sql<number>`COALESCE(ss.stash_chaos_to_divine, snap.stash_chaos_to_divine, 0)`.as(
          "stashChaosToDivine",
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
   * Get session cards by session ID
   */
  async getSessionCards(sessionId: string): Promise<SessionCardDetailsDTO[]> {
    const rows = await this.kysely
      .selectFrom("session_cards")
      .select([
        "card_name as cardName",
        "count",
        "hide_price_exchange as hidePriceExchange",
        "hide_price_stash as hidePriceStash",
      ])
      .where("session_id", "=", sessionId)
      .execute();

    return rows.map((row) => ({
      cardName: row.cardName,
      count: row.count,
      hidePriceExchange: row.hidePriceExchange === 1,
      hidePriceStash: row.hidePriceStash === 1,
    }));
  }
}
