import crypto from "node:crypto";

import { BrowserWindow, ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { DivinationCardsService } from "~/main/modules/divination-cards";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import { SupabaseClientService } from "~/main/modules/supabase";
import {
  assertBoundedString,
  assertGameType,
  handleValidationError,
} from "~/main/utils/ipc-validation";

import type {
  Confidence,
  SessionPriceSnapshot,
} from "../../../types/data-stores";
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
  private settingsStore: SettingsStoreService;
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
    this.settingsStore = SettingsStoreService.getInstance();
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
          assertGameType(game, SnapshotChannel.GetLatestSnapshot);
          assertBoundedString(
            league,
            "league",
            SnapshotChannel.GetLatestSnapshot,
            256,
          );
          const leagueId = await this.ensureLeague(game, league);
          const snapshot = await this.repository.getRecentSnapshot(
            leagueId,
            SnapshotService.SNAPSHOT_REUSE_THRESHOLD_HOURS,
          );
          return snapshot;
        } catch (error) {
          return handleValidationError(
            error,
            SnapshotChannel.GetLatestSnapshot,
          );
        }
      },
    );

    ipcMain.handle(
      SnapshotChannel.RefreshPrices,
      async (_event, game: string, league: string) => {
        try {
          assertGameType(game, SnapshotChannel.RefreshPrices);
          assertBoundedString(
            league,
            "league",
            SnapshotChannel.RefreshPrices,
            256,
          );
          const result = await this.getSnapshotForSession(game, league);
          const fetchedAt = result.data.timestamp;
          const refreshableAt = new Date(
            new Date(fetchedAt).getTime() +
              SnapshotService.AUTO_REFRESH_INTERVAL_HOURS * 60 * 60 * 1000,
          ).toISOString();
          return {
            snapshotId: result.snapshotId,
            fetchedAt,
            refreshableAt,
          };
        } catch (error) {
          return handleValidationError(error, SnapshotChannel.RefreshPrices);
        }
      },
    );

    ipcMain.handle(
      SnapshotChannel.GetRefreshStatus,
      async (_event, game: string, league: string) => {
        try {
          assertGameType(game, SnapshotChannel.GetRefreshStatus);
          assertBoundedString(
            league,
            "league",
            SnapshotChannel.GetRefreshStatus,
            256,
          );
          const leagueId = await this.ensureLeague(game, league);
          // Use the same threshold that getSnapshotForSession uses for reuse
          const snapshot = await this.repository.getRecentSnapshot(
            leagueId,
            SnapshotService.SNAPSHOT_REUSE_THRESHOLD_HOURS,
          );

          if (!snapshot) {
            return { fetchedAt: null, refreshableAt: null };
          }

          const refreshableAt = new Date(
            new Date(snapshot.fetchedAt).getTime() +
              SnapshotService.AUTO_REFRESH_INTERVAL_HOURS * 60 * 60 * 1000,
          ).toISOString();

          return {
            fetchedAt: snapshot.fetchedAt,
            refreshableAt,
          };
        } catch (error) {
          return handleValidationError(error, SnapshotChannel.GetRefreshStatus);
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
        confidence: price.confidence ?? 1,
      };

      if (price.priceSource === "exchange") {
        exchangePrices[price.cardName] = priceData;
      } else {
        stashPrices[price.cardName] = priceData;
      }
    }

    return {
      timestamp: snapshot.fetchedAt,
      stackedDeckChaosCost: snapshot.stackedDeckChaosCost ?? 0,
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
        // Update card rarities based on the active rarity source.
        // Filter-based rarities live in filter_card_rarities and are JOINed
        // independently — we must NOT overwrite divination_card_rarities.rarity
        // with filter values, otherwise the poe.ninja column on the Rarity
        // Model page shows stale filter data after the session ends.
        const gameType = game === "poe1" ? "poe1" : "poe2";
        await this.updateRaritiesForSource(gameType, leagueName, data);

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

    // Update card rarities based on the active rarity source.
    // Filter-based rarities are stored separately in filter_card_rarities.
    await this.updateRaritiesForSource(gameType, leagueName, snapshotData);

    // Store it locally
    const snapshotId = crypto.randomUUID();
    await this.repository.createSnapshot({
      id: snapshotId,
      leagueId,
      snapshotData,
    });

    console.log(
      `[SnapshotService] Stored snapshot ${snapshotId} for league ${leagueId} with ${
        Object.keys(snapshotData.exchange.cardPrices).length +
        Object.keys(snapshotData.stash.cardPrices).length
      } card prices`,
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

        // Update card rarities based on the active rarity source.
        // Filter-based rarities are stored separately in filter_card_rarities.
        await this.updateRaritiesForSource(gameType, leagueName, snapshotData);

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
   * Update card rarities based on the active rarity source setting.
   *
   * - "poe.ninja" (default): Derive rarities from merged exchange + stash prices
   * - "prohibited-library": Use Prohibited Library CSV-derived rarities
   * - "filter": No-op here — filter rarities are applied separately by RarityModelService
   *
   * Price snapshots are always fetched and stored regardless of the rarity source,
   * since chaos values are needed for value tracking. Only the RARITY assignment
   * is source-dependent.
   */
  private async updateRaritiesForSource(
    gameType: "poe1" | "poe2",
    leagueName: string,
    snapshotData: SessionPriceSnapshot,
  ): Promise<void> {
    let raritySource: string | null = null;
    try {
      raritySource = await this.settingsStore.get(SettingsKey.RaritySource);
    } catch {
      // Settings store may not be available — default to poe.ninja
    }

    if (raritySource === "prohibited-library") {
      // Use Prohibited Library rarities — PL data is already in the database
      // from the ProhibitedLibraryService init/reload cycle
      await this.divinationCards.updateRaritiesFromProhibitedLibrary(
        gameType,
        leagueName,
      );
    } else {
      // Default: derive rarities from poe.ninja prices
      // (When source is "filter", we still write price-based rarities here;
      // the filter rarities are applied separately by RarityModelService
      // and take precedence via the filter_card_rarities JOIN.)
      const mergedPrices = this.mergeCardPrices(snapshotData);
      await this.divinationCards.updateRaritiesFromPrices(
        gameType,
        leagueName,
        snapshotData.exchange.chaosToDivineRatio,
        mergedPrices,
      );
    }
  }

  /**
   * Merge exchange and stash card prices into a single map.
   *
   * Exchange prices are preferred where available (they're based on actual
   * trade volume and are generally more reliable for high-value cards).
   * Stash prices are included for value tracking, but stash-only cards
   * (those with NO exchange data) are downgraded to confidence 3 (low)
   * so that `updateRaritiesFromPrices` assigns them rarity 0 (Unknown).
   *
   * Stash-only prices are unreliable for rarity classification — they can
   * be heavily inflated by price fixers (e.g. a worthless card listed at
   * 300c on the stash API). By marking them low-confidence, we keep the
   * price data available for display while preventing bogus rarities.
   */
  private mergeCardPrices(
    snapshot: SessionPriceSnapshot,
  ): Record<string, { chaosValue: number; confidence: Confidence }> {
    const merged: Record<
      string,
      { chaosValue: number; confidence: Confidence }
    > = {};

    const exchangeNames = new Set(Object.keys(snapshot.exchange.cardPrices));

    // Start with stash prices (lower priority).
    // Cards that exist ONLY in stash (no exchange counterpart) are
    // downgraded to confidence 3 (low) → rarity 0 (Unknown).
    for (const [name, data] of Object.entries(snapshot.stash.cardPrices)) {
      const isStashOnly = !exchangeNames.has(name);
      merged[name] = {
        chaosValue: data.chaosValue,
        confidence: isStashOnly ? 3 : (data.confidence ?? 1),
      };
    }

    // Override with exchange prices where available (higher priority)
    // Exchange prices are always high confidence (from actual trades)
    for (const [name, data] of Object.entries(snapshot.exchange.cardPrices)) {
      merged[name] = {
        chaosValue: data.chaosValue,
        confidence: 1,
      };
    }

    const exchangeCount = exchangeNames.size;
    const stashCount = Object.keys(snapshot.stash.cardPrices).length;
    const mergedCount = Object.keys(merged).length;
    const stashOnlyCount = mergedCount - exchangeCount;

    // Count confidence distribution
    let lowCount = 0;
    let mediumCount = 0;
    let highCount = 0;
    for (const data of Object.values(merged)) {
      if (data.confidence === 3) lowCount++;
      else if (data.confidence === 2) mediumCount++;
      else highCount++;
    }

    console.log(
      `[SnapshotService] Merged card prices: ${exchangeCount} exchange + ${stashCount} stash = ${mergedCount} unique cards (${stashOnlyCount} stash-only, downgraded to low confidence). Confidence: ${highCount} high, ${mediumCount} medium, ${lowCount} low`,
    );

    return merged;
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
