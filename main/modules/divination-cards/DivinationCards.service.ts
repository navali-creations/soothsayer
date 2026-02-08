import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { app, ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import {
  assertBoundedString,
  assertGameType,
  handleValidationError,
} from "~/main/utils/ipc-validation";

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
    this.settingsStore = SettingsStoreService.getInstance();

    // Determine paths based on whether app is packaged
    const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();

    this.poe1CardsJsonPath = join(basePath, "renderer/assets/poe1/cards.json");
    this.poe2CardsJsonPath = join(basePath, "renderer/assets/poe2/cards.json"); // For future use

    this.setupIpcHandlers();

    console.log("[DivinationCards] Service initialized");
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

          return this.repository.getAllByGame(game, league || undefined);
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
          assertBoundedString(id, "id", DivinationCardsChannel.GetById, 512);
          // Extract game from id (format: "poe1_card-name" or "poe2_card-name")
          const game = id.startsWith("poe1_") ? "poe1" : "poe2";
          const leagueKey =
            game === "poe1"
              ? SettingsKey.SelectedPoe1League
              : SettingsKey.SelectedPoe2League;
          const league = await this.settingsStore.get(leagueKey);

          return this.repository.getById(id, league || undefined);
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
            256,
          );
          const leagueKey =
            game === "poe1"
              ? SettingsKey.SelectedPoe1League
              : SettingsKey.SelectedPoe2League;
          const league = await this.settingsStore.get(leagueKey);

          return this.repository.getByName(game, name, league || undefined);
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
            256,
          );
          const leagueKey =
            game === "poe1"
              ? SettingsKey.SelectedPoe1League
              : SettingsKey.SelectedPoe2League;
          const league = await this.settingsStore.get(leagueKey);

          const cards = await this.repository.searchByName(
            game,
            query,
            league || undefined,
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
  }

  /**
   * Update card rarities from price data
   * Called by Snapshot.service.ts whenever it fetches/loads a price snapshot
   *
   * This ensures card rarities are always in sync with the snapshot being used
   * for the current session.
   */
  public async updateRaritiesFromPrices(
    game: "poe1" | "poe2",
    league: string,
    exchangeChaosToDivine: number,
    cardPrices: Record<string, { chaosValue: number }>,
  ): Promise<void> {
    const updates: Array<{ name: string; rarity: number }> = [];

    // Get all cards for this game
    const allCards = await this.repository.getAllByGame(game);
    const pricedCardNames = new Set(Object.keys(cardPrices));

    // Update rarity for cards with prices
    for (const [cardName, priceData] of Object.entries(cardPrices)) {
      const chaosValue = priceData.chaosValue;
      const divineValue = chaosValue / exchangeChaosToDivine;
      const percentOfDivine = divineValue * 100; // Convert to percentage

      let rarity: number;

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

      updates.push({ name: cardName, rarity });
    }

    // Set all cards WITHOUT prices to rarity 4 (common)
    for (const card of allCards) {
      if (!pricedCardNames.has(card.name)) {
        updates.push({ name: card.name, rarity: 4 });
      }
    }

    if (updates.length > 0) {
      await this.repository.updateRarities(game, league, updates);
      console.log(
        `[DivinationCards] Updated rarities for ${
          updates.length
        } ${game.toUpperCase()}/${league} cards (${
          pricedCardNames.size
        } priced, ${updates.length - pricedCardNames.size} unpriced)`,
      );
    }
  }
}

export { DivinationCardsService };
