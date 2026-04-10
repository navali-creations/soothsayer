import { ipcRenderer } from "electron";

import type { GameType } from "~/types/data-stores";

import { CardDetailsChannel } from "./CardDetails.channels";
import type {
  CardDetailsInitDTO,
  CardPersonalAnalyticsDTO,
  CardPriceHistoryDTO,
  RelatedCardsResultDTO,
} from "./CardDetails.dto";

export const CardDetailsAPI = {
  /**
   * Get price history for a divination card from poe.ninja (with SQLite caching).
   *
   * @param game - The game type ("poe1" or "poe2")
   * @param league - The league name (e.g. "Settlers")
   * @param cardName - The card's display name (e.g. "House of Mirrors")
   * @returns Price history DTO, or null if unavailable
   */
  getPriceHistory: (
    game: GameType,
    league: string,
    cardName: string,
  ): Promise<CardPriceHistoryDTO | null> => {
    return ipcRenderer.invoke(
      CardDetailsChannel.GetPriceHistory,
      game,
      league,
      cardName,
    );
  },

  /**
   * Get personal analytics for a divination card from the local SQLite database.
   *
   * Returns aggregated drop history, session counts, boss-exclusive status,
   * Prohibited Library weight data, total decks opened, and a per-session
   * drop timeline for charting.
   *
   * @param game - The game type ("poe1" or "poe2")
   * @param league - The league name (e.g. "Settlers")
   * @param cardName - The card's display name (e.g. "House of Mirrors")
   * @returns Personal analytics DTO, or null if unavailable
   */
  getPersonalAnalytics: (
    game: GameType,
    league: string,
    cardName: string,
    selectedLeague?: string,
  ): Promise<CardPersonalAnalyticsDTO | null> => {
    return ipcRenderer.invoke(
      CardDetailsChannel.GetPersonalAnalytics,
      game,
      league,
      cardName,
      selectedLeague,
    );
  },

  /**
   * Get related cards that share a similar reward item.
   *
   * Returns pre-split, deduplicated, and rarity-sorted results
   * with separate arrays for "similar" and "chain" cards.
   *
   * @param game - The game type ("poe1" or "poe2")
   * @param cardName - The card's display name (e.g. "House of Mirrors")
   * @returns Related cards result with similarCards and chainCards arrays
   */
  getRelatedCards: (
    game: GameType,
    cardName: string,
  ): Promise<RelatedCardsResultDTO> => {
    return ipcRenderer.invoke(
      CardDetailsChannel.GetRelatedCards,
      game,
      cardName,
    );
  },

  /**
   * Resolve a divination card by its URL slug and return a unified DTO
   * containing the card, personal analytics, and related cards in a single
   * IPC round-trip.
   *
   * Replaces the previous pattern of three separate IPC calls
   * (getAll + getPersonalAnalytics + getRelatedCards) from the renderer.
   *
   * @param game - The game type ("poe1" or "poe2")
   * @param cardSlug - The URL slug (e.g. "house-of-mirrors")
   * @param selectedLeague - Optional league filter for personal analytics
   * @returns Unified init DTO, or null if the slug doesn't match any card
   */
  resolveCardBySlug: (
    game: GameType,
    cardSlug: string,
    selectedLeague?: string,
  ): Promise<CardDetailsInitDTO | null> => {
    return ipcRenderer.invoke(
      CardDetailsChannel.ResolveCardBySlug,
      game,
      cardSlug,
      selectedLeague,
    );
  },

  /**
   * Open a card's details page in the main window.
   *
   * Called from the overlay renderer to deep-link into the main window.
   * The main process will focus/show the main window and send a navigation
   * event to its renderer so the router navigates to `/cards/$cardSlug`.
   *
   * @param cardName - The card's display name (e.g. "House of Mirrors")
   */
  openCardInMainWindow: (cardName: string): Promise<void> => {
    return ipcRenderer.invoke(CardDetailsChannel.OpenInMainWindow, cardName);
  },

  /**
   * Listen for "navigate to card" events sent from the main process.
   *
   * The main renderer should register this listener so that when the overlay
   * requests a card detail view, the router can navigate to the correct route.
   *
   * @param callback - Invoked with the card name to navigate to.
   * @returns A cleanup function that removes the listener.
   */
  onNavigateToCard: (callback: (cardName: string) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, cardName: string) => {
      callback(cardName);
    };
    ipcRenderer.on(CardDetailsChannel.NavigateToCard, listener);
    return () => {
      ipcRenderer.removeListener(CardDetailsChannel.NavigateToCard, listener);
    };
  },
};
