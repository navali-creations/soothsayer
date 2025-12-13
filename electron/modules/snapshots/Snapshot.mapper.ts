import type {
  SnapshotsTable,
  SnapshotCardPricesTable,
  LeaguesTable,
} from "../database/Database.types";
import type {
  SnapshotDTO,
  SnapshotCardPriceDTO,
  LeagueDTO,
} from "./Snapshot.dto";

/**
 * Mappers convert between database rows and DTOs
 */
export class SnapshotMapper {
  static toSnapshotDTO(row: SnapshotsTable): SnapshotDTO {
    return {
      id: row.id,
      leagueId: row.league_id,
      fetchedAt: row.fetched_at,
      exchangeChaosToDivine: row.exchange_chaos_to_divine,
      stashChaosToDivine: row.stash_chaos_to_divine,
    };
  }

  static toSnapshotCardPriceDTO(
    row: SnapshotCardPricesTable,
  ): SnapshotCardPriceDTO {
    return {
      cardName: row.card_name,
      priceSource: row.price_source as "exchange" | "stash",
      chaosValue: row.chaos_value,
      divineValue: row.divine_value,
      stackSize: row.stack_size,
    };
  }

  static toLeagueDTO(row: LeaguesTable): LeagueDTO {
    return {
      id: row.id,
      game: row.game,
      name: row.name,
      startDate: row.start_date,
    };
  }
}
