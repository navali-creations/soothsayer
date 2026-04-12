import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDatabaseServiceMock,
  createElectronMock,
  createIpcValidationMock,
  createSettingsStoreMock,
  createSupabaseClientMock,
  getIpcHandler,
} from "~/main/modules/__test-utils__/mock-factories";
import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const {
  mockIpcHandle,
  mockGetKysely,
  mockSettingsGet,
  mockSettingsSet,
  mockIsConfigured,
  mockCallEdgeFunction,
  mockAssertBoolean,
  mockAssertGameType,
  mockAssertBoundedString,
  mockHandleValidationError,
  MockIpcValidationError,
  mockSentryCaptureException,
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
    mockGetKysely: vi.fn(),
    mockSettingsGet: vi.fn(),
    mockSettingsSet: vi.fn(),
    mockIsConfigured: vi.fn(),
    mockCallEdgeFunction: vi.fn(),
    mockAssertBoolean: vi.fn(),
    mockAssertGameType: vi.fn(),
    mockAssertBoundedString: vi.fn(),
    mockHandleValidationError: vi.fn((error: unknown) => {
      throw error;
    }),
    MockIpcValidationError: _MockIpcValidationError,
    mockSentryCaptureException: vi.fn(),
  };
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("electron", () => createElectronMock({ mockIpcHandle }));

vi.mock("~/main/modules/database", () =>
  createDatabaseServiceMock({ mockGetKysely }),
);

vi.mock("~/main/modules/settings-store", () =>
  createSettingsStoreMock({
    mockGet: mockSettingsGet,
    mockSet: mockSettingsSet,
  }),
);

vi.mock("~/main/modules/supabase", () =>
  createSupabaseClientMock({
    mockIsConfigured,
    mockCallEdgeFunction,
  }),
);

vi.mock("~/main/utils/ipc-validation", () =>
  createIpcValidationMock({
    mockAssertBoolean,
    mockAssertGameType,
    mockAssertBoundedString,
    mockHandleValidationError,
    MockIpcValidationError,
  }),
);

