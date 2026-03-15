import { promises as fs } from "node:fs";
import path from "node:path";

import { app, BrowserWindow, dialog, ipcMain } from "electron";

import {
  DataStoreService,
  type SimpleDivinationCardStats,
} from "~/main/modules/data-store";
import { DatabaseService } from "~/main/modules/database";
import { SessionsService } from "~/main/modules/sessions";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import {
  assertBoundedString,
  assertGameType,
  assertSessionId,
  handleValidationError,
} from "~/main/utils/ipc-validation";

import { CsvChannel } from "./Csv.channels";
import type { CsvExportResultDTO } from "./Csv.dto";
import { CsvExportType, CsvIntegrityStatus } from "./Csv.dto";
import { CsvIntegrityChecker } from "./Csv.integrity";
import { CsvRepository } from "./Csv.repository";
import { jsonToCsv } from "./utils";

/**
 * CSV Export Service
 *
 * Handles full, incremental, and per-session CSV exports of divination card data.
 * Manages export snapshots for incremental delta calculation.
 */
class CsvService {
  private static _instance: CsvService;
  private dataStore: DataStoreService;
  private settingsStore: SettingsStoreService;
  private repository: CsvRepository;
  private integrityChecker: CsvIntegrityChecker;

  static getInstance(): CsvService {
    if (!CsvService._instance) {
      CsvService._instance = new CsvService();
    }
    return CsvService._instance;
  }

  constructor() {
    const db = DatabaseService.getInstance();
    this.dataStore = DataStoreService.getInstance();
    this.settingsStore = SettingsStoreService.getInstance();
    this.repository = new CsvRepository(db.getKysely());
    this.integrityChecker = new CsvIntegrityChecker(this.repository);
    this.setupHandlers();
  }

  // ============================================================================
  // IPC Handler Registration
  // ============================================================================

  private setupHandlers(): void {
    // Export all cards for the active game and given scope
    ipcMain.handle(
      CsvChannel.ExportAll,
      async (_event, scope: string): Promise<CsvExportResultDTO> => {
        try {
          assertBoundedString(scope, "scope", CsvChannel.ExportAll, 256);
          return await this.exportAll(scope);
        } catch (error) {
          if (error instanceof Error && error.name === "IpcValidationError") {
            return handleValidationError(
              error,
              CsvChannel.ExportAll,
            ) as CsvExportResultDTO;
          }
          console.error(`[CsvService] ${CsvChannel.ExportAll} error:`, error);
          return {
            success: false,
            error: "Export failed. See logs for details.",
          };
        }
      },
    );

    // Export only cards added since the last successful share
    ipcMain.handle(
      CsvChannel.ExportIncremental,
      async (_event, scope: string): Promise<CsvExportResultDTO> => {
        try {
          assertBoundedString(
            scope,
            "scope",
            CsvChannel.ExportIncremental,
            256,
          );
          return await this.exportIncremental(scope);
        } catch (error) {
          if (error instanceof Error && error.name === "IpcValidationError") {
            return handleValidationError(
              error,
              CsvChannel.ExportIncremental,
            ) as CsvExportResultDTO;
          }
          console.error(
            `[CsvService] ${CsvChannel.ExportIncremental} error:`,
            error,
          );
          return {
            success: false,
            error: "Export failed. See logs for details.",
          };
        }
      },
    );

    // Export cards for a specific session
    ipcMain.handle(
      CsvChannel.ExportSession,
      async (_event, sessionId: string): Promise<CsvExportResultDTO> => {
        try {
          assertSessionId(sessionId, CsvChannel.ExportSession);
          return await this.exportSession(sessionId);
        } catch (error) {
          if (error instanceof Error && error.name === "IpcValidationError") {
            return handleValidationError(
              error,
              CsvChannel.ExportSession,
            ) as CsvExportResultDTO;
          }
          console.error(
            `[CsvService] ${CsvChannel.ExportSession} error:`,
            error,
          );
          return {
            success: false,
            error: "Export failed. See logs for details.",
          };
        }
      },
    );

    // Get metadata about the last snapshot for a given scope
    ipcMain.handle(
      CsvChannel.GetSnapshotMeta,
      async (_event, scope: string) => {
        try {
          assertBoundedString(scope, "scope", CsvChannel.GetSnapshotMeta, 256);
          return await this.getSnapshotMeta(scope);
        } catch (error) {
          if (error instanceof Error && error.name === "IpcValidationError") {
            return handleValidationError(error, CsvChannel.GetSnapshotMeta);
          }
          console.error(
            `[CsvService] ${CsvChannel.GetSnapshotMeta} error:`,
            error,
          );
          return {
            success: false,
            error: "Export failed. See logs for details.",
          };
        }
      },
    );
  }

