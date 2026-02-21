import type { DivinationCardsRow } from "~/main/modules/database";
import { cleanWikiMarkup } from "~/main/utils/cleanWikiMarkup";
import type { KnownRarity, Rarity } from "~/types/data-stores";

import type { DivinationCardDTO } from "./DivinationCards.dto";

/**
 * Row type with joined rarity data
 */
interface DivinationCardWithRarityRow extends DivinationCardsRow {
  rarity?: Rarity;
  filter_rarity?: KnownRarity | null;
  prohibited_library_rarity?: KnownRarity | null;
}

/**
 * Mappers convert between database rows and DTOs
 */
export class DivinationCardsMapper {
  static toDTO(row: DivinationCardWithRarityRow): DivinationCardDTO {
    return {
      id: row.id,
      name: row.name,
      stackSize: row.stack_size,
      description: row.description,
      rewardHtml: cleanWikiMarkup(row.reward_html),
      artSrc: row.art_src,
      flavourHtml: cleanWikiMarkup(row.flavour_html),
      rarity: row.rarity ?? (0 as Rarity), // Default to 0 (Unknown) if not set
      filterRarity: row.filter_rarity ?? null,
      prohibitedLibraryRarity: row.prohibited_library_rarity ?? null,
      fromBoss: row.from_boss === 1,
      game: row.game,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
