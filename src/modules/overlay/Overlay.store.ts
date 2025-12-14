import { create } from "zustand";

interface CardEntry {
  cardName: string;
  count: number;
}

interface RecentDrop {
  cardName: string;
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
  recentDrops: RecentDrop[]; // Changed from string[]
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
    recentDrops: [], // Add this
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
