import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { app, ipcMain } from "electron";
import { DatabaseService } from "../database";
import { DivinationCardsChannel } from "./DivinationCards.channels";
import { DivinationCardsRepository } from "./DivinationCards.repository";
import type {
  DivinationCardDTO,
  DivinationCardSearchDTO,
  DivinationCardStatsDTO,
} from "./DivinationCards.dto";

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
  private poe1CardsJsonPath: string;
  private poe2CardsJsonPath: string;

  static getInstance(): DivinationCardsService {
    if (!DivinationCardsService._instance) {
      DivinationCardsService._instance = new DivinationCardsService();
    }
    return DivinationCardsService._instance;
  }

  private constructor() {
    const database = DatabaseService.getInstance();
    this.repository = new DivinationCardsRepository(database.getKysely());

    // Determine paths based on whether app is packaged
    const basePath = app.isPackaged ? process.resourcesPath : app.getAppPath();

    this.poe1CardsJsonPath = join(basePath, "cards.json");
    this.poe2CardsJsonPath = join(basePath, "cards-poe2.json"); // For future use

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
        `[DivinationCards] Initialized ${game.toUpperCase()} with ${cards.length} cards`,
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
      async (_event, game: "poe1" | "poe2"): Promise<DivinationCardDTO[]> => {
        return this.repository.getAllByGame(game);
      },
    );

    ipcMain.handle(
      DivinationCardsChannel.GetById,
      async (_event, id: string): Promise<DivinationCardDTO | null> => {
        return this.repository.getById(id);
      },
    );

    ipcMain.handle(
      DivinationCardsChannel.GetByName,
      async (
        _event,
        game: "poe1" | "poe2",
        name: string,
      ): Promise<DivinationCardDTO | null> => {
        return this.repository.getByName(game, name);
      },
    );

    ipcMain.handle(
      DivinationCardsChannel.SearchByName,
      async (
        _event,
        game: "poe1" | "poe2",
        query: string,
      ): Promise<DivinationCardSearchDTO> => {
        const cards = await this.repository.searchByName(game, query);
        return {
          cards,
          total: cards.length,
        };
      },
    );

    ipcMain.handle(
      DivinationCardsChannel.GetCount,
      async (_event, game: "poe1" | "poe2"): Promise<number> => {
        return this.repository.getCardCount(game);
      },
    );

    ipcMain.handle(
      DivinationCardsChannel.GetStats,
      async (
        _event,
        game: "poe1" | "poe2",
      ): Promise<DivinationCardStatsDTO> => {
        return {
          game,
          totalCards: await this.repository.getCardCount(game),
          lastUpdated: (await this.repository.getLastUpdated(game)) || "",
        };
      },
    );

    ipcMain.handle(
      DivinationCardsChannel.ForceSync,
      async (_event, game: "poe1" | "poe2"): Promise<{ success: boolean }> => {
        const jsonPath =
          game === "poe1" ? this.poe1CardsJsonPath : this.poe2CardsJsonPath;
        const cards = this.loadCardsFromJson(jsonPath);
        await this.syncCards(game, cards);
        return { success: true };
      },
    );
  }
}

export { DivinationCardsService };
