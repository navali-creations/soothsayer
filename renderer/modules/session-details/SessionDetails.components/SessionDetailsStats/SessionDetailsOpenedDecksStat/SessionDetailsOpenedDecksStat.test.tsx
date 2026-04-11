import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { SessionDetailsOpenedDecksStat } from "./SessionDetailsOpenedDecksStat";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/components", () => ({
  Stat: Object.assign(
    ({ children, className }: any) => (
      <div data-testid="stat" className={className}>
        {children}
      </div>
    ),
    {
      Title: ({ children }: any) => (
        <div data-testid="stat-title">{children}</div>
      ),
      Value: ({ children, className }: any) => (
        <div data-testid="stat-value" className={className}>
          {children}
        </div>
      ),
      Desc: ({ children }: any) => (
        <div data-testid="stat-desc">{children}</div>
      ),
      Figure: ({ children }: any) => (
        <div data-testid="stat-figure">{children}</div>
      ),
    },
  ),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function setupStore(overrides: Record<string, any> = {}) {
  const sessionDetails = {
    getDuration: vi.fn().mockReturnValue("1h 30m"),
    getSession: vi.fn().mockReturnValue({ totalCount: 100 }),
    getTotalProfit: vi.fn().mockReturnValue(5000),
    getPriceData: vi
      .fn()
      .mockReturnValue({ chaosToDivineRatio: 150, cardPrices: {} }),
    getNetProfit: vi
      .fn()
      .mockReturnValue({ netProfit: 4500, totalDeckCost: 500 }),
    getHasTimeline: vi.fn().mockReturnValue(false),
    getTimeline: vi.fn().mockReturnValue(null),
    ...overrides,
  };
  vi.mocked(useBoundStore).mockReturnValue({ sessionDetails } as any);
  return sessionDetails;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SessionDetailsOpenedDecksStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    setupStore();
  });

  it('shows "Stacked Decks Opened" as the title', () => {
    setupStore({
      getSession: vi.fn().mockReturnValue({ totalCount: 50 }),
    });
    renderWithProviders(<SessionDetailsOpenedDecksStat />);

    expect(screen.getByText("Stacked Decks Opened")).toBeInTheDocument();
  });

  it("displays the total count value", () => {
    setupStore({
      getSession: vi.fn().mockReturnValue({ totalCount: 50 }),
    });
    renderWithProviders(<SessionDetailsOpenedDecksStat />);

    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it('shows "Total decks" as the description', () => {
    setupStore({
      getSession: vi.fn().mockReturnValue({ totalCount: 50 }),
    });
    renderWithProviders(<SessionDetailsOpenedDecksStat />);

    expect(screen.getByText("Total decks")).toBeInTheDocument();
  });

  it("handles zero count", () => {
    setupStore({
      getSession: vi.fn().mockReturnValue({ totalCount: 0 }),
    });
    renderWithProviders(<SessionDetailsOpenedDecksStat />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("handles large count", () => {
    setupStore({
      getSession: vi.fn().mockReturnValue({ totalCount: 9999 }),
    });
    renderWithProviders(<SessionDetailsOpenedDecksStat />);

    expect(screen.getByText("9999")).toBeInTheDocument();
  });
});
