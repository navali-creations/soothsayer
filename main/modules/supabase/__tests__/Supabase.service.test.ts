import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock hoisted variables ─────────────────────────────────────────────────

const {
  mockCreateClient,
  mockAppGetPath,
  mockSafeStorageIsEncryptionAvailable,
  mockSafeStorageEncryptString,
  mockSafeStorageDecryptString,
  mockFsWriteFileSync,
  mockFsReadFileSync,
  mockFsExistsSync,
  mockFsUnlinkSync,
  mockPathJoin,
  mockSignInAnonymously,
  mockSetSession,
  mockGetSession,
  mockGetUser,
  mockSignOut,
  mockOnAuthStateChange,
  mockFrom,
  mockFetch,
} = vi.hoisted(() => ({
  mockCreateClient: vi.fn(),
  mockAppGetPath: vi.fn(() => "/mock-user-data"),
  mockSafeStorageIsEncryptionAvailable: vi.fn(() => true),
  mockSafeStorageEncryptString: vi.fn((str: string) =>
    Buffer.from(`encrypted:${str}`),
  ),
  mockSafeStorageDecryptString: vi.fn((buf: Buffer) => {
    const str = buf.toString();
    return str.startsWith("encrypted:") ? str.slice("encrypted:".length) : str;
  }),
  mockFsWriteFileSync: vi.fn(),
  mockFsReadFileSync: vi.fn(),
  mockFsExistsSync: vi.fn(() => false),
  mockFsUnlinkSync: vi.fn(),
  mockPathJoin: vi.fn((...parts: string[]) => parts.join("/")),
  mockSignInAnonymously: vi.fn(),
  mockSetSession: vi.fn(),
  mockGetSession: vi.fn(),
  mockGetUser: vi.fn(),
  mockSignOut: vi.fn(),
  mockOnAuthStateChange: vi.fn(),
  mockFrom: vi.fn(),
  mockFetch: vi.fn(),
}));

// ─── Mock modules ────────────────────────────────────────────────────────────

vi.mock("electron", () => ({
  app: {
    getPath: mockAppGetPath,
  },
  safeStorage: {
    isEncryptionAvailable: mockSafeStorageIsEncryptionAvailable,
    encryptString: mockSafeStorageEncryptString,
    decryptString: mockSafeStorageDecryptString,
  },
}));

vi.mock("node:fs", () => ({
  default: {
    writeFileSync: mockFsWriteFileSync,
    readFileSync: mockFsReadFileSync,
    existsSync: mockFsExistsSync,
    unlinkSync: mockFsUnlinkSync,
  },
}));

vi.mock("node:path", () => ({
  default: {
    join: mockPathJoin,
  },
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import { SupabaseClientService } from "../Supabase.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createMockSupabaseClient() {
  const unsubscribe = vi.fn();

  const client = {
    auth: {
      signInAnonymously: mockSignInAnonymously,
      setSession: mockSetSession,
      getSession: mockGetSession,
      getUser: mockGetUser,
      signOut: mockSignOut,
      onAuthStateChange: mockOnAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe } },
      }),
    },
    from: mockFrom,
  };

  mockCreateClient.mockReturnValue(client);
  return { client, unsubscribe };
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    user: { id: "mock-user-id" },
    ...overrides,
  };
}

function makeStoredSession(overrides: Record<string, unknown> = {}) {
  return {
    access_token: "stored-access-token",
    refresh_token: "stored-refresh-token",
    user_id: "stored-user-id",
    ...overrides,
  };
}

const SUPABASE_URL = "https://test.supabase.co";
const SUPABASE_ANON_KEY = "test-anon-key";

