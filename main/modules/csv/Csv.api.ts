import { ipcRenderer } from "electron";

import { CsvChannel } from "./Csv.channels";

export interface CsvExportResult {
  success: boolean;
  canceled?: boolean;
  error?: string;
}

export interface SnapshotMetaResult {
  exists: boolean;
  exportedAt: string | null;
  totalCount: number;
  /** Number of distinct card types with new drops since last export */
  newCardCount: number;
  /** Total number of new individual card drops since last export */
  newTotalDrops: number;
}

const CsvAPI = {
  /**
   * Export all cards for the current game's active scope (all-time or league)
   */
  exportAll: (scope: string): Promise<CsvExportResult> =>
    ipcRenderer.invoke(CsvChannel.ExportAll, scope),

  /**
   * Export only cards added since the last successful share
   */
  exportIncremental: (scope: string): Promise<CsvExportResult> =>
    ipcRenderer.invoke(CsvChannel.ExportIncremental, scope),

  /**
   * Export cards for a specific session
   */
  exportSession: (sessionId: string): Promise<CsvExportResult> =>
    ipcRenderer.invoke(CsvChannel.ExportSession, sessionId),

  /**
   * Get metadata about the last snapshot for a given scope
   */
  getSnapshotMeta: (scope: string): Promise<SnapshotMetaResult> =>
    ipcRenderer.invoke(CsvChannel.GetSnapshotMeta, scope),
};

export { CsvAPI };
