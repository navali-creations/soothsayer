import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { app, ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { FilterRepository } from "~/main/modules/filters/Filter.repository";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import {
  assertBoundedString,
  assertCardName,
  assertGameType,
  assertInteger,
  handleValidationError,
} from "~/main/utils/ipc-validation";
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
}

/**
 * Service for managing divination cards static data
 * Populates and maintains the divination_cards table from JSON files
 */
class DivinationCardsService {
  private static _instance: DivinationCardsService;
  private repository: DivinationCardsRepository;
  private filterRepository: FilterRepository;
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
    this.repository = new DivinationCardsRepository(database.getKysely());
    this.filterRepository = new FilterRepository(database.getKysely());
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
      const basePath = app.getAppPath();
      this.poe1CardsJsonPath = join(
        basePath,
        "renderer",
        "assets",
        "poe1",
        "cards.json",
      );
      this.poe2CardsJsonPath = join(
        basePath,
        "renderer",
        "assets",
        "poe2",
        "cards.json",
      );
    }

    this.setupIpcHandlers();

    console.log(
      `[DivinationCards] Service initialized (packaged: ${app.isPackaged})`,
    );
    console.log(`[DivinationCards] PoE1 cards path: ${this.poe1CardsJsonPath}`);
    console.log(`[DivinationCards] PoE2 cards path: ${this.poe2CardsJsonPath}`);
  }

  /**
   * Initialize divination cards data from JSON files
   * Called during app startup
   */
  public async initialize(): Promise<void> {
    try {
      // Initialize PoE1 cards
      await this.initializeGameCards("poe1", this.poe1CardsJsonPath);

      // Initialize PoE2 cards (when available)
      // await this.initializeGameCards("poe2", this.poe2CardsJsonPath);

      console.log("[DivinationCards] Successfully initialized all cards");

      // Note: Rarities are now updated by Snapshot.service.ts when it fetches price data
      // This avoids duplicate API calls and ensures consistency with snapshot data
    } catch (error) {
      console.error("[DivinationCards] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * Initialize cards for a specific game
   */
  private async initializeGameCards(
    game: "poe1" | "poe2",
    jsonPath: string,
  ): Promise<void> {
    try {
      const cards = this.loadCardsFromJson(jsonPath);
      await this.syncCards(game, cards);
      console.log(
        `[DivinationCards] Initialized ${game.toUpperCase()} with ${
          cards.length
        } cards`,
      );
    } catch (error) {
      // If file doesn't exist (like poe2 cards), just log and continue
      if ((error as any)?.code === "ENOENT") {
        console.log(
          `[DivinationCards] ${game.toUpperCase()} cards file not found, skipping`,
        );
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
    return JSON.parse(jsonContent) as DivinationCardJson[];
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
  ): Promise<void> {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const card of cards) {
      const cardHash = this.hashCard(card);
      const existingHash = await this.repository.getCardHash(game, card.name);

      if (!existingHash) {
        // Insert new card
        await this.repository.insertCard(
          game,
          card.name,
          card.stack_size,
          card.description,
          card.reward_html,
          card.art_src,
          card.flavour_html || "",
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
          card.reward_html,
          card.art_src,
          card.flavour_html || "",
          cardHash,
        );
        updated++;
      } else {
        unchanged++;
      }
    }

    console.log(
      `[DivinationCards] ${game.toUpperCase()} sync: ${inserted} inserted, ${updated} updated, ${unchanged} unchanged`,
    );
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
          const jsonPath =
            game === "poe1" ? this.poe1CardsJsonPath : this.poe2CardsJsonPath;
          const cards = this.loadCardsFromJson(jsonPath);
          await this.syncCards(game, cards);
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
          console.log(
            `[DivinationCards] Updated rarity for "${cardName}" to ${rarity} (${game}/${league})`,
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
      await this.filterRepository.getCardRarities(filterId);

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
      console.log(
        `[DivinationCards] Updated rarities from filter for ${
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

    console.log(
      `[DivinationCards] updateRaritiesFromPrices called: game=${game}, league="${league}", ` +
        `exchangeChaosToDivine=${exchangeChaosToDivine} (type=${typeof exchangeChaosToDivine}), ` +
        `coerced exchangeRate=${exchangeRate}, pricedCards=${
          Object.keys(cardPrices).length
        }`,
    );

    if (!league) {
      console.warn(
        "[DivinationCards] updateRaritiesFromPrices called with empty league — rarities will not be queryable",
      );
    }

    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      console.error(
        `[DivinationCards] Invalid exchangeChaosToDivine: ${exchangeChaosToDivine} — skipping rarity update`,
      );
      return;
    }

    const updates: Array<{
      name: string;
      rarity: Rarity;
      clearOverride: boolean;
    }> = [];

    // Get all cards for this game
    const allCards = await this.repository.getAllByGame(game);
    const pricedCardNames = new Set(Object.keys(cardPrices));

    // Update rarity for cards with prices
    for (const [cardName, priceData] of Object.entries(cardPrices)) {
      const confidence = priceData.confidence ?? 1;

      // Low confidence (3) → rarity 0 (Unknown), keep any existing user override
      if (confidence === 3) {
        console.log(
          `[DivinationCards]   "${cardName}" confidence=3 (low) → rarity 0 (Unknown)`,
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

      console.log(
        `[DivinationCards]   "${cardName}" chaos=${chaosValue} (raw type=${typeof priceData.chaosValue}) ` +
          `divine=${divineValue.toFixed(4)} pct=${percentOfDivine.toFixed(
            1,
          )}% confidence=${confidence} → rarity ${rarity}`,
      );

      // Confidence is 1 (high) or 2 (medium) → clear any previous user override
      // (the system now has reliable data for this card)
      updates.push({ name: cardName, rarity, clearOverride: true });
    }

    // Set all cards WITHOUT prices to rarity 0 (Unknown) — no data available
    for (const card of allCards) {
      if (!pricedCardNames.has(card.name)) {
        updates.push({ name: card.name, rarity: 0, clearOverride: false });
      }
    }

    // Log rarity distribution
    const distribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const u of updates) {
      distribution[u.rarity]++;
    }

    if (updates.length > 0) {
      await this.repository.updateRarities(game, league, updates);
      console.log(
        `[DivinationCards] Updated rarities for ${
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
}

export { DivinationCardsService };
