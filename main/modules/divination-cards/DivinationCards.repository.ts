import {
  type Kysely,
  type SelectQueryBuilder,
  type SqlBool,
  sql,
} from "kysely";

import type { Database } from "~/main/modules/database";
import type { Rarity } from "~/types/data-stores";

import type { DivinationCardDTO } from "./DivinationCards.dto";
import {
  DivinationCardsMapper,
  type DivinationCardWithRarityRow,
} from "./DivinationCards.mapper";

/**
 * Base columns selected from divination_cards in every card query.
 * Defined once to avoid repetition across getAllByGame, getById, getByName, searchByName.
 */
const BASE_CARD_COLUMNS = [
  "dc.id",
  "dc.name",
  "dc.stack_size",
  "dc.description",
  "dc.reward_html",
  "dc.art_src",
  "dc.flavour_html",
  "dc.game",
  "dc.data_hash",
  "dc.created_at",
  "dc.updated_at",
] as const;

/**
 * Repository for Divination Cards
 * Handles all database operations using Kysely
 */
export class DivinationCardsRepository {
  constructor(private kysely: Kysely<Database>) {}

  /**
   * Generate a deterministic slug-based ID from game and card name
   * e.g., "poe1_a-chilling-wind"
   */
  private generateId(game: "poe1" | "poe2", name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
    return `${game}_${slug}`;
  }

  /**
   * Apply the rarity joins (price-based, filter-based) and select Prohibited Library
   * rarity from the already-joined `divination_card_rarities` table.
   *
   * Every code path selects exactly three extra columns — `rarity`, `filter_rarity`,
   * and `prohibited_library_rarity` — either from a real LEFT JOIN / column or as a
   * literal fallback (0 / NULL). This keeps the result shape consistent for the mapper.
   *
   * @param qb      - Query builder with base columns already selected
   * @param league   - Optional league name for price-based rarity lookup
   * @param filterId - Optional filter ID for filter-based rarity lookup
   *
   * NOTE: The LEFT JOINs here (including to divination_card_availability)
   * are intentional. This method reads metadata for a specific known card —
   * it does not enumerate the league pool. A missing availability row is
   * handled via COALESCE defaults. This is distinct from the pool queries
   * in Sessions.repository.ts which start from divination_card_availability
   * to avoid inflating counts.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private withRarityJoins<T extends SelectQueryBuilder<any, any, any>>(
    qb: T,
    league?: string,
    filterId?: string | null,
    onlyInPool?: boolean,
  ) {
    // --- Price-based rarity ---
    // Effective rarity = user override if set, else system rarity, else 0 (Unknown)
    let query: SelectQueryBuilder<any, any, any> = league
      ? qb
          .leftJoin("divination_card_rarities as dcr", (join) =>
            join
              .onRef("dcr.card_name", "=", "dc.name")
              .onRef("dcr.game", "=", "dc.game")
              .on("dcr.league", "=", league),
          )
          .select(
            sql<number>`COALESCE(dcr.override_rarity, dcr.rarity, 0)`.as(
              "rarity",
            ),
          )
      : qb.select(sql<number>`0`.as("rarity"));

    // --- Filter-based rarity ---
    query = filterId
      ? query
          .leftJoin("filter_card_rarities as fcr", (join) =>
            join
              .onRef("fcr.card_name", "=", "dc.name")
              .on("fcr.filter_id", "=", filterId),
          )
          .select(sql<number | null>`fcr.rarity`.as("filter_rarity"))
      : query.select(sql<null>`NULL`.as("filter_rarity"));

    // --- Prohibited Library rarity ---
    // Read directly from divination_card_rarities (populated by syncCards Phase 2b).
    // No separate table join needed — dcr is already joined above.
    query = league
      ? query.select(
          sql<number | null>`dcr.prohibited_library_rarity`.as(
            "prohibited_library_rarity",
          ),
        )
      : query.select(sql<null>`NULL`.as("prohibited_library_rarity"));

    // --- Availability (from_boss, is_disabled, in_pool) ---
    if (league) {
      const availJoin = (join: any) =>
        join
          .onRef("dca.card_name", "=", "dc.name")
          .onRef("dca.game", "=", "dc.game")
          .on("dca.league", "=", league);

      const joined = onlyInPool
        ? query.innerJoin("divination_card_availability as dca", availJoin)
        : query.leftJoin("divination_card_availability as dca", availJoin);

      query = joined
        .select(sql<number>`COALESCE(dca.from_boss, 0)`.as("from_boss"))
        .select(sql<number>`COALESCE(dca.is_disabled, 0)`.as("is_disabled"))
        .select(
          sql<number>`CASE WHEN dca.card_name IS NOT NULL THEN 1 ELSE 0 END`.as(
            "in_pool",
          ),
        );
    } else {
      query = query
        .select(sql<number>`0`.as("from_boss"))
        .select(sql<number>`0`.as("is_disabled"))
        .select(sql<number>`1`.as("in_pool"));
    }

    return query;
  }

  /**
   * Get all cards for a specific game with rarities from a specific league.
   * Optionally joins with filter_card_rarities to provide filter-based rarity.
   *
   * @param game - The game type ("poe1" or "poe2")
   * @param league - Optional league name for price-based rarity lookup
   * @param filterId - Optional filter ID for filter-based rarity lookup
   */
  async getAllByGame(
    game: "poe1" | "poe2",
    league?: string,
    filterId?: string | null,
    onlyInPool?: boolean,
  ): Promise<DivinationCardDTO[]> {
    const base = this.kysely
      .selectFrom("divination_cards as dc")
      .select([...BASE_CARD_COLUMNS])
      .where("dc.game", "=", game);

    const query = this.withRarityJoins(base, league, filterId, onlyInPool);
    const rows = (await query
      .orderBy("dc.name", "asc")
      .execute()) as DivinationCardWithRarityRow[];

    return rows.map(DivinationCardsMapper.toDTO);
  }

