import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { usePoeNinja, useProfitForecast } from "~/renderer/store";

import PFSummaryCards from "./PFSummaryCards";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useProfitForecast: vi.fn(),
  usePoeNinja: vi.fn(),
}));

vi.mock("~/renderer/components", () => ({
  GroupedStats: ({ children, ...props }: any) => (
    <div data-testid="grouped-stats" {...props}>
      {children}
    </div>
  ),
  Stat: Object.assign(
    ({ children, ...props }: any) => (
      <div data-testid="stat" {...props}>
        {children}
      </div>
    ),
    {
      Title: ({ children, ...props }: any) => (
        <div data-testid="stat-title" {...props}>
          {children}
        </div>
      ),
      Value: ({ children, ...props }: any) => (
        <div data-testid="stat-value" {...props}>
          {children}
        </div>
      ),
      Desc: ({ children, ...props }: any) => (
        <div data-testid="stat-desc" {...props}>
          {children}
        </div>
      ),
    },
  ),
}));

const mockUseProfitForecast = vi.mocked(useProfitForecast);
const mockUsePoeNinja = vi.mocked(usePoeNinja);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockProfitForecast(overrides: any = {}) {
  return {
    isLoading: false,
    isComputing: false,
    evPerDeck: 10,
    chaosToDivineRatio: 200,
    baseRate: 80,
    baseRateSource: "exchange" as const,
    customBaseRate: null as number | null,
    snapshotFetchedAt: "2024-06-15T12:00:00Z",
    getTotalCost: vi.fn(() => 16000),
    getTotalRevenue: vi.fn(() => 20000),
    getBreakEvenRate: vi.fn(() => 20),
    getAvgCostPerDeck: vi.fn(() => 2.5),
    getEffectiveBaseRate: vi.fn(() => 80),
    hasData: vi.fn(() => true),
    setCustomBaseRate: vi.fn(),
    setIsComputing: vi.fn(),
    getBatchPnL: vi.fn(() => ({
      revenue: 20000,
      cost: 16500,
      netPnL: 3500,
      confidence: {
        estimated: 3500,
        optimistic: 12000,
      },
    })),
    ...overrides,
  } as any;
}

function createMockPoeNinja(overrides: any = {}) {
  return {
    isRefreshing: false,
    ...overrides,
  } as any;
}

function setupStore(overrides: any = {}) {
  const profitForecast = createMockProfitForecast(overrides.profitForecast);
  const poeNinja = createMockPoeNinja(overrides.poeNinja);
  mockUseProfitForecast.mockReturnValue(profitForecast);
  mockUsePoeNinja.mockReturnValue(poeNinja);
  return { profitForecast, poeNinja };
}

function renderCards(storeOverrides: any = {}) {
  const state = setupStore(storeOverrides);
  const result = renderWithProviders(<PFSummaryCards />);
  return { state, ...result };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PFSummaryCards", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Composition — all 5 stat cards are rendered ────────────────────────

  describe("Composition", () => {
    it("renders all 5 stat cards", () => {
      renderCards();
      const stats = screen.getAllByTestId("stat");
      expect(stats).toHaveLength(5);
    });

    it("renders 'Base Rate' title", () => {
      renderCards();
      expect(screen.getByText("Base Rate")).toBeInTheDocument();
    });

    it("renders 'You Spend' title", () => {
      renderCards();
      expect(screen.getByText("You Spend")).toBeInTheDocument();
    });

    it("renders 'Estimated Return' title", () => {
      renderCards();
      expect(screen.getByText("Estimated Return")).toBeInTheDocument();
    });

    it("renders 'Estimated Net' title", () => {
      renderCards();
      expect(screen.getByText(/Estimated Net/)).toBeInTheDocument();
    });

    it("renders 'Break-Even Rate' title", () => {
      renderCards();
      expect(screen.getByText("Break-Even Rate")).toBeInTheDocument();
    });
  });

  // ── Overlay / skeleton states ──────────────────────────────────────────

  describe("Overlay states", () => {
    it("shows loading overlay when isComputing is true", () => {
      const { container } = renderCards({
        profitForecast: { isComputing: true },
      });
      const spinner = container.querySelector(".loading.loading-spinner");
      expect(spinner).toBeTruthy();
    });

    it("shows loading overlay when isRefreshing is true", () => {
      const { container } = renderCards({
        poeNinja: { isRefreshing: true },
      });
      const spinner = container.querySelector(".loading.loading-spinner");
      expect(spinner).toBeTruthy();
    });

    it("does not show overlay when neither isComputing nor isRefreshing", () => {
      const { container } = renderCards();
      const spinner = container.querySelector(".loading.loading-spinner");
      expect(spinner).toBeFalsy();
    });

    it("does not show overlay when only isLoading is true (overlay is for stale, not initial load)", () => {
      const { container } = renderCards({
        profitForecast: { isLoading: true },
      });
      const spinner = container.querySelector(".loading.loading-spinner");
      expect(spinner).toBeFalsy();
    });
  });

  // ── No data (dash display) — integration through children ─────────────

  describe("No data (dash display)", () => {
    it("shows dashes when hasData returns false", () => {
      renderCards({
        profitForecast: { hasData: vi.fn(() => false) },
      });
      const dashes = screen.getAllByText("—");
      // Base Rate, You Spend, Estimated Return, Estimated Net, Break-Even Rate → 5
      expect(dashes).toHaveLength(5);
    });

    it("shows dashes when isLoading is true", () => {
      renderCards({
        profitForecast: {
          isLoading: true,
          hasData: vi.fn(() => false),
        },
      });
      const dashes = screen.getAllByText("—");
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  // ── Onboarding data attributes ─────────────────────────────────────────

  describe("Onboarding attributes", () => {
    it("has onboarding data attribute on Base Rate stat", () => {
      const { container } = renderCards();
      expect(
        container.querySelector('[data-onboarding="pf-base-rate"]'),
      ).toBeInTheDocument();
    });

    it("has onboarding data attribute on Break-Even Rate stat", () => {
      const { container } = renderCards();
      expect(
        container.querySelector('[data-onboarding="pf-break-even-rate"]'),
      ).toBeInTheDocument();
    });

    it("does not have pf-pl-card-only onboarding attribute (moved to table column header)", () => {
      const { container } = renderCards();
      expect(
        container.querySelector('[data-onboarding="pf-pl-card-only"]'),
      ).not.toBeInTheDocument();
    });

    it("does not have pf-pl-all-drops onboarding attribute (moved to table column header)", () => {
      const { container } = renderCards();
      expect(
        container.querySelector('[data-onboarding="pf-pl-all-drops"]'),
      ).not.toBeInTheDocument();
    });
  });
});
