import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfitForecastAPI } from "../ProfitForecast.api";
import { ProfitForecastChannel } from "../ProfitForecast.channels";
import type { ProfitForecastDataDTO } from "../ProfitForecast.dto";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));

vi.mock("electron", () => ({ ipcRenderer: { invoke: mockInvoke } }));

const EMPTY_DATA: ProfitForecastDataDTO = {
  rows: [],
  totalWeight: 0,
  evPerDeck: 0,
  snapshotFetchedAt: null,
  chaosToDivineRatio: 0,
  stackedDeckChaosCost: 0,
  baseRate: 0,
  baseRateSource: "none",
};

describe("ProfitForecastAPI.getData", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns a genuine empty payload without treating it as an error", async () => {
    mockInvoke.mockResolvedValue(EMPTY_DATA);

    expect(await ProfitForecastAPI.getData("poe1", "Standard")).toEqual(
      EMPTY_DATA,
    );
    expect(mockInvoke).toHaveBeenCalledWith(
      ProfitForecastChannel.GetData,
      "poe1",
      "Standard",
    );
  });

  it.each([
    "Unable to load profit forecast data. Please try again.",
    "Invalid input: Select an active league to load the profit forecast.",
  ])(
    "rejects with the main process error so the renderer can display Retry (%s)",
    async (error) => {
      mockInvoke.mockResolvedValue({ success: false, error });

      await expect(ProfitForecastAPI.getData("poe1", "Covens")).rejects.toThrow(
        error,
      );
    },
  );
});
