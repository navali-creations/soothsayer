import { ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { LoggerService } from "~/main/modules/logger";
import { ProhibitedLibraryService } from "~/main/modules/prohibited-library";
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
 * 2. Prohibited Library card weights (weight > 0, excluding boss-only cards)
 *
 * All cost-model and batch calculations happen renderer-side — this service
 * is purely a data provider.
 */
export class ProfitForecastService {
  private static _instance: ProfitForecastService;
  private readonly logger = LoggerService.createLogger("ProfitForecast");
  private readonly kysely;

  static getInstance(): ProfitForecastService {
    if (!ProfitForecastService._instance) {
      ProfitForecastService._instance = new ProfitForecastService();
    }
    return ProfitForecastService._instance;
  }

  private constructor() {
    const db = DatabaseService.getInstance();
    this.kysely = db.getKysely();

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
          confidence: (row.confidence ?? 1) as 1 | 2 | 3,
          isAnomalous: false,
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
          confidence: (row.confidence ?? 1) as 1 | 2 | 3,
          isAnomalous: false,
        };
      }
    }

    // Detect anomalous prices among common cards
    this.detectAnomalousCardPrices(cardPrices, weights);

    const snapshot: ProfitForecastSnapshotDTO = {
      id: snapshotRow.id,
      fetchedAt: snapshotRow.fetched_at,
      chaosToDivineRatio: snapshotRow.exchange_chaos_to_divine,
      stackedDeckChaosCost: snapshotRow.stacked_deck_chaos_cost,
      stackedDeckMaxVolumeRate:
        snapshotRow.stacked_deck_max_volume_rate ?? null,
      cardPrices,
    };

    const anomalousCount = Object.values(cardPrices).filter(
      (p) => p.isAnomalous,
    ).length;

    this.logger.log(
      `Returning snapshot id=${snapshotRow.id} with ${
        Object.keys(cardPrices).length
      } card prices (${anomalousCount} anomalous) and ${
        weights.length
      } PL weights`,
    );

    return { snapshot, weights };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Detect anomalous prices among common cards and set `isAnomalous` on the
   * affected entries in-place.
   *
   * Late in a league, low-value common cards can have wildly inflated prices
   * on poe.ninja because nobody lists them and a single absurd listing
   * becomes the "price". Since these cards are very common (high weight),
   * even a small inflated price gets multiplied by high probability and
   * significantly skews the total EV upward.
   *
   * Strategy:
   * 1. Join prices with weights — only consider priced, non-low-confidence cards.
   * 2. Split into "common" (weight ≥ median) and "rare" (weight < median).
   * 3. Compute a robust baseline from the **lower half** of common card prices
   *    so that outliers cannot pollute the reference statistics.
   * 4. Flag common cards whose price exceeds the baseline-derived threshold.
   */
  private detectAnomalousCardPrices(
    cardPrices: Record<string, ProfitForecastCardPriceDTO>,
    weights: ProfitForecastWeightDTO[],
  ): void {
    // Build a weight lookup for cards that have both a price and a weight
    const weightByName = new Map<string, number>();
    for (const w of weights) {
      weightByName.set(w.cardName, w.weight);
    }

    // Collect cards that have a price, a weight, and are not low-confidence
    const candidates: {
      cardName: string;
      weight: number;
      chaosValue: number;
    }[] = [];
    for (const [cardName, price] of Object.entries(cardPrices)) {
      const weight = weightByName.get(cardName);
      if (weight != null && weight > 0 && price.confidence !== 3) {
        candidates.push({ cardName, weight, chaosValue: price.chaosValue });
      }
    }

    if (candidates.length < 5) return; // too few cards to detect outliers

    // Find median weight to split "common" vs "rare"
    const sortedByWeight = [...candidates].sort((a, b) => b.weight - a.weight);
    const medianWeight =
      sortedByWeight[Math.floor(sortedByWeight.length / 2)].weight;

    // Common cards: weight >= median weight (top half by frequency)
    const commonCards = candidates.filter((c) => c.weight >= medianWeight);
    if (commonCards.length < 3) return; // too few to compare

    // Get sorted chaos values of common cards
    const commonPrices = commonCards
      .map((c) => c.chaosValue)
      .filter((v) => v > 0)
      .sort((a, b) => a - b);

    if (commonPrices.length < 3) return;

    // Use the LOWER HALF of common card prices as a robust baseline.
    // This prevents outliers from polluting the IQR when multiple cards
    // are inflated simultaneously.
    const midpoint = Math.ceil(commonPrices.length / 2);
    const lowerHalf = commonPrices.slice(0, midpoint);

    const lowerQ1 = lowerHalf[Math.floor(lowerHalf.length * 0.25)];
    const lowerQ3 = lowerHalf[Math.floor(lowerHalf.length * 0.75)];
    const lowerIqr = lowerQ3 - lowerQ1;

    const lowerMedian = lowerHalf[Math.floor(lowerHalf.length / 2)];

    // Threshold: based on the lower-half Q3 + 3×IQR.
    // If the lower half is very tight (IQR ≈ 0), fall back to 5× the
    // lower-half median — common cards should be cheap, so even 5× the
    // typical price is generous.
    const threshold =
      lowerIqr > 0
        ? lowerQ3 + 3 * lowerIqr
        : Math.max(lowerMedian * 5, lowerMedian + 1);

    for (const card of commonCards) {
      if (card.chaosValue > threshold) {
        cardPrices[card.cardName].isAnomalous = true;
      }
    }
  }

  /**
   * Get PL card weights for the given game.
   *
   * Delegates to `plService.ensureLoaded()` which lazily parses the
   * bundled CSV on first access, then queries the metadata league
   * (the league the CSV data was stored under — e.g. "Keepers").
   *
   * The user's active league setting is irrelevant here — the weights
   * are model-estimated values that apply cross-league.
   */
  private async getWeights(
    game: "poe1" | "poe2",
  ): Promise<ProfitForecastWeightDTO[]> {
    try {
      const plService = ProhibitedLibraryService.getInstance();
      const repository = plService.getRepository();

      // Lazy-load if needed (no-op when data already exists)
      await plService.ensureLoaded(game);

      const metadata = await repository.getMetadata(game);
      if (!metadata) {
        this.logger.warn(`[${game}] No PL metadata after ensureLoaded`);
        return [];
      }

      const allWeights = await repository.getCardWeights(game, metadata.league);

      // Exclude boss-only cards (they don't drop from stacked decks)
      const nonBoss = allWeights.filter((w) => !w.fromBoss);

      // Find the minimum observed non-zero weight in the dataset.
      // Cards with weight 0 weren't seen in this league's sample but CAN
      // still drop from stacked decks — they're ultra-rare, not impossible.
      // We assign them the floor weight so they appear in the forecast with
      // the rarest-possible probability.
      const minWeight = nonBoss.reduce(
        (min, w) => (w.weight > 0 && w.weight < min ? w.weight : min),
        Number.MAX_SAFE_INTEGER,
      );
      const floorWeight = minWeight === Number.MAX_SAFE_INTEGER ? 1 : minWeight;

      return nonBoss.map((w) => ({
        cardName: w.cardName,
        weight: w.weight > 0 ? w.weight : floorWeight,
        fromBoss: false,
      }));
    } catch (error) {
      this.logger.error(`Failed to load PL weights for game=${game}:`, error);
      return [];
    }
  }
}
