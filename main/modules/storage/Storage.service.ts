import fs from "node:fs";
import path from "node:path";

import { app, ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";

import { StorageChannel } from "./Storage.channels";
import type {
  AppDataBreakdownItem,
  DeleteLeagueDataResult,
  DiskSpaceCheck,
  LeagueStorageUsage,
  StorageInfo,
} from "./Storage.types";

// Average row sizes in bytes (estimated from schema field sizes)
const AVG_SESSION_ROW_BYTES = 200;
const AVG_SESSION_CARD_ROW_BYTES = 120;
const AVG_SESSION_SUMMARY_ROW_BYTES = 300;
const AVG_SNAPSHOT_ROW_BYTES = 150;
const AVG_SNAPSHOT_CARD_PRICE_ROW_BYTES = 100;
const AVG_RARITY_ROW_BYTES = 80;
const AVG_PL_WEIGHT_ROW_BYTES = 120;
const AVG_PL_CACHE_META_ROW_BYTES = 100;
const AVG_POE_LEAGUE_CACHE_ROW_BYTES = 150;

// Low disk space threshold: 1 GB
const LOW_DISK_SPACE_THRESHOLD_BYTES = 1024 * 1024 * 1024;

class StorageService {
  private static _instance: StorageService;
  private dbService: DatabaseService;

  static getInstance(): StorageService {
    if (!StorageService._instance) {
      StorageService._instance = new StorageService();
    }
    return StorageService._instance;
  }

  private constructor() {
    this.dbService = DatabaseService.getInstance();
    this.setupHandlers();
  }

  // ============================================================================
  // IPC Handlers
  // ============================================================================

  private setupHandlers(): void {
    ipcMain.handle(StorageChannel.GetInfo, async (): Promise<StorageInfo> => {
      return this.getStorageInfo();
    });

    ipcMain.handle(
      StorageChannel.GetLeagueUsage,
      async (): Promise<LeagueStorageUsage[]> => {
        return this.getLeagueStorageUsage();
      },
    );

    ipcMain.handle(
      StorageChannel.DeleteLeagueData,
      async (_event, leagueId: string): Promise<DeleteLeagueDataResult> => {
        return this.deleteLeagueData(leagueId);
      },
    );

    ipcMain.handle(
      StorageChannel.CheckDiskSpace,
      async (): Promise<DiskSpaceCheck> => {
        return this.checkDiskSpace();
      },
    );
  }

  // ============================================================================
  // Storage Info
  // ============================================================================

  private async getStorageInfo(): Promise<StorageInfo> {
    const appDataPath = app.getPath("userData");
    const dbPath = this.dbService.getPath();
    const dbBaseName = path.basename(dbPath);

    const [breakdown, dbSizeBytes, appDiskStats, dbDiskStats] =
      await Promise.all([
        this.getDirectoryBreakdown(appDataPath, dbBaseName),
        this.getFileSize(dbPath),
        this.getDiskStats(appDataPath),
        this.getDiskStats(path.dirname(dbPath)),
      ]);

    // Total app data is the sum of all breakdown categories
    const appDataSizeBytes = breakdown.reduce(
      (sum, item) => sum + item.sizeBytes,
      0,
    );

    return {
      appDataPath,
      appDataSizeBytes,
      dbPath,
      dbSizeBytes,
      diskTotalBytes: appDiskStats.total,
      diskFreeBytes: appDiskStats.free,
      dbDiskTotalBytes: dbDiskStats.total,
      dbDiskFreeBytes: dbDiskStats.free,
      breakdown,
    };
  }

  // ============================================================================
  // App Data Breakdown
  // ============================================================================

  /**
   * Walk the userData directory and categorize every file into a breakdown.
   */
  private async getDirectoryBreakdown(
    dirPath: string,
    dbBaseName: string,
  ): Promise<AppDataBreakdownItem[]> {
    const buckets: Record<
      AppDataBreakdownItem["category"],
      { sizeBytes: number; fileCount: number }
    > = {
      database: { sizeBytes: 0, fileCount: 0 },
      cache: { sizeBytes: 0, fileCount: 0 },
      other: { sizeBytes: 0, fileCount: 0 },
    };

    this.walkAndCategorize(dirPath, buckets, dbBaseName);

    const labelMap: Record<AppDataBreakdownItem["category"], string> = {
      database: "Database & session data",
      cache: "Temporary files",
      other: "Logs, config & other files",
    };

    return (
      Object.entries(buckets) as Array<
        [
          AppDataBreakdownItem["category"],
          { sizeBytes: number; fileCount: number },
        ]
      >
    )
      .filter(([, v]) => v.sizeBytes > 0 || v.fileCount > 0)
      .map(([category, data]) => ({
        label: labelMap[category],
        category,
        sizeBytes: data.sizeBytes,
        fileCount: data.fileCount,
      }))
      .sort((a, b) => b.sizeBytes - a.sizeBytes);
  }

  /**
   * Recursively walk a directory and tally file sizes into categorized buckets.
   */
  private walkAndCategorize(
    dirPath: string,
    buckets: Record<
      AppDataBreakdownItem["category"],
      { sizeBytes: number; fileCount: number }
    >,
    dbBaseName: string,
  ): void {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        try {
          if (entry.isDirectory()) {
            this.walkAndCategorize(fullPath, buckets, dbBaseName);
          } else if (entry.isFile()) {
            const stat = fs.statSync(fullPath);
            const category = this.categorizeFile(
              entry.name,
              dirPath,
              dbBaseName,
            );
            buckets[category].sizeBytes += stat.size;
            buckets[category].fileCount += 1;
          }
        } catch {
          // Skip inaccessible files
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  }

  /**
   * Determine which category a file belongs to based on its name,
   * extension, and parent directory.
   */
  private categorizeFile(
    fileName: string,
    parentDir: string,
    dbBaseName: string,
  ): AppDataBreakdownItem["category"] {
    const lowerName = fileName.toLowerCase();
    const lowerParent = parentDir.toLowerCase();

    // Database files (includes WAL, SHM, session/auth data)
    if (lowerName === dbBaseName.toLowerCase()) {
      return "database";
    }
    if (
      lowerName.startsWith(dbBaseName.toLowerCase()) &&
      (lowerName.endsWith("-wal") || lowerName.endsWith("-shm"))
    ) {
      return "database";
    }
    if (lowerName.endsWith(".db") || lowerName.endsWith(".sqlite")) {
      return "database";
    }
    if (
      lowerName.includes("session") ||
      lowerName.includes("cookie") ||
      lowerName.endsWith(".enc") ||
      lowerParent.includes("session storage") ||
      lowerParent.includes("session_storage")
    ) {
      return "database";
    }

    // Cache directories (Electron/Chromium)
    if (
      lowerParent.includes("cache") ||
      lowerParent.includes("gpucache") ||
      lowerParent.includes("gpu cache") ||
      lowerParent.includes("code cache") ||
      lowerParent.includes("code_cache") ||
      lowerParent.includes("shadercache") ||
      lowerParent.includes("shader cache") ||
      lowerParent.includes("service worker") ||
      lowerParent.includes("blob_storage") ||
      lowerParent.includes("webrtc") ||
      lowerParent.includes("indexeddb")
    ) {
      return "cache";
    }

    // Everything else: logs, config, preferences, etc.
    return "other";
  }

  // ============================================================================
  // League Storage Usage
  // ============================================================================

  private async getLeagueStorageUsage(): Promise<LeagueStorageUsage[]> {
    const db = this.dbService.getDb();

    const rows = db
      .prepare(
        `
        SELECT
          l.id           AS league_id,
          l.name         AS league_name,
          l.game         AS game,
          COALESCE(s.session_count, 0)         AS session_count,
          COALESCE(s.session_card_count, 0)    AS session_card_count,
          COALESCE(s.summary_count, 0)         AS summary_count,
          COALESCE(snap.snapshot_count, 0)     AS snapshot_count,
          COALESCE(snap.card_price_count, 0)   AS card_price_count,
          COALESCE(r.rarity_count, 0)          AS rarity_count,
          COALESCE(pl.pl_weight_count, 0)      AS pl_weight_count,
          COALESCE(plm.pl_meta_count, 0)       AS pl_meta_count,
          COALESCE(plc.poe_league_cache_count, 0) AS poe_league_cache_count,
          COALESCE(active.active_count, 0)     AS active_count
        FROM leagues l

        LEFT JOIN (
          SELECT
            league_id,
            COUNT(*)                                            AS session_count,
            COALESCE(SUM(sc_sub.card_count), 0)                 AS session_card_count,
            COALESCE(SUM(sm_sub.has_summary), 0)                AS summary_count
          FROM sessions
          LEFT JOIN (
            SELECT session_id, COUNT(*) AS card_count
            FROM session_cards
            GROUP BY session_id
          ) sc_sub ON sc_sub.session_id = sessions.id
          LEFT JOIN (
            SELECT session_id, 1 AS has_summary
            FROM session_summaries
          ) sm_sub ON sm_sub.session_id = sessions.id
          GROUP BY league_id
        ) s ON s.league_id = l.id

        LEFT JOIN (
          SELECT
            league_id,
            COUNT(*)                                AS snapshot_count,
            COALESCE(SUM(scp_sub.price_count), 0)   AS card_price_count
          FROM snapshots
          LEFT JOIN (
            SELECT snapshot_id, COUNT(*) AS price_count
            FROM snapshot_card_prices
            GROUP BY snapshot_id
          ) scp_sub ON scp_sub.snapshot_id = snapshots.id
          GROUP BY league_id
        ) snap ON snap.league_id = l.id

        LEFT JOIN (
          SELECT game, league, COUNT(*) AS rarity_count
          FROM divination_card_rarities
          GROUP BY game, league
        ) r ON r.game = l.game AND r.league = l.name

        LEFT JOIN (
          SELECT game, league, COUNT(*) AS pl_weight_count
          FROM prohibited_library_card_weights
          GROUP BY game, league
        ) pl ON pl.game = l.game AND pl.league = l.name

        LEFT JOIN (
          SELECT game, league, 1 AS pl_meta_count
          FROM prohibited_library_cache_metadata
        ) plm ON plm.game = l.game AND plm.league = l.name

        LEFT JOIN (
          SELECT game, league_id, COUNT(*) AS poe_league_cache_count
          FROM poe_leagues_cache
          GROUP BY game, league_id
        ) plc ON plc.game = l.game AND plc.league_id = l.id

        LEFT JOIN (
          SELECT league_id, COUNT(*) AS active_count
          FROM sessions
          WHERE is_active = 1
          GROUP BY league_id
        ) active ON active.league_id = l.id

        ORDER BY s.session_count DESC, l.name ASC
      `,
      )
      .all() as Array<{
      league_id: string;
      league_name: string;
      game: "poe1" | "poe2";
      session_count: number;
      session_card_count: number;
      summary_count: number;
      snapshot_count: number;
      card_price_count: number;
      rarity_count: number;
      pl_weight_count: number;
      pl_meta_count: number;
      poe_league_cache_count: number;
      active_count: number;
    }>;

    return rows.map((row) => {
      const estimatedSizeBytes =
        row.session_count * AVG_SESSION_ROW_BYTES +
        row.session_card_count * AVG_SESSION_CARD_ROW_BYTES +
        row.summary_count * AVG_SESSION_SUMMARY_ROW_BYTES +
        row.snapshot_count * AVG_SNAPSHOT_ROW_BYTES +
        row.card_price_count * AVG_SNAPSHOT_CARD_PRICE_ROW_BYTES +
        row.rarity_count * AVG_RARITY_ROW_BYTES +
        row.pl_weight_count * AVG_PL_WEIGHT_ROW_BYTES +
        row.pl_meta_count * AVG_PL_CACHE_META_ROW_BYTES +
        row.poe_league_cache_count * AVG_POE_LEAGUE_CACHE_ROW_BYTES;

      return {
        leagueId: row.league_id,
        leagueName: row.league_name,
        game: row.game,
        sessionCount: row.session_count,
        snapshotCount: row.snapshot_count,
        estimatedSizeBytes,
        hasActiveSession: row.active_count > 0,
      };
    });
  }

  // ============================================================================
  // Delete League Data
  // ============================================================================

  private async deleteLeagueData(
    leagueId: string,
  ): Promise<DeleteLeagueDataResult> {
    try {
      if (!leagueId || typeof leagueId !== "string") {
        return {
          success: false,
          freedBytes: 0,
          error: "Invalid league ID",
        };
      }

      const db = this.dbService.getDb();

      // Safety net: check for active sessions in this league
      const activeSession = db
        .prepare(
          "SELECT id FROM sessions WHERE league_id = ? AND is_active = 1 LIMIT 1",
        )
        .get(leagueId) as { id: string } | undefined;

      if (activeSession) {
        return {
          success: false,
          freedBytes: 0,
          error:
            "Cannot delete data for a league with an active session. Stop the session first.",
        };
      }

      // Get the league info for name-based table cleanup
      const league = db
        .prepare("SELECT id, name, game FROM leagues WHERE id = ?")
        .get(leagueId) as
        | { id: string; name: string; game: "poe1" | "poe2" }
        | undefined;

      if (!league) {
        return {
          success: false,
          freedBytes: 0,
          error: "League not found",
        };
      }

      // Measure DB size before deletion
      const dbPath = this.dbService.getPath();
      const sizeBefore = this.getFileSizeSync(dbPath);

      // Cascade delete in a transaction
      const deleteTransaction = db.transaction(() => {
        // 1. snapshot_card_prices (via snapshot_id JOIN snapshots WHERE league_id)
        db.prepare(
          `
          DELETE FROM snapshot_card_prices
          WHERE snapshot_id IN (
            SELECT id FROM snapshots WHERE league_id = ?
          )
        `,
        ).run(leagueId);

        // 2. session_cards (via session_id JOIN sessions WHERE league_id)
        db.prepare(
          `
          DELETE FROM session_cards
          WHERE session_id IN (
            SELECT id FROM sessions WHERE league_id = ?
          )
        `,
        ).run(leagueId);

        // 3. session_summaries (via session_id JOIN sessions WHERE league_id)
        db.prepare(
          `
          DELETE FROM session_summaries
          WHERE session_id IN (
            SELECT id FROM sessions WHERE league_id = ?
          )
        `,
        ).run(leagueId);

        // 4. sessions WHERE league_id
        db.prepare("DELETE FROM sessions WHERE league_id = ?").run(leagueId);

        // 5. snapshots WHERE league_id
        db.prepare("DELETE FROM snapshots WHERE league_id = ?").run(leagueId);

        // 6. divination_card_rarities WHERE game AND league = league_name
        db.prepare(
          "DELETE FROM divination_card_rarities WHERE game = ? AND league = ?",
        ).run(league.game, league.name);

        // 7. prohibited_library_card_weights WHERE game AND league = league_name
        db.prepare(
          "DELETE FROM prohibited_library_card_weights WHERE game = ? AND league = ?",
        ).run(league.game, league.name);

        // 8. prohibited_library_cache_metadata WHERE game AND league = league_name
        db.prepare(
          "DELETE FROM prohibited_library_cache_metadata WHERE game = ? AND league = ?",
        ).run(league.game, league.name);

        // 9. poe_leagues_cache WHERE game AND league_id
        db.prepare(
          "DELETE FROM poe_leagues_cache WHERE game = ? AND league_id = ?",
        ).run(league.game, leagueId);

        // 10. Delete the league itself
        db.prepare("DELETE FROM leagues WHERE id = ?").run(leagueId);
      });

      deleteTransaction();

      // VACUUM to reclaim space in the SQLite file
      db.exec("VACUUM");

      // Measure DB size after VACUUM
      const sizeAfter = this.getFileSizeSync(dbPath);
      const freedBytes = Math.max(0, sizeBefore - sizeAfter);

      console.log(
        `[Storage] Deleted data for league "${league.name}" (${league.game}). ` +
          `Freed ~${(freedBytes / 1024 / 1024).toFixed(2)} MB`,
      );

      return { success: true, freedBytes };
    } catch (error) {
      console.error("[Storage] Failed to delete league data:", error);
      return {
        success: false,
        freedBytes: 0,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  // ============================================================================
  // Disk Space Check
  // ============================================================================

  private async checkDiskSpace(): Promise<DiskSpaceCheck> {
    const appDataPath = app.getPath("userData");
    const stats = await this.getDiskStats(appDataPath);

    return {
      diskFreeBytes: stats.free,
      isLow: stats.free < LOW_DISK_SPACE_THRESHOLD_BYTES,
    };
  }

  // ============================================================================
  // File System Helpers
  // ============================================================================

  /**
   * Get the size of a single file in bytes.
   */
  private async getFileSize(filePath: string): Promise<number> {
    try {
      const stat = fs.statSync(filePath);
      return stat.size;
    } catch {
      return 0;
    }
  }

  /**
   * Get the size of a single file synchronously.
   */
  private getFileSizeSync(filePath: string): number {
    try {
      const stat = fs.statSync(filePath);
      return stat.size;
    } catch {
      return 0;
    }
  }

  /**
   * Get total and free disk space for the drive containing the given path.
   * Uses Node.js `fs.statfsSync`.
   */
  private async getDiskStats(
    targetPath: string,
  ): Promise<{ total: number; free: number }> {
    try {
      const stats = fs.statfsSync(targetPath);
      return {
        total: stats.bsize * stats.blocks,
        free: stats.bsize * stats.bavail,
      };
    } catch {
      return { total: 0, free: 0 };
    }
  }
}

export { StorageService };
