import type { BeaconState, BeaconStore } from "@repere/react";

import { useBoundStore } from "~/renderer/store";

/**
 * BeaconStore adapter that delegates to the Zustand onboarding slice
 */
export const repereStoreAdapter: BeaconStore = {
  isDismissed: (beaconId: string): boolean => {
    return useBoundStore.getState().onboarding.isDismissed(beaconId);
  },

  dismiss: (beaconId: string): void => {
    useBoundStore.getState().onboarding.dismiss(beaconId);
  },

  reset: (beaconId: string): void => {
    useBoundStore.getState().onboarding.reset(beaconId);
  },

  resetAll: (): void => {
    useBoundStore.getState().onboarding.resetAll();
  },

  getAll: (): BeaconState[] => {
    const { onboarding } = useBoundStore.getState();

    if (typeof onboarding.getAllBeaconStates === "function") {
      return onboarding.getAllBeaconStates().map(({ id, dismissed }) => ({
        id,
        isDismissed: dismissed,
      }));
    }

    const dismissedBeacons = onboarding.dismissedBeacons || [];
    return dismissedBeacons.map((id: string) => ({
      id,
      isDismissed: true,
    }));
  },
};
