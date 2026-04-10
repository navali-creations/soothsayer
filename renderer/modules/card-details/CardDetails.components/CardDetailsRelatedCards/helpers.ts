import type { RelatedCardDTO } from "~/main/modules/card-details/CardDetails.dto";
import { getCardImage } from "~/renderer/lib/poe1-card-assets";
import type { CardEntry, Rarity } from "~/types/data-stores";

// Re-export for consumers that import getCardImage from this module
export { getCardImage };

/**
 * Get the display rarity for a related card DTO.
 * Prefers Prohibited Library rarity over poe.ninja rarity.
 */
export function getDisplayRarity(dto: RelatedCardDTO): Rarity {
  return (dto.prohibitedLibraryRarity ?? dto.rarity) as Rarity;
}

/**
 * Convert a RelatedCardDTO into a CardEntry shape that DivinationCard accepts.
 */
export function toCardEntry(dto: RelatedCardDTO): CardEntry {
  return {
    name: dto.name,
    count: 0,
    divinationCard: {
      id: dto.name,
      stackSize: dto.stackSize,
      description: dto.description,
      rewardHtml: dto.rewardHtml,
      artSrc: dto.artSrc,
      flavourHtml: dto.flavourHtml,
      rarity: getDisplayRarity(dto) as typeof dto.rarity,
      filterRarity: dto.filterRarity,
      fromBoss: dto.fromBoss,
    },
  };
}
