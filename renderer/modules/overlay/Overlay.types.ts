export interface CardEntry {
  cardName: string;
  count: number;
}

export interface RecentDrop {
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
