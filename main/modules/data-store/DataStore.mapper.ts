import type { CardsTable, GlobalStatsTable } from "~/main/modules/database";
import { cleanWikiMarkup } from "~/main/utils/cleanWikiMarkup";

import type { CardDTO, GlobalStatDTO } from "./DataStore.dto";

/**
 * Row shape returned by the joined query in getCardsByScope.
 * Extends the base cards columns with LEFT JOINed divination card metadata.
 */
export interface CardWithMetadataRow
  extends Pick<CardsTable, "card_name" | "count" | "last_updated"> {
  dc_id: string | null;
  dc_stack_size: number | null;
  dc_description: string | null;
  dc_reward_html: string | null;
  dc_art_src: string | null;
  dc_flavour_html: string | null;
  dc_from_boss: number | null;
  dc_is_disabled: number | null;
  dc_rarity: number | null;
}

/**
 * Mappers convert between database rows and DTOs
 */
export class DataStoreMapper {
  static toCardDTO(row: CardWithMetadataRow): CardDTO {
    const rawRarity = row.dc_rarity ?? 4;
    const rarity = (rawRarity >= 0 && rawRarity <= 4 ? rawRarity : 4) as
      | 0
      | 1
      | 2
      | 3
      | 4;

    return {
      cardName: row.card_name,
      count: row.count,
      lastUpdated: row.last_updated,
      divinationCard: row.dc_id
        ? {
            id: row.dc_id,
            stackSize: row.dc_stack_size ?? null,
            description: row.dc_description ?? null,
            rewardHtml: cleanWikiMarkup(row.dc_reward_html),
            artSrc: row.dc_art_src ?? null,
            flavourHtml: cleanWikiMarkup(row.dc_flavour_html),
            rarity,
            fromBoss: row.dc_from_boss === 1,
            isDisabled: row.dc_is_disabled === 1,
          }
        : undefined,
    };
  }

  static toGlobalStatDTO(row: GlobalStatsTable): GlobalStatDTO {
    return {
      key: row.key,
      value: row.value,
    };
  }
}
