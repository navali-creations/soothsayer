import { ipcMain } from "electron";
import type { PoeLeague, PoeLeagueFullData } from "../../types/poe-league";
import { LocalStorageEngine } from "./LocalStorageEngine";

class PoeLeaguesEngine {
  private static _instance: PoeLeaguesEngine;
  private cachedLeagues: PoeLeague[] | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour
  private localStorageEngine: LocalStorageEngine;

  static getInstance() {
    if (!PoeLeaguesEngine._instance) {
      PoeLeaguesEngine._instance = new PoeLeaguesEngine();
    }

    return PoeLeaguesEngine._instance;
  }

  constructor() {
    this.localStorageEngine = LocalStorageEngine.getInstance();
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    ipcMain.handle("poe-leagues:fetch-leagues", async () => {
      return this.fetchLeagues();
    });

    ipcMain.handle("poe-leagues:get-selected", () => {
      return this.getSelectedLeague();
    });

    ipcMain.handle("poe-leagues:set-selected", (_event, leagueId: string) => {
      return this.setSelectedLeague(leagueId);
    });
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
    return this.localStorageEngine.get("selected-league" as any) || "Keepers";
  }

  private setSelectedLeague(leagueId: string): {
    success: boolean;
    league: string;
  } {
    this.localStorageEngine.set("selected-league" as any, leagueId);
    console.log(`Selected league changed to: ${leagueId}`);
    return { success: true, league: leagueId };
  }

  // Public method to refresh cache
  public async refreshCache(): Promise<PoeLeague[]> {
    this.lastFetchTime = 0; // Force refresh
    return this.fetchLeagues();
  }
}

export { PoeLeaguesEngine };