  // ============================================================================
  // Export Methods
  // ============================================================================

  /**
   * Export all cards for the active game and given scope.
   * After a successful export, saves a snapshot of current counts.
   */
  private async exportAll(scope: string): Promise<CsvExportResultDTO> {
    const activeGame = await this.settingsStore.get(SettingsKey.ActiveGame);
    assertGameType(activeGame, CsvChannel.ExportAll);

    // Fetch stats for the requested scope
    const stats = await this.getStatsForScope(activeGame, scope);
    const csvData = this.statsToCsvData(stats);
    const csvContent = jsonToCsv(csvData);
    const exportedCount = Object.keys(csvData).length;

    // Show save dialog and write file
    const result = await this.promptAndWriteCsv(
      csvContent,
      activeGame,
      scope,
      CsvExportType.All,
    );

    if (!result.success || result.canceled) {
      return result;
    }

    // On success, run integrity checks and save snapshot with results
    await this.saveCurrentSnapshot(activeGame, scope, csvData);

    return { ...result, exportedCount };
  }

  /**
   * Export only cards added since the last successful share (incremental).
   * Computes delta = current - snapshot, exports only positive deltas.
   * After success, saves snapshot of full current counts.
   *
   * Stub: full implementation in Phase 3.
   */
  private async exportIncremental(scope: string): Promise<CsvExportResultDTO> {
    const activeGame = await this.settingsStore.get(SettingsKey.ActiveGame);
    assertGameType(activeGame, CsvChannel.ExportIncremental);

    // Fetch current stats
    const stats = await this.getStatsForScope(activeGame, scope);
    const currentData = this.statsToCsvData(stats);

    // Fetch last snapshot
    const snapshotRows = await this.repository.getSnapshot(activeGame, scope);
    const snapshotMap = new Map<string, number>();
    for (const row of snapshotRows) {
      snapshotMap.set(row.cardName, row.count);
    }

    // Compute delta: only cards with positive increments
    const deltaData: Record<string, number> = {};
    for (const [cardName, count] of Object.entries(currentData)) {
      const snapshotCount = snapshotMap.get(cardName) ?? 0;
      const delta = count - snapshotCount;
      if (delta > 0) {
        deltaData[cardName] = delta;
      }
    }

    if (Object.keys(deltaData).length === 0) {
      return { success: false, error: "No new cards since last export." };
    }

    const csvContent = jsonToCsv(deltaData);
    const exportedCount = Object.keys(deltaData).length;

    // Show save dialog and write file
    const result = await this.promptAndWriteCsv(
      csvContent,
      activeGame,
      scope,
      CsvExportType.Incremental,
    );

    if (!result.success || result.canceled) {
      return result;
    }

    // On success, run integrity checks and save snapshot of FULL current counts (not the delta)
    await this.saveCurrentSnapshot(activeGame, scope, currentData);

    return { ...result, exportedCount };
  }

  /**
   * Export cards for a specific session.
   * No snapshot is saved for session exports (session data is immutable).
   *
   * Stub: full implementation in Phase 4.
   */
  private async exportSession(sessionId: string): Promise<CsvExportResultDTO> {
    const sessionsService = SessionsService.getInstance();
    const session = await sessionsService.getSessionById(sessionId);

    if (!session) {
      return { success: false, error: "Session not found." };
    }

    // Build CSV data from session cards
    const csvData: Record<string, number> = {};
    for (const card of session.cards) {
      csvData[card.name] = card.count;
    }

    const csvContent = jsonToCsv(csvData);
    const exportedCount = Object.keys(csvData).length;

    const activeGame = await this.settingsStore.get(SettingsKey.ActiveGame);

    const result = await this.promptAndWriteCsv(
      csvContent,
      activeGame ?? "poe1",
      `session-${sessionId.slice(0, 8)}`,
      CsvExportType.Session,
    );

    if (!result.success || result.canceled) {
      return result;
    }

    return { ...result, exportedCount };
  }

