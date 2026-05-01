import { beforeEach, describe, expect, it } from "vitest";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import { makeDivinationCardDTO } from "~/renderer/__test-setup__/fixtures";
import {
  type CardsSlice,
  createCardsSlice,
} from "~/renderer/modules/cards/Cards.slice/Cards.slice";
import {
  createSettingsSlice,
  type SettingsSlice,
} from "~/renderer/modules/settings/Settings.slice/Settings.slice";

// ─── Minimal test store (Cards + Settings only) ────────────────────────────

type TestStore = CardsSlice & SettingsSlice;

function createTestStore() {
  return create<TestStore>()(
    devtools(
      immer((...a) => ({
        ...createSettingsSlice(...a),
        ...createCardsSlice(...a),
      })),
      { enabled: false },
    ),
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const makeCard = makeDivinationCardDTO;

function makeSampleCards() {
  return [
    makeCard({
      id: "1",
      name: "The Doctor",
      rarity: 1,
      stackSize: 8,
      fromBoss: false,
    }),
    makeCard({
      id: "2",
      name: "The Nurse",
      rarity: 2,
      stackSize: 4,
      fromBoss: false,
    }),
    makeCard({
      id: "3",
      name: "Rain of Chaos",
      rarity: 4,
      stackSize: 8,
      fromBoss: false,
    }),
    makeCard({
      id: "4",
      name: "Abandoned Wealth",
      rarity: 2,
      stackSize: 5,
      fromBoss: false,
    }),
    makeCard({
      id: "5",
      name: "The Demon",
      rarity: 3,
      stackSize: 6,
      fromBoss: true,
    }),
  ];
}

// ─── Test suite ────────────────────────────────────────────────────────────

let store: ReturnType<typeof createTestStore>;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

describe("Cards.slice", () => {
  // ─── Initial State ───────────────────────────────────────────────────

  describe("initial state", () => {
    it("has empty allCards", () => {
      expect(store.getState().cards.allCards).toEqual([]);
    });

    it("has isLoading false", () => {
      expect(store.getState().cards.isLoading).toBe(false);
    });

    it("has error null", () => {
      expect(store.getState().cards.error).toBeNull();
    });

    it("has empty searchQuery", () => {
      expect(store.getState().cards.searchQuery).toBe("");
    });

    it('has rarityFilter "all"', () => {
      expect(store.getState().cards.rarityFilter).toBe("all");
    });

    it("has includeBossCards false", () => {
      expect(store.getState().cards.includeBossCards).toBe(false);
    });

    it('has sortField "name"', () => {
      expect(store.getState().cards.sortField).toBe("name");
    });

    it('has sortDirection "asc"', () => {
      expect(store.getState().cards.sortDirection).toBe("asc");
    });

    it("has currentPage 1", () => {
      expect(store.getState().cards.currentPage).toBe(1);
    });

    it("has pageSize 20", () => {
      expect(store.getState().cards.pageSize).toBe(20);
    });

    it("has _lastCardsKey null", () => {
      expect(store.getState().cards._lastCardsKey).toBeNull();
    });

    it("has _pendingCardsKey null", () => {
      expect(store.getState().cards._pendingCardsKey).toBeNull();
    });
  });

  // ─── loadCards ───────────────────────────────────────────────────────

  describe("loadCards", () => {
    it("calls window.electron.divinationCards.getAll with the active game", async () => {
      const cards = makeSampleCards();
      electron.divinationCards.getAll.mockResolvedValue(cards);

      await store.getState().cards.loadCards();

      expect(electron.divinationCards.getAll).toHaveBeenCalledWith(
        "poe1",
        false,
      );
    });

    it("sets isLoading true while loading", async () => {
      let resolveGetAll!: (value: unknown[]) => void;
      electron.divinationCards.getAll.mockReturnValue(
        new Promise((resolve) => {
          resolveGetAll = resolve;
        }),
      );

      const promise = store.getState().cards.loadCards();
      expect(store.getState().cards.isLoading).toBe(true);

      resolveGetAll([]);
      await promise;

      expect(store.getState().cards.isLoading).toBe(false);
    });

    it("populates allCards on success", async () => {
      const cards = makeSampleCards();
      electron.divinationCards.getAll.mockResolvedValue(cards);

      await store.getState().cards.loadCards();

      expect(store.getState().cards.allCards).toHaveLength(5);
      expect(store.getState().cards.allCards[0].name).toBe("The Doctor");
    });

    it("resets currentPage to 1 on success", async () => {
      store.getState().cards.setCurrentPage(5);
      electron.divinationCards.getAll.mockResolvedValue([]);

      await store.getState().cards.loadCards();

      expect(store.getState().cards.currentPage).toBe(1);
    });

    it("sets error on failure", async () => {
      electron.divinationCards.getAll.mockRejectedValue(
        new Error("Network error"),
      );

      await store.getState().cards.loadCards();

      expect(store.getState().cards.error).toBe("Network error");
      expect(store.getState().cards.isLoading).toBe(false);
    });

    it("clears previous error on new load", async () => {
      electron.divinationCards.getAll.mockRejectedValueOnce(
        new Error("First error"),
      );
      await store.getState().cards.loadCards();
      expect(store.getState().cards.error).toBe("First error");

      electron.divinationCards.getAll.mockResolvedValue([]);
      await store.getState().cards.loadCards();
      expect(store.getState().cards.error).toBeNull();
    });

    it("clears error flag at start of new load", async () => {
      // Set an error manually
      store.setState((s) => {
        s.cards.error = "old error";
      });

      electron.divinationCards.getAll.mockResolvedValue([]);
      await store.getState().cards.loadCards();

      expect(store.getState().cards.error).toBeNull();
    });
  });

  // ─── loadCards dedup ────────────────────────────────────────────────

  describe("loadCards dedup", () => {
    it("skips fetch when _lastCardsKey matches active game", async () => {
      electron.divinationCards.getAll.mockResolvedValue(makeSampleCards());
      await store.getState().cards.loadCards();
      expect(electron.divinationCards.getAll).toHaveBeenCalledTimes(1);

      // Second call with same game should be deduped
      await store.getState().cards.loadCards();
      expect(electron.divinationCards.getAll).toHaveBeenCalledTimes(1);
    });

    it("fetches again after game changes", async () => {
      electron.divinationCards.getAll.mockResolvedValue(makeSampleCards());
      await store.getState().cards.loadCards();
      expect(electron.divinationCards.getAll).toHaveBeenCalledTimes(1);

      // Switch game
      store.setState((s) => {
        s.settings.selectedGame = "poe2";
      });
      electron.divinationCards.getAll.mockResolvedValue([]);
      await store.getState().cards.loadCards();
      expect(electron.divinationCards.getAll).toHaveBeenCalledTimes(2);
    });

    it("fetches again after _lastCardsKey is cleared", async () => {
      electron.divinationCards.getAll.mockResolvedValue(makeSampleCards());
      await store.getState().cards.loadCards();
      expect(electron.divinationCards.getAll).toHaveBeenCalledTimes(1);

      store.setState((s) => {
        s.cards._lastCardsKey = null;
      });
      await store.getState().cards.loadCards();
      expect(electron.divinationCards.getAll).toHaveBeenCalledTimes(2);
    });

    it("does not set _lastCardsKey on failed load", async () => {
      electron.divinationCards.getAll.mockRejectedValue(new Error("fail"));
      await store.getState().cards.loadCards();
      expect(store.getState().cards._lastCardsKey).toBeNull();
      expect(store.getState().cards._pendingCardsKey).toBeNull();
    });

    it("skips fetch when _pendingCardsKey matches active game (in-flight dedup)", async () => {
      let resolveGetAll!: (value: unknown) => void;
      electron.divinationCards.getAll.mockReturnValue(
        new Promise((resolve) => {
          resolveGetAll = resolve;
        }),
      );

      // Start the first load — it will be pending
      const firstLoad = store.getState().cards.loadCards();
      expect(store.getState().cards._pendingCardsKey).toBe("poe1");

      // Second call while first is still in-flight should be deduped
      await store.getState().cards.loadCards();
      expect(electron.divinationCards.getAll).toHaveBeenCalledTimes(1);

      // Resolve the first load
      resolveGetAll(makeSampleCards());
      await firstLoad;
    });
  });

  // ─── Setters (page reset) ───────────────────────────────────────────

  describe("setters reset page", () => {
    it("setSearchQuery sets query and resets page", () => {
      store.getState().cards.setCurrentPage(3);
      store.getState().cards.setSearchQuery("doctor");
      expect(store.getState().cards.searchQuery).toBe("doctor");
      expect(store.getState().cards.currentPage).toBe(1);
    });

    it("setRarityFilter sets rarity and resets page", () => {
      store.getState().cards.setCurrentPage(3);
      store.getState().cards.setRarityFilter(2);
      expect(store.getState().cards.rarityFilter).toBe(2);
      expect(store.getState().cards.currentPage).toBe(1);
    });

    it('setRarityFilter can be set to "all"', () => {
      store.getState().cards.setRarityFilter(2);
      store.getState().cards.setRarityFilter("all");
      expect(store.getState().cards.rarityFilter).toBe("all");
    });

    it("setShowAllCards does not trigger loadCards", () => {
      electron.divinationCards.getAll.mockResolvedValue([]);
      store.getState().cards.setShowAllCards(true);
      // getAll should not have been called — filtering is client-side now
      expect(electron.divinationCards.getAll).not.toHaveBeenCalled();
    });

    it("setIncludeBossCards sets flag and resets page", () => {
      store.getState().cards.setCurrentPage(3);
      store.getState().cards.setIncludeBossCards(true);
      expect(store.getState().cards.includeBossCards).toBe(true);
      expect(store.getState().cards.currentPage).toBe(1);
    });

    it("setIncludeDisabledCards sets flag and resets page", () => {
      store.getState().cards.setCurrentPage(3);
      store.getState().cards.setIncludeDisabledCards(true);
      expect(store.getState().cards.includeDisabledCards).toBe(true);
      expect(store.getState().cards.currentPage).toBe(1);
    });

    it("setPageSize sets size and resets page", () => {
      store.getState().cards.setCurrentPage(3);
      store.getState().cards.setPageSize(50);
      expect(store.getState().cards.pageSize).toBe(50);
      expect(store.getState().cards.currentPage).toBe(1);
    });
  });

  // ─── setSortField ───────────────────────────────────────────────────

  describe("setSortField", () => {
    it("sets a new sort field with asc direction", () => {
      store.getState().cards.setSortField("rarity");
      expect(store.getState().cards.sortField).toBe("rarity");
      expect(store.getState().cards.sortDirection).toBe("asc");
    });

    it("toggles direction when setting the same field", () => {
      // Default is name/asc
      store.getState().cards.setSortField("name");
      expect(store.getState().cards.sortField).toBe("name");
      expect(store.getState().cards.sortDirection).toBe("desc");
    });

    it("toggles back to asc on third call for the same field", () => {
      store.getState().cards.setSortField("name"); // name → desc
      store.getState().cards.setSortField("name"); // name → asc
      expect(store.getState().cards.sortDirection).toBe("asc");
    });

    it("resets direction to asc when switching to a different field", () => {
      store.getState().cards.setSortField("name"); // name → desc
      store.getState().cards.setSortField("rarity"); // rarity → asc
      expect(store.getState().cards.sortField).toBe("rarity");
      expect(store.getState().cards.sortDirection).toBe("asc");
    });

    it("cycles through all three sort fields", () => {
      store.getState().cards.setSortField("rarity");
      expect(store.getState().cards.sortField).toBe("rarity");

      store.getState().cards.setSortField("stackSize");
      expect(store.getState().cards.sortField).toBe("stackSize");

      store.getState().cards.setSortField("name");
      expect(store.getState().cards.sortField).toBe("name");
    });
  });

  // ─── setSortDirection / toggleSortDirection ─────────────────────────

  describe("setSortDirection", () => {
    it("sets the sort direction directly", () => {
      store.getState().cards.setSortDirection("desc");
      expect(store.getState().cards.sortDirection).toBe("desc");
    });

    it("sets the sort direction to asc", () => {
      store.getState().cards.setSortDirection("desc");
      store.getState().cards.setSortDirection("asc");
      expect(store.getState().cards.sortDirection).toBe("asc");
    });
  });

  describe("toggleSortDirection", () => {
    it("toggles from asc to desc", () => {
      store.getState().cards.toggleSortDirection();
      expect(store.getState().cards.sortDirection).toBe("desc");
    });

    it("toggles from desc to asc", () => {
      store.getState().cards.setSortDirection("desc");
      store.getState().cards.toggleSortDirection();
      expect(store.getState().cards.sortDirection).toBe("asc");
    });
  });

  // ─── setCurrentPage ─────────────────────────────────────────────────

  describe("setCurrentPage", () => {
    it("sets the page number", () => {
      store.getState().cards.setCurrentPage(5);
      expect(store.getState().cards.currentPage).toBe(5);
    });
  });

  // ─── Filtering ──────────────────────────────────────────────────────

  describe("getFilteredAndSortedCards", () => {
    beforeEach(async () => {
      electron.divinationCards.getAll.mockResolvedValue(makeSampleCards());
      await store.getState().cards.loadCards();
    });

    it("hides boss cards by default", () => {
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      const names = filtered.map((c) => c.name);
      expect(names).not.toContain("The Demon");
      expect(filtered).toHaveLength(4);
    });

    it("hides disabled cards by default", () => {
      store.setState((s) => {
        s.cards.allCards = [
          makeCard({ id: "1", name: "Enabled Card", isDisabled: false }),
          makeCard({ id: "2", name: "Disabled Card", isDisabled: true }),
        ];
      });
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      const names = filtered.map((c) => c.name);
      expect(names).toContain("Enabled Card");
      expect(names).not.toContain("Disabled Card");
    });

    it("shows disabled cards when includeDisabledCards is true", () => {
      store.setState((s) => {
        s.cards.allCards = [
          makeCard({ id: "1", name: "Enabled Card", isDisabled: false }),
          makeCard({ id: "2", name: "Disabled Card", isDisabled: true }),
        ];
      });
      store.getState().cards.setIncludeDisabledCards(true);

      const filtered = store.getState().cards.getFilteredAndSortedCards();
      const names = filtered.map((c) => c.name);
      expect(names).toContain("Enabled Card");
      expect(names).toContain("Disabled Card");
    });

    it("hides out-of-pool cards by default", () => {
      // Replace allCards with a mix of inPool and not-inPool
      store.setState((s) => {
        s.cards.allCards = [
          makeCard({ id: "1", name: "In Pool", inPool: true }),
          makeCard({ id: "2", name: "Out of Pool", inPool: false }),
        ];
      });
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered.map((c) => c.name)).toEqual(["In Pool"]);
    });

    it("shows out-of-pool cards when showAllCards is true", () => {
      store.setState((s) => {
        s.cards.allCards = [
          makeCard({ id: "1", name: "In Pool", inPool: true }),
          makeCard({ id: "2", name: "Out of Pool", inPool: false }),
        ];
      });
      store.getState().cards.setShowAllCards(true);
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      const names = filtered.map((c) => c.name);
      expect(names).toContain("In Pool");
      expect(names).toContain("Out of Pool");
    });

    it("includes boss cards when includeBossCards is true", () => {
      store.getState().cards.setIncludeBossCards(true);
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      const names = filtered.map((c) => c.name);
      expect(names).toContain("The Demon");
      expect(filtered).toHaveLength(5);
    });

    it("filters by search query (case-insensitive)", () => {
      store.getState().cards.setSearchQuery("doctor");
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("The Doctor");
    });

    it("filters by partial name match", () => {
      store.getState().cards.setSearchQuery("the");
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      // "The Doctor" and "The Nurse" (boss card "The Demon" hidden)
      expect(filtered).toHaveLength(2);
    });

    it("filters by uppercase query", () => {
      store.getState().cards.setSearchQuery("DOCTOR");
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("The Doctor");
    });

    it("filters by rarity", () => {
      store.getState().cards.setRarityFilter(2);
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered).toHaveLength(2); // Nurse + Abandoned Wealth
      expect(filtered.every((c) => c.rarity === 2)).toBe(true);
    });

    it("applies search and rarity filter together", () => {
      store.getState().cards.setSearchQuery("nurse");
      store.getState().cards.setRarityFilter(2);
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("The Nurse");
    });

    it("returns empty array when search matches nothing", () => {
      store.getState().cards.setSearchQuery("zzz_nonexistent");
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered).toHaveLength(0);
    });

    it("returns all non-boss cards when filters are at defaults", () => {
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered).toHaveLength(4);
    });

    it("applies boss filter + search together", () => {
      store.getState().cards.setIncludeBossCards(true);
      store.getState().cards.setSearchQuery("demon");
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("The Demon");
    });

    it("hides boss card even if it matches search query", () => {
      store.getState().cards.setSearchQuery("demon");
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered).toHaveLength(0);
    });

    it("uses filterRarity when raritySource is filter", () => {
      const cards = [
        makeCard({ id: "1", name: "Card A", rarity: 1, filterRarity: 3 }),
        makeCard({ id: "2", name: "Card B", rarity: 2, filterRarity: null }),
      ];
      store.setState((s) => {
        s.cards.allCards = cards as any;
        s.settings.raritySource = "filter";
      });

      store.getState().cards.setRarityFilter(3);
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("Card A");
    });

    it("falls back to rarity when filterRarity is null (filter source)", () => {
      const cards = [
        makeCard({ id: "1", name: "Card A", rarity: 2, filterRarity: null }),
      ];
      store.setState((s) => {
        s.cards.allCards = cards as any;
        s.settings.raritySource = "filter";
      });

      store.getState().cards.setRarityFilter(2);
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered).toHaveLength(1);
    });

    it("uses prohibitedLibraryRarity when raritySource is prohibited-library", () => {
      const cards = [
        makeCard({
          id: "1",
          name: "Card A",
          rarity: 1,
          prohibitedLibraryRarity: 4,
        }),
      ];
      store.setState((s) => {
        s.cards.allCards = cards as any;
        s.settings.raritySource = "prohibited-library";
      });

      store.getState().cards.setRarityFilter(4);
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered).toHaveLength(1);
    });

    it("falls back to rarity when prohibitedLibraryRarity is null", () => {
      const cards = [
        makeCard({
          id: "1",
          name: "Card A",
          rarity: 3,
          prohibitedLibraryRarity: null,
        }),
      ];
      store.setState((s) => {
        s.cards.allCards = cards as any;
        s.settings.raritySource = "prohibited-library";
      });

      store.getState().cards.setRarityFilter(3);
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered).toHaveLength(1);
    });

    it("uses poe.ninja rarity (card.rarity) by default", () => {
      // Default raritySource is "poe.ninja"
      store.getState().cards.setRarityFilter(1);
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe("The Doctor");
    });
  });

  // ─── Sorting ────────────────────────────────────────────────────────

  describe("sorting", () => {
    beforeEach(async () => {
      electron.divinationCards.getAll.mockResolvedValue(makeSampleCards());
      await store.getState().cards.loadCards();
    });

    it("sorts by name ascending by default", () => {
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      const names = filtered.map((c) => c.name);
      expect(names).toEqual([
        "Abandoned Wealth",
        "Rain of Chaos",
        "The Doctor",
        "The Nurse",
      ]);
    });

    it("sorts by name descending", () => {
      store.getState().cards.setSortDirection("desc");
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      const names = filtered.map((c) => c.name);
      expect(names).toEqual([
        "The Nurse",
        "The Doctor",
        "Rain of Chaos",
        "Abandoned Wealth",
      ]);
    });

    it("sorts by rarity ascending", () => {
      store.getState().cards.setSortField("rarity");
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      const rarities = filtered.map((c) => c.rarity);
      expect(rarities).toEqual([1, 2, 2, 4]);
    });

    it("sorts by rarity descending", () => {
      store.getState().cards.setSortField("rarity");
      store.getState().cards.setSortField("rarity"); // toggle to desc
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      const rarities = filtered.map((c) => c.rarity);
      expect(rarities).toEqual([4, 2, 2, 1]);
    });

    it("sorts by stackSize ascending", () => {
      store.getState().cards.setSortField("stackSize");
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      const stacks = filtered.map((c) => c.stackSize);
      expect(stacks).toEqual([4, 5, 8, 8]);
    });

    it("sorts by stackSize descending", () => {
      store.getState().cards.setSortField("stackSize");
      store.getState().cards.setSortField("stackSize"); // toggle to desc
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      const stacks = filtered.map((c) => c.stackSize);
      expect(stacks).toEqual([8, 8, 5, 4]);
    });

    it("sorts by effective rarity (filter source) ascending", () => {
      const cards = [
        makeCard({ id: "1", name: "A", rarity: 4, filterRarity: 1 }),
        makeCard({ id: "2", name: "B", rarity: 1, filterRarity: 3 }),
        makeCard({ id: "3", name: "C", rarity: 2, filterRarity: 2 }),
      ];
      store.setState((s) => {
        s.cards.allCards = cards as any;
        s.settings.raritySource = "filter";
        s.cards.sortField = "rarity";
        s.cards.sortDirection = "asc";
      });

      const filtered = store.getState().cards.getFilteredAndSortedCards();
      const names = filtered.map((c) => c.name);
      // filterRarity: A=1, C=2, B=3
      expect(names).toEqual(["A", "C", "B"]);
    });

    it("includes boss cards in sort when includeBossCards is true", () => {
      store.getState().cards.setIncludeBossCards(true);
      store.getState().cards.setSortField("stackSize");
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered).toHaveLength(5);
      const stacks = filtered.map((c) => c.stackSize);
      expect(stacks).toEqual([4, 5, 6, 8, 8]);
    });

    it("preserves original order when sortField is unrecognized", () => {
      store.setState((s) => {
        s.cards.sortField = "unknown" as any;
      });
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      const names = filtered.map((c) => c.name);
      expect(names).toEqual([
        "The Doctor",
        "The Nurse",
        "Rain of Chaos",
        "Abandoned Wealth",
      ]);
    });
  });

  // ─── Pagination ─────────────────────────────────────────────────────

  describe("pagination", () => {
    beforeEach(async () => {
      // Create 25 cards for pagination tests
      const cards = Array.from({ length: 25 }, (_, i) =>
        makeCard({
          id: String(i + 1),
          name: `Card ${String(i).padStart(2, "0")}`,
        }),
      );
      electron.divinationCards.getAll.mockResolvedValue(cards);
      await store.getState().cards.loadCards();
    });

    it("returns first page of results (default pageSize 20)", () => {
      const paginated = store.getState().cards.getPaginatedCards();
      expect(paginated).toHaveLength(20);
    });

    it("returns remaining cards on page 2", () => {
      store.getState().cards.setCurrentPage(2);
      const paginated = store.getState().cards.getPaginatedCards();
      expect(paginated).toHaveLength(5);
    });

    it("returns empty array for page beyond total", () => {
      store.getState().cards.setCurrentPage(10);
      const paginated = store.getState().cards.getPaginatedCards();
      expect(paginated).toHaveLength(0);
    });

    it("computes total pages correctly", () => {
      expect(store.getState().cards.getTotalPages()).toBe(2);
    });

    it("computes total pages with custom page size", () => {
      store.getState().cards.setPageSize(10);
      expect(store.getState().cards.getTotalPages()).toBe(3); // ceil(25/10)
    });

    it("returns 0 total pages when no cards", () => {
      store.setState((s) => {
        s.cards.allCards = [];
      });
      expect(store.getState().cards.getTotalPages()).toBe(0);
    });

    it("respects custom page size", () => {
      store.getState().cards.setPageSize(5);
      const paginated = store.getState().cards.getPaginatedCards();
      expect(paginated).toHaveLength(5);
    });

    it("page 1 with pageSize 5 returns first 5 cards", () => {
      store.getState().cards.setPageSize(5);
      const paginated = store.getState().cards.getPaginatedCards();
      expect(paginated[0].name).toBe("Card 00");
      expect(paginated[4].name).toBe("Card 04");
    });

    it("page 2 with pageSize 5 returns cards 5-9", () => {
      store.getState().cards.setPageSize(5);
      store.getState().cards.setCurrentPage(2);
      const paginated = store.getState().cards.getPaginatedCards();
      expect(paginated[0].name).toBe("Card 05");
      expect(paginated[4].name).toBe("Card 09");
    });

    it("last page returns only remaining cards", () => {
      store.getState().cards.setPageSize(10);
      store.getState().cards.setCurrentPage(3);
      const paginated = store.getState().cards.getPaginatedCards();
      expect(paginated).toHaveLength(5);
    });

    it("total pages rounds up for partial pages", () => {
      store.getState().cards.setPageSize(7);
      // ceil(25/7) = 4
      expect(store.getState().cards.getTotalPages()).toBe(4);
    });
  });

  // ─── Getters ────────────────────────────────────────────────────────

  describe("getters", () => {
    it("getAllCards returns allCards", async () => {
      const cards = makeSampleCards();
      electron.divinationCards.getAll.mockResolvedValue(cards);
      await store.getState().cards.loadCards();

      expect(store.getState().cards.getAllCards()).toHaveLength(5);
    });

    it("getAllCards returns empty array initially", () => {
      expect(store.getState().cards.getAllCards()).toEqual([]);
    });

    it("getIsLoading returns isLoading", () => {
      expect(store.getState().cards.getIsLoading()).toBe(false);
    });

    it("getError returns error", () => {
      expect(store.getState().cards.getError()).toBeNull();
    });

    it("getError returns error message after failure", async () => {
      electron.divinationCards.getAll.mockRejectedValue(new Error("fail"));
      await store.getState().cards.loadCards();
      expect(store.getState().cards.getError()).toBe("fail");
    });

    it("getFilteredAndSortedCards returns empty for empty allCards", () => {
      const filtered = store.getState().cards.getFilteredAndSortedCards();
      expect(filtered).toEqual([]);
    });

    it("getPaginatedCards returns empty for empty allCards", () => {
      const paginated = store.getState().cards.getPaginatedCards();
      expect(paginated).toEqual([]);
    });

    it("getTotalPages returns 0 for empty allCards", () => {
      expect(store.getState().cards.getTotalPages()).toBe(0);
    });
  });

  // ─── Integration / Edge Cases ───────────────────────────────────────

  describe("integration / edge cases", () => {
    it("loading new cards resets page even if page was previously advanced", async () => {
      const cards1 = Array.from({ length: 30 }, (_, i) =>
        makeCard({ id: String(i + 1), name: `Card ${i}` }),
      );
      electron.divinationCards.getAll.mockResolvedValue(cards1);
      await store.getState().cards.loadCards();

      store.getState().cards.setCurrentPage(2);
      expect(store.getState().cards.currentPage).toBe(2);

      // Reset dedup key so the second load proceeds
      store.setState((s) => {
        s.cards._lastCardsKey = null;
      });
      const cards2 = [makeCard({ id: "99", name: "Only Card" })];
      electron.divinationCards.getAll.mockResolvedValue(cards2);
      await store.getState().cards.loadCards();

      expect(store.getState().cards.currentPage).toBe(1);
      expect(store.getState().cards.allCards).toHaveLength(1);
    });

    it("filtering reduces paginated results", async () => {
      const cards = Array.from({ length: 25 }, (_, i) =>
        makeCard({
          id: String(i + 1),
          name: `Card ${i}`,
          rarity: i < 5 ? 1 : 4,
        }),
      );
      electron.divinationCards.getAll.mockResolvedValue(cards);
      await store.getState().cards.loadCards();

      store.getState().cards.setRarityFilter(1);
      const paginated = store.getState().cards.getPaginatedCards();
      expect(paginated).toHaveLength(5);
      expect(store.getState().cards.getTotalPages()).toBe(1);
    });

    it("search + sort + pagination work together", async () => {
      const cards = [
        makeCard({ id: "1", name: "Alpha Card", stackSize: 3 }),
        makeCard({ id: "2", name: "Alpha Beta", stackSize: 7 }),
        makeCard({ id: "3", name: "Gamma Card", stackSize: 1 }),
        makeCard({ id: "4", name: "Alpha Gamma", stackSize: 5 }),
      ];
      electron.divinationCards.getAll.mockResolvedValue(cards);
      await store.getState().cards.loadCards();

      store.getState().cards.setSearchQuery("alpha");
      store.getState().cards.setSortField("stackSize"); // asc
      store.getState().cards.setPageSize(2);

      const page1 = store.getState().cards.getPaginatedCards();
      expect(page1).toHaveLength(2);
      expect(page1[0].name).toBe("Alpha Card"); // stackSize 3
      expect(page1[1].name).toBe("Alpha Gamma"); // stackSize 5

      store.getState().cards.setCurrentPage(2);
      const page2 = store.getState().cards.getPaginatedCards();
      expect(page2).toHaveLength(1);
      expect(page2[0].name).toBe("Alpha Beta"); // stackSize 7
    });

    it("multiple sequential loads with different games", async () => {
      const poe1Cards = [
        makeCard({ id: "1", name: "POE1 Card", game: "poe1" }),
      ];
      const poe2Cards = [
        makeCard({ id: "2", name: "POE2 Card", game: "poe2" }),
      ];

      electron.divinationCards.getAll.mockResolvedValueOnce(poe1Cards);
      await store.getState().cards.loadCards();
      expect(store.getState().cards.allCards[0].name).toBe("POE1 Card");

      // Switch game
      store.setState((s) => {
        s.settings.selectedGame = "poe2";
      });

      electron.divinationCards.getAll.mockResolvedValueOnce(poe2Cards);
      await store.getState().cards.loadCards();
      expect(electron.divinationCards.getAll).toHaveBeenLastCalledWith(
        "poe2",
        false,
      );
      expect(store.getState().cards.allCards[0].name).toBe("POE2 Card");
    });
  });
});
