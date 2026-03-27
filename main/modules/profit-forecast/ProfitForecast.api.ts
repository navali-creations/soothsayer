import { ipcRenderer } from "electron";

import { ProfitForecastChannel } from "./ProfitForecast.channels";
import type {
  ProfitForecastComputeRequest,
  ProfitForecastComputeResponse,
  ProfitForecastDataDTO,
} from "./ProfitForecast.dto";

export const ProfitForecastAPI = {
  /**
   * Fetch pre-computed profit forecast data for the given game and league.
   *
   * Returns a single payload containing:
   * - `rows`: pre-built forecast rows sorted by EV contribution (descending)
   * - `totalWeight`: sum of all card weights
   * - `evPerDeck`: expected value per stacked deck opening (excludes anomalous / low-confidence cards)
   * - `snapshotFetchedAt`: timestamp of the most recent poe.ninja snapshot (or null if none exists)
   * - `chaosToDivineRatio`: exchange rate from the snapshot
   * - `stackedDeckChaosCost`: cost of a stacked deck in chaos
   * - `baseRate`: computed base rate (decks per divine)
   * - `baseRateSource`: how the base rate was determined
   *
   * All heavy computation (row building, EV, base rate) is performed main-side.
   */
  getData: (
    game: "poe1" | "poe2",
    league: string,
  ): Promise<ProfitForecastDataDTO> => {
    return ipcRenderer.invoke(ProfitForecastChannel.GetData, game, league);
  },

  /**
   * Offload heavy cost-model and P&L computations to the main process.
   *
   * The renderer sends the current rows and cost-model parameters, and the
   * main process returns fully computed dynamic fields, PnL curve, confidence
   * intervals, and batch P&L — all in a single round-trip.
   *
   * This keeps the renderer thread free for smooth UI updates while the main
   * process handles the O(rows × sub-batches) math.
   */
  compute: (
    request: ProfitForecastComputeRequest,
  ): Promise<ProfitForecastComputeResponse> => {
    return ipcRenderer.invoke(ProfitForecastChannel.Compute, request);
  },
};
