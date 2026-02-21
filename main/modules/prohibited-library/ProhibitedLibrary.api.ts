import { ipcRenderer } from "electron";

import { ProhibitedLibraryChannel } from "./ProhibitedLibrary.channels";
import type {
  ProhibitedLibraryCardWeightDTO,
  ProhibitedLibraryLoadResultDTO,
  ProhibitedLibraryStatusDTO,
} from "./ProhibitedLibrary.dto";

export const ProhibitedLibraryAPI = {
  /**
   * Force reload Prohibited Library data for a game.
   * Re-parses the bundled CSV asset and persists to the database.
   */
  reload: (game: "poe1" | "poe2"): Promise<ProhibitedLibraryLoadResultDTO> => {
    return ipcRenderer.invoke(ProhibitedLibraryChannel.Reload, game);
  },

  /**
   * Get the current status of Prohibited Library data for a game.
   */
  getStatus: (game: "poe1" | "poe2"): Promise<ProhibitedLibraryStatusDTO> => {
    return ipcRenderer.invoke(ProhibitedLibraryChannel.GetStatus, game);
  },

  /**
   * Get all card weights for a game.
   * Uses the active league with automatic fallback to the CSV's n-1 league.
   */
  getCardWeights: (
    game: "poe1" | "poe2",
  ): Promise<ProhibitedLibraryCardWeightDTO[]> => {
    return ipcRenderer.invoke(ProhibitedLibraryChannel.GetCardWeights, game);
  },

  /**
   * Get boss-exclusive cards for a game.
   * Uses the active league with automatic fallback to the CSV's n-1 league.
   */
  getFromBossCards: (
    game: "poe1" | "poe2",
  ): Promise<ProhibitedLibraryCardWeightDTO[]> => {
    return ipcRenderer.invoke(ProhibitedLibraryChannel.GetFromBossCards, game);
  },

  /**
   * Subscribe to data-refreshed events (main → renderer).
   * Fires when PL data has been reloaded for a game.
   *
   * @returns Unsubscribe function
   */
  onDataRefreshed: (
    callback: (game: "poe1" | "poe2") => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      game: "poe1" | "poe2",
    ) => {
      callback(game);
    };
    ipcRenderer.on(ProhibitedLibraryChannel.OnDataRefreshed, handler);
    return () => {
      ipcRenderer.removeListener(
        ProhibitedLibraryChannel.OnDataRefreshed,
        handler,
      );
    };
  },

  /**
   * Subscribe to load-error events (main → renderer).
   * Fires when PL data loading fails.
   *
   * @returns Unsubscribe function
   */
  onLoadError: (callback: (error: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string) => {
      callback(error);
    };
    ipcRenderer.on(ProhibitedLibraryChannel.OnLoadError, handler);
    return () => {
      ipcRenderer.removeListener(ProhibitedLibraryChannel.OnLoadError, handler);
    };
  },
};
