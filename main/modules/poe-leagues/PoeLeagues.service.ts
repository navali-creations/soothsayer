import * as Sentry from "@sentry/electron/main";
import { ipcMain } from "electron";

import { SettingsKey, SettingsStoreService } from "~/main/modules";
import { DatabaseService } from "~/main/modules/database";
import { SupabaseClientService } from "~/main/modules/supabase";
import {
  assertBoundedString,
  assertGameType,
  handleValidationError,
} from "~/main/utils/ipc-validation";

import type { GameType } from "../../../types/data-stores";
import type { PoeLeague, PoeLeagueWithStatus } from "../../../types/poe-league";
import { PoeLeaguesChannel } from "./PoeLeagues.channels";
import type {
  SupabaseLeagueResponse,
  UpsertPoeLeagueCacheDTO,
} from "./PoeLeagues.dto";
import { PoeLeaguesRepository } from "./PoeLeagues.repository";

/**
 * Service for managing PoE Leagues
 *
 * Fetches leagues from Supabase get-leagues edge function and caches
 * them locally in SQLite. Due to Supabase's rate limit (4 requests per
 * 24h per user), we use aggressive local caching and only refresh when
 * the cache is stale.
 *
 * Cache Synchronization Strategy:
 * --------------------------------
 * When syncing with Supabase (poe_leagues table), this service:
 * 1. Upserts all leagues returned from Supabase (marks them as active)
 * 2. Deactivates leagues in cache that are NOT in the Supabase response
 * 3. Preserves all historical data by NEVER deleting league records
 *
 * This approach ensures:
 * - Active leagues are always current with Supabase
 * - Historical snapshots, prices, and other data remain intact
 * - No CASCADE delete issues (leagues are marked inactive, not deleted)
 * - Users can still view historical data for leagues that have ended
 *
 * Example:
 * - Cache has: ["Standard", "Keepers", "Old League"]
 * - Supabase returns: ["Standard", "Keepers", "New League"]
 * - Result: "Old League" is marked is_active=0, others remain/become active
 */
class PoeLeaguesService {
  private static _instance: PoeLeaguesService;
  private repository: PoeLeaguesRepository;
  private supabase: SupabaseClientService;
  private settingsStore: SettingsStoreService;

  // Cache duration in hours - matches Supabase rate limit of 2 per 24h
  private static readonly CACHE_MAX_AGE_HOURS = 24;

  // Cooldown in minutes before retrying Supabase after a fallback.
  // Prevents hammering Supabase when auth or network is persistently down.
  private static readonly FALLBACK_COOLDOWN_MINUTES = 2;

  // Fallback league when both Supabase and local cache are unavailable.
  // "Standard" is a permanent league that always exists for both poe1 and poe2.
  private static readonly FALLBACK_LEAGUES: PoeLeague[] = [
    { id: "Standard", name: "Standard", startAt: null, endAt: null },
  ];

  // In-flight fetch promises keyed by game, used for request deduplication.
  // If a fetch for the same game is already in progress, callers share the
  // same promise instead of firing a second Supabase request.
  private inFlightFetches = new Map<string, Promise<PoeLeague[]>>();

  static getInstance(): PoeLeaguesService {
    if (!PoeLeaguesService._instance) {
      PoeLeaguesService._instance = new PoeLeaguesService();
    }
    return PoeLeaguesService._instance;
  }

  constructor() {
    const db = DatabaseService.getInstance();
    this.repository = new PoeLeaguesRepository(db.getKysely());
    this.supabase = SupabaseClientService.getInstance();
    this.settingsStore = SettingsStoreService.getInstance();
    this.setupIpcHandlers();
  }

  private setupIpcHandlers(): void {
    ipcMain.handle(
      PoeLeaguesChannel.FetchLeagues,
      async (_event, game: GameType) => {
        try {
          assertGameType(game, PoeLeaguesChannel.FetchLeagues);
          return await this.fetchLeagues(game);
        } catch (error) {
          // Validation errors return a structured error response.
          // Non-validation errors (network, edge function, etc.) are caught
          // so the renderer always gets a usable response, never a thrown IPC error.
          try {
            return handleValidationError(error, PoeLeaguesChannel.FetchLeagues);
          } catch {
            console.error(
              `[PoeLeaguesService] Failed to fetch leagues:`,
              error,
            );
            Sentry.captureException(
              error instanceof Error ? error : new Error(String(error)),
              {
                tags: { module: "poe-leagues", operation: "fetch-leagues-ipc" },
                extra: { game },
              },
            );
            return PoeLeaguesService.FALLBACK_LEAGUES;
          }
        }
      },
    );

    ipcMain.handle(
      PoeLeaguesChannel.GetAllLeagues,
      async (_event, game: GameType) => {
        try {
          assertGameType(game, PoeLeaguesChannel.GetAllLeagues);
          return await this.getAllLeagues(game);
        } catch (error) {
          return handleValidationError(error, PoeLeaguesChannel.GetAllLeagues);
        }
      },
    );

    ipcMain.handle(PoeLeaguesChannel.GetSelectedLeague, () => {
      return this.getSelectedLeague();
    });

    ipcMain.handle(
      PoeLeaguesChannel.SelectLeague,
      (_event, leagueId: string) => {
        try {
          assertBoundedString(
            leagueId,
            "leagueId",
            PoeLeaguesChannel.SelectLeague,
            40,
          );
          return this.setSelectedLeague(leagueId);
        } catch (error) {
          return handleValidationError(error, PoeLeaguesChannel.SelectLeague);
        }
      },
    );
  }

