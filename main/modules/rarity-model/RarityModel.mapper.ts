import type {
  FilterCardRaritiesRow,
  FilterMetadataRow,
} from "~/main/modules/database";

import type {
  DiscoveredRarityModelDTO,
  RarityModelCardRarityDTO,
  RarityModelMetadataDTO,
} from "./RarityModel.dto";

/**
 * Mappers convert between database rows and DTOs for the Filters module
 */
export class RarityModelMapper {
  /**
   * Convert a database row to a RarityModelMetadataDTO
   */
  static toRarityModelMetadataDTO(
    row: FilterMetadataRow,
  ): RarityModelMetadataDTO {
    return {
      id: row.id,
      filterType: row.filter_type,
      filePath: row.file_path,
      filterName: row.filter_name,
      lastUpdate: row.last_update,
      isFullyParsed: row.is_fully_parsed === 1,
      parsedAt: row.parsed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Convert a RarityModelMetadataDTO to a DiscoveredRarityModelDTO
   * Requires runtime context (league start date) for outdated detection
   */
  static toDiscoveredRarityModelDTO(
    metadata: RarityModelMetadataDTO,
    leagueStartDate: string | null,
  ): DiscoveredRarityModelDTO {
    const isOutdated = RarityModelMapper.isFilterOutdated(
      metadata.lastUpdate,
      leagueStartDate,
    );

    // Extract filename from file path
    const pathParts = metadata.filePath.replace(/\\/g, "/").split("/");
    const fileName = pathParts[pathParts.length - 1] ?? metadata.filterName;

    return {
      id: metadata.id,
      type: metadata.filterType,
      filePath: metadata.filePath,
      fileName,
      name: metadata.filterName,
      lastUpdate: metadata.lastUpdate,
      isFullyParsed: metadata.isFullyParsed,
      isOutdated,
    };
  }

  /**
   * Convert a database row to a RarityModelCardRarityDTO
   */
  static toRarityModelCardRarityDTO(
    row: FilterCardRaritiesRow,
  ): RarityModelCardRarityDTO {
    return {
      filterId: row.filter_id,
      cardName: row.card_name,
      rarity: row.rarity,
    };
  }

  /**
   * Grace period (in ms) before league start during which a filter update
   * is still considered "current". Filter authors typically push updates
   * 1–2 days before a new league launches, so a 3-day window avoids
   * false-positive "outdated" warnings.
   */
  static readonly OUTDATED_GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

  /**
   * Determine if a filter is outdated based on its last update time
   * and the current league's start date.
   *
   * A filter is considered outdated if it was last updated more than
   * {@link OUTDATED_GRACE_PERIOD_MS} before the league started.
   * Updates within the grace window (e.g. 1–2 days before launch)
   * are treated as current.
   */
  static isFilterOutdated(
    filterLastUpdate: string | null,
    leagueStartDate: string | null,
  ): boolean {
    // If we don't have either date, we can't determine outdated status
    if (!filterLastUpdate || !leagueStartDate) {
      return false;
    }

    try {
      const filterDate = new Date(filterLastUpdate);
      const leagueDate = new Date(leagueStartDate);

      // If either date is invalid, don't mark as outdated
      if (
        Number.isNaN(filterDate.getTime()) ||
        Number.isNaN(leagueDate.getTime())
      ) {
        return false;
      }

      // Only outdated if the filter was updated more than 3 days before league start
      const graceThreshold =
        leagueDate.getTime() - RarityModelMapper.OUTDATED_GRACE_PERIOD_MS;
      return filterDate.getTime() < graceThreshold;
    } catch {
      return false;
    }
  }
}
