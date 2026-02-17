import { ipcRenderer } from "electron";

import { SnapshotChannel } from "./Snapshot.channels";

export interface RefreshPricesResult {
  snapshotId: string;
  fetchedAt: string;
  refreshableAt: string;
}

export interface RefreshStatusResult {
  fetchedAt: string | null;
  refreshableAt: string | null;
}

export const SnapshotAPI = {
  /**
   * Get the latest snapshot for a given game and league
   */
  getLatestSnapshot: (game: string, league: string) => {
    return ipcRenderer.invoke(SnapshotChannel.GetLatestSnapshot, game, league);
  },

  /**
   * Force-refresh poe.ninja prices by fetching a new snapshot (or reusing a
   * recent one if one was fetched within the auto-refresh window).
   * Returns the snapshot ID, timestamp, and when the next refresh becomes available.
   */
  refreshPrices: (
    game: string,
    league: string,
  ): Promise<RefreshPricesResult> => {
    return ipcRenderer.invoke(SnapshotChannel.RefreshPrices, game, league);
  },

  /**
   * Get the current refresh cooldown status for a given game and league.
   * Returns when the last snapshot was fetched and when a refresh becomes
   * available again. Both fields are null if no snapshot exists for the league.
   */
  getRefreshStatus: (
    game: string,
    league: string,
  ): Promise<RefreshStatusResult> => {
    return ipcRenderer.invoke(SnapshotChannel.GetRefreshStatus, game, league);
  },

  /**
   * Listen for snapshot created events
   */
  onSnapshotCreated: (callback: (snapshotInfo: any) => void) => {
    const listener = (_event: any, snapshotInfo: any) => callback(snapshotInfo);
    ipcRenderer.on(SnapshotChannel.OnSnapshotCreated, listener);
    return () =>
      ipcRenderer.removeListener(SnapshotChannel.OnSnapshotCreated, listener);
  },

  /**
   * Listen for snapshot reused events
   */
  onSnapshotReused: (callback: (snapshotInfo: any) => void) => {
    const listener = (_event: any, snapshotInfo: any) => callback(snapshotInfo);
    ipcRenderer.on(SnapshotChannel.OnSnapshotReused, listener);
    return () =>
      ipcRenderer.removeListener(SnapshotChannel.OnSnapshotReused, listener);
  },

  /**
   * Listen for auto-refresh started events
   */
  onAutoRefreshStarted: (
    callback: (info: {
      game: string;
      league: string;
      intervalHours: number;
    }) => void,
  ) => {
    const listener = (_event: any, info: any) => callback(info);
    ipcRenderer.on(SnapshotChannel.OnAutoRefreshStarted, listener);
    return () =>
      ipcRenderer.removeListener(
        SnapshotChannel.OnAutoRefreshStarted,
        listener,
      );
  },

  /**
   * Listen for auto-refresh stopped events
   */
  onAutoRefreshStopped: (
    callback: (info: { game: string; league: string }) => void,
  ) => {
    const listener = (_event: any, info: any) => callback(info);
    ipcRenderer.on(SnapshotChannel.OnAutoRefreshStopped, listener);
    return () =>
      ipcRenderer.removeListener(
        SnapshotChannel.OnAutoRefreshStopped,
        listener,
      );
  },
};
