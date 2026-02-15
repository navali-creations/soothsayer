import { BrowserWindow, ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { DivinationCardsService } from "~/main/modules/divination-cards";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import {
  assertBoundedString,
  assertCardName,
  assertEnum,
  assertGameType,
  assertInteger,
  assertOptionalString,
  handleValidationError,
} from "~/main/utils/ipc-validation";
import type { KnownRarity } from "~/types/data-stores";

import { FilterChannel } from "./Filter.channels";
import type {
  DiscoveredFilterDTO,
  FilterMetadataDTO,
  FilterParseResultDTO,
  FilterScanResultDTO,
  RaritySource,
} from "./Filter.dto";
import { FilterMapper } from "./Filter.mapper";
import { FilterParser } from "./Filter.parser";
import { FilterRepository } from "./Filter.repository";
import { FilterScanner } from "./Filter.scanner";

/**
 * Service for managing Path of Exile loot filter operations.
 *
 * Handles:
 * - Scanning filter directories for available filters (lazy metadata extraction)
 * - Storing/retrieving filter metadata in the database
 * - Managing filter selection and rarity source settings
 * - Coordinating filter parsing (delegated to Filter.parser.ts in Milestone 3)
 *
 * Uses the singleton pattern consistent with other services in the project.
 */
const VALID_RARITY_SOURCES = [
  "poe.ninja",
  "filter",
  "prohibited-library",
] as const;

class FilterService {
  private static _instance: FilterService;
  private repository: FilterRepository;
  private scanner: FilterScanner;
  private settingsStore: SettingsStoreService;
  private divinationCards: DivinationCardsService;

  static getInstance(): FilterService {
    if (!FilterService._instance) {
      FilterService._instance = new FilterService();
    }
    return FilterService._instance;
  }

  constructor() {
    const db = DatabaseService.getInstance();
    this.repository = new FilterRepository(db.getKysely());
    this.scanner = new FilterScanner();
    this.settingsStore = SettingsStoreService.getInstance();
    this.divinationCards = DivinationCardsService.getInstance();
    this.setupIpcHandlers();
  }

  // ─── IPC Handlers ──────────────────────────────────────────────────────

  private setupIpcHandlers(): void {
    // Scan filter directories for available filters (metadata only)
    ipcMain.handle(FilterChannel.ScanFilters, async () => {
      return await this.scanFilters();
    });

    // Get all discovered filters from the database
    ipcMain.handle(FilterChannel.GetFilters, async () => {
      return await this.getAllFilters();
    });

    // Get a specific filter by ID
    ipcMain.handle(
      FilterChannel.GetFilter,
      async (_event, filterId: string) => {
        try {
          assertBoundedString(
            filterId,
            "filterId",
            FilterChannel.GetFilter,
            256,
          );
          return await this.getFilter(filterId);
        } catch (error) {
          return handleValidationError(error, FilterChannel.GetFilter);
        }
      },
    );

    // Trigger a full parse of a specific filter
    ipcMain.handle(
      FilterChannel.ParseFilter,
      async (_event, filterId: string) => {
        try {
          assertBoundedString(
            filterId,
            "filterId",
            FilterChannel.ParseFilter,
            256,
          );
          return await this.parseFilter(filterId);
        } catch (error) {
          return handleValidationError(error, FilterChannel.ParseFilter);
        }
      },
    );

    // Select a filter (or clear selection with null)
    ipcMain.handle(
      FilterChannel.SelectFilter,
      async (_event, filterId: string | null) => {
        try {
          assertOptionalString(
            filterId,
            "filterId",
            FilterChannel.SelectFilter,
            256,
          );
          return await this.selectFilter(filterId);
        } catch (error) {
          return handleValidationError(error, FilterChannel.SelectFilter);
        }
      },
    );

    // Get the currently selected filter metadata
    ipcMain.handle(FilterChannel.GetSelectedFilter, async () => {
      return await this.getSelectedFilter();
    });

    // Get the current rarity source setting
    ipcMain.handle(FilterChannel.GetRaritySource, async () => {
      return await this.getRaritySource();
    });

    // Set the rarity source setting
    ipcMain.handle(
      FilterChannel.SetRaritySource,
      async (_event, source: RaritySource) => {
        try {
          assertEnum(
            source,
            "source",
            FilterChannel.SetRaritySource,
            VALID_RARITY_SOURCES,
          );
          return await this.setRaritySource(source);
        } catch (error) {
          return handleValidationError(error, FilterChannel.SetRaritySource);
        }
      },
    );

    // Apply filter rarities to divination cards
    ipcMain.handle(
      FilterChannel.ApplyFilterRarities,
      async (
        _event,
        filterId: string,
        game: "poe1" | "poe2",
        league: string,
      ) => {
        try {
          assertBoundedString(
            filterId,
            "filterId",
            FilterChannel.ApplyFilterRarities,
            256,
          );
          assertGameType(game, FilterChannel.ApplyFilterRarities);
          assertBoundedString(
            league,
            "league",
            FilterChannel.ApplyFilterRarities,
            256,
          );
          return await this.applyFilterRarities(filterId, game, league);
        } catch (error) {
          return handleValidationError(
            error,
            FilterChannel.ApplyFilterRarities,
          );
        }
      },
    );

    // Update a single card's rarity within a parsed filter
    ipcMain.handle(
      FilterChannel.UpdateFilterCardRarity,
      async (
        _event,
        filterId: string,
        cardName: string,
        rarity: KnownRarity,
      ) => {
        try {
          assertBoundedString(
            filterId,
            "filterId",
            FilterChannel.UpdateFilterCardRarity,
            256,
          );
          assertCardName(cardName, FilterChannel.UpdateFilterCardRarity);
          assertInteger(
            rarity,
            "rarity",
            FilterChannel.UpdateFilterCardRarity,
            {
              min: 1,
              max: 4,
            },
          );

          await this.repository.updateCardRarity(
            filterId,
            cardName,
            rarity as KnownRarity,
          );
          console.log(
            `[Filters] Updated card rarity: "${cardName}" → ${rarity} in filter ${filterId}`,
          );
          return { success: true };
        } catch (error) {
          return handleValidationError(
            error,
            FilterChannel.UpdateFilterCardRarity,
          );
        }
      },
    );
  }

  // ─── Scanning ──────────────────────────────────────────────────────────

  /**
   * Scan filter directories for available filters.
   *
   * This performs a lazy metadata-only scan:
   * 1. Reads local and online filter directories
   * 2. Extracts minimal metadata (name, last update) from each file
   * 3. Upserts metadata into the database
   * 4. Cleans up stale entries (filters that no longer exist on disk)
   * 5. Returns the discovered filters with outdated detection
   */
  public async scanFilters(): Promise<FilterScanResultDTO> {
    console.log("[FilterService] Starting filter directory scan...");

    // Phase 1: Scan file system for filter files (only the active game's directory)
    const activeGame =
      ((await this.settingsStore.get(SettingsKey.ActiveGame)) as
        | "poe1"
        | "poe2") ?? "poe1";
    const scannedFilters = await this.scanner.scanAll(activeGame);

    console.log(
      `[FilterService] Found ${scannedFilters.length} filter files on disk`,
    );

    // Phase 2: Upsert metadata into the database
    const upsertData = scannedFilters.map((scanned) => ({
      id: FilterScanner.generateFilterId(scanned.filePath),
      filterType: scanned.filterType,
      filePath: scanned.filePath,
      filterName: scanned.filterName,
      lastUpdate: scanned.lastUpdate,
      isFullyParsed: false,
      parsedAt: null,
    }));

    await this.repository.upsertMany(upsertData);

    // Phase 3: Clean up stale entries (filters no longer on disk)
    const activePaths = scannedFilters.map((f) => f.filePath);
    const deletedCount =
      await this.repository.deleteNotInFilePaths(activePaths);

    if (deletedCount > 0) {
      console.log(
        `[FilterService] Cleaned up ${deletedCount} stale filter entries`,
      );
    }

    // Phase 4: Build response with outdated detection
    const leagueStartDate = await this.getLeagueStartDate();
    const allMetadata = await this.repository.getAll();

    const filters = allMetadata.map((metadata) =>
      FilterMapper.toDiscoveredFilterDTO(metadata, leagueStartDate),
    );

    const localCount = filters.filter((f) => f.type === "local").length;
    const onlineCount = filters.filter((f) => f.type === "online").length;

    console.log(
      `[FilterService] Scan complete: ${localCount} local, ${onlineCount} online filters`,
    );

    return {
      filters,
      localCount,
      onlineCount,
    };
  }

  // ─── Filter Retrieval ──────────────────────────────────────────────────

  /**
   * Get all filters from the database, with outdated detection.
   */
  public async getAllFilters(): Promise<DiscoveredFilterDTO[]> {
    const leagueStartDate = await this.getLeagueStartDate();
    const allMetadata = await this.repository.getAll();

    return allMetadata.map((metadata) =>
      FilterMapper.toDiscoveredFilterDTO(metadata, leagueStartDate),
    );
  }

  /**
   * Get a specific filter by ID
   */
  public async getFilter(filterId: string): Promise<FilterMetadataDTO | null> {
    return await this.repository.getById(filterId);
  }

  // ─── Filter Parsing ───────────────────────────────────────────────────

  /**
   * Parse a filter's divination card section and store the results.
   *
   * This performs a full parse of the filter file:
   * 1. Reads the filter file from disk
   * 2. Navigates to the divination cards section via TOC
   * 3. Parses tier blocks and extracts card names
   * 4. Maps tiers to app rarities (1-4)
   * 5. Stores results in the database (filter_card_rarities)
   * 6. Marks the filter as fully parsed
   *
   * If the filter has no divination section, it returns an empty result
   * and the app should fall back to poe.ninja pricing.
   */
  public async parseFilter(filterId: string): Promise<FilterParseResultDTO> {
    const metadata = await this.repository.getById(filterId);

    if (!metadata) {
      throw new Error(`Filter not found: ${filterId}`);
    }

    console.log(
      `[FilterService] Parsing filter "${metadata.filterName}" (${filterId})...`,
    );

    // Delegate to FilterParser for the actual file parsing
    const parseResult = await FilterParser.parseFilterFile(metadata.filePath);

    if (!parseResult.hasDivinationSection) {
      console.log(
        `[FilterService] Filter "${metadata.filterName}" has no divination card section — falling back to poe.ninja`,
      );
      return {
        filterId,
        filterName: metadata.filterName,
        totalCards: 0,
        rarities: [],
        hasDivinationSection: false,
      };
    }

    // Convert Map to array of rarity DTOs for storage and response
    const rarities = Array.from(parseResult.cardRarities.entries()).map(
      ([cardName, rarity]) => ({
        filterId,
        cardName,
        rarity,
      }),
    );

    // Store card rarities in the database (replace existing)
    await this.repository.replaceCardRarities(
      filterId,
      rarities.map((r) => ({ cardName: r.cardName, rarity: r.rarity })),
    );

    // Mark the filter as fully parsed
    await this.repository.markAsParsed(filterId);

    console.log(
      `[FilterService] Successfully parsed "${metadata.filterName}": ${parseResult.totalCards} cards mapped`,
    );

    return {
      filterId,
      filterName: metadata.filterName,
      totalCards: parseResult.totalCards,
      rarities,
      hasDivinationSection: true,
    };
  }

  // ─── Rarity Application ────────────────────────────────────────────────

  /**
   * Apply filter-based rarities to divination cards.
   *
   * This is the core method for Milestone 5. It:
   * 1. Ensures the filter is fully parsed (triggers parse if needed)
   * 2. Reads filter card rarities from `filter_card_rarities`
   * 3. Updates `divination_card_rarities` with filter-derived values
   * 4. Cards not in the filter default to rarity 4 (common)
   * 5. Emits IPC event to notify the frontend
   *
   * @param filterId - The ID of the filter to apply
   * @param game - The game type ("poe1" or "poe2")
   * @param league - The league name
   */
  public async applyFilterRarities(
    filterId: string,
    game: "poe1" | "poe2",
    league: string,
  ): Promise<{ success: boolean; totalCards: number; filterName: string }> {
    console.log(
      `[FilterService] Applying filter rarities for ${game}/${league} from filter ${filterId}...`,
    );

    // Step 1: Ensure filter is fully parsed
    const parseResult = await this.ensureFilterParsed(filterId);

    if (!parseResult) {
      throw new Error(`Filter not found: ${filterId}`);
    }

    if (!parseResult.hasDivinationSection) {
      console.warn(
        `[FilterService] Filter "${parseResult.filterName}" has no divination section — cannot apply filter rarities`,
      );
      return {
        success: false,
        totalCards: 0,
        filterName: parseResult.filterName,
      };
    }

    // Step 2: Delegate to DivinationCardsService to write rarities
    await this.divinationCards.updateRaritiesFromFilter(filterId, game, league);

    console.log(
      `[FilterService] Successfully applied filter rarities from "${parseResult.filterName}" (${parseResult.totalCards} cards)`,
    );

    // Step 3: Emit IPC event to notify frontend
    this.emitFilterRaritiesApplied({
      filterId,
      filterName: parseResult.filterName,
      game,
      league,
      totalCards: parseResult.totalCards,
    });

    return {
      success: true,
      totalCards: parseResult.totalCards,
      filterName: parseResult.filterName,
    };
  }

  /**
   * Ensure a filter is fully parsed, triggering a parse if needed.
   *
   * This is called when filter rarities are needed (e.g., when selecting
   * a filter or when the rarity source is set to "filter").
   *
   * @param filterId - The filter to ensure is parsed
   * @returns The parse result, or null if the filter doesn't exist
   */
  public async ensureFilterParsed(
    filterId: string,
  ): Promise<FilterParseResultDTO | null> {
    const metadata = await this.repository.getById(filterId);

    if (!metadata) {
      return null;
    }

    // If already fully parsed, return cached results from the database
    if (metadata.isFullyParsed) {
      const cachedRarities = await this.repository.getCardRarities(filterId);

      return {
        filterId,
        filterName: metadata.filterName,
        totalCards: cachedRarities.length,
        rarities: cachedRarities,
        hasDivinationSection: cachedRarities.length > 0,
      };
    }

    // Not yet parsed — trigger a full parse
    return await this.parseFilter(filterId);
  }

  // ─── Filter Selection ──────────────────────────────────────────────────

  /**
   * Select a filter as the active rarity source, or clear the selection.
   *
   * When selecting a filter:
   * - Stores the filter ID in user settings
   * - If the filter hasn't been fully parsed yet, it will be parsed on demand
   *   when rarities are needed (Milestone 3)
   *
   * When clearing (filterId = null):
   * - Clears the selected filter ID in user settings
   */
  public async selectFilter(filterId: string | null): Promise<void> {
    if (filterId !== null) {
      // Validate that the filter exists
      const metadata = await this.repository.getById(filterId);
      if (!metadata) {
        throw new Error(`Filter not found: ${filterId}`);
      }

      console.log(
        `[FilterService] Selected filter: "${metadata.filterName}" (${filterId})`,
      );
    } else {
      console.log("[FilterService] Cleared filter selection");
    }

    await this.settingsStore.set(SettingsKey.SelectedFilterId, filterId);
  }

  /**
   * Get the currently selected filter's metadata.
   * Returns null if no filter is selected.
   */
  public async getSelectedFilter(): Promise<FilterMetadataDTO | null> {
    const selectedId = await this.settingsStore.get(
      SettingsKey.SelectedFilterId,
    );

    if (!selectedId) {
      return null;
    }

    return await this.repository.getById(selectedId);
  }

  // ─── Rarity Source Settings ────────────────────────────────────────────

  /**
   * Get the current rarity source setting
   */
  public async getRaritySource(): Promise<RaritySource> {
    return await this.settingsStore.get(SettingsKey.RaritySource);
  }

  /**
   * Set the rarity source setting.
   *
   * Valid values:
   * - `"poe.ninja"` — Price-based rarities (default)
   * - `"filter"` — Rarities from selected loot filter
   * - `"prohibited-library"` — Community-driven data (future)
   */
  public async setRaritySource(source: RaritySource): Promise<void> {
    if (!(VALID_RARITY_SOURCES as readonly string[]).includes(source)) {
      throw new Error(`Invalid rarity source: ${source}`);
    }

    console.log(`[FilterService] Rarity source changed to: ${source}`);
    await this.settingsStore.set(SettingsKey.RaritySource, source);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  /**
   * Get the current league's start date for outdated detection.
   *
   * Attempts to get the start date from the currently selected league.
   * Returns null if no league is selected or start date is unavailable.
   */
  private async getLeagueStartDate(): Promise<string | null> {
    try {
      // Get the active game's selected league
      const activeGame = await this.settingsStore.get(SettingsKey.ActiveGame);

      const leagueKey =
        activeGame === "poe1"
          ? SettingsKey.SelectedPoe1League
          : SettingsKey.SelectedPoe2League;

      const selectedLeague = await this.settingsStore.get(leagueKey);

      if (!selectedLeague || selectedLeague === "Standard") {
        // Standard league has no meaningful start date for outdated detection
        return null;
      }

      // Note: For more accurate outdated detection, we could query
      // PoeLeaguesRepository for the league's start_at date. For now,
      // we return null and rely on filter metadata timestamps.
      // This can be enhanced in a later milestone.
      return null;
    } catch (error) {
      console.warn(
        "[FilterService] Failed to get league start date for outdated detection:",
        error,
      );
      return null;
    }
  }

  // ─── Event Emission ────────────────────────────────────────────────────

  /**
   * Emit an event to all renderer windows when filter rarities have been applied.
   * This allows the frontend to refresh card displays reactively.
   */
  private emitFilterRaritiesApplied(data: {
    filterId: string;
    filterName: string;
    game: string;
    league: string;
    totalCards: number;
  }): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
      try {
        if (
          window &&
          !window.isDestroyed() &&
          window.webContents &&
          !window.webContents.isDestroyed()
        ) {
          window.webContents.send(FilterChannel.OnFilterRaritiesApplied, data);
        }
      } catch (error) {
        console.warn(
          "[FilterService] Failed to emit filter rarities applied event:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  // ─── Accessors ─────────────────────────────────────────────────────────

  /**
   * Get the repository instance (for testing or advanced usage)
   */
  public getRepository(): FilterRepository {
    return this.repository;
  }

  /**
   * Get the scanner instance (for testing or advanced usage)
   */
  public getScanner(): FilterScanner {
    return this.scanner;
  }
}

export { FilterService };
