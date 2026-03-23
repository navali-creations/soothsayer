import { beforeEach, describe, expect, it } from "vitest";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";
import type { DetailedDivinationCardStats } from "~/types/data-stores";

// ── Fixtures ───────────────────────────────────────────────────────────────

function makeSessionDetail(
  overrides: Partial<DetailedDivinationCardStats> = {},
): DetailedDivinationCardStats {
  return {
    totalCount: 50,
    cards: [
      {
        name: "The Doctor",
        count: 2,
        exchangePrice: {
          chaosValue: 1200,
          divineValue: 8,
          totalValue: 2400,
          hidePrice: false,
        },
        stashPrice: {
          chaosValue: 1100,
          divineValue: 7.3,
          totalValue: 2200,
          hidePrice: false,
        },
      },
      {
        name: "Rain of Chaos",
        count: 30,
        exchangePrice: {
          chaosValue: 1,
          divineValue: 0.007,
          totalValue: 30,
          hidePrice: false,
        },
        stashPrice: {
          chaosValue: 0.8,
          divineValue: 0.005,
          totalValue: 24,
          hidePrice: false,
        },
      },
      {
        name: "The Nurse",
        count: 1,
        exchangePrice: {
          chaosValue: 600,
          divineValue: 4,
          totalValue: 600,
          hidePrice: true,
        },
        stashPrice: {
          chaosValue: 580,
          divineValue: 3.9,
          totalValue: 580,
          hidePrice: false,
        },
      },
    ],
    startedAt: "2024-01-01T00:00:00Z",
    endedAt: "2024-01-01T01:00:00Z",
    league: "Settlers",
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

describe("SessionDetailsSlice", () => {
  // ─── Initial State ───────────────────────────────────────────────────

  describe("initial state", () => {
    it("has correct default values", () => {
      const { sessionDetails } = store.getState();
      expect(sessionDetails.session).toBeNull();
      expect(sessionDetails.isLoading).toBe(false);
      expect(sessionDetails.error).toBeNull();
      expect(sessionDetails.priceSource).toBe("exchange");
    });
  });

  // ─── loadSession ─────────────────────────────────────────────────────

  describe("loadSession", () => {
    it("sets isLoading true then false on success", async () => {
      const detail = makeSessionDetail();
      electron.sessions.getById.mockResolvedValue(detail);

      const promise = store.getState().sessionDetails.loadSession("sess-1");
      expect(store.getState().sessionDetails.isLoading).toBe(true);

      await promise;
      expect(store.getState().sessionDetails.isLoading).toBe(false);
    });

    it("populates session on success", async () => {
      const detail = makeSessionDetail({ totalCount: 99 });
      electron.sessions.getById.mockResolvedValue(detail);

      await store.getState().sessionDetails.loadSession("sess-1");

      const session = store.getState().sessionDetails.session;
      expect(session).not.toBeNull();
      expect(session!.totalCount).toBe(99);
    });

    it("passes sessionId to IPC", async () => {
      electron.sessions.getById.mockResolvedValue(null);

      await store.getState().sessionDetails.loadSession("my-session-id");

      expect(electron.sessions.getById).toHaveBeenCalledWith("my-session-id");
    });

    it("clears error before loading", async () => {
      // First: fail
      electron.sessions.getById.mockRejectedValueOnce(new Error("Fail"));
      await store.getState().sessionDetails.loadSession("bad");
      expect(store.getState().sessionDetails.error).toBe("Fail");

      // Second: succeed
      electron.sessions.getById.mockResolvedValueOnce(makeSessionDetail());
      await store.getState().sessionDetails.loadSession("good");
      expect(store.getState().sessionDetails.error).toBeNull();
    });

    it("sets error on failure", async () => {
      electron.sessions.getById.mockRejectedValue(
        new Error("Session not found"),
      );

      await store.getState().sessionDetails.loadSession("bad-id");

      const { sessionDetails } = store.getState();
      expect(sessionDetails.error).toBe("Session not found");
      expect(sessionDetails.isLoading).toBe(false);
      expect(sessionDetails.session).toBeNull();
    });

    it("sets isLoading false on failure", async () => {
      electron.sessions.getById.mockRejectedValue(new Error("Boom"));

      await store.getState().sessionDetails.loadSession("bad");

      expect(store.getState().sessionDetails.isLoading).toBe(false);
    });
  });

  // ─── clearSession ────────────────────────────────────────────────────

  describe("clearSession", () => {
    it("sets session to null", async () => {
      electron.sessions.getById.mockResolvedValue(makeSessionDetail());
      await store.getState().sessionDetails.loadSession("sess-1");
      expect(store.getState().sessionDetails.session).not.toBeNull();

      store.getState().sessionDetails.clearSession();

      expect(store.getState().sessionDetails.session).toBeNull();
    });

    it("sets error to null", async () => {
      electron.sessions.getById.mockRejectedValue(new Error("Oops"));
      await store.getState().sessionDetails.loadSession("bad");
      expect(store.getState().sessionDetails.error).toBe("Oops");

      store.getState().sessionDetails.clearSession();

      expect(store.getState().sessionDetails.error).toBeNull();
    });

    it("clears both session and error simultaneously", async () => {
      // Load a session first
      electron.sessions.getById.mockResolvedValue(makeSessionDetail());
      await store.getState().sessionDetails.loadSession("sess-1");

      // Manually trigger an error state too (via a failed second load)
      electron.sessions.getById.mockRejectedValueOnce(new Error("Err"));
      await store.getState().sessionDetails.loadSession("bad");

      store.getState().sessionDetails.clearSession();

      expect(store.getState().sessionDetails.session).toBeNull();
      expect(store.getState().sessionDetails.error).toBeNull();
    });
  });

  // ─── setPriceSource ──────────────────────────────────────────────────

  describe("setPriceSource", () => {
    it("sets priceSource to stash", () => {
      store.getState().sessionDetails.setPriceSource("stash");

      expect(store.getState().sessionDetails.priceSource).toBe("stash");
    });

    it("sets priceSource to exchange", () => {
      store.getState().sessionDetails.setPriceSource("stash");
      store.getState().sessionDetails.setPriceSource("exchange");

      expect(store.getState().sessionDetails.priceSource).toBe("exchange");
    });

    it("does not affect other state", () => {
      store.getState().sessionDetails.setPriceSource("stash");

      expect(store.getState().sessionDetails.session).toBeNull();
      expect(store.getState().sessionDetails.isLoading).toBe(false);
      expect(store.getState().sessionDetails.error).toBeNull();
    });
  });

  // ─── toggleCardPriceVisibility ────────────────────────────────────────

  describe("toggleCardPriceVisibility", () => {
    beforeEach(async () => {
      electron.sessions.getById.mockResolvedValue(makeSessionDetail());
      await store.getState().sessionDetails.loadSession("sess-1");
    });

    it("optimistically toggles exchangePrice.hidePrice from false to true", async () => {
      electron.session.updateCardPriceVisibility.mockResolvedValue({
        success: true,
      });

      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Doctor", "exchange");

      const card = store
        .getState()
        .sessionDetails.session!.cards.find((c) => c.name === "The Doctor");
      expect(card!.exchangePrice!.hidePrice).toBe(true);
    });

    it("optimistically toggles stashPrice.hidePrice from false to true", async () => {
      electron.session.updateCardPriceVisibility.mockResolvedValue({
        success: true,
      });

      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("Rain of Chaos", "stash");

      const card = store
        .getState()
        .sessionDetails.session!.cards.find((c) => c.name === "Rain of Chaos");
      expect(card!.stashPrice!.hidePrice).toBe(true);
    });

    it("toggles exchangePrice.hidePrice from true to false", async () => {
      electron.session.updateCardPriceVisibility.mockResolvedValue({
        success: true,
      });

      // The Nurse starts with exchangePrice.hidePrice = true
      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Nurse", "exchange");

      const card = store
        .getState()
        .sessionDetails.session!.cards.find((c) => c.name === "The Nurse");
      expect(card!.exchangePrice!.hidePrice).toBe(false);
    });

    it("reverts optimistic update on backend error", async () => {
      electron.session.updateCardPriceVisibility.mockRejectedValue(
        new Error("Backend failure"),
      );

      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Doctor", "exchange");

      const card = store
        .getState()
        .sessionDetails.session!.cards.find((c) => c.name === "The Doctor");
      // Should revert back to false
      expect(card!.exchangePrice!.hidePrice).toBe(false);
    });

    it("does nothing when session is null", async () => {
      store.getState().sessionDetails.clearSession();

      // Should not throw
      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Doctor", "exchange");

      expect(electron.session.updateCardPriceVisibility).not.toHaveBeenCalled();
    });

    it("does nothing when card is not found in session", async () => {
      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility(
          "Nonexistent Card",
          "exchange",
        );

      expect(electron.session.updateCardPriceVisibility).not.toHaveBeenCalled();
    });

    it("calls backend with correct arguments", async () => {
      electron.session.updateCardPriceVisibility.mockResolvedValue({
        success: true,
      });

      await store
        .getState()
        .sessionDetails.toggleCardPriceVisibility("The Doctor", "exchange");

      expect(electron.session.updateCardPriceVisibility).toHaveBeenCalledWith(
        "poe1", // activeGame from settings
        "2024-01-01T00:00:00Z", // session startedAt
        "exchange",
        "The Doctor",
        true, // toggled from false -> true
      );
    });
  });

  // ─── Getters ─────────────────────────────────────────────────────────

  describe("getters", () => {
    it("getSession returns null when no session loaded", () => {
      expect(store.getState().sessionDetails.getSession()).toBeNull();
    });

    it("getSession returns loaded session", async () => {
      const detail = makeSessionDetail({ totalCount: 77 });
      electron.sessions.getById.mockResolvedValue(detail);
      await store.getState().sessionDetails.loadSession("sess-1");

      const session = store.getState().sessionDetails.getSession();
      expect(session).not.toBeNull();
      expect(session!.totalCount).toBe(77);
    });

    it("getIsLoading returns current loading state", () => {
      expect(store.getState().sessionDetails.getIsLoading()).toBe(false);
    });

    it("getError returns null when no error", () => {
      expect(store.getState().sessionDetails.getError()).toBeNull();
    });

    it("getError returns error message after failure", async () => {
      electron.sessions.getById.mockRejectedValue(new Error("Bad"));
      await store.getState().sessionDetails.loadSession("x");

      expect(store.getState().sessionDetails.getError()).toBe("Bad");
    });

    it("getPriceSource returns current price source", () => {
      expect(store.getState().sessionDetails.getPriceSource()).toBe("exchange");

      store.getState().sessionDetails.setPriceSource("stash");

      expect(store.getState().sessionDetails.getPriceSource()).toBe("stash");
    });
  });
});
