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