  /**
   * Get a specific card by ID with rarity from a specific league.
   * Optionally joins with filter_card_rarities to provide filter-based rarity.
   *
   * @param id - The card ID (e.g., "poe1_a-chilling-wind")
   * @param league - Optional league name for price-based rarity lookup
   * @param filterId - Optional filter ID for filter-based rarity lookup
   */
  async getById(
    id: string,
    league?: string,
    filterId?: string | null,
  ): Promise<DivinationCardDTO | null> {
    const base = this.kysely
      .selectFrom("divination_cards as dc")
      .select([...BASE_CARD_COLUMNS])
      .where("dc.id", "=", id);

    const query = this.withRarityJoins(base, league, filterId);
    const row = (await query.executeTakeFirst()) as
      | DivinationCardWithRarityRow
      | undefined;

    return row ? DivinationCardsMapper.toDTO(row) : null;
  }

  /**
   * Get a specific card by name and game with rarity from a specific league.
   * Optionally joins with filter_card_rarities to provide filter-based rarity.
   *
   * @param game - The game type ("poe1" or "poe2")
   * @param name - The card name
   * @param league - Optional league name for price-based rarity lookup
   * @param filterId - Optional filter ID for filter-based rarity lookup
   */
  async getByName(
    game: "poe1" | "poe2",
    name: string,
    league?: string,
    filterId?: string | null,
  ): Promise<DivinationCardDTO | null> {
    const base = this.kysely
      .selectFrom("divination_cards as dc")
      .select([...BASE_CARD_COLUMNS])
      .where("dc.game", "=", game)
      .where("dc.name", "=", name);

    const query = this.withRarityJoins(base, league, filterId);
    const row = (await query.executeTakeFirst()) as
      | DivinationCardWithRarityRow
      | undefined;

    return row ? DivinationCardsMapper.toDTO(row) : null;
  }

  /**
   * Search cards by name (case-insensitive partial match) with rarities from a specific league.
   * Optionally joins with filter_card_rarities to provide filter-based rarity.
   *
   * @param game - The game type ("poe1" or "poe2")
   * @param query - The search query string
   * @param league - Optional league name for price-based rarity lookup
   * @param filterId - Optional filter ID for filter-based rarity lookup
   */
  async searchByName(
    game: "poe1" | "poe2",
    query: string,
    league?: string,
    filterId?: string | null,
  ): Promise<DivinationCardDTO[]> {
    const escaped = query.replace(/[%_\\]/g, "\\$&");

    const base = this.kysely
      .selectFrom("divination_cards as dc")
      .select([...BASE_CARD_COLUMNS])
      .where("dc.game", "=", game)
      .where(sql<SqlBool>`dc.name LIKE ${`%${escaped}%`} ESCAPE '\\'`);

    const qb = this.withRarityJoins(base, league, filterId);
    const rows = (await qb
      .orderBy("dc.name", "asc")
      .execute()) as DivinationCardWithRarityRow[];

    return rows.map(DivinationCardsMapper.toDTO);
  }

