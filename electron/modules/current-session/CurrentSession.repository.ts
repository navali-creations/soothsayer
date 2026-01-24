import { type Kysely, sql } from "kysely";

import type { Database } from "~/electron/modules/database";

import type { GameType } from "../../../types/data-stores";
import type {
  CreateSessionDTO,
  ProcessedIdDTO,
  SessionCardDTO,
  SessionDTO,
  SessionSummaryDTO,
  UpdateSessionDTO,
  UpsertSessionCardDTO,
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
      .where("is_active", "=", 1)
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
        "sc.first_seen_at as firstSeenAt",
        "sc.last_seen_at as lastSeenAt",
        "sc.hide_price_exchange as hidePriceExchange",
        "sc.hide_price_stash as hidePriceStash",
        // Divination card metadata (may be null if card not in reference data)
        "dc.id as divinationCardId",
        "dc.stack_size as stackSize",
        "dc.description",
        "dc.reward_html as rewardHtml",
        "dc.art_src as artSrc",
        "dc.flavour_html as flavourHtml",
        sql<number>`COALESCE(dcr.rarity, 4)`.as("rarity"), // Default to 4 (common) if no rarity data
      ])
      .where("sc.session_id", "=", sessionId)
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
              card_name: null,
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

  async saveProcessedId(
    game: GameType,
    processedId: string,
    cardName: string,
  ): Promise<void> {
    await this.kysely
      .insertInto("processed_ids")
      .values({
        game,
        scope: "global" as const,
        processed_id: processedId,
        card_name: cardName,
      })
      .onConflict((oc) => oc.doNothing()) // Skip if duplicate
      .execute();
  }

  async getRecentDrops(game: GameType, limit: number = 20): Promise<string[]> {
    const results = await this.kysely
      .selectFrom("processed_ids")
      .select("card_name")
      .where("game", "=", game)
      .where("scope", "=", "global")
      .where("card_name", "is not", null)
      .orderBy("processed_id", "desc")
      .limit(limit)
      .execute();

    return results.map((r) => r.card_name!);
  }

  async clearRecentDrops(game: GameType): Promise<void> {
    await this.kysely.transaction().execute(async (trx) => {
      // First, clear card_name to hide from recent drops UI
      await trx
        .updateTable("processed_ids")
        .set({ card_name: sql`NULL` })
        .where("game", "=", game)
        .where("scope", "=", "global")
        .execute();

      // Then, prune old entries - keep only the most recent 20 for deduplication
      // This prevents unbounded growth of the processed_ids table
      const keepCount = 20;

      // Get the created_at timestamp of the 20th most recent entry
      const cutoffResult = await trx
        .selectFrom("processed_ids")
        .select("created_at")
        .where("game", "=", game)
        .where("scope", "=", "global")
        .orderBy("created_at", "desc")
        .limit(1)
        .offset(keepCount - 1)
        .executeTakeFirst();

      // If we have more than keepCount entries, delete the older ones
      if (cutoffResult) {
        await trx
          .deleteFrom("processed_ids")
          .where("game", "=", game)
          .where("scope", "=", "global")
          .where("created_at", "<", cutoffResult.created_at)
          .execute();
      }
    });
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
