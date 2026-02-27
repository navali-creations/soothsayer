import { ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { LoggerService } from "~/main/modules/logger";
import { ProhibitedLibraryService } from "~/main/modules/prohibited-library";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import {
  assertBoundedString,
  assertGameType,
  handleValidationError,
} from "~/main/utils/ipc-validation";

import { ProfitForecastChannel } from "./ProfitForecast.channels";
import type {
  ProfitForecastCardPriceDTO,
  ProfitForecastDataDTO,
  ProfitForecastSnapshotDTO,
  ProfitForecastWeightDTO,
} from "./ProfitForecast.dto";

/**
 * Main-process service for the Profit Forecast feature.
 *
 * Serves a single IPC channel (`profit-forecast:get-data`) that returns:
 * 1. The most recent snapshot for the requested league (no time restriction)
 * 2. Prohibited Library card weights (weight > 0 only)
 *
 * All cost-model and batch calculations happen renderer-side — this service
 * is purely a data provider.
 */
export class ProfitForecastService {
  private static _instance: ProfitForecastService;
  private readonly logger = LoggerService.createLogger("ProfitForecast");
  private readonly kysely;
  private readonly settingsStore: SettingsStoreService;

  static getInstance(): ProfitForecastService {
    if (!ProfitForecastService._instance) {
      ProfitForecastService._instance = new ProfitForecastService();
    }
    return ProfitForecastService._instance;
  }

  private constructor() {
    const db = DatabaseService.getInstance();
    this.kysely = db.getKysely();
    this.settingsStore = SettingsStoreService.getInstance();

    this.setupIpcHandlers();

    this.logger.log("Service initialized");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IPC Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  private setupIpcHandlers(): void {
    ipcMain.handle(
      ProfitForecastChannel.GetData,
      async (
        _event,
        game: unknown,
        league: unknown,
      ): Promise<ProfitForecastDataDTO | { success: false; error: string }> => {
        try {
          assertGameType(game, ProfitForecastChannel.GetData);
          assertBoundedString(league, "league", ProfitForecastChannel.GetData);

          return await this.getData(game, league);
        } catch (error) {
          return handleValidationError(error, ProfitForecastChannel.GetData);
        }
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Core Logic
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch the combined profit forecast payload for a given game and league.
   *
   * 1. Look up the league ID (read-only — returns null if league doesn't exist)
   * 2. Query the most recent snapshot for that league (no time restriction)
   * 3. If snapshot found, merge exchange + stash card prices (exchange preferred)
   * 4. Query PL card weights (weight > 0) via ProhibitedLibraryService
   * 5. Return combined DTO
   */
  async getData(
    game: "poe1" | "poe2",
    league: string,
  ): Promise<ProfitForecastDataDTO> {
    // Fetch weights first — we always return these even without a snapshot
    const weights = await this.getWeights(game);

    // Look up league (read-only, no creation)
    const leagueRow = await this.kysely
      .selectFrom("leagues")
      .selectAll()
      .where("game", "=", game)
      .where("name", "=", league)
      .executeTakeFirst();

    if (!leagueRow) {
      this.logger.log(
        `No league found for game=${game}, league=${league} — returning null snapshot`,
      );
      return { snapshot: null, weights };
    }

    // Query the most recent snapshot — no time restriction
    const snapshotRow = await this.kysely
      .selectFrom("snapshots")
      .selectAll()
      .where("league_id", "=", leagueRow.id)
      .orderBy("fetched_at", "desc")
      .limit(1)
      .executeTakeFirst();

    if (!snapshotRow) {
      this.logger.log(
        `No snapshot found for league=${league} (id=${leagueRow.id}) — returning null snapshot`,
      );
      return { snapshot: null, weights };
    }

    // Query card prices for this snapshot
    const priceRows = await this.kysely
      .selectFrom("snapshot_card_prices")
      .selectAll()
      .where("snapshot_id", "=", snapshotRow.id)
      .execute();

    // Merge exchange + stash prices (exchange preferred, stash fills gaps)
    const cardPrices: Record<string, ProfitForecastCardPriceDTO> = {};

    // First pass: exchange prices
    for (const row of priceRows) {
      if (row.price_source === "exchange") {
        cardPrices[row.card_name] = {
          chaosValue: row.chaos_value,
          divineValue: row.divine_value,
          source: "exchange",
        };
      }
    }

    // Second pass: stash prices fill gaps
    for (const row of priceRows) {
      if (row.price_source === "stash" && !(row.card_name in cardPrices)) {
        cardPrices[row.card_name] = {
          chaosValue: row.chaos_value,
          divineValue: row.divine_value,
          source: "stash",
        };
      }
    }

    const snapshot: ProfitForecastSnapshotDTO = {
      id: snapshotRow.id,
      fetchedAt: snapshotRow.fetched_at,
      chaosToDivineRatio: snapshotRow.exchange_chaos_to_divine,
      stackedDeckChaosCost: snapshotRow.stacked_deck_chaos_cost,
      cardPrices,
    };

    this.logger.log(
      `Returning snapshot id=${snapshotRow.id} with ${
        Object.keys(cardPrices).length
      } card prices and ${weights.length} PL weights`,
    );

    return { snapshot, weights };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get PL card weights (weight > 0) for the given game.
   *
   * Delegates to ProhibitedLibraryService's repository which handles
   * the actual database queries. We replicate the same league resolution
   * logic used by the PL service's IPC handler: try active league first,
   * then fall back to the metadata league (n-1 fallback).
   */
  private async getWeights(
    game: "poe1" | "poe2",
  ): Promise<ProfitForecastWeightDTO[]> {
    try {
      const plService = ProhibitedLibraryService.getInstance();
      const repository = plService.getRepository();

      // Use the same league resolution logic as the PL service:
      // try active league first, then fall back to metadata league
      const leagueKey =
        game === "poe1"
          ? SettingsKey.SelectedPoe1League
          : SettingsKey.SelectedPoe2League;
      const activeLeague = await this.settingsStore.get(leagueKey);

      let allWeights = await repository.getCardWeights(game, activeLeague);

      // Fallback to metadata league if active league has no data
      if (allWeights.length === 0) {
        const metadata = await repository.getMetadata(game);
        if (metadata && metadata.league !== activeLeague) {
          allWeights = await repository.getCardWeights(game, metadata.league);
        }
      }

      // Filter to weight > 0 and map to our DTO shape
      return allWeights
        .filter((w) => w.weight > 0)
        .map((w) => ({
          cardName: w.cardName,
          weight: w.weight,
          fromBoss: w.fromBoss,
        }));
    } catch (error) {
      this.logger.error(`Failed to load PL weights for game=${game}:`, error);
      return [];
    }
  }
}
