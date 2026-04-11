import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("@repere/react", () => ({
  ReperePopover: Object.assign(
    ({ children, className, ...props }: any) => (
      <div data-testid="repere-popover" className={className} {...props}>
        {children}
      </div>
    ),
    {
      Title: ({ children }: any) => (
        <div data-testid="popover-title">{children}</div>
      ),
      Content: ({ children, className }: any) => (
        <div data-testid="popover-content" className={className}>
          {children}
        </div>
      ),
      Footer: ({ children, className }: any) => (
        <div data-testid="popover-footer" className={className}>
          {children}
        </div>
      ),
      AcknowledgeButton: ({ children, onClick, ...props }: any) => (
        <button data-testid="acknowledge-btn" onClick={onClick} {...props}>
          {children}
        </button>
      ),
    },
  ),
  RepereTrigger: ({ children, ...props }: any) => (
    <button data-testid="repere-trigger" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("~/renderer/components", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("react-icons/ti", () => ({
  TiInfoLargeOutline: (props: any) => (
    <span data-testid="info-icon" {...props} />
  ),
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import { trackEvent } from "~/renderer/modules/umami";

import Popover from "./Popover";
import Trigger from "./Trigger";

// ─── Helpers ───────────────────────────────────────────────────────────────

const defaultPopoverProps = {
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

// ─── Popover Tests ─────────────────────────────────────────────────────────

describe("Popover", () => {
  it("renders popover with title", () => {
    renderWithProviders(
      <Popover {...defaultPopoverProps} title="Test Title">
        <p>Content</p>
      </Popover>,
    );

    const titleEl = screen.getByTestId("popover-title");
    expect(titleEl).toBeInTheDocument();
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    renderWithProviders(
      <Popover {...defaultPopoverProps} title="Title" subtitle="A subtitle">
        <p>Content</p>
      </Popover>,
    );

    expect(screen.getByText("A subtitle")).toBeInTheDocument();
  });

  it("does not render subtitle when not provided", () => {
    renderWithProviders(
      <Popover {...defaultPopoverProps} title="Title">
        <p>Content</p>
      </Popover>,
    );

    const content = screen.getByTestId("popover-content");
    expect(
      content.querySelector("p.text-base-content"),
    ).not.toBeInTheDocument();
  });

  it("renders children content with divider", () => {
    renderWithProviders(
      <Popover {...defaultPopoverProps} title="Title">
        <p>Child content here</p>
      </Popover>,
    );

    expect(screen.getByText("Child content here")).toBeInTheDocument();

    const content = screen.getByTestId("popover-content");
    const divider = content.querySelector(".divider");
    expect(divider).toBeInTheDocument();
  });

  it('renders "Got it" acknowledge button', () => {
    renderWithProviders(
      <Popover {...defaultPopoverProps} title="Title">
        <p>Content</p>
      </Popover>,
    );

    const btn = screen.getByTestId("acknowledge-btn");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("Got it");
  });

  it("clicking acknowledge button calls trackEvent with beaconId", async () => {
    const { user } = renderWithProviders(
      <Popover {...defaultPopoverProps} title="Title">
        <p>Content</p>
      </Popover>,
    );

    const btn = screen.getByTestId("acknowledge-btn");
    await user.click(btn);

    expect(trackEvent).toHaveBeenCalledWith("onboarding-step-acknowledged", {
      beaconId: "test-beacon",
    });
  });

  it("applies custom className", () => {
    renderWithProviders(
      <Popover {...defaultPopoverProps} title="Title" className="custom-class">
        <p>Content</p>
      </Popover>,
    );

    const popover = screen.getByTestId("repere-popover");
    expect(popover.className).toContain("custom-class");
  });

  it("passes PopoverComponentProps through to ReperePopover", () => {
    renderWithProviders(
      <Popover {...defaultPopoverProps} title="Title">
        <p>Content</p>
      </Popover>,
    );

    const popover = screen.getByTestId("repere-popover");
    expect(popover).toHaveAttribute("beaconid", "test-beacon");
  });
});

// ─── Trigger Tests ─────────────────────────────────────────────────────────

describe("Trigger", () => {
  it("renders RepereTrigger", () => {
    renderWithProviders(<Trigger />);

    const trigger = screen.getByTestId("repere-trigger");
    expect(trigger).toBeInTheDocument();
  });

  it("renders info icon", () => {
    renderWithProviders(<Trigger />);

    const icon = screen.getByTestId("info-icon");
    expect(icon).toBeInTheDocument();
  });

  it("has correct trigger structure with icon inside trigger button", () => {
    renderWithProviders(<Trigger />);

    const trigger = screen.getByTestId("repere-trigger");
    const icon = screen.getByTestId("info-icon");
    expect(trigger).toContainElement(icon);
  });
});
