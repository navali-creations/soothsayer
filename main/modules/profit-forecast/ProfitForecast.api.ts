import { ipcRenderer } from "electron";

import { ProfitForecastChannel } from "./ProfitForecast.channels";
import type { ProfitForecastDataDTO } from "./ProfitForecast.dto";

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
};
