import { LoggerService } from "~/main/modules/logger";
import type { GameType } from "~/types/data-stores";

import type { CardCommunityDropRateDTO } from "./CardDetails.dto";

const BASE_URL = "https://wraeclast.cards/data/drop-rates";
const CACHE_TTL_MS = 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_CACHE_ENTRIES = 32;
const MAX_CONCURRENT_FETCHES = 8;
const MAX_INDEX_BYTES = 256 * 1024;
const MAX_LEAGUE_BYTES = 4 * 1024 * 1024;
const MAX_INDEX_LEAGUES = 500;
const MAX_CARDS = 5_000;
const MAX_CARD_NAME_LENGTH = 256;

interface CommunityLeagueRates {
  cards: Map<string, number>;
  league: string;
  sampleSize: number;
}

interface CacheEntry {
  data: CommunityLeagueRates | null;
  expiresAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

async function readBoundedJson(
  response: Response,
  maxBytes: number,
): Promise<unknown> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (!Number.isFinite(declaredBytes) || declaredBytes > maxBytes) {
      throw new Error("Community response exceeds the allowed size");
    }
  }

  if (!response.body) {
    throw new Error("Community response body is unavailable");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error("Community response exceeds the allowed size");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(body)) as unknown;
}

export class CommunityDropRatesService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<
    string,
    Promise<CommunityLeagueRates | null>
  >();
  private readonly logger = LoggerService.createLogger("CommunityDropRates");

  public async getCardRate(
    game: GameType,
    league: string,
    cardName: string,
  ): Promise<CardCommunityDropRateDTO | null> {
    const cacheKey = `${game}:${league.toLowerCase()}`;
    const leagueRates = await this.getLeagueRates(cacheKey, game, league);
    if (!leagueRates) return null;

    const dropCount = leagueRates.cards.get(cardName.toLowerCase());
    if (dropCount === undefined) return null;

    return {
      league: leagueRates.league,
      dropCount,
      sampleSize: leagueRates.sampleSize,
    };
  }

  private async getLeagueRates(
    cacheKey: string,
    game: GameType,
    league: string,
  ): Promise<CommunityLeagueRates | null> {
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached.data;
    }
    if (cached) this.cache.delete(cacheKey);

    const pending = this.inFlight.get(cacheKey);
    if (pending) return pending;
    if (this.inFlight.size >= MAX_CONCURRENT_FETCHES) {
      this.logger.warn("Community drop-rate concurrency limit reached");
      return null;
    }

    const request = this.fetchLeagueRates(game, league)
      .then((data) => {
        this.setCache(cacheKey, {
          data,
          expiresAt: Date.now() + (data ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
        });
        return data;
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Community drop rates unavailable for ${game}/${league}:`,
          error,
        );
        this.setCache(cacheKey, {
          data: null,
          expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS,
        });
        return null;
      })
      .finally(() => {
        this.inFlight.delete(cacheKey);
      });

    this.inFlight.set(cacheKey, request);
    return request;
  }

  private setCache(cacheKey: string, entry: CacheEntry): void {
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, entry);
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
  }

  private async fetchLeagueRates(
    game: GameType,
    requestedLeague: string,
  ): Promise<CommunityLeagueRates | null> {
    const fetchOptions: RequestInit = {
      headers: {
        Accept: "application/json",
        "User-Agent": "Soothsayer/1.0",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    };
    const indexResponse = await fetch(
      `${BASE_URL}/${game}/index.json`,
      fetchOptions,
    );
    if (!indexResponse.ok) {
      throw new Error(`Community index returned ${indexResponse.status}`);
    }

    const indexPayload = await readBoundedJson(indexResponse, MAX_INDEX_BYTES);
    if (
      !isRecord(indexPayload) ||
      !Array.isArray(indexPayload.leagues) ||
      indexPayload.leagues.length > MAX_INDEX_LEAGUES
    ) {
      throw new Error("Invalid community index response");
    }

    const requestedLeagueLower = requestedLeague.toLowerCase();
    const leagueEntry = indexPayload.leagues.find(
      (value): value is Record<string, unknown> =>
        isRecord(value) &&
        typeof value.name === "string" &&
        value.name.toLowerCase() === requestedLeagueLower &&
        typeof value.id === "string" &&
        value.id.length > 0 &&
        value.id.length <= 100,
    );
    if (!leagueEntry) return null;

    const leagueResponse = await fetch(
      `${BASE_URL}/${game}/${encodeURIComponent(leagueEntry.id as string)}.json`,
      fetchOptions,
    );
    if (!leagueResponse.ok) {
      throw new Error(
        `Community league data returned ${leagueResponse.status}`,
      );
    }

    const leaguePayload = await readBoundedJson(
      leagueResponse,
      MAX_LEAGUE_BYTES,
    );
    if (
      !isRecord(leaguePayload) ||
      !isRecord(leaguePayload.league) ||
      !Array.isArray(leaguePayload.cards) ||
      leaguePayload.cards.length > MAX_CARDS
    ) {
      throw new Error("Invalid community league response");
    }

    const leagueName = leaguePayload.league.name;
    const sampleSize = leaguePayload.league.observed_total;
    if (
      typeof leagueName !== "string" ||
      leagueName.toLowerCase() !== requestedLeagueLower ||
      !isNonNegativeSafeInteger(sampleSize)
    ) {
      throw new Error("Invalid community league metadata");
    }

    const cards = new Map<string, number>();
    for (const value of leaguePayload.cards) {
      if (
        !isRecord(value) ||
        typeof value.name !== "string" ||
        value.name.length === 0 ||
        value.name.length > MAX_CARD_NAME_LENGTH ||
        !isNonNegativeSafeInteger(value.count) ||
        value.count > sampleSize
      ) {
        continue;
      }
      cards.set(value.name.toLowerCase(), value.count);
    }

    return { cards, league: leagueName, sampleSize };
  }
}
