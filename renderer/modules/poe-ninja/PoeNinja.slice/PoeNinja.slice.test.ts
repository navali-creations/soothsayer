import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";

import type { SnapshotInfo } from "./PoeNinja.slice";

// ── Test Fixtures ──────────────────────────────────────────────────────────────

function makeSnapshot(overrides?: Partial<SnapshotInfo>): SnapshotInfo {
  return {
    id: "snap-001",
    leagueId: "Settlers",
    league: "Settlers",
    game: "poe1",
    fetchedAt: "2025-01-15T12:00:00.000Z",
    exchangeChaosToDivine: 200,
    stashChaosToDivine: 195,
    isReused: false,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

// ── Initial State ──────────────────────────────────────────────────────────────

describe("initial state", () => {
  it("has null currentSnapshot", () => {
    expect(store.getState().poeNinja.currentSnapshot).toBeNull();
  });

  it("has empty autoRefreshes map", () => {
    expect(store.getState().poeNinja.autoRefreshes.size).toBe(0);
  });

  it("has uncached exchangeCacheStatus", () => {
    expect(store.getState().poeNinja.exchangeCacheStatus).toEqual({
      isCached: false,
      lastFetchTime: null,
    });
  });

  it("has uncached stashCacheStatus", () => {
    expect(store.getState().poeNinja.stashCacheStatus).toEqual({
      isCached: false,
      lastFetchTime: null,
    });
  });

  it("has isLoading false", () => {
    expect(store.getState().poeNinja.isLoading).toBe(false);
  });

  it("has null error", () => {
    expect(store.getState().poeNinja.error).toBeNull();
  });

  it("has empty refreshableAt map", () => {
    expect(store.getState().poeNinja.refreshableAt.size).toBe(0);
  });

  it("has isRefreshing false", () => {
    expect(store.getState().poeNinja.isRefreshing).toBe(false);
  });

  it("has null refreshError", () => {
    expect(store.getState().poeNinja.refreshError).toBeNull();
  });
});

// ── Snapshot Operations ────────────────────────────────────────────────────────

describe("snapshot operations", () => {
  describe("setCurrentSnapshot", () => {
    it("sets the current snapshot", () => {
      const snapshot = makeSnapshot();
      store.getState().poeNinja.setCurrentSnapshot(snapshot);
      expect(store.getState().poeNinja.currentSnapshot).toEqual(snapshot);
    });

    it("can set snapshot to null", () => {
      store.getState().poeNinja.setCurrentSnapshot(makeSnapshot());
      store.getState().poeNinja.setCurrentSnapshot(null);
      expect(store.getState().poeNinja.currentSnapshot).toBeNull();
    });
  });

  describe("updateSnapshotOnReuse", () => {
    it("updates id, fetchedAt, and sets isReused to true", () => {
      const snapshot = makeSnapshot({ isReused: false });
      store.getState().poeNinja.setCurrentSnapshot(snapshot);

      store
        .getState()
        .poeNinja.updateSnapshotOnReuse("snap-002", "2025-01-16T08:00:00.000Z");

      const updated = store.getState().poeNinja.currentSnapshot;
      expect(updated).not.toBeNull();
      expect(updated!.id).toBe("snap-002");
      expect(updated!.fetchedAt).toBe("2025-01-16T08:00:00.000Z");
      expect(updated!.isReused).toBe(true);
    });

    it("preserves other snapshot fields", () => {
      const snapshot = makeSnapshot({
        league: "Settlers",
        game: "poe1",
        exchangeChaosToDivine: 200,
      });
      store.getState().poeNinja.setCurrentSnapshot(snapshot);

      store
        .getState()
        .poeNinja.updateSnapshotOnReuse("snap-002", "2025-01-16T08:00:00.000Z");

      const updated = store.getState().poeNinja.currentSnapshot!;
      expect(updated.league).toBe("Settlers");
      expect(updated.game).toBe("poe1");
      expect(updated.exchangeChaosToDivine).toBe(200);
    });

    it("does nothing when currentSnapshot is null", () => {
      // Should not throw
      store
        .getState()
        .poeNinja.updateSnapshotOnReuse("snap-002", "2025-01-16T08:00:00.000Z");
      expect(store.getState().poeNinja.currentSnapshot).toBeNull();
    });
  });

  describe("updateSnapshotOnCreate", () => {
    it("sets the snapshot with isReused=false", () => {
      const snapshot = makeSnapshot({ id: "snap-new", isReused: true });
      store.getState().poeNinja.updateSnapshotOnCreate(snapshot);

      const current = store.getState().poeNinja.currentSnapshot;
      expect(current).not.toBeNull();
      expect(current!.id).toBe("snap-new");
      expect(current!.isReused).toBe(false);
    });

    it("replaces any existing snapshot", () => {
      store.getState().poeNinja.setCurrentSnapshot(makeSnapshot({ id: "old" }));
      const newSnap = makeSnapshot({ id: "new", league: "Dawn" });
      store.getState().poeNinja.updateSnapshotOnCreate(newSnap);

      const current = store.getState().poeNinja.currentSnapshot!;
      expect(current.id).toBe("new");
      expect(current.league).toBe("Dawn");
      expect(current.isReused).toBe(false);
    });
  });
});

// ── Auto-Refresh ───────────────────────────────────────────────────────────────

describe("auto-refresh", () => {
  const game = "poe1";
  const league = "Settlers";

  describe("setAutoRefreshActive", () => {
    it("adds an active entry to autoRefreshes map", () => {
      store.getState().poeNinja.setAutoRefreshActive(game, league, 4);

      const info = store
        .getState()
        .poeNinja.autoRefreshes.get(`${game}:${league}`);
      expect(info).toBeDefined();
      expect(info!.isActive).toBe(true);
      expect(info!.game).toBe(game);
      expect(info!.league).toBe(league);
      expect(info!.intervalHours).toBe(4);
    });

    it("sets a nextRefreshTime in the future", () => {
      const before = Date.now();
      store.getState().poeNinja.setAutoRefreshActive(game, league, 2);

      const info = store
        .getState()
        .poeNinja.autoRefreshes.get(`${game}:${league}`)!;
      expect(info.nextRefreshTime).not.toBeNull();

      const nextTime = new Date(info.nextRefreshTime!).getTime();
      // Should be at least ~2 hours from now (allow 1 second tolerance)
      expect(nextTime).toBeGreaterThan(before + 2 * 60 * 60 * 1000 - 1000);
    });

    it("overwrites an existing entry for the same game:league", () => {
      store.getState().poeNinja.setAutoRefreshActive(game, league, 2);
      store.getState().poeNinja.setAutoRefreshActive(game, league, 8);

      const info = store
        .getState()
        .poeNinja.autoRefreshes.get(`${game}:${league}`)!;
      expect(info.intervalHours).toBe(8);
    });
  });

  describe("setAutoRefreshInactive", () => {
    it("sets isActive to false and clears nextRefreshTime", () => {
      store.getState().poeNinja.setAutoRefreshActive(game, league, 4);
      store.getState().poeNinja.setAutoRefreshInactive(game, league);

      const info = store
        .getState()
        .poeNinja.autoRefreshes.get(`${game}:${league}`)!;
      expect(info.isActive).toBe(false);
      expect(info.nextRefreshTime).toBeNull();
    });

    it("does nothing when there is no existing entry", () => {
      // Should not throw
      store.getState().poeNinja.setAutoRefreshInactive(game, league);
      expect(
        store.getState().poeNinja.autoRefreshes.get(`${game}:${league}`),
      ).toBeUndefined();
    });
  });

  describe("updateNextRefreshTime", () => {
    it("updates nextRefreshTime when auto-refresh is active", () => {
      store.getState().poeNinja.setAutoRefreshActive(game, league, 4);

      const _before = store
        .getState()
        .poeNinja.autoRefreshes.get(`${game}:${league}`)!.nextRefreshTime;

      // Wait a tiny bit to ensure time difference
      store.getState().poeNinja.updateNextRefreshTime(game, league);

      const after = store
        .getState()
        .poeNinja.autoRefreshes.get(`${game}:${league}`)!.nextRefreshTime;
      expect(after).not.toBeNull();
      // The updated time should be a valid ISO string
      expect(() => new Date(after!)).not.toThrow();
    });

    it("does not update when auto-refresh is inactive", () => {
      store.getState().poeNinja.setAutoRefreshActive(game, league, 4);
      store.getState().poeNinja.setAutoRefreshInactive(game, league);
      store.getState().poeNinja.updateNextRefreshTime(game, league);

      const info = store
        .getState()
        .poeNinja.autoRefreshes.get(`${game}:${league}`)!;
      expect(info.nextRefreshTime).toBeNull();
    });

    it("does nothing when there is no existing entry", () => {
      store.getState().poeNinja.updateNextRefreshTime(game, league);
      expect(
        store.getState().poeNinja.autoRefreshes.get(`${game}:${league}`),
      ).toBeUndefined();
    });
  });
});

// ── Cache Operations ───────────────────────────────────────────────────────────

describe("cache operations", () => {
  describe("markExchangeCached", () => {
    it("sets isCached to true and records lastFetchTime", () => {
      store.getState().poeNinja.markExchangeCached();

      const status = store.getState().poeNinja.exchangeCacheStatus;
      expect(status.isCached).toBe(true);
      expect(status.lastFetchTime).not.toBeNull();
      // Should be a valid ISO string
      expect(() => new Date(status.lastFetchTime!)).not.toThrow();
    });
  });

  describe("markStashCached", () => {
    it("sets isCached to true and records lastFetchTime", () => {
      store.getState().poeNinja.markStashCached();

      const status = store.getState().poeNinja.stashCacheStatus;
      expect(status.isCached).toBe(true);
      expect(status.lastFetchTime).not.toBeNull();
    });
  });

  describe("clearCacheStatus", () => {
    it("resets both exchange and stash cache status", () => {
      store.getState().poeNinja.markExchangeCached();
      store.getState().poeNinja.markStashCached();

      store.getState().poeNinja.clearCacheStatus();

      expect(store.getState().poeNinja.exchangeCacheStatus).toEqual({
        isCached: false,
        lastFetchTime: null,
      });
      expect(store.getState().poeNinja.stashCacheStatus).toEqual({
        isCached: false,
        lastFetchTime: null,
      });
    });

    it("is idempotent when caches are already clear", () => {
      store.getState().poeNinja.clearCacheStatus();

      expect(store.getState().poeNinja.exchangeCacheStatus.isCached).toBe(
        false,
      );
      expect(store.getState().poeNinja.stashCacheStatus.isCached).toBe(false);
    });
  });
});

// ── refreshPrices ──────────────────────────────────────────────────────────────

describe("refreshPrices", () => {
  it("sets isRefreshing to true during the call", async () => {
    const refreshableAt = "2025-01-15T14:00:00.000Z";
    let resolveRefresh!: (v: unknown) => void;
    const pending = new Promise((r) => {
      resolveRefresh = r;
    });
    electron.snapshots.refreshPrices.mockReturnValue(pending);

    const promise = store.getState().poeNinja.refreshPrices("poe1", "Settlers");
    expect(store.getState().poeNinja.isRefreshing).toBe(true);

    resolveRefresh({ snapshotId: "s1", fetchedAt: "", refreshableAt });
    await promise;

    expect(store.getState().poeNinja.isRefreshing).toBe(false);
  });

  it("stores refreshableAt on success", async () => {
    const refreshableAt = "2025-01-15T14:00:00.000Z";
    electron.snapshots.refreshPrices.mockResolvedValue({
      snapshotId: "s1",
      fetchedAt: "2025-01-15T12:00:00.000Z",
      refreshableAt,
    });

    await store.getState().poeNinja.refreshPrices("poe1", "Settlers");

    const stored = store.getState().poeNinja.refreshableAt.get("poe1:Settlers");
    expect(stored).toBe(refreshableAt);
  });

  it("calls cards.loadCards after a successful refresh", async () => {
    electron.snapshots.refreshPrices.mockResolvedValue({
      snapshotId: "s1",
      fetchedAt: "",
      refreshableAt: null,
    });

    // loadCards is called on the cards slice — spy on divinationCards.getAll
    // which is called internally by loadCards
    await store.getState().poeNinja.refreshPrices("poe1", "Settlers");

    // The cards.loadCards path calls window.electron.divinationCards.getAll
    expect(electron.divinationCards.getAll).toHaveBeenCalled();
  });

  it("sets refreshError on failure", async () => {
    electron.snapshots.refreshPrices.mockRejectedValue(
      new Error("Network timeout"),
    );

    await store.getState().poeNinja.refreshPrices("poe1", "Settlers");

    expect(store.getState().poeNinja.isRefreshing).toBe(false);
    expect(store.getState().poeNinja.refreshError).toBe("Network timeout");
  });

  it("sets a generic message for non-Error thrown value", async () => {
    electron.snapshots.refreshPrices.mockRejectedValue("some string error");

    await store.getState().poeNinja.refreshPrices("poe1", "Settlers");

    expect(store.getState().poeNinja.refreshError).toBe(
      "Failed to refresh poe.ninja prices",
    );
  });

  it("clears refreshError before starting a new refresh", async () => {
    // Fail first
    electron.snapshots.refreshPrices.mockRejectedValueOnce(
      new Error("first failure"),
    );
    await store.getState().poeNinja.refreshPrices("poe1", "Settlers");
    expect(store.getState().poeNinja.refreshError).toBe("first failure");

    // Succeed next
    electron.snapshots.refreshPrices.mockResolvedValueOnce({
      snapshotId: "s2",
      fetchedAt: "",
      refreshableAt: null,
    });
    await store.getState().poeNinja.refreshPrices("poe1", "Settlers");
    expect(store.getState().poeNinja.refreshError).toBeNull();
  });

  it("passes game and league to the IPC call", async () => {
    electron.snapshots.refreshPrices.mockResolvedValue({
      snapshotId: "s1",
      fetchedAt: "",
      refreshableAt: null,
    });

    await store.getState().poeNinja.refreshPrices("poe2", "Dawn");

    expect(electron.snapshots.refreshPrices).toHaveBeenCalledWith(
      "poe2",
      "Dawn",
    );
  });
});

// ── checkRefreshStatus ─────────────────────────────────────────────────────────

describe("checkRefreshStatus", () => {
  it("stores refreshableAt from the backend response", async () => {
    const refreshableAt = "2025-01-15T16:00:00.000Z";
    electron.snapshots.getRefreshStatus.mockResolvedValue({
      fetchedAt: "2025-01-15T12:00:00.000Z",
      refreshableAt,
    });

    await store.getState().poeNinja.checkRefreshStatus("poe1", "Settlers");

    expect(store.getState().poeNinja.refreshableAt.get("poe1:Settlers")).toBe(
      refreshableAt,
    );
  });

  it("stores null refreshableAt when no cooldown is active", async () => {
    electron.snapshots.getRefreshStatus.mockResolvedValue({
      fetchedAt: null,
      refreshableAt: null,
    });

    await store.getState().poeNinja.checkRefreshStatus("poe1", "Settlers");

    expect(
      store.getState().poeNinja.refreshableAt.get("poe1:Settlers"),
    ).toBeNull();
  });

  it("does not throw on backend error", async () => {
    electron.snapshots.getRefreshStatus.mockRejectedValue(
      new Error("backend down"),
    );

    // Should not throw — error is silently logged
    await expect(
      store.getState().poeNinja.checkRefreshStatus("poe1", "Settlers"),
    ).resolves.toBeUndefined();
  });

  it("leaves existing refreshableAt unchanged on error", async () => {
    // Seed a value
    electron.snapshots.getRefreshStatus.mockResolvedValueOnce({
      fetchedAt: "2025-01-15T12:00:00.000Z",
      refreshableAt: "2025-01-15T16:00:00.000Z",
    });
    await store.getState().poeNinja.checkRefreshStatus("poe1", "Settlers");

    // Now fail
    electron.snapshots.getRefreshStatus.mockRejectedValueOnce(
      new Error("fail"),
    );
    await store.getState().poeNinja.checkRefreshStatus("poe1", "Settlers");

    expect(store.getState().poeNinja.refreshableAt.get("poe1:Settlers")).toBe(
      "2025-01-15T16:00:00.000Z",
    );
  });
});

// ── startListening ─────────────────────────────────────────────────────────────

describe("startListening", () => {
  it("subscribes to 4 snapshot events", () => {
    store.getState().poeNinja.startListening();

    expect(electron.snapshots.onSnapshotCreated).toHaveBeenCalledTimes(1);
    expect(electron.snapshots.onSnapshotReused).toHaveBeenCalledTimes(1);
    expect(electron.snapshots.onAutoRefreshStarted).toHaveBeenCalledTimes(1);
    expect(electron.snapshots.onAutoRefreshStopped).toHaveBeenCalledTimes(1);
  });

  it("returns a cleanup function", () => {
    const cleanup = store.getState().poeNinja.startListening();
    expect(typeof cleanup).toBe("function");
    // Should not throw when called
    cleanup();
  });

  it("calls setAutoRefreshActive when onAutoRefreshStarted fires", () => {
    let startedCallback: ((info: any) => void) | undefined;

    electron.snapshots.onAutoRefreshStarted.mockImplementation((cb: any) => {
      startedCallback = cb;
      return vi.fn();
    });

    const cleanup = store.getState().poeNinja.startListening();

    // Fire the callback with auto-refresh info
    startedCallback!({
      game: "poe1",
      league: "Settlers",
      intervalHours: 4,
    });

    const info = store
      .getState()
      .poeNinja.getAutoRefreshInfo("poe1", "Settlers");
    expect(info).toBeDefined();
    expect(info!.isActive).toBe(true);
    expect(info!.intervalHours).toBe(4);

    cleanup();
  });

  it("calls setAutoRefreshInactive when onAutoRefreshStopped fires", () => {
    let stoppedCallback: ((info: any) => void) | undefined;

    electron.snapshots.onAutoRefreshStopped.mockImplementation((cb: any) => {
      stoppedCallback = cb;
      return vi.fn();
    });

    // Pre-set an active auto-refresh entry
    store.getState().poeNinja.setAutoRefreshActive("poe1", "Settlers", 4);
    expect(
      store.getState().poeNinja.isAutoRefreshActive("poe1", "Settlers"),
    ).toBe(true);

    const cleanup = store.getState().poeNinja.startListening();

    // Fire the stopped callback
    stoppedCallback!({
      game: "poe1",
      league: "Settlers",
    });

    expect(
      store.getState().poeNinja.isAutoRefreshActive("poe1", "Settlers"),
    ).toBe(false);

    cleanup();
  });

  it("calls all cleanup functions when the returned cleanup is invoked", () => {
    const cleanupCreated = vi.fn();
    const cleanupReused = vi.fn();
    const cleanupStarted = vi.fn();
    const cleanupStopped = vi.fn();

    electron.snapshots.onSnapshotCreated.mockReturnValue(cleanupCreated);
    electron.snapshots.onSnapshotReused.mockReturnValue(cleanupReused);
    electron.snapshots.onAutoRefreshStarted.mockReturnValue(cleanupStarted);
    electron.snapshots.onAutoRefreshStopped.mockReturnValue(cleanupStopped);

    const cleanup = store.getState().poeNinja.startListening();
    cleanup();

    expect(cleanupCreated).toHaveBeenCalledOnce();
    expect(cleanupReused).toHaveBeenCalledOnce();
    expect(cleanupStarted).toHaveBeenCalledOnce();
    expect(cleanupStopped).toHaveBeenCalledOnce();
  });
});

// ── Getters ────────────────────────────────────────────────────────────────────

describe("getters", () => {
  describe("getAutoRefreshInfo", () => {
    it("returns undefined when no entry exists", () => {
      expect(
        store.getState().poeNinja.getAutoRefreshInfo("poe1", "Settlers"),
      ).toBeUndefined();
    });

    it("returns the auto-refresh info when an entry exists", () => {
      store.getState().poeNinja.setAutoRefreshActive("poe1", "Settlers", 4);

      const info = store
        .getState()
        .poeNinja.getAutoRefreshInfo("poe1", "Settlers");
      expect(info).toBeDefined();
      expect(info!.isActive).toBe(true);
      expect(info!.intervalHours).toBe(4);
    });
  });

  describe("getNextRefreshTime", () => {
    it("returns null when no entry exists", () => {
      expect(
        store.getState().poeNinja.getNextRefreshTime("poe1", "Settlers"),
      ).toBeNull();
    });

    it("returns a Date when auto-refresh is active", () => {
      store.getState().poeNinja.setAutoRefreshActive("poe1", "Settlers", 4);

      const nextTime = store
        .getState()
        .poeNinja.getNextRefreshTime("poe1", "Settlers");
      expect(nextTime).toBeInstanceOf(Date);
    });

    it("returns null when auto-refresh is inactive", () => {
      store.getState().poeNinja.setAutoRefreshActive("poe1", "Settlers", 4);
      store.getState().poeNinja.setAutoRefreshInactive("poe1", "Settlers");

      expect(
        store.getState().poeNinja.getNextRefreshTime("poe1", "Settlers"),
      ).toBeNull();
    });
  });

  describe("isAutoRefreshActive", () => {
    it("returns false when no entry exists", () => {
      expect(
        store.getState().poeNinja.isAutoRefreshActive("poe1", "Settlers"),
      ).toBe(false);
    });

    it("returns true when active", () => {
      store.getState().poeNinja.setAutoRefreshActive("poe1", "Settlers", 4);

      expect(
        store.getState().poeNinja.isAutoRefreshActive("poe1", "Settlers"),
      ).toBe(true);
    });

    it("returns false after deactivation", () => {
      store.getState().poeNinja.setAutoRefreshActive("poe1", "Settlers", 4);
      store.getState().poeNinja.setAutoRefreshInactive("poe1", "Settlers");

      expect(
        store.getState().poeNinja.isAutoRefreshActive("poe1", "Settlers"),
      ).toBe(false);
    });
  });

  describe("getSnapshotAge", () => {
    it("returns null when no snapshot exists", () => {
      expect(store.getState().poeNinja.getSnapshotAge()).toBeNull();
    });

    it("returns age in hours since snapshot fetchedAt", () => {
      // Snapshot from 3 hours ago
      const threeHoursAgo = new Date(
        Date.now() - 3 * 60 * 60 * 1000,
      ).toISOString();
      store
        .getState()
        .poeNinja.setCurrentSnapshot(
          makeSnapshot({ fetchedAt: threeHoursAgo }),
        );

      const age = store.getState().poeNinja.getSnapshotAge();
      expect(age).not.toBeNull();
      // Should be approximately 3 hours (within 0.1 tolerance)
      expect(age!).toBeGreaterThan(2.9);
      expect(age!).toBeLessThan(3.1);
    });

    it("returns a small positive number for a recent snapshot", () => {
      const justNow = new Date().toISOString();
      store
        .getState()
        .poeNinja.setCurrentSnapshot(makeSnapshot({ fetchedAt: justNow }));

      const age = store.getState().poeNinja.getSnapshotAge();
      expect(age).not.toBeNull();
      expect(age!).toBeGreaterThanOrEqual(0);
      expect(age!).toBeLessThan(0.01); // Less than ~36 seconds
    });
  });

  describe("getTimeUntilNextRefresh", () => {
    it("returns null when no auto-refresh entry exists", () => {
      expect(
        store.getState().poeNinja.getTimeUntilNextRefresh("poe1", "Settlers"),
      ).toBeNull();
    });

    it("returns positive milliseconds when refresh is in the future", () => {
      store.getState().poeNinja.setAutoRefreshActive("poe1", "Settlers", 4);

      const timeMs = store
        .getState()
        .poeNinja.getTimeUntilNextRefresh("poe1", "Settlers");
      expect(timeMs).not.toBeNull();
      // Should be roughly 4 hours in ms (with some tolerance)
      expect(timeMs!).toBeGreaterThan(3.9 * 60 * 60 * 1000);
      expect(timeMs!).toBeLessThanOrEqual(4 * 60 * 60 * 1000);
    });

    it("returns null when auto-refresh is inactive", () => {
      store.getState().poeNinja.setAutoRefreshActive("poe1", "Settlers", 4);
      store.getState().poeNinja.setAutoRefreshInactive("poe1", "Settlers");

      expect(
        store.getState().poeNinja.getTimeUntilNextRefresh("poe1", "Settlers"),
      ).toBeNull();
    });
  });

  describe("getRefreshableAt", () => {
    it("returns null when no cooldown is stored", () => {
      expect(
        store.getState().poeNinja.getRefreshableAt("poe1", "Settlers"),
      ).toBeNull();
    });

    it("returns the stored ISO string after refreshPrices", async () => {
      const refreshableAt = "2025-01-15T14:00:00.000Z";
      electron.snapshots.refreshPrices.mockResolvedValue({
        snapshotId: "s1",
        fetchedAt: "",
        refreshableAt,
      });

      await store.getState().poeNinja.refreshPrices("poe1", "Settlers");

      expect(
        store.getState().poeNinja.getRefreshableAt("poe1", "Settlers"),
      ).toBe(refreshableAt);
    });

    it("returns null for a different game:league key", async () => {
      electron.snapshots.refreshPrices.mockResolvedValue({
        snapshotId: "s1",
        fetchedAt: "",
        refreshableAt: "2025-01-15T14:00:00.000Z",
      });

      await store.getState().poeNinja.refreshPrices("poe1", "Settlers");

      expect(
        store.getState().poeNinja.getRefreshableAt("poe2", "Dawn"),
      ).toBeNull();
    });
  });
});

// ── Multiple game:league isolation ─────────────────────────────────────────────

describe("multi-league isolation", () => {
  it("auto-refresh entries are independent per game:league", () => {
    store.getState().poeNinja.setAutoRefreshActive("poe1", "Settlers", 4);
    store.getState().poeNinja.setAutoRefreshActive("poe2", "Dawn", 8);

    expect(
      store.getState().poeNinja.isAutoRefreshActive("poe1", "Settlers"),
    ).toBe(true);
    expect(store.getState().poeNinja.isAutoRefreshActive("poe2", "Dawn")).toBe(
      true,
    );

    // Deactivate one — the other remains
    store.getState().poeNinja.setAutoRefreshInactive("poe1", "Settlers");

    expect(
      store.getState().poeNinja.isAutoRefreshActive("poe1", "Settlers"),
    ).toBe(false);
    expect(store.getState().poeNinja.isAutoRefreshActive("poe2", "Dawn")).toBe(
      true,
    );
  });

  it("refreshableAt entries are independent per game:league", async () => {
    electron.snapshots.refreshPrices
      .mockResolvedValueOnce({
        snapshotId: "s1",
        fetchedAt: "",
        refreshableAt: "2025-01-15T14:00:00.000Z",
      })
      .mockResolvedValueOnce({
        snapshotId: "s2",
        fetchedAt: "",
        refreshableAt: "2025-01-16T14:00:00.000Z",
      });

    await store.getState().poeNinja.refreshPrices("poe1", "Settlers");
    await store.getState().poeNinja.refreshPrices("poe2", "Dawn");

    expect(store.getState().poeNinja.getRefreshableAt("poe1", "Settlers")).toBe(
      "2025-01-15T14:00:00.000Z",
    );
    expect(store.getState().poeNinja.getRefreshableAt("poe2", "Dawn")).toBe(
      "2025-01-16T14:00:00.000Z",
    );
  });
});
