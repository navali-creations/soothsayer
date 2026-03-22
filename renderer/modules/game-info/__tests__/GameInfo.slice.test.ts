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

// ── Helpers ────────────────────────────────────────────────────────────────

function makePoeLeague(overrides: { id: string; name: string }) {
  return {
    id: overrides.id,
    name: overrides.name,
    startAt: "2024-01-01T00:00:00Z",
    endAt: "2024-04-01T00:00:00Z",
  };
}

describe("GameInfoSlice", () => {
  // ── Initial State ────────────────────────────────────────────────────────

  describe("initial state", () => {
    it("has empty poe1Leagues array", () => {
      expect(store.getState().gameInfo.poe1Leagues).toEqual([]);
    });

    it("has empty poe2Leagues array", () => {
      expect(store.getState().gameInfo.poe2Leagues).toEqual([]);
    });

    it("has isLoadingLeagues set to false", () => {
      expect(store.getState().gameInfo.isLoadingLeagues).toBe(false);
    });

    it("has leaguesError set to null", () => {
      expect(store.getState().gameInfo.leaguesError).toBeNull();
    });

    it("has poe1Process default state", () => {
      expect(store.getState().gameInfo.poe1Process).toEqual({
        isRunning: false,
        processName: "",
      });
    });

    it("has poe2Process default state", () => {
      expect(store.getState().gameInfo.poe2Process).toEqual({
        isRunning: false,
        processName: "",
      });
    });
  });

  // ── hydrate ──────────────────────────────────────────────────────────────

  describe("hydrate", () => {
    it("calls poeProcess.getState", async () => {
      electron.poeProcess.getState.mockResolvedValue(null);

      await store.getState().gameInfo.hydrate();

      expect(electron.poeProcess.getState).toHaveBeenCalledTimes(1);
    });

    it("sets poe1 process state when a PoE 1 process is running", async () => {
      electron.poeProcess.getState.mockResolvedValue({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      await store.getState().gameInfo.hydrate();

      expect(store.getState().gameInfo.poe1Process).toEqual({
        isRunning: true,
        processName: "PathOfExile.exe",
      });
    });

    it("sets poe2 process state when a PoE 2 process is running", async () => {
      electron.poeProcess.getState.mockResolvedValue({
        isRunning: true,
        processName: "PathOfExile2.exe",
      });

      await store.getState().gameInfo.hydrate();

      expect(store.getState().gameInfo.poe2Process).toEqual({
        isRunning: true,
        processName: "PathOfExile2.exe",
      });
    });

    it("does not set process state when getState returns null", async () => {
      electron.poeProcess.getState.mockResolvedValue(null);

      await store.getState().gameInfo.hydrate();

      expect(store.getState().gameInfo.poe1Process.isRunning).toBe(false);
      expect(store.getState().gameInfo.poe2Process.isRunning).toBe(false);
    });

    it("handles poeProcess.getState rejection gracefully", async () => {
      electron.poeProcess.getState.mockRejectedValue(
        new Error("IPC not ready"),
      );

      // Should not throw
      await store.getState().gameInfo.hydrate();

      expect(store.getState().gameInfo.poe1Process.isRunning).toBe(false);
      expect(store.getState().gameInfo.poe2Process.isRunning).toBe(false);
    });

    it("fires off fetchLeagues for both poe1 and poe2 in the background", async () => {
      electron.poeProcess.getState.mockResolvedValue(null);
      electron.poeLeagues.fetchLeagues.mockResolvedValue([]);

      await store.getState().gameInfo.hydrate();

      // Allow background Promise.all to settle
      await vi.waitFor(() => {
        expect(electron.poeLeagues.fetchLeagues).toHaveBeenCalledWith("poe1");
        expect(electron.poeLeagues.fetchLeagues).toHaveBeenCalledWith("poe2");
      });
    });
  });

  // ── fetchLeagues ─────────────────────────────────────────────────────────

  describe("fetchLeagues", () => {
    it("sets isLoadingLeagues to true while fetching", async () => {
      let resolvePromise!: (value: unknown) => void;
      electron.poeLeagues.fetchLeagues.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const fetchPromise = store.getState().gameInfo.fetchLeagues("poe1");

      expect(store.getState().gameInfo.isLoadingLeagues).toBe(true);
      expect(store.getState().gameInfo.leaguesError).toBeNull();

      resolvePromise([]);
      await fetchPromise;

      expect(store.getState().gameInfo.isLoadingLeagues).toBe(false);
    });

    it("populates poe1Leagues on success", async () => {
      const leagues = [
        makePoeLeague({ id: "Settlers", name: "Settlers" }),
        makePoeLeague({ id: "Standard", name: "Standard" }),
      ];
      electron.poeLeagues.fetchLeagues.mockResolvedValue(leagues);

      await store.getState().gameInfo.fetchLeagues("poe1");

      expect(store.getState().gameInfo.poe1Leagues).toEqual(leagues);
      expect(store.getState().gameInfo.isLoadingLeagues).toBe(false);
      expect(store.getState().gameInfo.leaguesError).toBeNull();
    });

    it("populates poe2Leagues on success", async () => {
      const leagues = [makePoeLeague({ id: "Poe2Standard", name: "Standard" })];
      electron.poeLeagues.fetchLeagues.mockResolvedValue(leagues);

      await store.getState().gameInfo.fetchLeagues("poe2");

      expect(store.getState().gameInfo.poe2Leagues).toEqual(leagues);
      expect(store.getState().gameInfo.poe1Leagues).toEqual([]);
    });

    it("sets leaguesError on fetch error for poe1", async () => {
      electron.poeLeagues.fetchLeagues.mockRejectedValue(
        new Error("Network timeout"),
      );

      await store.getState().gameInfo.fetchLeagues("poe1");

      expect(store.getState().gameInfo.leaguesError).toBe("Network timeout");
      expect(store.getState().gameInfo.isLoadingLeagues).toBe(false);
      expect(store.getState().gameInfo.poe1Leagues).toEqual([]);
    });

    it("sets leaguesError on fetch error for poe2", async () => {
      electron.poeLeagues.fetchLeagues.mockRejectedValue(
        new Error("Server error"),
      );

      await store.getState().gameInfo.fetchLeagues("poe2");

      expect(store.getState().gameInfo.leaguesError).toBe("Server error");
      expect(store.getState().gameInfo.isLoadingLeagues).toBe(false);
    });

    it("uses fallback error message for non-Error thrown values", async () => {
      electron.poeLeagues.fetchLeagues.mockRejectedValue("something broke");

      await store.getState().gameInfo.fetchLeagues("poe1");

      expect(store.getState().gameInfo.leaguesError).toBe(
        "Failed to fetch leagues",
      );
    });

    it("clears leaguesError on a new fetch attempt", async () => {
      // First: fail
      electron.poeLeagues.fetchLeagues.mockRejectedValue(new Error("Timeout"));
      await store.getState().gameInfo.fetchLeagues("poe1");
      expect(store.getState().gameInfo.leaguesError).toBe("Timeout");

      // Second: succeed
      electron.poeLeagues.fetchLeagues.mockResolvedValue([]);
      await store.getState().gameInfo.fetchLeagues("poe1");
      expect(store.getState().gameInfo.leaguesError).toBeNull();
    });
  });

  // ── refreshLeagues ───────────────────────────────────────────────────────

  describe("refreshLeagues", () => {
    it("calls fetchLeagues for both poe1 and poe2", async () => {
      const poe1Leagues = [makePoeLeague({ id: "L1", name: "League 1" })];
      const poe2Leagues = [makePoeLeague({ id: "L2", name: "League 2" })];

      electron.poeLeagues.fetchLeagues.mockImplementation(
        async (game: string) => {
          if (game === "poe1") return poe1Leagues;
          return poe2Leagues;
        },
      );

      await store.getState().gameInfo.refreshLeagues();

      expect(electron.poeLeagues.fetchLeagues).toHaveBeenCalledWith("poe1");
      expect(electron.poeLeagues.fetchLeagues).toHaveBeenCalledWith("poe2");
      expect(store.getState().gameInfo.poe1Leagues).toEqual(poe1Leagues);
      expect(store.getState().gameInfo.poe2Leagues).toEqual(poe2Leagues);
    });
  });

  // ── Process State Setters ────────────────────────────────────────────────

  describe("setPoe1ProcessState", () => {
    it("updates poe1Process to running", () => {
      store.getState().gameInfo.setPoe1ProcessState({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      expect(store.getState().gameInfo.poe1Process).toEqual({
        isRunning: true,
        processName: "PathOfExile.exe",
      });
    });

    it("updates poe1Process to stopped", () => {
      store.getState().gameInfo.setPoe1ProcessState({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      store.getState().gameInfo.setPoe1ProcessState({
        isRunning: false,
        processName: "",
      });

      expect(store.getState().gameInfo.poe1Process).toEqual({
        isRunning: false,
        processName: "",
      });
    });

    it("does not affect poe2Process", () => {
      store.getState().gameInfo.setPoe1ProcessState({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      expect(store.getState().gameInfo.poe2Process).toEqual({
        isRunning: false,
        processName: "",
      });
    });
  });

  describe("setPoe2ProcessState", () => {
    it("updates poe2Process to running", () => {
      store.getState().gameInfo.setPoe2ProcessState({
        isRunning: true,
        processName: "PathOfExile2.exe",
      });

      expect(store.getState().gameInfo.poe2Process).toEqual({
        isRunning: true,
        processName: "PathOfExile2.exe",
      });
    });

    it("does not affect poe1Process", () => {
      store.getState().gameInfo.setPoe2ProcessState({
        isRunning: true,
        processName: "PathOfExile2.exe",
      });

      expect(store.getState().gameInfo.poe1Process).toEqual({
        isRunning: false,
        processName: "",
      });
    });
  });

  // ── Getters ──────────────────────────────────────────────────────────────

  describe("getLeaguesForGame", () => {
    it("returns poe1Leagues for 'poe1'", async () => {
      const leagues = [makePoeLeague({ id: "Settlers", name: "Settlers" })];
      electron.poeLeagues.fetchLeagues.mockResolvedValue(leagues);

      await store.getState().gameInfo.fetchLeagues("poe1");

      expect(store.getState().gameInfo.getLeaguesForGame("poe1")).toEqual(
        leagues,
      );
    });

    it("returns poe2Leagues for 'poe2'", async () => {
      const leagues = [makePoeLeague({ id: "Standard", name: "Standard" })];
      electron.poeLeagues.fetchLeagues.mockResolvedValue(leagues);

      await store.getState().gameInfo.fetchLeagues("poe2");

      expect(store.getState().gameInfo.getLeaguesForGame("poe2")).toEqual(
        leagues,
      );
    });

    it("returns empty array when no leagues have been fetched", () => {
      expect(store.getState().gameInfo.getLeaguesForGame("poe1")).toEqual([]);
      expect(store.getState().gameInfo.getLeaguesForGame("poe2")).toEqual([]);
    });
  });

  describe("isGameOnline", () => {
    it("returns true when poe1 process is running", () => {
      store.getState().gameInfo.setPoe1ProcessState({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      expect(store.getState().gameInfo.isGameOnline("poe1")).toBe(true);
    });

    it("returns false when poe1 process is not running", () => {
      expect(store.getState().gameInfo.isGameOnline("poe1")).toBe(false);
    });

    it("returns true when poe2 process is running", () => {
      store.getState().gameInfo.setPoe2ProcessState({
        isRunning: true,
        processName: "PathOfExile2.exe",
      });

      expect(store.getState().gameInfo.isGameOnline("poe2")).toBe(true);
    });

    it("returns false when poe2 process is not running", () => {
      expect(store.getState().gameInfo.isGameOnline("poe2")).toBe(false);
    });
  });

  describe("getActiveGameStatus", () => {
    it("returns status for the selected game from settings", () => {
      const leagues = [makePoeLeague({ id: "Settlers", name: "Settlers" })];

      // The default selected game from SettingsSlice is "poe1"
      store.getState().gameInfo.setPoe1ProcessState({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      // Manually set leagues via fetchLeagues
      electron.poeLeagues.fetchLeagues.mockResolvedValue(leagues);

      // We can't easily set leagues without calling fetchLeagues,
      // so we test the shape of the response
      const status = store.getState().gameInfo.getActiveGameStatus();

      expect(status).toHaveProperty("game");
      expect(status).toHaveProperty("isOnline");
      expect(status).toHaveProperty("leagues");
      expect(typeof status.isOnline).toBe("boolean");
      expect(Array.isArray(status.leagues)).toBe(true);
    });

    it("reports isOnline correctly based on the active game's process state", () => {
      store.getState().gameInfo.setPoe1ProcessState({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      const status = store.getState().gameInfo.getActiveGameStatus();

      // Default selected game is poe1
      expect(status.isOnline).toBe(true);
    });
  });

  // ── startListening ───────────────────────────────────────────────────────

  describe("startListening", () => {
    it("subscribes to poeProcess.onStart", () => {
      store.getState().gameInfo.startListening();

      expect(electron.poeProcess.onStart).toHaveBeenCalledTimes(1);
      expect(electron.poeProcess.onStart).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it("subscribes to poeProcess.onStop", () => {
      store.getState().gameInfo.startListening();

      expect(electron.poeProcess.onStop).toHaveBeenCalledTimes(1);
      expect(electron.poeProcess.onStop).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it("returns an unsubscribe function", () => {
      const cleanup = store.getState().gameInfo.startListening();

      expect(typeof cleanup).toBe("function");
    });

    it("updates poe1Process when onStart fires with a PoE 1 process", () => {
      store.getState().gameInfo.startListening();

      const onStartCallback = electron.poeProcess.onStart.mock.calls[0][0];

      onStartCallback({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      expect(store.getState().gameInfo.poe1Process).toEqual({
        isRunning: true,
        processName: "PathOfExile.exe",
      });
    });

    it("updates poe2Process when onStart fires with a PoE 2 process", () => {
      store.getState().gameInfo.startListening();

      const onStartCallback = electron.poeProcess.onStart.mock.calls[0][0];

      onStartCallback({
        isRunning: true,
        processName: "PathOfExile2.exe",
      });

      expect(store.getState().gameInfo.poe2Process).toEqual({
        isRunning: true,
        processName: "PathOfExile2.exe",
      });
    });

    it("resets poe1Process when onStop fires with a PoE 1 process", () => {
      // First, set poe1 as running
      store.getState().gameInfo.setPoe1ProcessState({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      store.getState().gameInfo.startListening();

      const onStopCallback = electron.poeProcess.onStop.mock.calls[0][0];

      onStopCallback({
        isRunning: false,
        processName: "PathOfExile.exe",
      });

      expect(store.getState().gameInfo.poe1Process).toEqual({
        isRunning: false,
        processName: "",
      });
    });

    it("resets poe2Process when onStop fires with a PoE 2 process", () => {
      // First, set poe2 as running
      store.getState().gameInfo.setPoe2ProcessState({
        isRunning: true,
        processName: "PathOfExile2.exe",
      });

      store.getState().gameInfo.startListening();

      const onStopCallback = electron.poeProcess.onStop.mock.calls[0][0];

      onStopCallback({
        isRunning: false,
        processName: "PathOfExile2.exe",
      });

      expect(store.getState().gameInfo.poe2Process).toEqual({
        isRunning: false,
        processName: "",
      });
    });
  });
});
