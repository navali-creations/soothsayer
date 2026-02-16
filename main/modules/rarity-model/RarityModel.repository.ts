import { type Kysely, sql } from "kysely";

import type { Database } from "~/main/modules/database";
import type { KnownRarity } from "~/types/data-stores";

import type {
  RarityModelCardRarityDTO,
  RarityModelFilterType,
  RarityModelMetadataDTO,
} from "./RarityModel.dto";
import { RarityModelMapper } from "./RarityModel.mapper";

/**
 * Repository for Filter module database operations.
 * Handles CRUD for filter_metadata and filter_card_rarities tables.
 */
export class RarityModelRepository {
  constructor(private kysely: Kysely<Database>) {}

  // ============================================================================
  // Filter Metadata Operations
  // ============================================================================

  /**
   * Get all filter metadata records
   */
  async getAll(): Promise<RarityModelMetadataDTO[]> {
    const rows = await this.kysely
      .selectFrom("filter_metadata")
      .selectAll()
      .orderBy("filter_name", "asc")
      .execute();

    return rows.map(RarityModelMapper.toRarityModelMetadataDTO);
  }

  /**
   * Get all filter metadata records of a specific type
   */
  async getAllByType(
    filterType: RarityModelFilterType,
  ): Promise<RarityModelMetadataDTO[]> {
    const rows = await this.kysely
      .selectFrom("filter_metadata")
      .selectAll()
      .where("filter_type", "=", filterType)
      .orderBy("filter_name", "asc")
      .execute();

    return rows.map(RarityModelMapper.toRarityModelMetadataDTO);
  }

  /**
   * Get a filter metadata record by ID
   */
  async getById(id: string): Promise<RarityModelMetadataDTO | null> {
    const row = await this.kysely
      .selectFrom("filter_metadata")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? RarityModelMapper.toRarityModelMetadataDTO(row) : null;
  }

  /**
   * Get a filter metadata record by file path
   */
  async getByFilePath(
    filePath: string,
  ): Promise<RarityModelMetadataDTO | null> {
    const row = await this.kysely
      .selectFrom("filter_metadata")
      .selectAll()
      .where("file_path", "=", filePath)
      .executeTakeFirst();

    return row ? RarityModelMapper.toRarityModelMetadataDTO(row) : null;
  }

  /**
   * Upsert a filter metadata record.
   * Uses file_path as the conflict key since it's unique per filter file.
   */
  async upsert(data: {
    id: string;
    filterType: RarityModelFilterType;
    filePath: string;
    filterName: string;
    lastUpdate: string | null;
    isFullyParsed: boolean;
    parsedAt: string | null;
  }): Promise<void> {
    await this.kysely
      .insertInto("filter_metadata")
      .values({
        id: data.id,
        filter_type: data.filterType,
        file_path: data.filePath,
        filter_name: data.filterName,
        last_update: data.lastUpdate,
        is_fully_parsed: data.isFullyParsed ? 1 : 0,
        parsed_at: data.parsedAt,
      })
      .onConflict((oc) =>
        oc.column("file_path").doUpdateSet({
          filter_name: data.filterName,
          last_update: data.lastUpdate,
          is_fully_parsed: data.isFullyParsed ? 1 : 0,
          parsed_at: data.parsedAt,
          updated_at: sql`datetime('now')`,
        }),
      )
      .execute();
  }

  /**
   * Bulk upsert filter metadata records within a transaction.
   */
  async upsertMany(
    filters: Array<{
      id: string;
      filterType: RarityModelFilterType;
      filePath: string;
      filterName: string;
      lastUpdate: string | null;
      isFullyParsed: boolean;
      parsedAt: string | null;
    }>,
  ): Promise<void> {
    if (filters.length === 0) return;

    await this.kysely.transaction().execute(async (trx) => {
      for (const data of filters) {
        await trx
          .insertInto("filter_metadata")
          .values({
            id: data.id,
            filter_type: data.filterType,
            file_path: data.filePath,
            filter_name: data.filterName,
            last_update: data.lastUpdate,
            is_fully_parsed: data.isFullyParsed ? 1 : 0,
            parsed_at: data.parsedAt,
          })
          .onConflict((oc) =>
            oc.column("file_path").doUpdateSet({
              filter_name: data.filterName,
              last_update: data.lastUpdate,
              is_fully_parsed: data.isFullyParsed ? 1 : 0,
              parsed_at: data.parsedAt,
              updated_at: sql`datetime('now')`,
            }),
          )
          .execute();
      }
    });
  }

