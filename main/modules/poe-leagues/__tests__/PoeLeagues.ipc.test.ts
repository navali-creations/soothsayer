import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createBarrelMock,
  createDatabaseServiceMock,
  createElectronMock,
  createIpcValidationMock,
  createSupabaseClientMock,
  getIpcHandler,
} from "~/main/modules/__test-utils__/mock-factories";
import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const {
  mockIpcHandle,
  mockGetKysely,
  mockIsConfigured,
  mockCallEdgeFunction,
  mockSettingsGet,
  mockSettingsSet,
  mockRepoIsCacheStale,
  mockRepoGetActiveLeaguesByGame,
  mockRepoUpsertLeagues,
  mockRepoDeactivateStaleLeagues,
  mockRepoUpsertCacheMetadata,
  mockAssertGameType,
  mockAssertBoundedString,
  mockHandleValidationError,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockGetKysely: vi.fn(),
  mockIsConfigured: vi.fn(),
  mockCallEdgeFunction: vi.fn(),
  mockSettingsGet: vi.fn(),
  mockSettingsSet: vi.fn(),
  mockRepoIsCacheStale: vi.fn(),
  mockRepoGetActiveLeaguesByGame: vi.fn(),
  mockRepoUpsertLeagues: vi.fn(),
  mockRepoDeactivateStaleLeagues: vi.fn(),
  mockRepoUpsertCacheMetadata: vi.fn(),
  mockAssertGameType: vi.fn(),
  mockAssertBoundedString: vi.fn(),
  mockHandleValidationError: vi.fn(),
}));

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => createElectronMock({ mockIpcHandle }));

// ─── Mock DatabaseService ────────────────────────────────────────────────────
vi.mock("~/main/modules/database", () =>
  createDatabaseServiceMock({ mockGetKysely }),
);

// ─── Mock SupabaseClientService ──────────────────────────────────────────────
vi.mock("~/main/modules/supabase", () =>
  createSupabaseClientMock({
    mockIsConfigured,
    mockCallEdgeFunction,
  }),
);

// ─── Mock SettingsStoreService ───────────────────────────────────────────────
vi.mock("~/main/modules", () =>
  createBarrelMock({
    SettingsStoreService: {
      getInstance: vi.fn(() => ({
        get: mockSettingsGet,
        set: mockSettingsSet,
        getAllSettings: vi.fn(),
      })),
    },
  }),
);

// ─── Mock PoeLeaguesRepository ───────────────────────────────────────────────
vi.mock("../PoeLeagues.repository", () => ({
  PoeLeaguesRepository: class MockPoeLeaguesRepository {
    isCacheStale = mockRepoIsCacheStale;
    getActiveLeaguesByGame = mockRepoGetActiveLeaguesByGame;
    upsertLeagues = mockRepoUpsertLeagues;
    deactivateStaleLeagues = mockRepoDeactivateStaleLeagues;
    upsertCacheMetadata = mockRepoUpsertCacheMetadata;
  },
}));

// ─── Mock IPC validation utils ───────────────────────────────────────────────
vi.mock("~/main/utils/ipc-validation", () =>
  createIpcValidationMock({
    mockAssertGameType,
    mockAssertBoundedString,
    mockHandleValidationError,
  }),
);

