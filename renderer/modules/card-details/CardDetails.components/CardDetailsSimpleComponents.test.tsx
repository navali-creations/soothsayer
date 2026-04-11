import { afterEach, describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

// ─── Router mock ───────────────────────────────────────────────────────────

const { mockNavigate, mockHistoryBack } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockHistoryBack: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const { createFullRouterMock } = await import(
    "~/renderer/__test-setup__/router-mock"
  );
  return createFullRouterMock({
    mockNavigate,
    mockHistoryBack,
    useParamsReturn: { cardSlug: "the-doctor" },
  });
});

// ─── Component imports ─────────────────────────────────────────────────────

import CardDetailsError from "~/renderer/modules/card-details/CardDetails.components/CardDetailsError";
import HeaderSubtitle from "~/renderer/modules/card-details/CardDetails.components/CardDetailsHeader/HeaderSubtitle";
import CardDetailsLoading from "~/renderer/modules/card-details/CardDetails.components/CardDetailsLoading";
import PersonalStatsError from "~/renderer/modules/card-details/CardDetails.components/CardDetailsPersonal/PersonalStatsError";
import PersonalStatsNeverFound from "~/renderer/modules/card-details/CardDetails.components/CardDetailsPersonal/PersonalStatsNeverFound";
import PersonalStatsPlaceholder from "~/renderer/modules/card-details/CardDetails.components/CardDetailsPersonal/PersonalStatsPlaceholder";
import ConfidenceBadge from "~/renderer/modules/card-details/CardDetails.components/CardDetailsPriceSummary/ConfidenceBadge";
import PriceChangePill from "~/renderer/modules/card-details/CardDetails.components/CardDetailsPriceSummary/PriceChangePill";
import LoadingOverlay from "~/renderer/modules/card-details/CardDetails.components/LoadingOverlay";

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// CardDetailsError
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsError", () => {
  it("displays the provided error message", () => {
    renderWithProviders(<CardDetailsError error="Something went wrong" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it('shows "Card not found" when error is null', () => {
    renderWithProviders(<CardDetailsError error={null} />);
    expect(screen.getByText("Card not found")).toBeInTheDocument();
  });

  it('renders a "Back to Cards" button', () => {
    renderWithProviders(<CardDetailsError error={null} />);
    expect(
      screen.getByRole("button", { name: /back to cards/i }),
    ).toBeInTheDocument();
  });

  it("navigates to /cards fallback when the button is clicked (jsdom has no history)", async () => {
    const { user } = renderWithProviders(<CardDetailsError error={null} />);
    const button = screen.getByRole("button", { name: /back to cards/i });
    await user.click(button);
    // In jsdom window.history.length === 1, so BackButton uses the fallback route
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/cards" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CardDetailsLoading
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsLoading", () => {
  it("renders a loading spinner", () => {
    const { container } = renderWithProviders(<CardDetailsLoading />);
    const spinner = container.querySelector(".loading.loading-spinner");
    expect(spinner).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LoadingOverlay
// ═══════════════════════════════════════════════════════════════════════════

describe("LoadingOverlay", () => {
  it("always renders children", () => {
    renderWithProviders(
      <LoadingOverlay isLoading={false}>
        <span>Child content</span>
      </LoadingOverlay>,
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders children when loading is true", () => {
    renderWithProviders(
      <LoadingOverlay isLoading={true}>
        <span>Child content</span>
      </LoadingOverlay>,
    );
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders overlay with spinner when isLoading is true", () => {
    const { container } = renderWithProviders(
      <LoadingOverlay isLoading={true}>
        <span>Child content</span>
      </LoadingOverlay>,
    );
    const spinner = container.querySelector(".loading.loading-spinner");
    expect(spinner).toBeInTheDocument();
  });

  it("does not render overlay when isLoading is false", () => {
    const { container } = renderWithProviders(
      <LoadingOverlay isLoading={false}>
        <span>Child content</span>
      </LoadingOverlay>,
    );
    const spinner = container.querySelector(".loading.loading-spinner");
    expect(spinner).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// HeaderSubtitle
// ═══════════════════════════════════════════════════════════════════════════

describe("HeaderSubtitle", () => {
  it("renders the rarity label badge", () => {
    renderWithProviders(<HeaderSubtitle rarity={1} fromBoss={false} />);
    expect(screen.getByText("Extremely Rare")).toBeInTheDocument();
  });

  it("renders correct label for each rarity tier", () => {
    const cases: Array<[0 | 1 | 2 | 3 | 4, string]> = [
      [0, "Unknown"],
      [1, "Extremely Rare"],
      [2, "Rare"],
      [3, "Less Common"],
      [4, "Common"],
    ];

    for (const [rarity, label] of cases) {
      const { unmount } = renderWithProviders(
        <HeaderSubtitle rarity={rarity} fromBoss={false} />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it('shows "Boss-exclusive" badge when fromBoss is true', () => {
    renderWithProviders(<HeaderSubtitle rarity={2} fromBoss={true} />);
    expect(screen.getByText("Boss-exclusive")).toBeInTheDocument();
  });

  it('does not show "Boss-exclusive" badge when fromBoss is false', () => {
    renderWithProviders(<HeaderSubtitle rarity={2} fromBoss={false} />);
    expect(screen.queryByText("Boss-exclusive")).not.toBeInTheDocument();
  });

  it("applies inline style to the rarity badge", () => {
    renderWithProviders(<HeaderSubtitle rarity={1} fromBoss={false} />);
    const badge = screen.getByText("Extremely Rare");
    expect(badge).toHaveStyle({ borderWidth: "1px", borderStyle: "solid" });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ConfidenceBadge
// ═══════════════════════════════════════════════════════════════════════════

describe("ConfidenceBadge", () => {
  it("renders High confidence for value 1", () => {
    renderWithProviders(<ConfidenceBadge confidence={1} />);
    expect(screen.getByText("High confidence")).toBeInTheDocument();
    expect(screen.getByText("🟢")).toBeInTheDocument();
  });

  it("renders Medium confidence for value 2", () => {
    renderWithProviders(<ConfidenceBadge confidence={2} />);
    expect(screen.getByText("Medium confidence")).toBeInTheDocument();
    expect(screen.getByText("🟡")).toBeInTheDocument();
  });

  it("renders Low confidence for value 3", () => {
    renderWithProviders(<ConfidenceBadge confidence={3} />);
    expect(screen.getByText("Low confidence")).toBeInTheDocument();
    expect(screen.getByText("🔴")).toBeInTheDocument();
  });

  it("returns null for confidence = null", () => {
    const { container } = renderWithProviders(
      <ConfidenceBadge confidence={null} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null for confidence = 0", () => {
    const { container } = renderWithProviders(
      <ConfidenceBadge confidence={0} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("returns null for an unknown confidence value", () => {
    const { container } = renderWithProviders(
      <ConfidenceBadge confidence={99} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("includes a tooltip with a description", () => {
    renderWithProviders(<ConfidenceBadge confidence={1} />);
    const tooltip = screen.getByText("High confidence").closest("[data-tip]");
    expect(tooltip).toHaveAttribute(
      "data-tip",
      "Price from exchange API with good volume — highly reliable",
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PriceChangePill
// ═══════════════════════════════════════════════════════════════════════════

describe("PriceChangePill", () => {
  it("renders the label", () => {
    renderWithProviders(<PriceChangePill label="7d" change={5.0} />);
    expect(screen.getByText("7d")).toBeInTheDocument();
  });

  it("formats positive change with + sign and %", () => {
    renderWithProviders(<PriceChangePill label="7d" change={12.3} />);
    expect(screen.getByText(/\+12\.3%/)).toBeInTheDocument();
  });

  it("formats negative change with - sign and %", () => {
    renderWithProviders(<PriceChangePill label="7d" change={-5.7} />);
    expect(screen.getByText(/-5\.7%/)).toBeInTheDocument();
  });

  it("formats zero change", () => {
    renderWithProviders(<PriceChangePill label="7d" change={0} />);
    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });

  it("returns null when change is undefined", () => {
    const { container } = renderWithProviders(
      <PriceChangePill label="7d" change={undefined} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("applies success color class for positive change", () => {
    const { container } = renderWithProviders(
      <PriceChangePill label="7d" change={5.0} />,
    );
    const valueSpan = container.querySelector(".text-success");
    expect(valueSpan).toBeInTheDocument();
  });

  it("applies error color class for negative change", () => {
    const { container } = renderWithProviders(
      <PriceChangePill label="7d" change={-3.2} />,
    );
    const valueSpan = container.querySelector(".text-error");
    expect(valueSpan).toBeInTheDocument();
  });

  it("applies muted color class for zero change", () => {
    const { container } = renderWithProviders(
      <PriceChangePill label="7d" change={0} />,
    );
    const valueSpan = container.querySelector(".text-base-content\\/60");
    expect(valueSpan).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PersonalStatsError
// ═══════════════════════════════════════════════════════════════════════════

describe("PersonalStatsError", () => {
  it("renders the provided error message", () => {
    renderWithProviders(<PersonalStatsError message="Failed to load stats" />);
    expect(screen.getByText("Failed to load stats")).toBeInTheDocument();
  });

  it("renders with the error text color", () => {
    const { container } = renderWithProviders(
      <PersonalStatsError message="Error" />,
    );
    const wrapper = container.querySelector(".text-error");
    expect(wrapper).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PersonalStatsNeverFound
// ═══════════════════════════════════════════════════════════════════════════

describe("PersonalStatsNeverFound", () => {
  it('renders "You haven\'t found this card yet"', () => {
    renderWithProviders(<PersonalStatsNeverFound />);
    expect(
      screen.getByText("You haven't found this card yet"),
    ).toBeInTheDocument();
  });

  it("renders hint about drop data appearing", () => {
    renderWithProviders(<PersonalStatsNeverFound />);
    expect(
      screen.getByText("Drop data will appear here once you find one"),
    ).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PersonalStatsPlaceholder
// ═══════════════════════════════════════════════════════════════════════════

describe("PersonalStatsPlaceholder", () => {
  it("renders placeholder dashes for all stat values", () => {
    renderWithProviders(<PersonalStatsPlaceholder />);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBe(4);
  });

  it("renders stat titles", () => {
    renderWithProviders(<PersonalStatsPlaceholder />);
    expect(screen.getByText("Total Drops")).toBeInTheDocument();
    expect(screen.getByText("Drop Rate")).toBeInTheDocument();
    expect(screen.getByText("First Found")).toBeInTheDocument();
    expect(screen.getByText("Last Seen")).toBeInTheDocument();
  });

  it("renders stat descriptions", () => {
    renderWithProviders(<PersonalStatsPlaceholder />);
    expect(screen.getByText("Across all sessions")).toBeInTheDocument();
    expect(screen.getByText("Drops per cards opened")).toBeInTheDocument();
  });
});
