import { create } from "zustand";

interface CardEntry {
  cardName: string;
  count: number;
}

interface RecentDrop {
  cardName: string;
  rarity: number; // 1=extremely rare, 2=rare, 3=less common, 4=common
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
  opacity: number;
  sessionData: SessionData;
  setOpacity: (opacity: number) => void;
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
  setOpacity: (opacity) => {
    set({ opacity });
    window.electron?.overlay.setOpacity(opacity);
  },
  setSessionData: (sessionData) => {
    set({ sessionData });
  },
}));