// ─── Import under test ──────────────────────────────────────────────────────
import { PoeLeaguesChannel } from "../PoeLeagues.channels";
import { PoeLeaguesService } from "../PoeLeagues.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PoeLeaguesService — IPC handlers", () => {
  let _service: PoeLeaguesService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    resetSingleton(PoeLeaguesService);

    // Reset validation mocks to no-op implementations
    mockAssertGameType.mockImplementation(() => {});
    mockAssertBoundedString.mockImplementation(() => {});
    mockHandleValidationError.mockImplementation(() => ({
      success: false,
      error: "Validation error",
    }));

    // Default mock return values
    mockIsConfigured.mockReturnValue(true);
    mockSettingsGet.mockResolvedValue("poe1");
    mockRepoIsCacheStale.mockResolvedValue(true);
    mockRepoGetActiveLeaguesByGame.mockResolvedValue([]);
    mockRepoUpsertLeagues.mockResolvedValue(undefined);
    mockRepoDeactivateStaleLeagues.mockResolvedValue(0);
    mockRepoUpsertCacheMetadata.mockResolvedValue(undefined);

    _service = PoeLeaguesService.getInstance();
  });

  afterEach(() => {
    resetSingleton(PoeLeaguesService);
    vi.restoreAllMocks();
  });

  // ─── Handler registration ────────────────────────────────────────────────

  describe("handler registration", () => {
    it("should register handlers for all expected IPC channels", () => {
      const registeredChannels = (
        mockIpcHandle.mock.calls as [string, unknown][]
      ).map(([ch]: [string]) => ch);

      expect(registeredChannels).toContain(PoeLeaguesChannel.FetchLeagues);
      expect(registeredChannels).toContain(PoeLeaguesChannel.GetSelectedLeague);
      expect(registeredChannels).toContain(PoeLeaguesChannel.SelectLeague);
    });

    it("should register exactly 3 IPC handlers", () => {
      expect(mockIpcHandle).toHaveBeenCalledTimes(3);
    });
  });

  // ─── FetchLeagues handler ────────────────────────────────────────────────

  describe("FetchLeagues handler", () => {
    it("should validate game type and delegate to fetchLeagues", async () => {
      mockRepoIsCacheStale.mockResolvedValue(false);
      mockRepoGetActiveLeaguesByGame.mockResolvedValue([
        {
          leagueId: "Settlers",
          name: "Settlers of Kalguur",
          startAt: "2025-01-01",
          endAt: null,
        },
      ]);

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.FetchLeagues,
      );
      const result = await handler({}, "poe1");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        PoeLeaguesChannel.FetchLeagues,
      );
      expect(result).toEqual([
        {
          id: "Settlers",
          name: "Settlers of Kalguur",
          startAt: "2025-01-01",
          endAt: null,
        },
      ]);
    });

    it("should handle validation errors for invalid game type", async () => {
      const validationError = new Error("Invalid game");
      validationError.name = "IpcValidationError";
      mockAssertGameType.mockImplementationOnce(() => {
        throw validationError;
      });

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.FetchLeagues,
      );
      await handler({}, "bad-game");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        PoeLeaguesChannel.FetchLeagues,
      );
    });

    it("should not call fetchLeagues when validation fails", async () => {
      mockAssertGameType.mockImplementationOnce(() => {
        throw new Error("Invalid");
      });

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.FetchLeagues,
      );
      await handler({}, null);

      expect(mockRepoIsCacheStale).not.toHaveBeenCalled();
      expect(mockRepoGetActiveLeaguesByGame).not.toHaveBeenCalled();
    });

    it("should return validation error result for non-string game", async () => {
      const validationError = new Error("Not a string");
      validationError.name = "IpcValidationError";
      mockAssertGameType.mockImplementationOnce(() => {
        throw validationError;
      });
      const errorPayload = {
        success: false,
        error: "Invalid input: bad game",
      };
      mockHandleValidationError.mockReturnValueOnce(errorPayload);

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.FetchLeagues,
      );
      const result = await handler({}, 42);

      expect(result).toEqual(errorPayload);
    });
  });

  // ─── GetSelectedLeague handler ───────────────────────────────────────────

  describe("GetSelectedLeague handler", () => {
    it("should return the selected poe1 league when activeGame is poe1", async () => {
      mockSettingsGet
        .mockResolvedValueOnce("poe1") // ActiveGame
        .mockResolvedValueOnce("Settlers"); // SelectedPoe1League

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.GetSelectedLeague,
      );
      const result = await handler({});

      expect(mockSettingsGet).toHaveBeenCalledWith("selectedGame");
      expect(mockSettingsGet).toHaveBeenCalledWith("poe1SelectedLeague");
      expect(result).toBe("Settlers");
    });

    it("should return the selected poe2 league when activeGame is poe2", async () => {
      mockSettingsGet
        .mockResolvedValueOnce("poe2") // ActiveGame
        .mockResolvedValueOnce("Standard"); // SelectedPoe2League

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.GetSelectedLeague,
      );
      const result = await handler({});

      expect(mockSettingsGet).toHaveBeenCalledWith("selectedGame");
      expect(mockSettingsGet).toHaveBeenCalledWith("poe2SelectedLeague");
      expect(result).toBe("Standard");
    });

    it("should return empty string when no poe1 league is selected", async () => {
      mockSettingsGet
        .mockResolvedValueOnce("poe1") // ActiveGame
        .mockResolvedValueOnce(null); // SelectedPoe1League is null

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.GetSelectedLeague,
      );
      const result = await handler({});

      expect(result).toBe("");
    });

    it("should return empty string when no poe2 league is selected", async () => {
      mockSettingsGet
        .mockResolvedValueOnce("poe2") // ActiveGame
        .mockResolvedValueOnce(null); // SelectedPoe2League is null

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.GetSelectedLeague,
      );
      const result = await handler({});

      expect(result).toBe("");
    });

    it("should return empty string when selected league is undefined", async () => {
      mockSettingsGet
        .mockResolvedValueOnce("poe1")
        .mockResolvedValueOnce(undefined);

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.GetSelectedLeague,
      );
      const result = await handler({});

      expect(result).toBe("");
    });

    it("should default to poe2 league key when activeGame is not poe1", async () => {
      // When activeGame is something unexpected, it falls into the else branch
      mockSettingsGet
        .mockResolvedValueOnce("something-else") // ActiveGame
        .mockResolvedValueOnce("FallbackLeague"); // SelectedPoe2League

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.GetSelectedLeague,
      );
      const result = await handler({});

      expect(mockSettingsGet).toHaveBeenCalledWith("poe2SelectedLeague");
      expect(result).toBe("FallbackLeague");
    });
  });

  // ─── SelectLeague handler ────────────────────────────────────────────────

  describe("SelectLeague handler", () => {
    it("should validate leagueId and set poe1 league when activeGame is poe1", async () => {
      mockSettingsGet.mockResolvedValue("poe1"); // ActiveGame

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.SelectLeague,
      );
      const result = await handler({}, "Settlers");

      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "Settlers",
        "leagueId",
        PoeLeaguesChannel.SelectLeague,
        40,
      );
      expect(mockSettingsGet).toHaveBeenCalledWith("selectedGame");
      expect(mockSettingsSet).toHaveBeenCalledWith(
        "poe1SelectedLeague",
        "Settlers",
      );
      expect(result).toEqual({ success: true, league: "Settlers" });
    });

    it("should set poe2 league when activeGame is poe2", async () => {
      mockSettingsGet.mockResolvedValue("poe2"); // ActiveGame

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.SelectLeague,
      );
      const result = await handler({}, "Standard");

      expect(mockSettingsSet).toHaveBeenCalledWith(
        "poe2SelectedLeague",
        "Standard",
      );
      expect(result).toEqual({ success: true, league: "Standard" });
    });

    it("should default to poe2 league key when activeGame is not poe1", async () => {
      mockSettingsGet.mockResolvedValue("something-else");

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.SelectLeague,
      );
      const result = await handler({}, "MyLeague");

      expect(mockSettingsSet).toHaveBeenCalledWith(
        "poe2SelectedLeague",
        "MyLeague",
      );
      expect(result).toEqual({ success: true, league: "MyLeague" });
    });

    it("should handle validation errors for invalid leagueId", async () => {
      const validationError = new Error("Invalid leagueId");
      validationError.name = "IpcValidationError";
      mockAssertBoundedString.mockImplementationOnce(() => {
        throw validationError;
      });

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.SelectLeague,
      );
      await handler({}, 12345);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        PoeLeaguesChannel.SelectLeague,
      );
    });

    it("should handle validation errors for non-string leagueId", async () => {
      const validationError = new Error("Not a string");
      validationError.name = "IpcValidationError";
      mockAssertBoundedString.mockImplementationOnce(() => {
        throw validationError;
      });

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.SelectLeague,
      );
      await handler({}, null);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        PoeLeaguesChannel.SelectLeague,
      );
    });

    it("should handle validation errors for leagueId exceeding max length", async () => {
      const validationError = new Error("Exceeds max length");
      validationError.name = "IpcValidationError";
      mockAssertBoundedString.mockImplementationOnce(() => {
        throw validationError;
      });

      const longId = "a".repeat(41);
      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.SelectLeague,
      );
      await handler({}, longId);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        PoeLeaguesChannel.SelectLeague,
      );
    });

    it("should return validation error result when leagueId is invalid", async () => {
      const validationError = new Error("Invalid");
      validationError.name = "IpcValidationError";
      mockAssertBoundedString.mockImplementationOnce(() => {
        throw validationError;
      });
      const errorPayload = {
        success: false,
        error: "Invalid input: leagueId",
      };
      mockHandleValidationError.mockReturnValueOnce(errorPayload);

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.SelectLeague,
      );
      const result = await handler({}, undefined);

      expect(result).toEqual(errorPayload);
    });

    it("should not call settingsStore.set when validation fails", async () => {
      mockAssertBoundedString.mockImplementationOnce(() => {
        throw new Error("Invalid");
      });

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.SelectLeague,
      );
      await handler({}, "");

      expect(mockSettingsSet).not.toHaveBeenCalled();
    });

    it("should accept leagueId at exactly max length (40)", async () => {
      mockSettingsGet.mockResolvedValue("poe1");

      const id = "a".repeat(40);
      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.SelectLeague,
      );
      const result = await handler({}, id);

      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        id,
        "leagueId",
        PoeLeaguesChannel.SelectLeague,
        40,
      );
      expect(result).toEqual({ success: true, league: id });
    });
  });

  // ─── Cross-cutting concerns ──────────────────────────────────────────────

  describe("cross-cutting concerns", () => {
    it("should return handleValidationError result when FetchLeagues validation fails", async () => {
      const errorPayload = {
        success: false,
        error: "Invalid input: bad game",
      };
      mockHandleValidationError.mockReturnValueOnce(errorPayload);
      mockAssertGameType.mockImplementationOnce(() => {
        throw new Error("bad game");
      });

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.FetchLeagues,
      );
      const result = await handler({}, "invalid");

      expect(result).toEqual(errorPayload);
    });

    it("should return handleValidationError result when SelectLeague validation fails", async () => {
      const errorPayload = {
        success: false,
        error: "Invalid input: leagueId",
      };
      mockHandleValidationError.mockReturnValueOnce(errorPayload);
      mockAssertBoundedString.mockImplementationOnce(() => {
        throw new Error("Invalid leagueId");
      });

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.SelectLeague,
      );
      const result = await handler({}, null);

      expect(result).toEqual(errorPayload);
    });

    it("should not call settingsStore when FetchLeagues validation fails", async () => {
      mockAssertGameType.mockImplementationOnce(() => {
        throw new Error("Invalid");
      });

      const handler = getIpcHandler(
        mockIpcHandle,
        PoeLeaguesChannel.FetchLeagues,
      );
      await handler({}, "bad");

      expect(mockSettingsGet).not.toHaveBeenCalled();
    });
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe("singleton", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = PoeLeaguesService.getInstance();
      const instance2 = PoeLeaguesService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
});
