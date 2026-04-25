import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderWithProviders,
  screen,
  within,
} from "~/renderer/__test-setup__/render";
import {
  allOnboardingBeaconIds,
  onboardingBeaconGroups,
} from "~/renderer/modules/onboarding/onboarding-config/onboarding-labels";

import BeaconManagementList from "./BeaconManagementList";

const mockDismiss = vi.fn();
const mockReset = vi.fn();

const beaconStates = allOnboardingBeaconIds.map((id, index) => ({
  id,
  dismissed: index % 2 === 0,
}));

describe("BeaconManagementList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the correct number of groups", () => {
    renderWithProviders(
      <BeaconManagementList
        beaconStates={beaconStates}
        onDismiss={mockDismiss}
        onReset={mockReset}
      />,
    );

    for (const group of onboardingBeaconGroups) {
      expect(
        screen.getByTestId(`beacon-group-${group.pageId}`),
      ).toBeInTheDocument();
    }
  });

  it("renders the correct number of beacons per group", () => {
    renderWithProviders(
      <BeaconManagementList
        beaconStates={beaconStates}
        onDismiss={mockDismiss}
        onReset={mockReset}
      />,
    );

    for (const group of onboardingBeaconGroups) {
      const groupElement = screen.getByTestId(`beacon-group-${group.pageId}`);
      const rows = groupElement.querySelectorAll(
        "[data-testid^='beacon-row-']",
      );
      expect(rows).toHaveLength(group.beacons.length);
    }
  });

  it("shows an unchecked toggle for dismissed beacons", () => {
    renderWithProviders(
      <BeaconManagementList
        beaconStates={beaconStates}
        onDismiss={mockDismiss}
        onReset={mockReset}
      />,
    );

    expect(
      screen.getByRole("checkbox", {
        name: /Show Game selector beacon/i,
      }),
    ).not.toBeChecked();
  });

  it("shows a checked toggle for active beacons", () => {
    renderWithProviders(
      <BeaconManagementList
        beaconStates={beaconStates}
        onDismiss={mockDismiss}
        onReset={mockReset}
      />,
    );

    expect(
      screen.getByRole("checkbox", {
        name: /Dismiss Overlay icon beacon/i,
      }),
    ).toBeChecked();
  });

  it("turning a dismissed beacon on calls onReset with the beacon id", async () => {
    const { user } = renderWithProviders(
      <BeaconManagementList
        beaconStates={beaconStates}
        onDismiss={mockDismiss}
        onReset={mockReset}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", {
        name: /Show Game selector beacon/i,
      }),
    );

    expect(mockReset).toHaveBeenCalledWith("game-selector");
  });

  it("turning an active beacon off calls onDismiss with the beacon id", async () => {
    const { user } = renderWithProviders(
      <BeaconManagementList
        beaconStates={beaconStates}
        onDismiss={mockDismiss}
        onReset={mockReset}
      />,
    );

    await user.click(
      screen.getByRole("checkbox", {
        name: /Dismiss Overlay icon beacon/i,
      }),
    );

    expect(mockDismiss).toHaveBeenCalledWith("overlay-icon");
  });

  it("group header shows the correct dismissed count", () => {
    renderWithProviders(
      <BeaconManagementList
        beaconStates={beaconStates}
        onDismiss={mockDismiss}
        onReset={mockReset}
      />,
    );

    expect(screen.getByText("1 / 2 dismissed")).toBeInTheDocument();
    expect(screen.getByText("2 / 3 dismissed")).toBeInTheDocument();
  });

  it("does not render the raw beacon id under the user-facing label", () => {
    renderWithProviders(
      <BeaconManagementList
        beaconStates={beaconStates}
        onDismiss={mockDismiss}
        onReset={mockReset}
      />,
    );

    const row = screen.getByTestId("beacon-row-game-selector");
    expect(within(row).getByText("Game selector")).toBeInTheDocument();
    expect(within(row).queryByText("game-selector")).not.toBeInTheDocument();
  });
});
