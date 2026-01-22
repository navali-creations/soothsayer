import { ipcRenderer } from "electron";
import type { DetailedDivinationCardStats } from "../../../types/data-stores";
import { CurrentSessionChannel } from "./CurrentSession.channels";

export const CurrentSessionAPI = {
  // Start a session
  start: (
    game: "poe1" | "poe2",
    league: string,
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(CurrentSessionChannel.Start, game, league),

  // Stop a session
  stop: (
    game: "poe1" | "poe2",
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(CurrentSessionChannel.Stop, game),

  // Check if session is active
  isActive: (game: "poe1" | "poe2"): Promise<boolean> =>
    ipcRenderer.invoke(CurrentSessionChannel.IsActive, game),

  // Get current session data
  getCurrent: (
    game: "poe1" | "poe2",
  ): Promise<DetailedDivinationCardStats | null> =>
    ipcRenderer.invoke(CurrentSessionChannel.Get, game),

  // Get session info (league, startedAt)
  getInfo: (
    game: "poe1" | "poe2",
  ): Promise<{ league: string; startedAt: string } | null> =>
    ipcRenderer.invoke(CurrentSessionChannel.Info, game),

  // Listen for session state changes
  onStateChanged: (
    callback: (data: {
      game: "poe1" | "poe2";
      isActive: boolean;
      sessionInfo: { league: string; startedAt: string } | null;
    }) => void,
  ) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on(CurrentSessionChannel.StateChanged, listener);
    return () =>
      ipcRenderer.removeListener(CurrentSessionChannel.StateChanged, listener);
  },

  // Listen for session data updates
  onDataUpdated: (
    callback: (data: {
      game: "poe1" | "poe2";
      data: DetailedDivinationCardStats | null;
    }) => void,
  ) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on("session:data-updated", listener);
    return () => ipcRenderer.removeListener("session:data-updated", listener);
  },

  // Update card price visibility
  updateCardPriceVisibility: (
    game: "poe1" | "poe2",
    sessionId: string,
    priceSource: "exchange" | "stash",
    cardName: string,
    hidePrice: boolean,
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(
      CurrentSessionChannel.UpdateCardPriceVisibility,
      game,
      sessionId,
      priceSource,
      cardName,
      hidePrice,
    ),

  getAll: (game: "poe1" | "poe2"): Promise<SessionWithMetadata[]> =>
    ipcRenderer.invoke(CurrentSessionChannel.GetAll, game),

  // Get specific session by ID
  getById: (
    game: "poe1" | "poe2",
    sessionId: string,
  ): Promise<SessionWithMetadata | null> =>
    ipcRenderer.invoke(CurrentSessionChannel.GetById, game, sessionId),
};
