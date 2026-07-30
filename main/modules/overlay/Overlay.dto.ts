import type { Rarity } from "~/types/data-stores";

interface OverlaySessionCardDTO {
  cardName: string;
  count: number;
}

interface OverlayRecentDropDTO {
  cardName: string;
  rarity: Rarity;
  price: {
    chaosValue: number;
    divineValue: number;
  } | null;
}

interface OverlaySessionDataDTO {
  totalCount: number;
  totalProfit: number;
  chaosToDivineRatio: number;
  cards: OverlaySessionCardDTO[];
  recentDrops: OverlayRecentDropDTO[];
  isActive: boolean;
}

export type {
  OverlayRecentDropDTO,
  OverlaySessionCardDTO,
  OverlaySessionDataDTO,
};
