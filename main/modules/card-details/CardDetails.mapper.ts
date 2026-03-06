import type { GameType } from "~/types/data-stores";

import type {
  CardPriceHistoryDTO,
  CardPriceHistoryPointDTO,
  PriceChangeSummary,
} from "./CardDetails.dto";

// ─── Raw poe.ninja API Response Types ────────────────────────────────────────

/**
 * A single history data point from the poe.ninja details API.
 */
interface PoeNinjaHistoryPoint {
  timestamp: string;
  rate: number;
  volumePrimaryValue: number;
}

/**
 * A currency pair from the poe.ninja details API (e.g. "chaos" or "divine").
 */
interface PoeNinjaPair {
  id: string;
  rate?: number;
  volumePrimaryValue?: number;
  history?: PoeNinjaHistoryPoint[];
}

/**
 * Core metadata from the poe.ninja details API.
 */
interface PoeNinjaCore {
  items?: Array<{
    id: string;
    name: string;
    image: string;
    category: string;
    detailsId: string;
  }>;
  rates?: Record<string, number>;
  primary?: string;
  secondary?: string;
}

/**
 * The top-level item info from the poe.ninja details API.
 */
interface PoeNinjaItem {
  id: string;
  name: string;
  category: string;
  detailsId: string;
}

/**
 * Full raw response shape from:
 * GET https://poe.ninja/{game}/api/economy/exchange/current/details
 *     ?league={league}&type=DivinationCard&id={detailsId}
 */
export interface PoeNinjaDetailsResponse {
  item?: PoeNinjaItem;
  pairs?: PoeNinjaPair[];
  core?: PoeNinjaCore;
}

// ─── Mapper ──────────────────────────────────────────────────────────────────

/**
 * Compute price change percentages from a history array.
 *
 * Compares the most recent rate against the rate at each lookback offset.
 * If the history doesn't contain enough data points for a given period,
 * that field is omitted rather than showing misleading data.
 *
 * Assumes history is sorted chronologically (oldest first).
 */
export function computePriceChanges(
  history: CardPriceHistoryPointDTO[],
): PriceChangeSummary {
  if (history.length < 2) {
    return {};
  }

  const latest = history[history.length - 1];
  const latestTime = new Date(latest.timestamp).getTime();

  const result: PriceChangeSummary = {};

  const lookbacks: Array<{
    key: keyof PriceChangeSummary;
    hours: number;
  }> = [
    { key: "change24h", hours: 24 },
    { key: "change7d", hours: 24 * 7 },
    { key: "change30d", hours: 24 * 30 },
  ];

  for (const { key, hours } of lookbacks) {
    const targetTime = latestTime - hours * 60 * 60 * 1000;

    // Find the data point closest to the target time
    let closest: CardPriceHistoryPointDTO | null = null;
    let closestDiff = Number.POSITIVE_INFINITY;

    for (const point of history) {
      const pointTime = new Date(point.timestamp).getTime();
      const diff = Math.abs(pointTime - targetTime);

      // Only consider points that are before or at the target time
      // and within a reasonable tolerance (50% of the lookback period)
      if (diff < closestDiff && diff <= hours * 60 * 60 * 1000 * 0.5) {
        closest = point;
        closestDiff = diff;
      }
    }

    if (closest && closest.rate > 0) {
      const change = ((latest.rate - closest.rate) / closest.rate) * 100;
      result[key] = Math.round(change * 10) / 10; // Round to 1 decimal
    }
  }

  return result;
}

/**
 * Maps raw poe.ninja details API response into a `CardPriceHistoryDTO`.
 *
 * Extracts:
 * - The `"divine"` pair from `pairs[]`
 * - Current rate from `pairs[divine].rate`
 * - History array from `pairs[divine].history`
 * - Chaos-to-divine ratio from `core.rates.divine`
 */
export class CardDetailsMapper {
  static toDTO(
    raw: PoeNinjaDetailsResponse,
    cardName: string,
    detailsId: string,
    game: GameType,
    league: string,
    fetchedAt: string,
    isFromCache: boolean,
  ): CardPriceHistoryDTO {
    // Find the "divine" pair
    const divinePair = raw.pairs?.find((p) => p.id === "divine") ?? null;

    // Extract current rate and volume
    const currentDivineRate = divinePair?.rate ?? null;
    const currentVolume = divinePair?.volumePrimaryValue ?? null;

    // Extract chaos-to-divine ratio from core.rates
    const chaosToDivineRatio = raw.core?.rates?.divine ?? 0;

    // Map history points
    const priceHistory: CardPriceHistoryPointDTO[] = (
      divinePair?.history ?? []
    ).map((point) => ({
      timestamp: point.timestamp,
      rate: point.rate,
      volume: point.volumePrimaryValue,
    }));

    // Compute price changes
    const priceChanges = computePriceChanges(priceHistory);

    return {
      cardName,
      detailsId,
      game,
      league,
      currentDivineRate,
      currentVolume,
      chaosToDivineRatio,
      priceHistory,
      priceChanges,
      fetchedAt,
      isFromCache,
    };
  }
}
