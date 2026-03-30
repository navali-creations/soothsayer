import { beforeEach, describe, expect, it } from "vitest";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";

// ── Tests ──────────────────────────────────────────────────────────────────────

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

describe("initial state", () => {
  it("has chartRawData as empty array", () => {
    expect(store.getState().statistics.chartRawData).toEqual([]);
  });

  it("has isChartLoading set to true", () => {
    expect(store.getState().statistics.isChartLoading).toBe(true);
  });

  it("has hiddenMetrics as empty set", () => {
    expect(store.getState().statistics.hiddenMetrics).toEqual(new Set());
  });

  it("has brushRange zeroed out", () => {
    expect(store.getState().statistics.brushRange).toEqual({
      startIndex: 0,
      endIndex: 0,
    });
  });

  it("has statScope set to 'all-time'", () => {
    expect(store.getState().statistics.statScope).toBe("all-time");
  });

  it("has selectedLeague set to empty string", () => {
    expect(store.getState().statistics.selectedLeague).toBe("");
  });

  it("has empty searchQuery", () => {
    expect(store.getState().statistics.searchQuery).toBe("");
  });

  it("has null snapshotMeta", () => {
    expect(store.getState().statistics.snapshotMeta).toBeNull();
  });

  it("has isExporting set to false", () => {
    expect(store.getState().statistics.isExporting).toBe(false);
  });
});

// ── Setters ────────────────────────────────────────────────────────────────────

describe("setters", () => {
  describe("setStatScope", () => {
    it("updates statScope to 'league'", () => {
      store.getState().statistics.setStatScope("league");
      expect(store.getState().statistics.statScope).toBe("league");
    });

    it("updates statScope back to 'all-time'", () => {
      store.getState().statistics.setStatScope("league");
      store.getState().statistics.setStatScope("all-time");
      expect(store.getState().statistics.statScope).toBe("all-time");
    });
  });

  describe("setSearchQuery", () => {
    it("updates searchQuery", () => {
      store.getState().statistics.setSearchQuery("Doctor");
      expect(store.getState().statistics.searchQuery).toBe("Doctor");
    });

    it("can be cleared back to empty string", () => {
      store.getState().statistics.setSearchQuery("Doctor");
      store.getState().statistics.setSearchQuery("");
      expect(store.getState().statistics.searchQuery).toBe("");
    });
  });

  describe("setSelectedLeague", () => {
    it("updates selectedLeague", () => {
      store.getState().statistics.setSelectedLeague("Settlers");
      expect(store.getState().statistics.selectedLeague).toBe("Settlers");
    });

    it("can be set to an empty string", () => {
      store.getState().statistics.setSelectedLeague("");
      expect(store.getState().statistics.selectedLeague).toBe("");
    });
  });
});

// ── fetchSnapshotMeta ──────────────────────────────────────────────────────────

describe("fetchSnapshotMeta", () => {
  it("stores snapshot meta on success", async () => {
    const meta = {
      exists: true,
      exportedAt: "2025-01-15T12:00:00Z",
      totalCount: 42,
      newCardCount: 5,
      newTotalDrops: 18,
    };
    electron.csv.getSnapshotMeta.mockResolvedValue(meta);

    await store.getState().statistics.fetchSnapshotMeta("all-time");

    expect(store.getState().statistics.snapshotMeta).toEqual(meta);
  });

  it("passes the scope to the IPC call", async () => {
    await store.getState().statistics.fetchSnapshotMeta("league");

    expect(electron.csv.getSnapshotMeta).toHaveBeenCalledWith("league");
  });

  it("sets snapshotMeta to null on error", async () => {
    // Seed existing meta first
    const meta = {
      exists: true,
      exportedAt: "2025-01-15T12:00:00Z",
      totalCount: 42,
      newCardCount: 5,
      newTotalDrops: 18,
    };
    electron.csv.getSnapshotMeta.mockResolvedValueOnce(meta);
    await store.getState().statistics.fetchSnapshotMeta("all-time");
    expect(store.getState().statistics.snapshotMeta).toEqual(meta);

    // Now fail
    electron.csv.getSnapshotMeta.mockRejectedValueOnce(
      new Error("backend error"),
    );
    await store.getState().statistics.fetchSnapshotMeta("all-time");

    expect(store.getState().statistics.snapshotMeta).toBeNull();
  });

  it("handles non-existent snapshot meta", async () => {
    const meta = {
      exists: false,
      exportedAt: null,
      totalCount: 0,
      newCardCount: 0,
      newTotalDrops: 0,
    };
    electron.csv.getSnapshotMeta.mockResolvedValue(meta);

    await store.getState().statistics.fetchSnapshotMeta("all-time");

    expect(store.getState().statistics.snapshotMeta).toEqual(meta);
    expect(store.getState().statistics.snapshotMeta!.exists).toBe(false);
  });
});

