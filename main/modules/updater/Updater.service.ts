import { readFileSync } from "node:fs";
import { join } from "node:path";

import { app, autoUpdater, type BrowserWindow, ipcMain, shell } from "electron";

import type { ChangelogEntry, ChangelogRelease } from "./Updater.api";
import { UpdaterChannel } from "./Updater.channels";

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  name: string;
  body: string;
  published_at: string;
}

interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string | null;
  /** When true, "install" opens the releases page instead of restarting (Linux). */
  manualDownload: boolean;
}

interface DownloadProgress {
  percent: number;
  transferredBytes: number;
  totalBytes: number;
}

type UpdateStatus = "idle" | "downloading" | "ready" | "error";

const GITHUB_OWNER = "navali-creations";
const GITHUB_REPO = "soothsayer";
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const INITIAL_CHECK_DELAY_MS = 10_000; // 10 seconds after startup

class UpdaterService {
  private static _instance: UpdaterService;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private mainWindow: BrowserWindow | null = null;
  private lastUpdateInfo: UpdateInfo | null = null;
  private updateStatus: UpdateStatus = "idle";
  private updateDownloaded = false;
  private initialized = false;
  private isLinux = process.platform === "linux";

  static getInstance(): UpdaterService {
    if (!UpdaterService._instance) {
      UpdaterService._instance = new UpdaterService();
    }
    return UpdaterService._instance;
  }

  /**
   * Initialize the updater: configure autoUpdater feed (win32/darwin) or
   * GitHub API polling (linux), wire events, register IPC handlers, and
   * start periodic checks.
   *
   * On Windows, Electron's autoUpdater is powered by Squirrel.Windows which
   * handles atomic updates, rollback, shortcut management, and delta updates.
   * On macOS it uses Squirrel.Mac.
   * On Linux, autoUpdater is not supported — we poll the GitHub API for new
   * releases and direct the user to the releases page to download manually.
   */
  public initialize(mainWindow: BrowserWindow): void {
    if (this.initialized) return;
    this.initialized = true;
    this.mainWindow = mainWindow;

    if (!app.isPackaged) {
      console.log("[Updater] Skipping auto-update setup — app is not packaged");
      this.registerIpcHandlers();
      return;
    }

    if (this.isLinux) {
      // Linux: use GitHub API polling (no autoUpdater support)
      console.log("[Updater] Linux detected — using GitHub API version check");
      this.registerIpcHandlers();
      this.startPeriodicChecks();
      return;
    }

    if (!["win32", "darwin"].includes(process.platform)) {
      console.log(
        `[Updater] autoUpdater does not support platform '${process.platform}'`,
      );
      this.registerIpcHandlers();
      return;
    }

    // Configure the Squirrel update feed.
    // update.electronjs.org is the free Electron update service that proxies
    // GitHub Releases in the format Squirrel expects (RELEASES file for
    // Windows, JSON for macOS).
    const feedURL = `https://update.electronjs.org/${GITHUB_OWNER}/${GITHUB_REPO}/${
      process.platform
    }-${process.arch}/${app.getVersion()}`;

    console.log(`[Updater] Setting feed URL: ${feedURL}`);
    autoUpdater.setFeedURL({ url: feedURL });

    this.wireAutoUpdaterEvents();
    this.registerIpcHandlers();
    this.startPeriodicChecks();
  }

  /**
   * Clean up interval on shutdown.
   */
  public destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // ─── Periodic checks ──────────────────────────────────────────────────

