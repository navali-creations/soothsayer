import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import PFBaseRateBeacon from "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFBaseRate.beacon";
import PFBreakEvenBeacon from "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFBreakEven.beacon";
import PFCostModelBeacon from "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFCostModel.beacon";
import PFPlAllDropsBeacon from "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFPlAllDrops.beacon";
import PFPlCardOnlyBeacon from "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFPlCardOnly.beacon";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("@repere/react", () => {
  const Noop = ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  );
  Noop.Title = ({ children }: any) => <div>{children}</div>;
  Noop.Content = ({ children }: any) => <div>{children}</div>;
  Noop.Footer = ({ children }: any) => <div>{children}</div>;
  Noop.AcknowledgeButton = ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  );

  return {
    ReperePopover: Noop,
    RepereTrigger: Noop,
    Beacons: Noop,
    AnchorPoint: { TopCenter: "TopCenter", BottomCenter: "BottomCenter" },
    Animation: { SlideDown: "SlideDown", Fade: "Fade" },
    PositioningStrategy: { Fixed: "Fixed" },
  };
});

vi.mock("~/renderer/modules/onboarding/Onboarding.components/Popover", () => ({
  default: ({ children, title, subtitle, className }: any) => (
    <div
      data-testid="popover"
      data-title={title}
      data-subtitle={subtitle}
      className={className}
    >
      {children}
    </div>
  ),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Minimal props that satisfy `PopoverComponentProps` from @repere/react. */
const defaultProps = {
  beaconId: "test-beacon",
  anchorPoint: "BottomCenter" as any,
  isOpen: true,
  isDismissing: false,
  popoverId: "popover-1",
  beacon: {
    id: "test-beacon",
    selector: "[data-test]",
    trigger: {},
    popover: {},
  } as any,
  onDismiss: vi.fn(),
  onClose: vi.fn(),
};

// ─── Parameterised tests for PF beacons ────────────────────────────────────

const beacons = [
  {
    name: "PFBaseRateBeacon",
    Component: PFBaseRateBeacon,
    expectedTitle: "Base Rate",
    titleIncludes: "Base Rate",
    subtitleIncludes: "exchange rate",
  },
  {
    name: "PFBreakEvenBeacon",
    Component: PFBreakEvenBeacon,
    expectedTitle: "Break-Even Rate",
    titleIncludes: "Break-Even",
    subtitleIncludes: "profit",
  },
  {
    name: "PFCostModelBeacon",
    Component: PFCostModelBeacon,
    expectedTitle: "Cost Model",
    titleIncludes: "Cost Model",
    subtitleIncludes: "bulk buying",
  },
  {
    name: "PFPlAllDropsBeacon",
    Component: PFPlAllDropsBeacon,
    expectedTitle: "P&L (all drops)",
    titleIncludes: "all drops",
    subtitleIncludes: "profit",
  },
  {
    name: "PFPlCardOnlyBeacon",
    Component: PFPlCardOnlyBeacon,
    expectedTitle: "P&L (card only)",
    titleIncludes: "card only",
    subtitleIncludes: "single card",
  },
];

describe.each(beacons)("$name", ({
  Component,
  expectedTitle,
  titleIncludes,
  subtitleIncludes,
}) => {
  it("renders without crashing", () => {
    const { container } = renderWithProviders(<Component {...defaultProps} />);
    expect(container).toBeTruthy();
  });

  it("wraps content in Popover", () => {
    renderWithProviders(<Component {...defaultProps} />);
    expect(screen.getByTestId("popover")).toBeInTheDocument();
  });

  it(`passes exact title "${expectedTitle}" to Popover`, () => {
    renderWithProviders(<Component {...defaultProps} />);
    expect(screen.getByTestId("popover").dataset.title).toBe(expectedTitle);
  });

  it(`title contains "${titleIncludes}"`, () => {
    renderWithProviders(<Component {...defaultProps} />);
    expect(screen.getByTestId("popover").dataset.title).toContain(
      titleIncludes,
    );
  });

  it("passes a subtitle to Popover", () => {
    renderWithProviders(<Component {...defaultProps} />);
    const subtitle = screen.getByTestId("popover").dataset.subtitle;
    expect(subtitle).toBeDefined();
    expect(subtitle!.length).toBeGreaterThan(0);
  });

  it(`subtitle contains "${subtitleIncludes}"`, () => {
    renderWithProviders(<Component {...defaultProps} />);
    expect(
      screen.getByTestId("popover").dataset.subtitle!.toLowerCase(),
    ).toContain(subtitleIncludes.toLowerCase());
  });

  it("renders educational content inside the popover", () => {
    renderWithProviders(<Component {...defaultProps} />);
    const popover = screen.getByTestId("popover");
    // Every beacon renders at least some descriptive text content
    expect(popover.textContent!.length).toBeGreaterThan(0);
  });
});

// ─── Beacon-specific tests ─────────────────────────────────────────────────

describe("PFBaseRateBeacon", () => {
  it("describes stacked deck exchange rate sourced from poe.ninja", () => {
    renderWithProviders(<PFBaseRateBeacon {...defaultProps} />);
    expect(
      screen.getByText(/poe\.ninja bulk exchange data/),
    ).toBeInTheDocument();
  });

  it('explains the "derived" badge meaning', () => {
    renderWithProviders(<PFBaseRateBeacon {...defaultProps} />);
    expect(
      screen.getByText(/bulk exchange data was unavailable/),
    ).toBeInTheDocument();
  });

  it("renders the cost model info alert", () => {
    renderWithProviders(<PFBaseRateBeacon {...defaultProps} />);
    expect(
      screen.getByText(/starting rate used by the cost model/),
    ).toBeInTheDocument();
  });
});

describe("PFBreakEvenBeacon", () => {
  it("explains the break-even concept", () => {
    renderWithProviders(<PFBreakEvenBeacon {...defaultProps} />);
    expect(screen.getByText(/minimum decks-per-divine/)).toBeInTheDocument();
  });

  it("shows the formula", () => {
    renderWithProviders(<PFBreakEvenBeacon {...defaultProps} />);
    expect(
      screen.getByText(/chaos per divine ÷ EV.*per deck/),
    ).toBeInTheDocument();
  });

  it("mentions batch-independence", () => {
    renderWithProviders(<PFBreakEvenBeacon {...defaultProps} />);
    expect(screen.getByText(/Batch-independent/)).toBeInTheDocument();
  });
});

describe("PFCostModelBeacon", () => {
  it("lists all slider explanations", () => {
    renderWithProviders(<PFCostModelBeacon {...defaultProps} />);
    expect(screen.getByText(/Decks to open:/)).toBeInTheDocument();
    expect(screen.getByText(/View:/)).toBeInTheDocument();
    expect(screen.getByText(/Price increase:/)).toBeInTheDocument();
    expect(screen.getByText(/Batch size:/)).toBeInTheDocument();
    expect(screen.getByText(/Min price filter:/)).toBeInTheDocument();
  });

  it("renders the exchange order book info alert", () => {
    renderWithProviders(<PFCostModelBeacon {...defaultProps} />);
    expect(
      screen.getByText(/can't read the live exchange order book/),
    ).toBeInTheDocument();
  });
});

describe("PFPlAllDropsBeacon", () => {
  it("passes className to Popover for wider width", () => {
    renderWithProviders(<PFPlAllDropsBeacon {...defaultProps} />);
    const popover = screen.getByTestId("popover");
    expect(popover.className).toContain("w-[500px]");
  });

  it("explains the all-drops P&L concept", () => {
    renderWithProviders(<PFPlAllDropsBeacon {...defaultProps} />);
    expect(screen.getByText(/accounts for/)).toBeInTheDocument();
  });

  it("shows the formula", () => {
    renderWithProviders(<PFPlAllDropsBeacon {...defaultProps} />);
    expect(
      screen.getByText(/decks needed × EV per deck.*cost of those decks/),
    ).toBeInTheDocument();
  });

  it("mentions selling everything", () => {
    renderWithProviders(<PFPlAllDropsBeacon {...defaultProps} />);
    expect(screen.getByText(/plan to sell everything/)).toBeInTheDocument();
  });
});

describe("PFPlCardOnlyBeacon", () => {
  it("explains the card-only P&L concept", () => {
    renderWithProviders(<PFPlCardOnlyBeacon {...defaultProps} />);
    expect(
      screen.getByText(/card's sell price and subtracts the cost/),
    ).toBeInTheDocument();
  });

  it("shows the formula", () => {
    renderWithProviders(<PFPlCardOnlyBeacon {...defaultProps} />);
    expect(
      screen.getByText(/card price − cost of decks to pull it/),
    ).toBeInTheDocument();
  });

  it("mentions batch-independence", () => {
    renderWithProviders(<PFPlCardOnlyBeacon {...defaultProps} />);
    expect(screen.getByText(/batch-independent/)).toBeInTheDocument();
  });
});
