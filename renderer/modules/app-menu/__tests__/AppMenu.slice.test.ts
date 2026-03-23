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

describe("AppMenuSlice", () => {
  // ── Initial State ────────────────────────────────────────────────────────

  describe("initial state", () => {
    it("has isMaximized set to false", () => {
      expect(store.getState().appMenu.isMaximized).toBe(false);
    });

    it("has isWhatsNewOpen set to false", () => {
      expect(store.getState().appMenu.isWhatsNewOpen).toBe(false);
    });

    it("has whatsNewRelease set to null", () => {
      expect(store.getState().appMenu.whatsNewRelease).toBeNull();
    });

    it("has whatsNewIsLoading set to false", () => {
      expect(store.getState().appMenu.whatsNewIsLoading).toBe(false);
    });

    it("has whatsNewError set to null", () => {
      expect(store.getState().appMenu.whatsNewError).toBeNull();
    });

    it("has whatsNewHasFetched set to false", () => {
      expect(store.getState().appMenu.whatsNewHasFetched).toBe(false);
    });
  });

  // ── hydrate ──────────────────────────────────────────────────────────────

  describe("hydrate", () => {
    it("sets isMaximized from IPC result", async () => {
      electron.mainWindow.isMaximized.mockResolvedValue(true);

      await store.getState().appMenu.hydrate();

      expect(electron.mainWindow.isMaximized).toHaveBeenCalled();
      expect(store.getState().appMenu.isMaximized).toBe(true);
    });

    it("defaults isMaximized to false when IPC returns undefined", async () => {
      electron.mainWindow.isMaximized.mockResolvedValue(undefined);

      await store.getState().appMenu.hydrate();

      expect(store.getState().appMenu.isMaximized).toBe(false);
    });

    it("defaults isMaximized to false when IPC throws", async () => {
      electron.mainWindow.isMaximized.mockRejectedValue(
        new Error("IPC not ready"),
      );

      await store.getState().appMenu.hydrate();

      expect(store.getState().appMenu.isMaximized).toBe(false);
    });

    it("does not trigger openWhatsNew when versions match", async () => {
      electron.mainWindow.isMaximized.mockResolvedValue(false);
      electron.app.getVersion.mockResolvedValue("2.0.0");
      electron.settings.get.mockResolvedValue("2.0.0");

      await store.getState().appMenu.hydrate();

      // No version mismatch → isWhatsNewOpen should remain false
      expect(store.getState().appMenu.isWhatsNewOpen).toBe(false);
    });

    it("does not trigger openWhatsNew when lastSeenAppVersion is null (first launch)", async () => {
      electron.mainWindow.isMaximized.mockResolvedValue(false);
      electron.app.getVersion.mockResolvedValue("1.0.0");
      electron.settings.get.mockResolvedValue(null);

      await store.getState().appMenu.hydrate();

      expect(store.getState().appMenu.isWhatsNewOpen).toBe(false);
    });

    it("triggers openWhatsNew after timeout when versions differ", async () => {
      vi.useFakeTimers();

      electron.mainWindow.isMaximized.mockResolvedValue(false);
      electron.app.getVersion.mockResolvedValue("2.0.0");
      electron.settings.get.mockResolvedValue("1.9.0");
      electron.updater.getLatestRelease.mockResolvedValue({
        version: "2.0.0",
        name: "v2.0.0",
        body: "Release notes",
        publishedAt: "2024-01-01",
        url: "https://example.com",
        changeType: "minor",
        entries: [],
      });

      await store.getState().appMenu.hydrate();

      // Before timeout fires, isWhatsNewOpen should still be false
      expect(store.getState().appMenu.isWhatsNewOpen).toBe(false);

      // Advance timers to trigger the deferred openWhatsNew
      await vi.advanceTimersByTimeAsync(3000);

      expect(store.getState().appMenu.isWhatsNewOpen).toBe(true);

      vi.useRealTimers();
    });

    it("persists current version via settings.set", async () => {
      electron.mainWindow.isMaximized.mockResolvedValue(false);
      electron.app.getVersion.mockResolvedValue("3.0.0");
      electron.settings.get.mockResolvedValue("3.0.0");

      await store.getState().appMenu.hydrate();

      expect(electron.settings.set).toHaveBeenCalledWith(
        "lastSeenAppVersion",
        "3.0.0",
      );
    });

    it("skips version detection when getVersion() returns undefined", async () => {
      electron.mainWindow.isMaximized.mockResolvedValue(false);
      electron.app.getVersion.mockResolvedValue(undefined);

      await store.getState().appMenu.hydrate();

      // settings.set should never be called for lastSeenAppVersion
      expect(electron.settings.set).not.toHaveBeenCalledWith(
        "lastSeenAppVersion",
        expect.anything(),
      );
      // settings.get should never be called for lastSeenAppVersion either
      expect(electron.settings.get).not.toHaveBeenCalledWith(
        "lastSeenAppVersion",
      );
      // isWhatsNewOpen should remain false (no version mismatch logic ran)
      expect(store.getState().appMenu.isWhatsNewOpen).toBe(false);
    });
  });

  // ── Window controls ──────────────────────────────────────────────────────

  describe("minimize", () => {
    it("calls mainWindow.minimize", () => {
      store.getState().appMenu.minimize();

      expect(electron.mainWindow.minimize).toHaveBeenCalledTimes(1);
    });
  });

  describe("maximize", () => {
    it("calls mainWindow.maximize and then updates isMaximized", async () => {
      electron.mainWindow.isMaximized.mockResolvedValue(true);

      await store.getState().appMenu.maximize();

      expect(electron.mainWindow.maximize).toHaveBeenCalledTimes(1);
      expect(electron.mainWindow.isMaximized).toHaveBeenCalled();
      expect(store.getState().appMenu.isMaximized).toBe(true);
    });

    it("sets isMaximized to false when isMaximized returns undefined", async () => {
      electron.mainWindow.isMaximized.mockResolvedValue(undefined);

      await store.getState().appMenu.maximize();

      expect(store.getState().appMenu.isMaximized).toBe(false);
    });
  });

  describe("unmaximize", () => {
    it("calls mainWindow.unmaximize and then updates isMaximized", async () => {
      // Start maximized
      store.getState().appMenu.setIsMaximized(true);
      expect(store.getState().appMenu.isMaximized).toBe(true);

      electron.mainWindow.isMaximized.mockResolvedValue(false);

      await store.getState().appMenu.unmaximize();

      expect(electron.mainWindow.unmaximize).toHaveBeenCalledTimes(1);
      expect(electron.mainWindow.isMaximized).toHaveBeenCalled();
      expect(store.getState().appMenu.isMaximized).toBe(false);
    });

    it("defaults isMaximized to false when isMaximized() returns undefined", async () => {
      // Start maximized so we can verify the fallback resets it
      store.getState().appMenu.setIsMaximized(true);
      expect(store.getState().appMenu.isMaximized).toBe(true);

      electron.mainWindow.isMaximized.mockResolvedValue(undefined);

      await store.getState().appMenu.unmaximize();

      expect(electron.mainWindow.unmaximize).toHaveBeenCalledTimes(1);
      expect(store.getState().appMenu.isMaximized).toBe(false);
    });
  });

  describe("close", () => {
    it("calls mainWindow.close", () => {
      store.getState().appMenu.close();

      expect(electron.mainWindow.close).toHaveBeenCalledTimes(1);
    });
  });

  // ── setIsMaximized ───────────────────────────────────────────────────────

  describe("setIsMaximized", () => {
    it("sets isMaximized to true", () => {
      store.getState().appMenu.setIsMaximized(true);

      expect(store.getState().appMenu.isMaximized).toBe(true);
    });

    it("sets isMaximized to false", () => {
      store.getState().appMenu.setIsMaximized(true);
      store.getState().appMenu.setIsMaximized(false);

      expect(store.getState().appMenu.isMaximized).toBe(false);
    });
  });

  // ── openWhatsNew ─────────────────────────────────────────────────────────

  describe("openWhatsNew", () => {
    it("sets isWhatsNewOpen to true immediately", async () => {
      electron.updater.getLatestRelease.mockResolvedValue(null);

      const promise = store.getState().appMenu.openWhatsNew();

      // Should be open before fetch completes
      expect(store.getState().appMenu.isWhatsNewOpen).toBe(true);

      await promise;
    });

    it("sets whatsNewIsLoading while fetching", async () => {
      let resolvePromise!: (value: unknown) => void;
      electron.updater.getLatestRelease.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const promise = store.getState().appMenu.openWhatsNew();

      expect(store.getState().appMenu.whatsNewIsLoading).toBe(true);

      resolvePromise({
        version: "1.0.0",
        name: "v1.0.0",
        body: "Notes",
        publishedAt: "2024-01-01",
        url: "https://example.com",
        changeType: "major",
        entries: [],
      });
      await promise;

      expect(store.getState().appMenu.whatsNewIsLoading).toBe(false);
    });

    it("fetches and stores release info on success", async () => {
      const releaseInfo = {
        version: "2.1.0",
        name: "v2.1.0",
        body: "## What's new\n- Feature A",
        publishedAt: "2024-06-15T00:00:00Z",
        url: "https://github.com/repo/releases/tag/v2.1.0",
        changeType: "minor",
        entries: [
          { title: "Feature A", description: "A description", content: "" },
        ],
      };

      electron.updater.getLatestRelease.mockResolvedValue(releaseInfo);

      await store.getState().appMenu.openWhatsNew();

      const state = store.getState().appMenu;
      expect(state.whatsNewRelease).toEqual(releaseInfo);
      expect(state.whatsNewIsLoading).toBe(false);
      expect(state.whatsNewHasFetched).toBe(true);
      expect(state.whatsNewError).toBeNull();
    });

    it("sets error when getLatestRelease returns null", async () => {
      electron.updater.getLatestRelease.mockResolvedValue(null);

      await store.getState().appMenu.openWhatsNew();

      const state = store.getState().appMenu;
      expect(state.whatsNewRelease).toBeNull();
      expect(state.whatsNewError).toBe("Could not fetch release information.");
      expect(state.whatsNewIsLoading).toBe(false);
      expect(state.whatsNewHasFetched).toBe(true);
    });

    it("sets error when getLatestRelease throws", async () => {
      electron.updater.getLatestRelease.mockRejectedValue(
        new Error("Rate limited"),
      );

      await store.getState().appMenu.openWhatsNew();

      const state = store.getState().appMenu;
      expect(state.whatsNewError).toBe("Rate limited");
      expect(state.whatsNewIsLoading).toBe(false);
      expect(state.whatsNewHasFetched).toBe(true);
      expect(state.whatsNewRelease).toBeNull();
    });

    it("skips fetch if already fetched with a release", async () => {
      const releaseInfo = {
        version: "1.0.0",
        name: "v1.0.0",
        body: "Notes",
        publishedAt: "2024-01-01",
        url: "https://example.com",
        changeType: "major",
        entries: [],
      };

      electron.updater.getLatestRelease.mockResolvedValue(releaseInfo);

      // First call — fetches
      await store.getState().appMenu.openWhatsNew();
      expect(electron.updater.getLatestRelease).toHaveBeenCalledTimes(1);
      expect(store.getState().appMenu.whatsNewRelease).toEqual(releaseInfo);

      // Close and re-open
      store.getState().appMenu.closeWhatsNew();
      await store.getState().appMenu.openWhatsNew();

      // Should NOT have fetched again
      expect(electron.updater.getLatestRelease).toHaveBeenCalledTimes(1);
      expect(store.getState().appMenu.isWhatsNewOpen).toBe(true);
    });

    it("re-fetches if previous fetch returned null (hasFetched true but release is null)", async () => {
      // First call — null result
      electron.updater.getLatestRelease.mockResolvedValue(null);
      await store.getState().appMenu.openWhatsNew();
      expect(store.getState().appMenu.whatsNewHasFetched).toBe(true);
      expect(store.getState().appMenu.whatsNewRelease).toBeNull();
      expect(electron.updater.getLatestRelease).toHaveBeenCalledTimes(1);

      // Close and re-open — should fetch again because release is null
      store.getState().appMenu.closeWhatsNew();

      const releaseInfo = {
        version: "1.0.0",
        name: "v1.0.0",
        body: "Notes",
        publishedAt: "2024-01-01",
        url: "https://example.com",
        changeType: "major",
        entries: [],
      };
      electron.updater.getLatestRelease.mockResolvedValue(releaseInfo);

      await store.getState().appMenu.openWhatsNew();
      expect(electron.updater.getLatestRelease).toHaveBeenCalledTimes(2);
      expect(store.getState().appMenu.whatsNewRelease).toEqual(releaseInfo);
    });

    it("clears previous error before a new fetch attempt", async () => {
      // First call — error
      electron.updater.getLatestRelease.mockRejectedValue(new Error("Timeout"));
      await store.getState().appMenu.openWhatsNew();
      expect(store.getState().appMenu.whatsNewError).toBe("Timeout");

      // Close and re-open — error should be cleared during fetch start
      store.getState().appMenu.closeWhatsNew();

      const releaseInfo = {
        version: "1.0.0",
        name: "v1.0.0",
        body: "Notes",
        publishedAt: "2024-01-01",
        url: "https://example.com",
        changeType: "major",
        entries: [],
      };
      electron.updater.getLatestRelease.mockResolvedValue(releaseInfo);

      await store.getState().appMenu.openWhatsNew();
      expect(store.getState().appMenu.whatsNewError).toBeNull();
    });
  });

  // ── closeWhatsNew ────────────────────────────────────────────────────────

  describe("closeWhatsNew", () => {
    it("sets isWhatsNewOpen to false", async () => {
      electron.updater.getLatestRelease.mockResolvedValue(null);

      await store.getState().appMenu.openWhatsNew();
      expect(store.getState().appMenu.isWhatsNewOpen).toBe(true);

      store.getState().appMenu.closeWhatsNew();

      expect(store.getState().appMenu.isWhatsNewOpen).toBe(false);
    });

    it("does not clear whatsNewRelease when closing", async () => {
      const releaseInfo = {
        version: "1.0.0",
        name: "v1.0.0",
        body: "Notes",
        publishedAt: "2024-01-01",
        url: "https://example.com",
        changeType: "major",
        entries: [],
      };

      electron.updater.getLatestRelease.mockResolvedValue(releaseInfo);

      await store.getState().appMenu.openWhatsNew();
      store.getState().appMenu.closeWhatsNew();

      expect(store.getState().appMenu.isWhatsNewOpen).toBe(false);
      expect(store.getState().appMenu.whatsNewRelease).toEqual(releaseInfo);
    });
  });
});
