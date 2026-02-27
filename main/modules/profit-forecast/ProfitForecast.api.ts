import { ipcRenderer } from "electron";

import { ProfitForecastChannel } from "./ProfitForecast.channels";
import type { ProfitForecastDataDTO } from "./ProfitForecast.dto";

export const ProfitForecastAPI = {
  /**
   * Fetch combined snapshot prices and Prohibited Library card weights
   * for the given game and league.
   *
   * Returns a single payload containing:
   * - `snapshot`: most recent poe.ninja snapshot (or null if none exists)
   * - `weights`: PL card weights with weight > 0
   *
   * All cost-model and batch calculations happen renderer-side.
   */
  getData: (
    game: "poe1" | "poe2",
    league: string,
  ): Promise<ProfitForecastDataDTO> => {
    return ipcRenderer.invoke(ProfitForecastChannel.GetData, game, league);
  },
};
