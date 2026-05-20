import type {
  LeaguesRow,
  SnapshotCardPricesRow,
  SnapshotsRow,
} from "~/main/modules/database";
import type { Confidence } from "~/types/data-stores";

import type {
  LeagueDTO,
  SnapshotCardPriceDTO,
  SnapshotDTO,
} from "./Snapshot.dto";

/**
 * Mappers convert between database rows and DTOs
 */
export class SnapshotMapper {
  static toSnapshotDTO(row: SnapshotsRow): SnapshotDTO {
    return {
      id: row.id,
      leagueId: row.league_id,
      fetchedAt: row.fetched_at,
      createdAt: row.created_at,
      chaosToDivineRatio: row.chaos_to_divine_ratio,
      stackedDeckChaosCost: row.stacked_deck_chaos_cost,
      stackedDeckMaxVolumeRate: row.stacked_deck_max_volume_rate,
    };
  }

  static toSnapshotCardPriceDTO(
    row: SnapshotCardPricesRow,
  ): SnapshotCardPriceDTO {
    return {
      cardName: row.card_name,
      chaosValue: row.chaos_value,
      divineValue: row.divine_value,
      confidence: (row.confidence as Confidence) ?? 1,
    };
  }

  static toLeagueDTO(row: LeaguesRow): LeagueDTO {
    return {
      id: row.id,
      game: row.game,
      name: row.name,
      startDate: row.start_date,
    };
  }
}
