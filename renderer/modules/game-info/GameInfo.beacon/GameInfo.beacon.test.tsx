import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import GameInfoBeacon from "~/renderer/modules/game-info/GameInfo.beacon";

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

// ─── Parameterised tests ───────────────────────────────────────────────────

describe("GameInfoBeacon", () => {
  it("renders without crashing", () => {
    const { container } = renderWithProviders(
      <GameInfoBeacon {...defaultProps} />,
    );
    expect(container).toBeTruthy();
  });

  it("wraps content in Popover", () => {
    renderWithProviders(<GameInfoBeacon {...defaultProps} />);
    expect(screen.getByTestId("popover")).toBeInTheDocument();
  });

  it('passes exact title "Game & League Selection" to Popover', () => {
    renderWithProviders(<GameInfoBeacon {...defaultProps} />);
    expect(screen.getByTestId("popover").dataset.title).toBe(
      "Game & League Selection",
    );
  });

  it('title contains "Game"', () => {
    renderWithProviders(<GameInfoBeacon {...defaultProps} />);
    expect(screen.getByTestId("popover").dataset.title).toContain("Game");
  });

  it("passes a subtitle to Popover", () => {
    renderWithProviders(<GameInfoBeacon {...defaultProps} />);
    const subtitle = screen.getByTestId("popover").dataset.subtitle;
    expect(subtitle).toBeDefined();
    expect(subtitle!.length).toBeGreaterThan(0);
  });

  it('subtitle contains "league"', () => {
    renderWithProviders(<GameInfoBeacon {...defaultProps} />);
    expect(
      screen.getByTestId("popover").dataset.subtitle!.toLowerCase(),
    ).toContain("league");
  });

  it("renders educational content inside the popover", () => {
    renderWithProviders(<GameInfoBeacon {...defaultProps} />);
    const popover = screen.getByTestId("popover");
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
