import { act, cleanup, render, screen } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

// ─── Top-level mock fns (referenced inside vi.mock factories) ──────────────

const mockDetectZone = vi.fn();
const mockSetSessionData = vi.fn();

// ─── Default store state ───────────────────────────────────────────────────

function defaultOverlayState(overrides: Record<string, unknown> = {}) {
  return {
    overlay: {
      sessionData: {
        recentDrops: [],
        isActive: false,
        totalCount: 0,
        totalProfit: 0,
        chaosToDivineRatio: 0,
        priceSource: "exchange" as const,
        cards: [],
      },
      setSessionData: mockSetSessionData,
      isLocked: true,
      isLeftHalf: true,
      detectZone: mockDetectZone,
      ...overrides,
    },
  };
}

// ─── Mocks ─────────────────────────────────────────────────────────────────

// Store
vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(() => defaultOverlayState()),
}));

// Stub child components so we don't pull in the full component tree
vi.mock("../Overlay.components", () => ({
  OverlayTabs: () => <div data-testid="overlay-tabs">Tabs</div>,
  OverlaySidebar: () => <div data-testid="overlay-sidebar">Sidebar</div>,
  OverlayContent: () => <div data-testid="overlay-content">Content</div>,
}));

// Audio asset imports (Vite resolves these to URL strings; mock them the same way)
vi.mock("~/renderer/assets/audio/rarity1.mp3", () => ({
  default: "rarity1.mp3",
}));
vi.mock("~/renderer/assets/audio/rarity2.mp3", () => ({
  default: "rarity2.mp3",
}));
vi.mock("~/renderer/assets/audio/rarity3.mp3", () => ({
  default: "rarity3.mp3",
}));

// CSS import (resolved relative to the source file's import `../../index.css`,
// but vi.mock paths resolve relative to the test file)
vi.mock("../../../index.css", () => ({}));

// ─── Imports (must come after vi.mock calls) ───────────────────────────────

import { useBoundStore } from "~/renderer/store";

import OverlayApp from "../Overlay.page";

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Audio mock infrastructure ─────────────────────────────────────────────

let mockPlay: MockInstance;
let mockPause: MockInstance;
let AudioInstances: Array<{ src: string; volume: number; play: MockInstance }>;
let OriginalAudio: typeof Audio;

function installAudioMock() {
  AudioInstances = [];
  mockPlay = vi.fn().mockResolvedValue(undefined);
  mockPause = vi.fn();
  OriginalAudio = globalThis.Audio;

  // Must be a real function (not arrow) so it can be called with `new`
  function MockAudio(this: any, src?: string) {
    this.src = src || "";
    this.volume = 1;
    this.play = mockPlay;
    this.pause = mockPause;
    this.addEventListener = vi.fn();
    this.removeEventListener = vi.fn();
    this.load = vi.fn();
    AudioInstances.push(this);
  }

  globalThis.Audio = MockAudio as any;
}

function removeAudioMock() {
  globalThis.Audio = OriginalAudio;
  AudioInstances = [];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Configure the mock store to return custom overlay state, then render.
 */
function renderWithState(overrides: Record<string, unknown> = {}) {
  mockUseBoundStore.mockReturnValue(defaultOverlayState(overrides));
  return render(<OverlayApp />);
}

/**
 * Access the electron mock installed by the global test setup.
 */
function getElectron() {
  return window.electron as any;
}

/**
 * Configure settings.getAll to return specific settings.
 */
function mockSettings(overrides: Record<string, unknown> = {}) {
  getElectron().settings.getAll.mockResolvedValue({
    audioEnabled: true,
    audioVolume: 0.5,
    audioRarity1Path: null,
    audioRarity2Path: null,
    audioRarity3Path: null,
    selectedGame: "poe1",
    poe1PriceSource: "exchange",
    poe2PriceSource: "exchange",
    overlayFontSize: 1.0,
    overlayToolbarFontSize: 1.0,
    telemetryCrashReporting: false,
    telemetryUsageAnalytics: false,
    ...overrides,
  });
}

/**
 * Render with state and flush all pending microtasks + effects.
 */
async function renderAndSettle(overrides: Record<string, unknown> = {}) {
  mockUseBoundStore.mockReturnValue(defaultOverlayState(overrides));

  let result: ReturnType<typeof render>;
  await act(async () => {
    result = render(<OverlayApp />);
  });

  // Flush any remaining micro-tasks from IPC calls
  await act(async () => {
    await vi.runAllTimersAsync();
  });

  return result!;
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockDetectZone.mockReset();
  mockSetSessionData.mockReset();
  mockUseBoundStore.mockReturnValue(defaultOverlayState());
  mockSettings();
  installAudioMock();
});

