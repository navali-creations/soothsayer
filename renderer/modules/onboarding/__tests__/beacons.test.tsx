import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import GameInfoBeacon from "~/renderer/modules/game-info/GameInfo.beacon";
import OverlayBeacon from "~/renderer/modules/overlay/Overlay.beacon";
import PFBaseRateBeacon from "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFBaseRate.beacon";
import PFBreakEvenBeacon from "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFBreakEven.beacon";
import PFCostModelBeacon from "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFCostModel.beacon";
import PFPlAllDropsBeacon from "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFPlAllDrops.beacon";
import PFPlCardOnlyBeacon from "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFPlCardOnly.beacon";

// ─── Mocks ─────────────────────────────────────────────────────────────────

// Mock @repere/react — the Popover component imports ReperePopover and
// PopoverComponentProps from here. We provide minimal stubs so the beacon
// components can be rendered in isolation without the full Repere runtime.
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

// Mock the Popover wrapper component used by all beacons. Renders a thin
// shell that exposes `title` and `subtitle` via data attributes so we can
// assert on them without relying on the full Popover implementation.
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

// ─── Parameterised tests for all beacons ───────────────────────────────────

const beacons = [
  {
    name: "GameInfoBeacon",
    Component: GameInfoBeacon,
    expectedTitle: "Game & League Selection",
    titleIncludes: "Game",
    subtitleIncludes: "league",
  },
  {
    name: "OverlayBeacon",
    Component: OverlayBeacon,
    expectedTitle: "Overlay Window",
    titleIncludes: "Overlay",
    subtitleIncludes: "real-time",
  },
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

describe("GameInfoBeacon", () => {
  it("renders the League Selection heading", () => {
    renderWithProviders(<GameInfoBeacon {...defaultProps} />);
    expect(screen.getByText("League Selection")).toBeInTheDocument();
  });

  it("renders bullet points about league behaviour", () => {
    renderWithProviders(<GameInfoBeacon {...defaultProps} />);
    expect(
      screen.getByText("Switch between available leagues for each game"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /When a league ends, it automatically switches to Standard/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("New leagues become available once they go live"),
    ).toBeInTheDocument();
  });

  it("renders the Path of Exile 2 info alert", () => {
    renderWithProviders(<GameInfoBeacon {...defaultProps} />);
    expect(
      screen.getByText(/Path of Exile 2 is currently disabled/),
    ).toBeInTheDocument();
  });
});

describe("OverlayBeacon", () => {
  it("renders a video element", () => {
    renderWithProviders(<OverlayBeacon {...defaultProps} />);
    const video = document.querySelector("video");
    expect(video).toBeInTheDocument();
  });

  it("video has autoPlay, loop, and muted attributes", () => {
    renderWithProviders(<OverlayBeacon {...defaultProps} />);
    const video = document.querySelector("video")!;
    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");
    expect(video.muted).toBe(true);
  });

  it("shows loading placeholder before video loads", () => {
    renderWithProviders(<OverlayBeacon {...defaultProps} />);
    expect(screen.getByText("Loading video...")).toBeInTheDocument();
  });

  it("video is hidden before it has loaded", () => {
    renderWithProviders(<OverlayBeacon {...defaultProps} />);
    const video = document.querySelector("video")!;
    expect(video.className).toContain("hidden");
  });

  it("hides loading placeholder after video fires loadedData", () => {
    renderWithProviders(<OverlayBeacon {...defaultProps} />);
    const video = document.querySelector("video")!;

    fireEvent.loadedData(video);

    expect(screen.queryByText("Loading video...")).not.toBeInTheDocument();
  });

  it("video becomes visible after loadedData event", () => {
    renderWithProviders(<OverlayBeacon {...defaultProps} />);
    const video = document.querySelector("video")!;

    fireEvent.loadedData(video);

    expect(video.className).not.toContain("hidden");
  });

  it("renders the How It Works heading", () => {
    renderWithProviders(<OverlayBeacon {...defaultProps} />);
    expect(screen.getByText("How It Works")).toBeInTheDocument();
  });

  it("renders educational bullet points about the overlay", () => {
    renderWithProviders(<OverlayBeacon {...defaultProps} />);
    expect(
      screen.getByText(
        /Reads your Client\.txt file to detect card drops in real-time/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("View per card value at a glance"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /The overlay is transparent and stays on top of your game/,
      ),
    ).toBeInTheDocument();
  });

  it("renders the overlay toggle info alert", () => {
    renderWithProviders(<OverlayBeacon {...defaultProps} />);
    expect(
      screen.getByText(
        /Click the overlay icon to toggle the overlay window on\/off/,
      ),
    ).toBeInTheDocument();
  });
});

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
