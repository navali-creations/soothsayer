import { type Kysely, sql } from "kysely";

import type { Database } from "~/main/modules/database";
import type { Rarity } from "~/types/data-stores";

import type { DivinationCardDTO } from "./DivinationCards.dto";
import { DivinationCardsMapper } from "./DivinationCards.mapper";

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
  ): Promise<DivinationCardDTO[]> {
    let query = this.kysely
      .selectFrom("divination_cards as dc")
      .select([
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
      ])
      .where("dc.game", "=", game);

    // Join with price-based rarities if league is provided
    // Effective rarity = user override if set, else system rarity, else 0 (Unknown)
    if (league) {
      query = query
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
        );
    } else {
      query = query.select(sql<number>`0`.as("rarity"));
    }

    // Join with filter-based rarities if filterId is provided
    if (filterId) {
      query = query
        .leftJoin("filter_card_rarities as fcr", (join) =>
          join
            .onRef("fcr.card_name", "=", "dc.name")
            .on("fcr.filter_id", "=", filterId),
        )
        .select(sql<number | null>`fcr.rarity`.as("filter_rarity"));
    } else {
      query = query.select(sql<null>`NULL`.as("filter_rarity"));
    }

    const rows = await query.orderBy("dc.name", "asc").execute();

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
    let query = this.kysely
      .selectFrom("divination_cards as dc")
      .select([
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
      ])
      .where("dc.id", "=", id);

    if (league) {
      query = query
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
        );
    } else {
      query = query.select(sql<number>`0`.as("rarity"));
    }

    if (filterId) {
      query = query
        .leftJoin("filter_card_rarities as fcr", (join) =>
          join
            .onRef("fcr.card_name", "=", "dc.name")
            .on("fcr.filter_id", "=", filterId),
        )
        .select(sql<number | null>`fcr.rarity`.as("filter_rarity"));
    } else {
      query = query.select(sql<null>`NULL`.as("filter_rarity"));
    }

    const row = await query.executeTakeFirst();

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
    let query = this.kysely
      .selectFrom("divination_cards as dc")
      .select([
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
      ])
      .where("dc.game", "=", game)
      .where("dc.name", "=", name);

    if (league) {
      query = query
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
        );
    } else {
      query = query.select(sql<number>`0`.as("rarity"));
    }

    if (filterId) {
      query = query
        .leftJoin("filter_card_rarities as fcr", (join) =>
          join
            .onRef("fcr.card_name", "=", "dc.name")
            .on("fcr.filter_id", "=", filterId),
        )
        .select(sql<number | null>`fcr.rarity`.as("filter_rarity"));
    } else {
      query = query.select(sql<null>`NULL`.as("filter_rarity"));
    }

    const row = await query.executeTakeFirst();

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
    let queryBuilder = this.kysely
      .selectFrom("divination_cards as dc")
      .select([
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
      ])
      .where("dc.game", "=", game)
      .where("dc.name", "like", `%${query}%`);

    if (league) {
      queryBuilder = queryBuilder
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
        );
    } else {
      queryBuilder = queryBuilder.select(sql<number>`0`.as("rarity"));
    }

    if (filterId) {
      queryBuilder = queryBuilder
        .leftJoin("filter_card_rarities as fcr", (join) =>
          join
            .onRef("fcr.card_name", "=", "dc.name")
            .on("fcr.filter_id", "=", filterId),
        )
        .select(sql<number | null>`fcr.rarity`.as("filter_rarity"));
    } else {
      queryBuilder = queryBuilder.select(sql<null>`NULL`.as("filter_rarity"));
    }

    const rows = await queryBuilder.orderBy("dc.name", "asc").execute();

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
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("id", "=", id)
      .executeTakeFirst();

    return (result?.count ?? 0) > 0;
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
    // Use transaction for bulk updates
    for (const { name, rarity, clearOverride } of updates) {
      await this.updateRarity(
        game,
        league,
        name,
        rarity,
        clearOverride ?? false,
      );
    }
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
}