  /**
   * Mark a filter as fully parsed and update its parsed_at timestamp
   */
  async markAsParsed(filterId: string): Promise<void> {
    const now = new Date().toISOString();

    await this.kysely
      .updateTable("filter_metadata")
      .set({
        is_fully_parsed: 1,
        parsed_at: now,
        updated_at: sql`datetime('now')`,
      })
      .where("id", "=", filterId)
      .execute();
  }

  /**
   * Delete a filter metadata record by ID.
   * Cascade will also delete associated filter_card_rarities.
   */
  async deleteById(id: string): Promise<void> {
    await this.kysely
      .deleteFrom("filter_metadata")
      .where("id", "=", id)
      .execute();
  }

  /**
   * Delete filter metadata records whose file paths are NOT in the provided list.
   * This is used to clean up stale entries after a scan (filters that no longer
   * exist on disk). Returns the number of deleted rows.
   */
  async deleteNotInFilePaths(filePaths: string[]): Promise<number> {
    if (filePaths.length === 0) {
      // If no file paths provided, delete all filter metadata
      const result = await this.kysely
        .deleteFrom("filter_metadata")
        .executeTakeFirst();

      return Number(result.numDeletedRows || 0);
    }

    const result = await this.kysely
      .deleteFrom("filter_metadata")
      .where("file_path", "not in", filePaths)
      .executeTakeFirst();

    return Number(result.numDeletedRows || 0);
  }

  // ============================================================================
  // Filter Card Rarities Operations
  // ============================================================================

  /**
   * Get all card rarities for a specific filter
   */
  async getCardRarities(filterId: string): Promise<RarityModelCardRarityDTO[]> {
    const rows = await this.kysely
      .selectFrom("filter_card_rarities")
      .selectAll()
      .where("filter_id", "=", filterId)
      .orderBy("card_name", "asc")
      .execute();

    return rows.map(RarityModelMapper.toRarityModelCardRarityDTO);
  }

  /**
   * Get the rarity for a specific card in a specific filter
   */
  async getCardRarity(
    filterId: string,
    cardName: string,
  ): Promise<RarityModelCardRarityDTO | null> {
    const row = await this.kysely
      .selectFrom("filter_card_rarities")
      .selectAll()
      .where("filter_id", "=", filterId)
      .where("card_name", "=", cardName)
      .executeTakeFirst();

    return row ? RarityModelMapper.toRarityModelCardRarityDTO(row) : null;
  }

  /**
   * Replace all card rarities for a filter.
   * Deletes existing rarities and inserts new ones in a single transaction.
   * This is the expected flow after a full parse of a filter file.
   */
  async replaceCardRarities(
    filterId: string,
    rarities: Array<{ cardName: string; rarity: KnownRarity }>,
  ): Promise<void> {
    await this.kysely.transaction().execute(async (trx) => {
      // Delete existing rarities for this filter
      await trx
        .deleteFrom("filter_card_rarities")
        .where("filter_id", "=", filterId)
        .execute();

      // Insert new rarities
      if (rarities.length > 0) {
        // SQLite has a limit on the number of variables per statement,
        // so we batch inserts in chunks of 500
        const BATCH_SIZE = 500;
        for (let i = 0; i < rarities.length; i += BATCH_SIZE) {
          const batch = rarities.slice(i, i + BATCH_SIZE);
          await trx
            .insertInto("filter_card_rarities")
            .values(
              batch.map((r) => ({
                filter_id: filterId,
                card_name: r.cardName,
                rarity: r.rarity,
              })),
            )
            .execute();
        }
      }
    });
  }

  /**
   * Update (upsert) the rarity for a single card within a specific filter.
   * Inserts if the card doesn't exist in the filter yet, updates if it does.
   */
  async updateCardRarity(
    filterId: string,
    cardName: string,
    rarity: KnownRarity,
  ): Promise<void> {
    await this.kysely
      .insertInto("filter_card_rarities")
      .values({
        filter_id: filterId,
        card_name: cardName,
        rarity,
      })
      .onConflict((oc) =>
        oc.columns(["filter_id", "card_name"]).doUpdateSet({
          rarity,
        }),
      )
      .execute();
  }

  /**
   * Delete all card rarities for a specific filter
   */
  async deleteCardRarities(filterId: string): Promise<void> {
    await this.kysely
      .deleteFrom("filter_card_rarities")
      .where("filter_id", "=", filterId)
      .execute();
  }

  /**
   * Get the count of card rarities for a specific filter
   */
  async getCardRarityCount(filterId: string): Promise<number> {
    const result = await this.kysely
      .selectFrom("filter_card_rarities")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("filter_id", "=", filterId)
      .executeTakeFirstOrThrow();

    return result.count;
  }
}
