import type { Kysely } from "kysely";

import type { Database } from "~/main/modules/database";

import type {
  PoeLeagueCacheDTO,
  PoeLeaguesCacheMetadataDTO,
  UpsertPoeLeagueCacheDTO,
} from "./PoeLeagues.dto";
import { PoeLeaguesMapper } from "./PoeLeagues.mapper";

/**
 * Repository for POE Leagues Cache
 * Handles all database operations using Kysely
 */
export class PoeLeaguesRepository {
  constructor(private kysely: Kysely<Database>) {}

  // ============================================================================
  // League Cache Operations
  // ============================================================================

  /**
   * Get all cached leagues for a specific game
   */
  async getLeaguesByGame(game: "poe1" | "poe2"): Promise<PoeLeagueCacheDTO[]> {
    const rows = await this.kysely
      .selectFrom("poe_leagues_cache")
      .selectAll()
      .where("game", "=", game)
      .orderBy("name", "asc")
      .execute();

    return rows.map(PoeLeaguesMapper.toPoeLeagueCacheDTO);
  }

  /**
   * Get all active cached leagues for a specific game
   */
  async getActiveLeaguesByGame(
    game: "poe1" | "poe2",
  ): Promise<PoeLeagueCacheDTO[]> {
    const rows = await this.kysely
      .selectFrom("poe_leagues_cache")
      .selectAll()
      .where("game", "=", game)
      .where("is_active", "=", 1)
      .orderBy("name", "asc")
      .execute();

    return rows.map(PoeLeaguesMapper.toPoeLeagueCacheDTO);
  }

  /**
   * Get a specific league by game and league_id
   */
  async getLeague(
    game: "poe1" | "poe2",
    leagueId: string,
  ): Promise<PoeLeagueCacheDTO | null> {
    const row = await this.kysely
      .selectFrom("poe_leagues_cache")
      .selectAll()
      .where("game", "=", game)
      .where("league_id", "=", leagueId)
      .executeTakeFirst();

    return row ? PoeLeaguesMapper.toPoeLeagueCacheDTO(row) : null;
  }

  /**
   * Upsert a league into the cache
   * Uses INSERT OR REPLACE to handle both insert and update
   */
  async upsertLeague(data: UpsertPoeLeagueCacheDTO): Promise<void> {
    await this.kysely
      .insertInto("poe_leagues_cache")
      .values({
        id: data.id,
        game: data.game,
        league_id: data.leagueId,
        name: data.name,
        start_at: data.startAt,
        end_at: data.endAt,
        is_active: data.isActive ? 1 : 0,
        updated_at: data.updatedAt,
        fetched_at: data.fetchedAt,
      })
      .onConflict((oc) =>
        oc.columns(["game", "league_id"]).doUpdateSet({
          id: data.id,
          name: data.name,
          start_at: data.startAt,
          end_at: data.endAt,
          is_active: data.isActive ? 1 : 0,
          updated_at: data.updatedAt,
          fetched_at: data.fetchedAt,
        }),
      )
      .execute();
  }

  /**
   * Bulk upsert leagues into the cache
   * More efficient than individual upserts
   */
  async upsertLeagues(leagues: UpsertPoeLeagueCacheDTO[]): Promise<void> {
    if (leagues.length === 0) return;

    // Use a transaction for atomicity
    await this.kysely.transaction().execute(async (trx) => {
      for (const data of leagues) {
        await trx
          .insertInto("poe_leagues_cache")
          .values({
            id: data.id,
            game: data.game,
            league_id: data.leagueId,
            name: data.name,
            start_at: data.startAt,
            end_at: data.endAt,
            is_active: data.isActive ? 1 : 0,
            updated_at: data.updatedAt,
            fetched_at: data.fetchedAt,
          })
          .onConflict((oc) =>
            oc.columns(["game", "league_id"]).doUpdateSet({
              id: data.id,
              name: data.name,
              start_at: data.startAt,
              end_at: data.endAt,
              is_active: data.isActive ? 1 : 0,
              updated_at: data.updatedAt,
              fetched_at: data.fetchedAt,
            }),
          )
          .execute();
      }
    });
  }

  /**
   * Delete all cached leagues for a specific game
   */
  async deleteLeaguesByGame(game: "poe1" | "poe2"): Promise<void> {
    await this.kysely
      .deleteFrom("poe_leagues_cache")
      .where("game", "=", game)
      .execute();
  }

  /**
   * Mark leagues as inactive if they are not in the provided list
   * This preserves historical data while keeping the cache in sync
   */
  async deactivateStaleLeagues(
    game: "poe1" | "poe2",
    activeLeagueIds: string[],
  ): Promise<number> {
    if (activeLeagueIds.length === 0) {
      // If no active leagues provided, mark all as inactive
      const result = await this.kysely
        .updateTable("poe_leagues_cache")
        .set({ is_active: 0 })
        .where("game", "=", game)
        .where("is_active", "=", 1)
        .executeTakeFirst();

      return Number(result.numUpdatedRows || 0);
    }

    // Mark leagues as inactive if they're not in the active list
    const result = await this.kysely
      .updateTable("poe_leagues_cache")
      .set({ is_active: 0 })
      .where("game", "=", game)
      .where("is_active", "=", 1)
      .where("league_id", "not in", activeLeagueIds)
      .executeTakeFirst();

    return Number(result.numUpdatedRows || 0);
  }

  // ============================================================================
  // Metadata Operations
  // ============================================================================

  /**
   * Get the cache metadata for a specific game
   */
  async getCacheMetadata(
    game: "poe1" | "poe2",
  ): Promise<PoeLeaguesCacheMetadataDTO | null> {
    const row = await this.kysely
      .selectFrom("poe_leagues_cache_metadata")
      .selectAll()
      .where("game", "=", game)
      .executeTakeFirst();

    return row ? PoeLeaguesMapper.toPoeLeaguesCacheMetadataDTO(row) : null;
  }

  /**
   * Update or insert the cache metadata for a specific game
   */
  async upsertCacheMetadata(
    game: "poe1" | "poe2",
    lastFetchedAt: string,
  ): Promise<void> {
    await this.kysely
      .insertInto("poe_leagues_cache_metadata")
      .values({
        game,
        last_fetched_at: lastFetchedAt,
      })
      .onConflict((oc) =>
        oc.column("game").doUpdateSet({
          last_fetched_at: lastFetchedAt,
        }),
      )
      .execute();
  }

  /**
   * Check if the cache is stale (older than the specified hours)
   */
  async isCacheStale(
    game: "poe1" | "poe2",
    maxAgeHours: number,
  ): Promise<boolean> {
    const metadata = await this.getCacheMetadata(game);

    if (!metadata) {
      // No cache metadata means cache is definitely stale
      return true;
    }

    const lastFetchedAt = new Date(metadata.lastFetchedAt);
    const now = new Date();
    const ageMs = now.getTime() - lastFetchedAt.getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    return ageHours >= maxAgeHours;
  }
}
