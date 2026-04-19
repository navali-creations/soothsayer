import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDatabaseServiceMock,
  createElectronMock,
  createGggAuthServiceMock,
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
  mockAssertTrustedSender,
  mockAssertBoolean,
  mockAssertGameType,
  mockAssertBoundedString,
  mockHandleValidationError,
  MockIpcValidationError,
  mockSentryCaptureException,
  mockGetAccessToken,
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
    mockAssertTrustedSender: vi.fn(),
    mockAssertBoolean: vi.fn(),
    mockAssertGameType: vi.fn(),
    mockAssertBoundedString: vi.fn(),
    mockHandleValidationError: vi.fn((error: unknown) => {
      throw error;
    }),
    MockIpcValidationError: _MockIpcValidationError,
    mockSentryCaptureException: vi.fn(),
    mockGetAccessToken: vi.fn(),
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

vi.mock("~/main/modules/ggg-auth", () =>
  createGggAuthServiceMock({ mockGetAccessToken }),
);

vi.mock("~/main/utils/ipc-validation", () =>
  createIpcValidationMock({
    mockAssertTrustedSender,
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
    "groupBy",
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
      expect(registeredChannels).toContain(
        CommunityUploadChannel.GetBackfillLeagues,
      );
      expect(registeredChannels).toContain(
        CommunityUploadChannel.TriggerBackfill,
      );
    });

    it("should return enabled status, device ID, and last upload time", async () => {
      // isEnabled() only checks settingsStore — no Kysely call.
      // getDeviceId() queries for device_id (call #1),
      // then last upload time (call #2).
      const deviceIdChain = createKyselyChain({ value: "test-device-uuid" });
      const lastUploadChain = createKyselyChain({
        value: "2025-01-15T10:00:00Z",
      });

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          // 1st call: device_id, 2nd+: last upload
          if (selectFromCallCount === 1) return deviceIdChain;
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
          // 1st call: device_id, 2nd+: last upload
          if (selectFromCallCount === 1) return deviceIdChain;
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

    it("should reject set-enabled from untrusted sender", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);

      mockAssertTrustedSender.mockImplementation(() => {
        throw new MockIpcValidationError(
          CommunityUploadChannel.SetUploadsEnabled,
          "[Security] IPC call from untrusted webContents (id=999)",
        );
      });
      mockHandleValidationError.mockReturnValue({
        success: false,
        error:
          "Invalid input: [Security] IPC call from untrusted webContents (id=999)",
      });

      service = CommunityUploadService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.SetUploadsEnabled,
      );

      const result = await handler({ sender: { id: 999 } }, true);

      expect(mockAssertTrustedSender).toHaveBeenCalled();
      expect(mockSettingsSet).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("untrusted webContents"),
      });
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
          // 1st: upload count, 2nd: last upload time
          if (selectFromCallCount === 1) return countChain;
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
      // Empty snapshot so all cards are treated as new (delta logic)
      const snapshotChain = createKyselyChain([]);
      const insertChain = createKyselyChain();

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          // 1st call: device_id lookup (from getDeviceId)
          if (selectFromCallCount === 1) return deviceIdChain;
          // 2nd call: cards query
          if (selectFromCallCount === 2) return cardsChain;
          // 3rd call: snapshot query
          return snapshotChain;
        }),
        insertInto: vi.fn().mockReturnValue(insertChain),
      };
      mockGetKysely.mockReturnValue(kyselyMock);
      mockGetAccessToken.mockResolvedValue(null);
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
          is_packaged: false,
        },
        {},
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

      // insertInto is called for snapshot persistence, last upload time, and upload count
      expect(kyselyMock.insertInto).toHaveBeenCalled();
      const insertCalls = kyselyMock.insertInto.mock.calls;
      const metadataInserts = insertCalls.filter(
        (call: string[]) => call[0] === "app_metadata",
      );
      // At least the last_upload_at and upload_count inserts go to app_metadata
      expect(metadataInserts.length).toBeGreaterThanOrEqual(2);
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
        {},
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

  // ─────────────────────────────────────────────────────────────────────────
  // linkGggAccount
  // ─────────────────────────────────────────────────────────────────────────

  describe("linkGggAccount", () => {
    it("should skip when Supabase is not configured", async () => {
      const kyselyMock = createKyselyChain({ value: "device-uuid" });
      mockGetKysely.mockReturnValue(kyselyMock);
      mockIsConfigured.mockReturnValue(false);

      service = CommunityUploadService.getInstance();
      await service.linkGggAccount();

      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("should skip when uploads are disabled", async () => {
      const kyselyMock = createKyselyChain({ value: "device-uuid" });
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockResolvedValue(false);

      service = CommunityUploadService.getInstance();
      await service.linkGggAccount();

      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("should skip when getAccessToken throws", async () => {
      const kyselyMock = createKyselyChain({ value: "device-uuid" });
      mockGetKysely.mockReturnValue(kyselyMock);
      mockGetAccessToken.mockRejectedValue(new Error("Auth failure"));

      service = CommunityUploadService.getInstance();
      await service.linkGggAccount();

      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("should skip when no GGG access token is available", async () => {
      const kyselyMock = createKyselyChain({ value: "device-uuid" });
      mockGetKysely.mockReturnValue(kyselyMock);
      mockGetAccessToken.mockResolvedValue(null);

      service = CommunityUploadService.getInstance();
      await service.linkGggAccount();

      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("should call edge function with correct link-ggg payload", async () => {
      const kyselyMock = createKyselyChain({ value: "device-uuid" });
      mockGetKysely.mockReturnValue(kyselyMock);
      mockGetAccessToken.mockResolvedValue("ggg-token-abc");
      mockCallEdgeFunction.mockResolvedValue({
        success: true,
        ggg_username: "player1",
        ggg_uuid: "ggg-uuid-123",
        updated_records: 3,
      });

      service = CommunityUploadService.getInstance();
      await service.linkGggAccount();

      expect(mockCallEdgeFunction).toHaveBeenCalledWith(
        "upload-community-data",
        {
          action: "link-ggg",
          device_id: "device-uuid",
          is_packaged: false,
        },
        { "X-GGG-Token": "ggg-token-abc" },
      );
    });

    it("should not throw on edge function failure (fire-and-forget)", async () => {
      const kyselyMock = createKyselyChain({ value: "device-uuid" });
      mockGetKysely.mockReturnValue(kyselyMock);
      mockGetAccessToken.mockResolvedValue("ggg-token-abc");
      mockCallEdgeFunction.mockRejectedValue(new Error("Edge fn 500"));

      service = CommunityUploadService.getInstance();

      await expect(service.linkGggAccount()).resolves.toBeUndefined();
    });

    it("should report edge function errors to Sentry", async () => {
      const kyselyMock = createKyselyChain({ value: "device-uuid" });
      mockGetKysely.mockReturnValue(kyselyMock);
      mockGetAccessToken.mockResolvedValue("ggg-token-abc");
      const edgeError = new Error("Edge fn 500");
      mockCallEdgeFunction.mockRejectedValue(edgeError);

      service = CommunityUploadService.getInstance();
      await service.linkGggAccount();

      expect(mockSentryCaptureException).toHaveBeenCalledWith(
        edgeError,
        expect.objectContaining({
          tags: {
            module: "community-upload",
            operation: "link-ggg",
          },
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // uploadOnSessionEnd — delta logic
  // ─────────────────────────────────────────────────────────────────────────

  describe("uploadOnSessionEnd — delta logic", () => {
    const MOCK_DEVICE_ID = "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee";
    const MOCK_EDGE_RESPONSE = {
      success: true,
      upload_id: "upload-uuid-123",
      total_cards: 4,
      unique_cards: 2,
      upload_count: 1,
      is_verified: false,
    };

    function setupKyselyForDelta(options: {
      cards: { card_name: string; count: number }[];
      snapshot: { card_name: string; count: number }[];
      deviceId?: string;
    }) {
      const deviceId = options.deviceId ?? MOCK_DEVICE_ID;

      const deviceIdChain = createKyselyChain({ value: deviceId });
      const cardsChain = createKyselyChain(options.cards);
      const snapshotChain = createKyselyChain(options.snapshot);
      const insertChain = createKyselyChain();

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          // 1st call: device_id (getDeviceId)
          if (selectFromCallCount === 1) return deviceIdChain;
          // 2nd call: cards query
          if (selectFromCallCount === 2) return cardsChain;
          // 3rd call: snapshot query
          return snapshotChain;
        }),
        insertInto: vi.fn().mockReturnValue(insertChain),
      };
      mockGetKysely.mockReturnValue(kyselyMock);
      return kyselyMock;
    }

    it("should skip upload when all cards match snapshot (no changes)", async () => {
      setupKyselyForDelta({
        cards: [{ card_name: "The Doctor", count: 5 }],
        snapshot: [{ card_name: "The Doctor", count: 5 }],
      });
      mockGetAccessToken.mockResolvedValue(null);
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("should only upload cards with increased counts", async () => {
      setupKyselyForDelta({
        cards: [
          { card_name: "The Doctor", count: 10 },
          { card_name: "House of Mirrors", count: 5 },
        ],
        snapshot: [
          { card_name: "The Doctor", count: 10 },
          { card_name: "House of Mirrors", count: 3 },
        ],
      });
      mockGetAccessToken.mockResolvedValue(null);
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      expect(mockCallEdgeFunction).toHaveBeenCalledWith(
        "upload-community-data",
        expect.objectContaining({
          cards: [{ card_name: "House of Mirrors", count: 5 }],
        }),
        {},
      );
    });

    it("should upload all cards when no snapshot exists", async () => {
      setupKyselyForDelta({
        cards: [
          { card_name: "The Doctor", count: 3 },
          { card_name: "House of Mirrors", count: 1 },
        ],
        snapshot: [],
      });
      mockGetAccessToken.mockResolvedValue(null);
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      expect(mockCallEdgeFunction).toHaveBeenCalledWith(
        "upload-community-data",
        expect.objectContaining({
          cards: [
            { card_name: "The Doctor", count: 3 },
            { card_name: "House of Mirrors", count: 1 },
          ],
        }),
        {},
      );
    });

    it("should include new cards not in snapshot", async () => {
      setupKyselyForDelta({
        cards: [
          { card_name: "The Doctor", count: 3 },
          { card_name: "Rain of Chaos", count: 2 },
        ],
        snapshot: [{ card_name: "The Doctor", count: 3 }],
      });
      mockGetAccessToken.mockResolvedValue(null);
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      expect(mockCallEdgeFunction).toHaveBeenCalledWith(
        "upload-community-data",
        expect.objectContaining({
          cards: [{ card_name: "Rain of Chaos", count: 2 }],
        }),
        {},
      );
    });

    it("should exclude cards with decreased counts", async () => {
      setupKyselyForDelta({
        cards: [
          { card_name: "The Doctor", count: 2 },
          { card_name: "House of Mirrors", count: 5 },
        ],
        snapshot: [
          { card_name: "The Doctor", count: 5 },
          { card_name: "House of Mirrors", count: 3 },
        ],
      });
      mockGetAccessToken.mockResolvedValue(null);
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      // The Doctor decreased (2 < 5) so it should be excluded
      // House of Mirrors increased (5 > 3) so only it should be sent
      expect(mockCallEdgeFunction).toHaveBeenCalledWith(
        "upload-community-data",
        expect.objectContaining({
          cards: [{ card_name: "House of Mirrors", count: 5 }],
        }),
        {},
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // uploadOnSessionEnd — verified upload
  // ─────────────────────────────────────────────────────────────────────────

  describe("uploadOnSessionEnd — verified upload", () => {
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
      is_verified: true,
    };

    function setupKyselyForVerifiedUpload(options?: {
      cards?: { card_name: string; count: number }[];
      deviceId?: string;
    }) {
      const cards = options?.cards ?? MOCK_CARDS;
      const deviceId = options?.deviceId ?? MOCK_DEVICE_ID;

      const deviceIdChain = createKyselyChain({ value: deviceId });
      const cardsChain = createKyselyChain(cards);
      // Empty snapshot so all cards are treated as changed
      const snapshotChain = createKyselyChain([]);
      const insertChain = createKyselyChain();

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          // 1st call: device_id lookup (from getDeviceId)
          if (selectFromCallCount === 1) return deviceIdChain;
          // 2nd call: cards query
          if (selectFromCallCount === 2) return cardsChain;
          // 3rd call: snapshot query
          return snapshotChain;
        }),
        insertInto: vi.fn().mockReturnValue(insertChain),
      };
      mockGetKysely.mockReturnValue(kyselyMock);
      return kyselyMock;
    }

    it("should include X-GGG-Token header when available", async () => {
      setupKyselyForVerifiedUpload();
      mockGetAccessToken.mockResolvedValue("ggg-verified-token");
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      expect(mockCallEdgeFunction).toHaveBeenCalledWith(
        "upload-community-data",
        expect.objectContaining({
          device_id: MOCK_DEVICE_ID,
          cards: [
            { card_name: "The Doctor", count: 3 },
            { card_name: "House of Mirrors", count: 1 },
          ],
        }),
        { "X-GGG-Token": "ggg-verified-token" },
      );
      // Body should NOT contain ggg_access_token
      expect(mockCallEdgeFunction).toHaveBeenCalledWith(
        "upload-community-data",
        expect.not.objectContaining({
          ggg_access_token: expect.anything(),
        }),
        expect.anything(),
      );
    });

    it("should upload anonymously when getAccessToken fails", async () => {
      setupKyselyForVerifiedUpload();
      mockGetAccessToken.mockRejectedValue(new Error("Token expired"));
      mockCallEdgeFunction.mockResolvedValue({
        ...MOCK_EDGE_RESPONSE,
        is_verified: false,
      });

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      // Extra headers should be empty (no X-GGG-Token)
      expect(mockCallEdgeFunction).toHaveBeenCalledWith(
        "upload-community-data",
        expect.objectContaining({
          device_id: MOCK_DEVICE_ID,
          cards: expect.any(Array),
        }),
        {},
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // uploadOnSessionEnd — snapshot persistence
  // ─────────────────────────────────────────────────────────────────────────

  describe("uploadOnSessionEnd — snapshot persistence", () => {
    const MOCK_DEVICE_ID = "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee";
    const MOCK_EDGE_RESPONSE = {
      success: true,
      upload_id: "upload-uuid-123",
      total_cards: 4,
      unique_cards: 2,
      upload_count: 3,
      is_verified: false,
    };

    function setupKyselyForPersistence(options: {
      cards: { card_name: string; count: number }[];
      snapshot?: { card_name: string; count: number }[];
    }) {
      const deviceIdChain = createKyselyChain({ value: MOCK_DEVICE_ID });
      const cardsChain = createKyselyChain(options.cards);
      const snapshotChain = createKyselyChain(options.snapshot ?? []);
      const insertChain = createKyselyChain();

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          // 1st call: device_id (getDeviceId)
          if (selectFromCallCount === 1) return deviceIdChain;
          // 2nd call: cards query
          if (selectFromCallCount === 2) return cardsChain;
          // 3rd call: snapshot query
          return snapshotChain;
        }),
        insertInto: vi.fn().mockReturnValue(insertChain),
      };
      mockGetKysely.mockReturnValue(kyselyMock);
      return kyselyMock;
    }

    it("should persist snapshot after successful upload", async () => {
      const kyselyMock = setupKyselyForPersistence({
        cards: [
          { card_name: "The Doctor", count: 3 },
          { card_name: "House of Mirrors", count: 1 },
        ],
      });
      mockGetAccessToken.mockResolvedValue(null);
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      // insertInto calls: snapshot for each changed card + last_upload_at + upload_count
      const insertCalls = kyselyMock.insertInto.mock.calls;
      const snapshotInserts = insertCalls.filter(
        (call: string[]) => call[0] === "community_upload_snapshot",
      );
      expect(snapshotInserts).toHaveLength(2);
    });

    it("should persist last upload time after successful upload", async () => {
      const kyselyMock = setupKyselyForPersistence({
        cards: [{ card_name: "The Doctor", count: 3 }],
      });
      mockGetAccessToken.mockResolvedValue(null);
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      const insertCalls = kyselyMock.insertInto.mock.calls;
      const metadataInserts = insertCalls.filter(
        (call: string[]) => call[0] === "app_metadata",
      );
      // At least one app_metadata insert for community_last_upload_at
      expect(metadataInserts.length).toBeGreaterThanOrEqual(1);
    });

    it("should persist upload count after successful upload", async () => {
      const kyselyMock = setupKyselyForPersistence({
        cards: [{ card_name: "The Doctor", count: 3 }],
      });
      mockGetAccessToken.mockResolvedValue(null);
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers");

      const insertCalls = kyselyMock.insertInto.mock.calls;
      const metadataInserts = insertCalls.filter(
        (call: string[]) => call[0] === "app_metadata",
      );
      // Two app_metadata inserts: community_last_upload_at + upload count
      expect(metadataInserts).toHaveLength(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // backfillIfNeeded
  // ─────────────────────────────────────────────────────────────────────────

  describe("backfillIfNeeded", () => {
    const MOCK_DEVICE_ID = "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee";
    const MOCK_LEAGUES = [
      { game: "poe2", scope: "Settlers" },
      { game: "poe1", scope: "Necropolis" },
    ];
    const MOCK_EDGE_RESPONSE = {
      success: true,
      upload_id: "upload-uuid-123",
      total_cards: 4,
      unique_cards: 2,
      upload_count: 1,
      is_verified: false,
    };

    it("skips when uploads are disabled", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockResolvedValue(false);

      service = CommunityUploadService.getInstance();
      await service.backfillIfNeeded();

      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("skips when Supabase not configured", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockIsConfigured.mockReturnValue(false);

      service = CommunityUploadService.getInstance();
      await service.backfillIfNeeded();

      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("skips leagues already backfilled", async () => {
      const leaguesChain = createKyselyChain([
        { game: "poe2", scope: "Settlers" },
      ]);
      const backfillMarkerChain = createKyselyChain({ value: "true" });
      const insertChain = createKyselyChain();

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          // 1st call: distinct leagues from cards
          if (selectFromCallCount === 1) return leaguesChain;
          // 2nd call: backfill marker check
          return backfillMarkerChain;
        }),
        insertInto: vi.fn().mockReturnValue(insertChain),
      };
      mockGetKysely.mockReturnValue(kyselyMock);

      service = CommunityUploadService.getInstance();
      await service.backfillIfNeeded();

      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("uploads for leagues not yet backfilled", async () => {
      const leaguesChain = createKyselyChain(MOCK_LEAGUES);
      const noMarkerChain = createKyselyChain(undefined);
      const deviceIdChain = createKyselyChain({ value: MOCK_DEVICE_ID });
      const cardsChain = createKyselyChain([
        { card_name: "The Doctor", count: 3 },
      ]);
      const snapshotChain = createKyselyChain([]);
      const insertChain = createKyselyChain();

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          // 1st: distinct leagues
          if (selectFromCallCount === 1) return leaguesChain;
          // For each league: backfill marker, device_id, cards, snapshot
          // League 1: calls 2,3,4,5
          // League 2: calls 6,7,8,9
          const offset = (selectFromCallCount - 2) % 4;
          if (offset === 0) return noMarkerChain;
          if (offset === 1) return deviceIdChain;
          if (offset === 2) return cardsChain;
          return snapshotChain;
        }),
        insertInto: vi.fn().mockReturnValue(insertChain),
      };
      mockGetKysely.mockReturnValue(kyselyMock);
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);
      mockGetAccessToken.mockResolvedValue(null);

      service = CommunityUploadService.getInstance();
      await service.backfillIfNeeded();

      expect(mockCallEdgeFunction).toHaveBeenCalledTimes(2);
    });

    it("marks backfill done after successful upload", async () => {
      const leaguesChain = createKyselyChain([
        { game: "poe2", scope: "Settlers" },
      ]);
      const noMarkerChain = createKyselyChain(undefined);
      const deviceIdChain = createKyselyChain({ value: MOCK_DEVICE_ID });
      const cardsChain = createKyselyChain([
        { card_name: "The Doctor", count: 3 },
      ]);
      const snapshotChain = createKyselyChain([]);
      const insertChain = createKyselyChain();

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          if (selectFromCallCount === 1) return leaguesChain;
          const offset = (selectFromCallCount - 2) % 4;
          if (offset === 0) return noMarkerChain;
          if (offset === 1) return deviceIdChain;
          if (offset === 2) return cardsChain;
          return snapshotChain;
        }),
        insertInto: vi.fn().mockReturnValue(insertChain),
      };
      mockGetKysely.mockReturnValue(kyselyMock);
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);
      mockGetAccessToken.mockResolvedValue(null);

      service = CommunityUploadService.getInstance();
      await service.backfillIfNeeded();

      const insertCalls = kyselyMock.insertInto.mock.calls;
      const metadataInserts = insertCalls.filter(
        (call: string[]) => call[0] === "app_metadata",
      );
      // Should include backfill marker insert
      const backfillInsert = metadataInserts.some(() => {
        return insertChain.values.mock.calls.some(
          (c: Array<{ key: string; value: string }>) =>
            c[0]?.key === "community_backfill_done_poe2_Settlers" &&
            c[0]?.value === "true",
        );
      });
      expect(backfillInsert).toBe(true);
    });

    it("continues with other leagues if one fails", async () => {
      const leaguesChain = createKyselyChain(MOCK_LEAGUES);
      const noMarkerChain = createKyselyChain(undefined);
      const deviceIdChain = createKyselyChain({ value: MOCK_DEVICE_ID });
      const cardsChain = createKyselyChain([
        { card_name: "The Doctor", count: 3 },
      ]);
      const snapshotChain = createKyselyChain([]);
      const insertChain = createKyselyChain();

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          if (selectFromCallCount === 1) return leaguesChain;
          const offset = (selectFromCallCount - 2) % 4;
          if (offset === 0) return noMarkerChain;
          if (offset === 1) return deviceIdChain;
          if (offset === 2) return cardsChain;
          return snapshotChain;
        }),
        insertInto: vi.fn().mockReturnValue(insertChain),
      };
      mockGetKysely.mockReturnValue(kyselyMock);
      mockGetAccessToken.mockResolvedValue(null);

      // First league upload fails, second succeeds
      mockCallEdgeFunction
        .mockRejectedValueOnce(new Error("network error"))
        .mockResolvedValueOnce(MOCK_EDGE_RESPONSE);

      service = CommunityUploadService.getInstance();
      await service.backfillIfNeeded();

      // Second league should still be attempted
      expect(mockCallEdgeFunction).toHaveBeenCalledTimes(2);
    });

    it("does not throw on error (fire-and-forget)", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);

      // Make isEnabled throw
      mockSettingsGet.mockRejectedValue(new Error("db exploded"));

      service = CommunityUploadService.getInstance();

      // Should resolve without throwing
      await expect(service.backfillIfNeeded()).resolves.toBeUndefined();
      expect(mockSentryCaptureException).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getBackfillLeagues
  // ─────────────────────────────────────────────────────────────────────────

  describe("getBackfillLeagues", () => {
    it("should return empty when uploads are disabled", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockResolvedValue(false);

      service = CommunityUploadService.getInstance();
      const result = await service.getBackfillLeagues();
      expect(result).toEqual([]);
    });

    it("should return empty when Supabase is not configured", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockIsConfigured.mockReturnValue(false);

      service = CommunityUploadService.getInstance();
      const result = await service.getBackfillLeagues();
      expect(result).toEqual([]);
    });

    it("should return leagues that have not been backfilled", async () => {
      const leaguesChain = createKyselyChain([
        { game: "poe2", scope: "Dawn of the Hunt" },
      ]);
      const noMarkerChain = createKyselyChain(undefined);

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          // Call 1: leagues query (cards table)
          if (selectFromCallCount === 1) return leaguesChain;
          // Call 2: backfill marker check (app_metadata)
          return noMarkerChain;
        }),
        insertInto: vi.fn(() => createKyselyChain()),
      };
      mockGetKysely.mockReturnValue(kyselyMock);

      service = CommunityUploadService.getInstance();
      const result = await service.getBackfillLeagues();

      expect(result).toEqual([{ game: "poe2", league: "Dawn of the Hunt" }]);
    });

    it("should exclude already-backfilled leagues", async () => {
      const leaguesChain = createKyselyChain([
        { game: "poe2", scope: "Dawn of the Hunt" },
      ]);
      const backfillMarkerChain = createKyselyChain({ value: "true" });

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          if (selectFromCallCount === 1) return leaguesChain;
          return backfillMarkerChain;
        }),
        insertInto: vi.fn(() => createKyselyChain()),
      };
      mockGetKysely.mockReturnValue(kyselyMock);

      service = CommunityUploadService.getInstance();
      const result = await service.getBackfillLeagues();

      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // IPC: GetBackfillLeagues
  // ─────────────────────────────────────────────────────────────────────────

  describe("IPC: GetBackfillLeagues", () => {
    it("should return leagues needing backfill", async () => {
      const leaguesChain = createKyselyChain([
        { game: "poe2", scope: "Dawn of the Hunt" },
      ]);
      const noMarkerChain = createKyselyChain(undefined);

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          if (selectFromCallCount === 1) return leaguesChain;
          return noMarkerChain;
        }),
        insertInto: vi.fn(() => createKyselyChain()),
      };
      mockGetKysely.mockReturnValue(kyselyMock);

      service = CommunityUploadService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.GetBackfillLeagues,
      );

      const result = await handler();
      expect(result).toEqual([{ game: "poe2", league: "Dawn of the Hunt" }]);
    });

    it("should return empty when uploads are disabled", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockResolvedValue(false);

      service = CommunityUploadService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.GetBackfillLeagues,
      );

      const result = await handler();
      expect(result).toEqual([]);
    });

    it("should return empty when all leagues are backfilled", async () => {
      const leaguesChain = createKyselyChain([
        { game: "poe2", scope: "Dawn of the Hunt" },
      ]);
      const backfillMarkerChain = createKyselyChain({ value: "true" });

      let selectFromCallCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          selectFromCallCount++;
          if (selectFromCallCount === 1) return leaguesChain;
          return backfillMarkerChain;
        }),
        insertInto: vi.fn(() => createKyselyChain()),
      };
      mockGetKysely.mockReturnValue(kyselyMock);

      service = CommunityUploadService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.GetBackfillLeagues,
      );

      const result = await handler();
      expect(result).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // IPC: TriggerBackfill
  // ─────────────────────────────────────────────────────────────────────────

  describe("IPC: TriggerBackfill", () => {
    it("should call backfillIfNeeded and return success", async () => {
      // Reset mocks that may have been set by prior tests (clearAllMocks doesn't reset implementations)
      mockAssertTrustedSender.mockReset();
      mockHandleValidationError
        .mockReset()
        .mockImplementation((error: unknown) => {
          throw error;
        });

      // Uploads disabled so backfillIfNeeded returns early without needing complex Kysely setup
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockResolvedValue(false);

      service = CommunityUploadService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.TriggerBackfill,
      );

      const result = await handler({ sender: { id: 1 } });

      expect(mockAssertTrustedSender).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("should validate trusted sender", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);

      mockAssertTrustedSender.mockImplementation(() => {
        throw new MockIpcValidationError(
          CommunityUploadChannel.TriggerBackfill,
          "[Security] IPC call from untrusted webContents (id=999)",
        );
      });
      mockHandleValidationError.mockReturnValue({
        success: false,
        error:
          "Invalid input: [Security] IPC call from untrusted webContents (id=999)",
      });

      service = CommunityUploadService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.TriggerBackfill,
      );

      const result = await handler({ sender: { id: 999 } });

      expect(mockAssertTrustedSender).toHaveBeenCalled();
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("untrusted webContents"),
      });
    });
  });
});
