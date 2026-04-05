import { ipcRenderer } from "electron";

import type {
  AggregatedTimeline,
  DetailedDivinationCardStats,
  SessionCardDelta,
  TimelineDelta,
} from "../../../types/data-stores";
import { CurrentSessionChannel } from "./CurrentSession.channels";
import type { SessionDTO } from "./CurrentSession.dto";

// Extended session type with additional metadata (for API responses)
type SessionWithMetadata = SessionDTO & {
  cards?: Array<{ cardName: string; count: number }>;
};

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
  ): Promise<
    | {
        success: true;
        game: "poe1" | "poe2";
        league: string;
        durationMs: number;
        totalCount: number;
      }
    | { success: false; error: string }
  > => ipcRenderer.invoke(CurrentSessionChannel.Stop, game),

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
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: {
        game: "poe1" | "poe2";
        isActive: boolean;
        sessionInfo: { league: string; startedAt: string } | null;
      },
    ) => callback(data);
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
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: {
        game: "poe1" | "poe2";
        data: DetailedDivinationCardStats | null;
      },
    ) => callback(data);
    ipcRenderer.on(CurrentSessionChannel.DataUpdated, listener);
    return () =>
      ipcRenderer.removeListener(CurrentSessionChannel.DataUpdated, listener);
  },

  // Listen for incremental timeline updates (one per card drop)
  onTimelineDelta: (
    callback: (data: { game: "poe1" | "poe2"; delta: TimelineDelta }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: {
        game: "poe1" | "poe2";
        delta: TimelineDelta;
      },
    ) => callback(data);
    ipcRenderer.on(CurrentSessionChannel.TimelineDelta, listener);
    return () =>
      ipcRenderer.removeListener(CurrentSessionChannel.TimelineDelta, listener);
  },

  // Listen for incremental card updates (one per card drop, replaces full session broadcast)
  onCardDelta: (
    callback: (data: {
      game: "poe1" | "poe2";
      delta: SessionCardDelta;
    }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: {
        game: "poe1" | "poe2";
        delta: SessionCardDelta;
      },
    ) => callback(data);
    ipcRenderer.on(CurrentSessionChannel.CardDelta, listener);
    return () =>
      ipcRenderer.removeListener(CurrentSessionChannel.CardDelta, listener);
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

  // Get timeline data for a session
  getTimeline: (sessionId: string): Promise<AggregatedTimeline | null> =>
    ipcRenderer.invoke(CurrentSessionChannel.GetTimeline, sessionId),
};
