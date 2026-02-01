import type {
  PoeLeaguesCacheMetadataRow,
  PoeLeaguesCacheRow,
} from "~/main/modules/database";

import type {
  PoeLeagueCacheDTO,
  PoeLeaguesCacheMetadataDTO,
} from "./PoeLeagues.dto";

/**
 * Mappers convert between database rows and DTOs
 */
export class PoeLeaguesMapper {
  /**
   * Convert a database row to a PoeLeagueCacheDTO
   */
  static toPoeLeagueCacheDTO(row: PoeLeaguesCacheRow): PoeLeagueCacheDTO {
    return {
      id: row.id,
      game: row.game,
      leagueId: row.league_id,
      name: row.name,
      startAt: row.start_at,
      endAt: row.end_at,
      isActive: row.is_active === 1,
      updatedAt: row.updated_at,
      fetchedAt: row.fetched_at,
    };
  }

  /**
   * Convert a database row to a PoeLeaguesCacheMetadataDTO
   */
  static toPoeLeaguesCacheMetadataDTO(
    row: PoeLeaguesCacheMetadataRow,
  ): PoeLeaguesCacheMetadataDTO {
    return {
      game: row.game,
      lastFetchedAt: row.last_fetched_at,
    };
  }
}
