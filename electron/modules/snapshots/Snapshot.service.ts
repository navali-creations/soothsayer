import crypto from "node:crypto";
import type { SessionPriceSnapshot } from "../../../types/data-stores";
import { DatabaseService } from "../database/Database.service";
import { PoeNinjaService } from "../poe-ninja/PoeNinja.service";

interface SnapshotData {
  id: string;
  league_id: string;
  fetched_at: string;
  exchange_chaos_to_divine: number;
  stash_chaos_to_divine: number;
}

interface SnapshotCardPrice {
  card_name: string;
  price_source: "exchange" | "stash";
  chaos_value: number;
  divine_value: number;
  stack_size: number | null;
}

/**
 * Service for managing price snapshots
 * Handles fetching, storing, and reusing poe.ninja price data
 */
class SnapshotService {
  private static _instance: SnapshotService;
  private db: DatabaseService;
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
    this.db = DatabaseService.getInstance();
    this.poeNinja = PoeNinjaService.getInstance();
  }

  /**
   * Get or create a league in the database
   */
  private async ensureLeague(
    game: string,
    leagueName: string,
    startDate?: string,
  ): Promise<string> {
    const dbInstance = this.db.getDb();

    // Check if league exists
    const existing = dbInstance
      .prepare("SELECT id FROM leagues WHERE game = ? AND name = ?")
      .get(game, leagueName) as { id: string } | undefined;

    if (existing) {
      return existing.id;
    }

    // Create new league
    const leagueId = crypto.randomUUID();
    dbInstance
      .prepare(
        `INSERT INTO leagues (id, game, name, start_date)
         VALUES (?, ?, ?, ?)`,
      )
      .run(leagueId, game, leagueName, startDate || null);

    console.log(`Created new league: ${game}/${leagueName} (${leagueId})`);
    return leagueId;
  }

  /**
   * Get the most recent snapshot for a league
   * Returns snapshot if it exists and is fresh enough
   */
  private getRecentSnapshot(leagueId: string): SnapshotData | null {
    const dbInstance = this.db.getDb();

    const hoursAgo = SnapshotService.SNAPSHOT_REUSE_THRESHOLD_HOURS;
    const result = dbInstance
      .prepare(
        `SELECT id, league_id, fetched_at, exchange_chaos_to_divine, stash_chaos_to_divine
         FROM snapshots
         WHERE league_id = ?
           AND fetched_at > datetime('now', '-${hoursAgo} hours')
         ORDER BY fetched_at DESC
         LIMIT 1`,
      )
      .get(leagueId) as SnapshotData | undefined;

    return result || null;
  }

  /**
   * Store a snapshot in the database
   */
  private storeSnapshot(
    leagueId: string,
    snapshotData: SessionPriceSnapshot,
  ): string {
    const snapshotId = crypto.randomUUID();
    const dbInstance = this.db.getDb();

    return this.db.transaction(() => {
      // Insert snapshot metadata
      dbInstance
        .prepare(
          `INSERT INTO snapshots
           (id, league_id, fetched_at, exchange_chaos_to_divine, stash_chaos_to_divine)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          snapshotId,
          leagueId,
          snapshotData.timestamp,
          snapshotData.exchange.chaosToDivineRatio,
          snapshotData.stash.chaosToDivineRatio,
        );

      // Insert exchange card prices
      const insertPrice = dbInstance.prepare(
        `INSERT INTO snapshot_card_prices
         (snapshot_id, card_name, price_source, chaos_value, divine_value, stack_size)
         VALUES (?, ?, ?, ?, ?, ?)`,
      );

      for (const [cardName, priceData] of Object.entries(
        snapshotData.exchange.cardPrices,
      )) {
        insertPrice.run(
          snapshotId,
          cardName,
          "exchange",
          priceData.chaosValue,
          priceData.divineValue,
          priceData.stackSize || null,
        );
      }

      // Insert stash card prices
      for (const [cardName, priceData] of Object.entries(
        snapshotData.stash.cardPrices,
      )) {
        insertPrice.run(
          snapshotId,
          cardName,
          "stash",
          priceData.chaosValue,
          priceData.divineValue,
          priceData.stackSize || null,
        );
      }

      console.log(
        `Stored snapshot ${snapshotId} for league ${leagueId} with ${Object.keys(snapshotData.exchange.cardPrices).length + Object.keys(snapshotData.stash.cardPrices).length} card prices`,
      );

      return snapshotId;
    });
  }

  /**
   * Load a snapshot from the database and convert to SessionPriceSnapshot format
   */
  public loadSnapshot(snapshotId: string): SessionPriceSnapshot | null {
    const dbInstance = this.db.getDb();

    // Get snapshot metadata
    const snapshot = dbInstance
      .prepare(
        `SELECT fetched_at, exchange_chaos_to_divine, stash_chaos_to_divine
         FROM snapshots WHERE id = ?`,
      )
      .get(snapshotId) as
      | {
          fetched_at: string;
          exchange_chaos_to_divine: number;
          stash_chaos_to_divine: number;
        }
      | undefined;

    if (!snapshot) {
      return null;
    }

    // Get all card prices
    const prices = dbInstance
      .prepare(
        `SELECT card_name, price_source, chaos_value, divine_value, stack_size
         FROM snapshot_card_prices WHERE snapshot_id = ?`,
      )
      .all(snapshotId) as SnapshotCardPrice[];

    // Separate exchange and stash prices
    const exchangePrices: SessionPriceSnapshot["exchange"]["cardPrices"] = {};
    const stashPrices: SessionPriceSnapshot["stash"]["cardPrices"] = {};

    for (const price of prices) {
      const priceData = {
        chaosValue: price.chaos_value,
        divineValue: price.divine_value,
        stackSize: price.stack_size || undefined,
      };

      if (price.price_source === "exchange") {
        exchangePrices[price.card_name] = priceData;
      } else {
        stashPrices[price.card_name] = priceData;
      }
    }

    return {
      timestamp: snapshot.fetched_at,
      exchange: {
        chaosToDivineRatio: snapshot.exchange_chaos_to_divine,
        cardPrices: exchangePrices,
      },
      stash: {
        chaosToDivineRatio: snapshot.stash_chaos_to_divine,
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
    const recentSnapshot = this.getRecentSnapshot(leagueId);

    if (recentSnapshot) {
      console.log(
        `Reusing snapshot ${recentSnapshot.id} from ${recentSnapshot.fetched_at}`,
      );
      const data = this.loadSnapshot(recentSnapshot.id);
      if (data) {
        return { snapshotId: recentSnapshot.id, data };
      }
    }

    // Fetch new snapshot
    console.log(`Fetching new snapshot for ${game}/${leagueName}...`);
    const snapshotData = await this.poeNinja.getPriceSnapshot(leagueName);

    // Store it
    const snapshotId = this.storeSnapshot(leagueId, snapshotData);

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
        this.storeSnapshot(leagueId, snapshotData);
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
