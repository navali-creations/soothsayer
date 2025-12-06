import { ipcRenderer } from "electron";
import type { DetailedDivinationCardStats } from "../../../types/data-stores";
import type { GameVersion } from "../settings-store/SettingsStore.schemas";
import { CurrentSessionChannel } from "./CurrentSession.channels";

export const CurrentSessionAPI = {
  // Start a session
  start: (
    game: GameVersion,
    league: string,
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(CurrentSessionChannel.Start, game, league),

  // Stop a session
  stop: (game: GameVersion): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(CurrentSessionChannel.Stop, game),

  // Check if session is active
  isActive: (game: GameVersion): Promise<boolean> =>
    ipcRenderer.invoke(CurrentSessionChannel.IsActive, game),

  // Get current session data
  getCurrent: (
    game: GameVersion,
  ): Promise<DetailedDivinationCardStats | null> =>
    ipcRenderer.invoke(CurrentSessionChannel.Get, game),

  // Get session info (league, startedAt)
  getInfo: (
    game: GameVersion,
  ): Promise<{ league: string; startedAt: string } | null> =>
    ipcRenderer.invoke(CurrentSessionChannel.Info, game),

  // Listen for session state changes
  onStateChanged: (
    callback: (data: {
      game: GameVersion;
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
      game: GameVersion;
      data: DetailedDivinationCardStats | null;
    }) => void,
  ) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on("session:data-updated", listener);
    return () => ipcRenderer.removeListener("session:data-updated", listener);
  },

  // Update card price visibility
  updateCardPriceVisibility: (
    game: GameVersion,
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

  getAll: (game: GameVersion): Promise<SessionWithMetadata[]> =>
    ipcRenderer.invoke(CurrentSessionChannel.GetAll, game),

  // Get specific session by ID
  getById: (
    game: GameVersion,
    sessionId: string,
  ): Promise<SessionWithMetadata | null> =>
    ipcRenderer.invoke(CurrentSessionChannel.GetById, game, sessionId),
};
