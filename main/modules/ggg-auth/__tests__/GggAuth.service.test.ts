import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getIpcHandler } from "~/main/modules/__test-utils__/mock-factories";
import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";

// ─── Hoisted mock functions ──────────────────────────────────────────────────

const {
  mockIpcHandle,
  mockGetPath,
  mockSafeStorageIsAvailable,
  mockSafeStorageEncrypt,
  mockSafeStorageDecrypt,
  mockShellOpenExternal,
  mockFsWriteFileSync,
  mockFsReadFileSync,
  mockFsExistsSync,
  mockFsUnlinkSync,
  mockRandomBytes,
  mockCreateHash,
  mockTimingSafeEqual,
  mockFetch,
  mockAssertTrustedSender,
  mockHandleValidationError,
  MockIpcValidationError,
  mockSentryCaptureException,
  mockPathJoin,
} = vi.hoisted(() => {
  class _MockIpcValidationError extends Error {
    detail: string;
    constructor(channel: string, detail: string) {
      super(`[IPC Validation] ${channel}: ${detail}`);
      this.name = "IpcValidationError";
      this.detail = detail;
    }
  }

  return {
    mockIpcHandle: vi.fn(),
    mockGetPath: vi.fn().mockReturnValue("/fake/userData"),
    mockSafeStorageIsAvailable: vi.fn().mockReturnValue(true),
    mockSafeStorageEncrypt: vi.fn().mockReturnValue(Buffer.from("encrypted")),
    mockSafeStorageDecrypt: vi.fn(),
    mockShellOpenExternal: vi.fn().mockResolvedValue(undefined),
    mockFsWriteFileSync: vi.fn(),
    mockFsReadFileSync: vi.fn(),
    mockFsExistsSync: vi.fn().mockReturnValue(false),
    mockFsUnlinkSync: vi.fn(),
    mockRandomBytes: vi.fn().mockReturnValue(Buffer.alloc(32, "a")),
    mockCreateHash: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        digest: vi.fn().mockReturnValue("mock-code-challenge"),
      }),
    }),
    mockTimingSafeEqual: vi.fn().mockReturnValue(true),
    mockFetch: vi.fn(),
    mockAssertTrustedSender: vi.fn(),
    mockHandleValidationError: vi.fn((error: unknown) => {
      throw error;
    }),
    MockIpcValidationError: _MockIpcValidationError,
    mockSentryCaptureException: vi.fn(),
    mockPathJoin: vi.fn((...args: string[]) => args.join("/")),
  };
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("electron", () => ({
  app: { getPath: mockGetPath },
  ipcMain: { handle: mockIpcHandle },
  safeStorage: {
    isEncryptionAvailable: mockSafeStorageIsAvailable,
    encryptString: mockSafeStorageEncrypt,
    decryptString: mockSafeStorageDecrypt,
  },
  shell: { openExternal: mockShellOpenExternal },
}));

vi.mock("node:fs", () => ({
  default: {
    writeFileSync: mockFsWriteFileSync,
    readFileSync: mockFsReadFileSync,
    existsSync: mockFsExistsSync,
    unlinkSync: mockFsUnlinkSync,
  },
  writeFileSync: mockFsWriteFileSync,
  readFileSync: mockFsReadFileSync,
  existsSync: mockFsExistsSync,
  unlinkSync: mockFsUnlinkSync,
}));

vi.mock("node:path", () => ({
  default: { join: mockPathJoin },
  join: mockPathJoin,
}));

vi.mock("node:crypto", () => ({
  default: {
    randomBytes: mockRandomBytes,
    createHash: mockCreateHash,
    timingSafeEqual: mockTimingSafeEqual,
  },
  randomBytes: mockRandomBytes,
  createHash: mockCreateHash,
  timingSafeEqual: mockTimingSafeEqual,
}));

