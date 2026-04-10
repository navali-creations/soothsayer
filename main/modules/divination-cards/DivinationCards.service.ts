import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { app, ipcMain } from "electron";
import { type Kysely, sql } from "kysely";

import { type Database, DatabaseService } from "~/main/modules/database";
import { LoggerService } from "~/main/modules/logger";
import { RarityInsightsRepository } from "~/main/modules/rarity-insights/RarityInsights.repository";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import { cleanWikiMarkup } from "~/main/utils/cleanWikiMarkup";
import {
  assertBoundedString,
  assertCardName,
  assertGameType,
  assertInteger,
  handleValidationError,
} from "~/main/utils/ipc-validation";
import { resolveDevFile } from "~/main/utils/resolve-dev-path";
import { resolvePoe1CardsJsonPath } from "~/main/utils/resolve-poe1-package-path";
import { weightToDropRarity } from "~/main/utils/weight-to-rarity";
import type { Confidence, Rarity } from "~/types/data-stores";

import { DivinationCardsChannel } from "./DivinationCards.channels";
import type {
  DivinationCardDTO,
  DivinationCardSearchDTO,
  DivinationCardStatsDTO,
} from "./DivinationCards.dto";
import { DivinationCardsRepository } from "./DivinationCards.repository";

interface DivinationCardJson {
  name: string;
  stack_size: number;
  description: string;
  reward_html: string;
  art_src: string;
  flavour_html: string;
  is_disabled?: boolean; // from package — only present in cards.json, absent in league-specific files
  weight?: number; // PL weight (0 for some boss-only cards)
  from_boss?: boolean; // explicitly flagged boss-only card
}

/**
 * Service for managing divination cards static data
 * Populates and maintains the divination_cards table from JSON files
 */
class DivinationCardsService {
  private static _instance: DivinationCardsService;
  private readonly logger = LoggerService.createLogger("DivinationCards");
  private readonly kysely: Kysely<Database>;
  private repository: DivinationCardsRepository;
  private rarityInsightsRepository: RarityInsightsRepository;

  private settingsStore: SettingsStoreService;
  private readonly poe1CardsJsonPath: string;
  private readonly poe2CardsJsonPath: string;

  static getInstance(): DivinationCardsService {
    if (!DivinationCardsService._instance) {
      DivinationCardsService._instance = new DivinationCardsService();
    }
    return DivinationCardsService._instance;
  }

  private constructor() {
    const database = DatabaseService.getInstance();
    this.kysely = database.getKysely();
    this.repository = new DivinationCardsRepository(this.kysely);
    this.rarityInsightsRepository = new RarityInsightsRepository(this.kysely);

    this.settingsStore = SettingsStoreService.getInstance();

    // Determine paths based on whether app is packaged
    // When packaged, extraResource copies directories to resources/<dirname>/
    // e.g. ./renderer/assets/poe1 -> resources/poe1/
    if (app.isPackaged) {
      this.poe1CardsJsonPath = join(
        process.resourcesPath,
        "poe1",
        "cards.json",
      );
      this.poe2CardsJsonPath = join(
        process.resourcesPath,
        "poe2",
        "cards.json",
      );
    } else {
      // In development, app.getAppPath() returns the directory containing
      // the main entry file. With Electron Forge + Vite this is typically
      // `.vite/build/` which does NOT contain the renderer assets.
      // Walk up from appPath until we find the card JSON files,
      // falling back to appPath itself for non-Vite setups where the assets
      // are relative to the main entry.
      const appPath = app.getAppPath();
      this.poe1CardsJsonPath = resolveDevFile(
        appPath,
        join("renderer", "assets", "poe1", "cards.json"),
      );
      this.poe2CardsJsonPath = resolveDevFile(
        appPath,
        join("renderer", "assets", "poe2", "cards.json"),
      );
    }

    this.setupIpcHandlers();

    this.logger.log(`Service initialized (packaged: ${app.isPackaged})`);
    this.logger.log(`PoE1 cards path: ${this.poe1CardsJsonPath}`);
    this.logger.log(`PoE2 cards path: ${this.poe2CardsJsonPath}`);
  }

