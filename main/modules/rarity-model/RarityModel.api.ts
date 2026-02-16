import { ipcRenderer } from "electron";

import type { KnownRarity } from "~/types/data-stores";

import { RarityModelChannel } from "./RarityModel.channels";
import type {
  RarityModelMetadataDTO,
  RarityModelParseResultDTO,
  RarityModelScanResultDTO,
  RaritySource,
} from "./RarityModel.dto";

export const RarityModelAPI = {
  /**
   * Scan filter directories for available filters (metadata only, lazy)
   */
  scan: (): Promise<RarityModelScanResultDTO> => {
    return ipcRenderer.invoke(RarityModelChannel.ScanRarityModels);
  },

  /**
   * Get all discovered filters from the database
   */
  getAll: (): Promise<RarityModelMetadataDTO[]> => {
    return ipcRenderer.invoke(RarityModelChannel.GetRarityModels);
  },

  /**
   * Get a specific filter by ID
   */
  get: (filterId: string): Promise<RarityModelMetadataDTO | null> => {
    return ipcRenderer.invoke(RarityModelChannel.GetRarityModel, filterId);
  },

  /**
   * Trigger a full parse of a specific filter's divination card section
   */
  parse: (filterId: string): Promise<RarityModelParseResultDTO> => {
    return ipcRenderer.invoke(RarityModelChannel.ParseRarityModel, filterId);
  },

  /**
   * Select a filter (or clear selection with null) and apply its rarities
   */
  select: (filterId: string | null): Promise<void> => {
    return ipcRenderer.invoke(RarityModelChannel.SelectRarityModel, filterId);
  },

  /**
   * Get the currently selected filter metadata
   */
  getSelected: (): Promise<RarityModelMetadataDTO | null> => {
    return ipcRenderer.invoke(RarityModelChannel.GetSelectedRarityModel);
  },

  /**
   * Get the current rarity source setting
   */
  getRaritySource: (): Promise<RaritySource> => {
    return ipcRenderer.invoke(RarityModelChannel.GetRaritySource);
  },

  /**
   * Set the rarity source setting
   */
  setRaritySource: (source: RaritySource): Promise<void> => {
    return ipcRenderer.invoke(RarityModelChannel.SetRaritySource, source);
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
      RarityModelChannel.UpdateRarityModelCardRarity,
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
      RarityModelChannel.ApplyRarityModelRarities,
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

    ipcRenderer.on(RarityModelChannel.OnRarityModelRaritiesApplied, handler);

    return () => {
      ipcRenderer.removeListener(
        RarityModelChannel.OnRarityModelRaritiesApplied,
        handler,
      );
    };
  },
};
