import { ipcRenderer } from "electron";
import type { DetailedDivinationCardStats } from "../../../types/data-stores";
import type { GameVersion } from "../settings-store/SettingsStore.schemas";
import { CurrentSessionChannel } from "./CurrentSession.channels";

export const CurrentSessionAPI = {
  // Start a session
  start: (
    activeGameView: Extract<GameVersion, "poe1" | "poe2">,
    league: string,
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(CurrentSessionChannel.Start, activeGameView, league),

  // Stop a session
  stop: (
    activeGameView: Extract<GameVersion, "poe1" | "poe2">,
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(CurrentSessionChannel.Stop, activeGameView),

  // Check if session is active
  isActive: (activeGameView: GameVersion): Promise<boolean> =>
    ipcRenderer.invoke(CurrentSessionChannel.IsActive, activeGameView),

  // Get current session data
  getCurrent: (
    activeGameView: GameVersion,
  ): Promise<DetailedDivinationCardStats | null> =>
    ipcRenderer.invoke(CurrentSessionChannel.Get, activeGameView),

  // Get session info (league, startedAt)
  getInfo: (
    activeGameView: GameVersion,
  ): Promise<{ league: string; startedAt: string } | null> =>
    ipcRenderer.invoke(CurrentSessionChannel.Info, activeGameView),

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
