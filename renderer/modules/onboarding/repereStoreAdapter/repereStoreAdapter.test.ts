import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: {
    getState: vi.fn(),
  },
}));

import { useBoundStore } from "~/renderer/store";

import { repereStoreAdapter } from "./repereStoreAdapter";

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockGetState = vi.mocked(useBoundStore.getState);

function setupState(overrides: Record<string, any> = {}) {
  const onboarding = {
    isDismissed: vi.fn(),
    dismiss: vi.fn(),
    reset: vi.fn(),
    resetAll: vi.fn(),
    dismissedBeacons: [],
    ...overrides,
  };

  mockGetState.mockReturnValue({ onboarding } as any);

  return onboarding;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("repereStoreAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── isDismissed ────────────────────────────────────────────────────────

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

  // ── dismiss ────────────────────────────────────────────────────────────

  describe("dismiss", () => {
    it("delegates to onboarding.dismiss", () => {
      const onboarding = setupState();

      repereStoreAdapter.dismiss("beacon-1");

      expect(onboarding.dismiss).toHaveBeenCalledWith("beacon-1");
    });
  });

  // ── reset ──────────────────────────────────────────────────────────────

  describe("reset", () => {
    it("delegates to onboarding.reset", () => {
      const onboarding = setupState();

      repereStoreAdapter.reset("beacon-1");

      expect(onboarding.reset).toHaveBeenCalledWith("beacon-1");
    });
  });

  // ── resetAll ───────────────────────────────────────────────────────────

  describe("resetAll", () => {
    it("delegates to onboarding.resetAll", () => {
      const onboarding = setupState();

      repereStoreAdapter.resetAll();

      expect(onboarding.resetAll).toHaveBeenCalled();
    });
  });

  // ── getAll ─────────────────────────────────────────────────────────────

  describe("getAll", () => {
    it("returns dismissed beacons as BeaconState[] objects", () => {
      setupState({
        dismissedBeacons: ["beacon-a", "beacon-b", "beacon-c"],
      });

      const result = repereStoreAdapter.getAll();

      expect(result).toEqual([
        { id: "beacon-a", isDismissed: true },
        { id: "beacon-b", isDismissed: true },
        { id: "beacon-c", isDismissed: true },
      ]);
    });

    it("returns an empty array when no beacons are dismissed", () => {
      setupState({ dismissedBeacons: [] });

      const result = repereStoreAdapter.getAll();

      expect(result).toEqual([]);
    });

    it("returns each beacon with isDismissed set to true", () => {
      setupState({ dismissedBeacons: ["only-one"] });

      const result = repereStoreAdapter.getAll();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: "only-one", isDismissed: true });
    });
  });
});
