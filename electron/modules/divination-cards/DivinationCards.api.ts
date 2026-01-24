import { ipcRenderer } from "electron";

import { DivinationCardsChannel } from "./DivinationCards.channels";
import type {
  DivinationCardDTO,
  DivinationCardSearchDTO,
  DivinationCardStatsDTO,
} from "./DivinationCards.dto";

export const DivinationCardsApi = {
  /**
   * Get all divination cards for a game
   */
  getAll: (game: "poe1" | "poe2"): Promise<DivinationCardDTO[]> => {
    return ipcRenderer.invoke(DivinationCardsChannel.GetAll, game);
  },

  /**
   * Get a card by its ID (e.g., "poe1_a-chilling-wind")
   */
  getById: (id: string): Promise<DivinationCardDTO | null> => {
    return ipcRenderer.invoke(DivinationCardsChannel.GetById, id);
  },

  /**
   * Get a specific card by name
   */
  getByName: (
    game: "poe1" | "poe2",
    name: string,
  ): Promise<DivinationCardDTO | null> => {
    return ipcRenderer.invoke(DivinationCardsChannel.GetByName, game, name);
  },

  /**
   * Search cards by name (case-insensitive partial match)
   */
  searchByName: (
    game: "poe1" | "poe2",
    query: string,
  ): Promise<DivinationCardSearchDTO> => {
    return ipcRenderer.invoke(DivinationCardsChannel.SearchByName, game, query);
  },

  /**
   * Get total count of divination cards
   */
  getCount: (game: "poe1" | "poe2"): Promise<number> => {
    return ipcRenderer.invoke(DivinationCardsChannel.GetCount, game);
  },

  /**
   * Get stats for divination cards
   */
  getStats: (game: "poe1" | "poe2"): Promise<DivinationCardStatsDTO> => {
    return ipcRenderer.invoke(DivinationCardsChannel.GetStats, game);
  },

  /**
   * Force re-sync from JSON (for debugging/manual refresh)
   */
  forceSync: (game: "poe1" | "poe2"): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke(DivinationCardsChannel.ForceSync, game);
  },
};