// ── exportAll ──────────────────────────────────────────────────────────────────

describe("exportAll", () => {
  it("sets isExporting to true during export and false after", async () => {
    let resolveExport!: (v: unknown) => void;
    const pending = new Promise((r) => {
      resolveExport = r;
    });
    electron.csv.exportAll.mockReturnValue(pending);

    const promise = store.getState().statistics.exportAll("all-time");
    expect(store.getState().statistics.isExporting).toBe(true);

    resolveExport({ success: true });
    await promise;

    expect(store.getState().statistics.isExporting).toBe(false);
  });

  it("refreshes snapshot meta on success", async () => {
    const meta = {
      exists: true,
      exportedAt: "2025-01-15T13:00:00Z",
      totalCount: 50,
      newCardCount: 0,
      newTotalDrops: 0,
    };
    electron.csv.exportAll.mockResolvedValue({ success: true });
    electron.csv.getSnapshotMeta.mockResolvedValue(meta);

    await store.getState().statistics.exportAll("all-time");

    expect(electron.csv.getSnapshotMeta).toHaveBeenCalledWith("all-time");
    expect(store.getState().statistics.snapshotMeta).toEqual(meta);
  });

  it("does not refresh snapshot meta when result is not successful", async () => {
    electron.csv.exportAll.mockResolvedValue({
      success: false,
      canceled: true,
    });

    await store.getState().statistics.exportAll("all-time");

    // getSnapshotMeta should NOT have been called (the default mock from
    // the electron-mock setup may have been called during store creation,
    // so we check it was not called after the export)
    expect(electron.csv.getSnapshotMeta).not.toHaveBeenCalled();
  });

  it("returns the export result", async () => {
    const exportResult = { success: true };
    electron.csv.exportAll.mockResolvedValue(exportResult);

    const result = await store.getState().statistics.exportAll("all-time");

    expect(result).toEqual(exportResult);
  });

  it("resets isExporting to false even when the export throws", async () => {
    electron.csv.exportAll.mockRejectedValue(new Error("disk full"));

    await expect(
      store.getState().statistics.exportAll("all-time"),
    ).rejects.toThrow("disk full");

    expect(store.getState().statistics.isExporting).toBe(false);
  });

  it("passes the scope to the IPC call", async () => {
    electron.csv.exportAll.mockResolvedValue({ success: true });

    await store.getState().statistics.exportAll("league");

    expect(electron.csv.exportAll).toHaveBeenCalledWith("league");
  });
});

// ── exportIncremental ──────────────────────────────────────────────────────────

