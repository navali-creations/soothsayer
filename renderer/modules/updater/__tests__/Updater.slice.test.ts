import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeUpdateInfo(overrides = {}) {
  return {
    updateAvailable: true,
    currentVersion: "1.0.0",
    latestVersion: "2.0.0",
    releaseUrl: "https://github.com/example/releases/tag/v2.0.0",
    releaseName: "v2.0.0",
    releaseNotes: "Bug fixes and improvements",
    publishedAt: "2024-01-15T00:00:00Z",
    downloadUrl: "https://github.com/example/releases/download/v2.0.0/app.exe",
    manualDownload: false,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("UpdaterSlice", () => {
  describe("initial state", () => {
    it("has null updateInfo", () => {
      expect(store.getState().updater.updateInfo).toBeNull();
    });

    it("has updateAvailable as false", () => {
      expect(store.getState().updater.updateAvailable).toBe(false);
    });

    it("has isDismissed as false", () => {
      expect(store.getState().updater.isDismissed).toBe(false);
    });

    it("has status as idle", () => {
      expect(store.getState().updater.status).toBe("idle");
    });

    it("has zeroed downloadProgress", () => {
      expect(store.getState().updater.downloadProgress).toEqual({
        percent: 0,
        transferredBytes: 0,
        totalBytes: 0,
      });
    });

    it("has null error", () => {
      expect(store.getState().updater.error).toBeNull();
    });
  });

  describe("checkForUpdates", () => {
    it("sets updateInfo and updateAvailable when update is available", async () => {
      const info = makeUpdateInfo();
      electron.updater.checkForUpdates.mockResolvedValue(info);

      await store.getState().updater.checkForUpdates();

      const state = store.getState().updater;
      expect(state.updateInfo).toEqual(info);
      expect(state.updateAvailable).toBe(true);
    });

    it("resets isDismissed to false when update is available", async () => {
      // First dismiss, then check for updates
      store.getState().updater.dismiss();
      expect(store.getState().updater.isDismissed).toBe(true);

      const info = makeUpdateInfo();
      electron.updater.checkForUpdates.mockResolvedValue(info);

      await store.getState().updater.checkForUpdates();

      expect(store.getState().updater.isDismissed).toBe(false);
    });

    it("clears error when update is available", async () => {
      const info = makeUpdateInfo();
      electron.updater.checkForUpdates.mockResolvedValue(info);

      await store.getState().updater.checkForUpdates();

      expect(store.getState().updater.error).toBeNull();
    });

    it("sets status to idle when update is found", async () => {
      const info = makeUpdateInfo();
      electron.updater.checkForUpdates.mockResolvedValue(info);

      await store.getState().updater.checkForUpdates();

      expect(store.getState().updater.status).toBe("idle");
    });

    it("does not change state when no update is available", async () => {
      electron.updater.checkForUpdates.mockResolvedValue(null);

      await store.getState().updater.checkForUpdates();

      const state = store.getState().updater;
      expect(state.updateInfo).toBeNull();
      expect(state.updateAvailable).toBe(false);
    });

    it("does not change state when result has updateAvailable=false", async () => {
      const info = makeUpdateInfo({ updateAvailable: false });
      electron.updater.checkForUpdates.mockResolvedValue(info);

      await store.getState().updater.checkForUpdates();

      const state = store.getState().updater;
      expect(state.updateInfo).toBeNull();
      expect(state.updateAvailable).toBe(false);
    });

    it("does not throw on error and leaves state unchanged", async () => {
      electron.updater.checkForUpdates.mockRejectedValue(
        new Error("Network error"),
      );

      await expect(
        store.getState().updater.checkForUpdates(),
      ).resolves.toBeUndefined();

      const state = store.getState().updater;
      expect(state.updateInfo).toBeNull();
      expect(state.updateAvailable).toBe(false);
    });

    it("calls window.electron.updater.checkForUpdates", async () => {
      electron.updater.checkForUpdates.mockResolvedValue(null);

      await store.getState().updater.checkForUpdates();

      expect(electron.updater.checkForUpdates).toHaveBeenCalledOnce();
    });
  });

  describe("downloadAndInstall", () => {
    describe("when status is ready", () => {
      it("calls installUpdate", async () => {
        // Set up the store so status is "ready"
        const info = makeUpdateInfo();
        electron.updater.checkForUpdates.mockResolvedValue(info);
        electron.updater.onUpdateAvailable.mockImplementation((cb: any) => {
          cb(info);
          return vi.fn();
        });

        // Use startListening to get status to "ready"
        const cleanup = store.getState().updater.startListening();

        electron.updater.installUpdate.mockResolvedValue({ success: true });

        await store.getState().updater.downloadAndInstall();

        expect(electron.updater.installUpdate).toHaveBeenCalledOnce();
        cleanup();
      });

      it("clears error before installing", async () => {
        const store = createTestStore({
          updater: { status: "ready", error: "old error" },
        });

        electron.updater.installUpdate.mockResolvedValue({ success: true });

        await store.getState().updater.downloadAndInstall();

        expect(store.getState().updater.error).toBeNull();
      });

      it("sets error status when install fails", async () => {
        const store = createTestStore({
          updater: { status: "ready" },
        });

        electron.updater.installUpdate.mockResolvedValue({
          success: false,
          error: "Install failed: permission denied",
        });

        await store.getState().updater.downloadAndInstall();

        const state = store.getState().updater;
        expect(state.status).toBe("error");
        expect(state.error).toBe("Install failed: permission denied");
      });

      it("sets generic error message when installUpdate returns no error string", async () => {
        const store = createTestStore({
          updater: { status: "ready" },
        });

        electron.updater.installUpdate.mockResolvedValue({
          success: false,
        });

        await store.getState().updater.downloadAndInstall();

        const state = store.getState().updater;
        expect(state.status).toBe("error");
        expect(state.error).toBe("Install failed");
      });
    });

    describe("when status is downloading", () => {
      it("is a no-op and does not call any electron methods", async () => {
        const store = createTestStore({
          updater: { status: "downloading" },
        });

        await store.getState().updater.downloadAndInstall();

        expect(electron.updater.installUpdate).not.toHaveBeenCalled();
        expect(electron.updater.checkForUpdates).not.toHaveBeenCalled();
      });
    });

    describe("when status is idle", () => {
      it("triggers a fresh checkForUpdates", async () => {
        const info = makeUpdateInfo();
        electron.updater.checkForUpdates.mockResolvedValue(info);

        await store.getState().updater.downloadAndInstall();

        expect(electron.updater.checkForUpdates).toHaveBeenCalledOnce();
      });

      it("resets error and status before retrying", async () => {
        const store = createTestStore({
          updater: { status: "idle", error: "previous error" },
        });

        electron.updater.checkForUpdates.mockResolvedValue(null);

        await store.getState().updater.downloadAndInstall();

        const state = store.getState().updater;
        expect(state.error).toBeNull();
        expect(state.status).toBe("idle");
      });

      it("sets updateInfo when retry finds an update", async () => {
        const info = makeUpdateInfo();
        electron.updater.checkForUpdates.mockResolvedValue(info);

        await store.getState().updater.downloadAndInstall();

        const state = store.getState().updater;
        expect(state.updateInfo).toEqual(info);
        expect(state.updateAvailable).toBe(true);
      });

      it("sets error status when retry check fails", async () => {
        electron.updater.checkForUpdates.mockRejectedValue(
          new Error("Retry failed"),
        );

        await store.getState().updater.downloadAndInstall();

        const state = store.getState().updater;
        expect(state.status).toBe("error");
        expect(state.error).toBe("Failed to check for updates");
      });
    });

    describe("when status is error", () => {
      it("triggers a fresh checkForUpdates (same as idle)", async () => {
        const store = createTestStore({
          updater: { status: "error", error: "previous" },
        });

        electron.updater.checkForUpdates.mockResolvedValue(null);

        await store.getState().updater.downloadAndInstall();

        expect(electron.updater.checkForUpdates).toHaveBeenCalledOnce();
      });
    });
  });

  describe("dismiss", () => {
    it("sets isDismissed to true", () => {
      expect(store.getState().updater.isDismissed).toBe(false);

      store.getState().updater.dismiss();

      expect(store.getState().updater.isDismissed).toBe(true);
    });

    it("can be called multiple times without issue", () => {
      store.getState().updater.dismiss();
      store.getState().updater.dismiss();

      expect(store.getState().updater.isDismissed).toBe(true);
    });
  });

  describe("startListening", () => {
    it("returns a cleanup function", () => {
      const cleanup = store.getState().updater.startListening();

      expect(typeof cleanup).toBe("function");
      cleanup();
    });

    it("subscribes to onUpdateAvailable", () => {
      const cleanup = store.getState().updater.startListening();

      expect(electron.updater.onUpdateAvailable).toHaveBeenCalledOnce();
      expect(electron.updater.onUpdateAvailable).toHaveBeenCalledWith(
        expect.any(Function),
      );

      cleanup();
    });

    it("subscribes to onDownloadProgress", () => {
      const cleanup = store.getState().updater.startListening();

      expect(electron.updater.onDownloadProgress).toHaveBeenCalledOnce();
      expect(electron.updater.onDownloadProgress).toHaveBeenCalledWith(
        expect.any(Function),
      );

      cleanup();
    });

    it("updates state when onUpdateAvailable fires", () => {
      const info = makeUpdateInfo();
      let updateAvailableCallback: ((info: any) => void) | undefined;

      electron.updater.onUpdateAvailable.mockImplementation((cb: any) => {
        updateAvailableCallback = cb;
        return vi.fn();
      });

      const cleanup = store.getState().updater.startListening();
      updateAvailableCallback!(info);

      const state = store.getState().updater;
      expect(state.updateInfo).toEqual(info);
      expect(state.updateAvailable).toBe(true);
      expect(state.isDismissed).toBe(false);
      expect(state.status).toBe("ready");

      cleanup();
    });

    it("updates downloadProgress when onDownloadProgress fires", () => {
      let progressCallback: ((progress: any) => void) | undefined;

      electron.updater.onDownloadProgress.mockImplementation((cb: any) => {
        progressCallback = cb;
        return vi.fn();
      });

      const cleanup = store.getState().updater.startListening();
      progressCallback!({
        percent: 50,
        transferredBytes: 5000,
        totalBytes: 10000,
      });

      const state = store.getState().updater;
      expect(state.downloadProgress).toEqual({
        percent: 50,
        transferredBytes: 5000,
        totalBytes: 10000,
      });
      expect(state.status).toBe("downloading");

      cleanup();
    });

    it("does not set status to downloading when progress is 100%", () => {
      let progressCallback: ((progress: any) => void) | undefined;

      electron.updater.onDownloadProgress.mockImplementation((cb: any) => {
        progressCallback = cb;
        return vi.fn();
      });

      const cleanup = store.getState().updater.startListening();
      progressCallback!({
        percent: 100,
        transferredBytes: 10000,
        totalBytes: 10000,
      });

      const state = store.getState().updater;
      expect(state.downloadProgress.percent).toBe(100);
      // When percent is 100, status should NOT be set to "downloading"
      expect(state.status).not.toBe("downloading");

      cleanup();
    });

    it("calls cleanup functions returned by listeners", () => {
      const cleanupUpdate = vi.fn();
      const cleanupProgress = vi.fn();

      electron.updater.onUpdateAvailable.mockReturnValue(cleanupUpdate);
      electron.updater.onDownloadProgress.mockReturnValue(cleanupProgress);

      const cleanup = store.getState().updater.startListening();
      cleanup();

      expect(cleanupUpdate).toHaveBeenCalledOnce();
      expect(cleanupProgress).toHaveBeenCalledOnce();
    });
  });
});
