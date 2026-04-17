import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useCardDetails, useProfitForecast } from "~/renderer/store";

import YourLuckSection from "./YourLuckSection";

vi.mock("~/renderer/store", () => ({
  useCardDetails: vi.fn(),
  useProfitForecast: vi.fn(),
}));

vi.mock("react-icons/fi", () => ({
  FiZap: (props: any) => <span {...props}>FiZap</span>,
  FiAlertTriangle: (props: any) => <span {...props}>FiAlertTriangle</span>,
  FiInfo: (props: any) => <span {...props}>FiInfo</span>,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const baseLuck = {
  label: "3.0× luckier than average",
  expectedDrops: 1.5,
  actualDrops: 3,
  luckRatio: 2.0,
  color: "success" as const,
  hasSufficientData: true,
};

function mockStore(opts: {
  personalAnalytics?: { cardName: string } | null;
  getLuckComparison?: ReturnType<typeof vi.fn>;
  rows?: Array<{ cardName: string; probability: number }>;
}) {
  vi.mocked(useCardDetails).mockReturnValue({
    personalAnalytics: opts.personalAnalytics ?? null,
    getLuckComparison: opts.getLuckComparison ?? vi.fn(() => null),
  } as any);
  vi.mocked(useProfitForecast).mockReturnValue({
    rows: opts.rows ?? [],
  } as any);
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("YourLuckSection", () => {
  // ── Lines 20-22 coverage ───────────────────────────────────────────────

  it("renders null when personalAnalytics is undefined", () => {
    mockStore({
      personalAnalytics: undefined,
      rows: [{ cardName: "Test Card", probability: 0.05 }],
    });
    const { container } = renderWithProviders(<YourLuckSection />);
    expect(container.innerHTML).toBe("");
  });

  it("renders null when personalAnalytics is null", () => {
    mockStore({
      personalAnalytics: null,
      rows: [{ cardName: "Test Card", probability: 0.05 }],
    });
    const { container } = renderWithProviders(<YourLuckSection />);
    expect(container.innerHTML).toBe("");
  });

  it("renders null when no matching row is found for cardName", () => {
    mockStore({
      personalAnalytics: { cardName: "Missing Card" },
      rows: [{ cardName: "Other Card", probability: 0.05 }],
    });
    const { container } = renderWithProviders(<YourLuckSection />);
    expect(container.innerHTML).toBe("");
  });

  it("renders null when rows array is empty", () => {
    mockStore({
      personalAnalytics: { cardName: "Test Card" },
      rows: [],
    });
    const { container } = renderWithProviders(<YourLuckSection />);
    expect(container.innerHTML).toBe("");
  });

  it("renders null when getLuckComparison returns null", () => {
    mockStore({
      personalAnalytics: { cardName: "Test Card" },
      getLuckComparison: vi.fn(() => null),
      rows: [{ cardName: "Test Card", probability: 0.05 }],
    });
    const { container } = renderWithProviders(<YourLuckSection />);
    expect(container.innerHTML).toBe("");
  });

  // ── Rendering with valid data ──────────────────────────────────────────

  it("renders luck comparison when data is valid", () => {
    mockStore({
      personalAnalytics: { cardName: "Test Card" },
      getLuckComparison: vi.fn(() => baseLuck),
      rows: [{ cardName: "Test Card", probability: 0.05 }],
    });
    renderWithProviders(<YourLuckSection />);
    expect(screen.getByText("Your Luck")).toBeInTheDocument();
    expect(screen.getByText("3.0× luckier than average")).toBeInTheDocument();
    expect(screen.getByText("1.50 drops")).toBeInTheDocument();
    expect(screen.getByText("3 drops")).toBeInTheDocument();
    expect(screen.getByText("2.00×")).toBeInTheDocument();
  });

  // ── Color classes ──────────────────────────────────────────────────────

  it("renders text-success class for success color", () => {
    mockStore({
      personalAnalytics: { cardName: "Test Card" },
      getLuckComparison: vi.fn(() => ({ ...baseLuck, color: "success" })),
      rows: [{ cardName: "Test Card", probability: 0.05 }],
    });
    renderWithProviders(<YourLuckSection />);
    const label = screen.getByText("3.0× luckier than average");
    expect(label.className).toContain("text-success");
  });

  it("renders text-error class for error color", () => {
    mockStore({
      personalAnalytics: { cardName: "Test Card" },
      getLuckComparison: vi.fn(() => ({
        ...baseLuck,
        label: "Below average",
        color: "error",
      })),
      rows: [{ cardName: "Test Card", probability: 0.05 }],
    });
    renderWithProviders(<YourLuckSection />);
    const label = screen.getByText("Below average");
    expect(label.className).toContain("text-error");
  });

  it("renders text-warning class for warning color", () => {
    mockStore({
      personalAnalytics: { cardName: "Test Card" },
      getLuckComparison: vi.fn(() => ({
        ...baseLuck,
        label: "About average",
        color: "warning",
      })),
      rows: [{ cardName: "Test Card", probability: 0.05 }],
    });
    renderWithProviders(<YourLuckSection />);
    const label = screen.getByText("About average");
    expect(label.className).toContain("text-warning");
  });

  // ── Insufficient data warning ──────────────────────────────────────────

  it("renders insufficient data warning when hasSufficientData is false", () => {
    mockStore({
      personalAnalytics: { cardName: "Test Card" },
      getLuckComparison: vi.fn(() => ({
        ...baseLuck,
        hasSufficientData: false,
      })),
      rows: [{ cardName: "Test Card", probability: 0.05 }],
    });
    renderWithProviders(<YourLuckSection />);
    expect(
      screen.getByText(/not enough data for a reliable comparison/i),
    ).toBeInTheDocument();
  });

  it("hides insufficient data warning when hasSufficientData is true", () => {
    mockStore({
      personalAnalytics: { cardName: "Test Card" },
      getLuckComparison: vi.fn(() => baseLuck),
      rows: [{ cardName: "Test Card", probability: 0.05 }],
    });
    renderWithProviders(<YourLuckSection />);
    expect(
      screen.queryByText(/not enough data for a reliable comparison/i),
    ).not.toBeInTheDocument();
  });

  // ── Luck ratio bar ────────────────────────────────────────────────────

  it("renders luck ratio bar when ratio !== 1 and finite and > 0", () => {
    mockStore({
      personalAnalytics: { cardName: "Test Card" },
      getLuckComparison: vi.fn(() => baseLuck),
      rows: [{ cardName: "Test Card", probability: 0.05 }],
    });
    renderWithProviders(<YourLuckSection />);
    expect(screen.getByText("Luck ratio")).toBeInTheDocument();
    expect(screen.getByText("2.00×")).toBeInTheDocument();
  });

  it("hides luck ratio bar when ratio === 1", () => {
    mockStore({
      personalAnalytics: { cardName: "Test Card" },
      getLuckComparison: vi.fn(() => ({ ...baseLuck, luckRatio: 1 })),
      rows: [{ cardName: "Test Card", probability: 0.05 }],
    });
    renderWithProviders(<YourLuckSection />);
    expect(screen.queryByText("Luck ratio")).not.toBeInTheDocument();
  });
});
