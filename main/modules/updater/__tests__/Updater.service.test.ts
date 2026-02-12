import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const {
  mockIpcHandle,
  mockAutoUpdaterSetFeedURL,
  mockAutoUpdaterCheckForUpdates,
  mockAutoUpdaterQuitAndInstall,
  mockAutoUpdaterOn,
  mockShellOpenExternal,
  mockWebContentsSend,
  mockReadFileSync,
  mockElectronApp,
  mockFetch,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockAutoUpdaterSetFeedURL: vi.fn(),
  mockAutoUpdaterCheckForUpdates: vi.fn(),
  mockAutoUpdaterQuitAndInstall: vi.fn(),
  mockAutoUpdaterOn: vi.fn(),
  mockShellOpenExternal: vi.fn(),
  mockWebContentsSend: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockElectronApp: {
    isPackaged: false,
    getAppPath: vi.fn(() => "/mock-app-path"),
    getVersion: vi.fn(() => "1.0.0"),
    getPath: vi.fn(() => "/mock-path"),
  },
  mockFetch: vi.fn(),
}));

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  autoUpdater: {
    setFeedURL: mockAutoUpdaterSetFeedURL,
    checkForUpdates: mockAutoUpdaterCheckForUpdates,
    quitAndInstall: mockAutoUpdaterQuitAndInstall,
    on: mockAutoUpdaterOn,
  },
  app: mockElectronApp,
  shell: {
    openExternal: mockShellOpenExternal,
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    getFocusedWindow: vi.fn(() => null),
  },
  dialog: {
    showMessageBox: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}));

// ─── Mock node:fs ────────────────────────────────────────────────────────────
vi.mock("node:fs", () => ({
  readFileSync: mockReadFileSync,
  existsSync: vi.fn(() => false),
  writeFileSync: vi.fn(),
}));

// ─── Mock global fetch ──────────────────────────────────────────────────────
vi.stubGlobal("fetch", mockFetch);

import { UpdaterChannel } from "../Updater.channels";
// ─── Import under test ──────────────────────────────────────────────────────
import { UpdaterService } from "../Updater.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getIpcHandler(channel: string): (...args: any[]) => any {
  const call = mockIpcHandle.mock.calls.find(
    ([ch]: [string]) => ch === channel
  );
  if (!call) {
    const registered = mockIpcHandle.mock.calls
      .map(([ch]: [string]) => ch)
      .join(", ");
    throw new Error(
      `ipcMain.handle was not called with "${channel}". Registered: ${registered}`
    );
  }
  return call[1];
}

function createMockBrowserWindow() {
  return {
    webContents: {
      send: mockWebContentsSend,
    },
    isMinimized: vi.fn(() => false),
    restore: vi.fn(),
    focus: vi.fn(),
    show: vi.fn(),
  } as any;
}

const SAMPLE_GITHUB_RELEASE = {
  tag_name: "v2.0.0",
  html_url:
    "https://github.com/navali-creations/soothsayer/releases/tag/v2.0.0",
  name: "Soothsayer v2.0.0",
  body: "### Patch Changes\n\n- Fixed a bug\n- Added a feature",
  published_at: "2025-01-15T00:00:00Z",
};

const SAMPLE_CHANGELOG = `## 2.0.0

### Patch Changes

- Fixed a critical bug
- Added new overlay feature
  - Sub-feature one
  - Sub-feature two

## 1.1.0

### Minor Changes

- [\`abc1234\`](https://github.com/navali-creations/soothsayer/commit/abc1234) Thanks [@contributor](https://github.com/contributor)! - Added divination cards

## 1.0.0

### Patch Changes

- abc1234: Initial release
`;

