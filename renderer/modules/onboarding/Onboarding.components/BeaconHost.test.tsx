import { useRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

vi.mock("~/renderer/store", async () => {
  const actual = await import("~/renderer/store");
  return {
    ...actual,
    useOnboardingState: vi.fn(),
  };
});

vi.mock("@tanstack/react-router", async () => {
  const actual = await import("@tanstack/react-router");
  return {
    ...actual,
    useLocation: vi.fn(),
  };
});

let beaconsMountCount = 0;

vi.mock("@repere/react", async () => {
  const actual = await import("@repere/react");
  return {
    ...actual,
    Beacons: ({
      currentPath,
      enabled,
    }: {
      currentPath: string;
      enabled: boolean;
    }) => {
      const mountIdRef = useRef(++beaconsMountCount);

      return (
        <div
          data-testid="beacon-host"
          data-current-path={currentPath}
          data-enabled={String(enabled)}
          data-mount-id={String(mountIdRef.current)}
        />
      );
    },
  };
});

import { useLocation } from "@tanstack/react-router";

import { useOnboardingState } from "~/renderer/store";

import BeaconHost from "./BeaconHost";

const mockUseLocation = vi.mocked(useLocation);
const mockUseOnboardingState = vi.mocked(useOnboardingState);

describe("BeaconHost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    beaconsMountCount = 0;

    mockUseLocation.mockReturnValue({ pathname: "/" } as ReturnType<
      typeof useLocation
    >);
    mockUseOnboardingState.mockReturnValue({
      dismissedBeacons: [],
      isLoading: false,
      error: null,
      beaconHostRefreshKey: 0,
    });
  });

  it("passes the current route path and enabled flag to Beacons", () => {
    mockUseLocation.mockReturnValue({
      pathname: "/profit-forecast",
    } as ReturnType<typeof useLocation>);

    renderWithProviders(<BeaconHost enabled={false} />);

    expect(screen.getByTestId("beacon-host")).toHaveAttribute(
      "data-current-path",
      "/profit-forecast",
    );
    expect(screen.getByTestId("beacon-host")).toHaveAttribute(
      "data-enabled",
      "false",
    );
  });

  it("remounts Beacons when beaconHostRefreshKey changes", () => {
    const { rerender } = renderWithProviders(<BeaconHost enabled={true} />);

    expect(screen.getByTestId("beacon-host")).toHaveAttribute(
      "data-mount-id",
      "1",
    );

    mockUseOnboardingState.mockReturnValue({
      dismissedBeacons: [],
      isLoading: false,
      error: null,
      beaconHostRefreshKey: 1,
    });

    rerender(<BeaconHost enabled={true} />);

    expect(screen.getByTestId("beacon-host")).toHaveAttribute(
      "data-mount-id",
      "2",
    );
  });
});
