// Exchange API types
export interface PoeNinjaExchangeLine {
  id: string;
  primaryValue: number;
  volumePrimaryValue: number;
  maxVolumeCurrency: string;
  maxVolumeRate: number;
  sparkline: {
    totalChange: number;
    data: number[];
  };
}

export interface PoeNinjaExchangeCore {
  items: Array<{
    id: string;
    name: string;
    image: string;
    category: string;
    detailsId: string;
  }>;
  rates: Record<string, number>;
  primary: string;
  secondary: string;
}

export interface PoeNinjaExchangeResponse {
  core: PoeNinjaExchangeCore;
  items: Array<{
    id: string;
    name: string;
    category: string;
    detailsId: string;
  }>;
  lines: PoeNinjaExchangeLine[];
}

// Stash API types
export interface PoeNinjaStashCard {
  id: number;
  name: string;
  icon: string;
  baseType: string;
  stackSize: number;
  artFilename: string;
  itemClass: number;
  sparkLine: {
    data: number[];
    totalChange: number;
  };
  lowConfidenceSparkLine: {
    data: number[];
    totalChange: number;
  };
  implicitModifiers: any[];
  explicitModifiers: any[];
  mutatedModifiers: any[];
  flavourText: string;
  chaosValue: number;
  exaltedValue: number;
  divineValue: number;
  count: number;
  detailsId: string;
  tradeInfo: any[];
  listingCount: number;
}

export interface PoeNinjaStashResponse {
  lines: PoeNinjaStashCard[];
}

export interface DivinationCardPrice {
  id: string | number;
  name: string;
  chaosValue: number;
  divineValue?: number;
  stackSize?: number;
}

export interface PoeNinjaPriceData {
  chaosToDivineRatio: number;
  cardPrices: Record<string, DivinationCardPrice>;
  lastUpdated: string;
}