vi.mock("@sentry/electron/main", () => ({
  captureException: mockSentryCaptureException,
  captureMessage: vi.fn(),
  init: vi.fn(),
  setTag: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

vi.mock("~/main/utils/ipc-validation", () => ({
  assertTrustedSender: mockAssertTrustedSender,
  handleValidationError: mockHandleValidationError,
  IpcValidationError: MockIpcValidationError,
}));

// ─── Stub global fetch ──────────────────────────────────────────────────────

vi.stubGlobal("fetch", mockFetch);

// ─── Import SUT (after mocks) ────────────────────────────────────────────────

import { GggAuthChannel } from "../GggAuth.channels";
import { GggAuthService } from "../GggAuth.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOCK_SESSION = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  username: "TestUser",
  sub: "test-ggg-uuid",
  expires_at: Math.floor(Date.now() / 1000) + 36000, // valid for 10 hours
};

const MOCK_EXPIRED_SESSION = {
  ...MOCK_SESSION,
  expires_at: Math.floor(Date.now() / 1000) - 600, // expired 10 minutes ago
};

function createSuccessTokenResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        access_token: "test-access-token",
        expires_in: 36000,
        token_type: "bearer",
        scope: "account:profile",
        username: "TestUser",
        sub: "test-ggg-uuid",
        refresh_token: "test-refresh-token",
        ...overrides,
      }),
    text: () => Promise.resolve(""),
  };
}

function createFailedTokenResponse(status = 400, body = "Bad Request") {
  return {
    ok: false,
    status,
    json: () => Promise.reject(new Error("not json")),
    text: () => Promise.resolve(body),
  };
}

/**
 * Configure mocks so that sessionStorage.load() returns the given session.
 */
function mockStoredSession(session: Record<string, unknown> | null): void {
  if (session) {
    mockFsExistsSync.mockReturnValue(true);
    mockFsReadFileSync.mockReturnValue(Buffer.from("encrypted-data"));
    mockSafeStorageDecrypt.mockReturnValue(JSON.stringify(session));
  } else {
    mockFsExistsSync.mockReturnValue(false);
  }
}

/**
 * Start an auth flow and return the state extracted from the URL opened in the browser.
 * Also returns the authenticate promise so the caller can await/assert on it.
 */