  private startPeriodicChecks(): void {
    // Initial check after a short delay so we don't block startup
    setTimeout(() => {
      this.checkForUpdates();
    }, INITIAL_CHECK_DELAY_MS);

    // Periodic checks
    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, CHECK_INTERVAL_MS);
  }

  // ─── autoUpdater event wiring (win32/darwin only) ─────────────────────

  private wireAutoUpdaterEvents(): void {
    autoUpdater.on("checking-for-update", () => {
      console.log("[Updater] Checking for update...");
    });

    autoUpdater.on("update-available", () => {
      console.log("[Updater] Update available — downloading...");
      this.updateStatus = "downloading";

      // We don't get granular download progress from Squirrel, so we send an
      // indeterminate progress (percent = -1) to let the UI show a spinner or
      // indeterminate bar.
      this.sendProgress({ percent: -1, transferredBytes: 0, totalBytes: 0 });
    });

    autoUpdater.on("update-not-available", () => {
      console.log("[Updater] No update available.");
      this.updateStatus = "idle";
    });

    autoUpdater.on(
      "update-downloaded",
      (_event, releaseNotes, releaseName, _releaseDate, updateURL) => {
        console.log(`[Updater] Update downloaded: ${releaseName}`);

        this.updateDownloaded = true;
        this.updateStatus = "ready";

        // Build an UpdateInfo from whatever autoUpdater gives us
        const latestVersion = this.parseVersionFromName(releaseName);

        const info: UpdateInfo = {
          updateAvailable: true,
          currentVersion: app.getVersion(),
          latestVersion,
          releaseUrl:
            updateURL ||
            `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
          releaseName: releaseName || `v${latestVersion}`,
          releaseNotes: releaseNotes || "",
          publishedAt: new Date().toISOString(),
          downloadUrl: null, // already downloaded
          manualDownload: false,
        };

        this.lastUpdateInfo = info;

        // Notify the renderer so the download-icon indicator appears
        this.mainWindow?.webContents.send(
          UpdaterChannel.OnUpdateAvailable,
          info,
        );

        // Also send progress = 100% so any progress UI completes
        this.sendProgress({ percent: 100, transferredBytes: 0, totalBytes: 0 });
      },
    );

    autoUpdater.on("error", (err) => {
      console.error("[Updater] Error:", err.message);
      this.updateStatus = "error";

      // Don't crash the app — just log it. The user can retry via the UI.
    });
  }

  // ─── IPC handlers ─────────────────────────────────────────────────────

  private registerIpcHandlers(): void {
    ipcMain.handle(UpdaterChannel.CheckForUpdates, async () => {
      return this.checkForUpdates();
    });

    ipcMain.handle(UpdaterChannel.GetUpdateInfo, async () => {
      return this.lastUpdateInfo;
    });

    // DownloadUpdate is a no-op with Squirrel — download happens automatically
    // after checkForUpdates finds an update.  On Linux this is also a no-op
    // since we don't download anything.  We keep the handler so the renderer
    // API doesn't break.
    ipcMain.handle(UpdaterChannel.DownloadUpdate, async () => {
      if (this.isLinux || this.updateDownloaded) {
        return { success: true };
      }
      // If an update is being downloaded, just acknowledge
      if (this.updateStatus === "downloading") {
        return { success: true };
      }
      // Otherwise trigger a check which will auto-download if available
      this.checkForUpdates();
      return { success: true };
    });

    ipcMain.handle(UpdaterChannel.InstallUpdate, async () => {
      return this.installUpdate();
    });

    // Fetch the latest GitHub release (for "What's New" modal)
    ipcMain.handle(UpdaterChannel.GetLatestRelease, async () => {
      try {
        const release = await this.fetchLatestRelease();
        if (!release) return null;

        const body = release.body || "";
        const parsed = this.parseReleaseBody(body);

        return {
          version: release.tag_name.replace(/^v/, ""),
          name: release.name || release.tag_name,
          body,
          publishedAt: release.published_at,
          url: release.html_url,
          changeType: parsed.changeType,
          entries: parsed.entries,
        };
      } catch (error) {
        console.error("[Updater] Failed to fetch latest release:", error);
        return null;
      }
    });

    // Read and parse CHANGELOG.md from disk (for Changelog page)
    ipcMain.handle(UpdaterChannel.GetChangelog, async () => {
      try {
        const changelogPath = app.isPackaged
          ? join(process.resourcesPath, "CHANGELOG.md")
          : join(app.getAppPath(), "CHANGELOG.md");

        const content = readFileSync(changelogPath, "utf-8");
        const releases = this.parseChangelog(content);
        return { success: true, releases };
      } catch (error) {
        console.error("[Updater] Failed to read CHANGELOG.md:", error);
        return {
          success: false,
          releases: [],
          error: (error as Error).message,
        };
      }
    });
  }

  // ─── Public methods ───────────────────────────────────────────────────

  /**
   * Trigger an update check.
   *
   * - win32/darwin: calls autoUpdater.checkForUpdates() which auto-downloads
   *   if an update is found.
   * - linux: fetches the GitHub API to compare versions and notifies the
   *   renderer if a newer release exists.
   */
  public checkForUpdates(): UpdateInfo | null {
    if (!app.isPackaged) {
      console.log("[Updater] Skipping check — not packaged");
      return null;
    }

    if (this.isLinux) {
      this.checkForUpdatesViaGitHub();
      return this.lastUpdateInfo;
    }

    if (!["win32", "darwin"].includes(process.platform)) {
      return null;
    }

    try {
      autoUpdater.checkForUpdates();
    } catch (err) {
      console.error("[Updater] checkForUpdates failed:", err);
    }

    return this.lastUpdateInfo;
  }

  /**
   * Apply the downloaded update.
   *
   * - win32/darwin: calls autoUpdater.quitAndInstall() which quits the app,
   *   lets Squirrel swap files atomically, and relaunches.
   * - linux: opens the GitHub Releases page in the default browser so the
   *   user can download the new .deb/.rpm manually.
   */
  public installUpdate(): { success: boolean; error?: string } {
    if (this.isLinux) {
      return this.openReleasePage();
    }

    if (!this.updateDownloaded) {
      return { success: false, error: "No update has been downloaded yet" };
    }

    try {
      console.log("[Updater] Quitting and installing update...");
      // autoUpdater.quitAndInstall() will:
      // 1. Quit the running app
      // 2. Squirrel applies the update (atomic file swap)
      // 3. Relaunch the new version
      autoUpdater.quitAndInstall();
      return { success: true };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown install error";
      console.error("[Updater] Install failed:", message);
      return { success: false, error: message };
    }
  }

  // ─── Linux: GitHub API version check ──────────────────────────────────

  /**
   * Fetch the latest release from the GitHub API and compare versions.
   * If a newer version exists, notify the renderer so the download icon
   * appears.  This does NOT download anything — the user will be directed
   * to the releases page when they click "install".
   */
  private async checkForUpdatesViaGitHub(): Promise<void> {
    try {
      const release = await this.fetchLatestRelease();
      if (!release) return;

      const currentVersion = app.getVersion();
      const latestVersion = release.tag_name.replace(/^v/, "");
      const updateAvailable = this.isNewerVersion(
        currentVersion,
        latestVersion,
      );

      if (!updateAvailable) {
        console.log(`[Updater] App is up to date (v${currentVersion})`);
        return;
      }

      console.log(
        `[Updater] Update available: v${currentVersion} → v${latestVersion}`,
      );

      const info: UpdateInfo = {
        updateAvailable: true,
        currentVersion,
        latestVersion,
        releaseUrl: release.html_url,
        releaseName: release.name || `v${latestVersion}`,
        releaseNotes: release.body || "",
        publishedAt: release.published_at,
        downloadUrl: release.html_url,
        manualDownload: true,
      };

      this.lastUpdateInfo = info;
      // On Linux we mark as "ready" immediately since there's no download
      // step — the user just needs to click to open the releases page.
      this.updateStatus = "ready";

      this.mainWindow?.webContents.send(UpdaterChannel.OnUpdateAvailable, info);
    } catch (error) {
      console.error("[Updater] GitHub API check failed:", error);
    }
  }

  /**
   * Fetch the latest non-draft, non-prerelease from the GitHub API.
   */
  private async fetchLatestRelease(): Promise<GitHubRelease | null> {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": `Soothsayer/${app.getVersion()}`,
      },
    });

    if (!response.ok) {
      console.warn(
        `[Updater] GitHub API responded with ${response.status}: ${response.statusText}`,
      );
      return null;
    }

    return (await response.json()) as GitHubRelease;
  }

  /**
   * Open the GitHub Releases page in the user's default browser.
   */
  private openReleasePage(): { success: boolean; error?: string } {
    const url =
      this.lastUpdateInfo?.releaseUrl ||
      `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

    console.log(`[Updater] Opening release page: ${url}`);
    shell.openExternal(url);
    return { success: true };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  /**
   * Send download progress to the renderer.
   */
  private sendProgress(progress: DownloadProgress): void {
    this.mainWindow?.webContents.send(
      UpdaterChannel.OnDownloadProgress,
      progress,
    );
  }

  /**
   * Try to extract a semver version string from a release name.
   * Handles formats like "v1.2.3", "Soothsayer v1.2.3", "1.2.3", etc.
   */
  private parseVersionFromName(releaseName: string | null): string {
    if (!releaseName) return "0.0.0";

    const match = releaseName.match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : releaseName;
  }

  // ─── Release body parsing ─────────────────────────────────────────────

  /**
   * Parse a single GitHub release body into structured entries.
   * Wraps it as a fake versioned release and delegates to parseChangelog.
   */
  private parseReleaseBody(body: string): {
    changeType: string;
    entries: ChangelogEntry[];
  } {
    // Wrap body in a synthetic version header so parseChangelog can handle it
    const wrapped = `## 0.0.0\n\n${body}`;
    const releases = this.parseChangelog(wrapped);

    if (releases.length > 0) {
      return {
        changeType: releases[0].changeType,
        entries: releases[0].entries,
      };
    }

    return { changeType: "Changes", entries: [] };
  }

  // ─── Changelog parsing ────────────────────────────────────────────────

  /**
   * Parse a CHANGELOG.md string into structured release objects.
   * Handles Windows \r\n line endings.
   */
  private parseChangelog(markdown: string): ChangelogRelease[] {
    const releases: ChangelogRelease[] = [];
    // Normalize line endings to handle Windows \r\n
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");

    let currentRelease: ChangelogRelease | null = null;
    let currentEntry: ChangelogEntry | null = null;

    for (const line of lines) {
      // Version header: ## X.Y.Z
      const versionMatch = line.match(/^## (\d+\.\d+\.\d+.*)$/);
      if (versionMatch) {
        if (currentEntry && currentRelease) {
          currentRelease.entries.push(currentEntry);
          currentEntry = null;
        }
        currentRelease = {
          version: versionMatch[1].trim(),
          changeType: "Changes",
          entries: [],
        };
        releases.push(currentRelease);
        continue;
      }

      // Change type header: ### Patch Changes / ### Minor Changes / etc.
      const changeTypeMatch = line.match(/^### (.+)$/);
      if (changeTypeMatch && currentRelease) {
        if (currentEntry) {
          currentRelease.entries.push(currentEntry);
          currentEntry = null;
        }
        currentRelease.changeType = changeTypeMatch[1].trim();
        continue;
      }

      // Top-level list item (starts with "- ")
      if (line.match(/^- /) && currentRelease) {
        if (currentEntry) {
          currentRelease.entries.push(currentEntry);
        }
        currentEntry = this.parseChangelogEntry(line);
        continue;
      }

      // Sub-item (indented list item, e.g. "  - something")
      if (line.match(/^\s{2,}-\s/) && currentEntry) {
        const subText = line.replace(/^\s+-\s*/, "").trim();
        if (subText) {
          if (!currentEntry.subItems) {
            currentEntry.subItems = [];
          }
          currentEntry.subItems.push(subText);
        }
        continue;
      }

      // Continuation text (non-empty, non-header line belonging to current entry)
      if (line.trim() && currentEntry && !line.startsWith("#")) {
        currentEntry.description += ` ${line.trim()}`;
      }
    }

    // Flush last entry
    if (currentEntry && currentRelease) {
      currentRelease.entries.push(currentEntry);
    }

    return releases;
  }

  /**
   * Parse a single changelog list-item line into a ChangelogEntry.
   */
  private parseChangelogEntry(line: string): ChangelogEntry {
    const trimmed = line.replace(/^-\s*/, "").trim();

    // Pattern: [`commitHash`](url) Thanks [@user](url)! - Description
    const richPattern =
      /^\[`([a-f0-9]+)`\]\((https?:\/\/[^\s)]+)\)\s*Thanks\s*\[@([^\]]+)\]\((https?:\/\/[^\s)]+)\)!\s*-\s*(.+)$/;
    const richMatch = trimmed.match(richPattern);

    if (richMatch) {
      return {
        description: richMatch[5].trim(),
        commitHash: richMatch[1],
        commitUrl: richMatch[2],
        contributor: richMatch[3],
        contributorUrl: richMatch[4],
      };
    }

    // Pattern: commitHash: Description (simple)
    const simplePattern = /^([a-f0-9]{7,40}):\s*(.+)$/;
    const simpleMatch = trimmed.match(simplePattern);

    if (simpleMatch) {
      return {
        description: simpleMatch[2].trim(),
        commitHash: simpleMatch[1],
      };
    }

    // Plain text entry
    return { description: trimmed };
  }

  /**
   * Compare two semver strings. Returns true if `latest` is newer than
   * `current`.
   */
  private isNewerVersion(current: string, latest: string): boolean {
    const parseSemver = (v: string) =>
      v.split(".").map((n) => Number.parseInt(n, 10));

    const [curMajor = 0, curMinor = 0, curPatch = 0] = parseSemver(current);
    const [latMajor = 0, latMinor = 0, latPatch = 0] = parseSemver(latest);

    if (latMajor !== curMajor) return latMajor > curMajor;
    if (latMinor !== curMinor) return latMinor > curMinor;
    return latPatch > curPatch;
  }
}

export { UpdaterService };
export type { UpdateInfo, DownloadProgress, UpdateStatus };
