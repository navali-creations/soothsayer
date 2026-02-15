import type { Rarity } from "~/types/data-stores";

export interface CardEntry {
  cardName: string;
  count: number;
}

export interface RecentDrop {
  cardName: string;
  rarity: Rarity;
  exchangePrice: {
    chaosValue: number;
    divineValue: number;
  };
  stashPrice: {
    chaosValue: number;
    divineValue: number;
  };
}

export interface SessionData {
  totalCount: number;
  totalProfit: number;
  chaosToDivineRatio: number;
  priceSource: "exchange" | "stash";
  cards: CardEntry[];
  recentDrops: RecentDrop[];
  isActive: boolean;
}

export type OverlayTab = "all" | "valuable";
