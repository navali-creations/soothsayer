import type { CardsTable, GlobalStatsTable } from "~/main/modules/database";

import type { CardDTO, GlobalStatDTO } from "./DataStore.dto";

/**
 * Mappers convert between database rows and DTOs
 */
export class DataStoreMapper {
  static toCardDTO(
    row: Pick<CardsTable, "card_name" | "count" | "last_updated">,
  ): CardDTO {
    return {
      cardName: row.card_name,
      count: row.count,
      lastUpdated: row.last_updated,
    };
  }

  static toGlobalStatDTO(row: GlobalStatsTable): GlobalStatDTO {
    return {
      key: row.key,
      value: row.value,
    };
  }
}
