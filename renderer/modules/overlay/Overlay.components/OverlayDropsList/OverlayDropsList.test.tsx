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
    exchangePrice: overrides.exchangePrice ?? {
      chaosValue: 1000,
      divineValue: 5,
    },
    stashPrice: overrides.stashPrice ?? {
      chaosValue: 950,
      divineValue: 4.75,
    },
  };
}

function createMockStore(overrides: any = {}) {
  const drops = overrides.filteredDrops ?? [];
  return {
    overlay: {
      sessionData: {
        isActive: true,
        totalCount: 10,
        totalProfit: 500,
        chaosToDivineRatio: 200,
        priceSource: "exchange" as const,
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
  mockUseBoundStore.mockReturnValue(store);
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

    it("uses exchange price source from sessionData", () => {
      const drops = [
        makeDrop({
          cardName: "The Doctor",
          rarity: 1,
          exchangePrice: { chaosValue: 1000, divineValue: 5 },
          stashPrice: { chaosValue: 800, divineValue: 4 },
        }),
      ];
      setupStore({
        filteredDrops: drops,
        sessionData: { priceSource: "exchange" as const },
      });
      renderWithProviders(<OverlayDropsList />);

      const contentColumn = screen.getByTestId("content-column");
      expect(contentColumn).toHaveAttribute("data-chaosvalue", "1000");
    });

    it("uses stash price source when sessionData says stash", () => {
      const drops = [
        makeDrop({
          cardName: "The Doctor",
          rarity: 1,
          exchangePrice: { chaosValue: 1000, divineValue: 5 },
          stashPrice: { chaosValue: 800, divineValue: 4 },
        }),
      ];
      setupStore({
        filteredDrops: drops,
        sessionData: { priceSource: "stash" as const },
      });
      renderWithProviders(<OverlayDropsList />);

      const contentColumn = screen.getByTestId("content-column");
      expect(contentColumn).toHaveAttribute("data-chaosvalue", "800");
    });
  });

  // ── Rarity styles and beam ───────────────────────────────────────────────

  describe("rarity and beam", () => {
    it("calls getRarityStyles with drop rarity and direction", () => {
      const drops = [makeDrop({ cardName: "The Doctor", rarity: 2 })];
      setupStore({ filteredDrops: drops, isLeftHalf: false });
      renderWithProviders(<OverlayDropsList />);

      expect(vi.mocked(getRarityStyles)).toHaveBeenCalledWith(2, "right");
    });

    it('passes "left" direction to getRarityStyles when isLeftHalf', () => {
      const drops = [makeDrop({ cardName: "The Doctor", rarity: 1 })];
      setupStore({ filteredDrops: drops, isLeftHalf: true });
      renderWithProviders(<OverlayDropsList />);

      expect(vi.mocked(getRarityStyles)).toHaveBeenCalledWith(1, "left");
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
          exchangePrice: undefined,
          stashPrice: undefined,
        },
      ];
      setupStore({ filteredDrops: drops });
      renderWithProviders(<OverlayDropsList />);

      const contentColumn = screen.getByTestId("content-column");
      expect(contentColumn).toHaveAttribute("data-chaosvalue", "0");
    });
  });
});
