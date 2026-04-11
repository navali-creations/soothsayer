import type {
  DivinationCardMetadata,
  KnownRarity,
  Rarity,
} from "~/types/data-stores";

interface CardLike {
  id: string;
  stackSize: number;
  description: string;
  rewardHtml: string;
  artSrc: string;
  flavourHtml: string;
  rarity: Rarity;
  fromBoss: boolean;
  isDisabled?: boolean;
  filterRarity?: KnownRarity | null;
}

/**
 * Convert a card-like object into a `DivinationCardMetadata` shape.
 *
 * Accepts an optional `rarity` override for cases where the effective
 * rarity differs from the card's base rarity (e.g. when applying a
 * rarity source like "filter" or "prohibited-library").
 */
export function toCardMetadata(
  card: CardLike,
  overrides?: { rarity?: Rarity; filterRarity?: KnownRarity | null },
): DivinationCardMetadata {
  return {
    id: card.id,
    stackSize: card.stackSize,
    description: card.description,
    rewardHtml: card.rewardHtml,
    artSrc: card.artSrc,
    flavourHtml: card.flavourHtml,
    rarity: overrides?.rarity ?? card.rarity,
    fromBoss: card.fromBoss,
    isDisabled: card.isDisabled,
    filterRarity:
      overrides?.filterRarity !== undefined
        ? overrides.filterRarity
        : card.filterRarity,
  };
}
