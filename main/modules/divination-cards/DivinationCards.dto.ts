import type { KnownRarity, Rarity } from "~/types/data-stores";

/**
 * Data Transfer Objects for Divination Cards module
 */

export interface DivinationCardDTO {
  id: string; // e.g., "poe1_a-chilling-wind"
  name: string;
  stackSize: number;
  description: string;
  rewardHtml: string;
  artSrc: string;
  flavourHtml: string;
  rarity: Rarity; // 0=unknown, 1=extremely rare, 2=rare, 3=less common, 4=common (from poe.ninja pricing)
  filterRarity: KnownRarity | null; // 1=extremely rare, 2=rare, 3=less common, 4=common (from loot filter), null if no filter selected or card not in filter
  prohibitedLibraryRarity: KnownRarity | null; // 1=extremely rare, 2=rare, 3=less common, 4=common (from Prohibited Library CSV), null if card absent from PL dataset
  fromBoss: boolean; // true if card is boss-exclusive in stacked deck context (from Prohibited Library data)
  game: "poe1" | "poe2";
  createdAt: string;
  updatedAt: string;
}

export interface DivinationCardSearchDTO {
  cards: DivinationCardDTO[];
  total: number;
}

export interface DivinationCardStatsDTO {
  game: "poe1" | "poe2";
  totalCards: number;
  lastUpdated: string;
}
