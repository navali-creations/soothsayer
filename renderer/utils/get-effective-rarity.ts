import type { Rarity, RaritySource } from "~/types/data-stores";

interface CardWithRarities {
  rarity: Rarity;
  filterRarity: Rarity | null;
  prohibitedLibraryRarity: Rarity | null;
}

/**
 * Resolve the effective rarity for a card based on the active rarity source.
 */
export function getEffectiveRarity(
  card: CardWithRarities,
  raritySource: RaritySource,
): Rarity {
  switch (raritySource) {
    case "filter":
      return card.filterRarity ?? card.rarity;
    case "prohibited-library":
      return card.prohibitedLibraryRarity ?? card.rarity;
    default:
      return card.rarity;
  }
}
