import { ipcRenderer } from "electron";

import type { KnownRarity } from "~/types/data-stores";

import { RarityInsightsChannel } from "./RarityInsights.channels";
import type {
  RarityInsightsMetadataDTO,
  RarityInsightsParseResultDTO,
  RarityInsightsScanResultDTO,
  RaritySource,
} from "./RarityInsights.dto";

export const RarityInsightsAPI = {
  /**
   * Scan filter directories for available filters (metadata only, lazy)
   */
  scan: (): Promise<RarityInsightsScanResultDTO> => {
    return ipcRenderer.invoke(RarityInsightsChannel.ScanRarityInsights);
  },

  /**
   * Get all discovered filters from the database
   */
  getAll: (): Promise<RarityInsightsMetadataDTO[]> => {
    return ipcRenderer.invoke(RarityInsightsChannel.GetAllRarityInsights);
  },

  /**
   * Get a specific filter by ID
   */
  get: (filterId: string): Promise<RarityInsightsMetadataDTO | null> => {
    return ipcRenderer.invoke(
      RarityInsightsChannel.GetRarityInsights,
      filterId,
    );
  },

  /**
   * Trigger a full parse of a specific filter's divination card section
   */
  parse: (filterId: string): Promise<RarityInsightsParseResultDTO> => {
    return ipcRenderer.invoke(
      RarityInsightsChannel.ParseRarityInsights,
      filterId,
    );
  },

  /**
   * Select a filter (or clear selection with null) and apply its rarities
   */
  select: (filterId: string | null): Promise<void> => {
    return ipcRenderer.invoke(
      RarityInsightsChannel.SelectRarityInsights,
      filterId,
    );
  },

  /**
   * Get the currently selected filter metadata
   */
  getSelected: (): Promise<RarityInsightsMetadataDTO | null> => {
    return ipcRenderer.invoke(RarityInsightsChannel.GetSelectedRarityInsights);
  },

  /**
   * Get the current rarity source setting
   */
  getRaritySource: (): Promise<RaritySource> => {
    return ipcRenderer.invoke(RarityInsightsChannel.GetRaritySource);
  },

  /**
   * Set the rarity source setting
   */
  setRaritySource: (source: RaritySource): Promise<void> => {
    return ipcRenderer.invoke(RarityInsightsChannel.SetRaritySource, source);
  },

  /**
   * Update a single card's rarity within a parsed filter.
   *
   * @param filterId - The filter to update
   * @param cardName - The card name to update
   * @param rarity - The new rarity value (1-4)
   */
  updateCardRarity: (
    filterId: string,
    cardName: string,
    rarity: KnownRarity,
  ): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke(
      RarityInsightsChannel.UpdateRarityInsightsCardRarity,
      filterId,
      cardName,
      rarity,
    );
  },

  /**
   * Apply filter-based rarities to divination cards for a specific game/league.
   *
   * This ensures the filter is parsed and then writes filter-derived rarities
   * into the divination_card_rarities table. Cards not present in the filter
   * default to rarity 4 (common).
   *
   * @param filterId - The ID of the selected filter
   * @param game - The game type ("poe1" or "poe2")
   * @param league - The league name
   */
  applyRarities: (
    filterId: string,
    game: "poe1" | "poe2",
    league: string,
  ): Promise<{ success: boolean; totalCards: number; filterName: string }> => {
    return ipcRenderer.invoke(
      RarityInsightsChannel.ApplyRarityInsightsRarities,
      filterId,
      game,
      league,
    );
  },

  /**
   * Listen for filter rarities applied events from the main process.
   * Returns a cleanup function to remove the listener.
   */
  onFilterRaritiesApplied: (
    callback: (data: {
      filterId: string;
      filterName: string;
      game: string;
      league: string;
      totalCards: number;
    }) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: {
        filterId: string;
        filterName: string;
        game: string;
        league: string;
        totalCards: number;
      },
    ) => {
      callback(data);
    };

    ipcRenderer.on(
      RarityInsightsChannel.OnRarityInsightsRaritiesApplied,
      handler,
    );

    return () => {
      ipcRenderer.removeListener(
        RarityInsightsChannel.OnRarityInsightsRaritiesApplied,
        handler,
      );
    };
  },
};
