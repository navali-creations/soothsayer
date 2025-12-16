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
   * Get all cards for a specific game
   */
  async getAllByGame(game: "poe1" | "poe2"): Promise<DivinationCardDTO[]> {
    const rows = await this.kysely
      .selectFrom("divination_cards")
      .selectAll()
      .where("game", "=", game)
      .orderBy("name", "asc")
      .execute();

    return rows.map(DivinationCardsMapper.toDTO);
  }

  /**
   * Get a specific card by ID
   */
  async getById(id: string): Promise<DivinationCardDTO | null> {
    const row = await this.kysely
      .selectFrom("divination_cards")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? DivinationCardsMapper.toDTO(row) : null;
  }

  /**
   * Get a specific card by name and game
   */
  async getByName(
    game: "poe1" | "poe2",
    name: string,
  ): Promise<DivinationCardDTO | null> {
    const row = await this.kysely
      .selectFrom("divination_cards")
      .selectAll()
      .where("game", "=", game)
      .where("name", "=", name)
      .executeTakeFirst();

    return row ? DivinationCardsMapper.toDTO(row) : null;
  }

  /**
   * Search cards by name (case-insensitive partial match)
   */
  async searchByName(
    game: "poe1" | "poe2",
    query: string,
  ): Promise<DivinationCardDTO[]> {
    const rows = await this.kysely
      .selectFrom("divination_cards")
      .selectAll()
      .where("game", "=", game)
      .where("name", "like", `%${query}%`)
      .orderBy("name", "asc")
      .execute();

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
}
