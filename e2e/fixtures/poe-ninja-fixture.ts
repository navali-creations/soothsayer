/**
 * poe.ninja Price History Fixtures for E2E Tests
 *
 * Provides deterministic, realistic price history data that mirrors the shape
 * of a real poe.ninja exchange details API response — as cached in the
 * `card_price_history_cache` SQLite table.
 *
 * By seeding this data into the cache before Market Data tests run, we:
 * 1. Eliminate network requests to poe.ninja (no hammering the service)
 * 2. Make tests deterministic (no flakes from poe.ninja downtime)
 * 3. Guarantee the price chart always renders (no empty/error fallback paths)
 *
 * The fixture shape matches `CardPriceHistoryDTO` from
 * `main/modules/card-details/CardDetails.dto.ts`, which is what
 * `CardDetailsService.getPriceHistory()` stores as the `response_data`
 * JSON blob in the `card_price_history_cache` table.
 *
 * @module e2e/fixtures/poe-ninja-fixture
 */

import type { GameType } from "../../types/data-stores";

// ─── Types (mirroring CardDetails.dto.ts) ─────────────────────────────────────

export interface PriceHistoryPoint {
  /** ISO date string */
  timestamp: string;
  /** Price in divine orbs */
  rate: number;
  /** Trade volume */
  volume: number;
}

export interface PriceChangeSummary {
  change24h?: number;
  change7d?: number;
  change30d?: number;
}

export interface CardPriceHistoryFixture {
  cardName: string;
  detailsId: string;
  game: GameType;
  league: string;
  currentDivineRate: number | null;
  currentVolume: number | null;
  chaosToDivineRatio: number;
  priceHistory: PriceHistoryPoint[];
  priceChanges: PriceChangeSummary;
  fetchedAt: string;
  isFromCache: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a series of daily price history points going back `days` days
 * from a given anchor date. Produces realistic-looking price fluctuations
 * around a base rate using a simple sine + noise pattern.
 */
function generatePriceHistory(
  days: number,
  baseRate: number,
  baseVolume: number,
  anchorDate: Date,
): PriceHistoryPoint[] {
  const points: PriceHistoryPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(anchorDate);
    date.setDate(date.getDate() - i);
    date.setUTCHours(0, 0, 0, 0);

    // Sine wave + deterministic "noise" for realistic fluctuation
    // Using the day index as seed so the data is always the same
    const sinComponent = Math.sin((i / days) * Math.PI * 4) * 0.08;
    const deterministicNoise =
      Math.sin(i * 137.508) * 0.03 + Math.cos(i * 73.251) * 0.02;
    const trend = ((days - i) / days) * 0.05; // slight upward trend over time

    const rate =
      Math.round(
        baseRate * (1 + sinComponent + deterministicNoise + trend) * 100,
      ) / 100;

    const volumeVariation = 1 + Math.sin(i * 42.123) * 0.4;
    const volume = Math.max(1, Math.round(baseVolume * volumeVariation));

    points.push({
      timestamp: date.toISOString(),
      rate: Math.max(0.01, rate),
      volume,
    });
  }

  return points;
}

/**
 * Compute price change percentages from the generated history, matching
 * the logic in `CardDetailsMapper.computePriceChanges()`.
 */
function computePriceChanges(history: PriceHistoryPoint[]): PriceChangeSummary {
  if (history.length < 2) return {};

  const latest = history[history.length - 1];
  const latestTime = new Date(latest.timestamp).getTime();
  const result: PriceChangeSummary = {};

  const lookbacks: Array<{ key: keyof PriceChangeSummary; hours: number }> = [
    { key: "change24h", hours: 24 },
    { key: "change7d", hours: 24 * 7 },
    { key: "change30d", hours: 24 * 30 },
  ];

  for (const { key, hours } of lookbacks) {
    const targetTime = latestTime - hours * 60 * 60 * 1000;
    let closest: PriceHistoryPoint | null = null;
    let closestDiff = Number.POSITIVE_INFINITY;

    for (const point of history) {
      const pointTime = new Date(point.timestamp).getTime();
      const diff = Math.abs(pointTime - targetTime);
      if (diff < closestDiff && diff <= hours * 60 * 60 * 1000 * 0.5) {
        closest = point;
        closestDiff = diff;
      }
    }

    if (closest && closest.rate > 0) {
      const change = ((latest.rate - closest.rate) / closest.rate) * 100;
      result[key] = Math.round(change * 10) / 10;
    }
  }

  return result;
}