  /**
   * Get total count of cards for a game
   */
  async getCardCount(game: "poe1" | "poe2"): Promise<number> {
    const result = await this.kysely
      .selectFrom("divination_cards")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("game", "=", game)
      .executeTakeFirst();

    return result?.count ?? 0;
  }

  /**
   * Check if a card exists
   */
  async cardExists(game: "poe1" | "poe2", name: string): Promise<boolean> {
    const id = this.generateId(game, name);
    const result = await this.kysely
      .selectFrom("divination_cards")
      .select(sql`1`.as("exists"))
      .where("id", "=", id)
      .limit(1)
      .executeTakeFirst();

    return result !== undefined;
  }

  /**
   * Batch-fetch all card hashes for a game.
   * Returns a Map of card name → data_hash.
   */
  async getAllCardHashes(game: "poe1" | "poe2"): Promise<Map<string, string>> {
    const rows = await this.kysely
      .selectFrom("divination_cards")
      .select(["name", "data_hash"])
      .where("game", "=", game)
      .execute();

    const map = new Map<string, string>();
    for (const row of rows) {
      if (row.data_hash) {
        map.set(row.name, row.data_hash);
      }
    }
    return map;
  }

  /**
   * Get card hash by name
   */
  async getCardHash(
    game: "poe1" | "poe2",
    name: string,
  ): Promise<string | null> {
    const id = this.generateId(game, name);
    const result = await this.kysely
      .selectFrom("divination_cards")
      .select("data_hash")
      .where("id", "=", id)
      .executeTakeFirst();

    return result?.data_hash ?? null;
  }

  /**
   * Insert a new card
   */
  async insertCard(
    game: "poe1" | "poe2",
    name: string,
    stackSize: number,
    description: string,
    rewardHtml: string,
    artSrc: string,
    flavourHtml: string,
    dataHash: string,
  ): Promise<void> {
    const id = this.generateId(game, name);

    await this.kysely
      .insertInto("divination_cards")
      .values({
        id,
        game,
        name,
        stack_size: stackSize,
        description,
        reward_html: rewardHtml,
        art_src: artSrc,
        flavour_html: flavourHtml,
        data_hash: dataHash,
      })
      .execute();
  }

  /**
   * Update an existing card
   */
  async updateCard(
    game: "poe1" | "poe2",
    name: string,
    stackSize: number,
    description: string,
    rewardHtml: string,
    artSrc: string,
    flavourHtml: string,
    dataHash: string,
  ): Promise<void> {
    const id = this.generateId(game, name);

    await this.kysely
      .updateTable("divination_cards")
      .set({
        stack_size: stackSize,
        description,
        reward_html: rewardHtml,
        art_src: artSrc,
        flavour_html: flavourHtml,
        data_hash: dataHash,
        updated_at: sql`datetime('now')`,
      })
      .where("id", "=", id)
      .execute();
  }

  /**
   * Get last updated timestamp for a game
   */
  async getLastUpdated(game: "poe1" | "poe2"): Promise<string | null> {
    const result = await this.kysely
      .selectFrom("divination_cards")
      .select((eb) => eb.fn.max("updated_at").as("last_updated"))
      .where("game", "=", game)
      .executeTakeFirst();

    return result?.last_updated ?? null;
  }

  /**
   * Update rarity for a specific card in a specific league.
   *
   * @param clearOverride - When true, sets override_rarity to NULL (used when
   *   the system has medium/high confidence data and should replace any user override).
   *   When false, preserves any existing override_rarity.
   */
  async updateRarity(
    game: "poe1" | "poe2",
    league: string,
    name: string,
    rarity: Rarity,
    clearOverride: boolean = false,
  ): Promise<void> {
    const updateSet: Record<string, any> = {
      rarity,
      last_updated: sql`datetime('now')`,
    };

    if (clearOverride) {
      updateSet.override_rarity = null;
    }

    await this.kysely
      .insertInto("divination_card_rarities")
      .values({
        game,
        league,
        card_name: name,
        rarity,
        override_rarity: null,
        last_updated: sql`datetime('now')`,
      })
      .onConflict((oc) =>
        oc.columns(["game", "league", "card_name"]).doUpdateSet(updateSet),
      )
      .execute();
  }

