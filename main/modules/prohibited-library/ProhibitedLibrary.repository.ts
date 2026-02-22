import type { Kysely } from "kysely";

import type {
  Database,
  ProhibitedLibraryCacheMetadataRow,
} from "~/main/modules/database";

import type { ProhibitedLibraryCardWeightDTO } from "./ProhibitedLibrary.dto";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UpsertCardWeightRow {
  cardName: string;
  game: "poe1" | "poe2";
  league: string;
  weight: number;
  rarity: 0 | 1 | 2 | 3 | 4;
  fromBoss: boolean;
  loadedAt: string;
}

// ─── Repository ──────────────────────────────────────────────────────────────

/**
 * Repository for Prohibited Library data persistence.
 *
 * Handles all database operations for the `prohibited_library_card_weights`
 * and `prohibited_library_cache_metadata` tables, plus denormalising
 * `from_boss` flags back into `divination_cards`.
 */
export class ProhibitedLibraryRepository {
  constructor(private kysely: Kysely<Database>) {}

  // ══════════════════════════════════════════════════════════════════════════
  // Card Weights
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Upsert all card weights for a given game/league in a single transaction.
   *
   * Uses INSERT … ON CONFLICT DO UPDATE to handle both fresh inserts and
   * re-parses of the same CSV for the same game/league.
   */
  async upsertCardWeights(rows: UpsertCardWeightRow[]): Promise<void> {
    if (rows.length === 0) return;

    await this.kysely.transaction().execute(async (trx) => {
      for (const row of rows) {
        await trx
          .insertInto("prohibited_library_card_weights")
          .values({
            card_name: row.cardName,
            game: row.game,
            league: row.league,
            weight: row.weight,
            rarity: row.rarity,
            from_boss: row.fromBoss ? 1 : 0,
            loaded_at: row.loadedAt,
          })
          .onConflict((oc) =>
            oc.columns(["card_name", "game", "league"]).doUpdateSet({
              weight: row.weight,
              rarity: row.rarity,
              from_boss: row.fromBoss ? 1 : 0,
              loaded_at: row.loadedAt,
              updated_at: new Date().toISOString(),
            }),
          )
          .execute();
      }
    });
  }

  /**
   * Read all card weights for the given game/league.
   *
   * Returns DTOs ready for consumption by the UI or other services.
   */
  async getCardWeights(
    game: "poe1" | "poe2",
    league: string,
  ): Promise<ProhibitedLibraryCardWeightDTO[]> {
    const rows = await this.kysely
      .selectFrom("prohibited_library_card_weights")
      .selectAll()
      .where("game", "=", game)
      .where("league", "=", league)
      .orderBy("card_name", "asc")
      .execute();

    return rows.map((row) => ({
      cardName: row.card_name,
      game: row.game,
      league: row.league,
      weight: row.weight,
      rarity: row.rarity,
      fromBoss: row.from_boss === 1,
      loadedAt: row.loaded_at,
    }));
  }

  /**
   * Read card weights filtered to boss-only cards for the given game/league.
   */
  async getFromBossCards(
    game: "poe1" | "poe2",
    league: string,
  ): Promise<ProhibitedLibraryCardWeightDTO[]> {
    const rows = await this.kysely
      .selectFrom("prohibited_library_card_weights")
      .selectAll()
      .where("game", "=", game)
      .where("league", "=", league)
      .where("from_boss", "=", 1)
      .orderBy("card_name", "asc")
      .execute();

    return rows.map((row) => ({
      cardName: row.card_name,
      game: row.game,
      league: row.league,
      weight: row.weight,
      rarity: row.rarity,
      fromBoss: true,
      loadedAt: row.loaded_at,
    }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Cache Metadata
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Upsert cache metadata row after a successful load.
   *
   * The metadata table is keyed by `game` (single row per game), so this
   * always replaces the previous metadata for that game.
   */
  async upsertMetadata(
    game: "poe1" | "poe2",
    league: string,
    loadedAt: string,
    appVersion: string,
    cardCount: number,
  ): Promise<void> {
    await this.kysely
      .insertInto("prohibited_library_cache_metadata")
      .values({
        game,
        league,
        loaded_at: loadedAt,
        app_version: appVersion,
        card_count: cardCount,
      })
      .onConflict((oc) =>
        oc.column("game").doUpdateSet({
          league,
          loaded_at: loadedAt,
          app_version: appVersion,
          card_count: cardCount,
          updated_at: new Date().toISOString(),
        }),
      )
      .execute();
  }

  /**
   * Read metadata for a game (used for status display and load-skip logic).
   *
   * Returns `undefined` if no data has been loaded for this game yet.
   */
  async getMetadata(
    game: "poe1" | "poe2",
  ): Promise<ProhibitedLibraryCacheMetadataRow | undefined> {
    const row = await this.kysely
      .selectFrom("prohibited_library_cache_metadata")
      .selectAll()
      .where("game", "=", game)
      .executeTakeFirst();

    return row;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // from_boss Synchronisation
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Denormalise `from_boss` flags from `prohibited_library_card_weights`
   * back into `divination_cards` for the given game.
   *
   * This runs two updates inside a transaction:
   *   1. SET from_boss = 1 for cards that ARE boss-exclusive in the PL data
   *   2. SET from_boss = 0 for cards that are NOT boss-exclusive (or absent)
   *
   * This ensures `divination_cards.from_boss` always reflects the latest
   * PL data without requiring a cross-table JOIN on every card query.
   */
  async syncFromBossFlags(
    game: "poe1" | "poe2",
    league: string,
  ): Promise<void> {
    await this.kysely.transaction().execute(async (trx) => {
      // 1. Mark boss-exclusive cards
      await trx
        .updateTable("divination_cards")
        .set({ from_boss: 1 })
        .where("game", "=", game)
        .where(
          "name",
          "in",
          trx
            .selectFrom("prohibited_library_card_weights")
            .select("card_name")
            .where("game", "=", game)
            .where("league", "=", league)
            .where("from_boss", "=", 1),
        )
        .execute();

      // 2. Clear from_boss for all other cards of this game
      await trx
        .updateTable("divination_cards")
        .set({ from_boss: 0 })
        .where("game", "=", game)
        .where(
          "name",
          "not in",
          trx
            .selectFrom("prohibited_library_card_weights")
            .select("card_name")
            .where("game", "=", game)
            .where("league", "=", league)
            .where("from_boss", "=", 1),
        )
        .execute();
    });
  }

  /**
   * Delete all card weights for a given game/league.
   *
   * Used during development/testing. Not exposed via IPC.
   */
  async deleteCardWeights(
    game: "poe1" | "poe2",
    league: string,
  ): Promise<void> {
    await this.kysely
      .deleteFrom("prohibited_library_card_weights")
      .where("game", "=", game)
      .where("league", "=", league)
      .execute();
  }
}