// ─── Fixture Anchor Date ──────────────────────────────────────────────────────

/**
 * We use a fixed anchor date so the fixture data is completely deterministic.
 * The `fetchedAt` timestamp will be set to "now" at seed time (so the cache
 * TTL check passes), but the history points use this fixed anchor.
 */
const ANCHOR_DATE = new Date("2026-03-05T12:00:00.000Z");

// ─── House of Mirrors ─────────────────────────────────────────────────────────

const houseOfMirrorsHistory = generatePriceHistory(
  90, // 90 days of history
  165.0, // ~165 divine orbs base rate
  3, // low volume (extremely rare card)
  ANCHOR_DATE,
);

const houseOfMirrorsPriceChanges = computePriceChanges(houseOfMirrorsHistory);

export const HOUSE_OF_MIRRORS_PRICE_HISTORY: CardPriceHistoryFixture = {
  cardName: "House of Mirrors",
  detailsId: "house-of-mirrors",
  game: "poe1",
  league: "Standard",
  currentDivineRate:
    houseOfMirrorsHistory[houseOfMirrorsHistory.length - 1].rate,
  currentVolume: houseOfMirrorsHistory[houseOfMirrorsHistory.length - 1].volume,
  chaosToDivineRatio: 0.00125, // ~800 chaos per divine
  priceHistory: houseOfMirrorsHistory,
  priceChanges: houseOfMirrorsPriceChanges,
  fetchedAt: ANCHOR_DATE.toISOString(), // overridden at seed time with "now"
  isFromCache: true,
};

// ─── The Doctor ───────────────────────────────────────────────────────────────

const theDoctorHistory = generatePriceHistory(
  90,
  8.5, // ~8.5 divine orbs
  25, // moderate volume
  ANCHOR_DATE,
);

const theDoctorPriceChanges = computePriceChanges(theDoctorHistory);

export const THE_DOCTOR_PRICE_HISTORY: CardPriceHistoryFixture = {
  cardName: "The Doctor",
  detailsId: "the-doctor",
  game: "poe1",
  league: "Standard",
  currentDivineRate: theDoctorHistory[theDoctorHistory.length - 1].rate,
  currentVolume: theDoctorHistory[theDoctorHistory.length - 1].volume,
  chaosToDivineRatio: 0.00125,
  priceHistory: theDoctorHistory,
  priceChanges: theDoctorPriceChanges,
  fetchedAt: ANCHOR_DATE.toISOString(),
  isFromCache: true,
};

// ─── The Nurse ────────────────────────────────────────────────────────────────

const theNurseHistory = generatePriceHistory(
  90,
  1.0, // ~1 divine orb
  40, // decent volume
  ANCHOR_DATE,
);

const theNursePriceChanges = computePriceChanges(theNurseHistory);

export const THE_NURSE_PRICE_HISTORY: CardPriceHistoryFixture = {
  cardName: "The Nurse",
  detailsId: "the-nurse",
  game: "poe1",
  league: "Standard",
  currentDivineRate: theNurseHistory[theNurseHistory.length - 1].rate,
  currentVolume: theNurseHistory[theNurseHistory.length - 1].volume,
  chaosToDivineRatio: 0.00125,
  priceHistory: theNurseHistory,
  priceChanges: theNursePriceChanges,
  fetchedAt: ANCHOR_DATE.toISOString(),
  isFromCache: true,
};

// ─── Lookup Map ───────────────────────────────────────────────────────────────

/**
 * All available price history fixtures keyed by detailsId (slug).
 * Useful for generic seed functions that accept a card name/slug.
 */
export const PRICE_HISTORY_FIXTURES: Record<string, CardPriceHistoryFixture> = {
  "house-of-mirrors": HOUSE_OF_MIRRORS_PRICE_HISTORY,
  "the-doctor": THE_DOCTOR_PRICE_HISTORY,
  "the-nurse": THE_NURSE_PRICE_HISTORY,
};

/**
 * All fixture entries as an array, for batch seeding.
 */
export const ALL_PRICE_HISTORY_FIXTURES: CardPriceHistoryFixture[] =
  Object.values(PRICE_HISTORY_FIXTURES);
