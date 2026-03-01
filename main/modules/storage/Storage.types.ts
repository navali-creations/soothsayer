/**
 * Storage module types
 * Shared between main process and renderer via IPC
 */

/** Categorized breakdown of files in the app data directory */
export interface AppDataBreakdownItem {
  /** Human-readable category label */
  label: string;
  /** Category key for identification */
  category: "database" | "cache" | "other";
  /** Total size in bytes for this category */
  sizeBytes: number;
  /** Number of files in this category */
  fileCount: number;
}

/** Disk and app storage metrics */
export interface StorageInfo {
  /** Absolute path to the app's userData directory */
  appDataPath: string;
  /** Total size of the userData directory in bytes (includes DB) */
  appDataSizeBytes: number;
  /** Absolute path to the SQLite database file */
  dbPath: string;
  /** Size of the database file in bytes */
  dbSizeBytes: number;
  /** Total disk space on the drive containing appData (bytes) */
  diskTotalBytes: number;
  /** Free disk space on the drive containing appData (bytes) */
  diskFreeBytes: number;
  /** Total disk space on the drive containing the database (bytes) */
  dbDiskTotalBytes: number;
  /** Free disk space on the drive containing the database (bytes) */
  dbDiskFreeBytes: number;
  /** Categorized breakdown of what's inside the app data directory */
  breakdown: AppDataBreakdownItem[];
}

/** Per-league storage usage estimate */
export interface LeagueStorageUsage {
  /** League ID from the `leagues` table */
  leagueId: string;
  /** Human-readable league name */
  leagueName: string;
  /** Game type */
  game: "poe1" | "poe2";
  /** Number of sessions in this league */
  sessionCount: number;
  /** Number of snapshots in this league */
  snapshotCount: number;
  /** Estimated total size in bytes (derived from row counts) */
  estimatedSizeBytes: number;
  /** Whether this league has an active session (delete should be blocked) */
  hasActiveSession: boolean;
}

/** Result of a disk space check */
export interface DiskSpaceCheck {
  /** Free disk space on the app data drive (bytes) */
  diskFreeBytes: number;
  /** True if free space is below the warning threshold */
  isLow: boolean;
}

/** Result of deleting league data */
export interface DeleteLeagueDataResult {
  /** Whether the deletion succeeded */
  success: boolean;
  /** Approximate bytes freed (DB size difference after VACUUM) */
  freedBytes: number;
  /** Error message if the deletion failed */
  error?: string;
}
