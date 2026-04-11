import { act, cleanup, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { useBoundStore } from "~/renderer/store";

// ── Mocks (must be declared before component import) ────────────────────────
// vi.mock factories are hoisted above imports, so we cannot reference
// top-level `const` variables inside them. Instead we define plain
// vi.fn() stubs inline and obtain references via the imported mock module.

vi.mock("../timeline-buffer/timeline-buffer", () => ({
  timelineBuffer: {
    linePoints: [] as { x: number; profit: number }[],
    chartData: [] as any[],
    totalDrops: 0,
    totalChaosValue: 0,
    totalDivineValue: 0,
    deckCost: 0,
    hasBars: false,
    version: 0,
    subscribe: vi.fn(() => vi.fn()),
    seedFromTimeline: vi.fn(),
    setDeckCost: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    reset: vi.fn(),
  },
}));

vi.mock("~/renderer/lib/canvas-core", () => ({
  createLinearMapper: vi.fn(
    (
      domainMin: number,
      domainMax: number,
      rangeMin: number,
      rangeMax: number,
    ) => {
      const span = domainMax - domainMin || 1;
      const mapper = (value: number) => {
        const frac = (value - domainMin) / span;
        return rangeMin + frac * (rangeMax - rangeMin);
      };
      mapper.inverse = (pixel: number) => {
        const frac = (pixel - rangeMin) / (rangeMax - rangeMin || 1);
        return domainMin + frac * span;
      };
      return mapper;
    },
  ),
  setupCanvas: vi.fn(() => ({
    ctx: {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      setLineDash: vi.fn(),
      arc: vi.fn(),
    } as unknown as CanvasRenderingContext2D,
    width: 800,
    height: 240,
  })),
  useCanvasResize: vi.fn(() => ({
    containerRef: vi.fn(),
    containerElRef: { current: null },
    canvasRef: { current: null },
    canvasSize: { width: 800, height: 240 },
  })),
}));

vi.mock("../canvas-utils/canvas-utils", () => ({
  BAR_COLOR: "rgba(255, 255, 255, 0.85)",
  computeTimelineLayout: vi.fn(() => ({
    chartLeft: 50,
    chartRight: 750,
    chartTop: 10,
    chartBottom: 230,
    chartWidth: 700,
    chartHeight: 220,
  })),
  computeTimelineDomains: vi.fn(() => ({
    x: { min: 0, max: 10 },
    y: { min: -100, max: 100 },
  })),
  drawTimelineGrid: vi.fn(),
  drawBars: vi.fn(),
  drawProfitLine: vi.fn(),
  drawHoverHighlight: vi.fn(),
  buildPixelSpline: vi.fn(() => ({ points: [], tangents: [] })),
}));

vi.mock("../useTimelineInteractions/useTimelineInteractions", () => ({
  useTimelineInteractions: vi.fn(),
}));

vi.mock("~/renderer/hooks", () => ({
  useChartColors: vi.fn(() => ({
    primary: "cyan",
    primary30: "rgba(0,255,255,0.3)",
    primary02: "rgba(0,255,255,0.02)",
  })),
}));

vi.mock("~/renderer/utils", () => ({
  formatCurrency: vi.fn((v: number, _ratio: number) => `${v.toFixed(2)}c`),
}));

const mockGetSession = vi.fn(() => ({
  totals: { stackedDeckChaosCost: 5 },
}));
const mockGetChaosToDivineRatio = vi.fn(() => 200);

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/components/DivinationCard", () => ({
  default: ({ card }: { card: { name: string } }) => (
    <div data-testid="divination-card-mock">{card.name}</div>
  ),
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { formatCurrency } from "~/renderer/utils";

vi.mocked(useBoundStore).mockReturnValue({
  currentSession: {
    getSession: mockGetSession,
    getChaosToDivineRatio: mockGetChaosToDivineRatio,
  },
  sessionDetails: {
    getSession: vi.fn(() => null),
  },
} as any);

import type { AggregatedTimeline } from "~/types/data-stores";

import { timelineBuffer } from "../timeline-buffer/timeline-buffer";
import SessionProfitTimeline from "./SessionProfitTimeline";

// Grab typed references to the mock functions via the mocked module
const mockBuffer = timelineBuffer as any;
const mockSubscribe = vi.mocked(timelineBuffer.subscribe);
const mockSeedFromTimeline = vi.mocked(timelineBuffer.seedFromTimeline);
const mockSetDeckCost = vi.mocked(timelineBuffer.setDeckCost);
const mockSave = vi.mocked(timelineBuffer.save);
const mockRestore = vi.mocked(timelineBuffer.restore);

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Set the buffer to look like it has data so the component does not
 * early-return with `null`.
 *
 * `useSyncExternalStore` calls the snapshot function which returns
 * `timelineBuffer.totalDrops + timelineBuffer.chartData.length`.
 * The component returns `null` when this is 0.
 */
function populateBuffer(
  overrides: Partial<{
    totalDrops: number;
    totalChaosValue: number;
    totalDivineValue: number;
    linePoints: { x: number; profit: number }[];
    chartData: any[];
    hasBars: boolean;
  }> = {},
) {
  const merged = {
    totalDrops: 5,
    totalChaosValue: 100,
    totalDivineValue: 0.5,
    linePoints: [
      { x: 0, profit: 0 },
      { x: 1, profit: 10 },
      { x: 2, profit: 20 },
    ],
    chartData: [
      {
        x: 1,
        profit: 10,
        barValue: 10,
        cardName: "The Doctor",
        rarity: 1,
      },
    ],
    ...overrides,
  };
  // Derive hasBars from chartData unless explicitly overridden
  const hasBars =
    overrides.hasBars ?? merged.chartData.some((d: any) => d.barValue != null);
  Object.assign(mockBuffer, merged, {
    hasBars,
    version: (mockBuffer.version ?? 0) + 1,
  });
}

/** Reset buffer back to "empty" state. */
function resetBuffer() {
  Object.assign(mockBuffer, {
    linePoints: [],
    chartData: [],
    totalDrops: 0,
    totalChaosValue: 0,
    totalDivineValue: 0,
    deckCost: 0,
    hasBars: false,
    version: 0,
  });
}

function createFakeTimeline(
  overrides: Partial<AggregatedTimeline> = {},
): AggregatedTimeline {
  return {
    buckets: [{ drops: 5, chaosValue: 100, divineValue: 0.5 }],
    notableDrops: [],
    totalDrops: 5,
    totalChaosValue: 100,
    totalDivineValue: 0.5,
    ...overrides,
  } as AggregatedTimeline;
}

// ── Tests ───────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  resetBuffer();
});

