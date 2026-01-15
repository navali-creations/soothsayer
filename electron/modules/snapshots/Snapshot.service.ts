import crypto from "node:crypto";
import { ipcMain, BrowserWindow } from "electron";
import type { SessionPriceSnapshot } from "../../../types/data-stores";
import { DatabaseService } from "../database/Database.service";
import { PoeNinjaService } from "../poe-ninja/PoeNinja.service";
import { SnapshotRepository } from "./Snapshot.repository";
import { DivinationCardsService } from "../divination-cards/DivinationCards.service";
import { SnapshotChannel } from "./Snapshot.channels";

/**
 * Service for managing price snapshots
 * Handles fetching, storing, and reusing poe.ninja price data
 */
class SnapshotService {
  private static _instance: SnapshotService;
  private repository: SnapshotRepository;
  private poeNinja: PoeNinjaService;
  private divinationCards: DivinationCardsService;
  private refreshIntervals: Map<string, NodeJS.Timeout> = new Map();

  // How old can a snapshot be before we fetch a new one (in hours)
  private static SNAPSHOT_REUSE_THRESHOLD_HOURS = 6;

  // How often to refresh snapshots while app is open (in hours)
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
    this.poeNinja = PoeNinjaService.getInstance();
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
      window.webContents.send(channel, ...args);
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
   * Get or fetch a snapshot for a session
   * Reuses recent snapshots or fetches new one
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
        `Reusing snapshot ${recentSnapshot.id} from ${recentSnapshot.fetchedAt}`,
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

    // Fetch new snapshot
    console.log(`Fetching new snapshot for ${game}/${leagueName}...`);
    const snapshotData = await this.poeNinja.getPriceSnapshot(leagueName);

    // Update card rarities based on exchange prices
    const gameType = game === "poe1" ? "poe1" : "poe2";
    await this.divinationCards.updateRaritiesFromPrices(
      gameType,
      leagueName,
      snapshotData.exchange.chaosToDivineRatio,
      snapshotData.exchange.cardPrices,
    );

    // Store it
    const snapshotId = crypto.randomUUID();
    await this.repository.createSnapshot({
      id: snapshotId,
      leagueId,
      snapshotData,
    });

    console.log(
      `Stored snapshot ${snapshotId} for league ${leagueId} with ${Object.keys(snapshotData.exchange.cardPrices).length + Object.keys(snapshotData.stash.cardPrices).length} card prices`,
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
        console.log(`Auto-refreshing snapshot for ${game}/${leagueName}...`);
        const leagueId = await this.ensureLeague(game, leagueName);
        const snapshotData = await this.poeNinja.getPriceSnapshot(leagueName);

        // Update card rarities based on exchange prices
        const gameType = game === "poe1" ? "poe1" : "poe2";
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

        console.log(`Auto-refresh complete for ${game}/${leagueName}`);

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
        console.error(`Failed to auto-refresh snapshot for ${key}:`, error);
      }
    }, intervalMs);

    this.refreshIntervals.set(key, interval);
    console.log(
      `Started auto-refresh for ${key} (every ${SnapshotService.AUTO_REFRESH_INTERVAL_HOURS}h)`,
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
      console.log(`Stopped auto-refresh for ${key}`);

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
      console.log(`Stopped auto-refresh for ${key}`);
    }
    this.refreshIntervals.clear();
  }
}

export { SnapshotService };