  /**
   * Initialize divination cards data from JSON files
   * Called during app startup
   */
  public async initialize(): Promise<void> {
    try {
      // Get the selected league so we can resolve a league-specific JSON
      const league = await this.settingsStore.get(
        SettingsKey.SelectedPoe1League,
      );
      const poe1League = league || "Standard";

      // Resolve path — tries cards-<League>.json first, falls back to cards.json
      const jsonPath = resolvePoe1CardsJsonPath(
        poe1League,
        app.isPackaged,
        process.resourcesPath,
      );
      const isLeagueSpecific = jsonPath.includes(`cards-${poe1League}.json`);

      // Initialize PoE1 cards
      await this.initializeGameCards(
        "poe1",
        jsonPath,
        poe1League,
        isLeagueSpecific,
      );

      // Initialize PoE2 cards (when available)
      // await this.initializeGameCards("poe2", this.poe2CardsJsonPath, "Standard", false);

      this.logger.log("Successfully initialized all cards");

      // Note: Rarities are now updated by Snapshot.service.ts when it fetches price data
      // This avoids duplicate API calls and ensures consistency with snapshot data
    } catch (error) {
      this.logger.error("Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Initialize cards for a specific game
   */
  private async initializeGameCards(
    game: "poe1" | "poe2",
    jsonPath: string,
    league: string,
    isLeagueSpecific: boolean,
  ): Promise<void> {
    try {
      const cards = this.loadCardsFromJson(jsonPath);
      await this.syncCards(game, cards, league, isLeagueSpecific);
      this.logger.log(
        `Initialized ${game.toUpperCase()} ${league} with ${
          cards.length
        } cards (league-specific: ${isLeagueSpecific})`,
      );
      if (!isLeagueSpecific && league !== "Standard") {
        this.logger.warn(
          `No league-specific JSON for ${league}, using cards.json fallback — pool accuracy will be reduced`,
        );
      }
    } catch (error) {
      // If file doesn't exist (like poe2 cards), just log and continue
      if ((error as any)?.code === "ENOENT") {
        this.logger.log(`${game.toUpperCase()} cards file not found, skipping`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Load cards from a JSON file
   */
  private loadCardsFromJson(jsonPath: string): DivinationCardJson[] {
    const jsonContent = readFileSync(jsonPath, "utf-8");
    const parsed: unknown = JSON.parse(jsonContent);
    if (!Array.isArray(parsed)) {
      throw new Error(`Expected array in ${jsonPath}, got ${typeof parsed}`);
    }
    for (let i = 0; i < parsed.length; i++) {
      const card = parsed[i];
      if (
        typeof card !== "object" ||
        card === null ||
        typeof card.name !== "string" ||
        typeof card.stack_size !== "number" ||
        typeof card.art_src !== "string"
      ) {
        throw new Error(`Invalid card entry at index ${i} in ${jsonPath}`);
      }
    }
    const withNewFields = parsed.filter(
      (c: any) => c.weight !== undefined || c.from_boss !== undefined,
    ).length;
    if (withNewFields > 0) {
      this.logger.log(
        `Loaded ${parsed.length} cards from ${jsonPath} (${withNewFields} with weight/from_boss data)`,
      );
    }
    return parsed as DivinationCardJson[];
  }

  /**
   * Generate a hash for a card's data to detect changes
   */
  private hashCard(card: DivinationCardJson): string {
    const dataString = JSON.stringify({
      name: card.name,
      stack_size: card.stack_size,
      description: card.description,
      reward_html: card.reward_html,
      art_src: card.art_src,
      flavour_html: card.flavour_html,
    });
    return createHash("sha256").update(dataString).digest("hex");
  }

  /**
   * Sync cards from JSON to database
   * - Insert new cards
   * - Update changed cards
   * - Keep existing cards unchanged if data matches
   */
  private async syncCards(
    game: "poe1" | "poe2",
    cards: DivinationCardJson[],
    league: string,
    isLeagueSpecific: boolean,
  ): Promise<void> {
    // ── Phase 1: Upsert divination_cards (master catalogue) ──────────
    // Batch-fetch all existing hashes in one query instead of per-card SELECTs.
    const existingHashes = await this.repository.getAllCardHashes(game);

    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const card of cards) {
      const cardHash = this.hashCard(card);
      // Clean wiki markup at write time so all read paths get pre-cleaned HTML.
      // Hash uses raw values to detect source changes; DB stores cleaned values.
      const cleanedRewardHtml = cleanWikiMarkup(card.reward_html);
      const cleanedFlavourHtml = cleanWikiMarkup(card.flavour_html || "");
      const existingHash = existingHashes.get(card.name) ?? null;

      if (!existingHash) {
        // Insert new card
        await this.repository.insertCard(
          game,
          card.name,
          card.stack_size,
          card.description,
          cleanedRewardHtml,
          card.art_src,
          cleanedFlavourHtml,
          cardHash,
        );
        inserted++;
      } else if (existingHash !== cardHash) {
        // Update changed card
        await this.repository.updateCard(
          game,
          card.name,
          card.stack_size,
          card.description,
          cleanedRewardHtml,
          card.art_src,
          cleanedFlavourHtml,
          cardHash,
        );
        updated++;
      } else {
        unchanged++;
      }
    }

    this.logger.log(
      `${game.toUpperCase()} sync: ${inserted} inserted, ${updated} updated, ${unchanged} unchanged`,
    );

    // ── Phase 2: Upsert divination_card_availability ─────────────────
    // syncCards() is the single writer for from_boss, weight, and
    // is_disabled in divination_card_availability.
    // Wrapped in a single transaction to avoid ~500 individual auto-commits.
    const kysely = this.kysely;

    if (cards.length > 0) {
      await kysely
        .insertInto("divination_card_availability")
        .values(
          cards.map((card) => ({
            game,
            league,
            card_name: card.name,
            is_disabled: (card.is_disabled ?? false) ? 1 : 0,
            from_boss: (card.from_boss ?? false) ? 1 : 0,
            weight: card.weight ?? null,
            updated_at: sql`datetime('now')`,
          })),
        )
        .onConflict((oc) =>
          oc.columns(["game", "league", "card_name"]).doUpdateSet({
            is_disabled: sql`excluded.is_disabled`,
            from_boss: sql`excluded.from_boss`,
            weight: sql`excluded.weight`,
            updated_at: sql`datetime('now')`,
          }),
        )
        .execute();

      this.logger.log(
        `${game.toUpperCase()} ${league}: upserted ${
          cards.length
        } availability rows`,
      );
    }

    // ── Phase 2b: Derive prohibited_library_rarity from weight ───────
    // Write PL rarity into divination_card_rarities. The ON CONFLICT only
    // touches prohibited_library_rarity, leaving poe.ninja rarity and
    // user overrides intact.
    if (cards.length > 0) {
      await kysely
        .insertInto("divination_card_rarities")
        .values(
          cards.map((card) => ({
            game,
            league,
            card_name: card.name,
            rarity: 0,
            prohibited_library_rarity:
              card.weight != null && card.weight > 0
                ? weightToDropRarity(card.weight)
                : 0,
            last_updated: sql`datetime('now')`,
          })),
        )
        .onConflict((oc) =>
          oc.columns(["game", "league", "card_name"]).doUpdateSet({
            prohibited_library_rarity: sql`excluded.prohibited_library_rarity`,
            last_updated: sql`datetime('now')`,
          }),
        )
        .execute();

      this.logger.log(
        `${game.toUpperCase()} ${league}: wrote prohibited_library_rarity for ${
          cards.length
        } cards`,
      );
    }

    // ── Phase 3: Prune stale availability rows ───────────────────────
    // Only prune when a league-specific JSON was loaded. League-specific
    // files are authoritative for that league's card pool; the generic
    // cards.json contains all cards across all leagues so pruning
    // against it would be meaningless.
    if (isLeagueSpecific) {
      const syncedCardNames = cards.map((c) => c.name);
      const pruneResult = await kysely
        .deleteFrom("divination_card_availability")
        .where("game", "=", game)
        .where("league", "=", league)
        .where("card_name", "not in", syncedCardNames)
        .execute();

      const pruned = Number(pruneResult[0]?.numDeletedRows ?? 0);
      if (pruned > 0) {
        this.logger.log(
          `${game.toUpperCase()} ${league}: pruned ${pruned} stale availability rows`,
        );
      }
    }
  }

  /**
   * Setup IPC handlers
   */
  private setupIpcHandlers(): void {
    ipcMain.handle(
      DivinationCardsChannel.GetAll,
      async (
        _event,
        game: "poe1" | "poe2",
        onlyInPool?: boolean,
      ): Promise<DivinationCardDTO[] | { success: false; error: string }> => {
        try {
          assertGameType(game, DivinationCardsChannel.GetAll);
          const leagueKey =
            game === "poe1"
              ? SettingsKey.SelectedPoe1League
              : SettingsKey.SelectedPoe2League;
          const league = await this.settingsStore.get(leagueKey);
          const filterId = await this.getSelectedFilterId();

          return this.repository.getAllByGame(
            game,
            league || undefined,
            filterId,
            onlyInPool ?? false,
          );
        } catch (error) {
          return handleValidationError(error, DivinationCardsChannel.GetAll);
        }
      },
    );

    ipcMain.handle(
      DivinationCardsChannel.GetById,
      async (
        _event,
        id: string,
      ): Promise<
        DivinationCardDTO | null | { success: false; error: string }
      > => {
        try {
          assertBoundedString(id, "id", DivinationCardsChannel.GetById, 40);
          // Extract game from id (format: "poe1_card-name" or "poe2_card-name")
          const game = id.startsWith("poe1_") ? "poe1" : "poe2";
          const leagueKey =
            game === "poe1"
              ? SettingsKey.SelectedPoe1League
              : SettingsKey.SelectedPoe2League;
          const league = await this.settingsStore.get(leagueKey);
          const filterId = await this.getSelectedFilterId();

          return this.repository.getById(id, league || undefined, filterId);
        } catch (error) {
          return handleValidationError(error, DivinationCardsChannel.GetById);
        }
      },
    );

    ipcMain.handle(
      DivinationCardsChannel.GetByName,
      async (
        _event,
        game: "poe1" | "poe2",
        name: string,
      ): Promise<
        DivinationCardDTO | null | { success: false; error: string }
      > => {
        try {
          assertGameType(game, DivinationCardsChannel.GetByName);
          assertBoundedString(
            name,
            "name",
            DivinationCardsChannel.GetByName,
            40,
          );
          const leagueKey =
            game === "poe1"
              ? SettingsKey.SelectedPoe1League
              : SettingsKey.SelectedPoe2League;
          const league = await this.settingsStore.get(leagueKey);
          const filterId = await this.getSelectedFilterId();

          return this.repository.getByName(
            game,
            name,
            league || undefined,
            filterId,
          );
        } catch (error) {
          return handleValidationError(error, DivinationCardsChannel.GetByName);
        }
      },
    );

    ipcMain.handle(
      DivinationCardsChannel.SearchByName,
      async (
        _event,
        game: "poe1" | "poe2",
        query: string,
      ): Promise<
        DivinationCardSearchDTO | { success: false; error: string }
      > => {
        try {
          assertGameType(game, DivinationCardsChannel.SearchByName);
          assertBoundedString(
            query,
            "query",
            DivinationCardsChannel.SearchByName,
            40,
          );
          const leagueKey =
            game === "poe1"
              ? SettingsKey.SelectedPoe1League
              : SettingsKey.SelectedPoe2League;
          const league = await this.settingsStore.get(leagueKey);
          const filterId = await this.getSelectedFilterId();

          const cards = await this.repository.searchByName(
            game,
            query,
            league || undefined,
            filterId,
          );
          return {
            cards,
            total: cards.length,
          };
        } catch (error) {
          return handleValidationError(
            error,
            DivinationCardsChannel.SearchByName,
          );
        }
      },
    );

    ipcMain.handle(
      DivinationCardsChannel.GetCount,
      async (
        _event,
        game: "poe1" | "poe2",
      ): Promise<number | { success: false; error: string }> => {
        try {
          assertGameType(game, DivinationCardsChannel.GetCount);
          return this.repository.getCardCount(game);
        } catch (error) {
          return handleValidationError(error, DivinationCardsChannel.GetCount);
        }
      },
    );

    ipcMain.handle(
      DivinationCardsChannel.GetStats,
      async (
        _event,
        game: "poe1" | "poe2",
      ): Promise<
        DivinationCardStatsDTO | { success: false; error: string }
      > => {
        try {
          assertGameType(game, DivinationCardsChannel.GetStats);
          return {
            game,
            totalCards: await this.repository.getCardCount(game),
            lastUpdated: (await this.repository.getLastUpdated(game)) || "",
          };
        } catch (error) {
          return handleValidationError(error, DivinationCardsChannel.GetStats);
        }
      },
    );

    ipcMain.handle(
      DivinationCardsChannel.ForceSync,
      async (
        _event,
        game: "poe1" | "poe2",
      ): Promise<{ success: boolean } | { success: false; error: string }> => {
        try {
          assertGameType(game, DivinationCardsChannel.ForceSync);

          // Resolve league-aware JSON path
          let jsonPath: string;
          let league: string;
          let isLeagueSpecific: boolean;

          if (game === "poe1") {
            const selectedLeague = await this.settingsStore.get(
              SettingsKey.SelectedPoe1League,
            );
            league = selectedLeague || "Standard";
            jsonPath = resolvePoe1CardsJsonPath(
              league,
              app.isPackaged,
              process.resourcesPath,
            );
            isLeagueSpecific = jsonPath.includes(`cards-${league}.json`);
          } else {
            league = "Standard";
            jsonPath = this.poe2CardsJsonPath;
            isLeagueSpecific = false;
          }

          const cards = this.loadCardsFromJson(jsonPath);
          await this.syncCards(game, cards, league, isLeagueSpecific);
          return { success: true };
        } catch (error) {
          return handleValidationError(error, DivinationCardsChannel.ForceSync);
        }
      },
    );

    ipcMain.handle(
      DivinationCardsChannel.UpdateRarity,
      async (
        _event,
        game: "poe1" | "poe2",
        cardName: string,
        rarity: Rarity,
      ): Promise<{ success: boolean } | { success: false; error: string }> => {
        try {
          assertGameType(game, DivinationCardsChannel.UpdateRarity);
          assertCardName(cardName, DivinationCardsChannel.UpdateRarity);
          assertInteger(rarity, "rarity", DivinationCardsChannel.UpdateRarity, {
            min: 1,
            max: 4,
          });

          const leagueKey =
            game === "poe1"
              ? SettingsKey.SelectedPoe1League
              : SettingsKey.SelectedPoe2League;
          const league = await this.settingsStore.get(leagueKey);

          if (!league) {
            return { success: false, error: "No league selected" };
          }

          await this.repository.updateRarity(game, league, cardName, rarity);
          this.logger.log(
            `Updated rarity for "${cardName}" to ${rarity} (${game}/${league})`,
          );
          return { success: true };
        } catch (error) {
          return handleValidationError(
            error,
            DivinationCardsChannel.UpdateRarity,
          );
        }
      },
    );
  }

  /**
   * Update card rarities from a parsed loot filter.
   *
   * Reads the filter's card rarities from `filter_card_rarities` and writes
   * them into `divination_card_rarities` for the given game/league. Cards
   * not present in the filter default to rarity 4 (common).
   *
   * This is the filter-based counterpart to `updateRaritiesFromPrices()`.
   * Called by SnapshotService when rarity source is "filter".
   *
   * @param filterId - The ID of the selected, fully-parsed filter
   * @param game - The game type ("poe1" or "poe2")
   * @param league - The league name
   */
  public async updateRaritiesFromFilter(
    filterId: string,
    game: "poe1" | "poe2",
    league: string,
  ): Promise<void> {
    // Load filter card rarities
    const filterRarities =
      await this.rarityInsightsRepository.getCardRarities(filterId);

    // Build a lookup map: card name → rarity
    const filterRarityMap = new Map<string, number>();
    for (const entry of filterRarities) {
      filterRarityMap.set(entry.cardName, entry.rarity);
    }

    // Get all card names for this game
    const allCardNames = await this.repository.getAllCardNames(game);

    const updates: Array<{ name: string; rarity: Rarity }> = [];

    for (const cardName of allCardNames) {
      // If card is in the filter → use filter rarity
      // If card is NOT in the filter → default to rarity 4 (common)
      const rarity = (filterRarityMap.get(cardName) ?? 4) as Rarity;
      updates.push({ name: cardName, rarity });
    }

    if (updates.length > 0) {
      await this.repository.updateRarities(game, league, updates);
      this.logger.log(
        `Updated rarities from filter for ${
          updates.length
        } ${game.toUpperCase()}/${league} cards (${
          filterRarityMap.size
        } in filter, ${
          updates.length - filterRarityMap.size
        } defaulted to common)`,
      );
    }
  }

  /**
   * Update card rarities from price data
   * Called by Snapshot.service.ts whenever it fetches/loads a price snapshot
   *
   * This ensures card rarities are always in sync with the snapshot being used
   * for the current session.
   *
   * Confidence affects rarity assignment:
   * - 3 (low) confidence → rarity 0 (Unknown), regardless of price
   * - 2 (medium) or 1 (high) confidence → rarity 1-4 based on price
   * - Cards with no price data at all → rarity 0 (Unknown)
   *
   * When confidence improves from low to medium/high, any user override
   * (override_rarity) is cleared so the system-calculated rarity takes effect.
   */
  public async updateRaritiesFromPrices(
    game: "poe1" | "poe2",
    league: string,
    exchangeChaosToDivine: number,
    cardPrices: Record<string, { chaosValue: number; confidence?: Confidence }>,
  ): Promise<void> {
    // Coerce exchange rate to a number — Supabase PostgREST may return
    // NUMERIC columns as strings to preserve precision.
    const exchangeRate = Number(exchangeChaosToDivine);

    this.logger.log(
      `updateRaritiesFromPrices called: game=${game}, league="${league}", ` +
        `exchangeChaosToDivine=${exchangeChaosToDivine} (type=${typeof exchangeChaosToDivine}), ` +
        `coerced exchangeRate=${exchangeRate}, pricedCards=${
          Object.keys(cardPrices).length
        }`,
    );

    if (!league) {
      this.logger.warn(
        "updateRaritiesFromPrices called with empty league — rarities will not be queryable",
      );
    }

    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      this.logger.error(
        `Invalid exchangeChaosToDivine: ${exchangeChaosToDivine} — skipping rarity update`,
      );
      return;
    }

    // ── Auto-create stub rows for new cards from the snapshot ───────────
    // poe.ninja may contain cards not yet in the bundled cards.json.
    // Insert minimal stub rows so they become discoverable immediately.
    // Pass the league so stub availability rows are also created (M8).
    await this.ensureCardsFromSnapshot(game, Object.keys(cardPrices), league);

    const updates: Array<{
      name: string;
      rarity: Rarity;
      clearOverride: boolean;
    }> = [];

    // Get all cards for this game (now includes any newly-inserted stubs)
    // Use lightweight name-only query instead of full DTO fetch with JOINs.
    const allCardNames = await this.repository.getAllCardNames(game);
    const pricedCardNames = new Set(Object.keys(cardPrices));

    // Update rarity for cards with prices
    for (const [cardName, priceData] of Object.entries(cardPrices)) {
      const confidence = priceData.confidence ?? 1;

      // Low confidence (3) → rarity 0 (Unknown), keep any existing user override
      if (confidence === 3) {
        this.logger.debug(
          `  "${cardName}" confidence=3 (low) → rarity 0 (Unknown)`,
        );
        updates.push({ name: cardName, rarity: 0, clearOverride: false });
        continue;
      }

      // Medium/high confidence → calculate rarity from price
      // Coerce chaosValue to number — PostgREST may return NUMERIC as string
      const chaosValue = Number(priceData.chaosValue);
      const divineValue = chaosValue / exchangeRate;
      const percentOfDivine = divineValue * 100; // Convert to percentage

      let rarity: Rarity;

      if (percentOfDivine >= 70) {
        // 70%+ of divine = extremely rare
        rarity = 1;
      } else if (percentOfDivine >= 35) {
        // 35-70% of divine = rare
        rarity = 2;
      } else if (percentOfDivine >= 5) {
        // 5-35% of divine = less common
        rarity = 3;
      } else {
        // < 5% of divine = common
        rarity = 4;
      }

      this.logger.debug(
        `  "${cardName}" chaos=${chaosValue} (raw type=${typeof priceData.chaosValue}) ` +
          `divine=${divineValue.toFixed(4)} pct=${percentOfDivine.toFixed(
            1,
          )}% confidence=${confidence} → rarity ${rarity}`,
      );

      // Confidence is 1 (high) or 2 (medium) → clear any previous user override
      // (the system now has reliable data for this card)
      updates.push({ name: cardName, rarity, clearOverride: true });
    }

    // Set all cards WITHOUT prices to rarity 0 (Unknown) — no data available
    for (const name of allCardNames) {
      if (!pricedCardNames.has(name)) {
        updates.push({ name, rarity: 0, clearOverride: false });
      }
    }

    // Log rarity distribution
    const distribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const u of updates) {
      distribution[u.rarity]++;
    }

    if (updates.length > 0) {
      await this.repository.updateRarities(game, league, updates);
      this.logger.log(
        `Updated rarities for ${
          updates.length
        } ${game.toUpperCase()}/${league} cards ` +
          `(${pricedCardNames.size} priced, ${
            updates.length - pricedCardNames.size
          } unpriced). ` +
          `Distribution: r0=${distribution[0]} r1=${distribution[1]} r2=${distribution[2]} r3=${distribution[3]} r4=${distribution[4]}`,
      );
    }
  }
  // ─── Helpers ───────────────────────────────────────────────────────────

  /**
   * Get the currently selected filter ID from settings.
   * Returns the filter ID if rarity source is "filter" and a filter is selected,
   * otherwise returns null.
   */
  public async getSelectedFilterId(): Promise<string | null> {
    try {
      const raritySource = await this.settingsStore.get(
        SettingsKey.RaritySource,
      );
      if (raritySource !== "filter") {
        return null;
      }

      const filterId = await this.settingsStore.get(
        SettingsKey.SelectedFilterId,
      );
      return filterId || null;
    } catch {
      return null;
    }
  }

  /**
   * Get the repository instance (for testing or advanced usage)
   */
  public getRepository(): DivinationCardsRepository {
    return this.repository;
  }

  /**
   * Ensure every card name from a poe.ninja snapshot exists in `divination_cards`.
   *
   * New cards that appear mid-league (e.g. "The Slumbering Beast" in Keepers)
   * won't be in the bundled `cards.json` until an app update ships. This method
   * detects card names present in the snapshot but missing from the database
   * and inserts minimal stub rows so they become discoverable via
   * `getAllByGame()` and `resolveCardBySlug()` immediately.
   *
   * Stub rows have:
   *  - `stack_size = 1` (unknown until cards.json is updated)
   *  - Empty `description`, `reward_html`, `art_src`, `flavour_html`
   *  - A `data_hash` derived from the stub fields (so `syncCards()` will
   *    detect a change and overwrite the stub once `cards.json` contains
   *    the full card metadata)
   *
   * Uses `INSERT OR IGNORE` under the hood so existing cards are never
   * overwritten — this is purely additive.
   *
   * @param game  - The game type ("poe1" or "poe2")
   * @param snapshotCardNames - All card names present in the snapshot
   * @param league - Optional league name; when provided, stub availability
   *   rows are also inserted so the new cards appear in the league pool.
   */
  public async ensureCardsFromSnapshot(
    game: "poe1" | "poe2",
    snapshotCardNames: string[],
    league?: string,
  ): Promise<void> {
    if (snapshotCardNames.length === 0) return;

    // Get the set of card names already in the database
    const existingNames = new Set(await this.repository.getAllCardNames(game));

    // Find card names in the snapshot that are NOT in the database
    const missingNames = snapshotCardNames.filter(
      (name) => !existingNames.has(name),
    );

    if (missingNames.length === 0) return;

    // Insert stub rows for the missing cards
    const inserted = await this.repository.insertStubCards(
      game,
      missingNames,
      (name) =>
        this.hashCard({
          name,
          stack_size: 1,
          description: "",
          reward_html: "",
          art_src: "",
          flavour_html: "",
        }),
    );

    if (inserted > 0) {
      this.logger.log(
        `Auto-created ${inserted} stub card(s) from poe.ninja snapshot for ${game.toUpperCase()}: ${missingNames.join(
          ", ",
        )}`,
      );
    }

    // ── Insert stub availability rows for the active league ────────────
    // After inserting stub divination_cards rows, also add availability
    // for the current league so the card appears in the league pool.
    // Uses doNothing() on conflict — if the row already exists (e.g. from
    // a later syncCards() run after a package update), don't overwrite it.
    if (missingNames.length > 0 && league) {
      const kysely = this.kysely;
      if (kysely) {
        await kysely
          .insertInto("divination_card_availability")
          .values(
            missingNames.map((name) => ({
              game,
              league,
              card_name: name,
              from_boss: 0,
              is_disabled: 0,
              weight: null,
              updated_at: sql`datetime('now')`,
            })),
          )
          .onConflict((oc) =>
            oc.columns(["game", "league", "card_name"]).doNothing(),
          )
          .execute();

        this.logger.log(
          `Inserted stub availability rows for ${
            missingNames.length
          } card(s) in ${game.toUpperCase()}/${league}`,
        );
      }
    }
  }
}

export { DivinationCardsService };
