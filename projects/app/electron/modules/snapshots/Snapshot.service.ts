import crypto from "node:crypto";
import { BrowserWindow, ipcMain } from "electron";
import { DatabaseService } from "~/electron/modules/database";
import { DivinationCardsService } from "~/electron/modules/divination-cards";
import { SupabaseClientService } from "~/electron/modules/supabase";
import type { SessionPriceSnapshot } from "../../../types/data-stores";
import { SnapshotChannel } from "./Snapshot.channels";
import { SnapshotRepository } from "./Snapshot.repository";

/**
 * Service for managing price snapshots
 * Handles fetching from Supabase, storing locally, and reusing snapshot data
 */
class SnapshotService {
  private static _instance: SnapshotService;
  private repository: SnapshotRepository;
  private supabase: SupabaseClientService;
  private divinationCards: DivinationCardsService;
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map();

  // How old can a snapshot be before we fetch a new one (in hours)
  // Since Supabase updates every 4 hours, we can reuse for longer
  private static SNAPSHOT_REUSE_THRESHOLD_HOURS = 6;

  // How often to refresh snapshots while app is open (in hours)
  // Align with Supabase's 4-hour update schedule
  private static AUTO_REFRESH_INTERVAL_HOURS = 4;

  static getInstance(): SnapshotService {
    if (!SnapshotService._instance) {
      SnapshotService._instance = new SnapshotService();
    }
    return SnapshotService._instance;
  }

  constructor() {
    const db = DatabaseService.getInstance();
    this.repository = new SnapshotRepository(db.getKysely());
    this.supabase = SupabaseClientService.getInstance();
    this.divinationCards = DivinationCardsService.getInstance();
    this.setupIpcHandlers();
  }

  /**
   * Setup IPC handlers for snapshot info queries
   */
  private setupIpcHandlers() {
    ipcMain.handle(
      SnapshotChannel.GetLatestSnapshot,
      async (_event, game: string, league: string) => {
        try {
          const leagueId = await this.ensureLeague(game, league);
          const snapshot = await this.repository.getRecentSnapshot(
            leagueId,
            SnapshotService.SNAPSHOT_REUSE_THRESHOLD_HOURS,
          );
          return snapshot;
        } catch (error) {
          console.error(
            "[SnapshotService] Failed to get latest snapshot:",
            error,
          );
          return null;
        }
      },
    );
  }

