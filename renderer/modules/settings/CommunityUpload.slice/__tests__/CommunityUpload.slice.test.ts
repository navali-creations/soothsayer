import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import {
  type CommunityUploadSlice,
  createCommunityUploadSlice,
} from "../CommunityUpload.slice";

const mockDismissBanner = vi.fn();
const mockMarkDismissed = vi.fn();
const mockHydrateSettings = vi.fn();

// ─── Store factory ─────────────────────────────────────────────────────────
//
// The slice creator expects the full BoundStore type parameters but we only
// test this slice in isolation. Cast through `any` to satisfy the generics.
//
function createTestStore() {
  return create<
    CommunityUploadSlice & {
      banners: {
        dismiss: typeof mockDismissBanner;
        markDismissed: typeof mockMarkDismissed;
      };
      settings: { hydrate: typeof mockHydrateSettings };
    }
  >()(
    devtools(
      immer((...args) => ({
        ...createCommunityUploadSlice(...(args as any)),
        banners: {
          dismiss: mockDismissBanner,
          markDismissed: mockMarkDismissed,
        },
        settings: { hydrate: mockHydrateSettings },
      })),
    ),
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * The renderer test-setup (`renderer/__test-setup__/setup.ts`) installs a
 * fresh `window.electron` mock via `installElectronMock()` in `beforeEach`,
 * but that mock does NOT include `gggAuth`. We patch it in here so the slice
 * can call `window.electron.gggAuth.*` without blowing up.
 *
 * We return the mock fns so individual tests can configure return values.
 */
function installGggAuthMock() {
  const mockGetAuthStatus = vi.fn();
  const mockAuthenticate = vi.fn();
  const mockLogout = vi.fn();
  const mockOnAuthStatusChanged = vi.fn().mockReturnValue(vi.fn());
  const mockGetBackfillLeagues = vi.fn();
  const mockTriggerBackfill = vi.fn();
  const mockGetDropContextUploadStatus = vi.fn();
  const mockGetDropContextConsent = vi
    .fn()
    .mockResolvedValue({ success: true, consent: null });
  const mockSetDropContextConsent = vi.fn();
  const mockOnDropContextUploadStatusChanged = vi.fn().mockReturnValue(vi.fn());

  // The setup file assigns `window.electron` in its own beforeEach which
  // runs before ours. We simply bolt gggAuth onto whatever object is there.
  (window as any).electron = {
    ...((window as any).electron ?? {}),
    gggAuth: {
      getAuthStatus: mockGetAuthStatus,
      authenticate: mockAuthenticate,
      logout: mockLogout,
      onAuthStatusChanged: mockOnAuthStatusChanged,
    },
    communityUpload: {
      getDropContextConsent: mockGetDropContextConsent,
      setDropContextConsent: mockSetDropContextConsent,
      getBackfillLeagues: mockGetBackfillLeagues,
      getDropContextUploadStatus: mockGetDropContextUploadStatus,
      triggerBackfill: mockTriggerBackfill,
      onDropContextUploadStatusChanged: mockOnDropContextUploadStatusChanged,
    },
  };

  return {
    mockGetAuthStatus,
    mockAuthenticate,
    mockLogout,
    mockOnAuthStatusChanged,
    mockGetBackfillLeagues,
    mockTriggerBackfill,
    mockGetDropContextUploadStatus,
    mockGetDropContextConsent,
    mockSetDropContextConsent,
    mockOnDropContextUploadStatusChanged,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CommunityUploadSlice", () => {
  let store: ReturnType<typeof createTestStore>;
  let mockGetAuthStatus: ReturnType<typeof vi.fn>;
  let mockAuthenticate: ReturnType<typeof vi.fn>;
  let mockLogout: ReturnType<typeof vi.fn>;
  let mockOnAuthStatusChanged: ReturnType<typeof vi.fn>;
  let mockGetBackfillLeagues: ReturnType<typeof vi.fn>;
  let mockTriggerBackfill: ReturnType<typeof vi.fn>;
  let mockGetDropContextUploadStatus: ReturnType<typeof vi.fn>;
  let mockGetDropContextConsent: ReturnType<typeof vi.fn>;
  let mockSetDropContextConsent: ReturnType<typeof vi.fn>;
  let mockOnDropContextUploadStatusChanged: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDismissBanner.mockResolvedValue(true);
    const mocks = installGggAuthMock();
    mockGetAuthStatus = mocks.mockGetAuthStatus;
    mockAuthenticate = mocks.mockAuthenticate;
    mockLogout = mocks.mockLogout;
    mockOnAuthStatusChanged = mocks.mockOnAuthStatusChanged;
    mockGetBackfillLeagues = mocks.mockGetBackfillLeagues;
    mockTriggerBackfill = mocks.mockTriggerBackfill;
    mockGetDropContextUploadStatus = mocks.mockGetDropContextUploadStatus;
    mockGetDropContextConsent = mocks.mockGetDropContextConsent;
    mockSetDropContextConsent = mocks.mockSetDropContextConsent;
    mockOnDropContextUploadStatusChanged =
      mocks.mockOnDropContextUploadStatusChanged;
    store = createTestStore();
  });

  // ── Helper: put the store into an "authenticated" state ────────────

  describe("opening-time consent", () => {
    it.each([null, false, true])(
      "loads explicit choice %j",
      async (consent) => {
        mockGetDropContextConsent.mockResolvedValue({ success: true, consent });
        await store.getState().communityUpload.fetchDropContextConsent();
        expect(store.getState().communityUpload).toMatchObject({
          dropContextConsent: consent,
          dropContextConsentLoaded: true,
          isLoadingDropContextConsent: false,
        });
      },
    );

    it("allows retry after a load failure", async () => {
      mockGetDropContextConsent.mockRejectedValueOnce(new Error("offline"));
      await store.getState().communityUpload.fetchDropContextConsent();
      expect(store.getState().communityUpload.dropContextConsentLoaded).toBe(
        false,
      );
      expect(store.getState().communityUpload.dropContextConsent).toBeNull();
      expect(
        store.getState().communityUpload.dropContextConsentError,
      ).toContain("could not be loaded");
      await store.getState().communityUpload.fetchDropContextConsent();
      expect(store.getState().communityUpload.dropContextConsentLoaded).toBe(
        true,
      );
    });

    it.each([true, false])("saves explicit choice %j", async (enabled) => {
      mockSetDropContextConsent.mockResolvedValue({
        success: true,
        consent: enabled,
      });
      mockGetDropContextUploadStatus.mockResolvedValue({
        success: true,
        status: { pendingEvents: 0, isUploading: false, revision: 1 },
      });
      await expect(
        store.getState().communityUpload.setDropContextConsent(enabled),
      ).resolves.toBe(true);
      expect(mockSetDropContextConsent).toHaveBeenCalledWith(enabled);
      expect(store.getState().communityUpload.dropContextConsent).toBe(enabled);
      expect(store.getState().communityUpload.isSavingDropContextConsent).toBe(
        false,
      );
    });

    it("keeps sharing off and shows an error when saving fails", async () => {
      mockSetDropContextConsent.mockResolvedValue({
        success: false,
        error: "storage failed",
      });
      await expect(
        store.getState().communityUpload.setDropContextConsent(true),
      ).resolves.toBe(false);
      expect(store.getState().communityUpload.dropContextConsent).toBeNull();
      expect(
        store.getState().communityUpload.dropContextConsentError,
      ).toContain("could not be saved");
    });

    it("retains the saved choice if withdrawing consent fails", async () => {
      store.setState((state) => {
        state.communityUpload.dropContextConsent = true;
      });
      mockSetDropContextConsent.mockRejectedValue(new Error("storage failed"));
      await expect(
        store.getState().communityUpload.setDropContextConsent(false),
      ).resolves.toBe(false);
      expect(store.getState().communityUpload.dropContextConsent).toBe(true);
      expect(store.getState().communityUpload.isSavingDropContextConsent).toBe(
        false,
      );
    });

    it("prevents overlapping consent writes", async () => {
      let finish!: (result: { success: true; consent: boolean }) => void;
      mockSetDropContextConsent.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      mockGetDropContextUploadStatus.mockResolvedValue({
        success: true,
        status: { pendingEvents: 0, isUploading: false, revision: 1 },
      });
      const pending = store
        .getState()
        .communityUpload.setDropContextConsent(true);
      expect(store.getState().communityUpload.isSavingDropContextConsent).toBe(
        true,
      );
      await expect(
        store.getState().communityUpload.setDropContextConsent(false),
      ).resolves.toBe(false);
      expect(mockSetDropContextConsent).toHaveBeenCalledTimes(1);
      finish({ success: true, consent: true });
      await pending;
      expect(store.getState().communityUpload.dropContextConsent).toBe(true);
    });
  });

  async function authenticateStore() {
    mockAuthenticate.mockResolvedValue({
      success: true,
      username: "User",
      accountId: "id-1",
    });
    await store.getState().communityUpload.authenticate();

    // Sanity check
    expect(store.getState().communityUpload.gggAuthenticated).toBe(true);
    expect(store.getState().communityUpload.gggUsername).toBe("User");
    expect(store.getState().communityUpload.gggAccountId).toBe("id-1");
  }

  // ── Initial state ──────────────────────────────────────────────────

  describe("initial state", () => {
    it("should have correct default values", () => {
      const { communityUpload } = store.getState();
      expect(communityUpload.gggAuthenticated).toBe(false);
      expect(communityUpload.gggUsername).toBeNull();
      expect(communityUpload.gggAccountId).toBeNull();
      expect(communityUpload.isAuthenticating).toBe(false);
      expect(communityUpload.isLoadingStatus).toBe(false);
      expect(communityUpload.authError).toBeNull();
      expect(communityUpload.backfillLeagues).toEqual([]);
      expect(communityUpload.isBackfilling).toBe(false);
      expect(communityUpload.backfillError).toBeNull();
      expect(communityUpload.dropContextUploadStatus).toEqual({
        pendingEvents: 0,
        isUploading: false,
        revision: -1,
      });
    });
  });

  describe("drop-context upload status", () => {
    it("loads account warnings and clears them with a newer successful status", async () => {
      mockGetDropContextUploadStatus.mockResolvedValue({
        success: true,
        status: {
          pendingEvents: 0,
          isUploading: false,
          revision: 1,
          uploadWarning: "verification-required",
        },
      });
      await store.getState().communityUpload.refreshDropContextUploadStatus();
      expect(
        store.getState().communityUpload.dropContextUploadStatus.uploadWarning,
      ).toBe("verification-required");
      mockGetDropContextUploadStatus.mockResolvedValue({
        success: true,
        status: { pendingEvents: 0, isUploading: false, revision: 2 },
      });
      await store.getState().communityUpload.refreshDropContextUploadStatus();
      expect(
        store.getState().communityUpload.dropContextUploadStatus.uploadWarning,
      ).toBeUndefined();
    });

    it("loads the current status", async () => {
      mockGetDropContextUploadStatus.mockResolvedValue({
        success: true,
        status: {
          pendingEvents: 4_500,
          isUploading: true,
          revision: 3,
        },
      });

      await store.getState().communityUpload.refreshDropContextUploadStatus();

      expect(store.getState().communityUpload.dropContextUploadStatus).toEqual({
        pendingEvents: 4_500,
        isUploading: true,
        revision: 3,
      });
    });

    it("does not overwrite a newer event with a stale refresh", async () => {
      store.setState((state) => {
        state.communityUpload.dropContextUploadStatus = {
          pendingEvents: 4_000,
          isUploading: true,
          revision: 4,
        };
      });
      mockGetDropContextUploadStatus.mockResolvedValue({
        success: true,
        status: {
          pendingEvents: 4_500,
          isUploading: true,
          revision: 3,
        },
      });

      await store.getState().communityUpload.refreshDropContextUploadStatus();

      expect(store.getState().communityUpload.dropContextUploadStatus).toEqual({
        pendingEvents: 4_000,
        isUploading: true,
        revision: 4,
      });
    });

    it("logs rejected and failed refreshes without clearing status", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockGetDropContextUploadStatus
        .mockResolvedValueOnce({ success: false, error: "unavailable" })
        .mockRejectedValueOnce(new Error("IPC unavailable"));

      await store.getState().communityUpload.refreshDropContextUploadStatus();
      await store.getState().communityUpload.refreshDropContextUploadStatus();

      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(store.getState().communityUpload.dropContextUploadStatus).toEqual({
        pendingEvents: 0,
        isUploading: false,
        revision: -1,
      });
      consoleSpy.mockRestore();
    });

    it("subscribes to newer status events and returns the cleanup", async () => {
      const unsubscribe = vi.fn();
      let listener:
        | ((status: {
            pendingEvents: number;
            isUploading: boolean;
            revision: number;
          }) => void)
        | undefined;
      mockOnDropContextUploadStatusChanged.mockImplementation((callback) => {
        listener = callback;
        return unsubscribe;
      });
      mockGetDropContextUploadStatus.mockResolvedValue({
        success: true,
        status: {
          pendingEvents: 5_000,
          isUploading: true,
          revision: 1,
        },
      });

      const cleanup = store.getState().communityUpload.startListening();
      listener?.({
        pendingEvents: 4_500,
        isUploading: true,
        revision: 2,
      });
      listener?.({
        pendingEvents: 5_000,
        isUploading: true,
        revision: 1,
      });
      await vi.waitFor(() => {
        expect(mockGetDropContextUploadStatus).toHaveBeenCalledTimes(1);
      });

      expect(store.getState().communityUpload.dropContextUploadStatus).toEqual({
        pendingEvents: 4_500,
        isUploading: true,
        revision: 2,
      });
      cleanup();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  // ── fetchStatus ────────────────────────────────────────────────────

  describe("fetchStatus", () => {
    it("refreshes verification after background credential loss and ignores an older response", async () => {
      await authenticateStore();
      let finishOld!: (value: unknown) => void;
      mockGetAuthStatus.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          }),
      );
      const oldRead = store.getState().communityUpload.fetchStatus();
      let onChange!: () => void;
      const unsubscribeAuth = vi.fn();
      mockOnAuthStatusChanged.mockImplementation((callback) => {
        onChange = callback;
        return unsubscribeAuth;
      });
      mockGetDropContextUploadStatus.mockResolvedValue({
        success: true,
        status: { pendingEvents: 0, isUploading: false, revision: 1 },
      });
      const stop = store.getState().communityUpload.startListening();
      mockGetAuthStatus.mockResolvedValue({
        authenticated: false,
        username: null,
        accountId: null,
      });
      onChange();
      await vi.waitFor(() =>
        expect(store.getState().communityUpload.gggAuthenticated).toBe(false),
      );
      finishOld({
        authenticated: true,
        username: "Old account",
        accountId: "old-id",
      });
      await oldRead;
      expect(store.getState().communityUpload).toMatchObject({
        gggAuthenticated: false,
        gggUsername: null,
        gggAccountId: null,
        isLoadingStatus: false,
      });
      stop();
      expect(unsubscribeAuth).toHaveBeenCalledOnce();
    });

    it("should set isLoadingStatus to true at start", async () => {
      let resolve!: (value: any) => void;
      mockGetAuthStatus.mockReturnValue(
        new Promise((r) => {
          resolve = r;
        }),
      );

      const promise = store.getState().communityUpload.fetchStatus();

      // Mid-flight — the first `set` should have run synchronously
      expect(store.getState().communityUpload.isLoadingStatus).toBe(true);

      resolve({ authenticated: false, username: null, accountId: null });
      await promise;
    });

    it("should set auth state from IPC response on success", async () => {
      mockGetAuthStatus.mockResolvedValue({
        authenticated: true,
        username: "TestUser",
        accountId: "acc-123",
      });

      await store.getState().communityUpload.fetchStatus();

      const { communityUpload } = store.getState();
      expect(communityUpload.gggAuthenticated).toBe(true);
      expect(communityUpload.gggUsername).toBe("TestUser");
      expect(communityUpload.gggAccountId).toBe("acc-123");
    });

    it("should reset isLoadingStatus to false on success", async () => {
      mockGetAuthStatus.mockResolvedValue({
        authenticated: true,
        username: "TestUser",
        accountId: "acc-123",
      });

      await store.getState().communityUpload.fetchStatus();

      expect(store.getState().communityUpload.isLoadingStatus).toBe(false);
    });

    it("should reset isLoadingStatus to false on error", async () => {
      mockGetAuthStatus.mockRejectedValue(new Error("network error"));

      await store.getState().communityUpload.fetchStatus();

      expect(store.getState().communityUpload.isLoadingStatus).toBe(false);
    });

    it("should not change auth state on error", async () => {
      mockGetAuthStatus.mockRejectedValue(new Error("network error"));

      await store.getState().communityUpload.fetchStatus();

      const { communityUpload } = store.getState();
      expect(communityUpload.gggAuthenticated).toBe(false);
      expect(communityUpload.gggUsername).toBeNull();
      expect(communityUpload.gggAccountId).toBeNull();
    });

    it("should handle response with authenticated=false", async () => {
      mockGetAuthStatus.mockResolvedValue({
        authenticated: false,
        username: null,
        accountId: null,
      });

      await store.getState().communityUpload.fetchStatus();

      const { communityUpload } = store.getState();
      expect(communityUpload.gggAuthenticated).toBe(false);
      expect(communityUpload.gggUsername).toBeNull();
      expect(communityUpload.gggAccountId).toBeNull();
    });
  });

  // ── authenticate ───────────────────────────────────────────────────

  describe("authenticate", () => {
    it("should set isAuthenticating to true and clear authError at start", async () => {
      let resolve!: (value: any) => void;
      mockAuthenticate.mockReturnValue(
        new Promise((r) => {
          resolve = r;
        }),
      );

      const promise = store.getState().communityUpload.authenticate();

      expect(store.getState().communityUpload.isAuthenticating).toBe(true);
      expect(store.getState().communityUpload.authError).toBeNull();

      resolve({ success: true, username: "U", accountId: "a" });
      await promise;
    });

    it("should set authenticated state on success (result.success=true)", async () => {
      mockAuthenticate.mockResolvedValue({
        success: true,
        username: "Wraeclast",
        accountId: "acc-42",
      });

      await store.getState().communityUpload.authenticate();

      const { communityUpload } = store.getState();
      expect(communityUpload.gggAuthenticated).toBe(true);
      expect(communityUpload.isAuthenticating).toBe(false);
    });

    it("should set gggUsername and gggAccountId from result", async () => {
      mockAuthenticate.mockResolvedValue({
        success: true,
        username: "Ziz",
        accountId: "ggg-999",
      });

      await store.getState().communityUpload.authenticate();

      const { communityUpload } = store.getState();
      expect(communityUpload.gggUsername).toBe("Ziz");
      expect(communityUpload.gggAccountId).toBe("ggg-999");
    });

    it("should set authError on failure (result.success=false)", async () => {
      mockAuthenticate.mockResolvedValue({
        success: false,
        error: "Invalid credentials",
      });

      await store.getState().communityUpload.authenticate();

      expect(store.getState().communityUpload.authError).toBe(
        "Invalid credentials",
      );
    });

    it("should use default error message when result.error is undefined", async () => {
      mockAuthenticate.mockResolvedValue({
        success: false,
      });

      await store.getState().communityUpload.authenticate();

      expect(store.getState().communityUpload.authError).toBe(
        "Authentication failed",
      );
    });

    it("should set authError from Error.message on exception", async () => {
      mockAuthenticate.mockRejectedValue(new Error("Connection refused"));

      await store.getState().communityUpload.authenticate();

      expect(store.getState().communityUpload.authError).toBe(
        "Connection refused",
      );
    });

    it("should set authError to default message on non-Error exception", async () => {
      mockAuthenticate.mockRejectedValue("some string error");

      await store.getState().communityUpload.authenticate();

      expect(store.getState().communityUpload.authError).toBe(
        "Authentication failed",
      );
    });

    it("should reset isAuthenticating to false on success", async () => {
      mockAuthenticate.mockResolvedValue({
        success: true,
        username: "U",
        accountId: "A",
      });

      await store.getState().communityUpload.authenticate();

      expect(store.getState().communityUpload.isAuthenticating).toBe(false);
    });

    it("should reset isAuthenticating to false on failure", async () => {
      mockAuthenticate.mockResolvedValue({
        success: false,
        error: "bad",
      });

      await store.getState().communityUpload.authenticate();

      expect(store.getState().communityUpload.isAuthenticating).toBe(false);
    });

    it("should reset isAuthenticating to false on exception", async () => {
      mockAuthenticate.mockRejectedValue(new Error("boom"));

      await store.getState().communityUpload.authenticate();

      expect(store.getState().communityUpload.isAuthenticating).toBe(false);
    });

    it("should handle null username/accountId in successful result", async () => {
      mockAuthenticate.mockResolvedValue({
        success: true,
        // username and accountId are undefined
      });

      await store.getState().communityUpload.authenticate();

      const { communityUpload } = store.getState();
      expect(communityUpload.gggAuthenticated).toBe(true);
      expect(communityUpload.gggUsername).toBeNull();
      expect(communityUpload.gggAccountId).toBeNull();
    });
  });

  // ── logout ─────────────────────────────────────────────────────────

  describe("logout", () => {
    it("keeps account details while unlinking and prevents duplicate requests", async () => {
      await authenticateStore();
      let acknowledge!: (result: { success: boolean }) => void;
      mockLogout.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            acknowledge = resolve;
          }),
      );
      const pending = store.getState().communityUpload.logout();
      expect(store.getState().communityUpload.isUnlinking).toBe(true);
      expect(store.getState().communityUpload.gggAuthenticated).toBe(true);
      await store.getState().communityUpload.logout();
      expect(mockLogout).toHaveBeenCalledOnce();
      acknowledge({ success: true });
      await pending;
      expect(store.getState().communityUpload.isUnlinking).toBe(false);
      expect(store.getState().communityUpload.gggAuthenticated).toBe(false);
    });

    it("shows a safe error and allows reconnection when sign-in has expired", async () => {
      await authenticateStore();
      mockLogout.mockResolvedValue({ success: false });
      mockGetAuthStatus.mockResolvedValue({
        authenticated: false,
        username: null,
        accountId: null,
      });
      await store.getState().communityUpload.logout();
      expect(store.getState().communityUpload.gggAuthenticated).toBe(false);
      expect(store.getState().communityUpload.authError).toContain(
        "could not be unlinked",
      );
      expect(store.getState().communityUpload.isUnlinking).toBe(false);
    });
    it("should reset auth state on successful logout", async () => {
      // First, put the store into an authenticated state
      await authenticateStore();

      mockLogout.mockResolvedValue({ success: true });
      await store.getState().communityUpload.logout();

      const { communityUpload } = store.getState();
      expect(communityUpload.gggAuthenticated).toBe(false);
      expect(communityUpload.gggUsername).toBeNull();
      expect(communityUpload.gggAccountId).toBeNull();
    });

    it("should not change state when result.success is false", async () => {
      await authenticateStore();

      mockLogout.mockResolvedValue({ success: false });
      await store.getState().communityUpload.logout();

      const { communityUpload } = store.getState();
      // State should remain authenticated
      expect(communityUpload.gggAuthenticated).toBe(true);
      expect(communityUpload.gggUsername).toBe("User");
      expect(communityUpload.gggAccountId).toBe("id-1");
    });

    it("should not throw on logout error (fire-and-forget)", async () => {
      mockLogout.mockRejectedValue(new Error("network error"));

      // This should not throw
      await expect(
        store.getState().communityUpload.logout(),
      ).resolves.toBeUndefined();
    });

    it("should not change state on logout error", async () => {
      await authenticateStore();

      mockLogout.mockRejectedValue(new Error("network error"));
      await store.getState().communityUpload.logout();

      const { communityUpload } = store.getState();
      // State should remain authenticated — logout error doesn't clear state
      expect(communityUpload.gggAuthenticated).toBe(true);
      expect(communityUpload.gggUsername).toBe("User");
      expect(communityUpload.gggAccountId).toBe("id-1");
    });
  });

  describe("backfill", () => {
    it("stores backfill leagues returned by IPC", async () => {
      const leagues = [
        { game: "poe1", league: "Settlers" },
        { game: "poe2", league: "Dawn of the Hunt" },
      ];
      mockGetBackfillLeagues.mockResolvedValue({
        success: true,
        leagues,
      });

      await store.getState().communityUpload.checkBackfill();

      expect(mockGetBackfillLeagues).toHaveBeenCalledTimes(1);
      expect(store.getState().communityUpload.backfillLeagues).toEqual(leagues);
    });

    it("logs and preserves state when checking backfill fails", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const leagues = [{ game: "poe1", league: "Settlers" }];
      const error = new Error("backfill unavailable");

      mockGetBackfillLeagues.mockResolvedValueOnce({
        success: true,
        leagues,
      });
      await store.getState().communityUpload.checkBackfill();
      mockGetBackfillLeagues.mockRejectedValueOnce(error);

      await store.getState().communityUpload.checkBackfill();

      expect(store.getState().communityUpload.backfillLeagues).toEqual(leagues);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[CommunityUploadSlice] Failed to check backfill eligibility.",
      );

      consoleSpy.mockRestore();
    });

    it("logs and preserves state when backfill eligibility is rejected", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      mockGetBackfillLeagues.mockResolvedValue({
        success: false,
        error: "not available",
      });

      await store.getState().communityUpload.checkBackfill();

      expect(store.getState().communityUpload.backfillLeagues).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[CommunityUploadSlice] Failed to check backfill eligibility.",
      );
    });

    it("sets isBackfilling while triggerBackfill is pending", async () => {
      let resolve!: (result: { success: true }) => void;
      mockTriggerBackfill.mockReturnValue(
        new Promise((r) => {
          resolve = r;
        }),
      );

      const promise = store.getState().communityUpload.triggerBackfill();

      expect(store.getState().communityUpload.isBackfilling).toBe(true);

      resolve({ success: true });
      await promise;
    });

    it("reflects the atomic main-process dismissal after backfill succeeds", async () => {
      const leagues = [{ game: "poe1", league: "Settlers" }];
      mockGetBackfillLeagues.mockResolvedValue({
        success: true,
        leagues,
      });
      mockTriggerBackfill.mockResolvedValue({
        success: true,
      });

      await store.getState().communityUpload.checkBackfill();
      const result = await store.getState().communityUpload.triggerBackfill();

      const { communityUpload } = store.getState();
      expect(result).toBe(true);
      expect(communityUpload.isBackfilling).toBe(false);
      expect(communityUpload.backfillLeagues).toEqual([]);
      expect(communityUpload.backfillError).toBeNull();
      expect(mockMarkDismissed).toHaveBeenCalledWith("community-backfill");
      expect(mockDismissBanner).not.toHaveBeenCalled();
    });

    it("resets isBackfilling and logs when triggerBackfill fails", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const error = new Error("trigger failed");
      mockTriggerBackfill.mockRejectedValue(error);

      const result = await store.getState().communityUpload.triggerBackfill();

      expect(result).toBe(false);
      expect(store.getState().communityUpload.isBackfilling).toBe(false);
      expect(store.getState().communityUpload.backfillError).toBe(
        "Community data could not be queued. Please try again.",
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        "[CommunityUploadSlice] Backfill trigger failed.",
      );

      consoleSpy.mockRestore();
    });

    it("keeps the backfill available when the main process rejects it", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const leagues = [{ game: "poe1", league: "Settlers" }];
      mockGetBackfillLeagues.mockResolvedValue({
        success: true,
        leagues,
      });
      mockTriggerBackfill.mockResolvedValue({
        success: false,
        error: "Could not queue community data",
      });

      await store.getState().communityUpload.checkBackfill();
      const result = await store.getState().communityUpload.triggerBackfill();

      const { communityUpload } = store.getState();
      expect(result).toBe(false);
      expect(communityUpload.isBackfilling).toBe(false);
      expect(communityUpload.backfillLeagues).toEqual(leagues);
      expect(communityUpload.backfillError).toBe(
        "Could not queue community data",
      );
      expect(mockDismissBanner).not.toHaveBeenCalled();
      expect(mockMarkDismissed).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("persists an explicit dismissal through the banners slice", async () => {
      const result = await store
        .getState()
        .communityUpload.dismissBackfillBanner();

      expect(result).toBe(true);
      expect(mockDismissBanner).toHaveBeenCalledWith("community-backfill");
      expect(store.getState().communityUpload.backfillError).toBeNull();
    });

    it("reports an explicit dismissal failure", async () => {
      mockDismissBanner.mockResolvedValue(false);

      const result = await store
        .getState()
        .communityUpload.dismissBackfillBanner();

      expect(result).toBe(false);
      expect(store.getState().communityUpload.backfillError).toBe(
        "The banner preference could not be saved. Please try again.",
      );
    });
  });
});
