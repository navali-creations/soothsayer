import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";
import { getRarityStyles } from "~/renderer/utils";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/utils", () => ({
  getRarityStyles: vi.fn(() => ({
    bgGradient: "",
    border: "",
    text: "",
    beam: "#gold",
    showBeam: true,
    badgeBg: "",
    badgeText: "",
    badgeBorder: "",
  })),
}));

vi.mock("motion/react", async () => {
  const { createMotionMock } = await import(
    "~/renderer/__test-setup__/motion-mock"
  );
  return createMotionMock({ animatePresenceTestId: "animate-presence" });
});

vi.mock("../DropBeamColumn", () => ({
  DropBeamColumn: (props: any) => (
    <div
      data-testid="beam-column"
      data-showbeam={String(props.showBeam)}
      data-beamcolor={props.beamColor || ""}
      data-isunknownrarity={String(props.isUnknownRarity)}
    />
  ),
}));

vi.mock("../DropContentColumn", () => ({
  DropContentColumn: (props: any) => (
    <div
      data-testid="content-column"
      data-cardname={props.cardName}
      data-chaosvalue={String(props.chaosValue)}
    />
  ),
}));

// ─── Component import (must come after vi.mock calls) ──────────────────────

import { OverlayDropsList } from "./OverlayDropsList";

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUseBoundStore = vi.mocked(useBoundStore);

function makeDrop(overrides: any = {}) {
  return {
    cardName: overrides.cardName ?? "The Doctor",
    rarity: overrides.rarity ?? 1,
    price: overrides.price ?? {
      chaosValue: 1000,
      divineValue: 5,
    },
  };
}