  /**
   * Fetch leagues for a game, using local cache when available.
   * Deduplicates concurrent requests for the same game — if a fetch is
   * already in flight, callers share the same promise.
   */
  public async fetchLeagues(game: GameType): Promise<PoeLeague[]> {
    const gameKey = game as "poe1" | "poe2";

    // Return existing in-flight request for this game
    const existing = this.inFlightFetches.get(gameKey);
    if (existing) {
      console.log(`[PoeLeaguesService] Returning in-flight fetch for ${game}`);
      return existing;
    }

    const promise = this._fetchLeaguesImpl(gameKey);
    this.inFlightFetches.set(gameKey, promise);

    try {
      return await promise;
    } finally {
      this.inFlightFetches.delete(gameKey);
    }
  }

  private async _fetchLeaguesImpl(
    gameKey: "poe1" | "poe2",
  ): Promise<PoeLeague[]> {
    // Check if cache is stale
    const isStale = await this.repository.isCacheStale(
      gameKey,
      PoeLeaguesService.CACHE_MAX_AGE_HOURS,
    );

    if (!isStale) {
      // Return cached data
      console.log(
        `[PoeLeaguesService] Returning cached leagues for ${gameKey}`,
      );
      return this.getCachedLeagues(gameKey);
    }

    // Try to fetch from Supabase
    console.log(
      `[PoeLeaguesService] Cache stale, fetching leagues from Supabase for ${gameKey}`,
    );

    try {
      const leagues = await this.fetchFromSupabase(gameKey);

      // Update cache
      await this.updateCache(gameKey, leagues);

      console.log(
        `[PoeLeaguesService] Fetched and cached ${leagues.length} leagues for ${gameKey}`,
      );

      return leagues;
    } catch (error) {
      console.error(
        `[PoeLeaguesService] Failed to fetch from Supabase:`,
        error,
      );
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          tags: { module: "poe-leagues", operation: "fetch-from-supabase" },
          extra: { game: gameKey },
        },
      );

      // Fallback to cached data even if stale
      const cachedLeagues = await this.getCachedLeagues(gameKey);

      if (cachedLeagues.length > 0) {
        console.log(
          `[PoeLeaguesService] Using stale cache (${cachedLeagues.length} leagues) due to fetch error`,
        );
        return cachedLeagues;
      }

