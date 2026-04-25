import { beforeEach, describe, expect, it } from "vitest";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";

import { allOnboardingBeaconIds } from "../onboarding-config/onboarding-labels";

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

describe("Onboarding.slice", () => {
  describe("initial state", () => {
    it("has an empty dismissedBeacons array", () => {
      expect(store.getState().onboarding.dismissedBeacons).toEqual([]);
    });

    it("has isLoading set to false", () => {
      expect(store.getState().onboarding.isLoading).toBe(false);
    });

    it("has error set to null", () => {
      expect(store.getState().onboarding.error).toBeNull();
    });

    it("starts with beaconHostRefreshKey at 0", () => {
      expect(store.getState().onboarding.beaconHostRefreshKey).toBe(0);
    });
  });

  describe("hydrate", () => {
    it("sets isLoading to true while hydrating", async () => {
      let resolveGet!: (value: unknown) => void;
      electron.settings.get.mockReturnValue(
        new Promise((resolve) => {
          resolveGet = resolve;
        }),
      );

      const promise = store.getState().onboarding.hydrate();

      expect(store.getState().onboarding.isLoading).toBe(true);

      resolveGet(["beacon-a"]);
      await promise;

      expect(store.getState().onboarding.isLoading).toBe(false);
    });

    it("clears previous error when starting hydrate", async () => {
      electron.settings.get.mockRejectedValueOnce(new Error("first failure"));
      await store.getState().onboarding.hydrate();
      expect(store.getState().onboarding.error).toBe("first failure");

      electron.settings.get.mockResolvedValueOnce([]);
      await store.getState().onboarding.hydrate();
      expect(store.getState().onboarding.error).toBeNull();
    });

    it("hydrates dismissedBeacons from settings when data is an array", async () => {
      electron.settings.get.mockResolvedValueOnce(["beacon-a", "beacon-b"]);

      await store.getState().onboarding.hydrate();

      expect(store.getState().onboarding.dismissedBeacons).toEqual([
        "beacon-a",
        "beacon-b",
      ]);
      expect(store.getState().onboarding.isLoading).toBe(false);
    });

    it("hydrates to empty array when settings returns undefined", async () => {
      electron.settings.get.mockResolvedValueOnce(undefined);

      await store.getState().onboarding.hydrate();

      expect(store.getState().onboarding.dismissedBeacons).toEqual([]);
      expect(store.getState().onboarding.isLoading).toBe(false);
    });

    it("hydrates to empty array when settings returns null", async () => {
      electron.settings.get.mockResolvedValueOnce(null);

      await store.getState().onboarding.hydrate();

      expect(store.getState().onboarding.dismissedBeacons).toEqual([]);
    });

    it("hydrates to empty array when settings returns a non-array value", async () => {
      electron.settings.get.mockResolvedValueOnce("not-an-array");

      await store.getState().onboarding.hydrate();

      expect(store.getState().onboarding.dismissedBeacons).toEqual([]);
    });

    it("calls settings.get with the correct key", async () => {
      electron.settings.get.mockResolvedValueOnce([]);

      await store.getState().onboarding.hydrate();

      expect(electron.settings.get).toHaveBeenCalledWith(
        "onboardingDismissedBeacons",
      );
    });

    it("sets error on hydration failure", async () => {
      electron.settings.get.mockRejectedValueOnce(
        new Error("Settings read failed"),
      );

      await store.getState().onboarding.hydrate();

      expect(store.getState().onboarding.error).toBe("Settings read failed");
      expect(store.getState().onboarding.isLoading).toBe(false);
    });

    it("sets generic error message for non-Error thrown values", async () => {
      electron.settings.get.mockRejectedValueOnce("string-error");

      await store.getState().onboarding.hydrate();

      expect(store.getState().onboarding.error).toBe("Unknown error");
      expect(store.getState().onboarding.isLoading).toBe(false);
    });
  });

  describe("isDismissed", () => {
    it("returns false when no beacons have been dismissed", () => {
      expect(store.getState().onboarding.isDismissed("beacon-a")).toBe(false);
    });

    it("returns true when the beacon is in dismissedBeacons", async () => {
      electron.settings.get.mockResolvedValueOnce(["beacon-a", "beacon-b"]);
      await store.getState().onboarding.hydrate();

      expect(store.getState().onboarding.isDismissed("beacon-a")).toBe(true);
      expect(store.getState().onboarding.isDismissed("beacon-b")).toBe(true);
    });

    it("returns false when the beacon is not in dismissedBeacons", async () => {
      electron.settings.get.mockResolvedValueOnce(["beacon-a"]);
      await store.getState().onboarding.hydrate();

      expect(store.getState().onboarding.isDismissed("beacon-x")).toBe(false);
    });

    it("returns false without throwing when dismissedBeacons is null/undefined", () => {
      store.setState((s) => {
        (
          s.onboarding as never as { dismissedBeacons: string[] | null }
        ).dismissedBeacons = null;
      });

      expect(store.getState().onboarding.isDismissed("beacon-a")).toBe(false);
    });
  });

  describe("dismiss", () => {
    it("adds a new beacon to dismissedBeacons", async () => {
      await store.getState().onboarding.dismiss("beacon-a");

      expect(store.getState().onboarding.dismissedBeacons).toContain(
        "beacon-a",
      );
    });

    it("persists the updated array to settings", async () => {
      await store.getState().onboarding.dismiss("beacon-a");

      expect(electron.settings.set).toHaveBeenCalledWith(
        "onboardingDismissedBeacons",
        ["beacon-a"],
      );
    });

    it("does not add duplicate beacons", async () => {
      await store.getState().onboarding.dismiss("beacon-a");
      await store.getState().onboarding.dismiss("beacon-a");

      expect(store.getState().onboarding.dismissedBeacons).toEqual([
        "beacon-a",
      ]);
      expect(electron.settings.set).toHaveBeenCalledTimes(1);
    });

    it("appends to existing dismissed beacons", async () => {
      await store.getState().onboarding.dismiss("beacon-a");
      await store.getState().onboarding.dismiss("beacon-b");

      expect(store.getState().onboarding.dismissedBeacons).toEqual([
        "beacon-a",
        "beacon-b",
      ]);
    });

    it("persists cumulatively when multiple beacons are dismissed", async () => {
      await store.getState().onboarding.dismiss("beacon-a");
      await store.getState().onboarding.dismiss("beacon-b");

      expect(electron.settings.set).toHaveBeenLastCalledWith(
        "onboardingDismissedBeacons",
        ["beacon-a", "beacon-b"],
      );
    });

    it("sets error if persisting fails", async () => {
      electron.settings.set.mockRejectedValueOnce(new Error("Write failed"));

      await store.getState().onboarding.dismiss("beacon-a");

      expect(store.getState().onboarding.error).toBe("Write failed");
    });

    it("sets generic error message for non-Error thrown values on dismiss failure", async () => {
      electron.settings.set.mockRejectedValueOnce("some-string");

      await store.getState().onboarding.dismiss("beacon-a");

      expect(store.getState().onboarding.error).toBe(
        "Failed to dismiss beacon",
      );
    });
  });

  describe("dismissAll", () => {
    it("sets every known beacon as dismissed and persists them", async () => {
      await store.getState().onboarding.dismissAll();

      expect(store.getState().onboarding.dismissedBeacons).toEqual(
        allOnboardingBeaconIds,
      );
      expect(electron.settings.set).toHaveBeenCalledWith(
        "onboardingDismissedBeacons",
        allOnboardingBeaconIds,
      );
    });

    it("writes the full beacon array in a single settings.set call", async () => {
      await store.getState().onboarding.dismissAll();

      expect(electron.settings.set).toHaveBeenCalledTimes(1);
      expect(electron.settings.set).toHaveBeenLastCalledWith(
        "onboardingDismissedBeacons",
        allOnboardingBeaconIds,
      );
    });

    it("is idempotent when some beacons are already dismissed", async () => {
      store.setState((state) => {
        state.onboarding.dismissedBeacons = [
          allOnboardingBeaconIds[0],
          allOnboardingBeaconIds[0],
          allOnboardingBeaconIds[1],
        ];
      });

      await store.getState().onboarding.dismissAll();

      expect(store.getState().onboarding.dismissedBeacons).toEqual(
        allOnboardingBeaconIds,
      );
      expect(new Set(store.getState().onboarding.dismissedBeacons).size).toBe(
        allOnboardingBeaconIds.length,
      );
    });

    it("sets error and leaves state unchanged when persistence fails", async () => {
      store.setState((state) => {
        state.onboarding.dismissedBeacons = [allOnboardingBeaconIds[0]];
      });
      electron.settings.set.mockRejectedValueOnce(
        new Error("DismissAll write failed"),
      );

      await store.getState().onboarding.dismissAll();

      expect(store.getState().onboarding.error).toBe("DismissAll write failed");
      expect(store.getState().onboarding.dismissedBeacons).toEqual([
        allOnboardingBeaconIds[0],
      ]);
    });

    it("does not persist when all beacons are already dismissed", async () => {
      store.setState((state) => {
        state.onboarding.dismissedBeacons = [...allOnboardingBeaconIds];
      });

      await store.getState().onboarding.dismissAll();

      expect(store.getState().onboarding.dismissedBeacons).toEqual(
        allOnboardingBeaconIds,
      );
      expect(electron.settings.set).not.toHaveBeenCalled();
    });

    it("serializes overlapping dismiss mutations against the latest state", async () => {
      let resolveFirstWrite: (() => void) | undefined;
      electron.settings.set
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              resolveFirstWrite = resolve;
            }),
        )
        .mockResolvedValueOnce(undefined);

      const firstDismiss = store.getState().onboarding.dismiss("beacon-a");
      const secondDismiss = store.getState().onboarding.dismiss("beacon-b");

      await Promise.resolve();
      expect(electron.settings.set).toHaveBeenCalledTimes(1);

      resolveFirstWrite?.();
      await Promise.all([firstDismiss, secondDismiss]);

      expect(electron.settings.set).toHaveBeenNthCalledWith(
        1,
        "onboardingDismissedBeacons",
        ["beacon-a"],
      );
      expect(electron.settings.set).toHaveBeenNthCalledWith(
        2,
        "onboardingDismissedBeacons",
        ["beacon-a", "beacon-b"],
      );
      expect(store.getState().onboarding.dismissedBeacons).toEqual([
        "beacon-a",
        "beacon-b",
      ]);
    });

    it("sets generic error for non-Error thrown values", async () => {
      electron.settings.set.mockRejectedValueOnce("dismiss-all-failed");

      await store.getState().onboarding.dismissAll();

      expect(store.getState().onboarding.error).toBe(
        "Failed to dismiss all beacons",
      );
    });
  });

  describe("reset", () => {
    it("removes a specific beacon from dismissedBeacons", async () => {
      await store.getState().onboarding.dismiss("beacon-a");
      await store.getState().onboarding.dismiss("beacon-b");

      await store.getState().onboarding.reset("beacon-a");

      expect(store.getState().onboarding.dismissedBeacons).toEqual([
        "beacon-b",
      ]);
    });

    it("persists the updated array after reset", async () => {
      await store.getState().onboarding.dismiss("beacon-a");
      await store.getState().onboarding.dismiss("beacon-b");

      await store.getState().onboarding.reset("beacon-a");

      expect(electron.settings.set).toHaveBeenLastCalledWith(
        "onboardingDismissedBeacons",
        ["beacon-b"],
      );
    });

    it("does not persist when resetting a beacon that was not dismissed", async () => {
      await store.getState().onboarding.dismiss("beacon-a");
      electron.settings.set.mockClear();

      await store.getState().onboarding.reset("beacon-nonexistent");

      expect(store.getState().onboarding.dismissedBeacons).toEqual([
        "beacon-a",
      ]);
      expect(electron.settings.set).not.toHaveBeenCalled();
    });

    it("sets error if persisting fails on reset", async () => {
      await store.getState().onboarding.dismiss("beacon-a");

      electron.settings.set.mockRejectedValueOnce(
        new Error("Reset write failed"),
      );

      await store.getState().onboarding.reset("beacon-a");

      expect(store.getState().onboarding.error).toBe("Reset write failed");
    });

    it("sets generic error message for non-Error thrown values on reset failure", async () => {
      await store.getState().onboarding.dismiss("beacon-a");

      electron.settings.set.mockRejectedValueOnce(42);

      await store.getState().onboarding.reset("beacon-a");

      expect(store.getState().onboarding.error).toBe("Failed to reset beacon");
    });
  });

  describe("resetOne", () => {
    it("delegates to reset for a single beacon", async () => {
      await store.getState().onboarding.dismiss(allOnboardingBeaconIds[0]);

      await store.getState().onboarding.resetOne(allOnboardingBeaconIds[0]);

      expect(store.getState().onboarding.dismissedBeacons).toEqual([]);
      expect(electron.settings.set).toHaveBeenLastCalledWith(
        "onboardingDismissedBeacons",
        [],
      );
    });
  });

  describe("resetAll", () => {
    it("clears all dismissed beacons", async () => {
      await store.getState().onboarding.dismiss("beacon-a");
      await store.getState().onboarding.dismiss("beacon-b");
      await store.getState().onboarding.dismiss("beacon-c");

      await store.getState().onboarding.resetAll();

      expect(store.getState().onboarding.dismissedBeacons).toEqual([]);
    });

    it("persists an empty array to settings", async () => {
      await store.getState().onboarding.dismiss("beacon-a");

      await store.getState().onboarding.resetAll();

      expect(electron.settings.set).toHaveBeenLastCalledWith(
        "onboardingDismissedBeacons",
        [],
      );
    });

    it("does not persist when there are no dismissed beacons to reset", async () => {
      await store.getState().onboarding.resetAll();

      expect(store.getState().onboarding.dismissedBeacons).toEqual([]);
      expect(electron.settings.set).not.toHaveBeenCalled();
    });

    it("sets error if persisting fails on resetAll", async () => {
      store.setState((state) => {
        state.onboarding.dismissedBeacons = ["beacon-a"];
      });
      electron.settings.set.mockRejectedValueOnce(
        new Error("ResetAll write failed"),
      );

      await store.getState().onboarding.resetAll();

      expect(store.getState().onboarding.error).toBe("ResetAll write failed");
    });

    it("sets generic error message for non-Error thrown values on resetAll failure", async () => {
      store.setState((state) => {
        state.onboarding.dismissedBeacons = ["beacon-a"];
      });
      electron.settings.set.mockRejectedValueOnce(undefined);

      await store.getState().onboarding.resetAll();

      expect(store.getState().onboarding.error).toBe(
        "Failed to reset all beacons",
      );
    });
  });

  describe("refreshBeaconHost", () => {
    it("increments beaconHostRefreshKey without changing dismissed beacons", () => {
      store.setState((state) => {
        state.onboarding.dismissedBeacons = ["beacon-a"];
      });

      store.getState().onboarding.refreshBeaconHost();

      expect(store.getState().onboarding.beaconHostRefreshKey).toBe(1);
      expect(store.getState().onboarding.dismissedBeacons).toEqual([
        "beacon-a",
      ]);
    });
  });

  describe("getAllBeaconStates", () => {
    it("returns correct structure with mixed dismissed and active beacons", async () => {
      await store.getState().onboarding.dismiss(allOnboardingBeaconIds[0]);
      await store.getState().onboarding.dismiss(allOnboardingBeaconIds[3]);

      expect(store.getState().onboarding.getAllBeaconStates()).toEqual(
        allOnboardingBeaconIds.map((id) => ({
          id,
          dismissed:
            id === allOnboardingBeaconIds[0] ||
            id === allOnboardingBeaconIds[3],
        })),
      );
    });

    it("returns all active when the store is fresh", () => {
      expect(store.getState().onboarding.getAllBeaconStates()).toEqual(
        allOnboardingBeaconIds.map((id) => ({ id, dismissed: false })),
      );
    });

    it("returns all dismissed after dismissAll", async () => {
      await store.getState().onboarding.dismissAll();

      expect(store.getState().onboarding.getAllBeaconStates()).toEqual(
        allOnboardingBeaconIds.map((id) => ({ id, dismissed: true })),
      );
    });
  });

  describe("integration", () => {
    it("hydrate -> dismiss -> reset -> isDismissed flow works end-to-end", async () => {
      electron.settings.get.mockResolvedValueOnce(["beacon-a"]);
      await store.getState().onboarding.hydrate();
      expect(store.getState().onboarding.isDismissed("beacon-a")).toBe(true);

      await store.getState().onboarding.dismiss("beacon-b");
      expect(store.getState().onboarding.isDismissed("beacon-b")).toBe(true);

      await store.getState().onboarding.reset("beacon-a");
      expect(store.getState().onboarding.isDismissed("beacon-a")).toBe(false);
      expect(store.getState().onboarding.isDismissed("beacon-b")).toBe(true);

      await store.getState().onboarding.resetAll();
      expect(store.getState().onboarding.isDismissed("beacon-b")).toBe(false);
      expect(store.getState().onboarding.dismissedBeacons).toEqual([]);
    });

    it("error from one operation does not prevent subsequent operations", async () => {
      electron.settings.set.mockRejectedValueOnce(new Error("fail"));
      await store.getState().onboarding.dismiss("beacon-a");
      expect(store.getState().onboarding.error).toBe("fail");

      electron.settings.set.mockResolvedValueOnce(undefined);
      await store.getState().onboarding.dismiss("beacon-b");
      expect(store.getState().onboarding.dismissedBeacons).toContain(
        "beacon-b",
      );
    });
  });
});