  /**
   * Emit snapshot event to all renderer windows
   */
  private emitSnapshotEvent(channel: string, ...args: any[]) {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      try {
        if (
          window &&
          !window.isDestroyed() &&
          window.webContents &&
          !window.webContents.isDestroyed()
        ) {
          window.webContents.send(channel, ...args);
        }
      } catch (error) {
        console.warn(
          `[SnapshotService] Failed to emit event (${channel}):`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  /**
   * Get or create a league in the database
   */
  public async ensureLeague(
    game: string,
    leagueName: string,
    startDate?: string,
  ): Promise<string> {
    // Check if league exists
    const existing = await this.repository.getLeagueByName(game, leagueName);

    if (existing) {
      return existing.id;
    }

    // Create new league
    const leagueId = crypto.randomUUID();
    await this.repository.createLeague({
      id: leagueId,
      game,
      name: leagueName,
      startDate,
    });

    return leagueId;
  }

  /**
   * Load a snapshot from the database and convert to SessionPriceSnapshot format
   */
  public async loadSnapshot(
    snapshotId: string,
  ): Promise<SessionPriceSnapshot | null> {
    const result = await this.repository.loadSnapshot(snapshotId);
    if (!result) {
      return null;
    }

    const { snapshot, cardPrices } = result;

    // Separate exchange and stash prices
    const exchangePrices: SessionPriceSnapshot["exchange"]["cardPrices"] = {};
    const stashPrices: SessionPriceSnapshot["stash"]["cardPrices"] = {};

    for (const price of cardPrices) {
      const priceData = {
        chaosValue: price.chaosValue,
        divineValue: price.divineValue,
        stackSize: price.stackSize ?? undefined,
      };

      if (price.priceSource === "exchange") {
        exchangePrices[price.cardName] = priceData;
      } else {
        stashPrices[price.cardName] = priceData;
      }
    }

    return {
      timestamp: snapshot.fetchedAt,
      exchange: {
        chaosToDivineRatio: snapshot.exchangeChaosToDivine,
        cardPrices: exchangePrices,
      },
      stash: {
        chaosToDivineRatio: snapshot.stashChaosToDivine,
        cardPrices: stashPrices,
      },
    };
  }

  /**
   * Fetch snapshot from Supabase with local SQLite fallback
   */
  private async fetchSnapshotWithFallback(
    game: "poe1" | "poe2",
    leagueName: string,
    leagueId: string,
  ): Promise<SessionPriceSnapshot> {
    // Try Supabase first
    if (this.supabase.isConfigured()) {
      try {
        console.log(
          `[SnapshotService] Fetching from Supabase for ${game}/${leagueName}...`,
        );
        const snapshotData = await this.supabase.getLatestSnapshot(
          game,
          leagueName,
        );
        return snapshotData;
      } catch (error) {
        console.error(
          "[SnapshotService] Supabase fetch failed, checking local fallback:",
          error,
        );
      }
    } else {
      console.warn(
        "[SnapshotService] Supabase not configured, using local data only",
      );
    }

    // Fallback: try to load most recent local snapshot
    const recentLocal = await this.repository.getRecentSnapshot(
      leagueId,
      24 * 30, // Allow even very old snapshots as fallback
    );

    if (recentLocal) {
      console.log(
        `[SnapshotService] Using local fallback snapshot from ${recentLocal.fetchedAt}`,
      );
      const data = await this.loadSnapshot(recentLocal.id);
      if (data) {
        return data;
      }
    }

    throw new Error(
      `No snapshot available for ${game}/${leagueName}. Supabase is unavailable and no local cache exists.`,
    );
  }

  /**
   * Get or fetch a snapshot for a session
   * Reuses recent snapshots or fetches new one from Supabase
   */
  public async getSnapshotForSession(
    game: string,
    leagueName: string,
  ): Promise<{ snapshotId: string; data: SessionPriceSnapshot }> {
    // Ensure league exists
    const leagueId = await this.ensureLeague(game, leagueName);

    // Try to reuse recent snapshot - use auto-refresh interval for consistency
    // This ensures snapshots are refreshed at the same cadence whether the app
    // stays open (auto-refresh) or is restarted frequently
    const recentSnapshot = await this.repository.getRecentSnapshot(
      leagueId,
      SnapshotService.AUTO_REFRESH_INTERVAL_HOURS,
    );

    if (recentSnapshot) {
      console.log(
        `[SnapshotService] Reusing snapshot ${recentSnapshot.id} from ${recentSnapshot.fetchedAt}`,
      );

      const data = await this.loadSnapshot(recentSnapshot.id);
      if (data) {
        // Update card rarities from the reused snapshot's prices
        // This ensures rarities match the snapshot being used for the session
        const gameType = game === "poe1" ? "poe1" : "poe2";
        await this.divinationCards.updateRaritiesFromPrices(
          gameType,
          leagueName,
          data.exchange.chaosToDivineRatio,
          data.exchange.cardPrices,
        );

        // Emit reused snapshot event
        this.emitSnapshotEvent(SnapshotChannel.OnSnapshotReused, {
          id: recentSnapshot.id,
          leagueId: recentSnapshot.leagueId,
          league: leagueName,
          game,
          fetchedAt: recentSnapshot.fetchedAt,
          exchangeChaosToDivine: recentSnapshot.exchangeChaosToDivine,
          stashChaosToDivine: recentSnapshot.stashChaosToDivine,
        });

        return { snapshotId: recentSnapshot.id, data };
      }
    }

    // Fetch new snapshot from Supabase (with local fallback)
    console.log(
      `[SnapshotService] Fetching new snapshot for ${game}/${leagueName}...`,
    );
    const gameType = game === "poe1" ? "poe1" : "poe2";
    const snapshotData = await this.fetchSnapshotWithFallback(
      gameType,
      leagueName,
      leagueId,
    );

    // Update card rarities based on exchange prices
    await this.divinationCards.updateRaritiesFromPrices(
      gameType,
      leagueName,
      snapshotData.exchange.chaosToDivineRatio,
      snapshotData.exchange.cardPrices,
    );

    // Store it locally
    const snapshotId = crypto.randomUUID();
    await this.repository.createSnapshot({
      id: snapshotId,
      leagueId,
      snapshotData,
    });

    console.log(
      `[SnapshotService] Stored snapshot ${snapshotId} for league ${leagueId} with ${Object.keys(snapshotData.exchange.cardPrices).length + Object.keys(snapshotData.stash.cardPrices).length} card prices`,
    );

    // Emit created snapshot event
    this.emitSnapshotEvent(SnapshotChannel.OnSnapshotCreated, {
      id: snapshotId,
      leagueId,
      league: leagueName,
      game,
      fetchedAt: snapshotData.timestamp,
      exchangeChaosToDivine: snapshotData.exchange.chaosToDivineRatio,
      stashChaosToDivine: snapshotData.stash.chaosToDivineRatio,
    });

    return { snapshotId, data: snapshotData };
  }

  /**
   * Start auto-refresh for a league
   * Fetches new snapshot every 4 hours while app is open
   */
  public startAutoRefresh(game: string, leagueName: string): void {
    const key = `${game}:${leagueName}`;

    // Don't start multiple intervals for same league
    if (this.refreshIntervals.has(key)) {
      return;
    }

    const intervalMs =
      SnapshotService.AUTO_REFRESH_INTERVAL_HOURS * 60 * 60 * 1000;

    const interval = setInterval(async () => {
      try {
        console.log(
          `[SnapshotService] Auto-refreshing snapshot for ${game}/${leagueName}...`,
        );
        const leagueId = await this.ensureLeague(game, leagueName);
        const gameType = game === "poe1" ? "poe1" : "poe2";
        const snapshotData = await this.fetchSnapshotWithFallback(
          gameType,
          leagueName,
          leagueId,
        );

        // Update card rarities based on exchange prices
        await this.divinationCards.updateRaritiesFromPrices(
          gameType,
          leagueName,
          snapshotData.exchange.chaosToDivineRatio,
          snapshotData.exchange.cardPrices,
        );

        const snapshotId = crypto.randomUUID();
        await this.repository.createSnapshot({
          id: snapshotId,
          leagueId,
          snapshotData,
        });

        console.log(
          `[SnapshotService] Auto-refresh complete for ${game}/${leagueName}`,
        );

        // Emit created snapshot event so frontend updates
        this.emitSnapshotEvent(SnapshotChannel.OnSnapshotCreated, {
          id: snapshotId,
          leagueId,
          league: leagueName,
          game,
          fetchedAt: snapshotData.timestamp,
          exchangeChaosToDivine: snapshotData.exchange.chaosToDivineRatio,
          stashChaosToDivine: snapshotData.stash.chaosToDivineRatio,
        });
      } catch (error) {
        console.error(
          `[SnapshotService] Failed to auto-refresh snapshot for ${key}:`,
          error,
        );
      }
    }, intervalMs);

    this.refreshIntervals.set(key, interval);
    console.log(
      `[SnapshotService] Started auto-refresh for ${key} (every ${SnapshotService.AUTO_REFRESH_INTERVAL_HOURS}h)`,
    );

    // Emit auto-refresh started event
    this.emitSnapshotEvent(SnapshotChannel.OnAutoRefreshStarted, {
      game,
      league: leagueName,
      intervalHours: SnapshotService.AUTO_REFRESH_INTERVAL_HOURS,
    });
  }

  /**
   * Stop auto-refresh for a league
   */
  public stopAutoRefresh(game: string, leagueName: string): void {
    const key = `${game}:${leagueName}`;
    const interval = this.refreshIntervals.get(key);

    if (interval) {
      clearInterval(interval);
      this.refreshIntervals.delete(key);
      console.log(`[SnapshotService] Stopped auto-refresh for ${key}`);

      // Emit auto-refresh stopped event
      this.emitSnapshotEvent(SnapshotChannel.OnAutoRefreshStopped, {
        game,
        league: leagueName,
      });
    }
  }

  /**
   * Stop all auto-refreshes
   */
  public stopAllAutoRefresh(): void {
    for (const [key, interval] of this.refreshIntervals) {
      clearInterval(interval);
      console.log(`[SnapshotService] Stopped auto-refresh for ${key}`);
    }
    this.refreshIntervals.clear();
  }
}

export { SnapshotService };
