import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DivinationCardDTO } from "~/main/modules/divination-cards/DivinationCards.dto";
import type { DiscoveredRarityInsightsDTO } from "~/main/modules/rarity-insights/RarityInsights.dto";
import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import { makeDivinationCardDTO } from "~/renderer/__test-setup__/fixtures";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";
import { trackEvent } from "~/renderer/modules/umami";

let store: TestStore;
let electron: ElectronMock;

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeCard(
  overrides: Partial<DivinationCardDTO> = {},
): DivinationCardDTO {
  return makeDivinationCardDTO(overrides) as DivinationCardDTO;
}

function makeFilter(
  overrides: Partial<DiscoveredRarityInsightsDTO> = {},
): DiscoveredRarityInsightsDTO {
  return {
    id: "filter-1",
    name: "My Filter",
    type: "local",
    filePath: "/path",
    fileName: "my-filter.filter",
    isFullyParsed: false,
    isOutdated: false,
    lastUpdate: null,
    ...overrides,
  };
}

function makeStoreWithCards() {
  return createTestStore({
    cards: {
      allCards: [
        makeCard({
          id: "1",
          name: "The Doctor",
          stackSize: 8,
          rarity: 1,
          fromBoss: false,
        }),
        makeCard({
          id: "2",
          name: "House of Mirrors",
          stackSize: 9,
          rarity: 2,
          fromBoss: false,
        }),
        makeCard({
          id: "3",
          name: "Rain of Chaos",
          stackSize: 8,
          rarity: 4,
          fromBoss: false,
        }),
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    rarityInsights: {
      availableFilters: [
        makeFilter({ id: "filter-1", name: "My Filter" }),
        makeFilter({ id: "filter-2", name: "Second Filter" }),
        makeFilter({ id: "filter-3", name: "Third Filter" }),
        makeFilter({ id: "filter-4", name: "Fourth Filter" }),
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  });
}

function slice() {
  return store.getState().rarityInsightsComparison;
}

// ─── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("RarityInsightsComparison.slice", () => {
  // ─── 1. Initial state ─────────────────────────────────────────────────

  describe("initial state", () => {
    it("has correct default values", () => {
      const s = slice();
      expect(s.selectedFilters).toEqual([]);
      expect(s.parsedResults).toEqual(new Map());
      expect(s.parsingFilterId).toBeNull();
      expect(s.parseErrors).toEqual(new Map());
      expect(s.showDiffsOnly).toBe(false);
      expect(s.includeBossCards).toBe(false);
      expect(s.includeDisabledCards).toBe(false);
      expect(s.priorityPoeNinjaRarity).toBeNull();
      expect(s.priorityPlRarity).toBeNull();
      expect(s.priorityFilterRarities).toEqual({});
      expect(s.tableSorting).toEqual([{ id: "name", desc: false }]);
    });
  });

  // ─── 2. toggleFilter ─────────────────────────────────────────────────

  describe("toggleFilter", () => {
    it("adds a filter to selectedFilters", () => {
      // Mock parse to prevent fire-and-forget from throwing
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 0,
        rarities: [],
        hasDivinationSection: true,
      });

      slice().toggleFilter("filter-1");
      expect(slice().selectedFilters).toContain("filter-1");
    });

    it("removes a filter when toggled again", () => {
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 0,
        rarities: [],
        hasDivinationSection: true,
      });

      slice().toggleFilter("filter-1");
      expect(slice().selectedFilters).toContain("filter-1");

      slice().toggleFilter("filter-1");
      expect(slice().selectedFilters).not.toContain("filter-1");
    });

    it("respects MAX_SELECTED_FILTERS = 3", () => {
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "any",
        filterName: "F",
        totalCards: 0,
        rarities: [],
        hasDivinationSection: true,
      });

      slice().toggleFilter("filter-1");
      slice().toggleFilter("filter-2");
      slice().toggleFilter("filter-3");
      expect(slice().selectedFilters).toHaveLength(3);

      // Attempting to add a 4th should be ignored
      slice().toggleFilter("filter-4");
      expect(slice().selectedFilters).toHaveLength(3);
      expect(slice().selectedFilters).not.toContain("filter-4");
    });

    it("tracks filter-comparison-toggle event", () => {
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 0,
        rarities: [],
        hasDivinationSection: true,
      });

      slice().toggleFilter("filter-1");
      expect(trackEvent).toHaveBeenCalledWith("filter-comparison-toggle", {
        filterId: "filter-1",
      });
    });
  });

  // ─── 3. toggleFilter triggers parsing ─────────────────────────────────

  describe("toggleFilter triggers parsing", () => {
    it("eagerly sets parsingFilterId and calls parseFilter for a new unparsed filter", async () => {
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 2,
        rarities: [
          { filterId: "filter-1", cardName: "The Doctor", rarity: 1 },
          { filterId: "filter-1", cardName: "House of Mirrors", rarity: 2 },
        ],
        hasDivinationSection: true,
      });

      slice().toggleFilter("filter-1");

      // parsingFilterId set eagerly
      // After the async parse resolves, parsedResults should be populated
      await vi.waitFor(() => {
        expect(slice().parsedResults.has("filter-1")).toBe(true);
      });
      expect(slice().parsingFilterId).toBeNull();
      expect(electron.rarityInsights.parse).toHaveBeenCalledWith("filter-1");
    });
  });

  // ─── 4. parseFilter success ───────────────────────────────────────────

  describe("parseFilter", () => {
    it("stores parsed results with rarity map on success", async () => {
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 2,
        rarities: [
          { filterId: "filter-1", cardName: "The Doctor", rarity: 1 },
          { filterId: "filter-1", cardName: "House of Mirrors", rarity: 3 },
        ],
        hasDivinationSection: true,
      });

      await slice().parseFilter("filter-1");

      const parsed = slice().parsedResults.get("filter-1");
      expect(parsed).toBeDefined();
      expect(parsed!.filterId).toBe("filter-1");
      expect(parsed!.filterName).toBe("My Filter");
      expect(parsed!.totalCards).toBe(2);
      expect(parsed!.rarities.get("The Doctor")).toBe(1);
      expect(parsed!.rarities.get("House of Mirrors")).toBe(3);
      expect(slice().parsingFilterId).toBeNull();
    });

    // ─── 5. parseFilter error ───────────────────────────────────────────

    it("stores error in parseErrors on failure", async () => {
      electron.rarityInsights.parse.mockRejectedValue(
        new Error("Parse failed"),
      );

      await slice().parseFilter("filter-1");

      expect(slice().parseErrors.get("filter-1")).toBe("Parse failed");
      expect(slice().parsingFilterId).toBeNull();
      expect(slice().parsedResults.has("filter-1")).toBe(false);
    });

    it("stores generic message for non-Error thrown value", async () => {
      electron.rarityInsights.parse.mockRejectedValue("some string error");

      await slice().parseFilter("filter-1");

      expect(slice().parseErrors.get("filter-1")).toBe(
        "Failed to parse filter",
      );
    });

    it("skips parsing if filter is already parsed", async () => {
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 0,
        rarities: [],
        hasDivinationSection: true,
      });

      await slice().parseFilter("filter-1");
      electron.rarityInsights.parse.mockClear();

      await slice().parseFilter("filter-1");
      expect(electron.rarityInsights.parse).not.toHaveBeenCalled();
    });
  });

  // ─── 6. parseNextUnparsedFilter ───────────────────────────────────────

  describe("parseNextUnparsedFilter", () => {
    it("finds and parses the next selected but unparsed filter", async () => {
      // Add two filters to selectedFilters manually
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 0,
        rarities: [],
        hasDivinationSection: true,
      });

      // Add filter-1 (triggers parse automatically)
      slice().toggleFilter("filter-1");
      await vi.waitFor(() => {
        expect(slice().parsedResults.has("filter-1")).toBe(true);
      });

      // Now add filter-2
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-2",
        filterName: "Second Filter",
        totalCards: 0,
        rarities: [],
        hasDivinationSection: true,
      });
      slice().toggleFilter("filter-2");
      await vi.waitFor(() => {
        expect(slice().parsedResults.has("filter-2")).toBe(true);
      });

      // Both should now be parsed
      expect(slice().parsedResults.has("filter-1")).toBe(true);
      expect(slice().parsedResults.has("filter-2")).toBe(true);
    });
  });

  // ─── 7. rescan ────────────────────────────────────────────────────────

  describe("rescan", () => {
    it("resets parsedResults, parseErrors, selectedFilters and calls scanFilters", async () => {
      // Setup some state first
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 0,
        rarities: [],
        hasDivinationSection: true,
      });
      slice().toggleFilter("filter-1");
      await vi.waitFor(() => {
        expect(slice().parsedResults.has("filter-1")).toBe(true);
      });

      electron.rarityInsights.scan.mockResolvedValue({
        filters: [],
        totalFilters: 0,
        errors: [],
      });

      await slice().rescan();

      expect(slice().selectedFilters).toEqual([]);
      expect(slice().parsedResults.size).toBe(0);
      expect(slice().parseErrors.size).toBe(0);
      expect(slice().parsingFilterId).toBeNull();
      expect(slice().showDiffsOnly).toBe(false);
      expect(electron.rarityInsights.scan).toHaveBeenCalled();
    });
  });

  // ─── 8. setShowDiffsOnly / setIncludeBossCards ────────────────────────

  describe("setShowDiffsOnly", () => {
    it("sets showDiffsOnly to true", () => {
      slice().setShowDiffsOnly(true);
      expect(slice().showDiffsOnly).toBe(true);
    });

    it("sets showDiffsOnly to false", () => {
      slice().setShowDiffsOnly(true);
      slice().setShowDiffsOnly(false);
      expect(slice().showDiffsOnly).toBe(false);
    });
  });

  describe("setIncludeBossCards", () => {
    it("sets includeBossCards to true", () => {
      slice().setIncludeBossCards(true);
      expect(slice().includeBossCards).toBe(true);
    });

    it("sets includeBossCards to false", () => {
      slice().setIncludeBossCards(true);
      slice().setIncludeBossCards(false);
      expect(slice().includeBossCards).toBe(false);
    });
  });

  describe("setIncludeDisabledCards", () => {
    it("should default to false", () => {
      expect(slice().includeDisabledCards).toBe(false);
    });

    it("should toggle includeDisabledCards", () => {
      slice().setIncludeDisabledCards(true);
      expect(slice().includeDisabledCards).toBe(true);

      slice().setIncludeDisabledCards(false);
      expect(slice().includeDisabledCards).toBe(false);
    });
  });

  // ─── 9. handlePoeNinjaRarityClick ────────────────────────────────────

  describe("handlePoeNinjaRarityClick", () => {
    it("sets priorityPoeNinjaRarity and updates tableSorting", () => {
      slice().handlePoeNinjaRarityClick(2);
      expect(slice().priorityPoeNinjaRarity).toBe(2);
      expect(slice().tableSorting).toEqual([
        { id: "poeNinjaRarity", desc: false },
      ]);
    });

    it("clears priorityPoeNinjaRarity when same rarity is clicked again", () => {
      slice().handlePoeNinjaRarityClick(2);
      slice().handlePoeNinjaRarityClick(2);
      expect(slice().priorityPoeNinjaRarity).toBeNull();
      expect(slice().tableSorting).toEqual([{ id: "name", desc: false }]);
    });

    it("clears priorityPlRarity and priorityFilterRarities", () => {
      // Set some other priorities first
      slice().handlePlRarityClick(3);
      expect(slice().priorityPlRarity).toBe(3);

      slice().handlePoeNinjaRarityClick(1);
      expect(slice().priorityPlRarity).toBeNull();
      expect(slice().priorityFilterRarities).toEqual({});
    });
  });

  // ─── 10. handlePlRarityClick ─────────────────────────────────────────

  describe("handlePlRarityClick", () => {
    it("sets priorityPlRarity and updates tableSorting", () => {
      slice().handlePlRarityClick(3);
      expect(slice().priorityPlRarity).toBe(3);
      expect(slice().tableSorting).toEqual([
        { id: "prohibitedLibraryRarity", desc: false },
      ]);
    });

    it("clears priorityPlRarity when same rarity is clicked again", () => {
      slice().handlePlRarityClick(3);
      slice().handlePlRarityClick(3);
      expect(slice().priorityPlRarity).toBeNull();
      expect(slice().tableSorting).toEqual([{ id: "name", desc: false }]);
    });

    it("clears priorityPoeNinjaRarity and priorityFilterRarities", () => {
      slice().handlePoeNinjaRarityClick(2);
      expect(slice().priorityPoeNinjaRarity).toBe(2);

      slice().handlePlRarityClick(1);
      expect(slice().priorityPoeNinjaRarity).toBeNull();
      expect(slice().priorityFilterRarities).toEqual({});
    });
  });

  // ─── 11. handleFilterRarityClick ─────────────────────────────────────

  describe("handleFilterRarityClick", () => {
    it("sets per-filter priority rarity and updates tableSorting", () => {
      slice().handleFilterRarityClick("filter-1", 2);
      expect(slice().priorityFilterRarities).toEqual({ "filter-1": 2 });
      expect(slice().tableSorting).toEqual([
        { id: "filter_filter-1", desc: false },
      ]);
    });

    it("clears per-filter priority when same rarity is clicked again", () => {
      slice().handleFilterRarityClick("filter-1", 2);
      slice().handleFilterRarityClick("filter-1", 2);
      expect(slice().priorityFilterRarities).toEqual({});
      expect(slice().tableSorting).toEqual([{ id: "name", desc: false }]);
    });

    it("clears other priority sources", () => {
      slice().handlePoeNinjaRarityClick(1);
      slice().handlePlRarityClick(3);

      slice().handleFilterRarityClick("filter-1", 4);
      expect(slice().priorityPoeNinjaRarity).toBeNull();
      expect(slice().priorityPlRarity).toBeNull();
      expect(slice().priorityFilterRarities).toEqual({ "filter-1": 4 });
    });
  });

  // ─── 12. handleTableSortingChange ────────────────────────────────────

  describe("handleTableSortingChange", () => {
    it("sets tableSorting and clears unrelated priorities", () => {
      // Set some priorities first
      slice().handlePoeNinjaRarityClick(2);
      slice().handleFilterRarityClick("filter-1", 3);
      expect(slice().priorityPoeNinjaRarity).toBeNull(); // handleFilterRarityClick cleared it

      // Set a known state
      slice().handlePoeNinjaRarityClick(2);
      expect(slice().priorityPoeNinjaRarity).toBe(2);

      // Now change sort to "name" column — priorities should clear
      slice().handleTableSortingChange([{ id: "name", desc: false }]);
      expect(slice().tableSorting).toEqual([{ id: "name", desc: false }]);
      expect(slice().priorityPoeNinjaRarity).toBeNull();
      expect(slice().priorityPlRarity).toBeNull();
      expect(slice().priorityFilterRarities).toEqual({});
    });

    it("keeps priority if the sorted column matches", () => {
      slice().handlePoeNinjaRarityClick(2);
      expect(slice().priorityPoeNinjaRarity).toBe(2);

      // Change sort but keep poeNinjaRarity column
      slice().handleTableSortingChange([{ id: "poeNinjaRarity", desc: true }]);
      expect(slice().priorityPoeNinjaRarity).toBe(2);
    });

    it("deletes priorityFilterRarities entry when its column is no longer sorted", () => {
      // Set a filter priority via handleFilterRarityClick
      slice().handleFilterRarityClick("someFilterId", 2);
      expect(slice().priorityFilterRarities).toHaveProperty("someFilterId", 2);

      // Sort by a column that does NOT include filter_someFilterId
      slice().handleTableSortingChange([{ id: "name", desc: false }]);

      expect(slice().priorityFilterRarities).not.toHaveProperty("someFilterId");
      expect(slice().priorityFilterRarities).toEqual({});
    });
  });

  // ─── 13. updateFilterCardRarity ──────────────────────────────────────

  describe("updateFilterCardRarity", () => {
    it("updates local parsedResults map on success", async () => {
      // First, parse a filter
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 1,
        rarities: [{ filterId: "filter-1", cardName: "The Doctor", rarity: 1 }],
        hasDivinationSection: true,
      });
      await slice().parseFilter("filter-1");
      expect(
        slice().parsedResults.get("filter-1")!.rarities.get("The Doctor"),
      ).toBe(1);

      // Now update rarity
      electron.rarityInsights.updateCardRarity.mockResolvedValue({
        success: true,
      });
      await slice().updateFilterCardRarity("filter-1", "The Doctor", 3);

      expect(
        slice().parsedResults.get("filter-1")!.rarities.get("The Doctor"),
      ).toBe(3);
      expect(trackEvent).toHaveBeenCalledWith("modify-rarity-filter", {
        filterId: "filter-1",
        cardName: "The Doctor",
        rarity: 3,
      });
    });

    it("does not crash when IPC throws an error", async () => {
      // Parse a filter first
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 1,
        rarities: [{ filterId: "filter-1", cardName: "The Doctor", rarity: 1 }],
        hasDivinationSection: true,
      });
      await slice().parseFilter("filter-1");

      // Mock updateCardRarity to reject
      electron.rarityInsights.updateCardRarity.mockRejectedValueOnce(
        new Error("IPC exploded"),
      );

      // Should not throw
      await slice().updateFilterCardRarity("filter-1", "The Doctor", 3);

      // State should remain unchanged
      expect(
        slice().parsedResults.get("filter-1")!.rarities.get("The Doctor"),
      ).toBe(1);
    });

    it("does not update local state when IPC returns success: false", async () => {
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 1,
        rarities: [{ filterId: "filter-1", cardName: "The Doctor", rarity: 1 }],
        hasDivinationSection: true,
      });
      await slice().parseFilter("filter-1");

      electron.rarityInsights.updateCardRarity.mockResolvedValue({
        success: false,
      });
      await slice().updateFilterCardRarity("filter-1", "The Doctor", 3);

      expect(
        slice().parsedResults.get("filter-1")!.rarities.get("The Doctor"),
      ).toBe(1);
    });
  });

  // ─── 14. reset ────────────────────────────────────────────────────────

  describe("reset", () => {
    it("clears all state to defaults", async () => {
      // Dirty up the state
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 0,
        rarities: [],
        hasDivinationSection: true,
      });
      slice().toggleFilter("filter-1");
      await vi.waitFor(() => {
        expect(slice().parsedResults.has("filter-1")).toBe(true);
      });
      slice().setShowDiffsOnly(true);
      slice().setIncludeBossCards(true);
      slice().setIncludeDisabledCards(true);
      slice().handlePoeNinjaRarityClick(2);

      // Reset
      slice().reset();

      expect(slice().selectedFilters).toEqual([]);
      expect(slice().parsedResults.size).toBe(0);
      expect(slice().parsingFilterId).toBeNull();
      expect(slice().parseErrors.size).toBe(0);
      expect(slice().showDiffsOnly).toBe(false);
      expect(slice().includeBossCards).toBe(false);
      expect(slice().includeDisabledCards).toBe(false);
      expect(slice().priorityPoeNinjaRarity).toBeNull();
      expect(slice().priorityPlRarity).toBeNull();
      expect(slice().priorityFilterRarities).toEqual({});
      expect(slice().tableSorting).toEqual([{ id: "name", desc: false }]);
    });
  });

  // ─── 15. getSelectedFilterDetails ────────────────────────────────────

  describe("getSelectedFilterDetails", () => {
    it("maps selectedFilters to availableFilters from rarityInsights slice", () => {
      store = makeStoreWithCards();
      electron = window.electron as unknown as ElectronMock;

      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 0,
        rarities: [],
        hasDivinationSection: true,
      });

      store.getState().rarityInsightsComparison.toggleFilter("filter-1");
      const details = store
        .getState()
        .rarityInsightsComparison.getSelectedFilterDetails();

      expect(details).toHaveLength(1);
      expect(details[0].id).toBe("filter-1");
      expect(details[0].name).toBe("My Filter");
    });

    it("returns empty array when no filters selected", () => {
      const details = slice().getSelectedFilterDetails();
      expect(details).toEqual([]);
    });
  });

  // ─── 16. getAllSelectedParsed ─────────────────────────────────────────

  describe("getAllSelectedParsed", () => {
    it("returns true when all selected filters are parsed", async () => {
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 0,
        rarities: [],
        hasDivinationSection: true,
      });

      slice().toggleFilter("filter-1");
      await vi.waitFor(() => {
        expect(slice().parsedResults.has("filter-1")).toBe(true);
      });

      expect(slice().getAllSelectedParsed()).toBe(true);
    });

    it("returns false when some selected filters are not yet parsed", () => {
      // Prevent parse from resolving immediately
      electron.rarityInsights.parse.mockReturnValue(new Promise(() => {}));

      slice().toggleFilter("filter-1");
      expect(slice().getAllSelectedParsed()).toBe(false);
    });

    it("returns true when no filters are selected (vacuous truth)", () => {
      expect(slice().getAllSelectedParsed()).toBe(true);
    });
  });

  // ─── 17. getDifferences ──────────────────────────────────────────────

  describe("getDifferences", () => {
    it("returns set of card names where filter rarity differs from poe.ninja rarity", async () => {
      store = makeStoreWithCards();
      electron = window.electron as unknown as ElectronMock;
      const s = () => store.getState().rarityInsightsComparison;

      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 3,
        rarities: [
          { filterId: "filter-1", cardName: "The Doctor", rarity: 1 }, // same as poe.ninja (1)
          { filterId: "filter-1", cardName: "House of Mirrors", rarity: 4 }, // differs from poe.ninja (2)
          { filterId: "filter-1", cardName: "Rain of Chaos", rarity: 4 }, // same as poe.ninja (4)
        ],
        hasDivinationSection: true,
      });

      s().toggleFilter("filter-1");
      await vi.waitFor(() => {
        expect(s().parsedResults.has("filter-1")).toBe(true);
      });

      const diffs = s().getDifferences();
      expect(diffs.has("House of Mirrors")).toBe(true);
      expect(diffs.has("The Doctor")).toBe(false);
      expect(diffs.has("Rain of Chaos")).toBe(false);
    });

    it("returns cached value on second call without state change", async () => {
      store = makeStoreWithCards();
      electron = window.electron as unknown as ElectronMock;
      const s = () => store.getState().rarityInsightsComparison;

      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 3,
        rarities: [
          { filterId: "filter-1", cardName: "The Doctor", rarity: 1 },
          { filterId: "filter-1", cardName: "House of Mirrors", rarity: 4 },
          { filterId: "filter-1", cardName: "Rain of Chaos", rarity: 4 },
        ],
        hasDivinationSection: true,
      });

      s().toggleFilter("filter-1");
      await vi.waitFor(() => {
        expect(s().parsedResults.has("filter-1")).toBe(true);
      });

      const first = s().getDifferences();
      const second = s().getDifferences();
      // Same reference means it was returned from cache
      expect(second).toBe(first);
    });

    it("returns empty set when no filters are parsed", () => {
      store = makeStoreWithCards();
      const diffs = store.getState().rarityInsightsComparison.getDifferences();
      expect(diffs.size).toBe(0);
    });

    it("treats missing card in filter as rarity 4 (common)", async () => {
      store = makeStoreWithCards();
      electron = window.electron as unknown as ElectronMock;
      const s = () => store.getState().rarityInsightsComparison;

      // Only include The Doctor — House of Mirrors and Rain of Chaos are missing
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 1,
        rarities: [{ filterId: "filter-1", cardName: "The Doctor", rarity: 1 }],
        hasDivinationSection: true,
      });

      s().toggleFilter("filter-1");
      await vi.waitFor(() => {
        expect(s().parsedResults.has("filter-1")).toBe(true);
      });

      const diffs = s().getDifferences();
      // The Doctor has poe.ninja rarity 1, filter rarity 1 → same, not a diff
      expect(diffs.has("The Doctor")).toBe(false);
      // House of Mirrors has poe.ninja rarity 1, filter defaults to 4 → different
      expect(diffs.has("House of Mirrors")).toBe(true);
      // Rain of Chaos has poe.ninja rarity 4, filter defaults to 4 → same, not a diff
      expect(diffs.has("Rain of Chaos")).toBe(false);
    });
  });

  // ─── 18. getCanShowDiffs ──────────────────────────────────────────────

  describe("getCanShowDiffs", () => {
    it("returns false when no filters are selected", () => {
      expect(slice().getCanShowDiffs()).toBe(false);
    });

    it("returns true when at least one filter is selected", () => {
      electron.rarityInsights.parse.mockResolvedValue({
        filterId: "filter-1",
        filterName: "My Filter",
        totalCards: 0,
        rarities: [],
        hasDivinationSection: true,
      });

      slice().toggleFilter("filter-1");
      expect(slice().getCanShowDiffs()).toBe(true);
    });
  });
});