afterEach(() => {
  cleanup();
  removeAudioMock();
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("OverlayApp", () => {
  // ── Rendering ──────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders OverlayTabs, OverlaySidebar, and OverlayContent when electron is ready", () => {
      renderWithState();

      expect(screen.getByTestId("overlay-tabs")).toBeInTheDocument();
      expect(screen.getByTestId("overlay-sidebar")).toBeInTheDocument();
      expect(screen.getByTestId("overlay-content")).toBeInTheDocument();
    });

    it("shows drag handle (cursor-grab) when isLocked is false", () => {
      const { container } = renderWithState({ isLocked: false });
      const dragHandle = container.querySelector(".cursor-grab");
      expect(dragHandle).toBeInTheDocument();
    });

    it("does NOT show drag handle when isLocked is true", () => {
      const { container } = renderWithState({ isLocked: true });
      const dragHandle = container.querySelector(".cursor-grab");
      expect(dragHandle).not.toBeInTheDocument();
    });

    it("sidebar appears BEFORE content when isLeftHalf is true", () => {
      renderWithState({ isLeftHalf: true });

      const sidebar = screen.getByTestId("overlay-sidebar");
      const content = screen.getByTestId("overlay-content");

      const parent = sidebar.parentElement!;
      const children = Array.from(parent.children);

      expect(children.indexOf(sidebar)).toBeLessThan(children.indexOf(content));
    });

    it("sidebar appears AFTER content when isLeftHalf is false", () => {
      renderWithState({ isLeftHalf: false });

      const sidebar = screen.getByTestId("overlay-sidebar");
      const content = screen.getByTestId("overlay-content");

      const parent = sidebar.parentElement!;
      const children = Array.from(parent.children);

      expect(children.indexOf(sidebar)).toBeGreaterThan(
        children.indexOf(content),
      );
    });

    it("adds animate-pulse-glow class when unlocked", () => {
      const { container } = renderWithState({ isLocked: false });
      const root = container.firstElementChild as HTMLElement;
      expect(root.classList.contains("animate-pulse-glow")).toBe(true);
    });

    it("does NOT have animate-pulse-glow class when locked", () => {
      const { container } = renderWithState({ isLocked: true });
      const root = container.firstElementChild as HTMLElement;
      expect(root.classList.contains("animate-pulse-glow")).toBe(false);
    });

    it("sets --overlay-font-size CSS custom property", () => {
      const { container } = renderWithState();
      const root = container.firstElementChild as HTMLElement;
      expect(root.style.getPropertyValue("--overlay-font-size")).toBeTruthy();
    });

    it("sets --overlay-toolbar-font-size CSS custom property", () => {
      const { container } = renderWithState();
      const root = container.firstElementChild as HTMLElement;
      expect(
        root.style.getPropertyValue("--overlay-toolbar-font-size"),
      ).toBeTruthy();
    });
  });

  // ── Mount-time effects ─────────────────────────────────────────────────

  describe("mount-time effects", () => {
    it("calls detectZone() on mount", async () => {
      await renderAndSettle();
      expect(mockDetectZone).toHaveBeenCalled();
    });

    it("calls loadAudioSettings (settings.getAll) on mount", async () => {
      await renderAndSettle();
      expect(getElectron().settings.getAll).toHaveBeenCalled();
    });

    it("fetches initial session data via overlay.getSessionData on mount", async () => {
      await renderAndSettle();
      expect(getElectron().overlay.getSessionData).toHaveBeenCalled();
    });

    it("calls setSessionData when getSessionData returns data", async () => {
      const sessionData = {
        isActive: true,
        totalCount: 5,
        totalProfit: 100,
        chaosToDivineRatio: 200,
        priceSource: "exchange",
        cards: [],
        recentDrops: [],
      };
      getElectron().overlay.getSessionData.mockResolvedValue(sessionData);

      await renderAndSettle();

      expect(mockSetSessionData).toHaveBeenCalledWith(sessionData);
    });

    it("does NOT call setSessionData when getSessionData returns null", async () => {
      getElectron().overlay.getSessionData.mockResolvedValue(null);

      await renderAndSettle();

      // setSessionData should only be called from initial data fetch if data is truthy
      // (it may be called from other effects, so we check specifically that it was not
      // called with a null/undefined argument)
      const calls = mockSetSessionData.mock.calls;
      for (const call of calls) {
        expect(call[0]).not.toBeNull();
        expect(call[0]).not.toBeUndefined();
      }
    });
  });

  // ── loadAudioSettings ──────────────────────────────────────────────────

  describe("loadAudioSettings", () => {
    it("reads overlayFontSize from settings", async () => {
      mockSettings({ overlayFontSize: 1.5, overlayToolbarFontSize: 1.2 });

      const { container } = await renderAndSettle();

      const root = container.firstElementChild as HTMLElement;
      expect(root.style.getPropertyValue("--overlay-font-size")).toBe("1.5");
      expect(root.style.getPropertyValue("--overlay-toolbar-font-size")).toBe(
        "1.2",
      );
    });

    it("defaults font sizes to 1.0 when settings don't provide them", async () => {
      mockSettings({
        overlayFontSize: undefined,
        overlayToolbarFontSize: undefined,
      });

      const { container } = await renderAndSettle();

      const root = container.firstElementChild as HTMLElement;
      expect(root.style.getPropertyValue("--overlay-font-size")).toBe("1");
      expect(root.style.getPropertyValue("--overlay-toolbar-font-size")).toBe(
        "1",
      );
    });

    it("reads poe1PriceSource when selectedGame is poe1", async () => {
      mockSettings({
        selectedGame: "poe1",
        poe1PriceSource: "stash",
        poe2PriceSource: "exchange",
      });

      await renderAndSettle();

      // Price source is stored in a ref, so we verify it indirectly through
      // onDataUpdated processing. We just verify settings were loaded.
      expect(getElectron().settings.getAll).toHaveBeenCalled();
    });

    it("reads poe2PriceSource when selectedGame is poe2", async () => {
      mockSettings({
        selectedGame: "poe2",
        poe2PriceSource: "stash",
      });

      await renderAndSettle();

      expect(getElectron().settings.getAll).toHaveBeenCalled();
    });

    it("loads custom sound data when audioRarityPaths are set", async () => {
      mockSettings({
        audioRarity1Path: "/sounds/rarity1.wav",
        audioRarity2Path: "/sounds/rarity2.wav",
        audioRarity3Path: null,
      });
      getElectron().settings.getCustomSoundData.mockResolvedValue(
        "data:audio/wav;base64,abc123",
      );

      await renderAndSettle();

      expect(getElectron().settings.getCustomSoundData).toHaveBeenCalledWith(
        "/sounds/rarity1.wav",
      );
      expect(getElectron().settings.getCustomSoundData).toHaveBeenCalledWith(
        "/sounds/rarity2.wav",
      );
      // Third path is null, so getCustomSoundData should NOT be called for it
      expect(getElectron().settings.getCustomSoundData).toHaveBeenCalledTimes(
        2,
      );
    });

    it("skips custom sound when getCustomSoundData returns null", async () => {
      mockSettings({ audioRarity1Path: "/sounds/bad.wav" });
      getElectron().settings.getCustomSoundData.mockResolvedValue(null);

      await renderAndSettle();

      expect(getElectron().settings.getCustomSoundData).toHaveBeenCalledWith(
        "/sounds/bad.wav",
      );
    });

    it("handles settings.getAll rejection gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      getElectron().settings.getAll.mockRejectedValue(new Error("IPC timeout"));

      await renderAndSettle();

      expect(consoleSpy).toHaveBeenCalledWith(
        "[Overlay] Failed to load audio settings:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });
  });

  // ── Electron readiness polling ─────────────────────────────────────────

  describe("electron readiness polling", () => {
    it("polls for window.electron when it is not ready on initial render", async () => {
      // Temporarily remove electron to simulate a slow preload
      const savedElectron = (window as any).electron;
      delete (window as any).electron;

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await act(async () => {
        render(<OverlayApp />);
      });

      // Should warn that electron is not ready (single string argument)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("window.electron not ready"),
      );

      // Restore electron — the polling setTimeout should detect it
      (window as any).electron = savedElectron;
      mockSettings();

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // After restoring, the component should proceed with setup
      // (detectZone, loadAudioSettings, etc.)
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      consoleSpy.mockRestore();
    });
  });

  // ── IPC listener subscriptions ─────────────────────────────────────────

  describe("IPC listener subscriptions", () => {
    it("subscribes to session.onStateChanged on mount", async () => {
      await renderAndSettle();
      expect(getElectron().session.onStateChanged).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it("subscribes to session.onDataUpdated on mount", async () => {
      await renderAndSettle();
      expect(getElectron().session.onDataUpdated).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it("subscribes to overlay.onSettingsChanged on mount", async () => {
      await renderAndSettle();
      expect(getElectron().overlay.onSettingsChanged).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it("calls unsubscribe functions on unmount", async () => {
      const unsubState = vi.fn();
      const unsubData = vi.fn();
      const unsubSettings = vi.fn();

      getElectron().session.onStateChanged.mockReturnValue(unsubState);
      getElectron().session.onDataUpdated.mockReturnValue(unsubData);
      getElectron().overlay.onSettingsChanged.mockReturnValue(unsubSettings);

      await renderAndSettle();

      // Unmount the component
      cleanup();

      expect(unsubState).toHaveBeenCalled();
      expect(unsubData).toHaveBeenCalled();
      expect(unsubSettings).toHaveBeenCalled();
    });
  });

  // ── onStateChanged handler ─────────────────────────────────────────────

  describe("onStateChanged handler", () => {
    it("fetches fresh session data and reloads audio settings when session starts", async () => {
      let stateChangedCb: (update: { isActive: boolean }) => void = () => {};
      getElectron().session.onStateChanged.mockImplementation((cb: any) => {
        stateChangedCb = cb;
        return vi.fn();
      });

      const freshData = {
        isActive: true,
        totalCount: 10,
        totalProfit: 500,
        chaosToDivineRatio: 200,
        priceSource: "exchange",
        cards: [],
        recentDrops: [],
      };
      getElectron().overlay.getSessionData.mockResolvedValue(freshData);

      await renderAndSettle();

      // Reset call counts so we can assert new calls
      getElectron().settings.getAll.mockClear();
      getElectron().overlay.getSessionData.mockClear();
      mockSetSessionData.mockClear();

      // Simulate session start
      await act(async () => {
        stateChangedCb({ isActive: true });
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should re-load audio settings
      expect(getElectron().settings.getAll).toHaveBeenCalled();
      // Should fetch fresh session data
      expect(getElectron().overlay.getSessionData).toHaveBeenCalled();
    });

    it("sets empty session data when session stops", async () => {
      let stateChangedCb: (update: { isActive: boolean }) => void = () => {};
      getElectron().session.onStateChanged.mockImplementation((cb: any) => {
        stateChangedCb = cb;
        return vi.fn();
      });

      await renderAndSettle();

      mockSetSessionData.mockClear();

      // Simulate session stop
      await act(async () => {
        stateChangedCb({ isActive: false });
      });

      expect(mockSetSessionData).toHaveBeenCalledWith({
        isActive: false,
        totalCount: 0,
        totalProfit: 0,
        chaosToDivineRatio: 0,
        priceSource: "exchange",
        cards: [],
        recentDrops: [],
      });
    });
  });

  // ── onDataUpdated handler ──────────────────────────────────────────────

  describe("onDataUpdated handler", () => {
    it("formats and sets session data from IPC update", async () => {
      let dataUpdatedCb: (update: any) => void = () => {};
      getElectron().session.onDataUpdated.mockImplementation((cb: any) => {
        dataUpdatedCb = cb;
        return vi.fn();
      });

      // Default settings use poe1 + exchange price source
      mockSettings({
        selectedGame: "poe1",
        poe1PriceSource: "exchange",
      });

      await renderAndSettle();
      mockSetSessionData.mockClear();

      const update = {
        data: {
          totalCount: 42,
          totals: {
            exchange: {
              totalValue: 1234,
              chaosToDivineRatio: 200,
            },
          },
          cards: [
            { name: "The Doctor", count: 3 },
            { name: "Rain of Chaos", count: 10 },
          ],
          recentDrops: [
            {
              cardName: "The Doctor",
              rarity: 1,
              exchangePrice: { chaosValue: 800, divineValue: 5 },
              stashPrice: { chaosValue: 750, divineValue: 4.7 },
            },
          ],
        },
      };

      await act(async () => {
        dataUpdatedCb(update);
      });

      expect(mockSetSessionData).toHaveBeenCalledWith({
        isActive: true,
        totalCount: 42,
        totalProfit: 1234,
        chaosToDivineRatio: 200,
        priceSource: "exchange",
        cards: [
          { cardName: "The Doctor", count: 3 },
          { cardName: "Rain of Chaos", count: 10 },
        ],
        recentDrops: [
          {
            cardName: "The Doctor",
            rarity: 1,
            exchangePrice: { chaosValue: 800, divineValue: 5 },
            stashPrice: { chaosValue: 750, divineValue: 4.7 },
          },
        ],
      });
    });

    it("defaults rarity to 4 when rarity is missing from a drop", async () => {
      let dataUpdatedCb: (update: any) => void = () => {};
      getElectron().session.onDataUpdated.mockImplementation((cb: any) => {
        dataUpdatedCb = cb;
        return vi.fn();
      });

      await renderAndSettle();
      mockSetSessionData.mockClear();

      const update = {
        data: {
          totalCount: 1,
          totals: {
            exchange: { totalValue: 10, chaosToDivineRatio: 200 },
          },
          cards: [],
          recentDrops: [
            {
              cardName: "Unknown Card",
              // rarity intentionally omitted
              exchangePrice: { chaosValue: 1, divineValue: 0 },
              stashPrice: { chaosValue: 1, divineValue: 0 },
            },
          ],
        },
      };

      await act(async () => {
        dataUpdatedCb(update);
      });

      const callArg = mockSetSessionData.mock.calls[0][0];
      expect(callArg.recentDrops[0].rarity).toBe(4);
    });

    it("handles empty cards and recentDrops gracefully", async () => {
      let dataUpdatedCb: (update: any) => void = () => {};
      getElectron().session.onDataUpdated.mockImplementation((cb: any) => {
        dataUpdatedCb = cb;
        return vi.fn();
      });

      await renderAndSettle();
      mockSetSessionData.mockClear();

      const update = {
        data: {
          totalCount: 0,
          totals: {
            exchange: { totalValue: 0, chaosToDivineRatio: 0 },
          },
          cards: null, // explicitly null
          recentDrops: null, // explicitly null
        },
      };

      await act(async () => {
        dataUpdatedCb(update);
      });

      const callArg = mockSetSessionData.mock.calls[0][0];
      expect(callArg.cards).toEqual([]);
      expect(callArg.recentDrops).toEqual([]);
    });

    it("does not call setSessionData when update.data is falsy", async () => {
      let dataUpdatedCb: (update: any) => void = () => {};
      getElectron().session.onDataUpdated.mockImplementation((cb: any) => {
        dataUpdatedCb = cb;
        return vi.fn();
      });

      await renderAndSettle();
      mockSetSessionData.mockClear();

      await act(async () => {
        dataUpdatedCb({ data: null });
      });

      expect(mockSetSessionData).not.toHaveBeenCalled();
    });

    it("uses stash price source when configured for poe2", async () => {
      let dataUpdatedCb: (update: any) => void = () => {};
      getElectron().session.onDataUpdated.mockImplementation((cb: any) => {
        dataUpdatedCb = cb;
        return vi.fn();
      });

      mockSettings({
        selectedGame: "poe2",
        poe2PriceSource: "stash",
      });

      await renderAndSettle();
      mockSetSessionData.mockClear();

      const update = {
        data: {
          totalCount: 5,
          totals: {
            stash: { totalValue: 999, chaosToDivineRatio: 180 },
            exchange: { totalValue: 1100, chaosToDivineRatio: 200 },
          },
          cards: [],
          recentDrops: [],
        },
      };

      await act(async () => {
        dataUpdatedCb(update);
      });

      const callArg = mockSetSessionData.mock.calls[0][0];
      expect(callArg.totalProfit).toBe(999);
      expect(callArg.chaosToDivineRatio).toBe(180);
      expect(callArg.priceSource).toBe("stash");
    });

    it("handles missing totals for the price source with fallback to 0", async () => {
      let dataUpdatedCb: (update: any) => void = () => {};
      getElectron().session.onDataUpdated.mockImplementation((cb: any) => {
        dataUpdatedCb = cb;
        return vi.fn();
      });

      await renderAndSettle();
      mockSetSessionData.mockClear();

      const update = {
        data: {
          totalCount: 1,
          totals: {}, // no exchange or stash key
          cards: [],
          recentDrops: [],
        },
      };

      await act(async () => {
        dataUpdatedCb(update);
      });

      const callArg = mockSetSessionData.mock.calls[0][0];
      expect(callArg.totalProfit).toBe(0);
      expect(callArg.chaosToDivineRatio).toBe(0);
    });
  });

  // ── onSettingsChanged handler ──────────────────────────────────────────

  describe("onSettingsChanged handler", () => {
    it("re-loads audio settings and re-fetches session data when settings change", async () => {
      let settingsChangedCb: () => void = () => {};
      getElectron().overlay.onSettingsChanged.mockImplementation((cb: any) => {
        settingsChangedCb = cb;
        return vi.fn();
      });

      const freshData = {
        isActive: true,
        totalCount: 20,
        totalProfit: 1000,
        chaosToDivineRatio: 200,
        priceSource: "exchange",
        cards: [],
        recentDrops: [],
      };
      getElectron().overlay.getSessionData.mockResolvedValue(freshData);

      await renderAndSettle();

      getElectron().settings.getAll.mockClear();
      getElectron().overlay.getSessionData.mockClear();
      mockSetSessionData.mockClear();

      // Simulate settings changed
      await act(async () => {
        settingsChangedCb();
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Should re-load settings
      expect(getElectron().settings.getAll).toHaveBeenCalled();
      // Should re-fetch session data after settings load
      expect(getElectron().overlay.getSessionData).toHaveBeenCalled();
    });
  });

  // ── Audio playback ─────────────────────────────────────────────────────

  describe("audio playback", () => {
    /**
     * Helper: render OverlayApp and then re-render with updated recentDrops
     * to trigger the audio useEffect.
     */
    async function triggerDrop(
      rarity: number,
      cardName = "Test Card",
      audioEnabled = true,
      audioVolume = 0.5,
    ) {
      mockSettings({ audioEnabled, audioVolume });

      // First render with empty drops
      const state = defaultOverlayState();
      mockUseBoundStore.mockReturnValue(state);

      const { rerender } = await act(async () => {
        return render(<OverlayApp />);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Clear any Audio calls from mount
      mockPlay.mockClear();
      AudioInstances = [];

      // Re-render with a new drop to trigger the audio effect
      const stateWithDrop = defaultOverlayState({
        sessionData: {
          recentDrops: [
            {
              cardName,
              rarity,
              exchangePrice: { chaosValue: 100, divineValue: 1 },
              stashPrice: { chaosValue: 90, divineValue: 0.9 },
            },
          ],
          isActive: true,
          totalCount: 1,
          totalProfit: 100,
          chaosToDivineRatio: 200,
          priceSource: "exchange" as const,
          cards: [{ cardName, count: 1 }],
        },
      });
      mockUseBoundStore.mockReturnValue(stateWithDrop);

      await act(async () => {
        rerender(<OverlayApp />);
      });
    }

    it("plays rarity 1 sound when a rarity 1 card drops", async () => {
      await triggerDrop(1, "The Doctor");

      expect(AudioInstances).toHaveLength(1);
      expect(AudioInstances[0].src).toBe("rarity1.mp3");
      expect(mockPlay).toHaveBeenCalledOnce();
    });

    it("plays rarity 2 sound when a rarity 2 card drops", async () => {
      await triggerDrop(2, "The Nurse");

      expect(AudioInstances).toHaveLength(1);
      expect(AudioInstances[0].src).toBe("rarity2.mp3");
      expect(mockPlay).toHaveBeenCalledOnce();
    });

    it("plays rarity 3 sound when a rarity 3 card drops", async () => {
      await triggerDrop(3, "The Gambler");

      expect(AudioInstances).toHaveLength(1);
      expect(AudioInstances[0].src).toBe("rarity3.mp3");
      expect(mockPlay).toHaveBeenCalledOnce();
    });

    it("does NOT play sound for rarity 4 (common) drops", async () => {
      await triggerDrop(4, "Rain of Chaos");

      expect(AudioInstances).toHaveLength(0);
      expect(mockPlay).not.toHaveBeenCalled();
    });

    it("does NOT play sound for rarity 0 (unknown) drops", async () => {
      await triggerDrop(0, "Unknown Card");

      expect(AudioInstances).toHaveLength(0);
      expect(mockPlay).not.toHaveBeenCalled();
    });

    it("does NOT play sound when audio is disabled", async () => {
      await triggerDrop(1, "The Doctor", false);

      expect(AudioInstances).toHaveLength(0);
      expect(mockPlay).not.toHaveBeenCalled();
    });

    it("sets audio volume from settings", async () => {
      await triggerDrop(1, "The Doctor", true, 0.8);

      expect(AudioInstances).toHaveLength(1);
      expect(AudioInstances[0].volume).toBe(0.8);
    });

    it("does not play sound when the same card is still at index 0", async () => {
      mockSettings({ audioEnabled: true, audioVolume: 0.5 });

      const drop = {
        cardName: "The Doctor",
        rarity: 1,
        exchangePrice: { chaosValue: 100, divineValue: 1 },
        stashPrice: { chaosValue: 90, divineValue: 0.9 },
      };

      const stateWithDrop = defaultOverlayState({
        sessionData: {
          recentDrops: [drop],
          isActive: true,
          totalCount: 1,
          totalProfit: 100,
          chaosToDivineRatio: 200,
          priceSource: "exchange" as const,
          cards: [{ cardName: "The Doctor", count: 1 }],
        },
      });
      mockUseBoundStore.mockReturnValue(stateWithDrop);

      const { rerender } = await act(async () => {
        return render(<OverlayApp />);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      mockPlay.mockClear();
      AudioInstances = [];

      // Re-render with the SAME drop at index 0 — should not play again
      await act(async () => {
        rerender(<OverlayApp />);
      });

      expect(AudioInstances).toHaveLength(0);
      expect(mockPlay).not.toHaveBeenCalled();
    });

    it("plays sound when a DIFFERENT card appears at index 0", async () => {
      mockSettings({ audioEnabled: true, audioVolume: 0.5 });

      const firstDrop = {
        cardName: "The Doctor",
        rarity: 1,
        exchangePrice: { chaosValue: 100, divineValue: 1 },
        stashPrice: { chaosValue: 90, divineValue: 0.9 },
      };

      const stateFirst = defaultOverlayState({
        sessionData: {
          recentDrops: [firstDrop],
          isActive: true,
          totalCount: 1,
          totalProfit: 100,
          chaosToDivineRatio: 200,
          priceSource: "exchange" as const,
          cards: [{ cardName: "The Doctor", count: 1 }],
        },
      });
      mockUseBoundStore.mockReturnValue(stateFirst);

      const { rerender } = await act(async () => {
        return render(<OverlayApp />);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      mockPlay.mockClear();
      AudioInstances = [];

      // New drop at index 0
      const secondDrop = {
        cardName: "The Nurse",
        rarity: 2,
        exchangePrice: { chaosValue: 50, divineValue: 0.3 },
        stashPrice: { chaosValue: 45, divineValue: 0.28 },
      };

      const stateSecond = defaultOverlayState({
        sessionData: {
          recentDrops: [secondDrop, firstDrop],
          isActive: true,
          totalCount: 2,
          totalProfit: 200,
          chaosToDivineRatio: 200,
          priceSource: "exchange" as const,
          cards: [
            { cardName: "The Doctor", count: 1 },
            { cardName: "The Nurse", count: 1 },
          ],
        },
      });
      mockUseBoundStore.mockReturnValue(stateSecond);

      await act(async () => {
        rerender(<OverlayApp />);
      });

      expect(AudioInstances).toHaveLength(1);
      expect(AudioInstances[0].src).toBe("rarity2.mp3");
      expect(mockPlay).toHaveBeenCalledOnce();
    });

    it("clears previousDropsRef when recentDrops becomes empty", async () => {
      mockSettings({ audioEnabled: true, audioVolume: 0.5 });

      const drop = {
        cardName: "The Doctor",
        rarity: 1,
        exchangePrice: { chaosValue: 100, divineValue: 1 },
        stashPrice: { chaosValue: 90, divineValue: 0.9 },
      };

      const stateWithDrop = defaultOverlayState({
        sessionData: {
          recentDrops: [drop],
          isActive: true,
          totalCount: 1,
          totalProfit: 100,
          chaosToDivineRatio: 200,
          priceSource: "exchange" as const,
          cards: [{ cardName: "The Doctor", count: 1 }],
        },
      });
      mockUseBoundStore.mockReturnValue(stateWithDrop);

      const { rerender } = await act(async () => {
        return render(<OverlayApp />);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Now clear drops (session stopped)
      const stateEmpty = defaultOverlayState();
      mockUseBoundStore.mockReturnValue(stateEmpty);

      await act(async () => {
        rerender(<OverlayApp />);
      });

      mockPlay.mockClear();
      AudioInstances = [];

      // Re-add the same card — should play sound because previousDrops was cleared
      mockUseBoundStore.mockReturnValue(stateWithDrop);

      await act(async () => {
        rerender(<OverlayApp />);
      });

      expect(AudioInstances).toHaveLength(1);
      expect(AudioInstances[0].src).toBe("rarity1.mp3");
      expect(mockPlay).toHaveBeenCalledOnce();
    });

    it("handles audio.play() rejection gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockPlay.mockRejectedValueOnce(new Error("NotAllowedError"));

      await triggerDrop(1, "The Doctor");

      // The component catches the error, so no unhandled rejection
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "Audio play failed:",
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it("uses custom sound URL when available for a rarity", async () => {
      mockSettings({
        audioEnabled: true,
        audioVolume: 0.5,
        audioRarity1Path: "/custom/rarity1.ogg",
      });
      getElectron().settings.getCustomSoundData.mockResolvedValue(
        "data:audio/ogg;base64,customdata",
      );

      // Render and wait for loadAudioSettings to finish loading custom sounds
      const state = defaultOverlayState();
      mockUseBoundStore.mockReturnValue(state);

      const { rerender } = await act(async () => {
        return render(<OverlayApp />);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      mockPlay.mockClear();
      AudioInstances = [];

      // Trigger a rarity 1 drop
      const stateWithDrop = defaultOverlayState({
        sessionData: {
          recentDrops: [
            {
              cardName: "The Doctor",
              rarity: 1,
              exchangePrice: { chaosValue: 800, divineValue: 5 },
              stashPrice: { chaosValue: 750, divineValue: 4.7 },
            },
          ],
          isActive: true,
          totalCount: 1,
          totalProfit: 800,
          chaosToDivineRatio: 200,
          priceSource: "exchange" as const,
          cards: [{ cardName: "The Doctor", count: 1 }],
        },
      });
      mockUseBoundStore.mockReturnValue(stateWithDrop);

      await act(async () => {
        rerender(<OverlayApp />);
      });

      // Should use the custom data URL instead of the default
      expect(AudioInstances).toHaveLength(1);
      expect(AudioInstances[0].src).toBe("data:audio/ogg;base64,customdata");
      expect(mockPlay).toHaveBeenCalledOnce();
    });
  });
});
