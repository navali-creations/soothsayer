import { ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { LoggerService } from "~/main/modules/logger";
import { ProhibitedLibraryService } from "~/main/modules/prohibited-library";
import {
  assertArray,
  assertBoundedString,
  assertGameType,
  assertInteger,
  assertNumber,
  assertOptionalNumber,
  handleValidationError,
  IpcValidationError,
} from "~/main/utils/ipc-validation";

import { ProfitForecastChannel } from "./ProfitForecast.channels";
import { computeAll } from "./ProfitForecast.compute";
import type {
  BaseRateSource,
  ProfitForecastCardPriceDTO,
  ProfitForecastComputeRequest,
  ProfitForecastComputeResponse,
  ProfitForecastDataDTO,
  ProfitForecastRowDTO,
  ProfitForecastSnapshotDTO,
  ProfitForecastWeightDTO,
} from "./ProfitForecast.dto";

/** Minimum base rate (decks per divine) — floors the computed value. */
const RATE_FLOOR = 20;

/**
 * Minimum per-card probability floor.
 *
 * The Prohibited Library weights are estimated from a finite sample. For
 * ultra-rare cards (House of Mirrors, The Apothecary, etc.) the sample
 * is too small to produce accurate weights — many get weight 0 or single-
 * digit values out of a ~1.5 M total, yielding probabilities like 6e-7.
 *
 * Empirical stacked-deck data (5 k / 10 k / 25 k sessions) shows that
 * even the rarest cards drop at roughly 1-in-10 k to 1-in-50 k, not
 * 1-in-1.5 M.  A floor of 1/50 000 = 2 e-5 is conservative while still
 * being dramatically closer to reality than the raw weight ratio.
 *
 * After flooring, all probabilities are renormalized so they sum to 1.
 */
const PROBABILITY_FLOOR = 1 / 50_000;

/**
 * Empirical EV calibration factor.
 *
 * Prohibited Library weights are derived from a finite community sample that
 * systematically underestimates the drop probability of mid-to-high value
 * cards.  Across many empirical stacked-deck sessions (5k / 10k / 25k runs),
 * the actual returns are consistently ~25 % higher than the raw PL-weighted
 * model predicts.
 *
 * Rather than trying to correct individual card probabilities (which would
 * require per-card calibration data we don't have), we apply a single scalar
 * multiplier to every card's EV contribution.  This is analogous to a "beta"
 * adjustment in financial models: we know the systematic bias direction and
 * approximate magnitude, so we correct for it.
 *
 * The factor was estimated by comparing model-predicted EV against observed
 * session P&L across multiple league snapshots.  It should be revisited if
 * the PL dataset methodology changes or if a Bayesian smoothing layer is
 * added later.
 */
const EV_CALIBRATION_FACTOR = 1.25;

/**
 * Main-process service for the Profit Forecast feature.
 *
 * Serves a single IPC channel (`profit-forecast:get-data`) that returns
 * pre-computed forecast rows, EV per deck, and base rate so the renderer
 * only needs to handle presentation and user-driven overrides.
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

    ipcMain.handle(
      ProfitForecastChannel.Compute,
      (
        _event,
        request: unknown,
      ): ProfitForecastComputeResponse | { success: false; error: string } => {
        try {
          const ch = ProfitForecastChannel.Compute;

          if (!request || typeof request !== "object") {
            throw new IpcValidationError(ch, "Missing or malformed payload");
          }

          const req = request as Record<string, unknown>;

          // Validate rows array (cap at 10 000 entries)
          assertArray(req.rows, "rows", ch, { maxLength: 10_000 });

          // Validate numeric cost-model parameters
          assertInteger(req.selectedBatch, "selectedBatch", ch, {
            min: 1,
            max: 1_000_000,
          });
          assertNumber(req.baseRate, "baseRate", ch);
          assertInteger(req.stepDrop, "stepDrop", ch, {
            min: 0,
            max: 10,
          });
          assertInteger(req.subBatchSize, "subBatchSize", ch, {
            min: 1,
            max: 1_000_000,
          });
          assertOptionalNumber(req.customBaseRate, "customBaseRate", ch);
          assertNumber(req.chaosToDivineRatio, "chaosToDivineRatio", ch);
          assertNumber(req.evPerDeck, "evPerDeck", ch);

          return computeAll(request as ProfitForecastComputeRequest);
        } catch (error) {
          return handleValidationError(error, ProfitForecastChannel.Compute);
        }
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Core Logic
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch and pre-compute the profit forecast payload for a given game and league.
   *
   * 1. Look up the league ID (read-only — returns null if league doesn't exist)
   * 2. Query the most recent snapshot for that league (no time restriction)
   * 3. If snapshot found, merge exchange + stash card prices (exchange preferred)
   * 4. Query PL card weights (weight > 0) via ProhibitedLibraryService
   * 5. Build pre-computed rows, EV per deck, and base rate
   * 6. Return combined DTO
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
        `No league found for game=${game}, league=${league} — returning empty forecast`,
      );
      return this.buildResponse(weights, null, null);
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
        `No snapshot found for league=${league} (id=${leagueRow.id}) — returning empty forecast`,
      );
      return this.buildResponse(weights, null, null);
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
      `Returning ${weights.length} rows, ${anomalousCount} anomalous`,
    );

    return this.buildResponse(weights, snapshot, cardPrices);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Response Builder
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Build the pre-computed response DTO from weights and an optional snapshot.
   */
  private buildResponse(
    weights: ProfitForecastWeightDTO[],
    snapshot: ProfitForecastSnapshotDTO | null,
    cardPrices: Record<string, ProfitForecastCardPriceDTO> | null,
  ): ProfitForecastDataDTO {
    // ── 1. Compute totalWeight ─────────────────────────────────────────
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);

    // ── 2. Compute floored & renormalized probabilities ────────────────
    //
    // Raw probability = weight / totalWeight.  For ultra-rare cards this
    // can be absurdly small (e.g. 6e-7) because the PL sample wasn't
    // large enough to observe them.  We apply PROBABILITY_FLOOR so that
    // every card has at least a realistic minimum probability, then
    // renormalize so the distribution still sums to 1.
    const rawProbabilities = weights.map((w) =>
      totalWeight > 0 ? w.weight / totalWeight : 0,
    );

    // Apply floor
    const flooredProbabilities = rawProbabilities.map((p) =>
      Math.max(p, PROBABILITY_FLOOR),
    );

    // Renormalize so they sum to 1
    const flooredSum = flooredProbabilities.reduce((s, p) => s + p, 0);
    const probabilities =
      flooredSum > 0
        ? flooredProbabilities.map((p) => p / flooredSum)
        : flooredProbabilities;

    // ── 3. Build rows ──────────────────────────────────────────────────
    const rows: ProfitForecastRowDTO[] = weights.map((w, i) => {
      const price = cardPrices?.[w.cardName] ?? null;
      const hasPrice = price !== null;
      const probability = probabilities[i];
      const chaosValue = hasPrice ? price.chaosValue : 0;
      const divineValue = hasPrice ? price.divineValue : 0;
      const confidence = hasPrice ? price.confidence : null;
      const isAnomalous = hasPrice ? price.isAnomalous : false;
      const evContribution = hasPrice
        ? probability * chaosValue * EV_CALIBRATION_FACTOR
        : 0;
      const excludeFromEv = !hasPrice || isAnomalous;

      return {
        cardName: w.cardName,
        weight: w.weight,
        fromBoss: w.fromBoss,
        probability,
        chaosValue,
        divineValue,
        evContribution,
        hasPrice,
        confidence,
        isAnomalous,
        excludeFromEv,
      };
    });

    // ── 4. Compute evPerDeck ───────────────────────────────────────────
    const evPerDeck = rows.reduce(
      (sum, row) =>
        row.hasPrice && !row.excludeFromEv ? sum + row.evContribution : sum,
      0,
    );

    // ── 5. Compute base rate ───────────────────────────────────────────
    const { baseRate, baseRateSource } = this.computeBaseRate(snapshot);

    // ── 6. Sort rows by evContribution descending ──────────────────────
    rows.sort((a, b) => b.evContribution - a.evContribution);

    return {
      rows,
      totalWeight,
      evPerDeck,
      snapshotFetchedAt: snapshot?.fetchedAt ?? null,
      chaosToDivineRatio: snapshot?.chaosToDivineRatio ?? 0,
      stackedDeckChaosCost: snapshot?.stackedDeckChaosCost ?? 0,
      baseRate,
      baseRateSource,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Compute the base rate (decks per divine) from snapshot data.
   *
   * Priority:
   * 1. `stackedDeckMaxVolumeRate` when available and > 0 → `max(RATE_FLOOR, floor(rate))`, source = "maxVolumeRate"
   * 2. Derived from `chaosToDivineRatio / stackedDeckChaosCost` → `max(RATE_FLOOR, floor(ratio))`, source = "derived"
   * 3. Otherwise `baseRate: 0`, source = "none"
   */
  private computeBaseRate(snapshot: ProfitForecastSnapshotDTO | null): {
    baseRate: number;
    baseRateSource: BaseRateSource;
  } {
    if (!snapshot) {
      return { baseRate: 0, baseRateSource: "none" };
    }

    const {
      stackedDeckMaxVolumeRate,
      chaosToDivineRatio,
      stackedDeckChaosCost,
    } = snapshot;

    // Prefer the bulk exchange rate when available
    if (stackedDeckMaxVolumeRate != null && stackedDeckMaxVolumeRate > 0) {
      return {
        baseRate: Math.max(RATE_FLOOR, Math.floor(stackedDeckMaxVolumeRate)),
        baseRateSource: "maxVolumeRate",
      };
    }

    // Fall back to derived rate
    if (stackedDeckChaosCost > 0) {
      return {
        baseRate: Math.max(
          RATE_FLOOR,
          Math.floor(chaosToDivineRatio / stackedDeckChaosCost),
        ),
        baseRateSource: "derived",
      };
    }

    return { baseRate: 0, baseRateSource: "none" };
  }

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
