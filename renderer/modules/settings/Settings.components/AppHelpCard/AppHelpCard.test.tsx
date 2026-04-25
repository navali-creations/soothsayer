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

vi.mock("./BeaconManagementList", () => ({
  default: () => <div data-testid="beacon-management-list" />,
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
    } as any;

    return selector ? selector(state) : state;
  });
  mockUseBoundStore.getState = vi.fn(() => ({
    onboarding: {
      dismissedBeacons: ["overlay-icon"],
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

  it('renders "App Tour" section heading', () => {
    renderWithProviders(<AppHelpCard />);

    expect(screen.getByText("App Tour")).toBeInTheDocument();
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

  it("calls window.electron.diagLog.revealLogFile when Open log file is clicked", async () => {
    const { user } = renderWithProviders(<AppHelpCard />);

    const logButton = screen.getByRole("button", { name: /Open log file/i });
    await user.click(logButton);

    expect(window.electron.diagLog.revealLogFile).toHaveBeenCalledTimes(1);
  });
});
