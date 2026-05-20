import type { Rarity } from "~/types/data-stores";

export interface CardEntry {
  cardName: string;
  count: number;
}

export interface RecentDrop {
  cardName: string;
  rarity: Rarity;
  price: {
    chaosValue: number;
    divineValue: number;
  } | null;
}

export interface SessionData {
  totalCount: number;
  totalProfit: number;
  chaosToDivineRatio: number;
  cards: CardEntry[];
  recentDrops: RecentDrop[];
  isActive: boolean;
}

export type OverlayTab = "all" | "valuable";
