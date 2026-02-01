import { ipcMain } from "electron";

import { SettingsKey, SettingsStoreService } from "~/main/modules";
import { DatabaseService } from "~/main/modules/database";
import { SupabaseClientService } from "~/main/modules/supabase";

import type { GameType } from "../../../types/data-stores";
import type { PoeLeague } from "../../../types/poe-league";
import { PoeLeaguesChannel } from "./PoeLeagues.channels";
import type {
  SupabaseLeagueResponse,
  UpsertPoeLeagueCacheDTO,
} from "./PoeLeagues.dto";
import { PoeLeaguesRepository } from "./PoeLeagues.repository";

/**
 * Service for managing PoE Leagues
 *
 * Fetches leagues from Supabase get-leagues-legacy edge function and caches
 * them locally in SQLite. Due to Supabase's 1 request per 24h rate limit,
 * we use aggressive local caching and only refresh when the cache is stale.
 */
class PoeLeaguesService {
  private static _instance: PoeLeaguesService;
  private repository: PoeLeaguesRepository;
  private supabase: SupabaseClientService;
  private settingsStore: SettingsStoreService;

  // Cache duration in hours - matches Supabase rate limit of 1 per 24h
  // We use 23 hours to have some buffer before the rate limit resets
  private static readonly CACHE_MAX_AGE_HOURS = 23;

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
        return this.fetchLeagues(game);
      },
    );

    ipcMain.handle(PoeLeaguesChannel.GetSelectedLeague, () => {
      return this.getSelectedLeague();
    });

    ipcMain.handle(
      PoeLeaguesChannel.SelectLeague,
      (_event, leagueId: string) => {
        return this.setSelectedLeague(leagueId);
      },
    );
  }

  /**
   * Fetch leagues for a game, using local cache when available
   * Will only call Supabase if cache is stale (older than 23 hours)
   */
  public async fetchLeagues(game: GameType): Promise<PoeLeague[]> {
    const gameKey = game as "poe1" | "poe2";

    // Check if cache is stale
    const isStale = await this.repository.isCacheStale(
      gameKey,
      PoeLeaguesService.CACHE_MAX_AGE_HOURS,
    );

    if (!isStale) {
      // Return cached data
      console.log(`[PoeLeaguesService] Returning cached leagues for ${game}`);
      return this.getCachedLeagues(gameKey);
    }

    // Try to fetch from Supabase
    console.log(
      `[PoeLeaguesService] Cache stale, fetching leagues from Supabase for ${game}`,
    );

    try {
      const leagues = await this.fetchFromSupabase(gameKey);

      // Update cache
      await this.updateCache(gameKey, leagues);

      console.log(
        `[PoeLeaguesService] Fetched and cached ${leagues.length} leagues for ${game}`,
      );

      return leagues;
    } catch (error) {
      console.error(
        `[PoeLeaguesService] Failed to fetch from Supabase:`,
        error,
      );

      // Fallback to cached data even if stale
      const cachedLeagues = await this.getCachedLeagues(gameKey);

      if (cachedLeagues.length > 0) {
        console.log(
          `[PoeLeaguesService] Using stale cache (${cachedLeagues.length} leagues) due to fetch error`,
        );
        return cachedLeagues;
      }

      // No cache available, throw the error
      throw error;
    }
  }

  /**
   * Fetch leagues from Supabase get-leagues-legacy edge function
   */
  private async fetchFromSupabase(game: "poe1" | "poe2"): Promise<PoeLeague[]> {
    if (!this.supabase.isConfigured()) {
      throw new Error("Supabase client not configured");
    }

    // Call the edge function using the SupabaseClientService
    const response =
      await this.supabase.callEdgeFunction<SupabaseLeagueResponse>(
        "get-leagues-legacy",
        {
          game,
          league: "Standard", // Required by the function, but we're just fetching the list
        },
      );

    return response.leagues.map((league) => ({
      id: league.leagueId,
      name: league.name,
      startAt: league.startAt,
      endAt: league.endAt,
    }));
  }

  /**
   * Get cached leagues from SQLite
   */
  private async getCachedLeagues(game: "poe1" | "poe2"): Promise<PoeLeague[]> {
    const cachedLeagues = await this.repository.getLeaguesByGame(game);

    return cachedLeagues.map((league) => ({
      id: league.leagueId,
      name: league.name,
      startAt: league.startAt,
      endAt: league.endAt,
    }));
  }

  /**
   * Update the local cache with fresh league data
   */
  private async updateCache(
    game: "poe1" | "poe2",
    leagues: PoeLeague[],
  ): Promise<void> {
    const now = new Date().toISOString();

    // Convert to upsert DTOs
    const upsertDTOs: UpsertPoeLeagueCacheDTO[] = leagues.map((league) => ({
      id: `${game}_${league.id}`,
      game,
      leagueId: league.id,
      name: league.name,
      startAt: league.startAt,
      endAt: league.endAt,
      isActive: true, // Assume all fetched leagues are active
      updatedAt: now,
      fetchedAt: now,
    }));

    // Upsert all leagues
    await this.repository.upsertLeagues(upsertDTOs);

    // Update the cache metadata
    await this.repository.upsertCacheMetadata(game, now);
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
}

export { PoeLeaguesService };
