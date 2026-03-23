import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import OverlayBeacon from "~/renderer/modules/overlay/Overlay.beacon";

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

describe("OverlayBeacon", () => {
  it("renders without crashing", () => {
    const { container } = renderWithProviders(
      <OverlayBeacon {...defaultProps} />,
    );
    expect(container).toBeTruthy();
  });

  it("wraps content in Popover", () => {
    renderWithProviders(<OverlayBeacon {...defaultProps} />);
    expect(screen.getByTestId("popover")).toBeInTheDocument();
  });

  it('passes exact title "Overlay Window" to Popover', () => {
    renderWithProviders(<OverlayBeacon {...defaultProps} />);
    expect(screen.getByTestId("popover").dataset.title).toBe("Overlay Window");
  });

  it('title contains "Overlay"', () => {
    renderWithProviders(<OverlayBeacon {...defaultProps} />);
    expect(screen.getByTestId("popover").dataset.title).toContain("Overlay");
  });

  it("passes a subtitle to Popover", () => {
    renderWithProviders(<OverlayBeacon {...defaultProps} />);
    const subtitle = screen.getByTestId("popover").dataset.subtitle;
    expect(subtitle).toBeDefined();
    expect(subtitle!.length).toBeGreaterThan(0);
  });

  it('subtitle contains "real-time"', () => {
    renderWithProviders(<OverlayBeacon {...defaultProps} />);
    expect(
      screen.getByTestId("popover").dataset.subtitle!.toLowerCase(),
    ).toContain("real-time");
  });

  it("renders educational content inside the popover", () => {
    renderWithProviders(<OverlayBeacon {...defaultProps} />);
    const popover = screen.getByTestId("popover");
    expect(popover.textContent!.length).toBeGreaterThan(0);
  });

  // ─── Beacon-specific tests ─────────────────────────────────────────────

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