describe("exportIncremental", () => {
  it("sets isExporting to true during export and false after", async () => {
    let resolveExport!: (v: unknown) => void;
    const pending = new Promise((r) => {
      resolveExport = r;
    });
    electron.csv.exportIncremental.mockReturnValue(pending);

    const promise = store.getState().statistics.exportIncremental("all-time");
    expect(store.getState().statistics.isExporting).toBe(true);

    resolveExport({ success: true });
    await promise;

    expect(store.getState().statistics.isExporting).toBe(false);
  });

  it("refreshes snapshot meta on success", async () => {
    const meta = {
      exists: true,
      exportedAt: "2025-01-15T14:00:00Z",
      totalCount: 55,
      newCardCount: 3,
      newTotalDrops: 7,
    };
    electron.csv.exportIncremental.mockResolvedValue({ success: true });
    electron.csv.getSnapshotMeta.mockResolvedValue(meta);

    await store.getState().statistics.exportIncremental("league");

    expect(electron.csv.getSnapshotMeta).toHaveBeenCalledWith("league");
    expect(store.getState().statistics.snapshotMeta).toEqual(meta);
  });

  it("does not refresh snapshot meta when result is not successful", async () => {
    electron.csv.exportIncremental.mockResolvedValue({
      success: false,
      error: "no new data",
    });

    await store.getState().statistics.exportIncremental("all-time");

    expect(electron.csv.getSnapshotMeta).not.toHaveBeenCalled();
  });

  it("returns the export result", async () => {
    const exportResult = { success: true };
    electron.csv.exportIncremental.mockResolvedValue(exportResult);

    const result = await store
      .getState()
      .statistics.exportIncremental("all-time");

    expect(result).toEqual(exportResult);
  });

  it("resets isExporting to false even when the export throws", async () => {
    electron.csv.exportIncremental.mockRejectedValue(
      new Error("permission denied"),
    );

    await expect(
      store.getState().statistics.exportIncremental("all-time"),
    ).rejects.toThrow("permission denied");

    expect(store.getState().statistics.isExporting).toBe(false);
  });

  it("passes the scope to the IPC call", async () => {
    electron.csv.exportIncremental.mockResolvedValue({ success: true });

    await store.getState().statistics.exportIncremental("league");

    expect(electron.csv.exportIncremental).toHaveBeenCalledWith("league");
  });
});

// ── showUncollectedCards ───────────────────────────────────────────────────────

describe("showUncollectedCards", () => {
  it("defaults to false", () => {
    expect(store.getState().statistics.showUncollectedCards).toBe(false);
  });

  it("toggles to true", () => {
    store.getState().statistics.toggleShowUncollectedCards();
    expect(store.getState().statistics.showUncollectedCards).toBe(true);
  });

  it("toggles back to false", () => {
    store.getState().statistics.toggleShowUncollectedCards();
    store.getState().statistics.toggleShowUncollectedCards();
    expect(store.getState().statistics.showUncollectedCards).toBe(false);
  });
});

// ── fetchSessionHighlights ─────────────────────────────────────────────────────

