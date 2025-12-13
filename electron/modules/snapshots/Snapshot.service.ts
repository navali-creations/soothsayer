import crypto from "node:crypto";
import type { SessionPriceSnapshot } from "../../../types/data-stores";
import { DatabaseService } from "../database/Database.service";
import { PoeNinjaService } from "../poe-ninja/PoeNinja.service";
import { SnapshotRepository } from "./Snapshot.repository";

/**
 * Service for managing price snapshots
 * Handles fetching, storing, and reusing poe.ninja price data
 */
class SnapshotService {
  private static _instance: SnapshotService;
  private repository: SnapshotRepository;
  private poeNinja: PoeNinjaService;
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

    console.log(`Created new league: ${game}/${leagueName} (${leagueId})`);
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

    // Try to reuse recent snapshot
    const recentSnapshot = await this.repository.getRecentSnapshot(
      leagueId,
      SnapshotService.SNAPSHOT_REUSE_THRESHOLD_HOURS,
    );

    if (recentSnapshot) {
      console.log(
        `Reusing snapshot ${recentSnapshot.id} from ${recentSnapshot.fetchedAt}`,
      );
      const data = await this.loadSnapshot(recentSnapshot.id);
      if (data) {
        return { snapshotId: recentSnapshot.id, data };
      }
    }

    // Fetch new snapshot
    console.log(`Fetching new snapshot for ${game}/${leagueName}...`);
    const snapshotData = await this.poeNinja.getPriceSnapshot(leagueName);

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

        const snapshotId = crypto.randomUUID();
        await this.repository.createSnapshot({
          id: snapshotId,
          leagueId,
          snapshotData,
        });

        console.log(`Auto-refresh complete for ${game}/${leagueName}`);
      } catch (error) {
        console.error(`Failed to auto-refresh snapshot for ${key}:`, error);
      }
    }, intervalMs);

    this.refreshIntervals.set(key, interval);
    console.log(
      `Started auto-refresh for ${key} (every ${SnapshotService.AUTO_REFRESH_INTERVAL_HOURS}h)`,
    );
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
