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
  mockPowerMonitorOn,
  mockGetKysely,
  mockSettingsGet,
  mockIsConfigured,
  mockCallEdgeFunction,
  mockAssertTrustedSender,
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
    mockPowerMonitorOn: vi.fn(),
    mockGetKysely: vi.fn(),
    mockSettingsGet: vi.fn(),
    mockIsConfigured: vi.fn(),
    mockCallEdgeFunction: vi.fn(),
    mockAssertTrustedSender: vi.fn(),
    mockHandleValidationError: vi.fn((error: unknown) => {
      throw error;
    }),
    MockIpcValidationError: _MockIpcValidationError,
    mockSentryCaptureException: vi.fn(),
    mockGetAccessToken: vi.fn(),
  };
});

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("electron", () =>
  createElectronMock({ mockIpcHandle, mockPowerMonitorOn }),
);

vi.mock("~/main/modules/database", () =>
  createDatabaseServiceMock({ mockGetKysely }),
);

vi.mock("~/main/modules/settings-store", () =>
  createSettingsStoreMock({
    mockGet: mockSettingsGet,
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
    mockHandleValidationError,
    MockIpcValidationError,
  }),
);

vi.mock("~/main/modules/sentry/Sentry.reporter", () => ({
  captureSentryException: mockSentryCaptureException,
  captureSentryMessage: vi.fn(),
}));

// ─── Kysely mock builder ────────────────────────────────────────────────────
// A chainable mock that simulates Kysely's query builder pattern.