describe("fetchSessionHighlights", () => {
  it("has null sessionHighlights initially", () => {
    expect(store.getState().statistics.sessionHighlights).toBeNull();
  });

  it("has isLoadingHighlights false initially", () => {
    expect(store.getState().statistics.isLoadingHighlights).toBe(false);
  });

  it("sets isLoadingHighlights to true during fetch", async () => {
    let resolveAll!: (value: unknown) => void;
    electron.sessions.getMostProfitable.mockReturnValue(
      new Promise((resolve) => {
        resolveAll = resolve;
      }),
    );

    const promise = store.getState().statistics.fetchSessionHighlights("poe1");
    expect(store.getState().statistics.isLoadingHighlights).toBe(true);

    resolveAll(null);
    await promise;

    expect(store.getState().statistics.isLoadingHighlights).toBe(false);
  });

  it("populates sessionHighlights on success", async () => {
    const mostProfitable = {
      sessionId: "s1",
      date: "2025-01-01T00:00:00Z",
      profit: 500,
      league: "Settlers",
    };
    const longestSession = {
      sessionId: "s2",
      date: "2025-01-02T00:00:00Z",
      durationMinutes: 120,
      league: "Settlers",
    };
    const mostDecksOpened = {
      sessionId: "s3",
      date: "2025-01-03T00:00:00Z",
      totalDecksOpened: 200,
      league: "Settlers",
    };
    const biggestLetdown = {
      sessionId: "s4",
      date: "2025-01-04T00:00:00Z",
      totalDecksOpened: 180,
      profit: -320,
      league: "Settlers",
      chaosPerDivine: 200,
    };
    const luckyBreak = {
      sessionId: "s5",
      date: "2025-01-05T00:00:00Z",
      league: "Settlers",
    };

    electron.sessions.getMostProfitable.mockResolvedValue(mostProfitable);
    electron.sessions.getLongestSession.mockResolvedValue(longestSession);
    electron.sessions.getMostDecksOpened.mockResolvedValue(mostDecksOpened);
    electron.sessions.getBiggestLetdown.mockResolvedValue(biggestLetdown);
    electron.sessions.getLuckyBreak.mockResolvedValue(luckyBreak);
    electron.sessions.getTotalDecksOpened.mockResolvedValue(500);

    await store.getState().statistics.fetchSessionHighlights("poe1");

    const highlights = store.getState().statistics.sessionHighlights;
    expect(highlights).not.toBeNull();
    expect(highlights!.mostProfitable).toEqual(mostProfitable);
    expect(highlights!.longestSession).toEqual(longestSession);
    expect(highlights!.mostDecksOpened).toEqual(mostDecksOpened);
    expect(highlights!.biggestLetdown).toEqual(biggestLetdown);
    expect(highlights!.luckyBreak).toEqual(luckyBreak);
    expect(highlights!.totalDecksOpened).toBe(500);
  });

  it("passes league filter when provided", async () => {
    await store
      .getState()
      .statistics.fetchSessionHighlights("poe1", "Settlers");

    expect(electron.sessions.getMostProfitable).toHaveBeenCalledWith(
      "poe1",
      "Settlers",
    );
    expect(electron.sessions.getLongestSession).toHaveBeenCalledWith(
      "poe1",
      "Settlers",
    );
    expect(electron.sessions.getMostDecksOpened).toHaveBeenCalledWith(
      "poe1",
      "Settlers",
    );
    expect(electron.sessions.getBiggestLetdown).toHaveBeenCalledWith(
      "poe1",
      "Settlers",
    );
    expect(electron.sessions.getTotalDecksOpened).toHaveBeenCalledWith(
      "poe1",
      "Settlers",
    );
    expect(electron.sessions.getLuckyBreak).toHaveBeenCalledWith(
      "poe1",
      "Settlers",
    );
  });

  it("calls without league filter for all-time scope", async () => {
    await store.getState().statistics.fetchSessionHighlights("poe1");

    expect(electron.sessions.getMostProfitable).toHaveBeenCalledWith(
      "poe1",
      undefined,
    );
  });

  it("sets sessionHighlights to null on error", async () => {
    // First populate with data
    electron.sessions.getMostProfitable.mockResolvedValueOnce({
      sessionId: "s1",
      date: "2025-01-01T00:00:00Z",
      profit: 100,
      league: "Standard",
    });
    electron.sessions.getLongestSession.mockResolvedValueOnce(null);
    electron.sessions.getMostDecksOpened.mockResolvedValueOnce(null);
    electron.sessions.getTotalDecksOpened.mockResolvedValueOnce(50);

    await store.getState().statistics.fetchSessionHighlights("poe1");
    expect(store.getState().statistics.sessionHighlights).not.toBeNull();

    // Now fail
    electron.sessions.getMostProfitable.mockRejectedValueOnce(
      new Error("IPC error"),
    );

    await store.getState().statistics.fetchSessionHighlights("poe1");
    expect(store.getState().statistics.sessionHighlights).toBeNull();
    expect(store.getState().statistics.isLoadingHighlights).toBe(false);
  });

  it("handles all-null responses gracefully", async () => {
    // Default mocks return null/0
    await store.getState().statistics.fetchSessionHighlights("poe1");

    const highlights = store.getState().statistics.sessionHighlights;
    expect(highlights).not.toBeNull();
    expect(highlights!.mostProfitable).toBeNull();
    expect(highlights!.longestSession).toBeNull();
    expect(highlights!.mostDecksOpened).toBeNull();
    expect(highlights!.biggestLetdown).toBeNull();
    expect(highlights!.luckyBreak).toBeNull();
    expect(highlights!.totalDecksOpened).toBe(0);
  });
});

