import { sql, type Kysely } from "kysely";
import type { Database } from "../database/Database.types";
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
   * Get all cards for a specific game with rarities from a specific league
   */
  async getAllByGame(
    game: "poe1" | "poe2",
    league?: string,
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

    if (league) {
      // Join with rarities table for the specific league
      const rows = await query
        .leftJoin("divination_card_rarities as dcr", (join) =>
          join
            .onRef("dcr.card_name", "=", "dc.name")
            .onRef("dcr.game", "=", "dc.game")
            .on("dcr.league", "=", league),
        )
        .select(sql<number>`COALESCE(dcr.rarity, 4)`.as("rarity"))
        .orderBy("dc.name", "asc")
        .execute();

      return rows.map(DivinationCardsMapper.toDTO);
    } else {
      // No league specified, use default rarity
      const rows = await query
        .select(sql<number>`4`.as("rarity"))
        .orderBy("dc.name", "asc")
        .execute();

      return rows.map(DivinationCardsMapper.toDTO);
    }
  }

  /**
   * Get a specific card by ID with rarity from a specific league
   */
  async getById(
    id: string,
    league?: string,
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
      const row = await query
        .leftJoin("divination_card_rarities as dcr", (join) =>
          join
            .onRef("dcr.card_name", "=", "dc.name")
            .onRef("dcr.game", "=", "dc.game")
            .on("dcr.league", "=", league),
        )
        .select(sql<number>`COALESCE(dcr.rarity, 4)`.as("rarity"))
        .executeTakeFirst();

      return row ? DivinationCardsMapper.toDTO(row) : null;
    } else {
      const row = await query
        .select(sql<number>`4`.as("rarity"))
        .executeTakeFirst();

      return row ? DivinationCardsMapper.toDTO(row) : null;
    }
  }

  /**
   * Get a specific card by name and game with rarity from a specific league
   */
  async getByName(
    game: "poe1" | "poe2",
    name: string,
    league?: string,
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
      const row = await query
        .leftJoin("divination_card_rarities as dcr", (join) =>
          join
            .onRef("dcr.card_name", "=", "dc.name")
            .onRef("dcr.game", "=", "dc.game")
            .on("dcr.league", "=", league),
        )
        .select(sql<number>`COALESCE(dcr.rarity, 4)`.as("rarity"))
        .executeTakeFirst();

      return row ? DivinationCardsMapper.toDTO(row) : null;
    } else {
      const row = await query
        .select(sql<number>`4`.as("rarity"))
        .executeTakeFirst();

      return row ? DivinationCardsMapper.toDTO(row) : null;
    }
  }

  /**
   * Search cards by name (case-insensitive partial match) with rarities from a specific league
   */
  async searchByName(
    game: "poe1" | "poe2",
    query: string,
    league?: string,
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
      const rows = await queryBuilder
        .leftJoin("divination_card_rarities as dcr", (join) =>
          join
            .onRef("dcr.card_name", "=", "dc.name")
            .onRef("dcr.game", "=", "dc.game")
            .on("dcr.league", "=", league),
        )
        .select(sql<number>`COALESCE(dcr.rarity, 4)`.as("rarity"))
        .orderBy("dc.name", "asc")
        .execute();

      return rows.map(DivinationCardsMapper.toDTO);
    } else {
      const rows = await queryBuilder
        .select(sql<number>`4`.as("rarity"))
        .orderBy("dc.name", "asc")
        .execute();

      return rows.map(DivinationCardsMapper.toDTO);
    }
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
   * Update rarity for a specific card in a specific league
   */
  async updateRarity(
    game: "poe1" | "poe2",
    league: string,
    name: string,
    rarity: number,
  ): Promise<void> {
    await this.kysely
      .insertInto("divination_card_rarities")
      .values({
        game,
        league,
        card_name: name,
        rarity,
        last_updated: sql`datetime('now')`,
      })
      .onConflict((oc) =>
        oc.columns(["game", "league", "card_name"]).doUpdateSet({
          rarity,
          last_updated: sql`datetime('now')`,
        }),
      )
      .execute();
  }

  /**
   * Bulk update rarities for multiple cards in a specific league
   */
  async updateRarities(
    game: "poe1" | "poe2",
    league: string,
    updates: Array<{ name: string; rarity: number }>,
  ): Promise<void> {
    // Use transaction for bulk updates
    for (const { name, rarity } of updates) {
      await this.updateRarity(game, league, name, rarity);
    }
  }
}