      // No cache available — cache "Standard" as a short-lived fallback so
      // isCacheStale() returns false for the cooldown period, preventing a
      // storm of failing requests. After FALLBACK_COOLDOWN_MINUTES the
      // cache expires and the app retries Supabase.
      console.warn(
        `[PoeLeaguesService] No cached leagues available for ${gameKey} and Supabase fetch failed. Caching Standard fallback with ${PoeLeaguesService.FALLBACK_COOLDOWN_MINUTES}min cooldown.`,
      );
      Sentry.captureMessage(
        `No cached leagues available for ${gameKey} — using Standard fallback`,
        {
          level: "warning",
          tags: { module: "poe-leagues", operation: "standard-fallback" },
          extra: { game: gameKey },
        },
      );
      await this.cacheFallback(gameKey);
      return PoeLeaguesService.FALLBACK_LEAGUES;
    }
  }

  /**
   * Fetch leagues from Supabase get-leagues edge function
   */
  private async fetchFromSupabase(game: "poe1" | "poe2"): Promise<PoeLeague[]> {
    if (!this.supabase.isConfigured()) {
      throw new Error("Supabase client not configured");
    }

    // Call the edge function using the SupabaseClientService
    const response =
      await this.supabase.callEdgeFunction<SupabaseLeagueResponse>(
        "get-leagues",
        { game },
      );

    return response.leagues
      .filter((league) => league.isActive)
      .map((league) => ({
        id: league.leagueId,
        name: league.name,
        startAt: league.startAt,
        endAt: league.endAt,
      }));
  }

  /**
   * Get cached leagues from SQLite (active only)
   */
  private async getCachedLeagues(game: "poe1" | "poe2"): Promise<PoeLeague[]> {
    const cachedLeagues = await this.repository.getActiveLeaguesByGame(game);

    return cachedLeagues.map((league) => ({
      id: league.leagueId,
      name: league.name,
      startAt: league.startAt,
      endAt: league.endAt,
    }));
  }

  /**
   * Update the local cache with fresh league data
   * Syncs with Supabase by:
   * 1. Upserting all active leagues from Supabase
   * 2. Marking leagues not in Supabase as inactive (preserves historical data)
   */
  private async updateCache(
    game: "poe1" | "poe2",
    leagues: PoeLeague[],
  ): Promise<void> {
    const now = new Date().toISOString();

    // Convert to upsert DTOs - only active leagues from Supabase
    const upsertDTOs: UpsertPoeLeagueCacheDTO[] = leagues.map((league) => ({
      id: `${game}_${league.id}`,
      game,
      leagueId: league.id,
      name: league.name,
      startAt: league.startAt,
      endAt: league.endAt,
      isActive: true, // All leagues from Supabase are considered active
      updatedAt: now,
      fetchedAt: now,
    }));

    // Upsert all active leagues
    await this.repository.upsertLeagues(upsertDTOs);

    // Deactivate leagues that are no longer in Supabase
    // This preserves historical data (snapshots, prices, etc.) while keeping cache in sync
    const activeLeagueIds = leagues.map((league) => league.id);
    const deactivatedCount = await this.repository.deactivateStaleLeagues(
      game,
      activeLeagueIds,
    );

    if (deactivatedCount > 0) {
      console.log(
        `[PoeLeaguesService] Deactivated ${deactivatedCount} stale leagues for ${game} (historical data preserved)`,
      );
    }

    // Update the cache metadata
    await this.repository.upsertCacheMetadata(game, now);
  }

  /**
   * Cache the fallback leagues with a short-lived timestamp.
   *
   * Sets `last_fetched_at` to a time in the past such that
   * `isCacheStale()` returns `false` for FALLBACK_COOLDOWN_MINUTES,
   * then `true` — allowing a retry after the cooldown expires.
   */
  private async cacheFallback(game: "poe1" | "poe2"): Promise<void> {
    const cooldownMs = PoeLeaguesService.FALLBACK_COOLDOWN_MINUTES * 60 * 1000;
    const maxAgeMs = PoeLeaguesService.CACHE_MAX_AGE_HOURS * 60 * 60 * 1000;
    const fakeFetchedAt = new Date(
      Date.now() - maxAgeMs + cooldownMs,
    ).toISOString();

    await this.updateCache(game, PoeLeaguesService.FALLBACK_LEAGUES);
    // Overwrite the metadata timestamp with our fake one
    await this.repository.upsertCacheMetadata(game, fakeFetchedAt);
  }

  /**
   * Get the currently selected league for the active game
   */
  private async getSelectedLeague(): Promise<string> {
    const activeGame = await this.settingsStore.get(SettingsKey.ActiveGame);

    if (activeGame === "poe1") {
      return (
        (await this.settingsStore.get(SettingsKey.SelectedPoe1League)) ?? ""
      );
    } else {
      return (
        (await this.settingsStore.get(SettingsKey.SelectedPoe2League)) ?? ""
      );
    }
  }

  /**
   * Set the selected league for the active game
   */
  private async setSelectedLeague(leagueId: string): Promise<{
    success: boolean;
    league: string;
  }> {
    const activeGame = await this.settingsStore.get(SettingsKey.ActiveGame);

    if (activeGame === "poe1") {
      this.settingsStore.set(SettingsKey.SelectedPoe1League, leagueId);
    } else {
      this.settingsStore.set(SettingsKey.SelectedPoe2League, leagueId);
    }

    console.log(
      `[PoeLeaguesService] Selected league for ${activeGame} changed to: ${leagueId}`,
    );
    return { success: true, league: leagueId };
  }

  /**
   * Force refresh the cache for a game
   * Use sparingly due to rate limits
   */
  public async refreshCache(game: GameType): Promise<PoeLeague[]> {
    const gameKey = game as "poe1" | "poe2";

    console.log(`[PoeLeaguesService] Force refreshing cache for ${game}`);

    try {
      const leagues = await this.fetchFromSupabase(gameKey);
      await this.updateCache(gameKey, leagues);
      return leagues;
    } catch (error) {
      console.error(`[PoeLeaguesService] Failed to refresh cache:`, error);
      throw error;
    }
  }

  /**
   * Check if the cache for a game is stale
   */
  public async isCacheStale(game: GameType): Promise<boolean> {
    return this.repository.isCacheStale(
      game as "poe1" | "poe2",
      PoeLeaguesService.CACHE_MAX_AGE_HOURS,
    );
  }

  /**
   * Get cached leagues without triggering a fetch
   * Useful for checking what's available locally
   */
  public async getCachedLeaguesOnly(game: GameType): Promise<PoeLeague[]> {
    return this.getCachedLeagues(game as "poe1" | "poe2");
  }

  /**
   * Get all cached leagues, including inactive historical entries.
   */
  public async getAllLeagues(game: GameType): Promise<PoeLeagueWithStatus[]> {
    const rows = await this.repository.getLeaguesByGame(
      game as "poe1" | "poe2",
    );

    return rows.map((league) => ({
      id: league.leagueId,
      name: league.name,
      startAt: league.startAt,
      endAt: league.endAt,
      isActive: league.isActive,
    }));
  }
}

export { PoeLeaguesService };
