import { sql, type Kysely } from "kysely";
import type { Database } from "../database/Database.types";
import type { GameType } from "../../../types/data-stores";
import {
  type CreateSessionDTO,
  type UpdateSessionDTO,
  type UpsertSessionCardDTO,
  type SessionDTO,
  type SessionCardDTO,
  type ProcessedIdDTO,
  type SessionSummaryDTO,
} from "./CurrentSession.dto";
import { CurrentSessionMapper } from "./CurrentSession.mapper";

/**
 * Repository for CurrentSession
 * Handles all database operations using Kysely
 */
export class CurrentSessionRepository {
  constructor(private kysely: Kysely<Database>) {}

  // ============================================================================
  // Session Operations
  // ============================================================================

  async createSession(data: CreateSessionDTO): Promise<void> {
    await this.kysely
      .insertInto("sessions")
      .values({
        id: data.id,
        game: data.game,
        league_id: data.leagueId,
        snapshot_id: data.snapshotId,
        started_at: data.startedAt,
        total_count: 0,
        is_active: 1,
      })
      .execute();
  }

  async updateSession(
    sessionId: string,
    data: UpdateSessionDTO,
  ): Promise<void> {
    // Build dynamic update object
    const updates: Partial<{
      total_count: number;
      ended_at: string;
      is_active: number;
    }> = {};

    if (data.totalCount !== undefined) updates.total_count = data.totalCount;
    if (data.endedAt !== undefined) updates.ended_at = data.endedAt;
    if (data.isActive !== undefined) {
      updates.is_active = CurrentSessionMapper.boolToDb(data.isActive)!;
    }

    if (Object.keys(updates).length > 0) {
      await this.kysely
        .updateTable("sessions")
        .set(updates)
        .where("id", "=", sessionId)
        .execute();
    }
  }

  async getActiveSession(game: GameType): Promise<SessionDTO | null> {
    const row = await this.kysely
      .selectFrom("sessions")
      .selectAll()
      .where("game", "=", game)
      .where("is_active", "=", 1)
      .executeTakeFirst();

    return row ? CurrentSessionMapper.toSessionDTO(row) : null;
  }

  async getSessionById(sessionId: string): Promise<SessionDTO | null> {
    const row = await this.kysely
      .selectFrom("sessions")
      .selectAll()
      .where("id", "=", sessionId)
      .executeTakeFirst();

    return row ? CurrentSessionMapper.toSessionDTO(row) : null;
  }

  async deactivateAllSessions(game: GameType): Promise<void> {
    await this.kysely
      .updateTable("sessions")
      .set({ is_active: 0 })
      .where("game", "=", game)
      .execute();
  }

  async getSessionTotalCount(sessionId: string): Promise<number> {
    const result = await this.kysely
      .selectFrom("session_cards")
      .select((eb) => eb.fn.sum<number>("count").as("total"))
      .where("session_id", "=", sessionId)
      .executeTakeFirst();

    return result?.total ?? 0;
  }

  // ============================================================================
  // Session Card Operations
  // ============================================================================

  async upsertSessionCard(data: UpsertSessionCardDTO): Promise<void> {
    await this.kysely
      .insertInto("session_cards")
      .values({
        session_id: data.sessionId,
        card_name: data.cardName,
        count: data.count,
        first_seen_at: data.firstSeenAt,
        last_seen_at: data.lastSeenAt,
        hide_price_exchange:
          CurrentSessionMapper.boolToDb(data.hidePriceExchange) ?? 0,
        hide_price_stash:
          CurrentSessionMapper.boolToDb(data.hidePriceStash) ?? 0,
      })
      .onConflict((oc) =>
        oc.columns(["session_id", "card_name"]).doUpdateSet({
          count: data.count,
          last_seen_at: data.lastSeenAt,
        }),
      )
      .execute();
  }

