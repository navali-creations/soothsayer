import type {
  LeaguesRow,
  SnapshotCardPricesRow,
  SnapshotsRow,
} from "~/main/modules/database";

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
      exchangeChaosToDivine: row.exchange_chaos_to_divine,
      stashChaosToDivine: row.stash_chaos_to_divine,
    };
  }

  static toSnapshotCardPriceDTO(
    row: SnapshotCardPricesRow,
  ): SnapshotCardPriceDTO {
    return {
      cardName: row.card_name,
      priceSource: row.price_source as "exchange" | "stash",
      chaosValue: row.chaos_value,
      divineValue: row.divine_value,
      stackSize: row.stack_size,
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