function createKyselyChain(result: unknown = undefined) {
  const chain: Record<string, any> = {};
  const methods = [
    "selectFrom",
    "deleteFrom",
    "insertInto",
    "select",
    "selectAll",
    "updateTable",
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
import type { CommunityUploadRepository } from "../CommunityUpload.repository";
import { CommunityUploadService } from "../CommunityUpload.service";

function getRepository(
  service: CommunityUploadService,
): CommunityUploadRepository {
  return (service as unknown as { repository: CommunityUploadRepository })
    .repository;
}

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

  it("registers only the backfill IPC handlers", () => {
    mockGetKysely.mockReturnValue(createKyselyChain());

    service = CommunityUploadService.getInstance();

    expect(
      mockIpcHandle.mock.calls.map(([channel]: [string]) => channel),
    ).toEqual([
      CommunityUploadChannel.GetBackfillLeagues,
      CommunityUploadChannel.TriggerBackfill,
    ]);
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
        "v2-upload-community-data",
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

    it("should queue without flushing when requested", async () => {
      const kyselyMock = setupKyselyForUpload();
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers", undefined, {
        flush: false,
      });

      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
      expect(kyselyMock.insertInto).toHaveBeenCalledWith(
        "community_upload_outbox",
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
        new Error("Edge Function v2-upload-community-data failed (500)"),
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
            operation: "flush-pending-upload",
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
        "v2-upload-community-data",
        expect.objectContaining({
          game: "poe1",
          league_name: "Standard",
        }),
        {},
      );
    });
  });

  describe("flushPendingUploads", () => {
    it("should register a resume handler for pending uploads", () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);

      service = CommunityUploadService.getInstance();

      expect(mockPowerMonitorOn).toHaveBeenCalledWith(
        "resume",
        expect.any(Function),
      );
    });

    it("should flush a pending outbox row", async () => {
      const pendingRow = {
        game: "poe2",
        scope: "Settlers",
        cards_json: JSON.stringify([{ card_name: "The Doctor", count: 3 }]),
        attempts: 0,
        last_error: null,
        next_attempt_at: null,
      };
      const pendingRowsChain = createKyselyChain([pendingRow]);
      const pendingRowChain = createKyselyChain(pendingRow);
      const latestRowChain = createKyselyChain({
        cards_json: pendingRow.cards_json,
      });
      const leaguesChain = createKyselyChain([]);
      const deviceIdChain = createKyselyChain({
        value: "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee",
      });
      const insertChain = createKyselyChain();
      const deleteChain = createKyselyChain();

      let outboxSelectCount = 0;
      const kyselyMock = {
        selectFrom: vi.fn((table: string) => {
          if (table === "cards") return leaguesChain;
          if (table === "community_upload_outbox") {
            outboxSelectCount++;
            if (outboxSelectCount === 1) return pendingRowsChain;
            if (outboxSelectCount === 2) return pendingRowChain;
            return latestRowChain;
          }
          return deviceIdChain;
        }),
        insertInto: vi.fn().mockReturnValue(insertChain),
        deleteFrom: vi.fn().mockReturnValue(deleteChain),
      };
      mockGetKysely.mockReturnValue(kyselyMock);
      mockGetAccessToken.mockResolvedValue(null);
      mockCallEdgeFunction.mockResolvedValue({
        success: true,
        upload_id: "upload-uuid-123",
        total_cards: 3,
        unique_cards: 1,
        upload_count: 1,
        is_verified: false,
      });

      service = CommunityUploadService.getInstance();
      await service.flushPendingUploads();

      expect(mockCallEdgeFunction).toHaveBeenCalledWith(
        "v2-upload-community-data",
        expect.objectContaining({
          cards: [{ card_name: "The Doctor", count: 3 }],
          device_id: "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee",
        }),
        {},
      );
      expect(kyselyMock.deleteFrom).toHaveBeenCalledWith(
        "community_upload_outbox",
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
        "v2-upload-community-data",
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
      sessionCards?: { card_name: string; count: number }[];
      deviceId?: string;
    }) {
      const deviceId = options.deviceId ?? MOCK_DEVICE_ID;

      const deviceIdChain = createKyselyChain({ value: deviceId });
      const cardsChain = createKyselyChain(options.cards);
      const snapshotChain = createKyselyChain(options.snapshot);
      const sessionCardsChain = createKyselyChain(options.sessionCards ?? []);
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
          if (selectFromCallCount === 3) return snapshotChain;
          // 4th call: just-finished session cards query
          if (selectFromCallCount === 4) return sessionCardsChain;
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
        "v2-upload-community-data",
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
        "v2-upload-community-data",
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
        "v2-upload-community-data",
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
        "v2-upload-community-data",
        expect.objectContaining({
          cards: [{ card_name: "House of Mirrors", count: 5 }],
        }),
        {},
      );
    });

    it("should count new session drops after local deletion lowered card totals", async () => {
      setupKyselyForDelta({
        cards: [{ card_name: "The Doctor", count: 9 }],
        snapshot: [{ card_name: "The Doctor", count: 10 }],
        sessionCards: [{ card_name: "The Doctor", count: 1 }],
      });
      mockGetAccessToken.mockResolvedValue(null);
      mockCallEdgeFunction.mockResolvedValue(MOCK_EDGE_RESPONSE);

      service = CommunityUploadService.getInstance();
      await service.uploadOnSessionEnd("poe2", "Settlers", "session-1");

      expect(mockCallEdgeFunction).toHaveBeenCalledWith(
        "v2-upload-community-data",
        expect.objectContaining({
          cards: [{ card_name: "The Doctor", count: 11 }],
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
        "v2-upload-community-data",
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
        "v2-upload-community-data",
        expect.not.objectContaining({
          ggg_access_token: expect.anything(),
        }),
        expect.anything(),
      );
    });

    it("should upload without an account link when getAccessToken fails", async () => {
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
        "v2-upload-community-data",
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
    const MOCK_LEAGUES = [
      { game: "poe2" as const, league: "Settlers" },
      { game: "poe1" as const, league: "Necropolis" },
    ];

    it("reports disabled uploads instead of pretending the backfill succeeded", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockResolvedValue(false);

      service = CommunityUploadService.getInstance();
      const result = await service.backfillIfNeeded();

      expect(result).toEqual({
        success: false,
        error: "Community uploads are disabled.",
      });
      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("reports unavailable Supabase instead of pretending success", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockIsConfigured.mockReturnValue(false);

      service = CommunityUploadService.getInstance();
      const result = await service.backfillIfNeeded();

      expect(result.success).toBe(false);
      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("returns success when no leagues still need backfill", async () => {
      mockGetKysely.mockReturnValue(createKyselyChain());

      service = CommunityUploadService.getInstance();
      vi.spyOn(service, "getBackfillLeagues").mockResolvedValue([]);
      const commitSpy = vi
        .spyOn(getRepository(service), "commitBackfill")
        .mockResolvedValue(undefined);
      const uploadSpy = vi.spyOn(service, "uploadOnSessionEnd");

      await expect(service.backfillIfNeeded()).resolves.toEqual({
        success: true,
      });
      expect(uploadSpy).not.toHaveBeenCalled();
      expect(commitSpy).toHaveBeenCalledWith([], true);
    });

    it("marks every durably queued league complete", async () => {
      mockGetKysely.mockReturnValue(createKyselyChain());

      service = CommunityUploadService.getInstance();
      vi.spyOn(service, "getBackfillLeagues").mockResolvedValue(MOCK_LEAGUES);
      const commitSpy = vi
        .spyOn(getRepository(service), "commitBackfill")
        .mockResolvedValue(undefined);
      const uploadSpy = vi
        .spyOn(service, "uploadOnSessionEnd")
        .mockResolvedValue(undefined);

      const result = await service.backfillIfNeeded();

      expect(result).toEqual({ success: true });
      expect(uploadSpy).toHaveBeenCalledTimes(2);
      expect(uploadSpy).toHaveBeenCalledWith("poe2", "Settlers", undefined, {
        throwOnFailure: true,
      });
      expect(commitSpy).toHaveBeenCalledWith(MOCK_LEAGUES, true);
    });

    it("returns a partial failure and leaves the failed league unmarked", async () => {
      mockGetKysely.mockReturnValue(createKyselyChain());

      service = CommunityUploadService.getInstance();
      vi.spyOn(service, "getBackfillLeagues").mockResolvedValue(MOCK_LEAGUES);
      const commitSpy = vi
        .spyOn(getRepository(service), "commitBackfill")
        .mockResolvedValue(undefined);
      vi.spyOn(service, "uploadOnSessionEnd")
        .mockRejectedValueOnce(new Error("sqlite unavailable"))
        .mockResolvedValueOnce(undefined);

      const result = await service.backfillIfNeeded();

      expect(result).toEqual({
        success: false,
        error: "Some community data could not be queued. Please try again.",
      });
      expect(commitSpy).toHaveBeenCalledWith([MOCK_LEAGUES[1]], false);
    });

    it("returns an outer failure without throwing", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockRejectedValue(new Error("db exploded"));

      service = CommunityUploadService.getInstance();

      await expect(service.backfillIfNeeded()).resolves.toEqual({
        success: false,
        error: "Community data could not be queued. Please try again.",
      });
      expect(mockSentryCaptureException).toHaveBeenCalled();
    });

    it("does not report success when the atomic completion commit fails", async () => {
      mockGetKysely.mockReturnValue(createKyselyChain());
      service = CommunityUploadService.getInstance();
      vi.spyOn(service, "getBackfillLeagues").mockResolvedValue(MOCK_LEAGUES);
      vi.spyOn(service, "uploadOnSessionEnd").mockResolvedValue(undefined);
      vi.spyOn(getRepository(service), "commitBackfill").mockRejectedValue(
        new Error("database unavailable"),
      );

      await expect(service.backfillIfNeeded()).resolves.toEqual({
        success: false,
        error: "Community data could not be queued. Please try again.",
      });
    });

    it("re-throws preparation failures for interactive backfill callers", async () => {
      const kyselyMock = {
        selectFrom: vi.fn(() => {
          throw new Error("sqlite unavailable");
        }),
      };
      mockGetKysely.mockReturnValue(kyselyMock);
      service = CommunityUploadService.getInstance();

      await expect(
        service.uploadOnSessionEnd("poe1", "Settlers", undefined, {
          throwOnFailure: true,
        }),
      ).rejects.toThrow("sqlite unavailable");
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
        { game: "poe1", scope: "Settlers" },
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

      expect(result).toEqual([
        { game: "poe2", league: "Dawn of the Hunt" },
        { game: "poe1", league: "Settlers" },
      ]);
      expect(kyselyMock.selectFrom).toHaveBeenCalledTimes(2);
    });

    it("should exclude already-backfilled leagues", async () => {
      const leaguesChain = createKyselyChain([
        { game: "poe2", scope: "Dawn of the Hunt" },
      ]);
      const backfillMarkerChain = createKyselyChain({
        key: "community_backfill_done_poe2_Dawn of the Hunt",
      });

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
    beforeEach(() => {
      mockAssertTrustedSender.mockReset();
      mockHandleValidationError
        .mockReset()
        .mockImplementation((error: unknown) => {
          throw error;
        });
    });

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

      const result = await handler({ sender: { id: 1 } });
      expect(result).toEqual({
        success: true,
        leagues: [{ game: "poe2", league: "Dawn of the Hunt" }],
      });
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

      const result = await handler({ sender: { id: 1 } });
      expect(result).toEqual({ success: true, leagues: [] });
    });

    it("should return empty when all leagues are backfilled", async () => {
      const leaguesChain = createKyselyChain([
        { game: "poe2", scope: "Dawn of the Hunt" },
      ]);
      const backfillMarkerChain = createKyselyChain({
        key: "community_backfill_done_poe2_Dawn of the Hunt",
      });

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

      const result = await handler({ sender: { id: 1 } });
      expect(result).toEqual({ success: true, leagues: [] });
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

      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);

      service = CommunityUploadService.getInstance();
      vi.spyOn(service, "backfillIfNeeded").mockResolvedValue({
        success: true,
      });
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.TriggerBackfill,
      );

      const result = await handler({ sender: { id: 1 } });

      expect(mockAssertTrustedSender).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("returns the real backfill failure so the renderer can retry", async () => {
      mockAssertTrustedSender.mockReset();
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      service = CommunityUploadService.getInstance();
      vi.spyOn(service, "backfillIfNeeded").mockResolvedValue({
        success: false,
        error: "Some community data could not be queued. Please try again.",
      });
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.TriggerBackfill,
      );

      await expect(handler({ sender: { id: 1 } })).resolves.toEqual({
        success: false,
        error: "Some community data could not be queued. Please try again.",
      });
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

  describe("remaining branch coverage", () => {
    function createService(kysely: unknown = createKyselyChain()) {
      mockGetKysely.mockReturnValue(kysely);
      return CommunityUploadService.getInstance();
    }

    it("returns a safe error for unexpected read-only IPC failures", async () => {
      const kysely = {
        selectFrom: vi.fn(() => {
          throw new Error("query failed");
        }),
      };
      vi.spyOn(console, "error").mockImplementation(() => {});
      mockHandleValidationError.mockImplementation((error) => {
        throw error;
      });
      mockSettingsGet.mockRejectedValue(new Error("settings failed"));
      service = createService(kysely);

      await expect(
        getIpcHandler(
          mockIpcHandle,
          CommunityUploadChannel.GetBackfillLeagues,
        )(),
      ).resolves.toEqual({
        success: false,
        error: "Community data could not be queued. Please try again.",
      });
    });

    it("skips a global flush when disabled or unconfigured", async () => {
      service = createService();
      mockSettingsGet.mockResolvedValueOnce(false);
      await service.flushPendingUploads();

      mockSettingsGet.mockResolvedValueOnce(true);
      mockIsConfigured.mockReturnValueOnce(false);
      await service.flushPendingUploads();

      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("skips future rows and records invalid outbox games", async () => {
      const rows = createKyselyChain([
        {
          attempts: 0,
          cards_json: "[]",
          game: "poe1",
          last_error: null,
          next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
          scope: "Future",
        },
        {
          attempts: 0,
          cards_json: "[]",
          game: "invalid",
          last_error: null,
          next_attempt_at: null,
          scope: "Broken",
        },
      ]);
      const update = createKyselyChain();
      service = createService({
        selectFrom: vi.fn(() => rows),
        updateTable: vi.fn(() => update),
      });

      await service.flushPendingUploads();

      expect(update.set).toHaveBeenCalledWith(
        expect.objectContaining({
          last_error: 'Invalid outbox game "invalid"',
        }),
      );
    });

    it("reports non-Error failures from linking and session uploads", async () => {
      mockIsConfigured.mockImplementationOnce(() => {
        throw "link failure";
      });
      service = createService();
      await service.linkGggAccount();

      mockSettingsGet.mockRejectedValueOnce("upload failure");
      await service.uploadOnSessionEnd("poe1", "Standard");

      expect(mockSentryCaptureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: "link failure" }),
        expect.any(Object),
      );
      expect(mockSentryCaptureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: "upload failure" }),
        expect.any(Object),
      );
    });

    it("validates every outbox card field", () => {
      service = createService();
      const parse = (
        service as unknown as {
          parseOutboxCards: (row: {
            attempts: number;
            cards_json: string;
            game: string;
            last_error: null;
            next_attempt_at: null;
            scope: string;
          }) => unknown;
        }
      ).parseOutboxCards.bind(service);
      const row = (value: unknown) => ({
        attempts: 0,
        cards_json: JSON.stringify(value),
        game: "poe1",
        last_error: null,
        next_attempt_at: null,
        scope: "Standard",
      });

      expect(() => parse(row({}))).toThrow("must be an array");
      for (const invalid of [
        null,
        "card",
        {},
        { card_name: 1, count: 1 },
        { card_name: "Card", count: "1" },
        { card_name: "Card", count: 1.5 },
        { card_name: "Card", count: 0 },
      ]) {
        expect(() => parse(row([invalid]))).toThrow("index 0 is invalid");
      }
      expect(parse(row([{ card_name: "Card", count: 1 }]))).toEqual([
        { card_name: "Card", count: 1 },
      ]);
    });

    it("covers missing, retry, empty, and changed pending-upload states", async () => {
      const missing = createKyselyChain(undefined);
      service = createService({ selectFrom: vi.fn(() => missing) });
      const getOnce = () =>
        (
          service as unknown as {
            flushPendingUploadOnce: (
              game: "poe1",
              league: string,
            ) => Promise<string>;
          }
        ).flushPendingUploadOnce("poe1", "Standard");
      await expect(getOnce()).resolves.toBe("missing");

      const retry = createKyselyChain({
        attempts: 0,
        cards_json: "[]",
        game: "poe1",
        last_error: null,
        next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
        scope: "Standard",
      });
      (
        service as unknown as {
          kysely: unknown;
        }
      ).kysely = { selectFrom: vi.fn(() => retry) };
      await expect(getOnce()).resolves.toBe("retry-later");

      const empty = createKyselyChain({
        attempts: 0,
        cards_json: "[]",
        game: "poe1",
        last_error: null,
        next_attempt_at: null,
        scope: "Standard",
      });
      const deletion = createKyselyChain();
      (
        service as unknown as {
          kysely: unknown;
        }
      ).kysely = {
        deleteFrom: vi.fn(() => deletion),
        selectFrom: vi.fn(() => empty),
      };
      await expect(getOnce()).resolves.toBe("done");

      const original = JSON.stringify([{ card_name: "Card", count: 1 }]);
      const changed = JSON.stringify([{ card_name: "Card", count: 2 }]);
      const first = createKyselyChain({
        attempts: 0,
        cards_json: original,
        game: "poe1",
        last_error: null,
        next_attempt_at: null,
        scope: "Standard",
      });
      const latest = createKyselyChain({ cards_json: changed });
      const device = createKyselyChain({ value: "device-id" });
      const insertion = createKyselyChain();
      let selectCount = 0;
      (
        service as unknown as {
          kysely: unknown;
        }
      ).kysely = {
        insertInto: vi.fn(() => insertion),
        selectFrom: vi.fn((table: string) => {
          if (table === "community_upload_outbox") {
            selectCount++;
            return selectCount === 1 ? first : latest;
          }
          return device;
        }),
      };
      mockGetAccessToken.mockResolvedValue(null);
      mockCallEdgeFunction.mockResolvedValue({
        unique_cards: 1,
        upload_count: 1,
      });
      await expect(getOnce()).resolves.toBe("changed");
    });

    it("merges session-only card increases with current and snapshot counts", async () => {
      const cards = createKyselyChain([
        { card_name: "Current", count: 2 },
        { card_name: "Session", count: 1 },
      ]);
      const snapshot = createKyselyChain([
        { card_name: "Current", count: 2 },
        { card_name: "Session", count: 5 },
      ]);
      const session = createKyselyChain([
        { card_name: "Current", count: 1 },
        { card_name: "Session", count: 2 },
      ]);
      let call = 0;
      service = createService({
        selectFrom: vi.fn(() => [cards, snapshot, session][call++]),
      });

      const result = await (
        service as unknown as {
          getChangedCards: (
            game: "poe1",
            league: string,
            sessionId: string,
          ) => Promise<Array<{ card_name: string; count: number }>>;
        }
      ).getChangedCards("poe1", "Standard", "session");

      expect(result).toEqual([
        { card_name: "Current", count: 3 },
        { card_name: "Session", count: 7 },
      ]);
    });

    it("ignores invalid game rows while enqueueing all changed leagues", async () => {
      const leagues = createKyselyChain([
        { game: "invalid", scope: "Broken" },
        { game: "poe1", scope: "Standard" },
      ]);
      service = createService({ selectFrom: vi.fn(() => leagues) });
      const uploadSpy = vi
        .spyOn(service, "uploadOnSessionEnd")
        .mockResolvedValue(undefined);

      await (
        service as unknown as {
          enqueueChangedUploadsForAllLeagues: () => Promise<void>;
        }
      ).enqueueChangedUploadsForAllLeagues();

      expect(uploadSpy).toHaveBeenCalledOnce();
      expect(uploadSpy).toHaveBeenCalledWith("poe1", "Standard", undefined, {
        flush: false,
      });
    });

    it("recovers from a rejected prior session job", async () => {
      service = createService();
      (
        service as unknown as {
          sessionUploadJobs: Map<string, Promise<void>>;
        }
      ).sessionUploadJobs.set("poe1:Standard", Promise.reject("previous"));
      mockSettingsGet.mockResolvedValue(false);

      await service.uploadOnSessionEnd("poe1", "Standard");
    });

    it("handles per-league and outer backfill failures", async () => {
      const leagues = createKyselyChain([{ game: "poe1", scope: "Standard" }]);
      const missingMarker = createKyselyChain(undefined);
      let selectCount = 0;
      service = createService({
        selectFrom: vi.fn(() =>
          selectCount++ === 0 ? leagues : missingMarker,
        ),
      });
      const commitSpy = vi
        .spyOn(getRepository(service), "commitBackfill")
        .mockResolvedValue(undefined);
      vi.spyOn(service, "uploadOnSessionEnd").mockResolvedValue(undefined);
      await service.backfillIfNeeded();
      expect(commitSpy).toHaveBeenCalledWith(
        [{ game: "poe1", league: "Standard" }],
        true,
      );

      resetSingleton(CommunityUploadService);
      service = createService({
        selectFrom: vi.fn(() => {
          throw "outer failure";
        }),
      });
      await service.backfillIfNeeded();

      resetSingleton(CommunityUploadService);
      service = createService({
        selectFrom: vi.fn(() => leagues),
      });
      vi.spyOn(getRepository(service), "commitBackfill").mockResolvedValue(
        undefined,
      );
      vi.spyOn(service, "uploadOnSessionEnd").mockRejectedValue(
        "league failure",
      );
      await service.backfillIfNeeded();
      expect(mockSentryCaptureException).toHaveBeenCalled();
    });
  });
});