  /**
   * Bulk update rarities for multiple cards in a specific league
   */
  async updateRarities(
    game: "poe1" | "poe2",
    league: string,
    updates: Array<{ name: string; rarity: Rarity; clearOverride?: boolean }>,
  ): Promise<void> {
    if (updates.length === 0) return;

    const clearGroup = updates.filter((u) => u.clearOverride ?? false);
    const keepGroup = updates.filter((u) => !(u.clearOverride ?? false));

    await this.kysely.transaction().execute(async (trx) => {
      if (clearGroup.length > 0) {
        await trx
          .insertInto("divination_card_rarities")
          .values(
            clearGroup.map(({ name, rarity }) => ({
              game,
              league,
              card_name: name,
              rarity,
              override_rarity: null,
              last_updated: sql`datetime('now')`,
            })),
          )
          .onConflict((oc) =>
            oc.columns(["game", "league", "card_name"]).doUpdateSet({
              rarity: sql`excluded.rarity`,
              override_rarity: null,
              last_updated: sql`datetime('now')`,
            }),
          )
          .execute();
      }

      if (keepGroup.length > 0) {
        await trx
          .insertInto("divination_card_rarities")
          .values(
            keepGroup.map(({ name, rarity }) => ({
              game,
              league,
              card_name: name,
              rarity,
              override_rarity: null,
              last_updated: sql`datetime('now')`,
            })),
          )
          .onConflict((oc) =>
            oc.columns(["game", "league", "card_name"]).doUpdateSet({
              rarity: sql`excluded.rarity`,
              last_updated: sql`datetime('now')`,
            }),
          )
          .execute();
      }
    });
  }

  /**
   * Set a user override rarity for a specific card.
   * This is used when a user manually changes the rarity of a card
   * (typically for cards with rarity 0 / Unknown).
   */
  async setOverrideRarity(
    game: "poe1" | "poe2",
    league: string,
    name: string,
    overrideRarity: Rarity | null,
  ): Promise<void> {
    await this.kysely
      .updateTable("divination_card_rarities")
      .set({
        override_rarity: overrideRarity,
        last_updated: sql`datetime('now')`,
      })
      .where("game", "=", game)
      .where("league", "=", league)
      .where("card_name", "=", name)
      .execute();
  }

  /**
   * Get all card names for a specific game.
   * Used when applying filter rarities to determine which cards
   * are not covered by the filter (and should default to rarity 4).
   */
  async getAllCardNames(game: "poe1" | "poe2"): Promise<string[]> {
    const rows = await this.kysely
      .selectFrom("divination_cards")
      .select("name")
      .where("game", "=", game)
      .orderBy("name", "asc")
      .execute();

    return rows.map((row) => row.name);
  }

  /**
   * Bulk-insert minimal stub rows for cards discovered in poe.ninja
   * snapshots that don't yet exist in `divination_cards`.
   *
   * Uses `INSERT OR IGNORE` so existing cards are never overwritten.
   * Stub rows have empty metadata (description, reward_html, art_src,
   * flavour_html) and stack_size = 1. They will be upgraded with full
   * data the next time `syncCards()` processes an updated `cards.json`.
   *
   * @param game  - The game type ("poe1" or "poe2")
   * @param names - Card names to ensure exist
   * @param hashFn - Function to compute the data_hash for each stub
   * @returns The number of rows actually inserted (ignores duplicates)
   */
  async insertStubCards(
    game: "poe1" | "poe2",
    names: string[],
    hashFn: (name: string) => string,
  ): Promise<number> {
    if (names.length === 0) return 0;

    let inserted = 0;

    await this.kysely.transaction().execute(async (trx) => {
      for (const name of names) {
        const id = this.generateId(game, name);
        const result = await trx
          .insertInto("divination_cards")
          .values({
            id,
            game,
            name,
            stack_size: 1,
            description: "",
            reward_html: "",
            art_src: "",
            flavour_html: "",
            data_hash: hashFn(name),
          })
          .onConflict((oc) => oc.column("id").doNothing())
          .executeTakeFirst();

        // SQLite returns numInsertedOrUpdatedRows = 0 for ignored conflicts
        if (
          result.numInsertedOrUpdatedRows !== undefined &&
          Number(result.numInsertedOrUpdatedRows) > 0
        ) {
          inserted++;
        }
      }
    });

    return inserted;
  }
}
