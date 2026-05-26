import type { Confidence } from "../../../types/data-stores";

export type SupabaseCardPriceMap = Record<
  string,
  {
    chaosValue: number;
    divineValue: number;
    confidence?: Confidence;
  }
>;

export interface SupabaseSnapshotResponse {
  snapshot: {
    id: string;
    leagueId: string;
    fetchedAt: string;
    exchangeChaosToDivine: number;
    stackedDeckChaosCost: number;
    stackedDeckMaxVolumeRate?: number | null;
  };
  cardPrices: SupabaseCardPriceMap;
}

export interface SupabaseLeagueResponse {
  leagues: Array<{
    id: string;
    game: "poe1" | "poe2";
    leagueId: string;
    name: string;
    startAt: string | null;
    endAt: string | null;
    isActive: boolean;
    updatedAt: string | null;
  }>;
}