vi.mock("@sentry/electron/main", () => ({
  captureException: mockSentryCaptureException,
  captureMessage: vi.fn(),
  init: vi.fn(),
  setTag: vi.fn(),
  setUser: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

// ─── Kysely mock builder ────────────────────────────────────────────────────
// A chainable mock that simulates Kysely's query builder pattern.

function createKyselyChain(result: unknown = undefined) {
  const chain: Record<string, any> = {};
  const methods = [
    "selectFrom",
    "insertInto",
    "select",
    "selectAll",
    "where",
    "values",
    "onConflict",
    "column",
    "columns",
    "doUpdateSet",
    "set",
    "orderBy",
    "limit",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain.executeTakeFirst = vi.fn().mockResolvedValue(result);
  chain.execute = vi
    .fn()
    .mockResolvedValue(Array.isArray(result) ? result : result ? [result] : []);
  return chain;
}

import { CommunityUploadChannel } from "../CommunityUpload.channels";
// ─── Import SUT (after mocks) ────────────────────────────────────────────────
import { CommunityUploadService } from "../CommunityUpload.service";

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("CommunityUploadService", () => {
  let service: CommunityUploadService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: uploads enabled, supabase configured
    mockSettingsGet.mockResolvedValue(true);
    mockIsConfigured.mockReturnValue(true);
  });

  afterEach(() => {
    resetSingleton(CommunityUploadService);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Singleton
  // ─────────────────────────────────────────────────────────────────────────

  describe("singleton", () => {
    it("should return the same instance on repeated calls", () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);

      const a = CommunityUploadService.getInstance();
      const b = CommunityUploadService.getInstance();
      expect(a).toBe(b);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // IPC: GetUploadStatus
  // ─────────────────────────────────────────────────────────────────────────

  describe("IPC: GetUploadStatus", () => {
    it("should register all IPC handlers", () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      service = CommunityUploadService.getInstance();

      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch,
      );
      expect(registeredChannels).toContain(
        CommunityUploadChannel.GetUploadStatus,
      );
      expect(registeredChannels).toContain(
        CommunityUploadChannel.SetUploadsEnabled,
      );
      expect(registeredChannels).toContain(
        CommunityUploadChannel.GetUploadStats,
      );
    });

    it("should return enabled status, device ID, and last upload time", async () => {
      // Set up Kysely to return different results for different queries
      const deviceIdChain = createKyselyChain({ value: "test-device-uuid" });
      const lastUploadChain = createKyselyChain({
        value: "2025-01-15T10:00:00Z",
      });

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          // First call: device_id, second: last upload, third: device_id again etc.
          if (selectFromCallCount % 2 === 1) return deviceIdChain;
          return lastUploadChain;
        }),
        insertInto: vi.fn().mockReturnValue(createKyselyChain()),
      };
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockResolvedValue(true);

      service = CommunityUploadService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.GetUploadStatus,
      );

      const result = await handler({});

      expect(result).toEqual({
        enabled: true,
        deviceId: "test-device-uuid",
        lastUploadAt: "2025-01-15T10:00:00Z",
      });
    });

    it("should return null lastUploadAt when no upload has occurred", async () => {
      const deviceIdChain = createKyselyChain({ value: "test-device-uuid" });
      const noResultChain = createKyselyChain(undefined);

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          if (selectFromCallCount % 2 === 1) return deviceIdChain;
          return noResultChain;
        }),
        insertInto: vi.fn().mockReturnValue(createKyselyChain()),
      };
      mockGetKysely.mockReturnValue(kyselyMock);

      service = CommunityUploadService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.GetUploadStatus,
      );

      const result = await handler({});

      expect(result.lastUploadAt).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // IPC: SetUploadsEnabled
  // ─────────────────────────────────────────────────────────────────────────

  describe("IPC: SetUploadsEnabled", () => {
    it("should call settingsStore.set with the correct key", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);

      service = CommunityUploadService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.SetUploadsEnabled,
      );

      const result = await handler({}, true);

      expect(mockAssertBoolean).toHaveBeenCalledWith(
        true,
        "enabled",
        CommunityUploadChannel.SetUploadsEnabled,
      );
      expect(mockSettingsSet).toHaveBeenCalledWith(
        "communityUploadsEnabled",
        true,
      );
      expect(result).toEqual({ success: true });
    });

    it("should call settingsStore.set with false", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);

      service = CommunityUploadService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.SetUploadsEnabled,
      );

      await handler({}, false);

      expect(mockSettingsSet).toHaveBeenCalledWith(
        "communityUploadsEnabled",
        false,
      );
    });

    it("should validate the enabled parameter", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);

      mockAssertBoolean.mockImplementation(() => {
        throw new MockIpcValidationError(
          CommunityUploadChannel.SetUploadsEnabled,
          "Expected boolean",
        );
      });
      mockHandleValidationError.mockReturnValue({
        success: false,
        error: "Invalid input",
      });

      service = CommunityUploadService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.SetUploadsEnabled,
      );

      const result = await handler({}, "not-a-boolean");

      expect(mockHandleValidationError).toHaveBeenCalled();
      expect(result).toEqual({ success: false, error: "Invalid input" });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // IPC: GetUploadStats
  // ─────────────────────────────────────────────────────────────────────────

  describe("IPC: GetUploadStats", () => {
    it("should return upload count and last upload time", async () => {
      const countChain = createKyselyChain({ value: "5" });
      const lastUploadChain = createKyselyChain({
        value: "2025-01-15T10:00:00Z",
      });

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          if (selectFromCallCount % 2 === 1) return countChain;
          return lastUploadChain;
        }),
        insertInto: vi.fn().mockReturnValue(createKyselyChain()),
      };
      mockGetKysely.mockReturnValue(kyselyMock);

      service = CommunityUploadService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.GetUploadStats,
      );

      const result = await handler({}, "poe2", "Settlers");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe2",
        CommunityUploadChannel.GetUploadStats,
      );
      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "Settlers",
        "league",
        CommunityUploadChannel.GetUploadStats,
        256,
      );
      expect(result).toEqual({
        totalUploads: 5,
        lastUploadAt: "2025-01-15T10:00:00Z",
      });
    });

    it("should return zero uploads when no data exists", async () => {
      const noResultChain = createKyselyChain(undefined);
      const kyselyMock = {
        selectFrom: vi.fn(() => noResultChain),
        insertInto: vi.fn().mockReturnValue(createKyselyChain()),
      };
      mockGetKysely.mockReturnValue(kyselyMock);

      service = CommunityUploadService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.GetUploadStats,
      );

      const result = await handler({}, "poe1", "Standard");

      expect(result).toEqual({
        totalUploads: 0,
        lastUploadAt: null,
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // uploadOnSessionEnd
  // ─────────────────────────────────────────────────────────────────────────

  describe("uploadOnSessionEnd", () => {
    const MOCK_DEVICE_ID = "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee";
    const MOCK_CARDS = [
      { card_name: "The Doctor", count: 3 },
      { card_name: "House of Mirrors", count: 1 },
    ];
    const MOCK_EDGE_RESPONSE = {
      success: true,
      upload_id: "upload-uuid-123",
      total_cards: 4,
      unique_cards: 2,
      upload_count: 1,
      is_verified: false,
    };

    function setupKyselyForUpload(options?: {
      cards?: { card_name: string; count: number }[];
      deviceId?: string;
    }) {
      const cards = options?.cards ?? MOCK_CARDS;
      const deviceId = options?.deviceId ?? MOCK_DEVICE_ID;

      const deviceIdChain = createKyselyChain({ value: deviceId });
      const cardsChain = createKyselyChain(cards);
      const insertChain = createKyselyChain();

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          // First selectFrom call = device_id lookup (from getDeviceId)
          if (selectFromCallCount === 1) return deviceIdChain;
          // Second selectFrom call = cards query
          return cardsChain;
        }),
        insertInto: vi.fn().mockReturnValue(insertChain),
      };
      mockGetKysely.mockReturnValue(kyselyMock);
      return kyselyMock;
    }

    it("should call the edge function with correct payload", async () => {
      setupKyselyForUpload();
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      expect(mockCallEdgeFunction).toHaveBeenCalledWith(
        "upload-community-data",
        {
          league_name: "Settlers",
          game: "poe2",
          device_id: MOCK_DEVICE_ID,
          cards: [
            { card_name: "The Doctor", count: 3 },
            { card_name: "House of Mirrors", count: 1 },
          ],
        },
      );
    });

    it("should skip upload when uploads are disabled", async () => {
      setupKyselyForUpload();
      mockSettingsGet.mockResolvedValue(false);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("should skip upload when Supabase is not configured", async () => {
      setupKyselyForUpload();
      mockIsConfigured.mockReturnValue(false);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("should skip upload when there are no cards for the league", async () => {
      setupKyselyForUpload({ cards: [] });

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("should store last upload time on success", async () => {
      const kyselyMock = setupKyselyForUpload();
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      // insertInto is called for storing last upload time and upload count
      expect(kyselyMock.insertInto).toHaveBeenCalled();
      const insertCalls = kyselyMock.insertInto.mock.calls;
      // All inserts go to app_metadata
      for (const call of insertCalls) {
        expect(call[0]).toBe("app_metadata");
      }
    });

    it("should not throw on edge function failure (fire-and-forget)", async () => {
      setupKyselyForUpload();
      mockCallEdgeFunction.mockRejectedValue(
        new Error("Edge Function upload-community-data failed (500)"),
      );

      service = CommunityUploadService.getInstance();

      // Should not throw
      await expect(
        service.uploadOnSessionEnd("poe2", "Settlers"),
      ).resolves.toBeUndefined();
    });

    it("should report errors to Sentry on failure", async () => {
      setupKyselyForUpload();
      const edgeError = new Error("Network timeout");
      mockCallEdgeFunction.mockRejectedValue(edgeError);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      expect(mockSentryCaptureException).toHaveBeenCalledWith(
        edgeError,
        expect.objectContaining({
          tags: {
            module: "community-upload",
            operation: "upload-on-session-end",
          },
          extra: { game: "poe2", league: "Settlers" },
        }),
      );
    });

    it("should not report to Sentry when upload is simply skipped", async () => {
      setupKyselyForUpload();
      mockSettingsGet.mockResolvedValue(false);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe1", "Standard");

      expect(mockSentryCaptureException).not.toHaveBeenCalled();
    });

    it("should work with poe1 game type", async () => {
      setupKyselyForUpload();
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe1", "Standard");

      expect(mockCallEdgeFunction).toHaveBeenCalledWith(
        "upload-community-data",
        expect.objectContaining({
          game: "poe1",
          league_name: "Standard",
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // isEnabled
  // ─────────────────────────────────────────────────────────────────────────

  describe("isEnabled", () => {
    it("should return true when setting is true", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockResolvedValue(true);

      service = CommunityUploadService.getInstance();
      const result = await service.isEnabled();

      expect(result).toBe(true);
    });

    it("should return false when setting is false", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockResolvedValue(false);

      service = CommunityUploadService.getInstance();
      const result = await service.isEnabled();

      expect(result).toBe(false);
    });

    it("should default to true when setting is undefined", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockResolvedValue(undefined);

      service = CommunityUploadService.getInstance();
      const result = await service.isEnabled();

      expect(result).toBe(true);
    });

    it("should default to true when setting is null", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockResolvedValue(null);

      service = CommunityUploadService.getInstance();
      const result = await service.isEnabled();

      expect(result).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getDeviceId
  // ─────────────────────────────────────────────────────────────────────────

  describe("getDeviceId", () => {
    it("should return the device_id from app_metadata", async () => {
      const kyselyMock = createKyselyChain({
        value: "my-device-uuid",
      });
      mockGetKysely.mockReturnValue(kyselyMock);

      service = CommunityUploadService.getInstance();
      const result = await service.getDeviceId();

      expect(result).toBe("my-device-uuid");
    });

    it("should throw when device_id is not found", async () => {
      const kyselyMock = createKyselyChain(undefined);
      mockGetKysely.mockReturnValue(kyselyMock);

      service = CommunityUploadService.getInstance();

      await expect(service.getDeviceId()).rejects.toThrow(
        "device_id not found in app_metadata",
      );
    });
  });
});