function createMockStore(overrides: any = {}) {
  const drops = overrides.filteredDrops ?? [];
  return {
    rarityInsights: {
      activeFilterTheme: overrides.activeFilterTheme ?? null,
    },
    overlay: {
      sessionData: {
        isActive: true,
        totalCount: 10,
        totalProfit: 500,
        chaosToDivineRatio: 200,
        cards: [{ cardName: "The Doctor", count: 1 }],
        recentDrops: overrides.recentDrops ?? [
          makeDrop({ cardName: "The Doctor", rarity: 1 }),
        ],
        ...overrides.sessionData,
      },
      isLeftHalf: overrides.isLeftHalf ?? false,
      activeTab: overrides.activeTab ?? ("all" as const),
      getFilteredDrops: vi.fn(() => drops),
      setActiveTab: vi.fn(),
      isLocked: true,
      setLocked: vi.fn(),
      hide: vi.fn(),
      detectZone: vi.fn(),
      ...overrides.overlayOverrides,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockImplementation((selector?: any) =>
    selector ? selector(store) : store,
  );
  return store;
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// OverlayDropsList
// ═══════════════════════════════════════════════════════════════════════════

describe("OverlayDropsList", () => {
  // ── Empty states ─────────────────────────────────────────────────────────

  describe("empty states", () => {
    it('shows "No cards yet" when no drops and all tab', () => {
      setupStore({
        filteredDrops: [],
        activeTab: "all" as const,
        recentDrops: [],
      });
      renderWithProviders(<OverlayDropsList />);

      expect(screen.getByText("No cards yet")).toBeInTheDocument();
    });

    it('shows "No valuable cards in recent drops" when valuable tab and has recent drops but none valuable', () => {
      setupStore({
        filteredDrops: [],
        activeTab: "valuable" as const,
        recentDrops: [makeDrop({ cardName: "Rain of Chaos", rarity: 4 })],
      });
      renderWithProviders(<OverlayDropsList />);

      expect(
        screen.getByText("No valuable cards in recent drops"),
      ).toBeInTheDocument();
      expect(screen.getByText("(Showing last 10 drops)")).toBeInTheDocument();
    });

    it('shows "No cards yet" when valuable tab but no recent drops at all', () => {
      setupStore({
        filteredDrops: [],
        activeTab: "valuable" as const,
        recentDrops: [],
      });
      renderWithProviders(<OverlayDropsList />);

      expect(screen.getByText("No cards yet")).toBeInTheDocument();
    });

    it("handles empty recentDrops array", () => {
      setupStore({
        filteredDrops: [],
        activeTab: "all" as const,
        recentDrops: [],
      });
      renderWithProviders(<OverlayDropsList />);

      expect(screen.getByText("No cards yet")).toBeInTheDocument();
    });
  });

  // ── Rendering drops ──────────────────────────────────────────────────────

  describe("rendering drops", () => {
    it("renders DropContentColumn for each drop", () => {
      const drops = [
        makeDrop({ cardName: "The Doctor", rarity: 1 }),
        makeDrop({ cardName: "House of Mirrors", rarity: 1 }),
        makeDrop({ cardName: "Rain of Chaos", rarity: 4 }),
      ];
      setupStore({ filteredDrops: drops });
      renderWithProviders(<OverlayDropsList />);

      const contentColumns = screen.getAllByTestId("content-column");
      expect(contentColumns).toHaveLength(3);
    });

    it("renders DropBeamColumn for each drop", () => {
      const drops = [
        makeDrop({ cardName: "The Doctor", rarity: 1 }),
        makeDrop({ cardName: "House of Mirrors", rarity: 1 }),
      ];
      setupStore({ filteredDrops: drops });
      renderWithProviders(<OverlayDropsList />);

      const beamColumns = screen.getAllByTestId("beam-column");
      expect(beamColumns).toHaveLength(2);
    });

    it("renders up to 10 drops", () => {
      const drops = Array.from({ length: 15 }, (_, i) =>
        makeDrop({ cardName: `Card ${i}`, rarity: 1 }),
      );
      setupStore({ filteredDrops: drops });
      renderWithProviders(<OverlayDropsList />);

      const contentColumns = screen.getAllByTestId("content-column");
      expect(contentColumns).toHaveLength(10);
    });

    it("limits to 10 drops even if more exist", () => {
      const drops = Array.from({ length: 12 }, (_, i) =>
        makeDrop({ cardName: `Card ${i}`, rarity: 2 }),
      );
      setupStore({ filteredDrops: drops });
      renderWithProviders(<OverlayDropsList />);

      const beamColumns = screen.getAllByTestId("beam-column");
      expect(beamColumns).toHaveLength(10);
    });

    it("uses the single drop price", () => {
      const drops = [
        makeDrop({
          cardName: "The Doctor",
          rarity: 1,
          price: { chaosValue: 1000, divineValue: 5 },
        }),
      ];
      setupStore({ filteredDrops: drops });
      renderWithProviders(<OverlayDropsList />);

      const contentColumn = screen.getByTestId("content-column");
      expect(contentColumn).toHaveAttribute("data-chaosvalue", "1000");
    });
  });

  // ── Rarity styles and beam ───────────────────────────────────────────────

  describe("rarity and beam", () => {
    it("calls getRarityStyles with drop rarity and direction", () => {
      const drops = [makeDrop({ cardName: "The Doctor", rarity: 2 })];
      setupStore({ filteredDrops: drops, isLeftHalf: false });
      renderWithProviders(<OverlayDropsList />);

      expect(vi.mocked(getRarityStyles)).toHaveBeenCalledWith(2, "right", null);
    });

    it('passes "left" direction to getRarityStyles when isLeftHalf', () => {
      const drops = [makeDrop({ cardName: "The Doctor", rarity: 1 })];
      setupStore({ filteredDrops: drops, isLeftHalf: true });
      renderWithProviders(<OverlayDropsList />);

      expect(vi.mocked(getRarityStyles)).toHaveBeenCalledWith(1, "left", null);
    });

    it("passes active filter theme to getRarityStyles", () => {
      const activeFilterTheme = {
        1: {
          bgColor: { r: 10, g: 20, b: 30, a: 255 },
          textColor: { r: 240, g: 240, b: 240, a: 255 },
          borderColor: null,
        },
      };
      const drops = [makeDrop({ cardName: "The Doctor", rarity: 1 })];
      setupStore({ filteredDrops: drops, activeFilterTheme });
      renderWithProviders(<OverlayDropsList />);

      expect(vi.mocked(getRarityStyles)).toHaveBeenCalledWith(
        1,
        "right",
        activeFilterTheme,
      );
    });

    it("passes showBeam from rarityStyles to DropBeamColumn", () => {
      vi.mocked(getRarityStyles).mockReturnValue({
        bgGradient: "",
        border: "",
        text: "",
        beam: "#ff0000",
        showBeam: true,
        badgeBg: "",
        badgeText: "",
        badgeBorder: "",
      });

      const drops = [makeDrop({ cardName: "The Doctor", rarity: 1 })];
      setupStore({ filteredDrops: drops });
      renderWithProviders(<OverlayDropsList />);

      const beamColumn = screen.getByTestId("beam-column");
      expect(beamColumn).toHaveAttribute("data-showbeam", "true");
    });

    it("marks rarity 0 drops as unknown rarity", () => {
      const drops = [makeDrop({ cardName: "Unknown Card", rarity: 0 })];
      setupStore({ filteredDrops: drops });
      renderWithProviders(<OverlayDropsList />);

      const beamColumn = screen.getByTestId("beam-column");
      expect(beamColumn).toHaveAttribute("data-isunknownrarity", "true");
    });

    it("marks rarity > 0 drops as known rarity", () => {
      const drops = [makeDrop({ cardName: "The Doctor", rarity: 1 })];
      setupStore({ filteredDrops: drops });
      renderWithProviders(<OverlayDropsList />);

      const beamColumn = screen.getByTestId("beam-column");
      expect(beamColumn).toHaveAttribute("data-isunknownrarity", "false");
    });
  });

  // ── AnimatePresence ──────────────────────────────────────────────────────

  describe("animation", () => {
    it("wraps drops in AnimatePresence", () => {
      const drops = [makeDrop({ cardName: "The Doctor", rarity: 1 })];
      setupStore({ filteredDrops: drops });
      renderWithProviders(<OverlayDropsList />);

      expect(screen.getByTestId("animate-presence")).toBeInTheDocument();
    });

    it("does not render AnimatePresence when no drops", () => {
      setupStore({ filteredDrops: [], recentDrops: [] });
      renderWithProviders(<OverlayDropsList />);

      expect(screen.queryByTestId("animate-presence")).not.toBeInTheDocument();
    });
  });

  // ── Fallback for missing price ───────────────────────────────────────────

  describe("price fallbacks", () => {
    it("defaults chaosValue to 0 when price is undefined", () => {
      const drops = [
        {
          cardName: "Missing Price Card",
          rarity: 1,
          price: undefined,
        },
      ];
      setupStore({ filteredDrops: drops });
      renderWithProviders(<OverlayDropsList />);

      const contentColumn = screen.getByTestId("content-column");
      expect(contentColumn).toHaveAttribute("data-chaosvalue", "0");
    });
  });

  // ── getFilteredDrops() returning null (L13 fallback) ─────────────────

  describe("getFilteredDrops null fallback", () => {
    it("treats null from getFilteredDrops as empty array", () => {
      const store = createMockStore({
        recentDrops: [],
      });
      // Override getFilteredDrops to return null
      store.overlay.getFilteredDrops = vi.fn(() => null);
      mockUseBoundStore.mockImplementation((selector?: any) =>
        selector ? selector(store) : store,
      );

      renderWithProviders(<OverlayDropsList />);

      // Should render the empty state, not crash
      expect(screen.getByText("No cards yet")).toBeInTheDocument();
    });
  });

  // ── isLeftHalf direction for getRarityStyles (L47) ───────────────────

  describe("isLeftHalf direction mapping", () => {
    it('passes "left" to getRarityStyles when isLeftHalf is true', () => {
      const drops = [makeDrop({ cardName: "Test Card", rarity: 3 })];
      setupStore({ filteredDrops: drops, isLeftHalf: true });
      renderWithProviders(<OverlayDropsList />);

      expect(vi.mocked(getRarityStyles)).toHaveBeenCalledWith(3, "left", null);
    });

    it('passes "right" to getRarityStyles when isLeftHalf is false', () => {
      const drops = [makeDrop({ cardName: "Test Card", rarity: 3 })];
      setupStore({ filteredDrops: drops, isLeftHalf: false });
      renderWithProviders(<OverlayDropsList />);

      expect(vi.mocked(getRarityStyles)).toHaveBeenCalledWith(3, "right", null);
    });
  });
});
