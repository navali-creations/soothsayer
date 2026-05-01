import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";
import type { PoeLeagueWithStatus } from "~/types/poe-league";

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

function makeLeague(id: string, isActive: boolean): PoeLeagueWithStatus {
  return {
    id,
    name: id,
    startAt: "2026-01-01T00:00:00Z",
    endAt: "2026-04-01T00:00:00Z",
    isActive,
  };
}

function setupComplete(installedGames: ("poe1" | "poe2")[] = ["poe1"]) {
  store.getState().setup.setSetupState({
    currentStep: 1,
    isComplete: true,
    selectedGames: installedGames,
    poe1League: "Standard",
    poe2League: "Standard",
    poe1ClientPath: null,
    poe2ClientPath: null,
    telemetryCrashReporting: false,
    telemetryUsageAnalytics: false,
  });
  store.getState().settings.setSetting("installedGames", installedGames);
}

describe("LeaguesSlice", () => {
  it("starts with empty league state", () => {
    expect(store.getState().leagues.poe1Leagues).toEqual([]);
    expect(store.getState().leagues.poe2Leagues).toEqual([]);
    expect(store.getState().leagues.isLoading).toBe(false);
    expect(store.getState().leagues.error).toBeNull();
  });

  it("does not hydrate when setup is incomplete", async () => {
    await store.getState().leagues.hydrate();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(electron.poeLeagues.getAllLeagues).not.toHaveBeenCalled();
  });

  it("hydrates installed games in the background when setup is complete", async () => {
    setupComplete(["poe1", "poe2"]);
    electron.poeLeagues.getAllLeagues.mockResolvedValue([]);

    await store.getState().leagues.hydrate();

    await vi.waitFor(() => {
      expect(electron.poeLeagues.getAllLeagues).toHaveBeenCalledWith("poe1");
      expect(electron.poeLeagues.getAllLeagues).toHaveBeenCalledWith("poe2");
    });
  });

  it("logs the outer hydrate catch when a fetch action throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const originalFetchLeagues = store.getState().leagues.fetchLeagues;
    setupComplete(["poe1"]);

    store.setState((state) => {
      state.leagues.fetchLeagues = async () => {
        throw new Error("unexpected fetch failure");
      };
    });

    await store.getState().leagues.hydrate();

    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "[Leagues] Background historical league fetch failed:",
        expect.any(Error),
      );
    });

    store.setState((state) => {
      state.leagues.fetchLeagues = originalFetchLeagues;
    });
    consoleSpy.mockRestore();
  });

  it("sets loading state while fetchLeagues is pending", async () => {
    let resolveFetch!: (value: PoeLeagueWithStatus[]) => void;
    electron.poeLeagues.getAllLeagues.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const fetchPromise = store.getState().leagues.fetchLeagues("poe1");

    expect(store.getState().leagues.isLoading).toBe(true);
    expect(store.getState().leagues.error).toBeNull();

    resolveFetch([]);
    await fetchPromise;

    expect(store.getState().leagues.isLoading).toBe(false);
  });

  it("populates poe1 and poe2 league arrays on success", async () => {
    const poe1Leagues = [makeLeague("Settlers", true)];
    const poe2Leagues = [makeLeague("Dawn", false)];

    electron.poeLeagues.getAllLeagues.mockResolvedValueOnce(poe1Leagues);
    await store.getState().leagues.fetchLeagues("poe1");
    expect(store.getState().leagues.poe1Leagues).toEqual(poe1Leagues);
    expect(store.getState().leagues.poe2Leagues).toEqual([]);

    electron.poeLeagues.getAllLeagues.mockResolvedValueOnce(poe2Leagues);
    await store.getState().leagues.fetchLeagues("poe2");
    expect(store.getState().leagues.poe2Leagues).toEqual(poe2Leagues);
  });

  it("stores Error messages and fallback messages from failed fetches", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    electron.poeLeagues.getAllLeagues.mockRejectedValueOnce(
      new Error("Network timeout"),
    );
    await store.getState().leagues.fetchLeagues("poe1");
    expect(store.getState().leagues.error).toBe("Network timeout");
    expect(store.getState().leagues.isLoading).toBe(false);

    electron.poeLeagues.getAllLeagues.mockRejectedValueOnce("offline");
    await store.getState().leagues.fetchLeagues("poe2");
    expect(store.getState().leagues.error).toBe(
      "Failed to fetch historical leagues",
    );

    consoleSpy.mockRestore();
  });

  it("refreshes both games", async () => {
    electron.poeLeagues.getAllLeagues.mockImplementation(async (game) =>
      game === "poe1" ? [makeLeague("One", true)] : [makeLeague("Two", true)],
    );

    await store.getState().leagues.refreshLeagues();

    expect(electron.poeLeagues.getAllLeagues).toHaveBeenCalledWith("poe1");
    expect(electron.poeLeagues.getAllLeagues).toHaveBeenCalledWith("poe2");
    expect(store.getState().leagues.poe1Leagues).toHaveLength(1);
    expect(store.getState().leagues.poe2Leagues).toHaveLength(1);
  });

  it("returns all and active leagues for a game", async () => {
    const leagues = [makeLeague("Active", true), makeLeague("Old", false)];
    electron.poeLeagues.getAllLeagues.mockResolvedValue(leagues);

    await store.getState().leagues.fetchLeagues("poe1");

    expect(store.getState().leagues.getLeaguesForGame("poe1")).toEqual(leagues);
    expect(store.getState().leagues.getLeaguesForGame("poe2")).toEqual([]);
    expect(store.getState().leagues.getActiveLeaguesForGame("poe1")).toEqual([
      leagues[0],
    ]);
  });
});
