import { beforeEach, describe, expect, it } from "vitest";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeFilter(overrides: Record<string, unknown> = {}) {
  return {
    id: "filter-1",
    name: "My Filter",
    type: "local" as const,
    filePath: "/path/to/filter",
    fileName: "filter.filter",
    lastUpdate: null,
    isFullyParsed: false,
    isOutdated: false,
    ...overrides,
  };
}

function makeMetadata(overrides: Record<string, unknown> = {}) {
  return {
    id: "filter-1",
    filterType: "local" as const,
    filePath: "/path/to/filter.filter",
    filterName: "My Filter",
    lastUpdate: null,
    isFullyParsed: false,
    parsedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function selectFilterThemeSource(filterId: string) {
  store.getState().settings.setSetting("raritySource", "filter");
  store.getState().settings.setSetting("selectedFilterId", filterId);
  store.getState().rarityInsights.setSelectedFilterId(filterId);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

describe("RarityInsightsSlice", () => {
  // ── Initial state ──────────────────────────────────────────────────────

  describe("initial state", () => {
    it("has empty availableFilters", () => {
      expect(store.getState().rarityInsights.availableFilters).toEqual([]);
    });

    it("has null selectedFilterId", () => {
      expect(store.getState().rarityInsights.selectedFilterId).toBeNull();
    });

    it("has isScanning false", () => {
      expect(store.getState().rarityInsights.isScanning).toBe(false);
    });

    it("has isParsing false", () => {
      expect(store.getState().rarityInsights.isParsing).toBe(false);
    });

    it("has null activeFilterTheme", () => {
      expect(store.getState().rarityInsights.activeFilterTheme).toBeNull();
    });

    it("has isThemeLoading false", () => {
      expect(store.getState().rarityInsights.isThemeLoading).toBe(false);
    });

    it("has null scanError", () => {
      expect(store.getState().rarityInsights.scanError).toBeNull();
    });

    it("has null parseError", () => {
      expect(store.getState().rarityInsights.parseError).toBeNull();
    });

    it("has null themeError", () => {
      expect(store.getState().rarityInsights.themeError).toBeNull();
    });

    it("has null lastScannedAt", () => {
      expect(store.getState().rarityInsights.lastScannedAt).toBeNull();
    });
  });

  // ── loadStoredFilters ─────────────────────────────────────────────────

  describe("loadStoredFilters", () => {
    it("loads cached filter metadata for immediate labels", async () => {
      electron.rarityInsights.getAll.mockResolvedValue([
        makeMetadata({
          id: "filter_7ffa42d8",
          filterType: "online",
          filePath:
            "C:\\Users\\seb\\Documents\\My Games\\Path of Exile\\OnlineFilters\\9RYoqxfO",
          filterName: "NeverSink Mirage",
          isFullyParsed: true,
        }),
      ]);

      await store.getState().rarityInsights.loadStoredFilters();

      expect(electron.rarityInsights.getAll).toHaveBeenCalled();
      expect(store.getState().rarityInsights.availableFilters).toEqual([
        {
          id: "filter_7ffa42d8",
          type: "online",
          filePath:
            "C:\\Users\\seb\\Documents\\My Games\\Path of Exile\\OnlineFilters\\9RYoqxfO",
          fileName: "9RYoqxfO",
          name: "NeverSink Mirage",
          lastUpdate: null,
          isFullyParsed: true,
          isOutdated: false,
        },
      ]);
    });

    it("sets scanError when cached filter loading fails", async () => {
      electron.rarityInsights.getAll.mockRejectedValue(
        new Error("DB unavailable"),
      );

      await store.getState().rarityInsights.loadStoredFilters();

      expect(store.getState().rarityInsights.scanError).toBe("DB unavailable");
    });
  });

  // ── scanFilters ────────────────────────────────────────────────────────

  describe("scanFilters", () => {
    it("sets isScanning to true while scanning", async () => {
      let resolveScan!: (v: unknown) => void;
      electron.rarityInsights.scan.mockReturnValue(
        new Promise((r) => {
          resolveScan = r;
        }),
      );

      const promise = store.getState().rarityInsights.scanFilters();
      expect(store.getState().rarityInsights.isScanning).toBe(true);

      resolveScan({ filters: [], localCount: 0, onlineCount: 0 });
      await promise;

      expect(store.getState().rarityInsights.isScanning).toBe(false);
    });

    it("clears scanError before scanning", async () => {
      // Set up a prior error
      store.getState().rarityInsights.setScanError("old error");
      expect(store.getState().rarityInsights.scanError).toBe("old error");

      electron.rarityInsights.scan.mockResolvedValue({
        filters: [],
        localCount: 0,
        onlineCount: 0,
      });

      await store.getState().rarityInsights.scanFilters();
      expect(store.getState().rarityInsights.scanError).toBeNull();
    });

    it("populates availableFilters on success", async () => {
      const filters = [
        makeFilter({ id: "f1", name: "Filter A" }),
        makeFilter({ id: "f2", name: "Filter B", type: "online" }),
      ];

      electron.rarityInsights.scan.mockResolvedValue({
        filters,
        localCount: 1,
        onlineCount: 1,
      });

      await store.getState().rarityInsights.scanFilters();

      expect(store.getState().rarityInsights.availableFilters).toHaveLength(2);
      expect(store.getState().rarityInsights.availableFilters[0].id).toBe("f1");
      expect(store.getState().rarityInsights.availableFilters[1].id).toBe("f2");
    });

    it("keeps cached selected filter metadata when scan omits it", async () => {
      const cachedSelected = makeFilter({
        id: "filter-selected",
        name: "Cached Selected Filter",
        type: "online",
      });
      store.getState().rarityInsights.setAvailableFilters([cachedSelected]);
      selectFilterThemeSource("filter-selected");
      electron.rarityInsights.scan.mockResolvedValue({
        filters: [makeFilter({ id: "f1", name: "Filter A" })],
        localCount: 1,
        onlineCount: 0,
      });

      await store.getState().rarityInsights.scanFilters();

      expect(store.getState().rarityInsights.availableFilters).toEqual([
        makeFilter({ id: "f1", name: "Filter A" }),
        cachedSelected,
      ]);
    });

    it("sets lastScannedAt on success", async () => {
      electron.rarityInsights.scan.mockResolvedValue({
        filters: [],
        localCount: 0,
        onlineCount: 0,
      });

      const before = new Date().toISOString();
      await store.getState().rarityInsights.scanFilters();
      const after = new Date().toISOString();

      const scannedAt = store.getState().rarityInsights.lastScannedAt;
      expect(scannedAt).not.toBeNull();
      expect(scannedAt! >= before).toBe(true);
      expect(scannedAt! <= after).toBe(true);
    });

    it("sets scanError on failure", async () => {
      electron.rarityInsights.scan.mockRejectedValue(new Error("Scan blew up"));

      await store.getState().rarityInsights.scanFilters();

      expect(store.getState().rarityInsights.scanError).toBe("Scan blew up");
      expect(store.getState().rarityInsights.isScanning).toBe(false);
    });

    it("sets a generic scanError for non-Error thrown values", async () => {
      electron.rarityInsights.scan.mockRejectedValue("string error");

      await store.getState().rarityInsights.scanFilters();

      expect(store.getState().rarityInsights.scanError).toBe(
        "Failed to scan filters",
      );
    });
  });

  // ── selectFilter ───────────────────────────────────────────────────────

  describe("selectFilter", () => {
    it("sets selectedFilterId", async () => {
      await store.getState().rarityInsights.selectFilter("filter-abc");

      expect(store.getState().rarityInsights.selectedFilterId).toBe(
        "filter-abc",
      );
    });

    it("calls electron.rarityInsights.select with the filterId", async () => {
      await store.getState().rarityInsights.selectFilter("filter-abc");

      expect(electron.rarityInsights.select).toHaveBeenCalledWith("filter-abc");
    });

    it("loads the filter theme after selecting a filter", async () => {
      store.getState().settings.setSetting("raritySource", "filter");

      await store.getState().rarityInsights.selectFilter("filter-abc");

      expect(electron.rarityInsights.getFilterTheme).toHaveBeenCalledWith(
        "filter-abc",
      );
    });

    it("clears parseError when selecting a filter", async () => {
      store.getState().rarityInsights.setParseError("old parse error");

      await store.getState().rarityInsights.selectFilter("filter-abc");

      expect(store.getState().rarityInsights.parseError).toBeNull();
    });

    it("sets parseError if electron.select rejects", async () => {
      electron.rarityInsights.select.mockRejectedValue(
        new Error("Select failed"),
      );

      await store.getState().rarityInsights.selectFilter("filter-abc");

      expect(store.getState().rarityInsights.parseError).toBe("Select failed");
    });
  });

  // ── clearSelectedFilter ────────────────────────────────────────────────

  describe("clearSelectedFilter", () => {
    it("sets selectedFilterId to null", async () => {
      store.getState().rarityInsights.setSelectedFilterId("filter-abc");
      expect(store.getState().rarityInsights.selectedFilterId).toBe(
        "filter-abc",
      );

      await store.getState().rarityInsights.clearSelectedFilter();

      expect(store.getState().rarityInsights.selectedFilterId).toBeNull();
    });

    it("calls electron.rarityInsights.select with null", async () => {
      await store.getState().rarityInsights.clearSelectedFilter();

      expect(electron.rarityInsights.select).toHaveBeenCalledWith(null);
    });

    it("clears the active filter theme", async () => {
      selectFilterThemeSource("filter-abc");
      electron.rarityInsights.getFilterTheme.mockResolvedValue([
        {
          filterId: "filter-abc",
          rarity: 1,
          bgColor: { r: 10, g: 20, b: 30, a: 255 },
          textColor: null,
          borderColor: null,
        },
      ]);
      await store.getState().rarityInsights.loadFilterTheme("filter-abc");

      await store.getState().rarityInsights.clearSelectedFilter();

      expect(store.getState().rarityInsights.activeFilterTheme).toBeNull();
      expect(store.getState().rarityInsights.themeError).toBeNull();
    });

    it("does not throw if electron.select rejects", async () => {
      electron.rarityInsights.select.mockRejectedValue(
        new Error("Clear failed"),
      );

      // Should not throw — error is caught internally
      await expect(
        store.getState().rarityInsights.clearSelectedFilter(),
      ).resolves.toBeUndefined();
    });
  });

  // ── parseFilter ────────────────────────────────────────────────────────

  describe("parseFilter", () => {
    it("sets isParsing to true while parsing", async () => {
      let resolveParse!: (v: unknown) => void;
      electron.rarityInsights.parse.mockReturnValue(
        new Promise((r) => {
          resolveParse = r;
        }),
      );

      const promise = store.getState().rarityInsights.parseFilter("filter-1");
      expect(store.getState().rarityInsights.isParsing).toBe(true);

      resolveParse({ cards: [], totalCards: 0 });
      await promise;

      expect(store.getState().rarityInsights.isParsing).toBe(false);
    });

    it("clears parseError before parsing", async () => {
      store.getState().rarityInsights.setParseError("old error");

      electron.rarityInsights.parse.mockResolvedValue({
        cards: [],
        totalCards: 0,
      });

      await store.getState().rarityInsights.parseFilter("filter-1");
      expect(store.getState().rarityInsights.parseError).toBeNull();
    });

    it("calls electron.rarityInsights.parse with the filterId", async () => {
      electron.rarityInsights.parse.mockResolvedValue({
        cards: [],
        totalCards: 0,
      });

      await store.getState().rarityInsights.parseFilter("filter-1");

      expect(electron.rarityInsights.parse).toHaveBeenCalledWith("filter-1");
    });

    it("loads the filter theme after parsing", async () => {
      selectFilterThemeSource("filter-1");
      electron.rarityInsights.parse.mockResolvedValue({
        cards: [],
        totalCards: 0,
      });

      await store.getState().rarityInsights.parseFilter("filter-1");

      expect(electron.rarityInsights.getFilterTheme).toHaveBeenCalledWith(
        "filter-1",
      );
    });

    it("marks the matching filter as isFullyParsed on success", async () => {
      const filters = [
        makeFilter({ id: "filter-1", isFullyParsed: false }),
        makeFilter({ id: "filter-2", isFullyParsed: false }),
      ];

      store.getState().rarityInsights.setAvailableFilters(filters);

      electron.rarityInsights.parse.mockResolvedValue({
        cards: [],
        totalCards: 5,
      });

      await store.getState().rarityInsights.parseFilter("filter-1");

      const updatedFilters = store.getState().rarityInsights.availableFilters;
      expect(
        updatedFilters.find((f) => f.id === "filter-1")!.isFullyParsed,
      ).toBe(true);
      // Other filters should not be affected
      expect(
        updatedFilters.find((f) => f.id === "filter-2")!.isFullyParsed,
      ).toBe(false);
    });

    it("sets parseError on failure", async () => {
      electron.rarityInsights.parse.mockRejectedValue(
        new Error("Parse exploded"),
      );

      await store.getState().rarityInsights.parseFilter("filter-1");

      expect(store.getState().rarityInsights.parseError).toBe("Parse exploded");
      expect(store.getState().rarityInsights.isParsing).toBe(false);
    });

    it("sets a generic parseError for non-Error thrown values", async () => {
      electron.rarityInsights.parse.mockRejectedValue("kaboom");

      await store.getState().rarityInsights.parseFilter("filter-1");

      expect(store.getState().rarityInsights.parseError).toBe(
        "Failed to parse filter",
      );
    });

    it("does not crash when filter is not in availableFilters", async () => {
      electron.rarityInsights.parse.mockResolvedValue({
        cards: [],
        totalCards: 0,
      });

      // No filters set — parsing a non-existent filter should not throw
      await store.getState().rarityInsights.parseFilter("non-existent");

      expect(store.getState().rarityInsights.isParsing).toBe(false);
      expect(store.getState().rarityInsights.parseError).toBeNull();
    });
  });

  // ── loadFilterTheme ────────────────────────────────────────────────────

  describe("loadFilterTheme", () => {
    it("sets isThemeLoading while loading", async () => {
      selectFilterThemeSource("filter-1");
      let resolveTheme!: (v: unknown) => void;
      electron.rarityInsights.getFilterTheme.mockReturnValue(
        new Promise((r) => {
          resolveTheme = r;
        }),
      );

      const promise = store
        .getState()
        .rarityInsights.loadFilterTheme("filter-1");
      expect(store.getState().rarityInsights.isThemeLoading).toBe(true);

      resolveTheme([]);
      await promise;

      expect(store.getState().rarityInsights.isThemeLoading).toBe(false);
    });

    it("stores theme rows keyed by rarity", async () => {
      selectFilterThemeSource("filter-1");
      electron.rarityInsights.getFilterTheme.mockResolvedValue([
        {
          filterId: "filter-1",
          rarity: 1,
          bgColor: { r: 10, g: 20, b: 30, a: 255 },
          textColor: { r: 240, g: 240, b: 240, a: 255 },
          borderColor: null,
        },
      ]);

      await store.getState().rarityInsights.loadFilterTheme("filter-1");

      expect(store.getState().rarityInsights.activeFilterTheme).toEqual({
        1: {
          bgColor: { r: 10, g: 20, b: 30, a: 255 },
          textColor: { r: 240, g: 240, b: 240, a: 255 },
          borderColor: null,
        },
      });
    });

    it("clears activeFilterTheme when no theme rows are returned", async () => {
      selectFilterThemeSource("filter-1");
      electron.rarityInsights.getFilterTheme.mockResolvedValue([]);

      await store.getState().rarityInsights.loadFilterTheme("filter-1");

      expect(store.getState().rarityInsights.activeFilterTheme).toBeNull();
    });

    it("clears activeFilterTheme when called without a filterId", async () => {
      selectFilterThemeSource("filter-1");
      electron.rarityInsights.getFilterTheme.mockResolvedValue([
        {
          filterId: "filter-1",
          rarity: 1,
          bgColor: { r: 10, g: 20, b: 30, a: 255 },
          textColor: null,
          borderColor: null,
        },
      ]);
      await store.getState().rarityInsights.loadFilterTheme("filter-1");

      await store.getState().rarityInsights.loadFilterTheme(null);

      expect(store.getState().rarityInsights.activeFilterTheme).toBeNull();
      expect(electron.rarityInsights.getFilterTheme).toHaveBeenCalledTimes(1);
    });

    it("sets themeError on failure", async () => {
      selectFilterThemeSource("filter-1");
      electron.rarityInsights.getFilterTheme.mockRejectedValue(
        new Error("Theme failed"),
      );

      await store.getState().rarityInsights.loadFilterTheme("filter-1");

      expect(store.getState().rarityInsights.activeFilterTheme).toBeNull();
      expect(store.getState().rarityInsights.isThemeLoading).toBe(false);
      expect(store.getState().rarityInsights.themeError).toBe("Theme failed");
    });

    it("ignores stale theme responses after the selected filter changes", async () => {
      selectFilterThemeSource("filter-1");

      let resolveFirst!: (v: unknown) => void;
      let resolveSecond!: (v: unknown) => void;
      electron.rarityInsights.getFilterTheme
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
        )
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
        );

      const firstLoad = store
        .getState()
        .rarityInsights.loadFilterTheme("filter-1");
      selectFilterThemeSource("filter-2");
      const secondLoad = store
        .getState()
        .rarityInsights.loadFilterTheme("filter-2");

      resolveSecond([
        {
          filterId: "filter-2",
          rarity: 2,
          bgColor: { r: 20, g: 30, b: 40, a: 255 },
          textColor: null,
          borderColor: null,
        },
      ]);
      await secondLoad;

      resolveFirst([
        {
          filterId: "filter-1",
          rarity: 1,
          bgColor: { r: 10, g: 20, b: 30, a: 255 },
          textColor: null,
          borderColor: null,
        },
      ]);
      await firstLoad;

      expect(store.getState().rarityInsights.activeFilterTheme).toEqual({
        2: {
          bgColor: { r: 20, g: 30, b: 40, a: 255 },
          textColor: null,
          borderColor: null,
        },
      });
    });

    it("ignores stale theme errors after switching away from filter source", async () => {
      selectFilterThemeSource("filter-1");

      let rejectTheme!: (reason?: unknown) => void;
      electron.rarityInsights.getFilterTheme.mockReturnValue(
        new Promise((_resolve, reject) => {
          rejectTheme = reject;
        }),
      );

      const load = store.getState().rarityInsights.loadFilterTheme("filter-1");
      store.getState().settings.setSetting("raritySource", "poe.ninja");
      store.getState().settings.setSetting("selectedFilterId", null);
      store.getState().rarityInsights.setSelectedFilterId(null);
      store.getState().rarityInsights.clearFilterTheme();

      rejectTheme(new Error("Old theme failed"));
      await load;

      expect(store.getState().rarityInsights.activeFilterTheme).toBeNull();
      expect(store.getState().rarityInsights.isThemeLoading).toBe(false);
      expect(store.getState().rarityInsights.themeError).toBeNull();
    });
  });

  // ── Direct setters ────────────────────────────────────────────────────

  describe("direct setters", () => {
    it("setAvailableFilters replaces available filters", () => {
      const filters = [makeFilter({ id: "a" }), makeFilter({ id: "b" })];

      store.getState().rarityInsights.setAvailableFilters(filters);

      expect(store.getState().rarityInsights.availableFilters).toHaveLength(2);
      expect(store.getState().rarityInsights.availableFilters[0].id).toBe("a");
    });

    it("setAvailableFilters with empty array clears filters", () => {
      store
        .getState()
        .rarityInsights.setAvailableFilters([makeFilter({ id: "x" })]);
      expect(store.getState().rarityInsights.availableFilters).toHaveLength(1);

      store.getState().rarityInsights.setAvailableFilters([]);
      expect(store.getState().rarityInsights.availableFilters).toHaveLength(0);
    });

    it("setSelectedFilterId sets the filter id", () => {
      store.getState().rarityInsights.setSelectedFilterId("xyz");
      expect(store.getState().rarityInsights.selectedFilterId).toBe("xyz");
    });

    it("setSelectedFilterId with null clears selection", () => {
      store.getState().rarityInsights.setSelectedFilterId("xyz");
      store.getState().rarityInsights.setSelectedFilterId(null);
      expect(store.getState().rarityInsights.selectedFilterId).toBeNull();
    });

    it("setScanError sets the scan error", () => {
      store.getState().rarityInsights.setScanError("scan broke");
      expect(store.getState().rarityInsights.scanError).toBe("scan broke");
    });

    it("setScanError with null clears the scan error", () => {
      store.getState().rarityInsights.setScanError("scan broke");
      store.getState().rarityInsights.setScanError(null);
      expect(store.getState().rarityInsights.scanError).toBeNull();
    });

    it("setParseError sets the parse error", () => {
      store.getState().rarityInsights.setParseError("parse broke");
      expect(store.getState().rarityInsights.parseError).toBe("parse broke");
    });

    it("setParseError with null clears the parse error", () => {
      store.getState().rarityInsights.setParseError("parse broke");
      store.getState().rarityInsights.setParseError(null);
      expect(store.getState().rarityInsights.parseError).toBeNull();
    });
  });

  // ── Getters ────────────────────────────────────────────────────────────

  describe("getters", () => {
    describe("getSelectedFilter", () => {
      it("returns null when no filter is selected", () => {
        expect(store.getState().rarityInsights.getSelectedFilter()).toBeNull();
      });

      it("returns null when selectedFilterId does not match any filter", () => {
        store
          .getState()
          .rarityInsights.setAvailableFilters([makeFilter({ id: "a" })]);
        store.getState().rarityInsights.setSelectedFilterId("non-existent");

        expect(store.getState().rarityInsights.getSelectedFilter()).toBeNull();
      });

      it("returns the matching filter when selectedFilterId is valid", () => {
        const filters = [
          makeFilter({ id: "a", name: "Alpha" }),
          makeFilter({ id: "b", name: "Beta" }),
        ];

        store.getState().rarityInsights.setAvailableFilters(filters);
        store.getState().rarityInsights.setSelectedFilterId("b");

        const selected = store.getState().rarityInsights.getSelectedFilter();
        expect(selected).not.toBeNull();
        expect(selected!.id).toBe("b");
        expect(selected!.name).toBe("Beta");
      });
    });

    describe("getLocalFilters", () => {
      it("returns empty array when no filters exist", () => {
        expect(store.getState().rarityInsights.getLocalFilters()).toEqual([]);
      });

      it("returns only filters with type 'local'", () => {
        const filters = [
          makeFilter({ id: "local-1", type: "local", name: "Local A" }),
          makeFilter({ id: "online-1", type: "online", name: "Online A" }),
          makeFilter({ id: "local-2", type: "local", name: "Local B" }),
        ];

        store.getState().rarityInsights.setAvailableFilters(filters);

        const localFilters = store.getState().rarityInsights.getLocalFilters();
        expect(localFilters).toHaveLength(2);
        expect(localFilters.map((f) => f.id)).toEqual(["local-1", "local-2"]);
      });
    });

    describe("getOnlineFilters", () => {
      it("returns empty array when no filters exist", () => {
        expect(store.getState().rarityInsights.getOnlineFilters()).toEqual([]);
      });

      it("returns only filters with type 'online'", () => {
        const filters = [
          makeFilter({ id: "local-1", type: "local", name: "Local A" }),
          makeFilter({ id: "online-1", type: "online", name: "Online A" }),
          makeFilter({ id: "online-2", type: "online", name: "Online B" }),
        ];

        store.getState().rarityInsights.setAvailableFilters(filters);

        const onlineFilters = store
          .getState()
          .rarityInsights.getOnlineFilters();
        expect(onlineFilters).toHaveLength(2);
        expect(onlineFilters.map((f) => f.id)).toEqual([
          "online-1",
          "online-2",
        ]);
      });

      it("returns empty when all filters are local", () => {
        const filters = [
          makeFilter({ id: "local-1", type: "local" }),
          makeFilter({ id: "local-2", type: "local" }),
        ];

        store.getState().rarityInsights.setAvailableFilters(filters);

        expect(store.getState().rarityInsights.getOnlineFilters()).toEqual([]);
      });
    });

    describe("getters with mixed filter operations", () => {
      it("getLocalFilters and getOnlineFilters partition all filters", () => {
        const filters = [
          makeFilter({ id: "l1", type: "local" }),
          makeFilter({ id: "o1", type: "online" }),
          makeFilter({ id: "l2", type: "local" }),
          makeFilter({ id: "o2", type: "online" }),
          makeFilter({ id: "l3", type: "local" }),
        ];

        store.getState().rarityInsights.setAvailableFilters(filters);

        const localFilters = store.getState().rarityInsights.getLocalFilters();
        const onlineFilters = store
          .getState()
          .rarityInsights.getOnlineFilters();

        expect(localFilters).toHaveLength(3);
        expect(onlineFilters).toHaveLength(2);
        expect(localFilters.length + onlineFilters.length).toBe(filters.length);
      });
    });
  });

  // ── Integration-style scenarios ────────────────────────────────────────

  describe("integration scenarios", () => {
    it("scan then select then parse full workflow", async () => {
      const filters = [
        makeFilter({ id: "f1", name: "My Filter", isFullyParsed: false }),
      ];

      electron.rarityInsights.scan.mockResolvedValue({
        filters,
        localCount: 1,
        onlineCount: 0,
      });

      // Step 1: Scan
      await store.getState().rarityInsights.scanFilters();
      expect(store.getState().rarityInsights.availableFilters).toHaveLength(1);

      // Step 2: Select
      await store.getState().rarityInsights.selectFilter("f1");
      expect(store.getState().rarityInsights.selectedFilterId).toBe("f1");
      expect(store.getState().rarityInsights.getSelectedFilter()!.name).toBe(
        "My Filter",
      );

      // Step 3: Parse
      electron.rarityInsights.parse.mockResolvedValue({
        cards: [],
        totalCards: 10,
      });
      await store.getState().rarityInsights.parseFilter("f1");

      const selected = store.getState().rarityInsights.getSelectedFilter();
      expect(selected!.isFullyParsed).toBe(true);
    });

    it("scan replaces previous filters", async () => {
      electron.rarityInsights.scan.mockResolvedValue({
        filters: [makeFilter({ id: "old" })],
        localCount: 1,
        onlineCount: 0,
      });

      await store.getState().rarityInsights.scanFilters();
      expect(store.getState().rarityInsights.availableFilters).toHaveLength(1);
      expect(store.getState().rarityInsights.availableFilters[0].id).toBe(
        "old",
      );

      electron.rarityInsights.scan.mockResolvedValue({
        filters: [makeFilter({ id: "new-1" }), makeFilter({ id: "new-2" })],
        localCount: 2,
        onlineCount: 0,
      });

      await store.getState().rarityInsights.scanFilters();
      expect(store.getState().rarityInsights.availableFilters).toHaveLength(2);
      expect(
        store.getState().rarityInsights.availableFilters.map((f) => f.id),
      ).toEqual(["new-1", "new-2"]);
    });
  });
});
