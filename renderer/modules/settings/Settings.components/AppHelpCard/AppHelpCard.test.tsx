import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/modules/onboarding", () => ({
  OnboardingButton: (props: any) => (
    <button data-testid="onboarding-button" {...props} />
  ),
}));

vi.mock("./BeaconManagementList/BeaconManagementList", () => ({
  default: ({ beaconStates, onDismiss, onReset }: any) => (
    <div data-testid="beacon-management-list">
      <button type="button" onClick={() => onDismiss(beaconStates[0].id)}>
        dismiss first beacon
      </button>
      <button type="button" onClick={() => onReset(beaconStates[0].id)}>
        reset first beacon
      </button>
    </div>
  ),
}));

import { trackEvent } from "~/renderer/modules/umami";
import { useBoundStore } from "~/renderer/store";

import AppHelpCard from "./AppHelpCard";

const mockUseBoundStore = vi.mocked(useBoundStore);
const mockDismissAll = vi.fn().mockResolvedValue(undefined);
const mockDismiss = vi.fn();
const mockResetOne = vi.fn();
const mockRefreshBeaconHost = vi.fn();

function setupStore() {
  mockUseBoundStore.mockImplementation((selector?: any) => {
    const state = {
      onboarding: {
        dismissAll: mockDismissAll,
        dismiss: mockDismiss,
        resetOne: mockResetOne,
        refreshBeaconHost: mockRefreshBeaconHost,
        dismissedBeacons: ["overlay-icon"],
      },
      settings: {
        appPerformanceMonitorEnabled: false,
        appPerformanceRetention: "7d",
      },
      appPerformance: {
        captureHistory: [],
        captureHistoryPage: 1,
        captureHistoryPageSize: 5,
        captureHistoryTotal: 0,
        captureHistoryTotalPages: 1,
        captureId: null,
        deletingCaptureId: null,
        deleteCapture: vi.fn().mockResolvedValue(undefined),
        isLoadingHistory: false,
        isSampling: false,
        loadCaptureHistory: vi.fn().mockResolvedValue(undefined),
        setMonitorEnabled: vi.fn().mockResolvedValue(undefined),
        setRetentionPolicy: vi.fn().mockResolvedValue(undefined),
      },
    } as any;

    return selector ? selector(state) : state;
  });
  mockUseBoundStore.getState = vi.fn(() => ({
    onboarding: {
      dismissedBeacons: ["overlay-icon"],
    },
    appPerformance: {
      captureId: null,
    },
  })) as any;
}

describe("AppHelpCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  it('renders "App Help" title', () => {
    renderWithProviders(<AppHelpCard />);

    expect(
      screen.getByRole("heading", { name: /App Help/i }),
    ).toBeInTheDocument();
  });

  it("renders description text about needing help", () => {
    renderWithProviders(<AppHelpCard />);

    expect(
      screen.getByText(/Need help getting started or want a refresher\?/),
    ).toBeInTheDocument();
  });

  it("renders support links above beacon controls", () => {
    renderWithProviders(<AppHelpCard />);

    const discordHeading = screen.getByRole("heading", { name: "Discord" });
    const beaconTitle = screen.getByText("Interactive beacons");

    expect(discordHeading.compareDocumentPosition(beaconTitle)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.getByRole("heading", { name: "GitHub" })).toBeInTheDocument();
  });

  it("renders OnboardingButton", () => {
    renderWithProviders(<AppHelpCard />);

    expect(screen.getByTestId("onboarding-button")).toBeInTheDocument();
  });

  it('renders "Dismiss All Beacons" button', () => {
    renderWithProviders(<AppHelpCard />);

    expect(
      screen.getByRole("button", { name: /Dismiss All Beacons/i }),
    ).toBeInTheDocument();
  });

  it("calls onboarding.dismissAll when Dismiss All Beacons is clicked", async () => {
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

    const { user } = renderWithProviders(<AppHelpCard />);

    await user.click(
      screen.getByRole("button", { name: /Dismiss All Beacons/i }),
    );

    expect(mockDismissAll).toHaveBeenCalledTimes(1);
    expect(mockRefreshBeaconHost).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith("onboarding-all-dismissed", {
      source: "settings",
    });
  });

  it("renders BeaconManagementList", () => {
    renderWithProviders(<AppHelpCard />);

    expect(screen.getByTestId("beacon-management-list")).toBeInTheDocument();
  });

  it("explains what the beacon toggles do", () => {
    renderWithProviders(<AppHelpCard />);

    expect(
      screen.getByText(/Toggle on keeps a beacon visible in the tour/i),
    ).toBeInTheDocument();
  });

  it('renders existing "Reset Tour" button', () => {
    renderWithProviders(<AppHelpCard />);

    expect(screen.getByTestId("onboarding-button")).toBeInTheDocument();
  });

  it("renders Discord and GitHub help links", () => {
    renderWithProviders(<AppHelpCard />);

    expect(screen.getByRole("link", { name: "Open Discord" })).toHaveAttribute(
      "href",
      "https://discord.gg/mrqmPYXHHT",
    );
    expect(screen.getByRole("link", { name: "Open GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/navali-creations/soothsayer",
    );
  });

  it("dismisses and resets individual beacons through the management list", async () => {
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
      })
      .mockReturnValueOnce({
        onboarding: {
          dismissedBeacons: ["overlay-icon", "game-selector"],
        },
      })
      .mockReturnValueOnce({
        onboarding: {
          dismissedBeacons: ["game-selector"],
        },
      }) as any;

    const { user } = renderWithProviders(<AppHelpCard />);

    await user.click(
      screen.getByRole("button", { name: "dismiss first beacon" }),
    );
    await user.click(
      screen.getByRole("button", { name: "reset first beacon" }),
    );

    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(mockResetOne).toHaveBeenCalledTimes(1);
    expect(mockRefreshBeaconHost).toHaveBeenCalledTimes(2);
  });

  it("does not show the dismissed badge when all beacons were already dismissed", async () => {
    mockUseBoundStore.getState = vi.fn(() => ({
      onboarding: {
        dismissedBeacons: ["overlay-icon"],
      },
    })) as any;
    const { user } = renderWithProviders(<AppHelpCard />);

    await user.click(
      screen.getByRole("button", { name: /Dismiss All Beacons/i }),
    );

    expect(trackEvent).not.toHaveBeenCalledWith(
      "onboarding-all-dismissed",
      expect.anything(),
    );
    expect(screen.queryByText("All dismissed")).not.toBeInTheDocument();
  });
});
