import { type Kysely, sql } from "kysely";

import type { Database } from "~/main/modules/database";
import type { KnownRarity } from "~/types/data-stores";

import type {
  FilterTierStyleDTO,
  RarityInsightsCardRarityDTO,
  RarityInsightsFilterType,
  RarityInsightsMetadataDTO,
} from "./RarityInsights.dto";
import { RarityInsightsMapper } from "./RarityInsights.mapper";

/**
 * Repository for Filter module database operations.
 * Handles CRUD for filter_metadata and filter_card_rarities tables.
 */
export class RarityInsightsRepository {
  constructor(private kysely: Kysely<Database>) {}

  // ============================================================================
  // Filter Metadata Operations
  // ============================================================================

  /**
   * Get all filter metadata records
   */
  async getAll(): Promise<RarityInsightsMetadataDTO[]> {
    const rows = await this.kysely
      .selectFrom("filter_metadata")
      .selectAll()
      .orderBy("filter_name", "asc")
      .execute();

    return rows.map(RarityInsightsMapper.toRarityInsightsMetadataDTO);
  }

  /**
   * Get all filter metadata records of a specific type
   */
  async getAllByType(
    filterType: RarityInsightsFilterType,
  ): Promise<RarityInsightsMetadataDTO[]> {
    const rows = await this.kysely
      .selectFrom("filter_metadata")
      .selectAll()
      .where("filter_type", "=", filterType)
      .orderBy("filter_name", "asc")
      .execute();

    return rows.map(RarityInsightsMapper.toRarityInsightsMetadataDTO);
  }

  /**
   * Get a filter metadata record by ID
   */
  async getById(id: string): Promise<RarityInsightsMetadataDTO | null> {
    const row = await this.kysely
      .selectFrom("filter_metadata")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row ? RarityInsightsMapper.toRarityInsightsMetadataDTO(row) : null;
  }

  /**
   * Get a filter metadata record by file path
   */
  async getByFilePath(
    filePath: string,
  ): Promise<RarityInsightsMetadataDTO | null> {
    const row = await this.kysely
      .selectFrom("filter_metadata")
      .selectAll()
      .where("file_path", "=", filePath)
      .executeTakeFirst();

    return row ? RarityInsightsMapper.toRarityInsightsMetadataDTO(row) : null;
  }

  /**
   * Upsert a filter metadata record.
   * Uses file_path as the conflict key since it's unique per filter file.
   */
  async upsert(data: {
    id: string;
    filterType: RarityInsightsFilterType;
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
      filterType: RarityInsightsFilterType;
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
   * Retained filter IDs are kept even when their paths are missing from the
   * latest scan, so selected filter labels stay available across transient scan
   * misses. Returns the number of deleted rows.
   */
  async deleteNotInFilePaths(
    filePaths: string[],
    retainFilterIds: string[] = [],
  ): Promise<number> {
    const result = await this.kysely
      .deleteFrom("filter_metadata")
      .$if(filePaths.length > 0, (qb) =>
        qb.where("file_path", "not in", filePaths),
      )
      .$if(retainFilterIds.length > 0, (qb) =>
        qb.where("id", "not in", retainFilterIds),
      )
      .executeTakeFirst();

    return Number(result.numDeletedRows || 0);
  }

  // ============================================================================
  // Filter Card Rarities Operations
  // ============================================================================

  /**
   * Get all card rarities for a specific filter
   */
  async getCardRarities(
    filterId: string,
  ): Promise<RarityInsightsCardRarityDTO[]> {
    const rows = await this.kysely
      .selectFrom("filter_card_rarities")
      .selectAll()
      .where("filter_id", "=", filterId)
      .orderBy("card_name", "asc")
      .execute();

    return rows.map(RarityInsightsMapper.toRarityInsightsCardRarityDTO);
  }

  /**
   * Get the rarity for a specific card in a specific filter
   */
  async getCardRarity(
    filterId: string,
    cardName: string,
  ): Promise<RarityInsightsCardRarityDTO | null> {
    const row = await this.kysely
      .selectFrom("filter_card_rarities")
      .selectAll()
      .where("filter_id", "=", filterId)
      .where("card_name", "=", cardName)
      .executeTakeFirst();

    return row ? RarityInsightsMapper.toRarityInsightsCardRarityDTO(row) : null;
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

  async replaceParsedFilterData(
    filterId: string,
    rarities: Array<{ cardName: string; rarity: KnownRarity }>,
    tierStyles: Array<Omit<FilterTierStyleDTO, "filterId">>,
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.kysely.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("filter_card_rarities")
        .where("filter_id", "=", filterId)
        .execute();

      await trx
        .deleteFrom("filter_tier_styles")
        .where("filter_id", "=", filterId)
        .execute();

      if (rarities.length > 0) {
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

      if (tierStyles.length > 0) {
        await trx
          .insertInto("filter_tier_styles")
          .values(
            tierStyles.map((style) => ({
              filter_id: filterId,
              rarity: style.rarity,
              ...toFilterTierStyleColumns(style),
            })),
          )
          .execute();
      }

      await trx
        .updateTable("filter_metadata")
        .set({
          is_fully_parsed: 1,
          parsed_at: now,
          updated_at: sql`datetime('now')`,
        })
        .where("id", "=", filterId)
        .execute();
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

  async getTierStyles(filterId: string): Promise<FilterTierStyleDTO[]> {
    const rows = await this.kysely
      .selectFrom("filter_tier_styles")
      .selectAll()
      .where("filter_id", "=", filterId)
      .orderBy("rarity", "asc")
      .execute();

    return rows.map(RarityInsightsMapper.toFilterTierStyleDTO);
  }

  async replaceTierStyles(
    filterId: string,
    tierStyles: Array<Omit<FilterTierStyleDTO, "filterId">>,
  ): Promise<void> {
    await this.kysely.transaction().execute(async (trx) => {
      await trx
        .deleteFrom("filter_tier_styles")
        .where("filter_id", "=", filterId)
        .execute();

      if (tierStyles.length === 0) {
        return;
      }

      await trx
        .insertInto("filter_tier_styles")
        .values(
          tierStyles.map((style) => ({
            filter_id: filterId,
            rarity: style.rarity,
            ...toFilterTierStyleColumns(style),
          })),
        )
        .execute();
    });
  }

  async getTierStyleCount(filterId: string): Promise<number> {
    const result = await this.kysely
      .selectFrom("filter_tier_styles")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("filter_id", "=", filterId)
      .executeTakeFirstOrThrow();

    return result.count;
  }
}

function toFilterTierStyleColumns(style: Omit<FilterTierStyleDTO, "filterId">) {
  return {
    bg_r: style.bgColor?.r ?? null,
    bg_g: style.bgColor?.g ?? null,
    bg_b: style.bgColor?.b ?? null,
    bg_a: style.bgColor?.a ?? null,
    text_r: style.textColor?.r ?? null,
    text_g: style.textColor?.g ?? null,
    text_b: style.textColor?.b ?? null,
    text_a: style.textColor?.a ?? null,
    border_r: style.borderColor?.r ?? null,
    border_g: style.borderColor?.g ?? null,
    border_b: style.borderColor?.b ?? null,
    border_a: style.borderColor?.a ?? null,
  };
}