function startAuthFlowAndCaptureState(service: GggAuthService): {
  authPromise: Promise<{
    success: boolean;
    username?: string;
    accountId?: string;
  }>;
  getState: () => string;
  getCallbackUrl: (code?: string) => string;
} {
  const authPromise = service.authenticate();

  const getState = (): string => {
    const openCall = mockShellOpenExternal.mock.calls[0];
    if (!openCall) throw new Error("shell.openExternal was not called");
    const url = new URL(openCall[0] as string);
    const state = url.searchParams.get("state");
    if (!state) throw new Error("state param not found in URL");
    return state;
  };

  const getCallbackUrl = (code = "test-auth-code"): string => {
    const state = getState();
    return `soothsayer://oauth/callback?code=${code}&state=${state}`;
  };

  return { authPromise, getState, getCallbackUrl };
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("GggAuthService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();

    // Reset defaults
    mockGetPath.mockReturnValue("/fake/userData");
    mockSafeStorageIsAvailable.mockReturnValue(true);
    mockSafeStorageEncrypt.mockReturnValue(Buffer.from("encrypted"));
    mockShellOpenExternal.mockResolvedValue(undefined);
    mockFsExistsSync.mockReturnValue(false);
    mockRandomBytes.mockReturnValue(Buffer.alloc(32, "a"));
    mockCreateHash.mockReturnValue({
      update: vi.fn().mockReturnValue({
        digest: vi.fn().mockReturnValue("mock-code-challenge"),
      }),
    });
    mockTimingSafeEqual.mockReturnValue(true);
    mockHandleValidationError.mockImplementation((error: unknown) => {
      throw error;
    });
  });

  afterEach(() => {
    resetSingleton(GggAuthService);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Singleton
  // ─────────────────────────────────────────────────────────────────────────

  describe("singleton", () => {
    it("should return the same instance on repeated calls", () => {
      const a = GggAuthService.getInstance();
      const b = GggAuthService.getInstance();
      expect(a).toBe(b);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // IPC handler registration
  // ─────────────────────────────────────────────────────────────────────────

  describe("IPC handler registration", () => {
    it("should register all expected IPC handlers", () => {
      GggAuthService.getInstance();

      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch,
      );

      expect(registeredChannels).toContain(GggAuthChannel.GetAuthStatus);
      expect(registeredChannels).toContain(GggAuthChannel.Authenticate);
      expect(registeredChannels).toContain(GggAuthChannel.Logout);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GetAuthStatus handler
  // ─────────────────────────────────────────────────────────────────────────

  describe("GetAuthStatus handler", () => {
    it("should return authenticated: false when no session file exists", async () => {
      mockFsExistsSync.mockReturnValue(false);

      GggAuthService.getInstance();

      // GetAuthStatus does NOT call assertTrustedSender (read-only)
      const handler = getIpcHandler(
        mockIpcHandle,
        GggAuthChannel.GetAuthStatus,
      );

      const result = await handler({});

      expect(result).toEqual({
        authenticated: false,
        username: null,
        accountId: null,
      });
    });

    it("should return authenticated: true with username and accountId when session exists", async () => {
      mockStoredSession(MOCK_SESSION);

      GggAuthService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        GggAuthChannel.GetAuthStatus,
      );

      const result = await handler({});

      expect(result).toEqual({
        authenticated: true,
        username: "TestUser",
        accountId: "test-ggg-uuid",
      });
    });

    it("should return authenticated: false when session file is corrupted", async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(Buffer.from("corrupted"));
      mockSafeStorageDecrypt.mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      GggAuthService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        GggAuthChannel.GetAuthStatus,
      );

      const result = await handler({});

      expect(result).toEqual({
        authenticated: false,
        username: null,
        accountId: null,
      });
    });

    it("should delete corrupted session file on load failure", async () => {
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(Buffer.from("corrupted"));
      mockSafeStorageDecrypt.mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      GggAuthService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        GggAuthChannel.GetAuthStatus,
      );

      await handler({});

      // existsSync is called in both load (to check file) and delete (to check before unlink)
      expect(mockFsUnlinkSync).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Authenticate handler
  // ─────────────────────────────────────────────────────────────────────────

  describe("Authenticate handler", () => {
    it("should open browser with correct authorization URL parameters", () => {
      const service = GggAuthService.getInstance();

      // We don't await — just start the flow
      service.authenticate();

      expect(mockShellOpenExternal).toHaveBeenCalledTimes(1);

      const urlString = mockShellOpenExternal.mock.calls[0][0] as string;
      const url = new URL(urlString);

      // When VITE_SUPABASE_URL is set, the proxy edge function is used
      expect(url.pathname).toContain("poe-oauth-callback");
      expect(url.searchParams.get("action")).toBe("authorize");
      expect(url.searchParams.get("scope")).toBe("account:profile");
      expect(url.searchParams.get("state")).toBeTruthy();
      expect(url.searchParams.get("code_challenge")).toBeTruthy();
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    });

    it("should return success after handleCallback resolves with valid tokens", async () => {
      const service = GggAuthService.getInstance();

      mockFetch.mockResolvedValueOnce(createSuccessTokenResponse());

      const { authPromise, getCallbackUrl } =
        startAuthFlowAndCaptureState(service);

      await service.handleCallback(getCallbackUrl());

      const result = await authPromise;

      expect(result).toEqual({
        success: true,
        username: "TestUser",
        accountId: "test-ggg-uuid",
      });
    });

    it("should return error via IPC handler when authentication fails", async () => {
      mockShellOpenExternal.mockRejectedValueOnce(
        new Error("Browser not found"),
      );

      // Prevent handleValidationError from throwing so we can check the fallback
      mockHandleValidationError.mockReturnValueOnce(undefined);

      GggAuthService.getInstance();
      const handler = getIpcHandler(mockIpcHandle, GggAuthChannel.Authenticate);

      const result = await handler({ sender: { id: 1 } });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Failed to open browser"),
      });
    });

    it("should reject authenticate from untrusted sender", async () => {
      mockAssertTrustedSender.mockImplementation(() => {
        throw new MockIpcValidationError(
          GggAuthChannel.Authenticate,
          "[Security] IPC call from untrusted webContents (id=999)",
        );
      });
      mockHandleValidationError.mockReturnValue({
        success: false,
        error:
          "Invalid input: [Security] IPC call from untrusted webContents (id=999)",
      });

      GggAuthService.getInstance();
      const handler = getIpcHandler(mockIpcHandle, GggAuthChannel.Authenticate);

      const result = await handler({ sender: { id: 999 } });

      expect(mockAssertTrustedSender).toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("untrusted webContents"),
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // handleCallback
  // ─────────────────────────────────────────────────────────────────────────

  describe("handleCallback", () => {
    it("should exchange auth code for tokens and save session", async () => {
      const service = GggAuthService.getInstance();

      mockFetch.mockResolvedValueOnce(createSuccessTokenResponse());

      const { authPromise, getCallbackUrl } =
        startAuthFlowAndCaptureState(service);

      await service.handleCallback(getCallbackUrl("my-auth-code"));
      await authPromise;

      // Verify fetch was called with the token exchange endpoint (proxy)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [fetchUrl, fetchOptions] = mockFetch.mock.calls[0];
      expect(fetchUrl).toContain("poe-oauth-callback");
      expect(fetchUrl).toContain("action=exchange");
      expect(fetchOptions.method).toBe("POST");

      // Proxy uses JSON body instead of form-encoded
      const body = JSON.parse(fetchOptions.body as string);
      expect(body.code).toBe("my-auth-code");
      expect(body.code_verifier).toBeTruthy();

      // Verify session was saved (encrypted)
      expect(mockSafeStorageEncrypt).toHaveBeenCalled();
      expect(mockFsWriteFileSync).toHaveBeenCalled();
    });

    it("should reject when state does not match pending state", async () => {
      mockTimingSafeEqual.mockReturnValueOnce(false);

      const service = GggAuthService.getInstance();

      const { authPromise } = startAuthFlowAndCaptureState(service);

      await service.handleCallback(
        "soothsayer://oauth/callback?code=test-code&state=wrong-state",
      );

      await expect(authPromise).rejects.toThrow("State mismatch");
    });

    it("should reject when no pending auth flow exists", async () => {
      const service = GggAuthService.getInstance();

      // Call handleCallback without starting an auth flow — should not throw
      // but also should not resolve anything (no pending promise)
      await service.handleCallback(
        "soothsayer://oauth/callback?code=test-code&state=some-state",
      );

      // No error thrown — silently ignored when no pending flow
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should reject when URL is invalid", async () => {
      const service = GggAuthService.getInstance();

      const { authPromise } = startAuthFlowAndCaptureState(service);

      await service.handleCallback("not a valid url %%%");

      await expect(authPromise).rejects.toThrow("Invalid callback URL");
    });

    it("should reject when code is missing from URL", async () => {
      const service = GggAuthService.getInstance();

      const { authPromise, getState } = startAuthFlowAndCaptureState(service);
      const state = getState();

      await service.handleCallback(
        `soothsayer://oauth/callback?state=${state}`,
      );

      await expect(authPromise).rejects.toThrow(
        "missing code or state parameter",
      );
    });

    it("should reject when state is missing from URL", async () => {
      const service = GggAuthService.getInstance();

      const { authPromise } = startAuthFlowAndCaptureState(service);

      await service.handleCallback(
        "soothsayer://oauth/callback?code=test-code",
      );

      await expect(authPromise).rejects.toThrow(
        "missing code or state parameter",
      );
    });

    it("should reject when token exchange returns non-ok response", async () => {
      const service = GggAuthService.getInstance();

      mockFetch.mockResolvedValueOnce(
        createFailedTokenResponse(401, "Unauthorized"),
      );

      const { authPromise, getCallbackUrl } =
        startAuthFlowAndCaptureState(service);

      await service.handleCallback(getCallbackUrl());

      await expect(authPromise).rejects.toThrow("Token exchange failed");
    });

    it("should reject when token response is missing required fields", async () => {
      const service = GggAuthService.getInstance();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "test-access-token",
            // missing refresh_token
            expires_in: 36000,
            token_type: "bearer",
            scope: "account:profile",
            username: "TestUser",
            sub: "test-ggg-uuid",
          }),
        text: () => Promise.resolve(""),
      });

      const { authPromise, getCallbackUrl } =
        startAuthFlowAndCaptureState(service);

      await service.handleCallback(getCallbackUrl());

      await expect(authPromise).rejects.toThrow("Token exchange failed");
    });

    it("should report token exchange errors to Sentry", async () => {
      const service = GggAuthService.getInstance();

      mockFetch.mockResolvedValueOnce(
        createFailedTokenResponse(500, "Server Error"),
      );

      const { authPromise, getCallbackUrl } =
        startAuthFlowAndCaptureState(service);

      await service.handleCallback(getCallbackUrl());

      await expect(authPromise).rejects.toThrow();

      expect(mockSentryCaptureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: { module: "ggg-auth", operation: "token-exchange" },
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getAccessToken
  // ─────────────────────────────────────────────────────────────────────────

  describe("getAccessToken", () => {
    it("should return null when no session exists", async () => {
      mockFsExistsSync.mockReturnValue(false);

      const service = GggAuthService.getInstance();
      const result = await service.getAccessToken();

      expect(result).toBeNull();
    });

    it("should return stored access_token when token is still valid", async () => {
      mockStoredSession(MOCK_SESSION);

      const service = GggAuthService.getInstance();
      const result = await service.getAccessToken();

      expect(result).toBe("test-access-token");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should attempt refresh when token is expired and return new token on success", async () => {
      mockStoredSession(MOCK_EXPIRED_SESSION);

      mockFetch.mockResolvedValueOnce(
        createSuccessTokenResponse({
          access_token: "refreshed-access-token",
          refresh_token: "refreshed-refresh-token",
        }),
      );

      const service = GggAuthService.getInstance();
      const result = await service.getAccessToken();

      expect(result).toBe("refreshed-access-token");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [fetchUrl, fetchOptions] = mockFetch.mock.calls[0];
      // Proxy-based refresh endpoint
      expect(fetchUrl).toContain("poe-oauth-callback");
      expect(fetchUrl).toContain("action=refresh");

      // Proxy uses JSON body
      const body = JSON.parse(fetchOptions.body as string);
      expect(body.refresh_token).toBe("test-refresh-token");

      // Verify updated session was saved
      expect(mockSafeStorageEncrypt).toHaveBeenCalled();
      expect(mockFsWriteFileSync).toHaveBeenCalled();
    });

    it("should return null and delete session when refresh fails", async () => {
      mockStoredSession(MOCK_EXPIRED_SESSION);

      mockFetch.mockResolvedValueOnce(
        createFailedTokenResponse(401, "Refresh token expired"),
      );

      const service = GggAuthService.getInstance();
      const result = await service.getAccessToken();

      expect(result).toBeNull();
      // Session should be deleted (unlinkSync called)
      expect(mockFsUnlinkSync).toHaveBeenCalled();
    });

    it("should not throw when refresh fails", async () => {
      mockStoredSession(MOCK_EXPIRED_SESSION);

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const service = GggAuthService.getInstance();

      // Should not throw — returns null gracefully
      const result = await service.getAccessToken();
      expect(result).toBeNull();
    });

    it("should report refresh failure to Sentry", async () => {
      mockStoredSession(MOCK_EXPIRED_SESSION);

      mockFetch.mockResolvedValueOnce(
        createFailedTokenResponse(401, "Unauthorized"),
      );

      const service = GggAuthService.getInstance();
      await service.getAccessToken();

      expect(mockSentryCaptureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: { module: "ggg-auth", operation: "token-refresh" },
          extra: { username: "TestUser", sub: "test-ggg-uuid" },
        }),
      );
    });

    it("should return token when expires_at is exactly at the buffer threshold", async () => {
      // Token expires_at is exactly TOKEN_EXPIRY_BUFFER_S (300) ahead of now
      // The condition is: expires_at - 300 > nowSeconds
      // When expires_at - 300 === nowSeconds, the condition is false → should refresh
      const nowSeconds = Math.floor(Date.now() / 1000);
      const edgeSession = {
        ...MOCK_SESSION,
        expires_at: nowSeconds + 300, // right at the buffer boundary
      };

      mockStoredSession(edgeSession);

      mockFetch.mockResolvedValueOnce(
        createSuccessTokenResponse({
          access_token: "refreshed-at-boundary",
        }),
      );

      const service = GggAuthService.getInstance();
      const result = await service.getAccessToken();

      // At the boundary, expires_at - 300 === nowSeconds, which is NOT > nowSeconds
      // so it should attempt a refresh
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toBe("refreshed-at-boundary");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Logout handler
  // ─────────────────────────────────────────────────────────────────────────

  describe("Logout handler", () => {
    it("should delete session file when it exists", async () => {
      mockFsExistsSync.mockReturnValue(true);

      GggAuthService.getInstance();
      const handler = getIpcHandler(mockIpcHandle, GggAuthChannel.Logout);

      const result = await handler({ sender: { id: 1 } });

      expect(result).toEqual({ success: true });
      expect(mockFsUnlinkSync).toHaveBeenCalled();
    });

    it("should succeed even when no session file exists", async () => {
      mockFsExistsSync.mockReturnValue(false);

      GggAuthService.getInstance();
      const handler = getIpcHandler(mockIpcHandle, GggAuthChannel.Logout);

      const result = await handler({ sender: { id: 1 } });

      expect(result).toEqual({ success: true });
      // unlinkSync should not be called when file doesn't exist
      expect(mockFsUnlinkSync).not.toHaveBeenCalled();
    });

    it("should return success: false when logout throws", async () => {
      mockFsExistsSync.mockImplementation(() => {
        throw new Error("Permission denied");
      });

      GggAuthService.getInstance();
      const handler = getIpcHandler(mockIpcHandle, GggAuthChannel.Logout);

      const result = await handler({ sender: { id: 1 } });

      expect(result).toEqual({ success: false });
      expect(mockSentryCaptureException).toHaveBeenCalled();
    });

    it("should reject logout from untrusted sender", async () => {
      mockAssertTrustedSender.mockImplementation(() => {
        throw new MockIpcValidationError(
          GggAuthChannel.Logout,
          "[Security] IPC call from untrusted webContents (id=999)",
        );
      });

      GggAuthService.getInstance();
      const handler = getIpcHandler(mockIpcHandle, GggAuthChannel.Logout);

      const result = await handler({ sender: { id: 999 } });

      expect(mockAssertTrustedSender).toHaveBeenCalled();
      expect(result).toEqual({ success: false });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Token refresh
  // ─────────────────────────────────────────────────────────────────────────

  describe("token refresh", () => {
    it("should successfully refresh expired token and save updated session", async () => {
      mockStoredSession(MOCK_EXPIRED_SESSION);

      mockFetch.mockResolvedValueOnce(
        createSuccessTokenResponse({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in: 72000,
        }),
      );

      const service = GggAuthService.getInstance();
      const token = await service.getAccessToken();

      expect(token).toBe("new-access-token");

      // Verify the saved session contains the new tokens
      const encryptCall = mockSafeStorageEncrypt.mock.calls[0][0] as string;
      const savedSession = JSON.parse(encryptCall);

      expect(savedSession.access_token).toBe("new-access-token");
      expect(savedSession.refresh_token).toBe("new-refresh-token");
      expect(savedSession.username).toBe("TestUser");
      expect(savedSession.sub).toBe("test-ggg-uuid");
    });

    it("should delete session when refresh returns non-ok status", async () => {
      mockStoredSession(MOCK_EXPIRED_SESSION);

      mockFetch.mockResolvedValueOnce(
        createFailedTokenResponse(403, "Forbidden"),
      );

      const service = GggAuthService.getInstance();
      const result = await service.getAccessToken();

      expect(result).toBeNull();
      expect(mockFsUnlinkSync).toHaveBeenCalled();
    });

    it("should delete session when refresh response is missing required fields", async () => {
      mockStoredSession(MOCK_EXPIRED_SESSION);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "new-token",
            // missing refresh_token
          }),
        text: () => Promise.resolve(""),
      });

      const service = GggAuthService.getInstance();
      const result = await service.getAccessToken();

      expect(result).toBeNull();
      expect(mockFsUnlinkSync).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Auth timeout
  // ─────────────────────────────────────────────────────────────────────────

  describe("auth timeout", () => {
    it("should reject auth promise after 5 minutes timeout", async () => {
      vi.useFakeTimers();

      const service = GggAuthService.getInstance();
      const authPromise = service.authenticate();

      // Advance timers by 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);

      await expect(authPromise).rejects.toThrow("Authentication timed out");

      vi.useRealTimers();
    });

    it("should not reject before 5 minutes", async () => {
      vi.useFakeTimers();

      const service = GggAuthService.getInstance();
      const authPromise = service.authenticate();

      // Advance less than 5 minutes
      vi.advanceTimersByTime(4 * 60 * 1000);

      // Extract state from the shell.openExternal call directly
      const openCall = mockShellOpenExternal.mock.calls[0];
      const url = new URL(openCall[0] as string);
      const state = url.searchParams.get("state")!;
      const callbackUrl = `soothsayer://oauth/callback?code=test-code&state=${state}`;

      // Mock the token exchange
      mockFetch.mockResolvedValueOnce(createSuccessTokenResponse());

      // Deliver the callback — should resolve the promise successfully
      await service.handleCallback(callbackUrl);

      const result = await authPromise;
      expect(result.success).toBe(true);

      vi.useRealTimers();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Session storage edge cases
  // ─────────────────────────────────────────────────────────────────────────

  describe("session storage", () => {
    it("should use path.join to construct session file path", () => {
      GggAuthService.getInstance();

      expect(mockPathJoin).toHaveBeenCalledWith(
        "/fake/userData",
        "ggg-session.enc",
      );
    });

    it("should use safeStorage.encryptString when saving session", async () => {
      const service = GggAuthService.getInstance();

      mockFetch.mockResolvedValueOnce(createSuccessTokenResponse());

      const { authPromise, getCallbackUrl } =
        startAuthFlowAndCaptureState(service);

      await service.handleCallback(getCallbackUrl());
      await authPromise;

      expect(mockSafeStorageEncrypt).toHaveBeenCalledWith(
        expect.stringContaining('"access_token":"test-access-token"'),
      );
    });

    it("should use safeStorage.decryptString when loading session", async () => {
      mockStoredSession(MOCK_SESSION);

      const service = GggAuthService.getInstance();
      await service.getAccessToken();

      expect(mockSafeStorageDecrypt).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PKCE flow
  // ─────────────────────────────────────────────────────────────────────────

  describe("PKCE flow", () => {
    it("should generate code verifier using randomBytes", () => {
      const service = GggAuthService.getInstance();
      service.authenticate();

      expect(mockRandomBytes).toHaveBeenCalledWith(32);
    });

    it("should generate code challenge using SHA-256 hash of verifier", () => {
      const service = GggAuthService.getInstance();
      service.authenticate();

      expect(mockCreateHash).toHaveBeenCalledWith("sha256");
    });

    it("should include code_verifier in token exchange request", async () => {
      const service = GggAuthService.getInstance();

      mockFetch.mockResolvedValueOnce(createSuccessTokenResponse());

      const { authPromise, getCallbackUrl } =
        startAuthFlowAndCaptureState(service);

      await service.handleCallback(getCallbackUrl());
      await authPromise;

      const [, fetchOptions] = mockFetch.mock.calls[0];
      // Proxy uses JSON body; verify code_verifier is present
      const body = JSON.parse(fetchOptions.body as string);
      expect(body.code_verifier).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Aborting in-progress flows
  // ─────────────────────────────────────────────────────────────────────────

  describe("concurrent auth flow handling", () => {
    it("should cancel previous auth flow when a new one starts", async () => {
      const service = GggAuthService.getInstance();

      // Start first flow (don't await — it gets cancelled by the second flow)
      service.authenticate();

      // Start second flow — should cancel the first
      mockFetch.mockResolvedValueOnce(createSuccessTokenResponse());
      const { authPromise: secondPromise, getCallbackUrl } =
        startAuthFlowAndCaptureState(service);

      await service.handleCallback(getCallbackUrl());
      const result = await secondPromise;

      expect(result.success).toBe(true);

      // shell.openExternal should have been called twice
      expect(mockShellOpenExternal).toHaveBeenCalledTimes(2);
    });
  });
});
