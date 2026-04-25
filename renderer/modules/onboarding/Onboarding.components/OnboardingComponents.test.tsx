import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

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

import { trackEvent } from "~/renderer/modules/umami";
import { useBoundStore } from "~/renderer/store";

import Popover from "./Popover";
import Trigger from "./Trigger";

const mockUseBoundStore = vi.mocked(useBoundStore);
const mockDismissAll = vi.fn().mockResolvedValue(undefined);
const mockRefreshBeaconHost = vi.fn();

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

function setupStore() {
  mockUseBoundStore.mockImplementation((selector?: any) => {
    const state = {
      onboarding: {
        dismissAll: mockDismissAll,
        refreshBeaconHost: mockRefreshBeaconHost,
      },
    } as any;

    return selector ? selector(state) : state;
  });
  mockUseBoundStore.getState = vi.fn(() => ({
    onboarding: {
      dismissedBeacons: ["overlay-icon"],
    },
  })) as any;
}

describe("Popover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

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

  it('renders "Dismiss All" button', () => {
    renderWithProviders(
      <Popover {...defaultPopoverProps} title="Title">
        <p>Content</p>
      </Popover>,
    );

    expect(
      screen.getByRole("button", { name: /Dismiss All/i }),
    ).toBeInTheDocument();
  });

  it("applies popover-specific styling only to the dismiss-all button", () => {
    renderWithProviders(
      <Popover {...defaultPopoverProps} title="Title">
        <p>Content</p>
      </Popover>,
    );

    expect(screen.getByRole("button", { name: /Dismiss All/i })).toHaveClass(
      "bg-white/10",
      "text-primary-content",
      "hover:bg-white/15",
    );
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

  it("clicking dismiss all refreshes the beacon host and tracks the event", async () => {
    mockUseBoundStore.getState = vi
      .fn()
      .mockReturnValueOnce({
        onboarding: {
          dismissedBeacons: ["overlay-icon"],
        },
      })
      .mockReturnValueOnce({
        onboarding: {
          dismissedBeacons: ["overlay-icon", "game-selector"],
        },
      }) as any;

    const { user } = renderWithProviders(
      <Popover {...defaultPopoverProps} title="Title">
        <p>Content</p>
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: /Dismiss All/i }));

    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockRefreshBeaconHost).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith("onboarding-all-dismissed", {
      source: "popover",
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
