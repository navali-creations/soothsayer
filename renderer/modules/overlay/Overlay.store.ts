import { create } from "zustand";

import type { Rarity } from "~/types/data-stores";

interface CardEntry {
  cardName: string;
  count: number;
}

interface RecentDrop {
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

interface SessionData {
  totalCount: number;
  totalProfit: number;
  chaosToDivineRatio: number;
  priceSource: "exchange" | "stash";
  cards: CardEntry[];
  recentDrops: RecentDrop[];
  isActive: boolean;
}

interface OverlayStore {
  sessionData: SessionData;
  setSessionData: (data: SessionData) => void;
}

export const useOverlayStore = create<OverlayStore>((set) => ({
  opacity: 0.95,
  sessionData: {
    totalCount: 0,
    totalProfit: 0,
    chaosToDivineRatio: 0,
    priceSource: "exchange",
    cards: [],
    recentDrops: [],
    isActive: false,
  },
  setSessionData: (sessionData) => {
    set({ sessionData });
  },
}));
