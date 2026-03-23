import { beforeEach, describe, expect, it } from "vitest";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

describe("Onboarding.slice", () => {
  // ─── Initial State ─────────────────────────────────────────────────────

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
  });

  // ─── hydrate() ─────────────────────────────────────────────────────────

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
      // Put the store in an error state first
      electron.settings.get.mockRejectedValueOnce(new Error("first failure"));
      await store.getState().onboarding.hydrate();
      expect(store.getState().onboarding.error).toBe("first failure");

      // Next hydrate should clear error at the start
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

  // ─── isDismissed() ─────────────────────────────────────────────────────

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
  });

  // ─── dismiss() ─────────────────────────────────────────────────────────

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
      // settings.set should only be called once since the second dismiss is skipped
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

  // ─── reset() ───────────────────────────────────────────────────────────

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

    it("is a no-op (but still persists) when resetting a beacon that was not dismissed", async () => {
      await store.getState().onboarding.dismiss("beacon-a");
      electron.settings.set.mockClear();

      await store.getState().onboarding.reset("beacon-nonexistent");

      // The array doesn't change but the operation still persists
      expect(store.getState().onboarding.dismissedBeacons).toEqual([
        "beacon-a",
      ]);
      expect(electron.settings.set).toHaveBeenCalledWith(
        "onboardingDismissedBeacons",
        ["beacon-a"],
      );
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

  // ─── resetAll() ────────────────────────────────────────────────────────

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

    it("works when there are no dismissed beacons", async () => {
      await store.getState().onboarding.resetAll();

      expect(store.getState().onboarding.dismissedBeacons).toEqual([]);
      expect(electron.settings.set).toHaveBeenCalledWith(
        "onboardingDismissedBeacons",
        [],
      );
    });

    it("sets error if persisting fails on resetAll", async () => {
      electron.settings.set.mockRejectedValueOnce(
        new Error("ResetAll write failed"),
      );

      await store.getState().onboarding.resetAll();

      expect(store.getState().onboarding.error).toBe("ResetAll write failed");
    });

    it("sets generic error message for non-Error thrown values on resetAll failure", async () => {
      electron.settings.set.mockRejectedValueOnce(undefined);

      await store.getState().onboarding.resetAll();

      expect(store.getState().onboarding.error).toBe(
        "Failed to reset all beacons",
      );
    });
  });

  // ─── Integration / edge cases ──────────────────────────────────────────

  describe("integration", () => {
    it("hydrate → dismiss → reset → isDismissed flow works end-to-end", async () => {
      // Hydrate with existing data
      electron.settings.get.mockResolvedValueOnce(["beacon-a"]);
      await store.getState().onboarding.hydrate();
      expect(store.getState().onboarding.isDismissed("beacon-a")).toBe(true);

      // Dismiss another beacon
      await store.getState().onboarding.dismiss("beacon-b");
      expect(store.getState().onboarding.isDismissed("beacon-b")).toBe(true);

      // Reset the first one
      await store.getState().onboarding.reset("beacon-a");
      expect(store.getState().onboarding.isDismissed("beacon-a")).toBe(false);
      expect(store.getState().onboarding.isDismissed("beacon-b")).toBe(true);

      // Reset all
      await store.getState().onboarding.resetAll();
      expect(store.getState().onboarding.isDismissed("beacon-b")).toBe(false);
      expect(store.getState().onboarding.dismissedBeacons).toEqual([]);
    });

    it("error from one operation does not prevent subsequent operations", async () => {
      // First dismiss fails
      electron.settings.set.mockRejectedValueOnce(new Error("fail"));
      await store.getState().onboarding.dismiss("beacon-a");
      expect(store.getState().onboarding.error).toBe("fail");

      // Next dismiss succeeds — error might still be set from before,
      // but the operation completes and state updates
      electron.settings.set.mockResolvedValueOnce(undefined);
      await store.getState().onboarding.dismiss("beacon-b");
      expect(store.getState().onboarding.dismissedBeacons).toContain(
        "beacon-b",
      );
    });
  });
});
