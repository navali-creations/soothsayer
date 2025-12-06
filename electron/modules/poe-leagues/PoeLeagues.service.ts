import { ipcMain } from "electron";
import type { PoeLeague, PoeLeagueFullData } from "../../../types/poe-league";
import {
  PoeLeaguesChannel,
  SettingsKey,
  SettingsStoreService,
} from "../../modules";

class PoeLeaguesService {
  private static _instance: PoeLeaguesService;
  private cachedLeagues: PoeLeague[] | null = null;
  private lastFetchTime: number = 0;
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
    ipcMain.handle(PoeLeaguesChannel.FetchLeagues, async () => {
      return this.fetchLeagues();
    });

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

  private async fetchLeagues(): Promise<PoeLeague[]> {
    const now = Date.now();

    // Return cached data if it's still fresh
    if (this.cachedLeagues && now - this.lastFetchTime < this.CACHE_DURATION) {
      console.log("Returning cached PoE leagues data");
      return this.cachedLeagues;
    }

    console.log("Fetching PoE leagues from API");

    try {
      const response = await fetch("https://www.pathofexile.com/api/leagues", {
        headers: {
          "User-Agent":
            "Soothsayer/1.0.0 (Electron App for PoE Divination Card Tracking)",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch PoE leagues: ${response.statusText}`);
      }

      const data: PoeLeagueFullData[] = await response.json();

      // Filter out Solo leagues and map to simplified format
      const leagues: PoeLeague[] = data
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

      this.cachedLeagues = leagues;
      this.lastFetchTime = now;

      console.log(
        `Fetched ${leagues.length} leagues (excluding Solo variants)`,
      );

      return leagues;
    } catch (error) {
      console.error("Error fetching PoE leagues:", error);

      // Return cached data if available, even if stale
      if (this.cachedLeagues) {
        console.log("Returning stale cached leagues due to fetch error");
        return this.cachedLeagues;
      }

      throw error;
    }
  }

  private getSelectedLeague(): string {
    const selectedGame = this.settingsStore.get(SettingsKey.SelectedGame);

    if (selectedGame === "poe1") {
      return this.settingsStore.get(SettingsKey.SelectedPoe1League);
    } else {
      return this.settingsStore.get(SettingsKey.SelectedPoe2League);
    }
  }

  private setSelectedLeague(leagueId: string): {
    success: boolean;
    league: string;
  } {
    const selectedGame = this.settingsStore.get(SettingsKey.SelectedGame);

    if (selectedGame === "poe1") {
      this.settingsStore.set(SettingsKey.SelectedPoe1League, leagueId);
    } else {
      this.settingsStore.set(SettingsKey.SelectedPoe2League, leagueId);
    }

    console.log(`Selected league for ${selectedGame} changed to: ${leagueId}`);
    return { success: true, league: leagueId };
  }

  // Public method to refresh cache
  public async refreshCache(): Promise<PoeLeague[]> {
    this.lastFetchTime = 0; // Force refresh
    return this.fetchLeagues();
  }
}

export { PoeLeaguesService };