describe("SessionProfitTimeline", () => {
  // ═══════════════════════════════════════════════════════════════════════
  // 1. Shell rendering when bufferVersion is 0 (empty data)
  // ═══════════════════════════════════════════════════════════════════════

  describe("when bufferVersion is 0", () => {
    it("should render shell when both totalDrops and chartData are empty", () => {
      const { container } = render(<SessionProfitTimeline />);
      expect(screen.getByText("Profit Timeline")).toBeInTheDocument();
      expect(container.querySelector("canvas")).toBeInTheDocument();
    });

    it("should render shell when totalDrops is 0 and chartData length is 0", () => {
      mockBuffer.totalDrops = 0;
      mockBuffer.chartData = [];
      const { container } = render(<SessionProfitTimeline />);
      expect(screen.getByText("Profit Timeline")).toBeInTheDocument();
      expect(container.querySelector("canvas")).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. Basic rendering when data exists
  // ═══════════════════════════════════════════════════════════════════════

  describe("when buffer has data", () => {
    beforeEach(() => {
      populateBuffer();
    });

    it("should render the Profit Timeline heading", () => {
      render(<SessionProfitTimeline />);
      expect(screen.getByText("Profit Timeline")).toBeInTheDocument();
    });

    it("should render a canvas element", () => {
      const { container } = render(<SessionProfitTimeline />);
      const canvas = container.querySelector("canvas");
      expect(canvas).toBeInTheDocument();
    });

    it("should display the drop count in the header", () => {
      render(<SessionProfitTimeline />);
      // totalDrops is 5 — toLocaleString() produces "5"
      expect(screen.getByText(/5 drops/)).toBeInTheDocument();
    });

    it("should display the total value in the header", () => {
      render(<SessionProfitTimeline />);
      // formatCurrency mock returns "100.00c"
      expect(screen.getByText(/100\.00c/)).toBeInTheDocument();
    });

    it("should render the Notable Drops legend when chartData has bar values", () => {
      render(<SessionProfitTimeline />);
      expect(screen.getByText("Notable Drops")).toBeInTheDocument();
    });

    it("should not render the Notable Drops legend when no bars exist", () => {
      populateBuffer({
        chartData: [
          {
            x: 1,
            profit: 10,
            barValue: null,
            cardName: null,
            rarity: null,
          },
        ],
      });
      render(<SessionProfitTimeline />);
      expect(screen.queryByText("Notable Drops")).not.toBeInTheDocument();
    });

    it("should apply the default chart height of 240px", () => {
      const { container } = render(<SessionProfitTimeline />);
      // The chart container div has inline style height
      const chartContainer = container.querySelector(
        "[style*='height']",
      ) as HTMLElement | null;
      expect(chartContainer).not.toBeNull();
      // Default CHART_HEIGHT is 240
      expect(chartContainer!.style.height).toBe("240px");
    });

    it("should apply a custom height when height prop is provided", () => {
      const { container } = render(<SessionProfitTimeline height={300} />);
      const chartContainer = container.querySelector(
        "[style*='height: 300px']",
      ) as HTMLElement | null;
      expect(chartContainer).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. Buffer subscription
  // ═══════════════════════════════════════════════════════════════════════

  describe("buffer subscription", () => {
    beforeEach(() => {
      populateBuffer();
    });

    it("should subscribe to timelineBuffer on mount", () => {
      render(<SessionProfitTimeline />);
      // useSyncExternalStore subscribes, plus the draw effect subscribes
      expect(mockSubscribe).toHaveBeenCalled();
    });

    it("should unsubscribe from timelineBuffer on unmount", () => {
      const unsubscribe = vi.fn();
      mockSubscribe.mockReturnValue(unsubscribe);

      const { unmount } = render(<SessionProfitTimeline />);
      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. Deck cost synchronization
  // ═══════════════════════════════════════════════════════════════════════

  describe("deck cost synchronization", () => {
    beforeEach(() => {
      populateBuffer();
    });

    it("should call setDeckCost with the session deck cost on mount", () => {
      // mockGetSession returns { totals: { stackedDeckChaosCost: 5 } }
      render(<SessionProfitTimeline />);
      expect(mockSetDeckCost).toHaveBeenCalledWith(5);
    });

    it("should call setDeckCost with stackedDeckChaosCost prop when provided", () => {
      render(<SessionProfitTimeline stackedDeckChaosCost={42} />);
      expect(mockSetDeckCost).toHaveBeenCalledWith(42);
    });

    it("should call setDeckCost with 0 when session has no totals", () => {
      mockGetSession.mockReturnValue(null);
      render(<SessionProfitTimeline />);
      expect(mockSetDeckCost).toHaveBeenCalledWith(0);
    });

    it("should update setDeckCost when stackedDeckChaosCost prop changes", () => {
      const { rerender } = render(
        <SessionProfitTimeline stackedDeckChaosCost={10} />,
      );
      expect(mockSetDeckCost).toHaveBeenCalledWith(10);

      mockSetDeckCost.mockClear();
      rerender(<SessionProfitTimeline stackedDeckChaosCost={20} />);
      expect(mockSetDeckCost).toHaveBeenCalledWith(20);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. Historical mode lifecycle (save → seed → restore on unmount)
  // ═══════════════════════════════════════════════════════════════════════

  describe("historical mode (timeline prop)", () => {
    const fakeTimeline = createFakeTimeline();

    beforeEach(() => {
      // Populate so the component actually renders content
      populateBuffer();
    });

    it("should save the live buffer before seeding from timeline", () => {
      render(<SessionProfitTimeline timeline={fakeTimeline} />);

      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSeedFromTimeline).toHaveBeenCalledTimes(1);
      expect(mockSeedFromTimeline).toHaveBeenCalledWith(fakeTimeline);

      // save must be called before seedFromTimeline
      const saveOrder = mockSave.mock.invocationCallOrder[0];
      const seedOrder = mockSeedFromTimeline.mock.invocationCallOrder[0];
      expect(saveOrder).toBeLessThan(seedOrder);
    });

    it("should restore the live buffer on unmount", () => {
      const { unmount } = render(
        <SessionProfitTimeline timeline={fakeTimeline} />,
      );

      expect(mockRestore).not.toHaveBeenCalled();

      unmount();

      expect(mockRestore).toHaveBeenCalledTimes(1);
    });

    it("should not save/seed when timeline prop is null", () => {
      render(<SessionProfitTimeline timeline={null} />);
      expect(mockSave).not.toHaveBeenCalled();
      expect(mockSeedFromTimeline).not.toHaveBeenCalled();
    });

    it("should not save/seed when timeline prop is undefined", () => {
      render(<SessionProfitTimeline />);
      expect(mockSave).not.toHaveBeenCalled();
      expect(mockSeedFromTimeline).not.toHaveBeenCalled();
    });

    it("should not restore on unmount when no timeline was provided", () => {
      const { unmount } = render(<SessionProfitTimeline />);
      unmount();
      expect(mockRestore).not.toHaveBeenCalled();
    });

    it("should re-seed when timeline prop changes to a different object", () => {
      const timeline1 = createFakeTimeline({ totalDrops: 5 });
      const timeline2 = createFakeTimeline({ totalDrops: 10 });

      const { rerender } = render(
        <SessionProfitTimeline timeline={timeline1} />,
      );

      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSeedFromTimeline).toHaveBeenCalledTimes(1);
      expect(mockSeedFromTimeline).toHaveBeenCalledWith(timeline1);

      mockSave.mockClear();
      mockSeedFromTimeline.mockClear();

      rerender(<SessionProfitTimeline timeline={timeline2} />);

      // Should save again and seed with the new timeline
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSeedFromTimeline).toHaveBeenCalledTimes(1);
      expect(mockSeedFromTimeline).toHaveBeenCalledWith(timeline2);
    });

    it("should not re-seed when the same timeline reference is re-rendered", () => {
      const timeline = createFakeTimeline();

      const { rerender } = render(
        <SessionProfitTimeline timeline={timeline} />,
      );
      expect(mockSeedFromTimeline).toHaveBeenCalledTimes(1);

      mockSave.mockClear();
      mockSeedFromTimeline.mockClear();

      rerender(<SessionProfitTimeline timeline={timeline} />);
      expect(mockSeedFromTimeline).not.toHaveBeenCalled();
    });

    it("should use chaosToDivineRatio prop over store value for historical view", () => {
      render(
        <SessionProfitTimeline
          timeline={fakeTimeline}
          chaosToDivineRatio={150}
        />,
      );
      // The component should use the provided ratio (150) not the store value (200)
      // We can verify this indirectly: formatCurrency is called with the ratio
      const calls = vi.mocked(formatCurrency).mock.calls;
      // At least one call should use ratio=150
      const usesProvidedRatio = calls.some((call: any[]) => call[1] === 150);
      expect(usesProvidedRatio).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 6. Unmount cleanup
  // ═══════════════════════════════════════════════════════════════════════

  describe("unmount cleanup", () => {
    it("should unsubscribe all buffer subscriptions on unmount", () => {
      populateBuffer();

      const unsubFns: ReturnType<typeof vi.fn>[] = [];
      mockSubscribe.mockImplementation((_cb: any) => {
        const unsub = vi.fn();
        unsubFns.push(unsub);
        return unsub;
      });

      const { unmount } = render(<SessionProfitTimeline />);
      // There should be subscriptions (useSyncExternalStore + draw effect)
      expect(unsubFns.length).toBeGreaterThan(0);

      unmount();

      // All unsubscribe functions should have been called
      for (const unsub of unsubFns) {
        expect(unsub).toHaveBeenCalled();
      }
    });

    it("should restore buffer and unsubscribe when historical view unmounts", () => {
      populateBuffer();
      const fakeTimeline = createFakeTimeline();

      const unsubFns: ReturnType<typeof vi.fn>[] = [];
      mockSubscribe.mockImplementation((_cb: any) => {
        const unsub = vi.fn();
        unsubFns.push(unsub);
        return unsub;
      });

      const { unmount } = render(
        <SessionProfitTimeline timeline={fakeTimeline} />,
      );
      unmount();

      expect(mockRestore).toHaveBeenCalledTimes(1);
      for (const unsub of unsubFns) {
        expect(unsub).toHaveBeenCalled();
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 7. Edge cases
  // ═══════════════════════════════════════════════════════════════════════

  describe("edge cases", () => {
    it("should render shell immediately and update when buffer gains data", () => {
      // Capture the subscriber callback that useSyncExternalStore passes
      const subscriberCbs: Array<() => void> = [];
      mockSubscribe.mockImplementation((cb: () => void) => {
        subscriberCbs.push(cb);
        return vi.fn();
      });

      // Start with empty buffer → shell still renders
      const { container } = render(<SessionProfitTimeline />);
      expect(screen.getByText("Profit Timeline")).toBeInTheDocument();
      expect(container.querySelector("canvas")).toBeInTheDocument();

      // Populate buffer, then notify React via the subscriber callbacks
      // wrapped in act() so React flushes the re-render synchronously
      populateBuffer();
      expect(subscriberCbs.length).toBeGreaterThan(0);
      act(() => {
        for (const cb of subscriberCbs) cb();
      });

      // After data arrives, heading and drop count should reflect new data
      expect(screen.getByText("Profit Timeline")).toBeInTheDocument();
      expect(screen.getByText(/5 drops/)).toBeInTheDocument();
    });

    it("should render with chartData that has only null bar values", () => {
      populateBuffer({
        chartData: [
          {
            x: 1,
            profit: 10,
            barValue: null,
            cardName: null,
            rarity: null,
          },
          {
            x: 2,
            profit: 20,
            barValue: null,
            cardName: null,
            rarity: null,
          },
        ],
      });

      expect(() => render(<SessionProfitTimeline />)).not.toThrow();
      expect(screen.getByText("Profit Timeline")).toBeInTheDocument();
      // No "Notable Drops" legend since no bars have values
      expect(screen.queryByText("Notable Drops")).not.toBeInTheDocument();
    });

    it("should handle session with missing totals gracefully", () => {
      populateBuffer();
      mockGetSession.mockReturnValue({ totals: undefined });

      expect(() => render(<SessionProfitTimeline />)).not.toThrow();
      expect(mockSetDeckCost).toHaveBeenCalledWith(0);
    });

    it("should handle null session gracefully", () => {
      populateBuffer();
      mockGetSession.mockReturnValue(null);

      expect(() => render(<SessionProfitTimeline />)).not.toThrow();
      expect(mockSetDeckCost).toHaveBeenCalledWith(0);
    });

    it("should render when totalDrops > 0 but chartData is empty", () => {
      populateBuffer({ totalDrops: 3, chartData: [] });
      render(<SessionProfitTimeline />);
      // bufferVersion = totalDrops + chartData.length = 3 + 0 = 3, so it renders
      expect(screen.getByText("Profit Timeline")).toBeInTheDocument();
    });

    it("should render when totalDrops is 0 but chartData has entries", () => {
      populateBuffer({
        totalDrops: 0,
        chartData: [
          {
            x: 1,
            profit: 10,
            barValue: 10,
            cardName: "Card",
            rarity: 1,
          },
        ],
      });
      render(<SessionProfitTimeline />);
      // bufferVersion = 0 + 1 = 1, so it renders
      expect(screen.getByText("Profit Timeline")).toBeInTheDocument();
    });
  });
});
