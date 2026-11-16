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
  mockGetAccountId,
  mockNotifyAuthStatusChanged,
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
    mockGetAccountId: vi.fn(),
    mockNotifyAuthStatusChanged: vi.fn(),
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
  createGggAuthServiceMock({
    mockGetAccessToken,
    mockGetAccountId,
    mockNotifyAuthStatusChanged,
  }),
);

vi.mock("~/main/utils/ipc-validation", async (importOriginal) => ({
  ...createIpcValidationMock({
    mockAssertTrustedSender,
    mockHandleValidationError,
    MockIpcValidationError,
  }),
  assertBoolean: (
    await importOriginal<typeof import("~/main/utils/ipc-validation")>()
  ).assertBoolean,
}));

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

import { CommunityIdentityRepository } from "../CommunityIdentity.repository";
import { CommunityUploadChannel } from "../CommunityUpload.channels";
// ─── Import SUT (after mocks) ────────────────────────────────────────────────
import { CommunityUploadRepository } from "../CommunityUpload.repository";
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
    mockGetAccountId.mockReset().mockResolvedValue(null);
    mockNotifyAuthStatusChanged.mockReset();
    // Default: uploads enabled, supabase configured
    mockSettingsGet.mockResolvedValue(true);
    mockIsConfigured.mockReturnValue(true);
    vi.spyOn(
      CommunityIdentityRepository.prototype,
      "getActive",
    ).mockResolvedValue({ id: "device", account_id: null, kind: "anonymous" });
    vi.spyOn(
      CommunityIdentityRepository.prototype,
      "getEligibleIds",
    ).mockResolvedValue(["device"]);
    vi.spyOn(
      CommunityIdentityRepository.prototype,
      "isRetired",
    ).mockResolvedValue(false);
    vi.spyOn(
      CommunityUploadRepository.prototype,
      "getDropContextConsent",
    ).mockResolvedValue(true);
    vi.spyOn(
      CommunityUploadRepository.prototype,
      "getUploadWarning",
    ).mockResolvedValue(undefined);
    vi.spyOn(
      CommunityUploadRepository.prototype,
      "clearIdentityWarning",
    ).mockResolvedValue();
    vi.spyOn(
      CommunityUploadRepository.prototype,
      "setIdentityWarning",
    ).mockResolvedValue();
    vi.spyOn(
      CommunityUploadRepository.prototype,
      "releaseVerificationRetries",
    ).mockResolvedValue();
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

  it("registers the community upload IPC handlers", () => {
    mockGetKysely.mockReturnValue(createKyselyChain());

    service = CommunityUploadService.getInstance();

    expect(
      mockIpcHandle.mock.calls.map(([channel]: [string]) => channel),
    ).toEqual([
      CommunityUploadChannel.GetDropContextConsent,
      CommunityUploadChannel.SetDropContextConsent,
      CommunityUploadChannel.GetBackfillLeagues,
      CommunityUploadChannel.TriggerBackfill,
      CommunityUploadChannel.GetDropContextUploadStatus,
    ]);
  });

  describe("IPC: opening-time consent", () => {
    beforeEach(() => {
      mockGetKysely.mockReturnValue(createKyselyChain());
      service = CommunityUploadService.getInstance();
    });

    it("returns a safe error when the saved consent cannot be read", async () => {
      vi.spyOn(
        getRepository(service),
        "getDropContextConsent",
      ).mockRejectedValueOnce(new Error("private database failure"));
      mockHandleValidationError.mockReturnValueOnce({
        success: false,
        error: "Consent unavailable",
      });
      await expect(
        getIpcHandler(
          mockIpcHandle,
          CommunityUploadChannel.GetDropContextConsent,
        )({ sender: { id: 1 } }),
      ).resolves.toEqual({ success: false, error: "Consent unavailable" });
    });

    it("returns the stored choice without granting consent", async () => {
      vi.spyOn(
        getRepository(service),
        "getDropContextConsent",
      ).mockResolvedValue(null);
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.GetDropContextConsent,
      );
      await expect(handler({ sender: { id: 1 } })).resolves.toEqual({
        success: true,
        consent: null,
      });
    });

    it.each([true, false])(
      "saves explicit choice %j and starts uploads only on opt-in",
      async (enabled) => {
        const save = vi
          .spyOn(getRepository(service), "setDropContextConsent")
          .mockResolvedValue();
        const flush = vi
          .spyOn(service, "flushPendingUploads")
          .mockResolvedValue();
        const handler = getIpcHandler(
          mockIpcHandle,
          CommunityUploadChannel.SetDropContextConsent,
        );
        await expect(handler({ sender: { id: 1 } }, enabled)).resolves.toEqual({
          success: true,
          consent: enabled,
        });
        expect(save).toHaveBeenCalledWith(enabled);
        expect(flush).toHaveBeenCalledTimes(enabled ? 1 : 0);
      },
    );

    it.each(["true", 1, null, undefined, {}, []])(
      "rejects non-boolean choice %j",
      async (enabled) => {
        const save = vi.spyOn(getRepository(service), "setDropContextConsent");
        const handler = getIpcHandler(
          mockIpcHandle,
          CommunityUploadChannel.SetDropContextConsent,
        );
        mockHandleValidationError.mockReturnValue({
          success: false,
          error: "Invalid input",
        });
        await expect(handler({ sender: { id: 1 } }, enabled)).resolves.toEqual({
          success: false,
          error: "Invalid input",
        });
        expect(save).not.toHaveBeenCalled();
      },
    );

    it("does not save a choice from an untrusted sender", async () => {
      const save = vi.spyOn(getRepository(service), "setDropContextConsent");
      mockAssertTrustedSender.mockImplementationOnce(() => {
        throw new Error("Untrusted sender");
      });
      mockHandleValidationError.mockReturnValue({
        success: false,
        error: "Invalid input",
      });
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.SetDropContextConsent,
      );
      await expect(handler({ sender: { id: 999 } }, true)).resolves.toEqual({
        success: false,
        error: "Invalid input",
      });
      expect(save).not.toHaveBeenCalled();
    });

    it("does not start uploading when saving consent fails", async () => {
      vi.spyOn(
        getRepository(service),
        "setDropContextConsent",
      ).mockRejectedValue(new Error("Database unavailable"));
      const flush = vi
        .spyOn(service, "flushPendingUploads")
        .mockResolvedValue();
      mockHandleValidationError.mockReturnValue({
        success: false,
        error: "Could not save",
      });
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.SetDropContextConsent,
      );
      await expect(handler({ sender: { id: 1 } }, true)).resolves.toEqual({
        success: false,
        error: "Could not save",
      });
      expect(flush).not.toHaveBeenCalled();
    });
  });

  describe("IPC: drop-context upload status", () => {
    it("hides account warnings while community sharing is disabled", async () => {
      mockGetKysely.mockReturnValue(createKyselyChain());
      mockSettingsGet.mockResolvedValue(false);
      const getWarning = vi
        .spyOn(CommunityUploadRepository.prototype, "getUploadWarning")
        .mockResolvedValue("verification-required");
      service = CommunityUploadService.getInstance();
      await expect(service.getDropContextUploadStatus()).resolves.toEqual({
        pendingEvents: 0,
        isUploading: false,
        revision: 0,
      });
      expect(getWarning).not.toHaveBeenCalled();
    });

    it("returns account warnings even without opening-time consent", async () => {
      mockGetKysely.mockReturnValue(createKyselyChain());
      vi.spyOn(
        CommunityUploadRepository.prototype,
        "getDropContextConsent",
      ).mockResolvedValue(false);
      const getWarning = vi
        .spyOn(CommunityUploadRepository.prototype, "getUploadWarning")
        .mockResolvedValue("verification-required");
      service = CommunityUploadService.getInstance();
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.GetDropContextUploadStatus,
      );
      await expect(handler({ sender: { id: 1 } })).resolves.toEqual({
        success: true,
        status: {
          pendingEvents: 0,
          isUploading: false,
          revision: 0,
          uploadWarning: "verification-required",
        },
      });
      expect(getWarning).toHaveBeenCalledWith(null, false);
    });

    it("returns the pending event count", async () => {
      mockGetKysely.mockReturnValue(createKyselyChain({ count: 4_500 }));
      service = CommunityUploadService.getInstance();

      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.GetDropContextUploadStatus,
      );

      await expect(handler({ sender: { id: 1 } })).resolves.toEqual({
        success: true,
        status: {
          pendingEvents: 4_500,
          isUploading: false,
          revision: 0,
        },
      });
      expect(mockAssertTrustedSender).toHaveBeenCalledWith(
        { sender: { id: 1 } },
        CommunityUploadChannel.GetDropContextUploadStatus,
      );
    });

    it("returns a safe failure for an untrusted sender", async () => {
      mockGetKysely.mockReturnValue(createKyselyChain());
      mockAssertTrustedSender.mockImplementation(() => {
        throw new MockIpcValidationError(
          CommunityUploadChannel.GetDropContextUploadStatus,
          "untrusted sender",
        );
      });
      mockHandleValidationError.mockReturnValue({
        success: false,
        error: "Invalid input: untrusted sender",
      });
      service = CommunityUploadService.getInstance();

      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.GetDropContextUploadStatus,
      );

      await expect(handler({ sender: { id: 999 } })).resolves.toEqual({
        success: false,
        error: "Invalid input: untrusted sender",
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // uploadOnSessionEnd
  // ─────────────────────────────────────────────────────────────────────────

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

    it("should default to false when setting is undefined", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockResolvedValue(undefined);

      service = CommunityUploadService.getInstance();
      const result = await service.isEnabled();

      expect(result).toBe(false);
    });

    it("should default to false when setting is null", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockResolvedValue(null);

      service = CommunityUploadService.getInstance();
      const result = await service.isEnabled();

      expect(result).toBe(false);
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
      expect(uploadSpy).toHaveBeenCalledWith("poe2", "Settlers", {
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
        service.uploadOnSessionEnd("poe1", "Settlers", {
          throwOnFailure: true,
        }),
      ).rejects.toThrow("sqlite unavailable");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getBackfillLeagues
  // ─────────────────────────────────────────────────────────────────────────

  describe("getBackfillLeagues", () => {
    it("can offer the contribution opt-in while uploads are disabled", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockResolvedValue(false);

      service = CommunityUploadService.getInstance();
      vi.spyOn(getRepository(service), "getBackfillLeagues").mockResolvedValue([
        { game: "poe1", league: "Settlers" },
      ]);
      const result = await service.getBackfillLeagues();
      expect(result).toEqual([{ game: "poe1", league: "Settlers" }]);
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

    it("offers leagues for an explicit contribution while uploads are disabled", async () => {
      const kyselyMock = createKyselyChain();
      mockGetKysely.mockReturnValue(kyselyMock);
      mockSettingsGet.mockResolvedValue(false);

      service = CommunityUploadService.getInstance();
      vi.spyOn(getRepository(service), "getBackfillLeagues").mockResolvedValue([
        { game: "poe1", league: "Settlers" },
      ]);
      const handler = getIpcHandler(
        mockIpcHandle,
        CommunityUploadChannel.GetBackfillLeagues,
      );

      const result = await handler({ sender: { id: 1 } });
      expect(result).toEqual({
        success: true,
        leagues: [{ game: "poe1", league: "Settlers" }],
      });
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

  describe("account changes during verification and upload", () => {
    beforeEach(() => {
      mockGetKysely.mockReturnValue(createKyselyChain());
      service = CommunityUploadService.getInstance();
      mockGetAccountId.mockResolvedValue("account-a");
      mockGetAccessToken.mockResolvedValue("proof");
      vi.spyOn(
        CommunityIdentityRepository.prototype,
        "getVerified",
      ).mockResolvedValue(undefined);
      vi.spyOn(
        CommunityIdentityRepository.prototype,
        "activateVerified",
      ).mockImplementation(() => {});
      vi.spyOn(
        CommunityIdentityRepository.prototype,
        "activateAnonymous",
      ).mockImplementation((clear) => clear());
      vi.spyOn(service, "getDeviceId").mockResolvedValue("legacy-id");
      vi.spyOn(service as any, "emitDropContextUploadStatus").mockResolvedValue(
        undefined,
      );
      vi.spyOn(service as any, "resumeVerifiedUploads").mockResolvedValue(
        undefined,
      );
      mockCallEdgeFunction.mockImplementation(async (_name, payload) => ({
        success: true,
        device_id: payload.device_id,
        ggg_uuid: "account-a",
        legacy_anonymous: false,
      }));
    });

    it.each([
      "different account",
      "missing proof",
      "account changed before request",
    ])("does not activate verification with %s", async (failure) => {
      if (failure === "different account")
        mockGetAccountId.mockResolvedValue("account-b");
      if (failure === "missing proof")
        mockGetAccessToken.mockResolvedValue(null);
      if (failure === "account changed before request")
        vi.spyOn(service, "getDeviceId").mockImplementationOnce(async () => {
          mockGetAccountId.mockResolvedValue("account-b");
          return "legacy-id";
        });
      await expect(service.linkGggAccount("account-a")).rejects.toThrow(
        failure === "missing proof"
          ? "verification is unavailable"
          : "sign-in changed while linking",
      );
      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
      expect(
        CommunityIdentityRepository.prototype.activateVerified,
      ).not.toHaveBeenCalled();
    });

    it.each([
      null,
      { success: false },
      { success: true, ggg_uuid: "account-b", device_id: "legacy-id" },
      { success: true, ggg_uuid: "account-a", device_id: "another-device" },
    ])("rejects an unacknowledged identity response %j", async (response) => {
      mockCallEdgeFunction.mockResolvedValueOnce(response);
      await expect(service.linkGggAccount("account-a")).rejects.toThrow(
        "identity was not acknowledged",
      );
      expect(
        CommunityIdentityRepository.prototype.activateVerified,
      ).not.toHaveBeenCalled();
    });

    it.each([
      "device ID",
      "account before request",
      "account after acknowledgement",
    ])(
      "cancels verification when unlink starts while reading %s",
      async (stage) => {
        const reading = Promise.withResolvers<void>();
        const finish = Promise.withResolvers<string>();
        if (stage === "device ID")
          vi.spyOn(service, "getDeviceId").mockImplementationOnce(() => {
            reading.resolve();
            return finish.promise;
          });
        else {
          let reads = 0;
          mockGetAccountId.mockImplementation(() => {
            reads += 1;
            if (reads === (stage === "account before request" ? 2 : 3)) {
              reading.resolve();
              return finish.promise;
            }
            return Promise.resolve("account-a");
          });
        }
        const linking = service.linkGggAccount("account-a");
        await reading.promise;
        const unlinking = service.unlinkGggAccount();
        await service.linkGggAccount("account-b");
        finish.resolve(stage === "device ID" ? "legacy-id" : "account-a");
        await Promise.all([linking, unlinking]);
        expect(
          CommunityIdentityRepository.prototype.activateVerified,
        ).not.toHaveBeenCalled();
        expect(
          CommunityIdentityRepository.prototype.activateAnonymous,
        ).toHaveBeenCalledOnce();
      },
    );

    it.each([false, true])(
      "runs late credential cleanup on an already-switched unlink (failed=%s)",
      async (failed) => {
        const clear = vi.fn(() => {
          if (failed) throw new Error("credential cleanup failed");
        });
        let late!: Promise<void>;
        mockNotifyAuthStatusChanged.mockImplementationOnce(() => {
          late = service.unlinkGggAccount(clear);
          if (failed) void late.catch(() => {});
        });
        const first = service.unlinkGggAccount();
        const overlapping = service.unlinkGggAccount();
        expect(overlapping).toBe(first);
        await first;
        if (failed)
          await expect(late).rejects.toThrow("credential cleanup failed");
        else await expect(late).resolves.toBeUndefined();
        expect(clear).toHaveBeenCalledOnce();
        expect(
          CommunityIdentityRepository.prototype.activateAnonymous,
        ).toHaveBeenCalledOnce();
      },
    );

    it.each([new Error("retry release failed"), "retry release failed"])(
      "reports resume failures without rejecting verification: %s",
      async (failure) => {
        vi.mocked((service as any).resumeVerifiedUploads).mockRestore();
        vi.spyOn(
          getRepository(service),
          "releaseVerificationRetries",
        ).mockRejectedValueOnce(failure);
        await service.linkGggAccount("account-a");
        await service.drainInFlightUploads();
        expect(mockSentryCaptureException).toHaveBeenCalledWith(
          expect.objectContaining({ message: "retry release failed" }),
          expect.objectContaining({
            tags: { module: "community-upload", operation: "resume-verified" },
          }),
        );
      },
    );

    it("pauses automatic retries after sharing is disabled", async () => {
      vi.mocked((service as any).resumeVerifiedUploads).mockRestore();
      mockSettingsGet.mockResolvedValue(false);
      await (service as any).resumeVerifiedUploads("account-a", 0);
      expect(
        getRepository(service).releaseVerificationRetries,
      ).not.toHaveBeenCalled();
      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("does not resume a released queue if unlink changes the account in the meantime", async () => {
      vi.mocked((service as any).resumeVerifiedUploads).mockRestore();
      const released = Promise.withResolvers<void>();
      vi.spyOn(
        getRepository(service),
        "releaseVerificationRetries",
      ).mockReturnValueOnce(released.promise);
      const flush = vi
        .spyOn(service, "flushPendingUploads")
        .mockResolvedValue();
      const resuming = (service as any).resumeVerifiedUploads("account-a", 0);
      await vi.waitFor(() =>
        expect(
          getRepository(service).releaseVerificationRetries,
        ).toHaveBeenCalledOnce(),
      );
      await service.unlinkGggAccount();
      released.resolve();
      await resuming;
      expect(flush).not.toHaveBeenCalled();
    });

    it("keeps the newest account's resume job while an older resume finishes", async () => {
      const first = Promise.withResolvers<void>();
      const second = Promise.withResolvers<void>();
      vi.spyOn(service as any, "activateVerifiedIdentity").mockResolvedValue(
        "account-a",
      );
      vi.mocked((service as any).resumeVerifiedUploads)
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      await service.linkGggAccount("account-a");
      await service.linkGggAccount("account-b");
      const newest = (service as any).verifiedResumeJob;
      first.resolve();
      await first.promise;
      expect((service as any).verifiedResumeJob).toBe(newest);
      second.resolve();
      await service.drainInFlightUploads();
      expect((service as any).verifiedResumeJob).toBeNull();
    });

    it("does not inspect upload ownership while unlinking", async () => {
      const unlinking = service.unlinkGggAccount();
      const access = (service as any).getOwnerAccess(
        "owner",
        "poe1",
        "Settlers",
      );
      const ensuring = (service as any).ensureAccountIdentity();
      await expect(access).resolves.toEqual({ allowed: false, token: null });
      await Promise.all([ensuring, unlinking]);
      expect(mockGetAccountId).not.toHaveBeenCalled();
    });

    it("continues the newest account verification after an older link fails", async () => {
      const oldResponse = Promise.withResolvers<string>();
      const activate = vi
        .spyOn(service as any, "activateVerifiedIdentity")
        .mockReturnValueOnce(oldResponse.promise)
        .mockResolvedValueOnce("account-b");
      const first = service.linkGggAccount("account-a");
      const failure = expect(first).rejects.toThrow("old verification failed");
      const second = service.linkGggAccount("account-b");
      oldResponse.reject(new Error("old verification failed"));
      await Promise.all([failure, second]);
      expect(activate).toHaveBeenCalledTimes(2);
      expect(activate).toHaveBeenLastCalledWith("account-b", 2);
      expect(
        (service as any).resumeVerifiedUploads,
      ).toHaveBeenCalledExactlyOnceWith("account-b", 2);
    });

    it.each(["retired", "missing", "signed out"])(
      "does not upload data for a %s identity",
      async (kind) => {
        if (kind === "retired")
          vi.spyOn(
            CommunityIdentityRepository.prototype,
            "isRetired",
          ).mockResolvedValueOnce(true);
        else
          vi.spyOn(
            CommunityIdentityRepository.prototype,
            "get",
          ).mockResolvedValueOnce(
            kind === "missing"
              ? undefined
              : { id: "owner", kind: "verified", account_id: "account-a" },
          );
        if (kind === "signed out") {
          mockGetAccountId.mockResolvedValue(null);
          vi.spyOn(
            CommunityIdentityRepository.prototype,
            "getActive",
          ).mockResolvedValueOnce({
            id: "owner",
            kind: "verified",
            account_id: "account-a",
          });
        }
        await expect(
          (service as any).getOwnerAccess("owner", "poe1", "Settlers"),
        ).resolves.toEqual({ allowed: false, token: null });
        expect(mockCallEdgeFunction).not.toHaveBeenCalled();
        if (kind === "signed out")
          expect(
            CommunityIdentityRepository.prototype.activateAnonymous,
          ).toHaveBeenCalledOnce();
      },
    );

    it("returns an empty status when no upload identities are eligible", async () => {
      vi.spyOn(
        CommunityIdentityRepository.prototype,
        "getEligibleIds",
      ).mockResolvedValueOnce([]);
      await expect(service.getDropContextUploadStatus()).resolves.toEqual({
        pendingEvents: 0,
        isUploading: false,
        revision: 0,
      });
    });

    it("leaves session uploads unavailable when the backend is not configured", async () => {
      mockIsConfigured.mockReturnValue(false);
      await expect(
        service.uploadOnSessionEnd("poe1", "Settlers", {
          throwOnFailure: true,
        }),
      ).rejects.toThrow("Community uploads are unavailable");
      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("normalizes preparation failures that are not Error objects", async () => {
      vi.spyOn(service as any, "ensureAccountIdentity").mockRejectedValueOnce(
        "preparation failed",
      );
      await expect(
        service.uploadOnSessionEnd("poe1", "Settlers", {
          throwOnFailure: true,
        }),
      ).rejects.toThrow("preparation failed");
      expect(mockSentryCaptureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: "preparation failed" }),
        expect.any(Object),
      );
    });

    it("coalesces overlapping flushes for the same owner and league", async () => {
      const flushed = Promise.withResolvers<void>();
      const loop = vi
        .spyOn(service as any, "flushPendingUploadLoop")
        .mockReturnValueOnce(flushed.promise);
      const first = (service as any).flushPendingUpload(
        "poe1",
        "Settlers",
        "owner",
      );
      const second = (service as any).flushPendingUpload(
        "poe1",
        "Settlers",
        "owner",
      );
      flushed.resolve();
      await Promise.all([first, second]);
      expect(loop).toHaveBeenCalledOnce();
    });

    it("does not process a queued count retry after sharing is disabled", async () => {
      mockSettingsGet.mockResolvedValue(false);
      await expect(
        (service as any).flushPendingUploadOnce("poe1", "Settlers", "owner"),
      ).resolves.toBe("retry-later");
      expect(mockCallEdgeFunction).not.toHaveBeenCalled();
    });

    it("does not recreate local upload progress for an identity retired during its network request", async () => {
      vi.spyOn(service as any, "getOwnerAccess").mockResolvedValueOnce({
        allowed: true,
        token: null,
      });
      mockCallEdgeFunction.mockImplementationOnce(async () => {
        vi.spyOn(
          CommunityIdentityRepository.prototype,
          "isRetired",
        ).mockResolvedValue(true);
        return {
          success: true,
          upload_id: "upload",
          total_cards: 1,
          unique_cards: 1,
          upload_count: 1,
          is_verified: false,
        };
      });
      await expect(
        (service as any).sendPendingUpload(
          "poe1",
          "Settlers",
          [{ card_name: "The Doctor", count: 1 }],
          "owner",
        ),
      ).resolves.toBe(true);
      expect(
        mockGetKysely.mock.results.at(-1)?.value.insertInto,
      ).not.toHaveBeenCalled();
    });

    it.each([
      "sharing disabled",
      "context consent withdrawn",
      "account changed",
    ])(
      "keeps the event queue intact when %s before sending a prepared batch",
      async (change) => {
        vi.spyOn(service as any, "getOwnerAccess").mockResolvedValueOnce({
          allowed: true,
          token: null,
        });
        vi.spyOn(service as any, "getPendingDropEvents").mockResolvedValueOnce([
          {
            event_id: "event",
            card_name: "The Doctor",
            local_minute: 1,
            utc_offset_minutes: 0,
            location: null,
          },
        ]);
        const sending = vi.spyOn(service as any, "sendPendingDropEvents");
        const deleting = vi.spyOn(service as any, "deletePendingDropEvents");
        if (change === "sharing disabled")
          vi.spyOn(service, "isEnabled")
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
        if (change === "context consent withdrawn")
          vi.spyOn(getRepository(service), "getDropContextConsent")
            .mockResolvedValueOnce(true)
            .mockResolvedValueOnce(false);
        if (change === "account changed")
          vi.spyOn(
            service as any,
            "reserveDropEventRequest",
          ).mockImplementationOnce(() => {
            void service.unlinkGggAccount();
            return true;
          });
        await (service as any).flushPendingDropEventLoop(
          "poe1",
          "Settlers",
          "owner",
        );
        expect(sending).not.toHaveBeenCalled();
        expect(deleting).not.toHaveBeenCalled();
      },
    );
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

    it("reuses an in-flight global flush", async () => {
      service = createService();
      let finish!: () => void;
      const internal = vi
        .spyOn(service as any, "flushPendingUploadsInternal")
        .mockReturnValue(
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
        );

      const first = service.flushPendingUploads();
      const second = service.flushPendingUploads();

      expect(second).toBe(first);
      expect(internal).toHaveBeenCalledOnce();

      const drain = service.drainInFlightUploads();
      finish();
      await Promise.all([first, drain]);

      await service.flushPendingUploads();
      expect(internal).toHaveBeenCalledTimes(2);
    });

    it("keeps a replacement global flush registered during cleanup", async () => {
      service = createService();
      let finish!: () => void;
      vi.spyOn(service as any, "flushPendingUploadsInternal").mockReturnValue(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );

      const queued = service.flushPendingUploads();
      const replacement = Promise.resolve();
      (service as any).pendingUploadsFlushJob = replacement;
      finish();
      await queued;

      expect((service as any).pendingUploadsFlushJob).toBe(replacement);
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
              identityId: string,
            ) => Promise<string>;
          }
        ).flushPendingUploadOnce("poe1", "Standard", "device");
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
      vi.spyOn(service as any, "getOwnerAccess").mockResolvedValue({
        allowed: true,
        token: null,
      });
      mockGetAccessToken.mockResolvedValue(null);
      mockCallEdgeFunction.mockResolvedValue({
        success: true,
        upload_id: "upload-1",
        total_cards: 1,
        is_verified: false,
        unique_cards: 1,
        upload_count: 1,
      });
      await expect(getOnce()).resolves.toBe("changed");
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
      expect(uploadSpy).toHaveBeenCalledWith("poe1", "Standard", {
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

    it("recovers from an Error in a prior session job", async () => {
      service = createService();
      (service as any).sessionUploadJobs.set(
        "poe1:Standard",
        Promise.reject(new Error("previous")),
      );
      mockSettingsGet.mockResolvedValue(false);

      await service.uploadOnSessionEnd("poe1", "Standard");
    });

    it("keeps a replacement session job registered during cleanup", async () => {
      service = createService();
      mockSettingsGet.mockResolvedValue(false);
      const queued = (service as any).queueSessionUpload("poe1", "Standard");
      const replacement = Promise.resolve({ success: true });
      (service as any).sessionUploadJobs.set("poe1:Standard", replacement);

      await queued;

      expect((service as any).sessionUploadJobs.get("poe1:Standard")).toBe(
        replacement,
      );
    });

    it("reports non-Error failures from the global flush", async () => {
      service = createService({
        selectFrom: vi.fn(() => {
          throw "flush failed";
        }),
      });

      await service.flushPendingUploads();

      expect(mockSentryCaptureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: "flush failed" }),
        expect.any(Object),
      );
    });

    it("reports Error failures from the global flush", async () => {
      const failure = new Error("flush failed");
      service = createService({
        selectFrom: vi.fn(() => {
          throw failure;
        }),
      });

      await service.flushPendingUploads();

      expect(mockSentryCaptureException).toHaveBeenCalledWith(
        failure,
        expect.any(Object),
      );
    });

    it("records and reports a failed pending row", async () => {
      const row = {
        attempts: 0,
        cards_json: "invalid",
        game: "poe1",
        last_error: null,
        next_attempt_at: null,
        scope: "Standard",
      };
      const selection = createKyselyChain(row);
      const update = createKyselyChain();
      service = createService({
        selectFrom: vi.fn(() => selection),
        updateTable: vi.fn(() => update),
      });
      vi.spyOn(service as any, "parseOutboxCards").mockImplementation(() => {
        throw "invalid cards";
      });

      await expect(
        (service as any).flushPendingUploadOnce("poe1", "Standard", "device"),
      ).resolves.toBe("retry-later");

      expect(update.set).toHaveBeenCalledWith(
        expect.objectContaining({ last_error: "invalid cards" }),
      );
      expect(mockSentryCaptureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: "invalid cards" }),
        expect.any(Object),
      );
    });

    it("records and reports an Error from a pending row", async () => {
      const row = {
        attempts: 0,
        cards_json: "invalid",
        game: "poe1",
        last_error: null,
        next_attempt_at: null,
        scope: "Standard",
      };
      const selection = createKyselyChain(row);
      const update = createKyselyChain();
      const failure = new Error("invalid cards");
      service = createService({
        selectFrom: vi.fn(() => selection),
        updateTable: vi.fn(() => update),
      });
      vi.spyOn(service as any, "parseOutboxCards").mockImplementation(() => {
        throw failure;
      });

      await expect(
        (service as any).flushPendingUploadOnce("poe1", "Standard", "device"),
      ).resolves.toBe("retry-later");
      expect(mockSentryCaptureException).toHaveBeenCalledWith(
        failure,
        expect.any(Object),
      );
    });

    it("keeps a replacement flush job registered during cleanup", async () => {
      service = createService();
      let finish!: () => void;
      vi.spyOn(service as any, "flushPendingUploadLoop").mockReturnValue(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
      const queued = (service as any).flushPendingUpload(
        "poe1",
        "Standard",
        "device",
      );
      const replacement = Promise.resolve();
      (service as any).flushJobs.set("device:poe1:Standard", replacement);
      finish();

      await queued;

      expect((service as any).flushJobs.get("device:poe1:Standard")).toBe(
        replacement,
      );
    });

    it("retries changed rows for all three flush passes", async () => {
      service = createService();
      const once = vi
        .spyOn(service as any, "flushPendingUploadOnce")
        .mockResolvedValue("changed");

      await (service as any).flushPendingUploadLoop(
        "poe1",
        "Standard",
        "device",
      );

      expect(once).toHaveBeenCalledTimes(3);
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