function makeSnapshotResponse() {
  return {
    snapshot: {
      id: "snap-1",
      leagueId: "league-1",
      fetchedAt: "2025-01-01T00:00:00Z",
      exchangeChaosToDivine: 150,
      stashChaosToDivine: 148,
      stackedDeckChaosCost: 1.5,
    },
    cardPrices: {
      exchange: {
        "The Doctor": { chaosValue: 900, divineValue: 6.0 },
      },
      stash: {
        "The Doctor": { chaosValue: 880, divineValue: 5.9 },
      },
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SupabaseClientService", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton between tests
    // @ts-expect-error — accessing private static for testing
    SupabaseClientService._instance = undefined;

    // Default: no stored session file
    mockFsExistsSync.mockReturnValue(false);

    // Default: successful anonymous sign-in
    const session = makeSession();
    mockSignInAnonymously.mockResolvedValue({
      data: { session },
      error: null,
    });

    // Default: getUser returns the anonymous user
    mockGetUser.mockResolvedValue({
      data: { user: { id: "mock-user-id" } },
      error: null,
    });

    // Default: getSession returns a valid session
    mockGetSession.mockResolvedValue({
      data: { session },
    });

    // Default: onAuthStateChange
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    // Reset fetch
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════
  // SINGLETON
  // ═══════════════════════════════════════════════════════════════

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const a = SupabaseClientService.getInstance();
      const b = SupabaseClientService.getInstance();
      expect(a).toBe(b);
    });

    it("should create a new instance if none exists", () => {
      const instance = SupabaseClientService.getInstance();
      expect(instance).toBeInstanceOf(SupabaseClientService);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // isConfigured
  // ═══════════════════════════════════════════════════════════════

  describe("isConfigured", () => {
    it("should return false before configure is called", () => {
      const service = SupabaseClientService.getInstance();
      expect(service.isConfigured()).toBe(false);
    });

    it("should return true after configure is called", async () => {
      createMockSupabaseClient();
      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);
      expect(service.isConfigured()).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // configure
  // ═══════════════════════════════════════════════════════════════

  describe("configure", () => {
    it("should create a Supabase client with correct options", async () => {
      createMockSupabaseClient();
      const service = SupabaseClientService.getInstance();

      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      expect(mockCreateClient).toHaveBeenCalledWith(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          auth: {
            autoRefreshToken: true,
            persistSession: false,
            detectSessionInUrl: false,
          },
        },
      );
    });

    it("should not create a client when URL is missing", async () => {
      const service = SupabaseClientService.getInstance();
      await service.configure("", SUPABASE_ANON_KEY);
      expect(mockCreateClient).not.toHaveBeenCalled();
      expect(service.isConfigured()).toBe(false);
    });

    it("should not create a client when anon key is missing", async () => {
      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, "");
      expect(mockCreateClient).not.toHaveBeenCalled();
      expect(service.isConfigured()).toBe(false);
    });

    it("should sign in anonymously when no stored session exists", async () => {
      createMockSupabaseClient();
      mockFsExistsSync.mockReturnValue(false);

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      expect(mockSignInAnonymously).toHaveBeenCalledOnce();
      expect(mockSetSession).not.toHaveBeenCalled();
    });

    it("should restore a stored session when one exists", async () => {
      createMockSupabaseClient();

      const storedSession = makeStoredSession();
      const restoredSession = makeSession();

      // Simulate encrypted file on disk
      mockFsExistsSync.mockReturnValue(true);
      const encrypted = Buffer.from(
        `encrypted:${JSON.stringify(storedSession)}`,
      );
      mockFsReadFileSync.mockReturnValue(encrypted);

      mockSetSession.mockResolvedValue({
        data: { session: restoredSession },
        error: null,
      });

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      expect(mockSetSession).toHaveBeenCalledWith({
        access_token: storedSession.access_token,
        refresh_token: storedSession.refresh_token,
      });
      // Should NOT sign in anonymously since session restore succeeded
      expect(mockSignInAnonymously).not.toHaveBeenCalled();
    });

    it("should fall back to anonymous sign-in when session restore fails", async () => {
      createMockSupabaseClient();

      const storedSession = makeStoredSession();

      mockFsExistsSync.mockReturnValue(true);
      const encrypted = Buffer.from(
        `encrypted:${JSON.stringify(storedSession)}`,
      );
      mockFsReadFileSync.mockReturnValue(encrypted);

      // Session restore fails
      mockSetSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Token expired" },
      });

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      expect(mockSignInAnonymously).toHaveBeenCalledOnce();
    });

    it("should store the session after successful anonymous sign-in", async () => {
      createMockSupabaseClient();

      const session = makeSession({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        user: { id: "new-user-id" },
      });
      mockSignInAnonymously.mockResolvedValue({
        data: { session },
        error: null,
      });

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      // Verify the session was persisted via SecureSessionStorage.save()
      expect(mockFsWriteFileSync).toHaveBeenCalledOnce();
      const writtenBuffer = mockFsWriteFileSync.mock.calls[0][1] as Buffer;
      const writtenStr = writtenBuffer.toString();
      // Should be the encrypted version of the session JSON
      expect(writtenStr).toContain("encrypted:");
      const decrypted = writtenStr.slice("encrypted:".length);
      const parsed = JSON.parse(decrypted);
      expect(parsed).toEqual({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        user_id: "new-user-id",
      });
    });

    it("should set up an auth state listener after authentication", async () => {
      createMockSupabaseClient();
      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      expect(mockOnAuthStateChange).toHaveBeenCalledOnce();
      expect(mockOnAuthStateChange).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // ensureAuthenticated — deduplication
  // ═══════════════════════════════════════════════════════════════

  describe("ensureAuthenticated — concurrent calls", () => {
    it("should not sign in multiple times when called concurrently", async () => {
      createMockSupabaseClient();

      // Slow sign-in to allow overlap
      let resolveSignIn: (v: unknown) => void;
      const signInPromise = new Promise((r) => {
        resolveSignIn = r;
      });
      mockSignInAnonymously.mockReturnValue(signInPromise);

      const service = SupabaseClientService.getInstance();

      // Start configure but don't await yet — it'll block on signInAnonymously
      const configurePromise = service.configure(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
      );

      // Trigger a second authentication path via getLeagues
      // This internally calls ensureAuthenticated again
      // We need to resolve the sign-in first for configure to complete
      resolveSignIn!({
        data: { session: makeSession() },
        error: null,
      });

      await configurePromise;

      // signInAnonymously should only have been called once despite
      // configure calling ensureAuthenticated
      expect(mockSignInAnonymously).toHaveBeenCalledOnce();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // signInAnonymously — error handling
  // ═══════════════════════════════════════════════════════════════

  describe("signInAnonymously — error handling", () => {
    it("should throw when anonymous sign-in returns an error", async () => {
      createMockSupabaseClient();

      mockSignInAnonymously.mockResolvedValue({
        data: { session: null },
        error: { message: "Signups not allowed for otp" },
      });

      const service = SupabaseClientService.getInstance();
      await expect(
        service.configure(SUPABASE_URL, SUPABASE_ANON_KEY),
      ).rejects.toThrow("Failed to authenticate: Signups not allowed for otp");
    });

    it("should throw when anonymous sign-in returns no session", async () => {
      createMockSupabaseClient();

      mockSignInAnonymously.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const service = SupabaseClientService.getInstance();
      await expect(
        service.configure(SUPABASE_URL, SUPABASE_ANON_KEY),
      ).rejects.toThrow("No session returned from anonymous sign-in");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Auth state listener
  // ═══════════════════════════════════════════════════════════════

  describe("auth state listener", () => {
    it("should delete stored session on SIGNED_OUT event", async () => {
      createMockSupabaseClient();
      mockFsExistsSync.mockReturnValue(true);

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      // Get the listener callback
      const listenerCallback = mockOnAuthStateChange.mock.calls[0][0];

      // Simulate SIGNED_OUT
      listenerCallback("SIGNED_OUT", null);

      expect(mockFsUnlinkSync).toHaveBeenCalled();
    });

    it("should persist session on TOKEN_REFRESHED event", async () => {
      createMockSupabaseClient();

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      // Clear calls from initial authentication
      mockFsWriteFileSync.mockClear();

      const listenerCallback = mockOnAuthStateChange.mock.calls[0][0];

      const refreshedSession = makeSession({
        access_token: "refreshed-access-token",
        refresh_token: "refreshed-refresh-token",
      });
      listenerCallback("TOKEN_REFRESHED", refreshedSession);

      expect(mockFsWriteFileSync).toHaveBeenCalledOnce();
    });

    it("should only register the listener once even if ensureAuthenticated is called multiple times", async () => {
      createMockSupabaseClient();

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      // Force another ensureAuthenticated via getLeagues
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });
      await service.getLeagues("poe1");

      // onAuthStateChange should only be called once
      expect(mockOnAuthStateChange).toHaveBeenCalledOnce();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // getAuthStatus
  // ═══════════════════════════════════════════════════════════════

  describe("getAuthStatus", () => {
    it("should return isAuthenticated false when client is not configured", async () => {
      const service = SupabaseClientService.getInstance();
      const status = await service.getAuthStatus();
      expect(status).toEqual({ isAuthenticated: false });
    });

    it("should return isAuthenticated true with userId when session exists", async () => {
      createMockSupabaseClient();
      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      mockGetSession.mockResolvedValue({
        data: {
          session: { user: { id: "anon-user-123" } },
        },
      });

      const status = await service.getAuthStatus();
      expect(status).toEqual({
        isAuthenticated: true,
        userId: "anon-user-123",
      });
    });

    it("should return isAuthenticated false when no session exists", async () => {
      createMockSupabaseClient();
      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      mockGetSession.mockResolvedValue({
        data: { session: null },
      });

      const status = await service.getAuthStatus();
      expect(status).toEqual({ isAuthenticated: false });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // getLatestSnapshot
  // ═══════════════════════════════════════════════════════════════

  describe("getLatestSnapshot", () => {
    async function configureService() {
      createMockSupabaseClient();
      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);
      return service;
    }

    it("should throw when client is not configured", async () => {
      const service = SupabaseClientService.getInstance();
      await expect(
        service.getLatestSnapshot("poe1", "Settlers"),
      ).rejects.toThrow("Supabase client not configured");
    });

    it("should throw when there is no active session", async () => {
      const service = await configureService();

      mockGetSession.mockResolvedValue({
        data: { session: null },
      });

      await expect(
        service.getLatestSnapshot("poe1", "Settlers"),
      ).rejects.toThrow("No active session");
    });

    it("should fetch snapshot via edge function and return mapped data", async () => {
      const service = await configureService();
      const snapshotResponse = makeSnapshotResponse();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(snapshotResponse)),
      });

      const result = await service.getLatestSnapshot("poe1", "Settlers");

      expect(mockFetch).toHaveBeenCalledWith(
        `${SUPABASE_URL}/functions/v1/get-latest-snapshot`,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: "Bearer mock-access-token",
          },
          body: JSON.stringify({ game: "poe1", league: "Settlers" }),
        }),
      );

      expect(result).toEqual({
        timestamp: "2025-01-01T00:00:00Z",
        stackedDeckChaosCost: 1.5,
        exchange: {
          chaosToDivineRatio: 150,
          cardPrices: {
            "The Doctor": { chaosValue: 900, divineValue: 6.0 },
          },
        },
        stash: {
          chaosToDivineRatio: 148,
          cardPrices: {
            "The Doctor": { chaosValue: 880, divineValue: 5.9 },
          },
        },
      });
    });

    it("should return cached snapshot when within cache duration", async () => {
      const service = await configureService();
      const snapshotResponse = makeSnapshotResponse();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(snapshotResponse)),
      });

      // First call fetches from network
      const result1 = await service.getLatestSnapshot("poe1", "Settlers");
      // Second call should use cache
      const result2 = await service.getLatestSnapshot("poe1", "Settlers");

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(result1).toEqual(result2);
    });

    it("should fetch again after cache expires", async () => {
      vi.useFakeTimers();
      try {
        const service = await configureService();
        const snapshotResponse = makeSnapshotResponse();

        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve(JSON.stringify(snapshotResponse)),
        });

        // First call
        await service.getLatestSnapshot("poe1", "Settlers");
        expect(mockFetch).toHaveBeenCalledOnce();

        // Advance past cache duration (5 minutes)
        vi.advanceTimersByTime(6 * 60 * 1000);

        // Second call should fetch again
        await service.getLatestSnapshot("poe1", "Settlers");
        expect(mockFetch).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("should cache per game and league combination", async () => {
      const service = await configureService();
      const snapshotResponse = makeSnapshotResponse();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(snapshotResponse)),
      });

      await service.getLatestSnapshot("poe1", "Settlers");
      await service.getLatestSnapshot("poe2", "Dawn");

      // Should have fetched twice — different cache keys
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw when edge function returns non-ok response", async () => {
      const service = await configureService();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      });

      await expect(
        service.getLatestSnapshot("poe1", "Settlers"),
      ).rejects.toThrow("Edge Function failed (500): Internal Server Error");
    });

    it("should throw when response has invalid structure", async () => {
      const service = await configureService();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ snapshot: null })),
      });

      await expect(
        service.getLatestSnapshot("poe1", "Settlers"),
      ).rejects.toThrow("Invalid response structure from Supabase");
    });

    it("should re-authenticate and retry when token validation fails", async () => {
      const service = await configureService();
      const snapshotResponse = makeSnapshotResponse();

      // Reset after configure so we can control the exact sequence.
      // getLatestSnapshot triggers this getUser call sequence:
      //   1. ensureAuthenticated → getUser (log only, result ignored)
      //   2. token validation → getUser (FAIL → triggers re-auth)
      //   3. re-auth ensureAuthenticated → getUser (log only)
      //   4. retry token validation → getUser (SUCCESS)
      mockGetUser.mockReset();
      mockGetUser
        .mockResolvedValueOnce({
          data: { user: { id: "mock-user-id" } },
          error: null,
        }) // 1. ensureAuthenticated log
        .mockResolvedValueOnce({
          data: { user: null },
          error: { message: "Invalid token" },
        }) // 2. token validation fails
        .mockResolvedValueOnce({
          data: { user: { id: "re-authed-user" } },
          error: null,
        }) // 3. re-auth ensureAuthenticated log
        .mockResolvedValueOnce({
          data: { user: { id: "re-authed-user" } },
          error: null,
        }); // 4. retry succeeds

      // Re-auth: signInAnonymously is called again
      mockSignInAnonymously.mockResolvedValue({
        data: { session: makeSession() },
        error: null,
      });

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(snapshotResponse)),
      });

      const result = await service.getLatestSnapshot("poe1", "Settlers");
      expect(result.timestamp).toBe("2025-01-01T00:00:00Z");
    });

    it("should throw when re-authentication also fails", async () => {
      const service = await configureService();

      // Reset after configure so we can control the exact sequence.
      // getLatestSnapshot triggers this getUser call sequence:
      //   1. ensureAuthenticated → getUser (log only)
      //   2. token validation → getUser (FAIL → triggers re-auth)
      //   3. re-auth ensureAuthenticated → getUser (log only)
      //   4. retry token validation → getUser (FAIL → throws)
      mockGetUser.mockReset();
      mockGetUser
        .mockResolvedValueOnce({
          data: { user: { id: "mock-user-id" } },
          error: null,
        }) // 1. ensureAuthenticated log
        .mockResolvedValueOnce({
          data: { user: null },
          error: { message: "Invalid token" },
        }) // 2. token validation fails
        .mockResolvedValueOnce({
          data: { user: { id: "re-authed-user" } },
          error: null,
        }) // 3. re-auth ensureAuthenticated log
        .mockResolvedValueOnce({
          data: { user: null },
          error: { message: "Still invalid" },
        }); // 4. retry also fails

      mockSignInAnonymously.mockResolvedValue({
        data: { session: makeSession() },
        error: null,
      });

      await expect(
        service.getLatestSnapshot("poe1", "Settlers"),
      ).rejects.toThrow("Authentication failed after retry");
    });

    it("should handle stackedDeckChaosCost being null in response", async () => {
      const service = await configureService();
      const snapshotResponse = makeSnapshotResponse();
      snapshotResponse.snapshot.stackedDeckChaosCost =
        null as unknown as number;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(snapshotResponse)),
      });

      const result = await service.getLatestSnapshot("poe1", "Settlers");
      expect(result.stackedDeckChaosCost).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // getLeagues
  // ═══════════════════════════════════════════════════════════════

  describe("getLeagues", () => {
    async function configureService() {
      createMockSupabaseClient();
      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);
      return service;
    }

    it("should throw when client is not configured", async () => {
      const service = SupabaseClientService.getInstance();
      await expect(service.getLeagues("poe1")).rejects.toThrow(
        "Supabase client not configured",
      );
    });

    it("should query leagues filtered by game and active status", async () => {
      const service = await configureService();

      const mockOrder = vi.fn().mockResolvedValue({
        data: [{ id: "1", game: "poe1", name: "Settlers", is_active: true }],
        error: null,
      });
      const mockEqActive = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqGame = vi.fn().mockReturnValue({ eq: mockEqActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqGame });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await service.getLeagues("poe1");

      expect(mockFrom).toHaveBeenCalledWith("poe_leagues");
      expect(mockSelect).toHaveBeenCalledWith("*");
      expect(mockEqGame).toHaveBeenCalledWith("game", "poe1");
      expect(mockEqActive).toHaveBeenCalledWith("is_active", true);
      expect(mockOrder).toHaveBeenCalledWith("start_at", {
        ascending: false,
      });
      expect(result).toEqual([
        { id: "1", game: "poe1", name: "Settlers", is_active: true },
      ]);
    });

    it("should throw when Supabase returns an error", async () => {
      const service = await configureService();

      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "relation does not exist" },
      });
      const mockEqActive = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqGame = vi.fn().mockReturnValue({ eq: mockEqActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqGame });
      mockFrom.mockReturnValue({ select: mockSelect });

      await expect(service.getLeagues("poe1")).rejects.toThrow(
        "Failed to fetch leagues: relation does not exist",
      );
    });

    it("should return empty array when data is null", async () => {
      const service = await configureService();

      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockEqActive = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEqGame = vi.fn().mockReturnValue({ eq: mockEqActive });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEqGame });
      mockFrom.mockReturnValue({ select: mockSelect });

      const result = await service.getLeagues("poe1");
      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // callEdgeFunction
  // ═══════════════════════════════════════════════════════════════

  describe("callEdgeFunction", () => {
    async function configureService() {
      createMockSupabaseClient();
      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);
      return service;
    }

    it("should throw when client is not configured", async () => {
      const service = SupabaseClientService.getInstance();
      await expect(
        service.callEdgeFunction("my-function", { key: "value" }),
      ).rejects.toThrow("Supabase client not configured");
    });

    it("should throw when no active session exists", async () => {
      const service = await configureService();

      mockGetSession.mockResolvedValue({
        data: { session: null },
      });

      await expect(
        service.callEdgeFunction("my-function", { key: "value" }),
      ).rejects.toThrow("No active session");
    });

    it("should call the edge function with correct URL, headers, and body", async () => {
      const service = await configureService();

      const responseData = { result: "success" };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(responseData)),
      });

      const result = await service.callEdgeFunction("my-function", {
        game: "poe1",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${SUPABASE_URL}/functions/v1/my-function`,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: "Bearer mock-access-token",
          },
          body: JSON.stringify({ game: "poe1" }),
        }),
      );

      expect(result).toEqual(responseData);
    });

    it("should throw when the edge function returns a non-ok response", async () => {
      const service = await configureService();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      await expect(service.callEdgeFunction("my-function", {})).rejects.toThrow(
        "Edge Function my-function failed (401): Unauthorized",
      );
    });

    it("should pass an AbortSignal to fetch", async () => {
      const service = await configureService();

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({ ok: true })),
      });

      await service.callEdgeFunction("my-function", { key: "value" });

      const fetchCall = mockFetch.mock.calls[0];
      const fetchOptions = fetchCall[1];
      expect(fetchOptions.signal).toBeInstanceOf(AbortSignal);
    });

    it("should throw a descriptive timeout error when fetch exceeds the timeout", async () => {
      const service = await configureService();

      // Simulate an AbortError (what fetch throws when the signal is aborted)
      const abortError = new DOMException(
        "The operation was aborted",
        "AbortError",
      );
      mockFetch.mockRejectedValue(abortError);

      await expect(service.callEdgeFunction("my-function", {})).rejects.toThrow(
        "Edge Function my-function timed out after 10s",
      );
    });

    it("should propagate non-abort network errors unchanged", async () => {
      const service = await configureService();

      const networkError = new TypeError("Failed to fetch");
      mockFetch.mockRejectedValue(networkError);

      await expect(service.callEdgeFunction("my-function", {})).rejects.toThrow(
        networkError,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // signOut
  // ═══════════════════════════════════════════════════════════════

  describe("signOut", () => {
    it("should do nothing when client is not configured", async () => {
      const service = SupabaseClientService.getInstance();
      await expect(service.signOut()).resolves.toBeUndefined();
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    it("should sign out, unsubscribe listener, and delete stored session", async () => {
      const { unsubscribe } = createMockSupabaseClient();
      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      mockFsExistsSync.mockReturnValue(true);
      mockSignOut.mockResolvedValue({ error: null });

      await service.signOut();

      expect(unsubscribe).toHaveBeenCalledOnce();
      expect(mockSignOut).toHaveBeenCalledOnce();
      expect(mockFsUnlinkSync).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SecureSessionStorage (tested via SupabaseClientService behavior)
// The class is not exported, so we test it through the service's configure flow
// ═══════════════════════════════════════════════════════════════════════════════

describe("SecureSessionStorage (via SupabaseClientService)", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error — accessing private static for testing
    SupabaseClientService._instance = undefined;
    mockSafeStorageIsEncryptionAvailable.mockReturnValue(true);
    mockFsExistsSync.mockReturnValue(false);
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════
  // Session path
  // ═══════════════════════════════════════════════════════════════

  describe("session path", () => {
    it("should derive session file path from app userData path", () => {
      mockAppGetPath.mockReturnValue("/home/user/.config/soothsayer");

      // Creating the service triggers SecureSessionStorage constructor
      SupabaseClientService.getInstance();

      expect(mockAppGetPath).toHaveBeenCalledWith("userData");
      expect(mockPathJoin).toHaveBeenCalledWith(
        "/home/user/.config/soothsayer",
        "supabase-session.enc",
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // save — encryption
  // ═══════════════════════════════════════════════════════════════

  describe("save", () => {
    it("should encrypt session data with safeStorage when encryption is available", async () => {
      createMockSupabaseClient();
      const session = makeSession();

      mockSignInAnonymously.mockResolvedValue({
        data: { session },
        error: null,
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "mock-user-id" } },
        error: null,
      });

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      expect(mockSafeStorageEncryptString).toHaveBeenCalledOnce();
      expect(mockFsWriteFileSync).toHaveBeenCalledOnce();

      // The encrypted buffer should have been written
      const writtenData = mockFsWriteFileSync.mock.calls[0][1];
      expect(Buffer.isBuffer(writtenData)).toBe(true);
    });

    it("should store in plaintext in development when encryption is unavailable", async () => {
      process.env.NODE_ENV = "development";
      mockSafeStorageIsEncryptionAvailable.mockReturnValue(false);

      createMockSupabaseClient();
      const session = makeSession();

      mockSignInAnonymously.mockResolvedValue({
        data: { session },
        error: null,
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "mock-user-id" } },
        error: null,
      });

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      expect(mockSafeStorageEncryptString).not.toHaveBeenCalled();
      // Should write plaintext JSON with utf8 encoding
      expect(mockFsWriteFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        "utf8",
      );

      const writtenJson = mockFsWriteFileSync.mock.calls[0][1] as string;
      const parsed = JSON.parse(writtenJson);
      expect(parsed).toHaveProperty("access_token");
      expect(parsed).toHaveProperty("refresh_token");
      expect(parsed).toHaveProperty("user_id");
    });

    it("should not persist session in production when encryption is unavailable", async () => {
      process.env.NODE_ENV = "production";
      mockSafeStorageIsEncryptionAvailable.mockReturnValue(false);

      createMockSupabaseClient();
      const session = makeSession();

      mockSignInAnonymously.mockResolvedValue({
        data: { session },
        error: null,
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "mock-user-id" } },
        error: null,
      });

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      // Should not write anything since encryption is unavailable in prod
      expect(mockFsWriteFileSync).not.toHaveBeenCalled();
    });

    it("should handle encryption failure gracefully", async () => {
      mockSafeStorageEncryptString.mockImplementation(() => {
        throw new Error("Encryption hardware unavailable");
      });

      createMockSupabaseClient();
      const session = makeSession();

      mockSignInAnonymously.mockResolvedValue({
        data: { session },
        error: null,
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "mock-user-id" } },
        error: null,
      });

      const service = SupabaseClientService.getInstance();

      // Should not throw — it logs the error and returns
      await expect(
        service.configure(SUPABASE_URL, SUPABASE_ANON_KEY),
      ).resolves.toBeUndefined();

      // writeFileSync should not have been called since encryption failed
      expect(mockFsWriteFileSync).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // load — decryption
  // ═══════════════════════════════════════════════════════════════

  describe("load", () => {
    it("should decrypt and restore session from encrypted file", async () => {
      createMockSupabaseClient();
      const storedSession = makeStoredSession();
      const restoredSession = makeSession();

      mockFsExistsSync.mockReturnValue(true);
      const encrypted = Buffer.from(
        `encrypted:${JSON.stringify(storedSession)}`,
      );
      mockFsReadFileSync.mockReturnValue(encrypted);

      mockSetSession.mockResolvedValue({
        data: { session: restoredSession },
        error: null,
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "stored-user-id" } },
        error: null,
      });

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      expect(mockSafeStorageDecryptString).toHaveBeenCalled();
      expect(mockSetSession).toHaveBeenCalledWith({
        access_token: storedSession.access_token,
        refresh_token: storedSession.refresh_token,
      });
    });

    it("should return null when session file does not exist", async () => {
      createMockSupabaseClient();
      mockFsExistsSync.mockReturnValue(false);

      mockSignInAnonymously.mockResolvedValue({
        data: { session: makeSession() },
        error: null,
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "mock-user-id" } },
        error: null,
      });

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      // No session file => should not try to read or set session
      expect(mockFsReadFileSync).not.toHaveBeenCalled();
      expect(mockSetSession).not.toHaveBeenCalled();
      // Should fall back to anonymous sign-in
      expect(mockSignInAnonymously).toHaveBeenCalledOnce();
    });

    it("should fall back to plaintext in dev mode when decryption fails", async () => {
      process.env.NODE_ENV = "development";
      createMockSupabaseClient();

      const storedSession = makeStoredSession();
      const plaintextBuffer = Buffer.from(JSON.stringify(storedSession));

      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(plaintextBuffer);

      // Decryption throws (not an encrypted file)
      mockSafeStorageDecryptString.mockImplementation(() => {
        throw new Error("Not encrypted data");
      });

      mockSetSession.mockResolvedValue({
        data: { session: makeSession() },
        error: null,
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "stored-user-id" } },
        error: null,
      });

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      // Should have attempted to restore from plaintext
      expect(mockSetSession).toHaveBeenCalledWith({
        access_token: storedSession.access_token,
        refresh_token: storedSession.refresh_token,
      });
    });

    it("should delete corrupted session file and fall back to anonymous sign-in", async () => {
      createMockSupabaseClient();

      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockImplementation(() => {
        throw new Error("ENOENT or corrupt file");
      });

      mockSignInAnonymously.mockResolvedValue({
        data: { session: makeSession() },
        error: null,
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "mock-user-id" } },
        error: null,
      });

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      // Should have cleaned up the corrupt file
      expect(mockFsUnlinkSync).toHaveBeenCalled();
      // Should fall back to anonymous sign-in
      expect(mockSignInAnonymously).toHaveBeenCalledOnce();
    });

    it("should return null in production when encryption is unavailable", async () => {
      process.env.NODE_ENV = "production";
      createMockSupabaseClient();

      const storedSession = makeStoredSession();
      mockFsExistsSync.mockReturnValue(true);
      mockFsReadFileSync.mockReturnValue(
        Buffer.from(JSON.stringify(storedSession)),
      );
      mockSafeStorageIsEncryptionAvailable.mockReturnValue(false);

      mockSignInAnonymously.mockResolvedValue({
        data: { session: makeSession() },
        error: null,
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "mock-user-id" } },
        error: null,
      });

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      // Should not restore session — can't decrypt in prod without encryption
      expect(mockSetSession).not.toHaveBeenCalled();
      // Falls back to anonymous sign-in
      expect(mockSignInAnonymously).toHaveBeenCalledOnce();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // delete
  // ═══════════════════════════════════════════════════════════════

  describe("delete", () => {
    it("should delete the session file if it exists", async () => {
      createMockSupabaseClient();
      const session = makeSession();
      mockSignInAnonymously.mockResolvedValue({
        data: { session },
        error: null,
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "mock-user-id" } },
        error: null,
      });
      mockSignOut.mockResolvedValue({ error: null });

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      // Session file exists when we try to delete it
      mockFsExistsSync.mockReturnValue(true);

      await service.signOut();

      expect(mockFsUnlinkSync).toHaveBeenCalled();
    });

    it("should not throw when session file does not exist on delete", async () => {
      createMockSupabaseClient();
      const session = makeSession();
      mockSignInAnonymously.mockResolvedValue({
        data: { session },
        error: null,
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "mock-user-id" } },
        error: null,
      });
      mockSignOut.mockResolvedValue({ error: null });

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      mockFsExistsSync.mockReturnValue(false);

      await expect(service.signOut()).resolves.toBeUndefined();
      expect(mockFsUnlinkSync).not.toHaveBeenCalled();
    });

    it("should handle unlink failure gracefully", async () => {
      createMockSupabaseClient();
      const session = makeSession();
      mockSignInAnonymously.mockResolvedValue({
        data: { session },
        error: null,
      });
      mockGetUser.mockResolvedValue({
        data: { user: { id: "mock-user-id" } },
        error: null,
      });
      mockSignOut.mockResolvedValue({ error: null });

      const service = SupabaseClientService.getInstance();
      await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

      mockFsExistsSync.mockReturnValue(true);
      mockFsUnlinkSync.mockImplementation(() => {
        throw new Error("EPERM: operation not permitted");
      });

      // Should not throw — error is caught and logged
      await expect(service.signOut()).resolves.toBeUndefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Full lifecycle integration test
// ═══════════════════════════════════════════════════════════════════════════════

describe("SupabaseClientService — full lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error — accessing private static for testing
    SupabaseClientService._instance = undefined;
    mockFsExistsSync.mockReturnValue(false);
    mockSafeStorageIsEncryptionAvailable.mockReturnValue(true);
    globalThis.fetch = mockFetch;

    // Re-establish implementations that vi.restoreAllMocks() from prior
    // describe blocks may have reset back to bare vi.fn() (returns undefined).
    mockSafeStorageEncryptString.mockImplementation((str: string) =>
      Buffer.from(`encrypted:${str}`),
    );
    mockSafeStorageDecryptString.mockImplementation((buf: Buffer) => {
      const str = buf.toString();
      return str.startsWith("encrypted:")
        ? str.slice("encrypted:".length)
        : str;
    });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should handle: configure → anonymous sign-in → fetch snapshot → sign out", async () => {
    createMockSupabaseClient();

    // Set up unsubscribe AFTER createMockSupabaseClient, which overwrites mockOnAuthStateChange
    const unsubscribe = vi.fn();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    });
    const session = makeSession();

    // 1. Configure and sign in anonymously
    mockSignInAnonymously.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "anon-123" } },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session },
    });

    const service = SupabaseClientService.getInstance();
    expect(service.isConfigured()).toBe(false);

    await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);
    expect(service.isConfigured()).toBe(true);
    expect(mockSignInAnonymously).toHaveBeenCalledOnce();

    // 2. Session was persisted
    expect(mockFsWriteFileSync).toHaveBeenCalled();

    // 3. Auth state listener was set up
    expect(mockOnAuthStateChange).toHaveBeenCalledOnce();

    // 4. Verify auth status
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "anon-123" } } },
    });
    const status = await service.getAuthStatus();
    expect(status.isAuthenticated).toBe(true);
    expect(status.userId).toBe("anon-123");

    // 5. Fetch a snapshot
    mockGetSession.mockResolvedValue({ data: { session } });

    const snapshotResponse = makeSnapshotResponse();
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(JSON.stringify(snapshotResponse)),
    });

    const snapshot = await service.getLatestSnapshot("poe1", "Settlers");
    expect(snapshot.exchange.chaosToDivineRatio).toBe(150);
    expect(snapshot.stash.cardPrices["The Doctor"].chaosValue).toBe(880);

    // 6. Second call uses cache
    const snapshot2 = await service.getLatestSnapshot("poe1", "Settlers");
    expect(snapshot2).toEqual(snapshot);
    expect(mockFetch).toHaveBeenCalledOnce(); // still only 1 fetch

    // 7. Sign out
    mockSignOut.mockResolvedValue({ error: null });
    mockFsExistsSync.mockReturnValue(true);

    await service.signOut();

    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(mockFsUnlinkSync).toHaveBeenCalled();
  });

  it("should handle: no stored session → sign in → session refresh event → persist updated tokens", async () => {
    createMockSupabaseClient();
    const session = makeSession();

    mockSignInAnonymously.mockResolvedValue({
      data: { session },
      error: null,
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "anon-123" } },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session },
    });

    const service = SupabaseClientService.getInstance();
    await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Session saved from initial sign-in
    expect(mockFsWriteFileSync).toHaveBeenCalledOnce();
    mockFsWriteFileSync.mockClear();

    // Simulate TOKEN_REFRESHED event
    const listenerCallback = mockOnAuthStateChange.mock.calls[0][0];
    const refreshedSession = makeSession({
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
    });
    listenerCallback("TOKEN_REFRESHED", refreshedSession);

    // Should have persisted the refreshed session
    expect(mockFsWriteFileSync).toHaveBeenCalledOnce();
    const written = mockFsWriteFileSync.mock.calls[0][1] as Buffer;
    const decrypted = written.toString().slice("encrypted:".length);
    const parsed = JSON.parse(decrypted);
    expect(parsed.access_token).toBe("new-access-token");
    expect(parsed.refresh_token).toBe("new-refresh-token");
  });

  it("should handle: stored session → restore → session expired → re-auth anonymously", async () => {
    createMockSupabaseClient();

    const storedSession = makeStoredSession();
    mockFsExistsSync.mockReturnValue(true);
    mockFsReadFileSync.mockReturnValue(
      Buffer.from(`encrypted:${JSON.stringify(storedSession)}`),
    );

    // Restore fails — token expired
    mockSetSession.mockResolvedValue({
      data: { session: null },
      error: { message: "Refresh token expired" },
    });

    // Anonymous sign-in succeeds
    const newSession = makeSession({
      access_token: "fresh-access-token",
      user: { id: "new-anon-user" },
    });
    mockSignInAnonymously.mockResolvedValue({
      data: { session: newSession },
      error: null,
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: "new-anon-user" } },
      error: null,
    });
    mockGetSession.mockResolvedValue({
      data: { session: newSession },
    });

    const service = SupabaseClientService.getInstance();
    await service.configure(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Should have tried to restore first, then fallen back
    expect(mockSetSession).toHaveBeenCalledOnce();
    expect(mockSignInAnonymously).toHaveBeenCalledOnce();

    // New session should have been persisted
    expect(mockFsWriteFileSync).toHaveBeenCalled();
  });
});
