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

function makeStatus(overrides = {}) {
  return {
    hasData: true,
    lastLoadedAt: "2024-01-15T12:00:00.000Z",
    cardCount: 200,
    league: "Settlers",
    appVersion: "1.0.0",
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("ProhibitedLibrary.slice", () => {
  describe("initial state", () => {
    it("has null poe1Status", () => {
      expect(store.getState().prohibitedLibrary.poe1Status).toBeNull();
    });

    it("has null poe2Status", () => {
      expect(store.getState().prohibitedLibrary.poe2Status).toBeNull();
    });

    it("has isLoading set to false", () => {
      expect(store.getState().prohibitedLibrary.isLoading).toBe(false);
    });

    it("has null loadError", () => {
      expect(store.getState().prohibitedLibrary.loadError).toBeNull();
    });
  });

  describe("fetchStatus", () => {
    it("sets isLoading to true while fetching", async () => {
      let capturedLoading = false;
      const deferred = Promise.withResolvers<any>();

      electron.prohibitedLibrary.getStatus.mockImplementation(() => {
        capturedLoading = store.getState().prohibitedLibrary.isLoading;
        return deferred.promise;
      });

      const fetchPromise = store.getState().prohibitedLibrary.fetchStatus();
      deferred.resolve(null);
      await fetchPromise;

      expect(capturedLoading).toBe(true);
    });

    it("clears loadError when starting a fetch", async () => {
      // Put store in an error state first
      electron.prohibitedLibrary.getStatus.mockRejectedValueOnce(
        new Error("prev error"),
      );
      await store.getState().prohibitedLibrary.fetchStatus();
      expect(store.getState().prohibitedLibrary.loadError).toBe("prev error");

      // Now fetch again — error should be cleared at start
      electron.prohibitedLibrary.getStatus.mockResolvedValue(null);
      await store.getState().prohibitedLibrary.fetchStatus();
      expect(store.getState().prohibitedLibrary.loadError).toBeNull();
    });

    it("calls getStatus for both poe1 and poe2 in parallel", async () => {
      electron.prohibitedLibrary.getStatus.mockResolvedValue(null);
      await store.getState().prohibitedLibrary.fetchStatus();

      expect(electron.prohibitedLibrary.getStatus).toHaveBeenCalledWith("poe1");
      expect(electron.prohibitedLibrary.getStatus).toHaveBeenCalledWith("poe2");
      expect(electron.prohibitedLibrary.getStatus).toHaveBeenCalledTimes(2);
    });

    it("stores poe1Status and poe2Status on success", async () => {
      const poe1 = makeStatus({ league: "Settlers", cardCount: 100 });
      const poe2 = makeStatus({ league: "Dawn", cardCount: 50 });

      electron.prohibitedLibrary.getStatus
        .mockResolvedValueOnce(poe1)
        .mockResolvedValueOnce(poe2);

      await store.getState().prohibitedLibrary.fetchStatus();

      const state = store.getState().prohibitedLibrary;
      expect(state.poe1Status).toEqual(poe1);
      expect(state.poe2Status).toEqual(poe2);
    });

    it("sets isLoading to false after success", async () => {
      electron.prohibitedLibrary.getStatus.mockResolvedValue(makeStatus());
      await store.getState().prohibitedLibrary.fetchStatus();

      expect(store.getState().prohibitedLibrary.isLoading).toBe(false);
    });

    it("sets loadError on failure with Error instance", async () => {
      electron.prohibitedLibrary.getStatus.mockRejectedValue(
        new Error("network timeout"),
      );
      await store.getState().prohibitedLibrary.fetchStatus();

      const state = store.getState().prohibitedLibrary;
      expect(state.loadError).toBe("network timeout");
      expect(state.isLoading).toBe(false);
    });

    it("sets a generic loadError on failure with non-Error thrown value", async () => {
      electron.prohibitedLibrary.getStatus.mockRejectedValue("something bad");
      await store.getState().prohibitedLibrary.fetchStatus();

      expect(store.getState().prohibitedLibrary.loadError).toBe(
        "Failed to fetch Prohibited Library status",
      );
    });

    it("handles null status responses", async () => {
      electron.prohibitedLibrary.getStatus.mockResolvedValue(null);
      await store.getState().prohibitedLibrary.fetchStatus();

      const state = store.getState().prohibitedLibrary;
      expect(state.poe1Status).toBeNull();
      expect(state.poe2Status).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.loadError).toBeNull();
    });
  });

  describe("reload", () => {
    it("sets isLoading to true while reloading", async () => {
      let capturedLoading = false;
      const deferred = Promise.withResolvers<any>();

      electron.prohibitedLibrary.reload.mockImplementation(() => {
        capturedLoading = store.getState().prohibitedLibrary.isLoading;
        return deferred.promise;
      });

      const reloadPromise = store.getState().prohibitedLibrary.reload();
      deferred.resolve({
        success: true,
        cardCount: 100,
        league: "Settlers",
        loadedAt: "",
      });
      await reloadPromise;

      expect(capturedLoading).toBe(true);
    });

    it("clears loadError when starting a reload", async () => {
      // Put store in error state
      electron.prohibitedLibrary.getStatus.mockRejectedValueOnce(
        new Error("old error"),
      );
      await store.getState().prohibitedLibrary.fetchStatus();
      expect(store.getState().prohibitedLibrary.loadError).toBe("old error");

      // Reload should clear error
      electron.prohibitedLibrary.reload.mockResolvedValue({
        success: true,
        cardCount: 100,
        league: "Settlers",
        loadedAt: "",
      });
      electron.prohibitedLibrary.getStatus.mockResolvedValue(makeStatus());
      await store.getState().prohibitedLibrary.reload();

      expect(store.getState().prohibitedLibrary.loadError).toBeNull();
    });

    it("calls reload with the currently selected game", async () => {
      // The default selectedGame from settings should be used
      electron.prohibitedLibrary.reload.mockResolvedValue({
        success: true,
        cardCount: 100,
        league: "Settlers",
        loadedAt: "",
      });
      electron.prohibitedLibrary.getStatus.mockResolvedValue(makeStatus());

      await store.getState().prohibitedLibrary.reload();

      expect(electron.prohibitedLibrary.reload).toHaveBeenCalledTimes(1);
      // It should have been called with whatever getSelectedGame returns
      const selectedGame = store.getState().settings.getSelectedGame();
      expect(electron.prohibitedLibrary.reload).toHaveBeenCalledWith(
        selectedGame,
      );
    });

    it("fetches status and reloads cards after successful reload", async () => {
      electron.prohibitedLibrary.reload.mockResolvedValue({
        success: true,
        cardCount: 200,
        league: "Settlers",
        loadedAt: "2024-01-15T12:00:00.000Z",
      });

      const poe1Status = makeStatus({ league: "Settlers" });
      const poe2Status = makeStatus({ league: "Dawn" });
      electron.prohibitedLibrary.getStatus
        .mockResolvedValueOnce(poe1Status)
        .mockResolvedValueOnce(poe2Status);

      await store.getState().prohibitedLibrary.reload();

      // fetchStatus should have been called (which calls getStatus twice)
      expect(electron.prohibitedLibrary.getStatus).toHaveBeenCalledWith("poe1");
      expect(electron.prohibitedLibrary.getStatus).toHaveBeenCalledWith("poe2");

      // cards.loadCards should have been called
      expect(electron.divinationCards.getAll).toHaveBeenCalled();
    });

    it("sets loadError when reload result has success=false", async () => {
      electron.prohibitedLibrary.reload.mockResolvedValue({
        success: false,
        error: "CSV parse failed",
        cardCount: 0,
        league: "",
        loadedAt: "",
      });

      await store.getState().prohibitedLibrary.reload();

      const state = store.getState().prohibitedLibrary;
      expect(state.loadError).toBe("CSV parse failed");
      expect(state.isLoading).toBe(false);
    });

    it("uses generic error when reload result has success=false and no error message", async () => {
      electron.prohibitedLibrary.reload.mockResolvedValue({
        success: false,
        cardCount: 0,
        league: "",
        loadedAt: "",
      });

      await store.getState().prohibitedLibrary.reload();

      expect(store.getState().prohibitedLibrary.loadError).toBe(
        "Reload failed with unknown error",
      );
    });

    it("does not fetch status or reload cards when reload result has success=false", async () => {
      electron.prohibitedLibrary.reload.mockResolvedValue({
        success: false,
        error: "failed",
        cardCount: 0,
        league: "",
        loadedAt: "",
      });

      await store.getState().prohibitedLibrary.reload();

      // getStatus should NOT have been called
      expect(electron.prohibitedLibrary.getStatus).not.toHaveBeenCalled();
    });

    it("sets loadError with Error.message when reload throws an Error", async () => {
      electron.prohibitedLibrary.reload.mockRejectedValue(
        new Error("IPC channel closed"),
      );

      await store.getState().prohibitedLibrary.reload();

      const state = store.getState().prohibitedLibrary;
      expect(state.loadError).toBe("IPC channel closed");
      expect(state.isLoading).toBe(false);
    });

    it("sets a generic loadError when reload throws a non-Error value", async () => {
      electron.prohibitedLibrary.reload.mockRejectedValue(42);

      await store.getState().prohibitedLibrary.reload();

      expect(store.getState().prohibitedLibrary.loadError).toBe(
        "Failed to reload Prohibited Library data",
      );
    });
  });

  describe("startListening", () => {
    it("returns a cleanup function", () => {
      const cleanup = store.getState().prohibitedLibrary.startListening();
      expect(typeof cleanup).toBe("function");
    });

    it("subscribes to onDataRefreshed", () => {
      store.getState().prohibitedLibrary.startListening();
      expect(electron.prohibitedLibrary.onDataRefreshed).toHaveBeenCalledTimes(
        1,
      );
      expect(electron.prohibitedLibrary.onDataRefreshed).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it("subscribes to onLoadError", () => {
      store.getState().prohibitedLibrary.startListening();
      expect(electron.prohibitedLibrary.onLoadError).toHaveBeenCalledTimes(1);
      expect(electron.prohibitedLibrary.onLoadError).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it("calls unsubscribe functions when cleanup is invoked", () => {
      const unsubDataRefreshed = vi.fn();
      const unsubLoadError = vi.fn();

      electron.prohibitedLibrary.onDataRefreshed.mockReturnValue(
        unsubDataRefreshed,
      );
      electron.prohibitedLibrary.onLoadError.mockReturnValue(unsubLoadError);

      const cleanup = store.getState().prohibitedLibrary.startListening();
      cleanup();

      expect(unsubDataRefreshed).toHaveBeenCalledTimes(1);
      expect(unsubLoadError).toHaveBeenCalledTimes(1);
    });

    it("onDataRefreshed handler triggers fetchStatus and loadCards", async () => {
      let dataRefreshedHandler: (game: string) => void = () => {};
      electron.prohibitedLibrary.onDataRefreshed.mockImplementation(
        (cb: (game: string) => void) => {
          dataRefreshedHandler = cb;
          return vi.fn();
        },
      );

      electron.prohibitedLibrary.getStatus.mockResolvedValue(makeStatus());

      store.getState().prohibitedLibrary.startListening();
      dataRefreshedHandler("poe1");

      // Wait for async operations
      await vi.waitFor(() => {
        expect(electron.prohibitedLibrary.getStatus).toHaveBeenCalled();
      });
    });

    it("onLoadError handler sets loadError in state", () => {
      let errorHandler: (error: string) => void = () => {};
      electron.prohibitedLibrary.onLoadError.mockImplementation(
        (cb: (error: string) => void) => {
          errorHandler = cb;
          return vi.fn();
        },
      );

      store.getState().prohibitedLibrary.startListening();
      errorHandler("CSV file not found");

      expect(store.getState().prohibitedLibrary.loadError).toBe(
        "CSV file not found",
      );
    });
  });
});