describe("fetchChartData", () => {
  it("populates chartRawData on success", async () => {
    const mockData = [
      {
        sessionIndex: 1,
        sessionDate: "2024-01-01",
        league: "Standard",
        durationMinutes: 30,
        totalDecksOpened: 10,
        exchangeNetProfit: 100,
        chaosPerDivine: 200,
      },
      {
        sessionIndex: 2,
        sessionDate: "2024-01-02",
        league: "Standard",
        durationMinutes: 45,
        totalDecksOpened: 15,
        exchangeNetProfit: 200,
        chaosPerDivine: 200,
      },
    ];
    electron.sessions.getChartData.mockResolvedValue(mockData);

    await store.getState().statistics.fetchChartData("poe1", "Standard");

    expect(store.getState().statistics.chartRawData).toEqual(mockData);
    expect(store.getState().statistics.isChartLoading).toBe(false);
  });

  it("sets isChartLoading to true during fetch", async () => {
    let resolveChart!: (v: unknown[]) => void;
    electron.sessions.getChartData.mockReturnValue(
      new Promise((r) => {
        resolveChart = r;
      }),
    );

    const promise = store.getState().statistics.fetchChartData("poe1");
    expect(store.getState().statistics.isChartLoading).toBe(true);

    resolveChart([]);
    await promise;

    expect(store.getState().statistics.isChartLoading).toBe(false);
  });

  it("passes league filter to IPC call", async () => {
    electron.sessions.getChartData.mockResolvedValue([]);

    await store.getState().statistics.fetchChartData("poe1", "Settlers");

    expect(electron.sessions.getChartData).toHaveBeenCalledWith(
      "poe1",
      "Settlers",
    );
  });

  it("calls without league for all-time scope", async () => {
    electron.sessions.getChartData.mockResolvedValue([]);

    await store.getState().statistics.fetchChartData("poe1");

    expect(electron.sessions.getChartData).toHaveBeenCalledWith(
      "poe1",
      undefined,
    );
  });

  it("sets chartRawData to empty array on error", async () => {
    const mockData = [
      {
        sessionIndex: 1,
        sessionDate: "2024-01-01",
        league: "Standard",
        durationMinutes: 30,
        totalDecksOpened: 10,
        exchangeNetProfit: 100,
        chaosPerDivine: 200,
      },
    ];
    electron.sessions.getChartData.mockResolvedValueOnce(mockData);
    await store.getState().statistics.fetchChartData("poe1");
    expect(store.getState().statistics.chartRawData).toEqual(mockData);

    electron.sessions.getChartData.mockRejectedValueOnce(
      new Error("IPC error"),
    );
    await store.getState().statistics.fetchChartData("poe1");

    expect(store.getState().statistics.chartRawData).toEqual([]);
    expect(store.getState().statistics.isChartLoading).toBe(false);
  });
});

describe("toggleChartMetric", () => {
  it("adds a metric to hiddenMetrics", () => {
    store.getState().statistics.toggleChartMetric("decks");

    expect(store.getState().statistics.hiddenMetrics).toEqual(
      new Set(["decks"]),
    );
  });

  it("removes a metric if already hidden", () => {
    store.getState().statistics.toggleChartMetric("decks");
    expect(store.getState().statistics.hiddenMetrics.has("decks")).toBe(true);

    store.getState().statistics.toggleChartMetric("decks");
    expect(store.getState().statistics.hiddenMetrics.has("decks")).toBe(false);
  });

  it("does not allow hiding all metrics", () => {
    // There are 2 metrics (decks, profit). Hiding both should be prevented.
    store.getState().statistics.toggleChartMetric("decks");
    store.getState().statistics.toggleChartMetric("profit");

    // Only the first one should be hidden; the second toggle is rejected
    expect(store.getState().statistics.hiddenMetrics).toEqual(
      new Set(["decks"]),
    );
  });
});

describe("setBrushRange", () => {
  it("updates brushRange", () => {
    store.getState().statistics.setBrushRange({ startIndex: 5, endIndex: 20 });

    expect(store.getState().statistics.brushRange).toEqual({
      startIndex: 5,
      endIndex: 20,
    });
  });

  it("can reset brushRange to zero", () => {
    store.getState().statistics.setBrushRange({ startIndex: 5, endIndex: 20 });
    store.getState().statistics.setBrushRange({ startIndex: 0, endIndex: 0 });

    expect(store.getState().statistics.brushRange).toEqual({
      startIndex: 0,
      endIndex: 0,
    });
  });
});
