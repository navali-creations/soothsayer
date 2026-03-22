import { beforeEach, describe, expect, it } from "vitest";

import type {
  LeagueStorageUsage,
  StorageInfo,
} from "~/main/modules/storage/Storage.types";
import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeStorageInfo(overrides?: Partial<StorageInfo>): StorageInfo {
  return {
    appDataPath: "/mock/app-data",
    appDataSizeBytes: 1_000_000,
    dbSizeBytes: 500_000,
    diskTotalBytes: 100_000_000_000,
    diskFreeBytes: 50_000_000_000,
    dbDiskTotalBytes: 100_000_000_000,
    dbDiskFreeBytes: 50_000_000_000,
    breakdown: [
      {
        label: "Database",
        category: "database",
        sizeBytes: 500_000,
        fileCount: 1,
      },
    ],
    ...overrides,
  };
}

function makeLeagueUsage(
  overrides?: Partial<LeagueStorageUsage>,
): LeagueStorageUsage {
  return {
    leagueId: "league-1",
    leagueName: "Settlers",
    game: "poe1",
    sessionCount: 5,
    snapshotCount: 10,
    estimatedSizeBytes: 200_000,
    hasActiveSession: false,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

describe("StorageSlice", () => {
  // ── Initial state ──────────────────────────────────────────────────────

  describe("initial state", () => {
    it("has null info", () => {
      expect(store.getState().storage.info).toBeNull();
    });

    it("has empty leagueUsage array", () => {
      expect(store.getState().storage.leagueUsage).toEqual([]);
    });

    it("has isLoading set to false", () => {
      expect(store.getState().storage.isLoading).toBe(false);
    });

    it("has null error", () => {
      expect(store.getState().storage.error).toBeNull();
    });

    it("has isDiskLow set to false", () => {
      expect(store.getState().storage.isDiskLow).toBe(false);
    });

    it("has null deletingLeagueId", () => {
      expect(store.getState().storage.deletingLeagueId).toBeNull();
    });
  });

  // ── fetchStorageInfo ───────────────────────────────────────────────────

  describe("fetchStorageInfo", () => {
    it("sets isLoading to true while fetching", async () => {
      // Create a deferred promise to control resolution timing
      let resolve!: (v: any) => void;
      const deferred = new Promise((r) => {
        resolve = r;
      });
      electron.storage.getInfo.mockReturnValue(deferred);
      electron.storage.checkDiskSpace.mockResolvedValue({
        diskFreeBytes: 1_000_000,
        isLow: false,
      });

      const promise = store.getState().storage.fetchStorageInfo();

      expect(store.getState().storage.isLoading).toBe(true);
      expect(store.getState().storage.error).toBeNull();

      resolve(makeStorageInfo());
      await promise;
    });

    it("sets info and isDiskLow on success", async () => {
      const info = makeStorageInfo({ dbSizeBytes: 750_000 });
      electron.storage.getInfo.mockResolvedValue(info);
      electron.storage.checkDiskSpace.mockResolvedValue({
        diskFreeBytes: 100,
        isLow: true,
      });

      await store.getState().storage.fetchStorageInfo();

      const state = store.getState().storage;
      expect(state.info).toEqual(info);
      expect(state.isDiskLow).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("sets isDiskLow to false when disk has plenty of space", async () => {
      electron.storage.getInfo.mockResolvedValue(makeStorageInfo());
      electron.storage.checkDiskSpace.mockResolvedValue({
        diskFreeBytes: 50_000_000_000,
        isLow: false,
      });

      await store.getState().storage.fetchStorageInfo();

      expect(store.getState().storage.isDiskLow).toBe(false);
    });

    it("calls getInfo and checkDiskSpace in parallel", async () => {
      electron.storage.getInfo.mockResolvedValue(makeStorageInfo());
      electron.storage.checkDiskSpace.mockResolvedValue({
        diskFreeBytes: 1_000_000,
        isLow: false,
      });

      await store.getState().storage.fetchStorageInfo();

      expect(electron.storage.getInfo).toHaveBeenCalledTimes(1);
      expect(electron.storage.checkDiskSpace).toHaveBeenCalledTimes(1);
    });

    it("sets error on failure and clears isLoading", async () => {
      electron.storage.getInfo.mockRejectedValue(new Error("DB file locked"));
      electron.storage.checkDiskSpace.mockResolvedValue({
        diskFreeBytes: 1_000_000,
        isLow: false,
      });

      await store.getState().storage.fetchStorageInfo();

      const state = store.getState().storage;
      expect(state.error).toBe("DB file locked");
      expect(state.isLoading).toBe(false);
      expect(state.info).toBeNull();
    });

    it("sets generic error message for non-Error thrown values", async () => {
      electron.storage.getInfo.mockRejectedValue("something went wrong");
      electron.storage.checkDiskSpace.mockResolvedValue({
        diskFreeBytes: 1_000_000,
        isLow: false,
      });

      await store.getState().storage.fetchStorageInfo();

      expect(store.getState().storage.error).toBe(
        "Failed to fetch storage info",
      );
    });
  });

  // ── fetchLeagueUsage ──────────────────────────────────────────────────

  describe("fetchLeagueUsage", () => {
    it("sets isLoading to true while fetching", async () => {
      let resolve!: (v: any) => void;
      const deferred = new Promise((r) => {
        resolve = r;
      });
      electron.storage.getLeagueUsage.mockReturnValue(deferred);

      const promise = store.getState().storage.fetchLeagueUsage();

      expect(store.getState().storage.isLoading).toBe(true);

      resolve([]);
      await promise;
    });

    it("populates leagueUsage on success", async () => {
      const leagues = [
        makeLeagueUsage({ leagueId: "l-1", leagueName: "Settlers" }),
        makeLeagueUsage({
          leagueId: "l-2",
          leagueName: "Standard",
          game: "poe2",
        }),
      ];
      electron.storage.getLeagueUsage.mockResolvedValue(leagues);

      await store.getState().storage.fetchLeagueUsage();

      const state = store.getState().storage;
      expect(state.leagueUsage).toEqual(leagues);
      expect(state.leagueUsage).toHaveLength(2);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("handles empty league usage array", async () => {
      electron.storage.getLeagueUsage.mockResolvedValue([]);

      await store.getState().storage.fetchLeagueUsage();

      expect(store.getState().storage.leagueUsage).toEqual([]);
      expect(store.getState().storage.isLoading).toBe(false);
    });

    it("sets error on failure", async () => {
      electron.storage.getLeagueUsage.mockRejectedValue(
        new Error("Query timeout"),
      );

      await store.getState().storage.fetchLeagueUsage();

      const state = store.getState().storage;
      expect(state.error).toBe("Query timeout");
      expect(state.isLoading).toBe(false);
    });

    it("sets generic error for non-Error thrown values", async () => {
      electron.storage.getLeagueUsage.mockRejectedValue(42);

      await store.getState().storage.fetchLeagueUsage();

      expect(store.getState().storage.error).toBe(
        "Failed to fetch league usage",
      );
    });
  });

  // ── deleteLeagueData ──────────────────────────────────────────────────

  describe("deleteLeagueData", () => {
    it("sets deletingLeagueId while deleting", async () => {
      let resolve!: (v: any) => void;
      const deferred = new Promise((r) => {
        resolve = r;
      });
      electron.storage.deleteLeagueData.mockReturnValue(deferred);
      electron.storage.getInfo.mockResolvedValue(makeStorageInfo());
      electron.storage.checkDiskSpace.mockResolvedValue({
        diskFreeBytes: 1_000_000,
        isLow: false,
      });
      electron.storage.getLeagueUsage.mockResolvedValue([]);

      const promise = store.getState().storage.deleteLeagueData("league-42");

      expect(store.getState().storage.deletingLeagueId).toBe("league-42");
      expect(store.getState().storage.error).toBeNull();

      resolve({ success: true, freedBytes: 1000 });
      await promise;
    });

    it("refreshes storage info and league usage after successful deletion", async () => {
      const updatedInfo = makeStorageInfo({ dbSizeBytes: 100_000 });
      const updatedLeagues = [
        makeLeagueUsage({ leagueId: "l-2", leagueName: "Standard" }),
      ];

      electron.storage.deleteLeagueData.mockResolvedValue({
        success: true,
        freedBytes: 50_000,
      });
      electron.storage.getInfo.mockResolvedValue(updatedInfo);
      electron.storage.checkDiskSpace.mockResolvedValue({
        diskFreeBytes: 1_000_000,
        isLow: false,
      });
      electron.storage.getLeagueUsage.mockResolvedValue(updatedLeagues);

      const result = await store
        .getState()
        .storage.deleteLeagueData("league-1");

      expect(result).toEqual({ success: true, freedBytes: 50_000 });

      // Verify refresh calls were made
      expect(electron.storage.getInfo).toHaveBeenCalled();
      expect(electron.storage.getLeagueUsage).toHaveBeenCalled();

      const state = store.getState().storage;
      expect(state.info).toEqual(updatedInfo);
      expect(state.leagueUsage).toEqual(updatedLeagues);
      expect(state.deletingLeagueId).toBeNull();
    });

    it("sets error and returns failure when IPC returns success: false", async () => {
      electron.storage.deleteLeagueData.mockResolvedValue({
        success: false,
        freedBytes: 0,
        error: "League has active session",
      });

      const result = await store
        .getState()
        .storage.deleteLeagueData("league-1");

      expect(result).toEqual({ success: false, freedBytes: 0 });
      expect(store.getState().storage.error).toBe("League has active session");
      expect(store.getState().storage.deletingLeagueId).toBeNull();
    });

    it("uses default error message when IPC returns no error string", async () => {
      electron.storage.deleteLeagueData.mockResolvedValue({
        success: false,
        freedBytes: 0,
      });

      await store.getState().storage.deleteLeagueData("league-1");

      expect(store.getState().storage.error).toBe(
        "Failed to delete league data",
      );
    });

    it("sets error and returns failure on exception", async () => {
      electron.storage.deleteLeagueData.mockRejectedValue(
        new Error("IPC channel closed"),
      );

      const result = await store
        .getState()
        .storage.deleteLeagueData("league-1");

      expect(result).toEqual({ success: false, freedBytes: 0 });
      expect(store.getState().storage.error).toBe("IPC channel closed");
      expect(store.getState().storage.deletingLeagueId).toBeNull();
    });

    it("sets generic error for non-Error thrown values on exception", async () => {
      electron.storage.deleteLeagueData.mockRejectedValue(undefined);

      const result = await store
        .getState()
        .storage.deleteLeagueData("league-1");

      expect(result).toEqual({ success: false, freedBytes: 0 });
      expect(store.getState().storage.error).toBe(
        "Failed to delete league data",
      );
    });
  });

  // ── checkDiskSpace ────────────────────────────────────────────────────

  describe("checkDiskSpace", () => {
    it("sets isDiskLow to true when disk space is low", async () => {
      electron.storage.checkDiskSpace.mockResolvedValue({
        diskFreeBytes: 50_000,
        isLow: true,
      });

      await store.getState().storage.checkDiskSpace();

      expect(store.getState().storage.isDiskLow).toBe(true);
    });

    it("sets isDiskLow to false when disk space is adequate", async () => {
      // First set it to true via overrides
      store = createTestStore({
        storage: { isDiskLow: true },
      });

      electron.storage.checkDiskSpace.mockResolvedValue({
        diskFreeBytes: 50_000_000_000,
        isLow: false,
      });

      await store.getState().storage.checkDiskSpace();

      expect(store.getState().storage.isDiskLow).toBe(false);
    });

    it("does not set error on failure (silent fail)", async () => {
      electron.storage.checkDiskSpace.mockRejectedValue(
        new Error("Permission denied"),
      );

      await store.getState().storage.checkDiskSpace();

      // checkDiskSpace only logs on error, doesn't set state.error
      expect(store.getState().storage.error).toBeNull();
      expect(store.getState().storage.isDiskLow).toBe(false);
    });
  });
});
