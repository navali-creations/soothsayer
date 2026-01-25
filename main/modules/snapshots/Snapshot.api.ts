import { ipcRenderer } from "electron";

import { SnapshotChannel } from "./Snapshot.channels";

export const SnapshotAPI = {
  /**
   * Get the latest snapshot for a given game and league
   */
  getLatestSnapshot: (game: string, league: string) => {
    return ipcRenderer.invoke(SnapshotChannel.GetLatestSnapshot, game, league);
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