  /**
   * Get metadata about the last snapshot for a given scope.
   * Also computes delta counts (new card types and total new drops) by
   * comparing the current live stats against the persisted snapshot.
   */
  private async getSnapshotMeta(scope: string) {
    const activeGame = await this.settingsStore.get(SettingsKey.ActiveGame);
    assertGameType(activeGame, CsvChannel.GetSnapshotMeta);

    const meta = await this.repository.getSnapshotMeta(activeGame, scope);

    if (!meta) {
      return {
        exists: false,
        exportedAt: null,
        totalCount: 0,
        newCardCount: 0,
        newTotalDrops: 0,
      };
    }

    // Compute delta between current stats and snapshot
    let newCardCount = 0;
    let newTotalDrops = 0;

    try {
      const stats = await this.getStatsForScope(activeGame, scope);
      const currentData = this.statsToCsvData(stats);

      const snapshotRows = await this.repository.getSnapshot(activeGame, scope);
      const snapshotMap = new Map<string, number>();
      for (const row of snapshotRows) {
        snapshotMap.set(row.cardName, row.count);
      }

      for (const [cardName, count] of Object.entries(currentData)) {
        const snapshotCount = snapshotMap.get(cardName) ?? 0;
        const delta = count - snapshotCount;
        if (delta > 0) {
          newCardCount++;
          newTotalDrops += delta;
        }
      }
    } catch (error) {
      console.error(
        "[CsvService] Failed to compute snapshot delta for meta:",
        error,
      );
      // Return meta without delta info — non-critical failure
    }

    return {
      exists: true,
      exportedAt: meta.exportedAt,
      totalCount: meta.totalCount,
      newCardCount,
      newTotalDrops,
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get stats for a given scope (all-time or league).
   */
  private async getStatsForScope(
    game: string,
    scope: string,
  ): Promise<SimpleDivinationCardStats> {
    if (scope === "all-time") {
      return this.dataStore.getAllTimeStats(game);
    }
    return this.dataStore.getLeagueStats(game, scope);
  }

  /**
   * Convert SimpleDivinationCardStats to a flat Record<string, number> for CSV.
   */
  private statsToCsvData(
    stats: SimpleDivinationCardStats,
  ): Record<string, number> {
    const csvData: Record<string, number> = {};
    for (const [cardName, entry] of Object.entries(stats.cards)) {
      csvData[cardName] = entry.count;
    }
    return csvData;
  }

  /**
   * Show a native save dialog and write the CSV content to the selected file.
   * Returns a CsvExportResultDTO with the outcome.
   */
  private async promptAndWriteCsv(
    csvContent: string,
    game: string,
    scope: string,
    exportType: CsvExportType,
  ): Promise<CsvExportResultDTO> {
    const allWindows = BrowserWindow.getAllWindows();
    const mainWindow = allWindows[0];

    if (!mainWindow) {
      throw new Error("Main window not available");
    }

    const dateSuffix = new Date().toISOString().split("T")[0];
    const typeSuffix = exportType === CsvExportType.All ? "" : `-${exportType}`;
    const scopeSuffix = scope === "all-time" ? "" : `-${scope}`;
    const fileName = `${game}-cards${scopeSuffix}${typeSuffix}-${dateSuffix}.csv`;
    const customExportPath = await this.settingsStore.get("csvExportPath");
    const exportDir =
      customExportPath ||
      path.join(app.getPath("desktop"), "soothsayer-exports");
    await fs.mkdir(exportDir, { recursive: true });
    const defaultPath = path.join(exportDir, fileName);

    const result = await dialog.showSaveDialog(mainWindow, {
      title: `Export ${game?.toUpperCase() ?? "POE"} Divination Cards`,
      defaultPath,
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true };
    }

    await fs.writeFile(result.filePath, csvContent, "utf-8");

    return { success: true };
  }

  /**
   * Save a snapshot of the current card counts for a given game and scope.
   * Runs integrity checks and persists the results alongside the snapshot.
   * Used after a successful full or incremental export.
   */
  private async saveCurrentSnapshot(
    game: string,
    scope: string,
    csvData: Record<string, number>,
  ): Promise<void> {
    const entries = Object.entries(csvData).map(([cardName, count]) => ({
      cardName,
      count,
    }));

    // Run integrity checks (silent — results are persisted, not shown to user)
    let integrityStatus: CsvIntegrityStatus | null = null;
    let integrityDetails: string | null = null;

    try {
      const result = await this.integrityChecker.runChecks(
        game,
        scope,
        csvData,
      );
      integrityStatus = result.status;
      integrityDetails = JSON.stringify(result.details);
    } catch (error) {
      // If integrity checks fail entirely, still save the snapshot
      console.error("[CsvService] Integrity check error:", error);
      integrityStatus = CsvIntegrityStatus.Warn;
      integrityDetails = JSON.stringify([
        {
          check: "integrityRunner",
          status: CsvIntegrityStatus.Warn,
          message: `Integrity checks failed to run: ${
            (error as Error).message
          }`,
        },
      ]);
    }

    await this.repository.saveSnapshot(
      game,
      scope,
      entries,
      integrityStatus,
      integrityDetails,
    );
  }
}

export { CsvService };
