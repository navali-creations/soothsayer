import { sql, type Kysely } from "kysely";
import type { Database } from "../database/Database.types";
import type { GameType } from "../../../types/data-stores";
import type { CardDTO, GlobalStatDTO, UpsertCardDTO } from "./DataStore.dto";
import { DataStoreMapper } from "./DataStore.mapper";

/**
 * Repository for DataStore
 * Handles all database operations using Kysely
 */
export class DataStoreRepository {
  constructor(private kysely: Kysely<Database>) {}

  // ============================================================================
  // Global Stats Operations
  // ============================================================================

  async getGlobalStat(key: string): Promise<GlobalStatDTO | null> {
    const row = await this.kysely
      .selectFrom("global_stats")
      .selectAll()
      .where("key", "=", key)
      .executeTakeFirst();

    return row ? DataStoreMapper.toGlobalStatDTO(row) : null;
  }

  async incrementGlobalStat(key: string, increment: number): Promise<void> {
    await this.kysely
      .updateTable("global_stats")
      .set({
        value: sql`value + ${increment}`,
      })
      .where("key", "=", key)
      .execute();
  }

  async resetGlobalStat(key: string): Promise<void> {
    await this.kysely
      .updateTable("global_stats")
      .set({ value: 0 })
      .where("key", "=", key)
      .execute();
  }

  // ============================================================================
  // Card Operations
  // ============================================================================

  async upsertCard(data: UpsertCardDTO): Promise<void> {
    await this.kysely
      .insertInto("cards")
      .values({
        game: data.game,
        scope: data.scope,
        card_name: data.cardName,
        count: 1,
        last_updated: data.timestamp,
      })
      .onConflict((oc) =>
        oc.columns(["game", "scope", "card_name"]).doUpdateSet({
          count: sql`count + 1`,
          last_updated: data.timestamp,
        }),
      )
      .execute();
  }

  async getCardsByScope(game: GameType, scope: string): Promise<CardDTO[]> {
    const rows = await this.kysely
      .selectFrom("cards")
      .select(["card_name", "count", "last_updated"])
      .where("game", "=", game)
      .where("scope", "=", scope)
      .execute();

    return rows.map(DataStoreMapper.toCardDTO);
  }

  async getTotalCountByScope(game: GameType, scope: string): Promise<number> {
    const result = await this.kysely
      .selectFrom("cards")
      .select((eb) => eb.fn.sum<number>("count").as("total"))
      .where("game", "=", game)
      .where("scope", "=", scope)
      .executeTakeFirst();

    return result?.total ?? 0;
  }

  async getLastUpdatedByScope(
    game: GameType,
    scope: string,
  ): Promise<string | null> {
    const result = await this.kysely
      .selectFrom("cards")
      .select("last_updated")
      .where("game", "=", game)
      .where("scope", "=", scope)
      .orderBy("last_updated", "desc")
      .executeTakeFirst();

    return result?.last_updated ?? null;
  }

  async deleteCardsByScope(game: GameType, scope: string): Promise<void> {
    await this.kysely
      .deleteFrom("cards")
      .where("game", "=", game)
      .where("scope", "=", scope)
      .execute();
  }

  async getAvailableLeagues(game: GameType): Promise<string[]> {
    const rows = await this.kysely
      .selectFrom("cards")
      .select("scope")
      .distinct()
      .where("game", "=", game)
      .where("scope", "!=", "all-time")
      .orderBy("scope", "asc")
      .execute();

    return rows.map((row) => row.scope);
  }
}
