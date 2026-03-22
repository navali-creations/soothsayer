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

// ── Initial State ──────────────────────────────────────────────────────────────

describe("initial state", () => {
  it("has statScope set to 'all-time'", () => {
    expect(store.getState().statistics.statScope).toBe("all-time");
  });

  it("has selectedLeague set to 'Keepers'", () => {
    expect(store.getState().statistics.selectedLeague).toBe("Keepers");
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
