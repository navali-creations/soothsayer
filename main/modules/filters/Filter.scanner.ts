import fs from "node:fs/promises";
import path from "node:path";

import { app } from "electron";

import type { FilterType } from "./Filter.dto";

// ─── Types ───────────────────────────────────────────────────────────────────

export type GameType = "poe1" | "poe2";

/**
 * Raw metadata extracted from a filter file on disk.
 * This is the result of a quick metadata-only scan (first ~50 lines).
 */
export interface ScannedFilterMetadata {
  filterType: FilterType;
  filePath: string;
  filterName: string;
  lastUpdate: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Maximum number of lines to read when extracting metadata from online filters.
 * Online filter headers are typically within the first 20-30 lines.
 */
const METADATA_SCAN_LINE_LIMIT = 50;

/**
 * Local filter file extension
 */
const LOCAL_FILTER_EXTENSION = ".filter";

/**
 * Subdirectory name for online filters within the PoE documents directory
 */
const ONLINE_FILTERS_SUBDIR = "OnlineFilters";

/**
 * Maps a game type to its `My Games` subdirectory name.
 */
const GAME_DIR_MAP: Record<GameType, string> = {
  poe1: "Path of Exile",
  poe2: "Path of Exile 2",
};

// ─── Scanner ─────────────────────────────────────────────────────────────────

/**
 * FilterScanner handles file system operations for discovering and reading
 * metadata from Path of Exile loot filter files.
 *
 * It supports two types of filters:
 * - **Local filters:** `.filter` files in the PoE documents directory.
 *   Metadata is derived from the filename and file modification time.
 * - **Online filters:** Files (no extension) in the `OnlineFilters/` subdirectory.
 *   Metadata is extracted from header lines (`#name:`, `#lastUpdate:`).
 *
 * The scanner is **game-aware** — callers pass a game type (`poe1` or `poe2`)
 * and only the corresponding directory is scanned.
 *
 * The scanner uses a lazy strategy: it only reads enough of each file to
 * extract metadata. Full parsing of filter content is deferred to `Filter.parser.ts`.
 */
export class FilterScanner {
  // ─── Directory Resolution ────────────────────────────────────────────

  /**
   * Get the filters directory for a specific game.
   *
   * - poe1: `C:\Users\{username}\Documents\My Games\Path of Exile\`
   * - poe2: `C:\Users\{username}\Documents\My Games\Path of Exile 2\`
   */
  getFiltersDirectory(game: GameType): string {
    const documentsPath = app.getPath("documents");
    return path.join(documentsPath, "My Games", GAME_DIR_MAP[game]);
  }

  /**
   * Get the online filters directory for a specific game.
   *
   * - poe1: `…\Path of Exile\OnlineFilters\`
   * - poe2: `…\Path of Exile 2\OnlineFilters\`
   */
  getOnlineFiltersDirectory(game: GameType): string {
    return path.join(this.getFiltersDirectory(game), ONLINE_FILTERS_SUBDIR);
  }

  // ─── Scanning ────────────────────────────────────────────────────────

  /**
   * Scan both local and online filter directories for the given game.
   * Extracts metadata only (lazy strategy — no full content parsing).
   *
   * @param game - Which game's directories to scan (`"poe1"` or `"poe2"`)
   * @returns All discovered filters, or empty array if directories don't exist.
   */
  async scanAll(game: GameType): Promise<ScannedFilterMetadata[]> {
    const [localFilters, onlineFilters] = await Promise.all([
      this.scanLocalFilters(game),
      this.scanOnlineFilters(game),
    ]);

    return [...localFilters, ...onlineFilters];
  }

  /**
   * Scan the local filters directory for `.filter` files.
   * Returns metadata extracted from filename and file mtime.
   */
  async scanLocalFilters(game: GameType): Promise<ScannedFilterMetadata[]> {
    const dir = this.getFiltersDirectory(game);

    if (!(await this.directoryExists(dir))) {
      console.log(
        `[FilterScanner] Local filters directory does not exist: ${dir}`,
      );
      return [];
    }

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      // Filter to only `.filter` files (not directories)
      const filterFiles = entries.filter(
        (entry) =>
          entry.isFile() &&
          entry.name.toLowerCase().endsWith(LOCAL_FILTER_EXTENSION),
      );

      // Extract metadata from each file concurrently
      const results = await Promise.all(
        filterFiles.map((entry) =>
          this.extractLocalMetadata(path.join(dir, entry.name)),
        ),
      );

      // Filter out any nulls (files that couldn't be read)
      return results.filter(
        (result): result is ScannedFilterMetadata => result !== null,
      );
    } catch (error) {
      console.error(
        `[FilterScanner] Failed to scan local filters in ${dir}:`,
        error,
      );
      return [];
    }
  }

