import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import {
  type CommunityUploadSlice,
  createCommunityUploadSlice,
} from "../CommunityUpload.slice";

// ─── Store factory ─────────────────────────────────────────────────────────
//
// The slice creator expects the full BoundStore type parameters but we only
// test this slice in isolation. Cast through `any` to satisfy the generics.
//
function createTestStore() {
  return create<CommunityUploadSlice>()(
    devtools(
      immer((...args) => ({
        ...createCommunityUploadSlice(...(args as any)),
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

  // The setup file assigns `window.electron` in its own beforeEach which
  // runs before ours. We simply bolt gggAuth onto whatever object is there.
  (window as any).electron = {
    ...((window as any).electron ?? {}),
    gggAuth: {
      getAuthStatus: mockGetAuthStatus,
      authenticate: mockAuthenticate,
      logout: mockLogout,
    },
  };

  return { mockGetAuthStatus, mockAuthenticate, mockLogout };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CommunityUploadSlice", () => {
  let store: ReturnType<typeof createTestStore>;
  let mockGetAuthStatus: ReturnType<typeof vi.fn>;
  let mockAuthenticate: ReturnType<typeof vi.fn>;
  let mockLogout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    const mocks = installGggAuthMock();
    mockGetAuthStatus = mocks.mockGetAuthStatus;
    mockAuthenticate = mocks.mockAuthenticate;
    mockLogout = mocks.mockLogout;
    store = createTestStore();
  });

  // ── Helper: put the store into an "authenticated" state ────────────

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
    });
  });

  // ── fetchStatus ────────────────────────────────────────────────────

  describe("fetchStatus", () => {
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
});
