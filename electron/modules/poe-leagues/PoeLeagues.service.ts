import { ipcMain } from "electron";

import {
  PoeLeaguesChannel,
  SettingsKey,
  SettingsStoreService,
} from "~/electron/modules";

import type { GameType } from "../../../types/data-stores";
import type { PoeLeague, PoeLeagueFullData } from "../../../types/poe-league";

class PoeLeaguesService {
  private static _instance: PoeLeaguesService;
  private cachedLeagues: Map<"poe1" | "poe2", PoeLeague[]> = new Map();
  private lastFetchTime: Map<"poe1" | "poe2", number> = new Map();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  private settingsStore: SettingsStoreService;

  static getInstance() {
    if (!PoeLeaguesService._instance) {
      PoeLeaguesService._instance = new PoeLeaguesService();
    }

    return PoeLeaguesService._instance;
  }

  constructor() {
    this.settingsStore = SettingsStoreService.getInstance();
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
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

  private async fetchLeagues(game: GameType): Promise<PoeLeague[]> {
    const now = Date.now();
    const cachedData = this.cachedLeagues.get(game);
    const lastFetch = this.lastFetchTime.get(game) || 0;

    // Return cached data if it's still fresh
    if (cachedData && now - lastFetch < this.CACHE_DURATION) {
      console.log(`Returning cached PoE ${game} leagues data`);
      return cachedData;
    }

    console.log(`Fetching PoE ${game === "poe2" ? 2 : 1} leagues from API`);
    const url =
      game === "poe2"
        ? "https://www.pathofexile.com/api/trade2/data/leagues"
        : "https://www.pathofexile.com/api/leagues";

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Soothsayer/1.0.0 (Electron App for PoE Divination Card Tracking)",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch PoE leagues: ${response.statusText}`);
      }

      let leagues: PoeLeague[];

      if (game === "poe2") {
        // PoE2 API returns: { result: Array<{ id, realm, text }> }
        const data: {
          result: Array<{ id: string; realm: string; text: string }>;
        } = await response.json();

        leagues = data.result.map((league) => ({
          id: league.id,
          name: league.text,
          startAt: null,
          endAt: null,
        }));
      } else {
        // PoE1 API returns: PoeLeagueFullData[]
        const data: PoeLeagueFullData[] = await response.json();

        leagues = data
          .filter((league) => {
            // Exclude leagues with "Solo" in any rule name
            return !league.rules.some((rule) => rule.name === "Solo");
          })
          .map((league) => ({
            id: league.id,
            name: league.name,
            startAt: league.startAt,
            endAt: league.endAt,
          }));
      }

      this.cachedLeagues.set(game, leagues);
      this.lastFetchTime.set(game, now);

      console.log(
        `Fetched ${leagues.length} leagues (excluding Solo variants)`,
      );

      return leagues;
    } catch (error) {
      console.error("Error fetching PoE leagues:", error);

      // Return cached data if available, even if stale
      const cachedData = this.cachedLeagues.get(game);
      if (cachedData) {
        console.log(
          `Returning stale cached ${game} leagues due to fetch error`,
        );

        return cachedData;
      }

      throw error;
    }
  }

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

    console.log(`Selected league for ${activeGame} changed to: ${leagueId}`);
    return { success: true, league: leagueId };
  }

  // Public method to refresh cache
  public async refreshCache(game: GameType): Promise<PoeLeague[]> {
    this.lastFetchTime.set(game, 0); // Force refresh
    return this.fetchLeagues(game);
  }
}

export { PoeLeaguesService };
