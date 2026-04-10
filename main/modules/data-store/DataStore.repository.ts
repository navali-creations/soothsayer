import { type Kysely, sql } from "kysely";

import type { Database } from "~/main/modules/database";

import type { GameType } from "../../../types/data-stores";
import type { CardDTO, GlobalStatDTO, UpsertCardDTO } from "./DataStore.dto";
import { type CardWithMetadataRow, DataStoreMapper } from "./DataStore.mapper";

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

  /**
   * Get all collected cards for a game+scope with metadata.
   *
   * NOTE: This query intentionally uses LEFT JOINs to divination_cards,
   * divination_card_availability, and divination_card_rarities. This is
   * correct because we are reading metadata for cards the user has already
   * collected — not enumerating the league pool. The LEFT JOIN ensures we
   * still return the collected card even if metadata rows are missing
   * (with safe COALESCE defaults for display). This is distinct from the
   * pool queries in Sessions.repository.ts which use INNER JOIN /
   * selectFrom("divination_card_availability") to avoid inflating counts.
   */
  async getCardsByScope(game: GameType, scope: string): Promise<CardDTO[]> {
    const rows = await this.kysely
      .selectFrom("cards as c")
      .leftJoin("divination_cards as dc", (join) =>
        join.onRef("dc.name", "=", "c.card_name").on("dc.game", "=", game),
      )
      .leftJoin("divination_card_availability as dca", (join) =>
        join
          .onRef("dca.card_name", "=", "c.card_name")
          .on("dca.game", "=", game)
          .on("dca.league", "=", scope),
      )
      .leftJoin("divination_card_rarities as dcr", (join) =>
        join
          .onRef("dcr.card_name", "=", "c.card_name")
          .on("dcr.game", "=", game)
          .on("dcr.league", "=", scope),
      )
      .select([
        "c.card_name",
        "c.count",
        "c.last_updated",
        "dc.id as dc_id",
        "dc.stack_size as dc_stack_size",
        "dc.description as dc_description",
        "dc.reward_html as dc_reward_html",
        "dc.art_src as dc_art_src",
        "dc.flavour_html as dc_flavour_html",
        sql<number>`COALESCE(dca.from_boss, 0)`.as("dc_from_boss"),
        sql<number>`COALESCE(dca.is_disabled, 0)`.as("dc_is_disabled"),
        sql<number>`COALESCE(dcr.rarity, 4)`.as("dc_rarity"),
      ])
      .where("c.game", "=", game)
      .where("c.scope", "=", scope)
      .execute();

    if (rows.length > 0) {
      const firstRow = rows[0];
      const requiredKeys = [
        "card_name",
        "count",
        "last_updated",
        "dc_id",
        "dc_stack_size",
        "dc_description",
        "dc_reward_html",
        "dc_art_src",
        "dc_flavour_html",
        "dc_from_boss",
        "dc_is_disabled",
        "dc_rarity",
      ] as const;
      for (const key of requiredKeys) {
        if (!(key in firstRow)) {
          throw new Error(
            `[DataStore] Query result shape mismatch: missing key "${key}" in card row. This likely indicates a schema change that wasn't reflected in CardWithMetadataRow.`,
          );
        }
      }
    }

    return (rows as unknown as CardWithMetadataRow[]).map(
      DataStoreMapper.toCardDTO,
    );
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
