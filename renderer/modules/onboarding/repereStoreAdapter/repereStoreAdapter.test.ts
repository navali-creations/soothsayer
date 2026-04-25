import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  const mock = createStoreMock();
  (mock.useBoundStore as any).getState = vi.fn();
  return mock;
});

import { useBoundStore } from "~/renderer/store";

import { repereStoreAdapter } from "./repereStoreAdapter";

const mockGetState = vi.mocked(useBoundStore.getState);

function setupState(overrides: Record<string, any> = {}) {
  const onboarding = {
    isDismissed: vi.fn(),
    dismiss: vi.fn(),
    reset: vi.fn(),
    resetAll: vi.fn(),
    getAllBeaconStates: vi.fn().mockReturnValue([]),
    dismissedBeacons: [],
    ...overrides,
  };

  mockGetState.mockReturnValue({ onboarding } as any);

  return onboarding;
}

describe("repereStoreAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isDismissed", () => {
    it("delegates to onboarding.isDismissed", () => {
      const onboarding = setupState();
      onboarding.isDismissed.mockReturnValue(true);

      const result = repereStoreAdapter.isDismissed("beacon-1");

      expect(onboarding.isDismissed).toHaveBeenCalledWith("beacon-1");
      expect(result).toBe(true);
    });

    it("returns false when beacon is not dismissed", () => {
      const onboarding = setupState();
      onboarding.isDismissed.mockReturnValue(false);

      const result = repereStoreAdapter.isDismissed("beacon-2");

      expect(onboarding.isDismissed).toHaveBeenCalledWith("beacon-2");
      expect(result).toBe(false);
    });
  });

  describe("dismiss", () => {
    it("delegates to onboarding.dismiss", () => {
      const onboarding = setupState();

      repereStoreAdapter.dismiss("beacon-1");

      expect(onboarding.dismiss).toHaveBeenCalledWith("beacon-1");
    });
  });

  describe("reset", () => {
    it("delegates to onboarding.reset", () => {
      const onboarding = setupState();

      repereStoreAdapter.reset("beacon-1");

      expect(onboarding.reset).toHaveBeenCalledWith("beacon-1");
    });
  });

  describe("resetAll", () => {
    it("delegates to onboarding.resetAll", () => {
      const onboarding = setupState();

      repereStoreAdapter.resetAll();

      expect(onboarding.resetAll).toHaveBeenCalled();
    });
  });

  describe("getAll", () => {
    it("returns all known beacon states when getAllBeaconStates is available", () => {
      const onboarding = setupState({
        getAllBeaconStates: vi.fn().mockReturnValue([
          { id: "beacon-a", dismissed: true },
          { id: "beacon-b", dismissed: false },
        ]),
      });

      const result = repereStoreAdapter.getAll();

      expect(onboarding.getAllBeaconStates).toHaveBeenCalled();
      expect(result).toEqual([
        { id: "beacon-a", isDismissed: true },
        { id: "beacon-b", isDismissed: false },
      ]);
    });

    it("falls back to dismissedBeacons when getAllBeaconStates is missing", () => {
      setupState({
        getAllBeaconStates: undefined,
        dismissedBeacons: ["beacon-a", "beacon-b"],
      });

      const result = repereStoreAdapter.getAll();

      expect(result).toEqual([
        { id: "beacon-a", isDismissed: true },
        { id: "beacon-b", isDismissed: true },
      ]);
    });

    it("returns empty array when no beacons are dismissed in the fallback path", () => {
      setupState({
        getAllBeaconStates: undefined,
        dismissedBeacons: [],
      });

      const result = repereStoreAdapter.getAll();

      expect(result).toEqual([]);
    });

    it("returns empty array when dismissedBeacons is undefined in the fallback path", () => {
      setupState({
        getAllBeaconStates: undefined,
        dismissedBeacons: undefined,
      });

      const result = repereStoreAdapter.getAll();

      expect(result).toEqual([]);
    });
  });
});
