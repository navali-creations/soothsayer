import type { RelatedCardDTO } from "~/main/modules/card-details/CardDetails.dto";
import type { CardEntry, Rarity } from "~/types/data-stores";

// Dynamically import all card images (same approach as CardArt component)
const cardImages = import.meta.glob<{ default: string }>(
  "~/renderer/assets/poe1/divination-card-images/*.png",
  { eager: true },
);

/**
 * Resolve the image path for a card art filename.
 */
export function getCardImage(artSrc: string): string {
  const key = `/renderer/assets/poe1/divination-card-images/${artSrc}`;
  return cardImages[key]?.default ?? "";
}

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
