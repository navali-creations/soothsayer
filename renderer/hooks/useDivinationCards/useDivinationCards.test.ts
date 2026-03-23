import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDivinationCards } from "./useDivinationCards";

const mockStats = {
  totalCount: 5,
  cards: [
    { name: "The Doctor", count: 2 },
    { name: "Rain of Chaos", count: 3 },
  ],
};

const mockEmptyStats = { totalCount: 0, cards: [] };

const mockLeagues = ["Settlers", "Standard", "Necropolis"];

describe("useDivinationCards", () => {
  beforeEach(() => {
    // The global setup installs a fresh window.electron mock via installElectronMock().
    // Default mocks return sensible defaults (isActive → false, getCurrent → null, etc.).
    // We override per-test as needed.
  });

  // ── 1. Default options ──────────────────────────────────────────────────

  describe("default options", () => {
    it('uses game "poe1" and scope "session" by default', async () => {
      (window.electron as any).session.isActive.mockResolvedValue(false);

      renderHook(() => useDivinationCards());

      await waitFor(() => {
        expect((window.electron as any).session.isActive).toHaveBeenCalledWith(
          "poe1",
        );
      });

      // Should also load leagues for "poe1"
      expect(
        (window.electron as any).dataStore.getLeagues,
      ).toHaveBeenCalledWith("poe1");
    });
  });

  // ── 2. Session scope – active session ───────────────────────────────────

  describe("session scope - active session", () => {
    it("loads data from session.getCurrent when session is active", async () => {
      (window.electron as any).session.isActive.mockResolvedValue(true);
      (window.electron as any).session.getCurrent.mockResolvedValue(mockStats);

      const { result } = renderHook(() =>
        useDivinationCards({ scope: "session" }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect((window.electron as any).session.isActive).toHaveBeenCalledWith(
        "poe1",
      );
      expect((window.electron as any).session.getCurrent).toHaveBeenCalledWith(
        "poe1",
      );
      expect(result.current.stats).toEqual(mockStats);
    });
  });

  // ── 3. Session scope – inactive session ─────────────────────────────────

  describe("session scope - inactive session", () => {
    it("returns empty stats when session is not active", async () => {
      (window.electron as any).session.isActive.mockResolvedValue(false);

      const { result } = renderHook(() =>
        useDivinationCards({ scope: "session" }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(
        (window.electron as any).session.getCurrent,
      ).not.toHaveBeenCalled();
      expect(result.current.stats).toEqual(mockEmptyStats);
    });
  });

  // ── 4. All-time scope ──────────────────────────────────────────────────

  describe("all-time scope", () => {
    it("loads data from dataStore.getAllTime", async () => {
      (window.electron as any).dataStore.getAllTime.mockResolvedValue(
        mockStats,
      );

      const { result } = renderHook(() =>
        useDivinationCards({ scope: "all-time" }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(
        (window.electron as any).dataStore.getAllTime,
      ).toHaveBeenCalledWith("poe1");
      expect(result.current.stats).toEqual(mockStats);
    });
  });

  // ── 5. League scope ────────────────────────────────────────────────────

  describe("league scope", () => {
    it("loads data from dataStore.getLeague with the league parameter", async () => {
      (window.electron as any).dataStore.getLeague.mockResolvedValue(mockStats);

      const { result } = renderHook(() =>
        useDivinationCards({ scope: "league", league: "Settlers" }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect((window.electron as any).dataStore.getLeague).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
      );
      expect(result.current.stats).toEqual(mockStats);
    });
  });

  // ── 6. League scope without league param ────────────────────────────────

  describe("league scope without league param", () => {
    it("does NOT call dataStore.getLeague when no league is provided", async () => {
      const { result } = renderHook(() =>
        useDivinationCards({ scope: "league" }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(
        (window.electron as any).dataStore.getLeague,
      ).not.toHaveBeenCalled();
      // stats should be null since no loading path was triggered
      expect(result.current.stats).toBeNull();
    });
  });

  // ── 7. Loading state ──────────────────────────────────────────────────

  describe("loading state", () => {
    it("starts as true and becomes false after data loads", async () => {
      let resolveIsActive: (value: boolean) => void;
      (window.electron as any).session.isActive.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveIsActive = resolve;
          }),
      );

      const { result } = renderHook(() => useDivinationCards());

      // Initially loading is true
      expect(result.current.loading).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolveIsActive!(false);
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  // ── 8. Error handling ─────────────────────────────────────────────────

  describe("error handling", () => {
    it("sets stats to null on error and sets loading to false", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      (window.electron as any).session.isActive.mockRejectedValue(
        new Error("IPC failed"),
      );

      const { result } = renderHook(() => useDivinationCards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error loading stats:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("sets stats to null when all-time scope errors", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      (window.electron as any).dataStore.getAllTime.mockRejectedValue(
        new Error("DB error"),
      );

      const { result } = renderHook(() =>
        useDivinationCards({ scope: "all-time" }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats).toBeNull();

      consoleSpy.mockRestore();
    });
  });

  // ── 9. Available leagues ──────────────────────────────────────────────

  describe("available leagues", () => {
    it("loads leagues from dataStore.getLeagues", async () => {
      (window.electron as any).session.isActive.mockResolvedValue(false);
      (window.electron as any).dataStore.getLeagues.mockResolvedValue(
        mockLeagues,
      );

      const { result } = renderHook(() => useDivinationCards());

      await waitFor(() => {
        expect(result.current.availableLeagues).toEqual(mockLeagues);
      });

      expect(
        (window.electron as any).dataStore.getLeagues,
      ).toHaveBeenCalledWith("poe1");
    });
  });

  // ── 10. Available leagues error handling ──────────────────────────────

  describe("available leagues error handling", () => {
    it("sets empty array on error", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      (window.electron as any).session.isActive.mockResolvedValue(false);
      (window.electron as any).dataStore.getLeagues.mockRejectedValue(
        new Error("League fetch failed"),
      );

      const { result } = renderHook(() => useDivinationCards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.availableLeagues).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        "Error loading leagues:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  // ── 11. Listener setup ────────────────────────────────────────────────

  describe("listener setup", () => {
    it("calls session.onStateChanged and session.onDataUpdated to register listeners", async () => {
      (window.electron as any).session.isActive.mockResolvedValue(false);

      renderHook(() => useDivinationCards());

      await waitFor(() => {
        expect(
          (window.electron as any).session.onStateChanged,
        ).toHaveBeenCalledTimes(1);
        expect(
          (window.electron as any).session.onDataUpdated,
        ).toHaveBeenCalledTimes(1);
      });

      // The arguments should be functions (handlers)
      expect(
        (window.electron as any).session.onStateChanged,
      ).toHaveBeenCalledWith(expect.any(Function));
      expect(
        (window.electron as any).session.onDataUpdated,
      ).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  // ── 12. Listener cleanup ──────────────────────────────────────────────

  describe("listener cleanup", () => {
    it("calls the unsubscribe functions on unmount", async () => {
      const unsubStateChanged = vi.fn();
      const unsubDataUpdated = vi.fn();

      (window.electron as any).session.isActive.mockResolvedValue(false);
      (window.electron as any).session.onStateChanged.mockReturnValue(
        unsubStateChanged,
      );
      (window.electron as any).session.onDataUpdated.mockReturnValue(
        unsubDataUpdated,
      );

      const { unmount } = renderHook(() => useDivinationCards());

      await waitFor(() => {
        expect(
          (window.electron as any).session.onStateChanged,
        ).toHaveBeenCalled();
      });

      unmount();

      expect(unsubStateChanged).toHaveBeenCalledTimes(1);
      expect(unsubDataUpdated).toHaveBeenCalledTimes(1);
    });
  });

  // ── 13. Session state change ──────────────────────────────────────────

  describe("session state change listener", () => {
    it("reloads stats when the state change listener fires for the matching game", async () => {
      (window.electron as any).session.isActive.mockResolvedValue(false);

      let stateChangeHandler: (data: {
        game: string;
        isActive: boolean;
        sessionInfo: any;
      }) => void;

      (window.electron as any).session.onStateChanged.mockImplementation(
        (handler: any) => {
          stateChangeHandler = handler;
          return vi.fn();
        },
      );

      const { result } = renderHook(() => useDivinationCards({ game: "poe1" }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear call counts to verify reload
      (window.electron as any).session.isActive.mockClear();
      (window.electron as any).session.isActive.mockResolvedValue(true);
      (window.electron as any).session.getCurrent.mockResolvedValue(mockStats);

      // Fire state change for matching game
      await act(async () => {
        stateChangeHandler!({
          game: "poe1",
          isActive: true,
          sessionInfo: null,
        });
      });

      await waitFor(() => {
        expect((window.electron as any).session.isActive).toHaveBeenCalledWith(
          "poe1",
        );
      });
    });

    it("does not reload stats when the state change fires for a different game", async () => {
      (window.electron as any).session.isActive.mockResolvedValue(false);

      let stateChangeHandler: (data: {
        game: string;
        isActive: boolean;
        sessionInfo: any;
      }) => void;

      (window.electron as any).session.onStateChanged.mockImplementation(
        (handler: any) => {
          stateChangeHandler = handler;
          return vi.fn();
        },
      );

      const { result } = renderHook(() => useDivinationCards({ game: "poe1" }));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear call counts
      (window.electron as any).session.isActive.mockClear();

      // Fire state change for different game
      await act(async () => {
        stateChangeHandler!({
          game: "poe2",
          isActive: true,
          sessionInfo: null,
        });
      });

      // isActive should NOT have been called again
      expect((window.electron as any).session.isActive).not.toHaveBeenCalled();
    });
  });

  // ── 14. Session data update ───────────────────────────────────────────

  describe("session data update listener", () => {
    it("updates stats directly when the data update listener fires for the matching game in session scope", async () => {
      (window.electron as any).session.isActive.mockResolvedValue(true);
      (window.electron as any).session.getCurrent.mockResolvedValue(
        mockEmptyStats,
      );

      let dataUpdateHandler: (data: { game: string; data: any }) => void;

      (window.electron as any).session.onDataUpdated.mockImplementation(
        (handler: any) => {
          dataUpdateHandler = handler;
          return vi.fn();
        },
      );

      const { result } = renderHook(() =>
        useDivinationCards({ game: "poe1", scope: "session" }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats).toEqual(mockEmptyStats);

      const updatedStats = {
        totalCount: 10,
        cards: [{ name: "The Nurse", count: 10 }],
      };

      // Fire data update for matching game
      await act(async () => {
        dataUpdateHandler!({ game: "poe1", data: updatedStats });
      });

      expect(result.current.stats).toEqual(updatedStats);
    });

    it("does not update stats when the data update fires for a different game", async () => {
      (window.electron as any).session.isActive.mockResolvedValue(true);
      (window.electron as any).session.getCurrent.mockResolvedValue(mockStats);

      let dataUpdateHandler: (data: { game: string; data: any }) => void;

      (window.electron as any).session.onDataUpdated.mockImplementation(
        (handler: any) => {
          dataUpdateHandler = handler;
          return vi.fn();
        },
      );

      const { result } = renderHook(() =>
        useDivinationCards({ game: "poe1", scope: "session" }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats).toEqual(mockStats);

      const differentGameStats = { totalCount: 99, cards: [] };

      await act(async () => {
        dataUpdateHandler!({ game: "poe2", data: differentGameStats });
      });

      // Stats should remain unchanged
      expect(result.current.stats).toEqual(mockStats);
    });

    it("does not update stats via data update listener when scope is not session", async () => {
      (window.electron as any).dataStore.getAllTime.mockResolvedValue(
        mockStats,
      );

      let dataUpdateHandler: (data: { game: string; data: any }) => void;

      (window.electron as any).session.onDataUpdated.mockImplementation(
        (handler: any) => {
          dataUpdateHandler = handler;
          return vi.fn();
        },
      );

      const { result } = renderHook(() =>
        useDivinationCards({ game: "poe1", scope: "all-time" }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats).toEqual(mockStats);

      const newData = { totalCount: 50, cards: [] };

      await act(async () => {
        dataUpdateHandler!({ game: "poe1", data: newData });
      });

      // Should NOT be updated because scope is "all-time", not "session"
      expect(result.current.stats).toEqual(mockStats);
    });
  });

  // ── 15. Reload function ───────────────────────────────────────────────

  describe("reload function", () => {
    it("re-fetches the data when reload is called", async () => {
      (window.electron as any).session.isActive.mockResolvedValue(true);
      (window.electron as any).session.getCurrent.mockResolvedValue(
        mockEmptyStats,
      );

      const { result } = renderHook(() => useDivinationCards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats).toEqual(mockEmptyStats);

      // Change the mock to return different data
      (window.electron as any).session.getCurrent.mockResolvedValue(mockStats);

      await act(async () => {
        await result.current.reload();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.stats).toEqual(mockStats);
      // isActive should have been called twice: initial load + reload
      expect((window.electron as any).session.isActive).toHaveBeenCalledTimes(
        2,
      );
    });

    it("sets loading to true while reloading", async () => {
      let resolveIsActive: (value: boolean) => void;

      (window.electron as any).session.isActive.mockResolvedValue(false);

      const { result } = renderHook(() => useDivinationCards());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Now make isActive hang so we can observe loading state
      (window.electron as any).session.isActive.mockImplementation(
        () =>
          new Promise<boolean>((resolve) => {
            resolveIsActive = resolve;
          }),
      );

      // Start reload (don't await)
      let reloadPromise: Promise<void>;
      act(() => {
        reloadPromise = result.current.reload();
      });

      // loading should be true now
      expect(result.current.loading).toBe(true);

      // Resolve and finish
      await act(async () => {
        resolveIsActive!(false);
        await reloadPromise;
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  // ── 16. Game parameter ────────────────────────────────────────────────

  describe("game parameter", () => {
    it("passes the correct game to session IPC calls", async () => {
      (window.electron as any).session.isActive.mockResolvedValue(true);
      (window.electron as any).session.getCurrent.mockResolvedValue(mockStats);

      const { result } = renderHook(() =>
        useDivinationCards({ game: "poe2", scope: "session" }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect((window.electron as any).session.isActive).toHaveBeenCalledWith(
        "poe2",
      );
      expect((window.electron as any).session.getCurrent).toHaveBeenCalledWith(
        "poe2",
      );
    });

    it("passes the correct game to dataStore.getAllTime", async () => {
      (window.electron as any).dataStore.getAllTime.mockResolvedValue(
        mockStats,
      );

      const { result } = renderHook(() =>
        useDivinationCards({ game: "poe2", scope: "all-time" }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(
        (window.electron as any).dataStore.getAllTime,
      ).toHaveBeenCalledWith("poe2");
    });

    it("passes the correct game to dataStore.getLeague", async () => {
      (window.electron as any).dataStore.getLeague.mockResolvedValue(mockStats);

      const { result } = renderHook(() =>
        useDivinationCards({
          game: "poe2",
          scope: "league",
          league: "Settlers",
        }),
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect((window.electron as any).dataStore.getLeague).toHaveBeenCalledWith(
        "poe2",
        "Settlers",
      );
    });

    it("passes the correct game to dataStore.getLeagues", async () => {
      (window.electron as any).session.isActive.mockResolvedValue(false);
      (window.electron as any).dataStore.getLeagues.mockResolvedValue(
        mockLeagues,
      );

      const { result } = renderHook(() => useDivinationCards({ game: "poe2" }));

      await waitFor(() => {
        expect(result.current.availableLeagues).toEqual(mockLeagues);
      });

      expect(
        (window.electron as any).dataStore.getLeagues,
      ).toHaveBeenCalledWith("poe2");
    });
  });
});
