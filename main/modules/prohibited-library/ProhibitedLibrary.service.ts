import { readFile } from "node:fs/promises";

import { app, BrowserWindow, ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { LoggerService } from "~/main/modules/logger";
import { PoeLeaguesRepository } from "~/main/modules/poe-leagues/PoeLeagues.repository";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import {
  assertGameType,
  handleValidationError,
} from "~/main/utils/ipc-validation";

import { ProhibitedLibraryChannel } from "./ProhibitedLibrary.channels";
import type {
  ProhibitedLibraryCardWeightDTO,
  ProhibitedLibraryLoadResultDTO,
  ProhibitedLibraryRawRow,
  ProhibitedLibraryStatusDTO,
} from "./ProhibitedLibrary.dto";
import {
  bucketToFallbackRarity,
  parseProhibitedLibraryCsv,
  resolveCsvPath,
  weightToRarity,
} from "./ProhibitedLibrary.parser";
import {
  ProhibitedLibraryRepository,
  type UpsertCardWeightRow,
} from "./ProhibitedLibrary.repository";

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Orchestrates loading, parsing, and persisting Prohibited Library CSV data.
 *
 * Responsibilities:
 * - Resolve the bundled CSV path (packaged vs dev, per-game)
 * - Read and parse the CSV asset
 * - Resolve the league label from the CSV header against `poe_leagues_cache`
 * - Convert raw weights → rarity values (with bucket fallback)
 * - Persist card weights and cache metadata to the database
 * - Sync `from_boss` flags to `divination_cards`
 * - Expose IPC handlers for Reload, GetStatus, GetCardWeights, GetFromBossCards
 * - Broadcast data-refreshed events to the renderer
 */
class ProhibitedLibraryService {
  private static _instance: ProhibitedLibraryService;
  private readonly logger = LoggerService.createLogger("ProhibitedLibrary");
  private repository: ProhibitedLibraryRepository;
  private poeLeaguesRepository: PoeLeaguesRepository;
  private settingsStore: SettingsStoreService;

  static getInstance(): ProhibitedLibraryService {
    if (!ProhibitedLibraryService._instance) {
      ProhibitedLibraryService._instance = new ProhibitedLibraryService();
    }
    return ProhibitedLibraryService._instance;
  }

  private constructor() {
    const database = DatabaseService.getInstance();
    this.repository = new ProhibitedLibraryRepository(database.getKysely());
    this.poeLeaguesRepository = new PoeLeaguesRepository(database.getKysely());
    this.settingsStore = SettingsStoreService.getInstance();

    this.setupIpcHandlers();

    this.logger.log(`Service initialized (packaged: ${app.isPackaged})`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Public API
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Initialise Prohibited Library data for both games.
   *
   * Called once during app startup. For PoE2, this is currently a no-op
   * since no bundled CSV exists yet.
   */
  public async initialize(): Promise<void> {
    for (const game of ["poe1", "poe2"] as const) {
      try {
        const result = await this.loadData(game, false);
        if (result.cardCount > 0) {
          this.logger.log(
            `[${game}] Loaded ${result.cardCount} cards for league "${result.league}"`,
          );
        } else {
          this.logger.log(`[${game}] No PL data available (no-op)`);
        }
      } catch (error) {
        this.logger.error(
          `[${game}] Failed to load PL data during init:`,
          error,
        );
      }
    }
  }

  /**
   * Load (or re-load) Prohibited Library data for a game.
   *
   * @param game  The game to load data for
   * @param force If true, bypasses the version/league check and always re-parses
   * @returns     Load result DTO with success status, card count, league, and timestamp
   */
  public async loadData(
    game: "poe1" | "poe2",
    force: boolean,
  ): Promise<ProhibitedLibraryLoadResultDTO> {
    // 1. Resolve asset path (packaged vs dev, per-game)
    const csvPath = resolveCsvPath(
      game,
      app.isPackaged,
      process.resourcesPath,
      app.getAppPath(),
    );

    if (!csvPath) {
      // No bundled asset for this game (e.g. PoE2) — clean no-op
      return { success: true, cardCount: 0, league: "", loadedAt: "" };
    }

    // 2. Read asset from disk
    let csvContent: string;
    try {
      csvContent = await readFile(csvPath, "utf-8");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown read error";
      this.logger.error(
        `[${game}] Failed to read CSV at "${csvPath}":`,
        message,
      );
      return {
        success: false,
        cardCount: 0,
        league: "",
        loadedAt: "",
        error: `Failed to read CSV: ${message}`,
      };
    }

    // 3. Parse
    let rows: ProhibitedLibraryRawRow[];
    let rawLeagueLabel: string;
    try {
      const parsed = parseProhibitedLibraryCsv(csvContent);
      rows = parsed.rows;
      rawLeagueLabel = parsed.rawLeagueLabel;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown parse error";
      this.logger.error(`[${game}] CSV parse failed:`, message);
      return {
        success: false,
        cardCount: 0,
        league: "",
        loadedAt: "",
        error: `CSV parse failed: ${message}`,
      };
    }

    // 4. Resolve league name
    const league = await this.resolveLeagueName(rawLeagueLabel, game);

    // 5. Version-check: skip re-parse if same app version AND same league
    if (!force) {
      const cached = await this.repository.getMetadata(game);
      const currentVersion = app.getVersion();
      if (
        cached &&
        cached.app_version === currentVersion &&
        cached.league === league
      ) {
        this.logger.log(
          `[${game}] Skipping re-parse — version "${currentVersion}" and league "${league}" unchanged`,
        );
        return {
          success: true,
          cardCount: cached.card_count,
          league,
          loadedAt: cached.loaded_at,
        };
      }
    }

    // 6. Convert weights → rarities
    const loadedAt = new Date().toISOString();
    const mapped = this.convertWeights(rows, league, game, loadedAt);

    // 7. Persist
    await this.repository.upsertCardWeights(mapped);
    await this.repository.upsertMetadata(
      game,
      league,
      loadedAt,
      app.getVersion(),
      mapped.length,
    );
    await this.repository.syncFromBossFlags(game, league);

    // 8. Cross-check active league and warn if divergent
    await this.warnIfLeagueMismatch(league, game);

    // 9. Notify renderer
    this.broadcastRefresh(game);

    return { success: true, cardCount: mapped.length, league, loadedAt };
  }

  /**
   * Get the status of the Prohibited Library data for a game.
   */
  public async getStatus(
    game: "poe1" | "poe2",
  ): Promise<ProhibitedLibraryStatusDTO> {
    const metadata = await this.repository.getMetadata(game);

    if (!metadata) {
      return {
        hasData: false,
        lastLoadedAt: null,
        cardCount: 0,
        league: null,
        appVersion: null,
      };
    }

    return {
      hasData: true,
      lastLoadedAt: metadata.loaded_at,
      cardCount: metadata.card_count,
      league: metadata.league,
      appVersion: metadata.app_version,
    };
  }

  /**
   * Expose the repository for use by other services (e.g. DivinationCardsRepository join).
   */
  public getRepository(): ProhibitedLibraryRepository {
    return this.repository;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // IPC Handlers
  // ══════════════════════════════════════════════════════════════════════════

  private setupIpcHandlers(): void {
    // ── Reload (force re-parse) ─────────────────────────────────────────
    ipcMain.handle(
      ProhibitedLibraryChannel.Reload,
      async (
        _event,
        game: unknown,
      ): Promise<
        ProhibitedLibraryLoadResultDTO | { success: false; error: string }
      > => {
        try {
          assertGameType(game, ProhibitedLibraryChannel.Reload);
          return await this.loadData(game, true);
        } catch (error) {
          return handleValidationError(error, ProhibitedLibraryChannel.Reload);
        }
      },
    );

    // ── GetStatus ───────────────────────────────────────────────────────
    ipcMain.handle(
      ProhibitedLibraryChannel.GetStatus,
      async (
        _event,
        game: unknown,
      ): Promise<
        ProhibitedLibraryStatusDTO | { success: false; error: string }
      > => {
        try {
          assertGameType(game, ProhibitedLibraryChannel.GetStatus);
          return await this.getStatus(game);
        } catch (error) {
          return handleValidationError(
            error,
            ProhibitedLibraryChannel.GetStatus,
          );
        }
      },
    );

    // ── GetCardWeights ──────────────────────────────────────────────────
    ipcMain.handle(
      ProhibitedLibraryChannel.GetCardWeights,
      async (
        _event,
        game: unknown,
      ): Promise<
        ProhibitedLibraryCardWeightDTO[] | { success: false; error: string }
      > => {
        try {
          assertGameType(game, ProhibitedLibraryChannel.GetCardWeights);

          const leagueKey =
            game === "poe1"
              ? SettingsKey.SelectedPoe1League
              : SettingsKey.SelectedPoe2League;
          const activeLeague = await this.settingsStore.get(leagueKey);

          // Try the active league first; fall back to whatever league is in metadata
          let weights = await this.repository.getCardWeights(
            game,
            activeLeague,
          );
          if (weights.length === 0) {
            const metadata = await this.repository.getMetadata(game);
            if (metadata && metadata.league !== activeLeague) {
              weights = await this.repository.getCardWeights(
                game,
                metadata.league,
              );
            }
          }

          return weights;
        } catch (error) {
          return handleValidationError(
            error,
            ProhibitedLibraryChannel.GetCardWeights,
          );
        }
      },
    );

    // ── GetFromBossCards ─────────────────────────────────────────────────
    ipcMain.handle(
      ProhibitedLibraryChannel.GetFromBossCards,
      async (
        _event,
        game: unknown,
      ): Promise<
        ProhibitedLibraryCardWeightDTO[] | { success: false; error: string }
      > => {
        try {
          assertGameType(game, ProhibitedLibraryChannel.GetFromBossCards);

          const leagueKey =
            game === "poe1"
              ? SettingsKey.SelectedPoe1League
              : SettingsKey.SelectedPoe2League;
          const activeLeague = await this.settingsStore.get(leagueKey);

          // Try the active league first; fall back to whatever league is in metadata
          let cards = await this.repository.getFromBossCards(
            game,
            activeLeague,
          );
          if (cards.length === 0) {
            const metadata = await this.repository.getMetadata(game);
            if (metadata && metadata.league !== activeLeague) {
              cards = await this.repository.getFromBossCards(
                game,
                metadata.league,
              );
            }
          }

          return cards;
        } catch (error) {
          return handleValidationError(
            error,
            ProhibitedLibraryChannel.GetFromBossCards,
          );
        }
      },
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // League Resolution
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve the raw league label from the CSV header to a canonical name
   * by performing a case-insensitive lookup in `poe_leagues_cache`.
   *
   * If no match is found, returns the raw label as-is with a warning log.
   */
  private async resolveLeagueName(
    headerLabel: string,
    game: "poe1" | "poe2",
  ): Promise<string> {
    const match = await this.poeLeaguesRepository.getLeagueByName(
      game,
      headerLabel,
    );

    if (match) {
      this.logger.log(
        `[${game}] Resolved CSV league label "${headerLabel}" → "${match.name}"`,
      );
      return match.name;
    }

    this.logger.warn(
      `[${game}] CSV league label "${headerLabel}" not found in poe_leagues_cache. ` +
        `Using raw label as-is.`,
    );
    return headerLabel;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Weight Conversion
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Convert parsed CSV rows into upsert-ready card weight records.
   *
   * For each row:
   * - If the card has a weight > 0, compute rarity via `weightToRarity`
   * - If the card has weight = 0 (or missing), use `bucketToFallbackRarity`
   * - If maxWeight across all rows is ≤ 0, `weightToRarity` returns 0 (unknown),
   *   so we fall back to bucket rarity in that case too
   */
  private convertWeights(
    rows: ProhibitedLibraryRawRow[],
    league: string,
    game: "poe1" | "poe2",
    loadedAt: string,
  ): UpsertCardWeightRow[] {
    // Find the maximum weight across all rows for normalisation
    const maxWeight = rows.reduce((max, row) => Math.max(max, row.weight), 0);

    return rows.map((row) => {
      let rarity: 1 | 2 | 3 | 4;

      if (row.weight > 0 && maxWeight > 0) {
        const computed = weightToRarity(row.weight, maxWeight);
        // weightToRarity returns 0 when maxWeight <= 0 (shouldn't happen here
        // since we checked above, but be defensive)
        rarity =
          computed === 0
            ? bucketToFallbackRarity(row.bucket)
            : (computed as 1 | 2 | 3 | 4);
      } else {
        // No weight data — use bucket fallback
        rarity = bucketToFallbackRarity(row.bucket);
      }

      return {
        cardName: row.cardName,
        game,
        league,
        weight: row.weight,
        rarity,
        fromBoss: row.fromBoss,
        loadedAt,
      };
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Broadcast
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Notify all renderer windows that PL data has been refreshed.
   */
  private broadcastRefresh(game: "poe1" | "poe2"): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      try {
        if (
          window &&
          !window.isDestroyed() &&
          window.webContents &&
          !window.webContents.isDestroyed()
        ) {
          window.webContents.send(
            ProhibitedLibraryChannel.OnDataRefreshed,
            game,
          );
        }
      } catch {
        // Window may have been destroyed between check and send — ignore
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Warnings
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Log a debug message if the resolved CSV league diverges from the user's
   * active league setting. This is expected behavior — the bundled CSV's n-1
   * column is the default dataset for any league that doesn't have its own
   * column yet (new leagues, variant leagues like "Phrecia 2.0", permanent
   * leagues like "Standard", etc.). The IPC handlers use metadata-based
   * fallback to serve the correct data regardless of the mismatch.
   */
  private async warnIfLeagueMismatch(
    resolvedLeague: string,
    game: "poe1" | "poe2",
  ): Promise<void> {
    try {
      const leagueKey =
        game === "poe1"
          ? SettingsKey.SelectedPoe1League
          : SettingsKey.SelectedPoe2League;
      const activeLeague = await this.settingsStore.get(leagueKey);

      if (resolvedLeague !== activeLeague) {
        this.logger.debug(
          `[${game}] PL asset league is "${resolvedLeague}" but active league is "${activeLeague}". ` +
            `This is expected — the n-1 dataset will be used as fallback.`,
        );
      }
    } catch {
      // Settings store may not be available during tests — ignore
    }
  }
}

export { ProhibitedLibraryService };