  async incrementCardCount(
    sessionId: string,
    cardName: string,
    timestamp: string,
  ): Promise<void> {
    await this.kysely.transaction().execute(async (trx) => {
      // Increment the card count in session_cards
      await trx
        .insertInto("session_cards")
        .values({
          session_id: sessionId,
          card_name: cardName,
          count: 1,
          first_seen_at: timestamp,
          last_seen_at: timestamp,
          hide_price_exchange: 0,
          hide_price_stash: 0,
        })
        .onConflict((oc) =>
          oc.columns(["session_id", "card_name"]).doUpdateSet({
            count: sql`count + 1`,
            last_seen_at: timestamp,
          }),
        )
        .execute();

      // Update the session's total count
      const result = await trx
        .selectFrom("session_cards")
        .select((eb) => eb.fn.sum<number>("count").as("total"))
        .where("session_id", "=", sessionId)
        .executeTakeFirst();

      await trx
        .updateTable("sessions")
        .set({ total_count: result?.total ?? 0 })
        .where("id", "=", sessionId)
        .execute();
    });
  }

  async getSessionCards(sessionId: string): Promise<SessionCardDTO[]> {
    const rows = await this.kysely
      .selectFrom("session_cards")
      .selectAll()
      .where("session_id", "=", sessionId)
      .execute();

    return rows.map(CurrentSessionMapper.toSessionCardDTO);
  }

  async updateCardPriceVisibility(
    sessionId: string,
    cardName: string,
    priceSource: "exchange" | "stash",
    hidePrice: boolean,
  ): Promise<void> {
    const column =
      priceSource === "exchange" ? "hide_price_exchange" : "hide_price_stash";

    await this.kysely
      .updateTable("session_cards")
      .set({ [column]: hidePrice ? 1 : 0 })
      .where("session_id", "=", sessionId)
      .where("card_name", "=", cardName)
      .execute();
  }

  // ============================================================================
  // Processed IDs Operations
  // ============================================================================

  async getProcessedIds(game: GameType): Promise<ProcessedIdDTO[]> {
    const rows = await this.kysely
      .selectFrom("processed_ids")
      .select("processed_id")
      .where("game", "=", game)
      .where("scope", "=", "global")
      .orderBy("created_at", "asc")
      .orderBy("processed_id", "asc")
      .execute();

    return rows.map((row) => ({ processedId: row.processed_id }));
  }

  async replaceProcessedIds(
    game: GameType,
    processedIds: string[],
  ): Promise<void> {
    await this.kysely.transaction().execute(async (trx) => {
      // Delete old IDs
      await trx
        .deleteFrom("processed_ids")
        .where("game", "=", game)
        .where("scope", "=", "global")
        .execute();

      // Insert new IDs (batch insert)
      if (processedIds.length > 0) {
        await trx
          .insertInto("processed_ids")
          .values(
            processedIds.map((id) => ({
              game,
              scope: "global" as const,
              processed_id: id,
            })),
          )
          .execute();
      }
    });
  }

  async clearProcessedIds(game: GameType): Promise<void> {
    await this.kysely
      .deleteFrom("processed_ids")
      .where("game", "=", game)
      .where("scope", "=", "global")
      .execute();
  }

  // ============================================================================
  // League Operations
  // ============================================================================

  async getLeagueId(
    game: GameType,
    leagueName: string,
  ): Promise<string | null> {
    const result = await this.kysely
      .selectFrom("leagues")
      .select("id")
      .where("game", "=", game)
      .where("name", "=", leagueName)
      .executeTakeFirst();

    return result?.id ?? null;
  }

  // ============================================================================
  // Session Summary Operations
  // ============================================================================

  async createSessionSummary(data: SessionSummaryDTO): Promise<void> {
    await this.kysely
      .insertInto("session_summaries")
      .values({
        session_id: data.sessionId,
        game: data.game,
        league: data.league,
        started_at: data.startedAt,
        ended_at: data.endedAt,
        duration_minutes: data.durationMinutes,
        total_decks_opened: data.totalDecksOpened,
        total_exchange_value: data.totalExchangeValue,
        total_stash_value: data.totalStashValue,
        exchange_chaos_to_divine: data.exchangeChaosToDivine,
        stash_chaos_to_divine: data.stashChaosToDivine,
      })
      .execute();
  }
}
