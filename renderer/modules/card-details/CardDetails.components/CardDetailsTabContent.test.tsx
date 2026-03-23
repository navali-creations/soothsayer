import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

// ─── Child component stubs for MarketTabContent ────────────────────────────

vi.mock("./CardDetailsPriceSummary", () => ({
  default: () => <div data-testid="price-summary" />,
}));

vi.mock("./CardDetailsPriceChart", () => ({
  default: () => <div data-testid="price-chart" />,
}));

vi.mock("./CardDetailsDropStats", () => ({
  default: () => <div data-testid="drop-stats" />,
}));

// ─── Child component stubs for YourDataTabContent ──────────────────────────

vi.mock("./CardDetailsPersonal", () => ({
  default: () => <div data-testid="personal" />,
}));

vi.mock("./CardDetailsDropTimeline", () => ({
  default: () => <div data-testid="drop-timeline" />,
}));

vi.mock("./CardDetailsSessionList", () => ({
  default: ({ cardName, game }: any) => (
    <div
      data-testid="session-list"
      data-card-name={cardName}
      data-game={game}
    />
  ),
}));

vi.mock("./LoadingOverlay", () => ({
  default: ({ isLoading, children }: any) => (
    <div data-testid="loading-overlay" data-is-loading={String(isLoading)}>
      {children}
    </div>
  ),
}));

// ─── Component imports (after all mocks) ───────────────────────────────────

import MarketTabContent from "./MarketTabContent";
import YourDataTabContent from "./YourDataTabContent";

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// MarketTabContent
// ═══════════════════════════════════════════════════════════════════════════

describe("MarketTabContent", () => {
  it("renders CardDetailsPriceSummary", () => {
    renderWithProviders(<MarketTabContent />);
    expect(screen.getByTestId("price-summary")).toBeInTheDocument();
  });

  it("renders CardDetailsPriceChart", () => {
    renderWithProviders(<MarketTabContent />);
    expect(screen.getByTestId("price-chart")).toBeInTheDocument();
  });

  it("renders CardDetailsDropStats", () => {
    renderWithProviders(<MarketTabContent />);
    expect(screen.getByTestId("drop-stats")).toBeInTheDocument();
  });

  it("renders all three children in order", () => {
    const { container } = renderWithProviders(<MarketTabContent />);

    const summary = screen.getByTestId("price-summary");
    const chart = screen.getByTestId("price-chart");
    const stats = screen.getByTestId("drop-stats");

    // All three are rendered
    expect(summary).toBeInTheDocument();
    expect(chart).toBeInTheDocument();
    expect(stats).toBeInTheDocument();

    // Verify DOM order: summary before chart before stats
    const allTestIds = Array.from(container.querySelectorAll("[data-testid]"));
    const summaryIdx = allTestIds.indexOf(summary);
    const chartIdx = allTestIds.indexOf(chart);
    const statsIdx = allTestIds.indexOf(stats);

    expect(summaryIdx).toBeLessThan(chartIdx);
    expect(chartIdx).toBeLessThan(statsIdx);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// YourDataTabContent
// ═══════════════════════════════════════════════════════════════════════════

describe("YourDataTabContent", () => {
  it("renders CardDetailsPersonal", () => {
    renderWithProviders(
      <YourDataTabContent
        cardName="The Doctor"
        game="poe1"
        isLoading={false}
      />,
    );
    expect(screen.getByTestId("personal")).toBeInTheDocument();
  });

  it("renders CardDetailsDropTimeline", () => {
    renderWithProviders(
      <YourDataTabContent
        cardName="The Doctor"
        game="poe1"
        isLoading={false}
      />,
    );
    expect(screen.getByTestId("drop-timeline")).toBeInTheDocument();
  });

  it("renders CardDetailsSessionList with cardName and game props", () => {
    renderWithProviders(
      <YourDataTabContent
        cardName="The Doctor"
        game="poe2"
        isLoading={false}
      />,
    );
    const sessionList = screen.getByTestId("session-list");
    expect(sessionList).toBeInTheDocument();
    expect(sessionList).toHaveAttribute("data-card-name", "The Doctor");
    expect(sessionList).toHaveAttribute("data-game", "poe2");
  });

  it("passes isLoading=false to LoadingOverlay wrappers", () => {
    renderWithProviders(
      <YourDataTabContent
        cardName="The Doctor"
        game="poe1"
        isLoading={false}
      />,
    );
    const overlays = screen.getAllByTestId("loading-overlay");
    expect(overlays).toHaveLength(3);
    for (const overlay of overlays) {
      expect(overlay).toHaveAttribute("data-is-loading", "false");
    }
  });

  it("passes isLoading=true to LoadingOverlay wrappers", () => {
    renderWithProviders(
      <YourDataTabContent cardName="The Doctor" game="poe1" isLoading={true} />,
    );
    const overlays = screen.getAllByTestId("loading-overlay");
    expect(overlays).toHaveLength(3);
    for (const overlay of overlays) {
      expect(overlay).toHaveAttribute("data-is-loading", "true");
    }
  });

  it("renders all sections when isLoading is false", () => {
    renderWithProviders(
      <YourDataTabContent
        cardName="The Doctor"
        game="poe1"
        isLoading={false}
      />,
    );
    expect(screen.getByTestId("personal")).toBeInTheDocument();
    expect(screen.getByTestId("drop-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("session-list")).toBeInTheDocument();
  });

  it("renders all sections with loading overlay when isLoading is true", () => {
    renderWithProviders(
      <YourDataTabContent cardName="The Doctor" game="poe1" isLoading={true} />,
    );

    // All content is still rendered (overlay doesn't remove children)
    expect(screen.getByTestId("personal")).toBeInTheDocument();
    expect(screen.getByTestId("drop-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("session-list")).toBeInTheDocument();

    // All three overlays are in the loading state
    const overlays = screen.getAllByTestId("loading-overlay");
    expect(overlays).toHaveLength(3);
    for (const overlay of overlays) {
      expect(overlay).toHaveAttribute("data-is-loading", "true");
    }
  });

  it("wraps each section in its own LoadingOverlay", () => {
    renderWithProviders(
      <YourDataTabContent
        cardName="The Doctor"
        game="poe1"
        isLoading={false}
      />,
    );

    const overlays = screen.getAllByTestId("loading-overlay");
    expect(overlays).toHaveLength(3);

    // Each overlay wraps exactly one child component
    expect(overlays[0]).toContainElement(screen.getByTestId("personal"));
    expect(overlays[1]).toContainElement(screen.getByTestId("drop-timeline"));
    expect(overlays[2]).toContainElement(screen.getByTestId("session-list"));
  });
});
