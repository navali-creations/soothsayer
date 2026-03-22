import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";
import { trackEvent } from "~/renderer/modules/umami";

import type { RecentDrop, SessionData } from "../Overlay.types";

vi.mocked(trackEvent);

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSessionData(overrides: Partial<SessionData> = {}): SessionData {
  return {
    totalCount: 0,
    totalProfit: 0,
    chaosToDivineRatio: 0,
    priceSource: "exchange",
    cards: [],
    recentDrops: [],
    isActive: false,
    ...overrides,
  };
}

function makeDrop(
  overrides: Partial<RecentDrop> & {
    cardName: string;
    rarity: RecentDrop["rarity"];
  },
): RecentDrop {
  return {
    cardName: overrides.cardName,
    rarity: overrides.rarity,
    exchangePrice: overrides.exchangePrice ?? { chaosValue: 0, divineValue: 0 },
    stashPrice: overrides.stashPrice ?? { chaosValue: 0, divineValue: 0 },
  };
}

describe("OverlaySlice", () => {
  // ── Initial State ────────────────────────────────────────────────────────

  describe("initial state", () => {
    it("has isVisible set to false", () => {
      expect(store.getState().overlay.isVisible).toBe(false);
    });

    it("has isLoading set to false", () => {
      expect(store.getState().overlay.isLoading).toBe(false);
    });

    it("has error set to null", () => {
      expect(store.getState().overlay.error).toBeNull();
    });

    it("has correct default sessionData", () => {
      expect(store.getState().overlay.sessionData).toEqual({
        totalCount: 0,
        totalProfit: 0,
        chaosToDivineRatio: 0,
        priceSource: "exchange",
        cards: [],
        recentDrops: [],
        isActive: false,
      });
    });

    it("has activeTab set to 'all'", () => {
      expect(store.getState().overlay.activeTab).toBe("all");
    });

    it("has isLocked set to true", () => {
      expect(store.getState().overlay.isLocked).toBe(true);
    });

    it("has isLeftHalf set to false", () => {
      expect(store.getState().overlay.isLeftHalf).toBe(false);
    });
  });

  // ── hydrate ──────────────────────────────────────────────────────────────

  describe("hydrate", () => {
    it("sets isVisible from IPC result", async () => {
      electron.overlay.isVisible.mockResolvedValue(true);

      await store.getState().overlay.hydrate();

      expect(electron.overlay.isVisible).toHaveBeenCalled();
      expect(store.getState().overlay.isVisible).toBe(true);
    });

    it("defaults isVisible to false when IPC returns undefined", async () => {
      electron.overlay.isVisible.mockResolvedValue(undefined);

      await store.getState().overlay.hydrate();

      expect(store.getState().overlay.isVisible).toBe(false);
    });

    it("handles IPC error gracefully", async () => {
      electron.overlay.isVisible.mockRejectedValue(new Error("IPC error"));

      await store.getState().overlay.hydrate();

      // Should not throw; isVisible stays at default
      expect(store.getState().overlay.isVisible).toBe(false);
    });

    it("calls detectZone during hydration", async () => {
      electron.overlay.isVisible.mockResolvedValue(false);

      // Spy on detectZone by checking if isLeftHalf is computed
      // (detectZone runs as part of hydrate)
      await store.getState().overlay.hydrate();

      // detectZone ran — we just verify it didn't throw.
      // isLeftHalf is determined by window.screenX / screen.width
      expect(typeof store.getState().overlay.isLeftHalf).toBe("boolean");
    });
  });

  // ── show ─────────────────────────────────────────────────────────────────

  describe("show", () => {
    it("calls overlay.show IPC", async () => {
      await store.getState().overlay.show();

      expect(electron.overlay.show).toHaveBeenCalledTimes(1);
    });

    it("sets isVisible to true", async () => {
      await store.getState().overlay.show();

      expect(store.getState().overlay.isVisible).toBe(true);
    });

    it("tracks an analytics event", async () => {
      await store.getState().overlay.show();

      expect(trackEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ isVisible: true }),
      );
    });
  });

  // ── hide ─────────────────────────────────────────────────────────────────

  describe("hide", () => {
    it("calls overlay.hide IPC", async () => {
      // First show, then hide
      await store.getState().overlay.show();
      await store.getState().overlay.hide();

      expect(electron.overlay.hide).toHaveBeenCalledTimes(1);
    });

    it("sets isVisible to false", async () => {
      await store.getState().overlay.show();
      expect(store.getState().overlay.isVisible).toBe(true);

      await store.getState().overlay.hide();

      expect(store.getState().overlay.isVisible).toBe(false);
    });

    it("resets isLocked to true on hide", async () => {
      // Unlock, then hide
      await store.getState().overlay.setLocked(false);
      expect(store.getState().overlay.isLocked).toBe(false);

      await store.getState().overlay.hide();

      expect(store.getState().overlay.isLocked).toBe(true);
    });

    it("tracks an analytics event", async () => {
      await store.getState().overlay.hide();

      expect(trackEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ isVisible: false }),
      );
    });
  });

  // ── toggle ───────────────────────────────────────────────────────────────

  describe("toggle", () => {
    it("calls overlay.toggle IPC then checks isVisible", async () => {
      electron.overlay.isVisible.mockResolvedValue(true);

      await store.getState().overlay.toggle();

      expect(electron.overlay.toggle).toHaveBeenCalledTimes(1);
      expect(electron.overlay.isVisible).toHaveBeenCalled();
      expect(store.getState().overlay.isVisible).toBe(true);
    });

    it("sets isVisible based on IPC isVisible result", async () => {
      electron.overlay.isVisible.mockResolvedValue(false);

      await store.getState().overlay.toggle();

      expect(store.getState().overlay.isVisible).toBe(false);
    });

    it("tracks an analytics event with the resulting visibility", async () => {
      electron.overlay.isVisible.mockResolvedValue(true);

      await store.getState().overlay.toggle();

      expect(trackEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ isVisible: true }),
      );
    });
  });

  // ── setIsVisible ─────────────────────────────────────────────────────────

  describe("setIsVisible", () => {
    it("sets isVisible to true", () => {
      store.getState().overlay.setIsVisible(true);

      expect(store.getState().overlay.isVisible).toBe(true);
    });

    it("sets isVisible to false", () => {
      store.getState().overlay.setIsVisible(true);
      store.getState().overlay.setIsVisible(false);

      expect(store.getState().overlay.isVisible).toBe(false);
    });
  });

  // ── setSessionData ───────────────────────────────────────────────────────

  describe("setSessionData", () => {
    it("replaces sessionData entirely", () => {
      const newData = makeSessionData({
        totalCount: 42,
        totalProfit: 1337,
        isActive: true,
        cards: [{ cardName: "The Doctor", count: 3 }],
      });

      store.getState().overlay.setSessionData(newData);

      expect(store.getState().overlay.sessionData).toEqual(newData);
    });
  });

  // ── setActiveTab ─────────────────────────────────────────────────────────

  describe("setActiveTab", () => {
    it("sets activeTab to 'valuable'", () => {
      store.getState().overlay.setActiveTab("valuable");

      expect(store.getState().overlay.activeTab).toBe("valuable");
    });

    it("sets activeTab back to 'all'", () => {
      store.getState().overlay.setActiveTab("valuable");
      store.getState().overlay.setActiveTab("all");

      expect(store.getState().overlay.activeTab).toBe("all");
    });
  });

  // ── getFilteredDrops ─────────────────────────────────────────────────────

  describe("getFilteredDrops", () => {
    const testDrops: RecentDrop[] = [
      makeDrop({ cardName: "The Doctor", rarity: 1 }), // extremely rare
      makeDrop({ cardName: "Rain of Chaos", rarity: 4 }), // common
      makeDrop({ cardName: "The Nurse", rarity: 2 }), // rare
      makeDrop({ cardName: "The Hermit", rarity: 3 }), // less common
      makeDrop({ cardName: "Unknown Card", rarity: 0 }), // unknown
    ];

    beforeEach(() => {
      store
        .getState()
        .overlay.setSessionData(makeSessionData({ recentDrops: testDrops }));
    });

    it("returns all drops when activeTab is 'all'", () => {
      store.getState().overlay.setActiveTab("all");

      const filtered = store.getState().overlay.getFilteredDrops();

      expect(filtered).toEqual(testDrops);
      expect(filtered).toHaveLength(5);
    });

    it("returns only rarity 1-3 drops when activeTab is 'valuable'", () => {
      store.getState().overlay.setActiveTab("valuable");

      const filtered = store.getState().overlay.getFilteredDrops();

      expect(filtered).toHaveLength(3);
      expect(filtered.map((d) => d.cardName)).toEqual([
        "The Doctor",
        "The Nurse",
        "The Hermit",
      ]);
    });

    it("excludes rarity 0 (unknown) from valuable tab", () => {
      store.getState().overlay.setActiveTab("valuable");

      const filtered = store.getState().overlay.getFilteredDrops();
      const names = filtered.map((d) => d.cardName);

      expect(names).not.toContain("Unknown Card");
    });

    it("excludes rarity 4 (common) from valuable tab", () => {
      store.getState().overlay.setActiveTab("valuable");

      const filtered = store.getState().overlay.getFilteredDrops();
      const names = filtered.map((d) => d.cardName);

      expect(names).not.toContain("Rain of Chaos");
    });

    it("returns empty array when sessionData has no recentDrops", () => {
      store
        .getState()
        .overlay.setSessionData(makeSessionData({ recentDrops: [] }));

      const filtered = store.getState().overlay.getFilteredDrops();

      expect(filtered).toEqual([]);
    });

    it("returns empty array when recentDrops is undefined/null-ish", () => {
      // Simulate sessionData with no recentDrops property
      store.getState().overlay.setSessionData({
        ...makeSessionData(),
        recentDrops: undefined as unknown as RecentDrop[],
      });

      const filtered = store.getState().overlay.getFilteredDrops();

      expect(filtered).toEqual([]);
    });
  });

  // ── setLocked ────────────────────────────────────────────────────────────

  describe("setLocked", () => {
    it("calls overlay.setLocked IPC with the correct argument", async () => {
      await store.getState().overlay.setLocked(false);

      expect(electron.overlay.setLocked).toHaveBeenCalledWith(false);
    });

    it("sets isLocked to false when unlocking", async () => {
      await store.getState().overlay.setLocked(false);

      expect(store.getState().overlay.isLocked).toBe(false);
    });

    it("sets isLocked to true when locking", async () => {
      await store.getState().overlay.setLocked(false);
      await store.getState().overlay.setLocked(true);

      expect(store.getState().overlay.isLocked).toBe(true);
    });

    it("calls detectZone when locking (locked = true)", async () => {
      // detectZone is called when locking. We verify it doesn't throw
      // and that isLeftHalf is recomputed.
      await store.getState().overlay.setLocked(true);

      expect(typeof store.getState().overlay.isLeftHalf).toBe("boolean");
    });
  });

  // ── detectZone ───────────────────────────────────────────────────────────

  describe("detectZone", () => {
    it("sets isLeftHalf to true when overlay center is in the left half of screen", () => {
      // Place window at left edge: screenX=0, outerWidth=250, screen.width=1920
      // Center = 0 + 125 = 125 < 1920/2 = 960 → left half
      Object.defineProperty(window, "screenX", {
        value: 0,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "outerWidth", {
        value: 250,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "screen", {
        value: { width: 1920 },
        writable: true,
        configurable: true,
      });

      store.getState().overlay.detectZone();

      expect(store.getState().overlay.isLeftHalf).toBe(true);
    });

    it("sets isLeftHalf to false when overlay center is in the right half of screen", () => {
      // Place window at right side: screenX=1200, outerWidth=250, screen.width=1920
      // Center = 1200 + 125 = 1325 >= 960 → right half
      Object.defineProperty(window, "screenX", {
        value: 1200,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "outerWidth", {
        value: 250,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "screen", {
        value: { width: 1920 },
        writable: true,
        configurable: true,
      });

      store.getState().overlay.detectZone();

      expect(store.getState().overlay.isLeftHalf).toBe(false);
    });

    it("sets isLeftHalf to false when exactly at the center boundary", () => {
      // Center exactly at midpoint: screenX=835, outerWidth=250, screen.width=1920
      // Center = 835 + 125 = 960 which is NOT < 960 → right half
      Object.defineProperty(window, "screenX", {
        value: 835,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "outerWidth", {
        value: 250,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, "screen", {
        value: { width: 1920 },
        writable: true,
        configurable: true,
      });

      store.getState().overlay.detectZone();

      expect(store.getState().overlay.isLeftHalf).toBe(false);
    });
  });

  // ── startListening ───────────────────────────────────────────────────────

  describe("startListening", () => {
    it("subscribes to onVisibilityChanged", () => {
      store.getState().overlay.startListening();

      expect(electron.overlay.onVisibilityChanged).toHaveBeenCalledTimes(1);
      expect(electron.overlay.onVisibilityChanged).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it("returns an unsubscribe function", () => {
      const cleanup = store.getState().overlay.startListening();

      expect(typeof cleanup).toBe("function");
    });

    it("updates isVisible when the listener fires", () => {
      store.getState().overlay.startListening();

      // Grab the callback that was passed to onVisibilityChanged
      const callback = electron.overlay.onVisibilityChanged.mock.calls[0][0];

      // Simulate main process sending visibility change
      callback(true);
      expect(store.getState().overlay.isVisible).toBe(true);

      callback(false);
      expect(store.getState().overlay.isVisible).toBe(false);
    });

    it("returns a no-op cleanup when onVisibilityChanged is not available", () => {
      // Simulate missing API
      const original = electron.overlay.onVisibilityChanged;
      (electron.overlay as any).onVisibilityChanged = undefined;

      const cleanup = store.getState().overlay.startListening();

      expect(typeof cleanup).toBe("function");
      // Should not throw
      cleanup();

      // Restore
      electron.overlay.onVisibilityChanged = original;
    });
  });
});