const SAMPLE_CHANGELOG_CRLF = SAMPLE_CHANGELOG.replace(/\n/g, "\r\n");

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("UpdaterService", () => {
  let service: UpdaterService;
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: false });

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    UpdaterService._instance = undefined;

    // Default: not packaged, win32
    mockElectronApp.isPackaged = false;
    mockElectronApp.getVersion.mockReturnValue("1.0.0");

    Object.defineProperty(process, "platform", {
      value: "win32",
      writable: true,
      configurable: true,
    });

    service = UpdaterService.getInstance();
  });

  afterEach(() => {
    service.destroy();

    // @ts-expect-error — accessing private static for testing
    UpdaterService._instance = undefined;

    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      writable: true,
      configurable: true,
    });

    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ─── Singleton ──────────────────────────────────────────────────────────

  describe("singleton", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = UpdaterService.getInstance();
      const instance2 = UpdaterService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should return a new instance after resetting the singleton", () => {
      const instance1 = UpdaterService.getInstance();
      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      const instance2 = UpdaterService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  // ─── Initialize ─────────────────────────────────────────────────────────

  describe("initialize", () => {
    it("should register IPC handlers when not packaged", () => {
      mockElectronApp.isPackaged = false;
      const mockWindow = createMockBrowserWindow();

      service.initialize(mockWindow);

      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch
      );

      expect(registeredChannels).toContain(UpdaterChannel.CheckForUpdates);
      expect(registeredChannels).toContain(UpdaterChannel.GetUpdateInfo);
      expect(registeredChannels).toContain(UpdaterChannel.DownloadUpdate);
      expect(registeredChannels).toContain(UpdaterChannel.InstallUpdate);
      expect(registeredChannels).toContain(UpdaterChannel.GetLatestRelease);
      expect(registeredChannels).toContain(UpdaterChannel.GetChangelog);
    });

    it("should NOT set feed URL when not packaged", () => {
      mockElectronApp.isPackaged = false;
      const mockWindow = createMockBrowserWindow();

      service.initialize(mockWindow);

      expect(mockAutoUpdaterSetFeedURL).not.toHaveBeenCalled();
    });

    it("should NOT start periodic checks when not packaged", () => {
      mockElectronApp.isPackaged = false;
      const mockWindow = createMockBrowserWindow();

      service.initialize(mockWindow);

      expect(mockAutoUpdaterCheckForUpdates).not.toHaveBeenCalled();
    });

    it("should only initialize once (idempotent)", () => {
      mockElectronApp.isPackaged = false;
      const mockWindow = createMockBrowserWindow();

      service.initialize(mockWindow);
      const callCount = mockIpcHandle.mock.calls.length;

      service.initialize(mockWindow);
      expect(mockIpcHandle.mock.calls.length).toBe(callCount);
    });

    it("should set feed URL and wire events when packaged on win32", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      // Need a fresh instance since isLinux is set in constructor
      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      expect(mockAutoUpdaterSetFeedURL).toHaveBeenCalledTimes(1);
      expect(mockAutoUpdaterOn).toHaveBeenCalled();
    });

    it("should set feed URL and wire events when packaged on darwin", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "darwin",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      expect(mockAutoUpdaterSetFeedURL).toHaveBeenCalledTimes(1);
      expect(mockAutoUpdaterOn).toHaveBeenCalled();
    });

    it("should use GitHub API polling on Linux instead of autoUpdater", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      expect(mockAutoUpdaterSetFeedURL).not.toHaveBeenCalled();
      expect(mockAutoUpdaterOn).not.toHaveBeenCalled();
    });

    it("should not set up autoUpdater for unsupported platforms", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "freebsd",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      expect(mockAutoUpdaterSetFeedURL).not.toHaveBeenCalled();
    });

    it("should register all 6 expected IPC handler channels", () => {
      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch
      );

      const expectedChannels = [
        UpdaterChannel.CheckForUpdates,
        UpdaterChannel.GetUpdateInfo,
        UpdaterChannel.DownloadUpdate,
        UpdaterChannel.InstallUpdate,
        UpdaterChannel.GetLatestRelease,
        UpdaterChannel.GetChangelog,
      ];

      for (const channel of expectedChannels) {
        expect(registeredChannels).toContain(channel);
      }
    });
  });

  // ─── Destroy ────────────────────────────────────────────────────────────

  describe("destroy", () => {
    it("should clear the check interval", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      // @ts-expect-error — accessing private for testing
      expect(service.checkInterval).not.toBeNull();

      service.destroy();

      // @ts-expect-error — accessing private for testing
      expect(service.checkInterval).toBeNull();
    });

    it("should be safe to call destroy without initialization", () => {
      expect(() => service.destroy()).not.toThrow();
    });

    it("should be safe to call destroy multiple times", () => {
      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      expect(() => {
        service.destroy();
        service.destroy();
      }).not.toThrow();
    });
  });

  // ─── checkForUpdates ────────────────────────────────────────────────────

  describe("checkForUpdates", () => {
    it("should return null when app is not packaged", () => {
      mockElectronApp.isPackaged = false;
      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      const result = service.checkForUpdates();

      expect(result).toBeNull();
      expect(mockAutoUpdaterCheckForUpdates).not.toHaveBeenCalled();
    });

    it("should call autoUpdater.checkForUpdates on win32 when packaged", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      service.checkForUpdates();

      expect(mockAutoUpdaterCheckForUpdates).toHaveBeenCalled();
    });

    it("should return null for unsupported platforms when packaged", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "freebsd",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const result = service.checkForUpdates();

      expect(result).toBeNull();
    });
  });

  // ─── installUpdate ──────────────────────────────────────────────────────

  describe("installUpdate", () => {
    it("should return error when no update has been downloaded", () => {
      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      const result = service.installUpdate();

      expect(result).toEqual({
        success: false,
        error: "No update has been downloaded yet",
      });
    });

    it("should call autoUpdater.quitAndInstall when update is downloaded", () => {
      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      // @ts-expect-error — accessing private for testing
      service.updateDownloaded = true;

      const result = service.installUpdate();

      expect(mockAutoUpdaterQuitAndInstall).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("should return error when quitAndInstall throws", () => {
      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      // @ts-expect-error — accessing private for testing
      service.updateDownloaded = true;
      mockAutoUpdaterQuitAndInstall.mockImplementation(() => {
        throw new Error("Install failed");
      });

      const result = service.installUpdate();

      expect(result).toEqual({
        success: false,
        error: "Install failed",
      });
    });

    it("should handle non-Error thrown objects in installUpdate", () => {
      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      // @ts-expect-error — accessing private for testing
      service.updateDownloaded = true;
      mockAutoUpdaterQuitAndInstall.mockImplementation(() => {
        throw "string error";
      });

      const result = service.installUpdate();

      expect(result).toEqual({
        success: false,
        error: "Unknown install error",
      });
    });

    it("should open release page on Linux instead of quitAndInstall", () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      const result = service.installUpdate();

      expect(result).toEqual({ success: true });
      expect(mockShellOpenExternal).toHaveBeenCalled();
      expect(mockAutoUpdaterQuitAndInstall).not.toHaveBeenCalled();
    });

    it("should open the stored release URL on Linux when available", () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      // @ts-expect-error — accessing private for testing
      service.lastUpdateInfo = {
        releaseUrl:
          "https://github.com/navali-creations/soothsayer/releases/tag/v2.0.0",
      };

      service.installUpdate();

      expect(mockShellOpenExternal).toHaveBeenCalledWith(
        "https://github.com/navali-creations/soothsayer/releases/tag/v2.0.0"
      );
    });

    it("should fall back to latest releases URL on Linux when no stored info", () => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      service.installUpdate();

      expect(mockShellOpenExternal).toHaveBeenCalledWith(
        "https://github.com/navali-creations/soothsayer/releases/latest"
      );
    });
  });

  // ─── IPC Handlers ──────────────────────────────────────────────────────

  describe("IPC handlers", () => {
    beforeEach(() => {
      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);
    });

    describe("CheckForUpdates handler", () => {
      it("should return null when not packaged", async () => {
        const handler = getIpcHandler(UpdaterChannel.CheckForUpdates);
        const result = await handler();

        expect(result).toBeNull();
      });
    });

    describe("GetUpdateInfo handler", () => {
      it("should return null when no update info exists", async () => {
        const handler = getIpcHandler(UpdaterChannel.GetUpdateInfo);
        const result = await handler();

        expect(result).toBeNull();
      });

      it("should return stored update info", async () => {
        const updateInfo = {
          updateAvailable: true,
          currentVersion: "1.0.0",
          latestVersion: "2.0.0",
          releaseUrl: "https://example.com",
          releaseName: "v2.0.0",
          releaseNotes: "notes",
          publishedAt: "2025-01-01",
          downloadUrl: null,
          manualDownload: false,
        };

        // @ts-expect-error — accessing private for testing
        service.lastUpdateInfo = updateInfo;

        const handler = getIpcHandler(UpdaterChannel.GetUpdateInfo);
        const result = await handler();

        expect(result).toEqual(updateInfo);
      });
    });

    describe("DownloadUpdate handler", () => {
      it("should return success on Linux", async () => {
        Object.defineProperty(process, "platform", {
          value: "linux",
          writable: true,
          configurable: true,
        });

        // @ts-expect-error — accessing private static for testing
        UpdaterService._instance = undefined;
        service = UpdaterService.getInstance();

        const mockWindow = createMockBrowserWindow();
        service.initialize(mockWindow);

        const handler = getIpcHandler(UpdaterChannel.DownloadUpdate);
        const result = await handler();

        expect(result).toEqual({ success: true });
      });

      it("should return success when update already downloaded", async () => {
        // @ts-expect-error — accessing private for testing
        service.updateDownloaded = true;

        const handler = getIpcHandler(UpdaterChannel.DownloadUpdate);
        const result = await handler();

        expect(result).toEqual({ success: true });
      });

      it("should return success when currently downloading", async () => {
        // @ts-expect-error — accessing private for testing
        service.updateStatus = "downloading";

        const handler = getIpcHandler(UpdaterChannel.DownloadUpdate);
        const result = await handler();

        expect(result).toEqual({ success: true });
      });
    });

    describe("InstallUpdate handler", () => {
      it("should call installUpdate and return result", async () => {
        const handler = getIpcHandler(UpdaterChannel.InstallUpdate);
        const result = await handler();

        expect(result).toEqual({
          success: false,
          error: "No update has been downloaded yet",
        });
      });
    });

    describe("GetLatestRelease handler", () => {
      it("should fetch and return parsed release info", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(SAMPLE_GITHUB_RELEASE),
        });

        const handler = getIpcHandler(UpdaterChannel.GetLatestRelease);
        const result = await handler();

        expect(result).not.toBeNull();
        expect(result.version).toBe("2.0.0");
        expect(result.name).toBe("Soothsayer v2.0.0");
        expect(result.publishedAt).toBe("2025-01-15T00:00:00Z");
        expect(result.url).toBe(
          "https://github.com/navali-creations/soothsayer/releases/tag/v2.0.0"
        );
        expect(result.body).toBe(SAMPLE_GITHUB_RELEASE.body);
        expect(result.entries).toBeInstanceOf(Array);
        expect(result.entries.length).toBeGreaterThan(0);
      });

      it("should return null when fetch fails", async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        });

        const handler = getIpcHandler(UpdaterChannel.GetLatestRelease);
        const result = await handler();

        expect(result).toBeNull();
      });

      it("should return null when fetch throws", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Network error"));

        const handler = getIpcHandler(UpdaterChannel.GetLatestRelease);
        const result = await handler();

        expect(result).toBeNull();
      });

      it("should return null when release has no body", async () => {
        const releaseNoBody = { ...SAMPLE_GITHUB_RELEASE, body: "" };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(releaseNoBody),
        });

        const handler = getIpcHandler(UpdaterChannel.GetLatestRelease);
        const result = await handler();

        expect(result).not.toBeNull();
        expect(result.body).toBe("");
        expect(result.changeType).toBeDefined();
      });

      it("should strip 'v' prefix from tag_name for version", async () => {
        const release = { ...SAMPLE_GITHUB_RELEASE, tag_name: "v3.2.1" };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(release),
        });

        const handler = getIpcHandler(UpdaterChannel.GetLatestRelease);
        const result = await handler();

        expect(result.version).toBe("3.2.1");
      });

      it("should use tag_name as name when name is missing", async () => {
        const release = { ...SAMPLE_GITHUB_RELEASE, name: "" };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue(release),
        });

        const handler = getIpcHandler(UpdaterChannel.GetLatestRelease);
        const result = await handler();

        expect(result.name).toBe(release.tag_name);
      });
    });

    describe("GetChangelog handler", () => {
      it("should read and parse CHANGELOG.md successfully", async () => {
        mockReadFileSync.mockReturnValue(SAMPLE_CHANGELOG);

        const handler = getIpcHandler(UpdaterChannel.GetChangelog);
        const result = await handler();

        expect(result.success).toBe(true);
        expect(result.releases).toBeInstanceOf(Array);
        expect(result.releases.length).toBe(3);
      });

      it("should return error when CHANGELOG.md is not found", async () => {
        mockReadFileSync.mockImplementation(() => {
          throw new Error("ENOENT: no such file or directory");
        });

        const handler = getIpcHandler(UpdaterChannel.GetChangelog);
        const result = await handler();

        expect(result.success).toBe(false);
        expect(result.releases).toEqual([]);
        expect(result.error).toContain("ENOENT");
      });

      it("should use resourcesPath when packaged", async () => {
        mockElectronApp.isPackaged = true;
        mockReadFileSync.mockReturnValue(SAMPLE_CHANGELOG);

        // Mock process.resourcesPath which only exists in packaged Electron apps
        const originalResourcesPath = (process as any).resourcesPath;
        Object.defineProperty(process, "resourcesPath", {
          value: "/mock-resources-path",
          writable: true,
          configurable: true,
        });

        // Re-initialize to pick up isPackaged
        // @ts-expect-error — accessing private static for testing
        UpdaterService._instance = undefined;
        service = UpdaterService.getInstance();
        const mockWindow = createMockBrowserWindow();
        service.initialize(mockWindow);

        const handler = getIpcHandler(UpdaterChannel.GetChangelog);
        await handler();

        const calledPath = mockReadFileSync.mock.calls[0][0] as string;
        const normalized = calledPath.replace(/\\/g, "/");
        // In packaged mode, should use process.resourcesPath
        expect(normalized).toContain("/mock-resources-path/");
        expect(normalized).toContain("CHANGELOG.md");

        // Restore
        if (originalResourcesPath === undefined) {
          delete (process as any).resourcesPath;
        } else {
          Object.defineProperty(process, "resourcesPath", {
            value: originalResourcesPath,
            writable: true,
            configurable: true,
          });
        }
      });

      it("should use appPath when not packaged", async () => {
        mockElectronApp.isPackaged = false;
        mockReadFileSync.mockReturnValue(SAMPLE_CHANGELOG);

        const handler = getIpcHandler(UpdaterChannel.GetChangelog);
        await handler();

        const calledPath = mockReadFileSync.mock.calls[0][0] as string;
        expect(calledPath).toContain("CHANGELOG.md");
      });

      it("should handle Windows CRLF line endings", async () => {
        mockReadFileSync.mockReturnValue(SAMPLE_CHANGELOG_CRLF);

        const handler = getIpcHandler(UpdaterChannel.GetChangelog);
        const result = await handler();

        expect(result.success).toBe(true);
        expect(result.releases.length).toBe(3);
        expect(result.releases[0].version).toBe("2.0.0");
      });
    });
  });

  // ─── parseChangelog (private — tested via accessor) ─────────────────────

  describe("parseChangelog", () => {
    function callParseChangelog(markdown: string) {
      // @ts-expect-error — accessing private method for testing
      return service.parseChangelog(markdown);
    }

    it("should parse a simple changelog with one release", () => {
      const md = `## 1.0.0\n\n### Patch Changes\n\n- Fixed a bug\n- Added a feature\n`;
      const releases = callParseChangelog(md);

      expect(releases).toHaveLength(1);
      expect(releases[0].version).toBe("1.0.0");
      expect(releases[0].changeType).toBe("Patch Changes");
      expect(releases[0].entries).toHaveLength(2);
      expect(releases[0].entries[0].description).toBe("Fixed a bug");
      expect(releases[0].entries[1].description).toBe("Added a feature");
    });

    it("should parse multiple releases", () => {
      const md = `## 2.0.0\n\n### Major Changes\n\n- Breaking change\n\n## 1.0.0\n\n### Patch Changes\n\n- Initial release\n`;
      const releases = callParseChangelog(md);

      expect(releases).toHaveLength(2);
      expect(releases[0].version).toBe("2.0.0");
      expect(releases[0].changeType).toBe("Major Changes");
      expect(releases[1].version).toBe("1.0.0");
      expect(releases[1].changeType).toBe("Patch Changes");
    });

    it("should handle releases with sub-items", () => {
      const md = `## 1.0.0\n\n### Patch Changes\n\n- Main item\n  - Sub item 1\n  - Sub item 2\n`;
      const releases = callParseChangelog(md);

      expect(releases).toHaveLength(1);
      expect(releases[0].entries).toHaveLength(1);
      expect(releases[0].entries[0].description).toBe("Main item");
      expect(releases[0].entries[0].subItems).toEqual([
        "Sub item 1",
        "Sub item 2",
      ]);
    });

    it("should handle Windows CRLF line endings", () => {
      const md = "## 1.0.0\r\n\r\n### Patch Changes\r\n\r\n- Fixed a bug\r\n";
      const releases = callParseChangelog(md);

      expect(releases).toHaveLength(1);
      expect(releases[0].entries).toHaveLength(1);
      expect(releases[0].entries[0].description).toBe("Fixed a bug");
    });

    it("should handle empty changelog", () => {
      const releases = callParseChangelog("");
      expect(releases).toEqual([]);
    });

    it("should handle changelog with no entries", () => {
      const md = `## 1.0.0\n\n### Patch Changes\n\n`;
      const releases = callParseChangelog(md);

      expect(releases).toHaveLength(1);
      expect(releases[0].entries).toHaveLength(0);
    });

    it("should handle changelog with only version header", () => {
      const md = `## 1.0.0\n`;
      const releases = callParseChangelog(md);

      expect(releases).toHaveLength(1);
      expect(releases[0].version).toBe("1.0.0");
      expect(releases[0].changeType).toBe("Changes");
    });

    it("should default changeType to 'Changes' when no ### header is present", () => {
      const md = `## 1.0.0\n\n- Entry without change type header\n`;
      const releases = callParseChangelog(md);

      expect(releases).toHaveLength(1);
      expect(releases[0].changeType).toBe("Changes");
      expect(releases[0].entries).toHaveLength(1);
    });

    it("should handle continuation text on entry", () => {
      const md = `## 1.0.0\n\n### Patch Changes\n\n- First line of description\ncontinuation of description\n`;
      const releases = callParseChangelog(md);

      expect(releases).toHaveLength(1);
      expect(releases[0].entries).toHaveLength(1);
      expect(releases[0].entries[0].description).toBe(
        "First line of description continuation of description"
      );
    });

    it("should parse rich entries with commit hash, URL, and contributor", () => {
      const md = `## 1.0.0\n\n### Patch Changes\n\n- [\`abc1234\`](https://github.com/navali-creations/soothsayer/commit/abc1234) Thanks [@contributor](https://github.com/contributor)! - Added a feature\n`;
      const releases = callParseChangelog(md);

      expect(releases).toHaveLength(1);
      expect(releases[0].entries).toHaveLength(1);

      const entry = releases[0].entries[0];
      expect(entry.description).toBe("Added a feature");
      expect(entry.commitHash).toBe("abc1234");
      expect(entry.commitUrl).toBe(
        "https://github.com/navali-creations/soothsayer/commit/abc1234"
      );
      expect(entry.contributor).toBe("contributor");
      expect(entry.contributorUrl).toBe("https://github.com/contributor");
    });

    it("should parse simple commit hash entries", () => {
      const md = `## 1.0.0\n\n### Patch Changes\n\n- abc1234: Did something\n`;
      const releases = callParseChangelog(md);

      expect(releases).toHaveLength(1);
      expect(releases[0].entries).toHaveLength(1);

      const entry = releases[0].entries[0];
      expect(entry.description).toBe("Did something");
      expect(entry.commitHash).toBe("abc1234");
    });

    it("should parse plain text entries", () => {
      const md = `## 1.0.0\n\n### Patch Changes\n\n- Just a plain entry\n`;
      const releases = callParseChangelog(md);

      expect(releases).toHaveLength(1);
      expect(releases[0].entries).toHaveLength(1);

      const entry = releases[0].entries[0];
      expect(entry.description).toBe("Just a plain entry");
      expect(entry.commitHash).toBeUndefined();
      expect(entry.contributor).toBeUndefined();
    });

    it("should parse the full sample changelog correctly", () => {
      const releases = callParseChangelog(SAMPLE_CHANGELOG);

      expect(releases).toHaveLength(3);

      // v2.0.0
      expect(releases[0].version).toBe("2.0.0");
      expect(releases[0].changeType).toBe("Patch Changes");
      expect(releases[0].entries.length).toBeGreaterThanOrEqual(2);
      expect(releases[0].entries[0].description).toBe("Fixed a critical bug");
      expect(releases[0].entries[1].description).toBe(
        "Added new overlay feature"
      );
      expect(releases[0].entries[1].subItems).toEqual([
        "Sub-feature one",
        "Sub-feature two",
      ]);

      // v1.1.0
      expect(releases[1].version).toBe("1.1.0");
      expect(releases[1].changeType).toBe("Minor Changes");
      expect(releases[1].entries).toHaveLength(1);
      expect(releases[1].entries[0].description).toBe("Added divination cards");
      expect(releases[1].entries[0].commitHash).toBe("abc1234");
      expect(releases[1].entries[0].contributor).toBe("contributor");

      // v1.0.0
      expect(releases[2].version).toBe("1.0.0");
      expect(releases[2].changeType).toBe("Patch Changes");
      expect(releases[2].entries).toHaveLength(1);
      expect(releases[2].entries[0].description).toBe("Initial release");
      expect(releases[2].entries[0].commitHash).toBe("abc1234");
    });

    it("should handle mixed entry types in a single release", () => {
      const md = `## 1.0.0\n\n### Patch Changes\n\n- [\`def5678\`](https://github.com/org/repo/commit/def5678) Thanks [@user](https://github.com/user)! - Rich entry\n- abc1234: Simple entry\n- Plain entry\n`;
      const releases = callParseChangelog(md);

      expect(releases).toHaveLength(1);
      expect(releases[0].entries).toHaveLength(3);

      expect(releases[0].entries[0].description).toBe("Rich entry");
      expect(releases[0].entries[0].commitHash).toBe("def5678");
      expect(releases[0].entries[0].contributor).toBe("user");

      expect(releases[0].entries[1].description).toBe("Simple entry");
      expect(releases[0].entries[1].commitHash).toBe("abc1234");

      expect(releases[0].entries[2].description).toBe("Plain entry");
      expect(releases[0].entries[2].commitHash).toBeUndefined();
    });

    it("should handle versions with extra text (e.g. pre-release)", () => {
      const md = `## 2.0.0-beta.1\n\n- Beta feature\n`;
      const releases = callParseChangelog(md);

      expect(releases).toHaveLength(1);
      expect(releases[0].version).toBe("2.0.0-beta.1");
    });

    it("should ignore lines that are headers but not version/changeType headers", () => {
      const md = `## 1.0.0\n\n### Patch Changes\n\n- Entry one\n\n# Top level header (ignored as entry prefix)\n`;
      const releases = callParseChangelog(md);

      expect(releases).toHaveLength(1);
      // The # line should not be treated as a continuation since it starts with #
    });

    it("should flush the last entry at end of input", () => {
      const md = `## 1.0.0\n\n### Patch Changes\n\n- Last entry without trailing newline`;
      const releases = callParseChangelog(md);

      expect(releases).toHaveLength(1);
      expect(releases[0].entries).toHaveLength(1);
      expect(releases[0].entries[0].description).toBe(
        "Last entry without trailing newline"
      );
    });
  });

  // ─── parseReleaseBody (private — tested via accessor) ──────────────────

  describe("parseReleaseBody", () => {
    function callParseReleaseBody(body: string) {
      // @ts-expect-error — accessing private method for testing
      return service.parseReleaseBody(body);
    }

    it("should parse a release body with patch changes", () => {
      const body = `### Patch Changes\n\n- Fixed a bug\n- Added a feature\n`;
      const result = callParseReleaseBody(body);

      expect(result.changeType).toBe("Patch Changes");
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].description).toBe("Fixed a bug");
      expect(result.entries[1].description).toBe("Added a feature");
    });

    it("should return default changeType for empty body", () => {
      const result = callParseReleaseBody("");

      expect(result.changeType).toBe("Changes");
      expect(result.entries).toHaveLength(0);
    });

    it("should handle body with only list items (no ### header)", () => {
      const body = `- First item\n- Second item\n`;
      const result = callParseReleaseBody(body);

      expect(result.entries).toHaveLength(2);
    });

    it("should handle body with rich changelog entries", () => {
      const body = `### Minor Changes\n\n- [\`abc1234\`](https://github.com/org/repo/commit/abc1234) Thanks [@user](https://github.com/user)! - Added a cool feature\n`;
      const result = callParseReleaseBody(body);

      expect(result.changeType).toBe("Minor Changes");
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].description).toBe("Added a cool feature");
      expect(result.entries[0].commitHash).toBe("abc1234");
      expect(result.entries[0].contributor).toBe("user");
    });

    it("should handle body with sub-items", () => {
      const body = `### Patch Changes\n\n- Main fix\n  - Detail one\n  - Detail two\n`;
      const result = callParseReleaseBody(body);

      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].description).toBe("Main fix");
      expect(result.entries[0].subItems).toEqual(["Detail one", "Detail two"]);
    });
  });

  // ─── parseChangelogEntry (private — tested via accessor) ───────────────

  describe("parseChangelogEntry", () => {
    function callParseChangelogEntry(line: string) {
      // @ts-expect-error — accessing private method for testing
      return service.parseChangelogEntry(line);
    }

    it("should parse a rich entry with commit, contributor, and description", () => {
      const line = `- [\`abc1234\`](https://github.com/org/repo/commit/abc1234) Thanks [@user](https://github.com/user)! - Added feature`;
      const entry = callParseChangelogEntry(line);

      expect(entry.description).toBe("Added feature");
      expect(entry.commitHash).toBe("abc1234");
      expect(entry.commitUrl).toBe(
        "https://github.com/org/repo/commit/abc1234"
      );
      expect(entry.contributor).toBe("user");
      expect(entry.contributorUrl).toBe("https://github.com/user");
    });

    it("should parse a simple commit hash entry", () => {
      const line = `- abcdef1: Fixed something`;
      const entry = callParseChangelogEntry(line);

      expect(entry.description).toBe("Fixed something");
      expect(entry.commitHash).toBe("abcdef1");
      expect(entry.commitUrl).toBeUndefined();
      expect(entry.contributor).toBeUndefined();
    });

    it("should parse a long commit hash (40 chars)", () => {
      const hash = "a".repeat(40);
      const line = `- ${hash}: Fixed something`;
      const entry = callParseChangelogEntry(line);

      expect(entry.description).toBe("Fixed something");
      expect(entry.commitHash).toBe(hash);
    });

    it("should parse a plain text entry", () => {
      const line = `- Just a plain description`;
      const entry = callParseChangelogEntry(line);

      expect(entry.description).toBe("Just a plain description");
      expect(entry.commitHash).toBeUndefined();
      expect(entry.commitUrl).toBeUndefined();
      expect(entry.contributor).toBeUndefined();
      expect(entry.contributorUrl).toBeUndefined();
    });

    it("should strip the leading dash and whitespace", () => {
      const line = `-   Extra whitespace`;
      const entry = callParseChangelogEntry(line);

      expect(entry.description).toBe("Extra whitespace");
    });

    it("should handle entry with special characters in description", () => {
      const line = `- Fixed <div> rendering & HTML escaping`;
      const entry = callParseChangelogEntry(line);

      expect(entry.description).toBe("Fixed <div> rendering & HTML escaping");
    });
  });

  // ─── parseVersionFromName (private — tested via accessor) ──────────────

  describe("parseVersionFromName", () => {
    function callParseVersionFromName(name: string | null) {
      // @ts-expect-error — accessing private method for testing
      return service.parseVersionFromName(name);
    }

    it("should extract version from 'v1.2.3'", () => {
      expect(callParseVersionFromName("v1.2.3")).toBe("1.2.3");
    });

    it("should extract version from 'Soothsayer v1.2.3'", () => {
      expect(callParseVersionFromName("Soothsayer v1.2.3")).toBe("1.2.3");
    });

    it("should extract version from plain '1.2.3'", () => {
      expect(callParseVersionFromName("1.2.3")).toBe("1.2.3");
    });

    it("should extract version from 'Release 2.10.5-beta'", () => {
      expect(callParseVersionFromName("Release 2.10.5-beta")).toBe("2.10.5");
    });

    it("should return '0.0.0' for null input", () => {
      expect(callParseVersionFromName(null)).toBe("0.0.0");
    });

    it("should return the original string when no version found", () => {
      expect(callParseVersionFromName("no-version-here")).toBe(
        "no-version-here"
      );
    });

    it("should handle empty string", () => {
      expect(callParseVersionFromName("")).toBe("0.0.0");
    });
  });

  // ─── isNewerVersion (private — tested via accessor) ────────────────────

  describe("isNewerVersion", () => {
    function callIsNewerVersion(current: string, latest: string) {
      // @ts-expect-error — accessing private method for testing
      return service.isNewerVersion(current, latest);
    }

    it("should return true when major version is higher", () => {
      expect(callIsNewerVersion("1.0.0", "2.0.0")).toBe(true);
    });

    it("should return true when minor version is higher", () => {
      expect(callIsNewerVersion("1.0.0", "1.1.0")).toBe(true);
    });

    it("should return true when patch version is higher", () => {
      expect(callIsNewerVersion("1.0.0", "1.0.1")).toBe(true);
    });

    it("should return false when versions are equal", () => {
      expect(callIsNewerVersion("1.0.0", "1.0.0")).toBe(false);
    });

    it("should return false when current is newer (major)", () => {
      expect(callIsNewerVersion("2.0.0", "1.0.0")).toBe(false);
    });

    it("should return false when current is newer (minor)", () => {
      expect(callIsNewerVersion("1.2.0", "1.1.0")).toBe(false);
    });

    it("should return false when current is newer (patch)", () => {
      expect(callIsNewerVersion("1.0.5", "1.0.3")).toBe(false);
    });

    it("should handle large version numbers", () => {
      expect(callIsNewerVersion("99.99.99", "100.0.0")).toBe(true);
    });

    it("should handle version 0.0.0", () => {
      expect(callIsNewerVersion("0.0.0", "0.0.1")).toBe(true);
      expect(callIsNewerVersion("0.0.0", "0.0.0")).toBe(false);
    });

    it("should prioritize major over minor", () => {
      expect(callIsNewerVersion("1.9.9", "2.0.0")).toBe(true);
    });

    it("should prioritize minor over patch", () => {
      expect(callIsNewerVersion("1.0.9", "1.1.0")).toBe(true);
    });

    it("should return false when major is lower even if minor is higher", () => {
      expect(callIsNewerVersion("2.0.0", "1.5.0")).toBe(false);
    });
  });

  // ─── fetchLatestRelease (private — tested via accessor) ────────────────

  describe("fetchLatestRelease", () => {
    it("should fetch from the correct GitHub API URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(SAMPLE_GITHUB_RELEASE),
      });

      // @ts-expect-error — accessing private method for testing
      await service.fetchLatestRelease();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/navali-creations/soothsayer/releases/latest",
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: "application/vnd.github.v3+json",
          }),
        })
      );
    });

    it("should include User-Agent header with app version", async () => {
      mockElectronApp.getVersion.mockReturnValue("1.5.0");
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(SAMPLE_GITHUB_RELEASE),
      });

      // @ts-expect-error — accessing private method for testing
      await service.fetchLatestRelease();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "Soothsayer/1.5.0",
          }),
        })
      );
    });

    it("should return null when API responds with non-OK status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      // @ts-expect-error — accessing private method for testing
      const result = await service.fetchLatestRelease();

      expect(result).toBeNull();
    });

    it("should return the parsed release when API responds successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(SAMPLE_GITHUB_RELEASE),
      });

      // @ts-expect-error — accessing private method for testing
      const result = await service.fetchLatestRelease();

      expect(result).toEqual(SAMPLE_GITHUB_RELEASE);
    });
  });

  // ─── checkForUpdatesViaGitHub (Linux path) ─────────────────────────────

  describe("checkForUpdatesViaGitHub (Linux)", () => {
    beforeEach(() => {
      Object.defineProperty(process, "platform", {
        value: "linux",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();
    });

    it("should set lastUpdateInfo and notify renderer when update is available", async () => {
      mockElectronApp.isPackaged = true;
      mockElectronApp.getVersion.mockReturnValue("1.0.0");

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(SAMPLE_GITHUB_RELEASE),
      });

      // @ts-expect-error — accessing private method for testing
      await service.checkForUpdatesViaGitHub();

      // @ts-expect-error — accessing private for testing
      const info = service.lastUpdateInfo;
      expect(info).not.toBeNull();
      expect(info!.updateAvailable).toBe(true);
      expect(info!.latestVersion).toBe("2.0.0");
      expect(info!.currentVersion).toBe("1.0.0");
      expect(info!.manualDownload).toBe(true);

      expect(mockWebContentsSend).toHaveBeenCalledWith(
        UpdaterChannel.OnUpdateAvailable,
        expect.objectContaining({ updateAvailable: true })
      );
    });

    it("should not notify when app is up to date", async () => {
      mockElectronApp.isPackaged = true;
      mockElectronApp.getVersion.mockReturnValue("2.0.0");

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(SAMPLE_GITHUB_RELEASE),
      });

      // @ts-expect-error — accessing private method for testing
      await service.checkForUpdatesViaGitHub();

      expect(mockWebContentsSend).not.toHaveBeenCalledWith(
        UpdaterChannel.OnUpdateAvailable,
        expect.anything()
      );
    });

    it("should not notify when fetch fails", async () => {
      mockElectronApp.isPackaged = true;

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      // @ts-expect-error — accessing private method for testing
      await service.checkForUpdatesViaGitHub();

      expect(mockWebContentsSend).not.toHaveBeenCalledWith(
        UpdaterChannel.OnUpdateAvailable,
        expect.anything()
      );
    });

    it("should handle fetch rejections gracefully", async () => {
      mockElectronApp.isPackaged = true;

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      // @ts-expect-error — accessing private method for testing
      await expect(service.checkForUpdatesViaGitHub()).resolves.toBeUndefined();

      expect(mockWebContentsSend).not.toHaveBeenCalled();
    });

    it("should set updateStatus to 'ready' when update is available on Linux", async () => {
      mockElectronApp.isPackaged = true;
      mockElectronApp.getVersion.mockReturnValue("1.0.0");

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(SAMPLE_GITHUB_RELEASE),
      });

      // @ts-expect-error — accessing private method for testing
      await service.checkForUpdatesViaGitHub();

      // @ts-expect-error — accessing private for testing
      expect(service.updateStatus).toBe("ready");
    });
  });

  // ─── wireAutoUpdaterEvents (win32/darwin) ──────────────────────────────

  describe("wireAutoUpdaterEvents", () => {
    it("should wire all expected autoUpdater events when packaged on win32", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      const registeredEvents = mockAutoUpdaterOn.mock.calls.map(
        ([event]: [string]) => event
      );

      expect(registeredEvents).toContain("checking-for-update");
      expect(registeredEvents).toContain("update-available");
      expect(registeredEvents).toContain("update-not-available");
      expect(registeredEvents).toContain("update-downloaded");
      expect(registeredEvents).toContain("error");
    });

    it("should set updateStatus to 'downloading' on update-available event", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      const updateAvailableHandler = mockAutoUpdaterOn.mock.calls.find(
        ([event]: [string]) => event === "update-available"
      )?.[1];

      expect(updateAvailableHandler).toBeDefined();
      updateAvailableHandler();

      // @ts-expect-error — accessing private for testing
      expect(service.updateStatus).toBe("downloading");
    });

    it("should send indeterminate progress on update-available event", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      const updateAvailableHandler = mockAutoUpdaterOn.mock.calls.find(
        ([event]: [string]) => event === "update-available"
      )?.[1];

      updateAvailableHandler();

      expect(mockWebContentsSend).toHaveBeenCalledWith(
        UpdaterChannel.OnDownloadProgress,
        { percent: -1, transferredBytes: 0, totalBytes: 0 }
      );
    });

    it("should set updateStatus to 'idle' on update-not-available event", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      const handler = mockAutoUpdaterOn.mock.calls.find(
        ([event]: [string]) => event === "update-not-available"
      )?.[1];

      handler();

      // @ts-expect-error — accessing private for testing
      expect(service.updateStatus).toBe("idle");
    });

    it("should handle update-downloaded event: set status, store info, notify renderer", () => {
      mockElectronApp.isPackaged = true;
      mockElectronApp.getVersion.mockReturnValue("1.0.0");
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      const handler = mockAutoUpdaterOn.mock.calls.find(
        ([event]: [string]) => event === "update-downloaded"
      )?.[1];

      handler(
        {}, // _event
        "Release notes here", // releaseNotes
        "Soothsayer v2.0.0", // releaseName
        new Date(), // _releaseDate
        "https://example.com/update" // updateURL
      );

      // @ts-expect-error — accessing private for testing
      expect(service.updateDownloaded).toBe(true);
      // @ts-expect-error — accessing private for testing
      expect(service.updateStatus).toBe("ready");
      // @ts-expect-error — accessing private for testing
      expect(service.lastUpdateInfo).not.toBeNull();
      // @ts-expect-error — accessing private for testing
      expect(service.lastUpdateInfo.latestVersion).toBe("2.0.0");
      // @ts-expect-error — accessing private for testing
      expect(service.lastUpdateInfo.manualDownload).toBe(false);

      expect(mockWebContentsSend).toHaveBeenCalledWith(
        UpdaterChannel.OnUpdateAvailable,
        expect.objectContaining({
          updateAvailable: true,
          latestVersion: "2.0.0",
        })
      );

      // Should send 100% progress
      expect(mockWebContentsSend).toHaveBeenCalledWith(
        UpdaterChannel.OnDownloadProgress,
        expect.objectContaining({ percent: 100 })
      );
    });

    it("should set updateStatus to 'error' on autoUpdater error event", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      const handler = mockAutoUpdaterOn.mock.calls.find(
        ([event]: [string]) => event === "error"
      )?.[1];

      handler(new Error("Update error"));

      // @ts-expect-error — accessing private for testing
      expect(service.updateStatus).toBe("error");
    });
  });

  // ─── Periodic checks ──────────────────────────────────────────────────

  describe("periodic checks", () => {
    it("should schedule an initial check after delay when packaged", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      // The initial check should be scheduled via setTimeout
      // Advance by the initial delay (10 seconds)
      vi.advanceTimersByTime(10_000);

      // checkForUpdates should have been called (via autoUpdater.checkForUpdates on win32)
      expect(mockAutoUpdaterCheckForUpdates).toHaveBeenCalled();
    });

    it("should schedule periodic checks at 10 minute intervals when packaged", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      // Clear calls from initial setup
      mockAutoUpdaterCheckForUpdates.mockClear();

      // Advance past initial delay
      vi.advanceTimersByTime(10_000);
      const callsAfterInitial =
        mockAutoUpdaterCheckForUpdates.mock.calls.length;

      // Advance by one interval (10 minutes)
      mockAutoUpdaterCheckForUpdates.mockClear();
      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(
        mockAutoUpdaterCheckForUpdates.mock.calls.length
      ).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── sendProgress (private — tested via accessor) ─────────────────────

  describe("sendProgress", () => {
    it("should send progress to the renderer via webContents", () => {
      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);
      // @ts-expect-error — accessing private for testing
      service.mainWindow = mockWindow;

      const progress = { percent: 50, transferredBytes: 500, totalBytes: 1000 };
      // @ts-expect-error — accessing private method for testing
      service.sendProgress(progress);

      expect(mockWebContentsSend).toHaveBeenCalledWith(
        UpdaterChannel.OnDownloadProgress,
        progress
      );
    });

    it("should not throw when mainWindow is null", () => {
      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);
      // @ts-expect-error — accessing private for testing
      service.mainWindow = null;

      const progress = { percent: 50, transferredBytes: 500, totalBytes: 1000 };
      expect(() => {
        // @ts-expect-error — accessing private method for testing
        service.sendProgress(progress);
      }).not.toThrow();
    });
  });

  // ─── Edge cases & integration ──────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle release with null body in GetLatestRelease", async () => {
      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      const releaseNullBody = { ...SAMPLE_GITHUB_RELEASE, body: null };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(releaseNullBody),
      });

      const handler = getIpcHandler(UpdaterChannel.GetLatestRelease);
      const result = await handler();

      expect(result).not.toBeNull();
      expect(result.body).toBe("");
    });

    it("should handle release with null name in GetLatestRelease", async () => {
      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      const releaseNullName = { ...SAMPLE_GITHUB_RELEASE, name: null };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(releaseNullName),
      });

      const handler = getIpcHandler(UpdaterChannel.GetLatestRelease);
      const result = await handler();

      expect(result).not.toBeNull();
      expect(result.name).toBe(SAMPLE_GITHUB_RELEASE.tag_name);
    });

    it("should parse changelog with only whitespace lines between entries", () => {
      const md = `## 1.0.0\n\n### Patch Changes\n\n- Entry one\n\n\n- Entry two\n`;
      // @ts-expect-error — accessing private method for testing
      const releases = service.parseChangelog(md);

      expect(releases).toHaveLength(1);
      expect(releases[0].entries).toHaveLength(2);
    });

    it("should handle changelog entry with empty sub-item", () => {
      const md = `## 1.0.0\n\n### Patch Changes\n\n- Main item\n  - \n  - Valid sub\n`;
      // @ts-expect-error — accessing private method for testing
      const releases = service.parseChangelog(md);

      expect(releases).toHaveLength(1);
      expect(releases[0].entries).toHaveLength(1);
      // Empty sub-items should be filtered out
      expect(releases[0].entries[0].subItems).toEqual(["Valid sub"]);
    });

    it("should handle update-downloaded with null releaseName", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      const handler = mockAutoUpdaterOn.mock.calls.find(
        ([event]: [string]) => event === "update-downloaded"
      )?.[1];

      handler(
        {},
        "", // releaseNotes
        null, // releaseName
        new Date(),
        null // updateURL
      );

      // @ts-expect-error — accessing private for testing
      expect(service.lastUpdateInfo).not.toBeNull();
      // @ts-expect-error — accessing private for testing
      expect(service.lastUpdateInfo.latestVersion).toBe("0.0.0");
      // @ts-expect-error — accessing private for testing
      expect(service.lastUpdateInfo.releaseUrl).toContain(
        "github.com/navali-creations/soothsayer/releases/latest"
      );
    });

    it("should handle checkForUpdates error gracefully on win32", () => {
      mockElectronApp.isPackaged = true;
      Object.defineProperty(process, "platform", {
        value: "win32",
        writable: true,
        configurable: true,
      });

      // @ts-expect-error — accessing private static for testing
      UpdaterService._instance = undefined;
      service = UpdaterService.getInstance();

      const mockWindow = createMockBrowserWindow();
      service.initialize(mockWindow);

      mockAutoUpdaterCheckForUpdates.mockImplementation(() => {
        throw new Error("Network error");
      });

      expect(() => service.checkForUpdates()).not.toThrow();
    });
  });
});