  /**
   * Scan the online filters directory for filter files (no extension).
   * Returns metadata extracted from file header lines.
   */
  async scanOnlineFilters(game: GameType): Promise<ScannedFilterMetadata[]> {
    const dir = this.getOnlineFiltersDirectory(game);

    if (!(await this.directoryExists(dir))) {
      console.log(
        `[FilterScanner] Online filters directory does not exist: ${dir}`,
      );
      return [];
    }

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      // Online filters are files without extensions (or at least not .filter)
      const filterFiles = entries.filter(
        (entry) => entry.isFile() && !entry.name.includes("."),
      );

      // Extract metadata from each file concurrently
      const results = await Promise.all(
        filterFiles.map((entry) =>
          this.extractOnlineMetadata(path.join(dir, entry.name)),
        ),
      );

      // Filter out any nulls (files that couldn't be read)
      return results.filter(
        (result): result is ScannedFilterMetadata => result !== null,
      );
    } catch (error) {
      console.error(
        `[FilterScanner] Failed to scan online filters in ${dir}:`,
        error,
      );
      return [];
    }
  }

  // ─── Metadata Extraction ─────────────────────────────────────────────

  /**
   * Extract metadata from a local filter file.
   *
   * - Name: derived from filename without `.filter` extension
   * - Last update: file modification time (mtime)
   */
  async extractLocalMetadata(
    filePath: string,
  ): Promise<ScannedFilterMetadata | null> {
    try {
      const stats = await fs.stat(filePath);
      // Use path.win32.basename because it handles both / and \ separators,
      // unlike path.posix.basename which only handles /. This ensures correct
      // behavior on both Windows and Linux.
      const fileName = path.win32.basename(filePath);
      const filterName = fileName.replace(
        new RegExp(`\\${LOCAL_FILTER_EXTENSION}$`, "i"),
        "",
      );

      return {
        filterType: "local",
        filePath,
        filterName,
        lastUpdate: stats.mtime.toISOString(),
      };
    } catch (error) {
      console.warn(
        `[FilterScanner] Failed to read local filter metadata: ${filePath}`,
        error,
      );
      return null;
    }
  }

  /**
   * Extract metadata from an online filter file by reading its header lines.
   *
   * Online filters have header lines like:
   * ```
   * #Online Item Filter
   * #name:MyFilterName
   * ...
   * #lastUpdate:2025-12-25T12:30:51Z
   * ```
   *
   * Only the first METADATA_SCAN_LINE_LIMIT lines are read (lazy strategy).
   */
  async extractOnlineMetadata(
    filePath: string,
  ): Promise<ScannedFilterMetadata | null> {
    try {
      const headerLines = await this.readFirstLines(
        filePath,
        METADATA_SCAN_LINE_LIMIT,
      );

      const parsed = FilterScanner.parseOnlineHeader(headerLines);

      // If we couldn't find a name, use the filename as fallback.
      // Use path.win32.basename because it handles both / and \ separators.
      const fileName = path.win32.basename(filePath);
      const filterName = parsed.name || fileName;

      return {
        filterType: "online",
        filePath,
        filterName,
        lastUpdate: parsed.lastUpdate,
      };
    } catch (error) {
      console.warn(
        `[FilterScanner] Failed to read online filter metadata: ${filePath}`,
        error,
      );
      return null;
    }
  }

  // ─── Header Parsing (static for testability) ────────────────────────

  /**
   * Parse online filter header lines to extract `#name:` and `#lastUpdate:` values.
   *
   * @param lines - Array of header lines from the filter file
   * @returns Object with name and lastUpdate (both may be null if not found)
   */
  static parseOnlineHeader(lines: string[]): {
    name: string | null;
    lastUpdate: string | null;
  } {
    let name: string | null = null;
    let lastUpdate: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Match #name: (case-insensitive)
      if (name === null) {
        const nameMatch = trimmed.match(/^#name:\s*(.+)$/i);
        if (nameMatch) {
          name = nameMatch[1].trim();
        }
      }

      // Match #lastUpdate: (case-insensitive)
      if (lastUpdate === null) {
        const lastUpdateMatch = trimmed.match(/^#lastUpdate:\s*(.+)$/i);
        if (lastUpdateMatch) {
          lastUpdate = lastUpdateMatch[1].trim();
        }
      }

      // Stop early if we've found both
      if (name !== null && lastUpdate !== null) {
        break;
      }
    }

    return { name, lastUpdate };
  }

  // ─── File System Helpers ─────────────────────────────────────────────

  /**
   * Read the first N lines of a file without loading the entire file.
   * Uses a streaming approach for efficiency with large filter files.
   */
  async readFirstLines(filePath: string, maxLines: number): Promise<string[]> {
    // For metadata extraction, reading a small buffer is sufficient.
    // Online filter headers are typically within the first few KB.
    const BUFFER_SIZE = 8192; // 8KB should be more than enough for header

    const fileHandle = await fs.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(BUFFER_SIZE);
      const { bytesRead } = await fileHandle.read(buffer, 0, BUFFER_SIZE, 0);
      const content = buffer.subarray(0, bytesRead).toString("utf-8");

      const lines = content.split(/\r?\n/);
      return lines.slice(0, maxLines);
    } finally {
      await fileHandle.close();
    }
  }

  /**
   * Check if a directory exists and is accessible
   */
  async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Generate a deterministic ID for a filter based on its file path.
   * Uses a simple hash to create a stable identifier.
   */
  static generateFilterId(filePath: string): string {
    // Normalize path separators for consistency across platforms
    const normalized = filePath.replace(/\\/g, "/").toLowerCase();

    // Simple hash function (FNV-1a inspired)
    let hash = 2166136261;
    for (let i = 0; i < normalized.length; i++) {
      hash ^= normalized.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }

    // Convert to unsigned 32-bit hex string with a prefix
    const hexHash = (hash >>> 0).toString(16).padStart(8, "0");
    return `filter_${hexHash}`;
  }
}
