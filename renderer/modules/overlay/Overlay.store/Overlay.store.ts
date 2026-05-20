import { create } from "zustand";

import type { Rarity } from "~/types/data-stores";

interface CardEntry {
  cardName: string;
  count: number;
}

interface RecentDrop {
  cardName: string;
  rarity: Rarity;
  price: {
    chaosValue: number;
    divineValue: number;
  } | null;
}

interface SessionData {
  totalCount: number;
  totalProfit: number;
  chaosToDivineRatio: number;
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
    cards: [],
    recentDrops: [],
    isActive: false,
  },
  setSessionData: (sessionData) => {
    set({ sessionData });
  },
}));
