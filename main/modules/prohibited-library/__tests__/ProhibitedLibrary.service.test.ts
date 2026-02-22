import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const {
  mockIpcHandle,
  mockGetAllWindows,
  mockElectronApp,
  mockReadFile,
  mockSettingsGet,
  mockGetKysely,
  mockRepositoryUpsertCardWeights,
  mockRepositoryGetCardWeights,
  mockRepositoryGetFromBossCards,
  mockRepositoryUpsertMetadata,
  mockRepositoryGetMetadata,
  mockRepositorySyncFromBossFlags,
  mockPoeLeaguesGetLeagueByName,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockGetAllWindows: vi.fn((): any[] => []),
  mockElectronApp: {
    isPackaged: false,
    getAppPath: vi.fn(() => "/mock-app-path"),
    getPath: vi.fn(() => "/mock-user-data"),
    getVersion: vi.fn(() => "1.0.0"),
  },
  mockReadFile: vi.fn(),
  mockSettingsGet: vi.fn(),
  mockGetKysely: vi.fn(),
  mockRepositoryUpsertCardWeights: vi.fn(),
  mockRepositoryGetCardWeights: vi.fn(),
  mockRepositoryGetFromBossCards: vi.fn(),
  mockRepositoryUpsertMetadata: vi.fn(),
  mockRepositoryGetMetadata: vi.fn(),
  mockRepositorySyncFromBossFlags: vi.fn(),
  mockPoeLeaguesGetLeagueByName: vi.fn(),
}));

// ─── Mock Electron ───────────────────────────────────────────────────────────

vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: mockGetAllWindows,
  },
  app: mockElectronApp,
}));

// ─── Mock node:fs/promises ───────────────────────────────────────────────────

vi.mock("node:fs/promises", () => ({
  readFile: mockReadFile,
}));

// ─── Mock DatabaseService ────────────────────────────────────────────────────

vi.mock("~/main/modules/database", () => ({
  DatabaseService: {
    getInstance: vi.fn(() => ({
      getKysely: mockGetKysely,
    })),
  },
}));

// ─── Mock SettingsStoreService ───────────────────────────────────────────────

vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: vi.fn(() => ({
      get: mockSettingsGet,
      set: vi.fn(),
    })),
  },
  SettingsKey: {
    SelectedPoe1League: "poe1SelectedLeague",
    SelectedPoe2League: "poe2SelectedLeague",
    ActiveGame: "selectedGame",
  },
}));

// ─── Mock ProhibitedLibraryRepository ────────────────────────────────────────

vi.mock("../ProhibitedLibrary.repository", () => {
  return {
    ProhibitedLibraryRepository: class MockProhibitedLibraryRepository {
      upsertCardWeights = mockRepositoryUpsertCardWeights;
      getCardWeights = mockRepositoryGetCardWeights;
      getFromBossCards = mockRepositoryGetFromBossCards;
      upsertMetadata = mockRepositoryUpsertMetadata;
      getMetadata = mockRepositoryGetMetadata;
      syncFromBossFlags = mockRepositorySyncFromBossFlags;
    },
  };
});

// ─── Mock PoeLeaguesRepository ───────────────────────────────────────────────

vi.mock("~/main/modules/poe-leagues/PoeLeagues.repository", () => {
  return {
    PoeLeaguesRepository: class MockPoeLeaguesRepository {
      getLeagueByName = mockPoeLeaguesGetLeagueByName;
    },
  };
});

// ─── Mock LoggerService ──────────────────────────────────────────────────────

vi.mock("~/main/modules/logger", () => ({
  LoggerService: {
    createLogger: vi.fn(() => ({
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

// ─── Import service under test ───────────────────────────────────────────────

import { ProhibitedLibraryChannel } from "../ProhibitedLibrary.channels";
import { ProhibitedLibraryService } from "../ProhibitedLibrary.service";

// ─── Test CSV fixture ────────────────────────────────────────────────────────

const MOCK_CSV_CONTENT = [
  "patch,Bucket,col2,Ritual,col4,Keepers,All samples",
  "Sample Size,,,,,1000,5000",
  "The Doctor,18,,4,,10,50",
  "Rain of Chaos,1,,5,,121400,121400",
  "The Nurse,15,,4,,1500,6000",
  "A Chilling Wind,3,,5,,8000,15000",
  "The Void,26,,Boss,,0,0",
].join("\n");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getIpcHandler(channel: string): (...args: any[]) => Promise<any> {
  const call = mockIpcHandle.mock.calls.find(
    ([registeredChannel]: [string]) => registeredChannel === channel,
  );
  if (!call) {
    throw new Error(
      `No IPC handler registered for channel "${channel}". ` +
        `Registered channels: ${mockIpcHandle.mock.calls
          .map(([c]: [string]) => c)
          .join(", ")}`,
    );
  }
  return call[1];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("ProhibitedLibraryService", () => {
  let service: ProhibitedLibraryService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    ProhibitedLibraryService._instance = undefined;

    // Default mock returns
    mockReadFile.mockResolvedValue(MOCK_CSV_CONTENT);
    mockRepositoryGetMetadata.mockResolvedValue(undefined);
    mockRepositoryUpsertCardWeights.mockResolvedValue(undefined);
    mockRepositoryUpsertMetadata.mockResolvedValue(undefined);
    mockRepositorySyncFromBossFlags.mockResolvedValue(undefined);
    mockRepositoryGetCardWeights.mockResolvedValue([]);
    mockRepositoryGetFromBossCards.mockResolvedValue([]);
    mockSettingsGet.mockResolvedValue("Keepers");
    mockPoeLeaguesGetLeagueByName.mockResolvedValue({
      id: "uuid-keepers",
      game: "poe1",
      leagueId: "Keepers",
      name: "Keepers",
      startAt: null,
      endAt: null,
      isActive: true,
      updatedAt: null,
      fetchedAt: "2025-06-01T00:00:00Z",
    });

    mockElectronApp.isPackaged = false;
    mockElectronApp.getAppPath.mockReturnValue("/mock-app-path");
    mockElectronApp.getVersion.mockReturnValue("1.0.0");

    service = ProhibitedLibraryService.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe("singleton", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = ProhibitedLibraryService.getInstance();
      const instance2 = ProhibitedLibraryService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("should return a new instance after resetting the singleton", () => {
      const instance1 = ProhibitedLibraryService.getInstance();
      // @ts-expect-error — accessing private static for testing
      ProhibitedLibraryService._instance = undefined;
      const instance2 = ProhibitedLibraryService.getInstance();
      expect(instance1).not.toBe(instance2);
    });
  });

  // ─── IPC Handler Registration ────────────────────────────────────────────

  describe("IPC handler registration", () => {
    it("should register all required IPC handlers", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([channel]: [string]) => channel,
      );

      expect(registeredChannels).toContain(ProhibitedLibraryChannel.Reload);
      expect(registeredChannels).toContain(ProhibitedLibraryChannel.GetStatus);
      expect(registeredChannels).toContain(
        ProhibitedLibraryChannel.GetCardWeights,
      );
      expect(registeredChannels).toContain(
        ProhibitedLibraryChannel.GetFromBossCards,
      );
    });
  });

  // ─── loadData ────────────────────────────────────────────────────────────

  describe("loadData", () => {
    it("should parse CSV and persist card weights for poe1", async () => {
      const result = await service.loadData("poe1", false);

      expect(result.success).toBe(true);
      expect(result.cardCount).toBe(5); // The Doctor, Rain of Chaos, The Nurse, A Chilling Wind, The Void
      expect(result.league).toBe("Keepers");
      expect(result.loadedAt).toBeTruthy();
    });

    it("should call readFile with the correct dev path for poe1", async () => {
      await service.loadData("poe1", false);

      expect(mockReadFile).toHaveBeenCalledTimes(1);
      const calledPath = mockReadFile.mock.calls[0][0] as string;
      const normalized = calledPath.replace(/\\/g, "/");
      expect(normalized).toBe(
        "/mock-app-path/renderer/assets/poe1/prohibited-library-weights.csv",
      );
    });

    it("should upsert card weights to the repository", async () => {
      await service.loadData("poe1", false);

      expect(mockRepositoryUpsertCardWeights).toHaveBeenCalledTimes(1);
      const upsertedRows = mockRepositoryUpsertCardWeights.mock.calls[0][0];
      expect(upsertedRows).toHaveLength(5);

      // Verify structure of first row
      const doctor = upsertedRows.find((r: any) => r.cardName === "The Doctor");
      expect(doctor).toBeDefined();
      expect(doctor.game).toBe("poe1");
      expect(doctor.league).toBe("Keepers");
      expect(doctor.weight).toBe(10);
      expect(doctor.fromBoss).toBe(false);
      expect(doctor.loadedAt).toBeTruthy();
    });

    it("should upsert metadata after persisting weights", async () => {
      await service.loadData("poe1", false);

      expect(mockRepositoryUpsertMetadata).toHaveBeenCalledTimes(1);
      const [game, league, loadedAt, appVersion, cardCount] =
        mockRepositoryUpsertMetadata.mock.calls[0];
      expect(game).toBe("poe1");
      expect(league).toBe("Keepers");
      expect(loadedAt).toBeTruthy();
      expect(appVersion).toBe("1.0.0");
      expect(cardCount).toBe(5);
    });

    it("should sync from_boss flags after persisting weights", async () => {
      await service.loadData("poe1", false);

      expect(mockRepositorySyncFromBossFlags).toHaveBeenCalledTimes(1);
      expect(mockRepositorySyncFromBossFlags).toHaveBeenCalledWith(
        "poe1",
        "Keepers",
      );
    });

    it("should return clean no-op for poe2 (no bundled CSV)", async () => {
      const result = await service.loadData("poe2", false);

      expect(result.success).toBe(true);
      expect(result.cardCount).toBe(0);
      expect(result.league).toBe("");
      expect(result.loadedAt).toBe("");
      expect(mockReadFile).not.toHaveBeenCalled();
      expect(mockRepositoryUpsertCardWeights).not.toHaveBeenCalled();
    });

    it("should return error when CSV file read fails", async () => {
      mockReadFile.mockRejectedValue(new Error("File not found"));

      const result = await service.loadData("poe1", false);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to read CSV");
      expect(result.cardCount).toBe(0);
    });

    it("should return error when CSV parsing fails", async () => {
      // Provide CSV content that will fail parsing (no "All samples" column)
      mockReadFile.mockResolvedValue("col1,col2,col3\ndata1,data2,data3");

      const result = await service.loadData("poe1", false);

      expect(result.success).toBe(false);
      expect(result.error).toContain("CSV parse failed");
      expect(result.cardCount).toBe(0);
    });

    it("should broadcast refresh to renderer windows after successful load", async () => {
      const mockSend = vi.fn();
      mockGetAllWindows.mockReturnValue([
        {
          isDestroyed: () => false,
          webContents: { isDestroyed: () => false, send: mockSend },
        } as any,
      ]);

      await service.loadData("poe1", false);

      expect(mockSend).toHaveBeenCalledWith(
        ProhibitedLibraryChannel.OnDataRefreshed,
        "poe1",
      );
    });

    it("should not broadcast when load fails", async () => {
      mockReadFile.mockRejectedValue(new Error("File not found"));
      const mockSend = vi.fn();
      mockGetAllWindows.mockReturnValue([
        {
          isDestroyed: () => false,
          webContents: { isDestroyed: () => false, send: mockSend },
        } as any,
      ]);

      await service.loadData("poe1", false);

      expect(mockSend).not.toHaveBeenCalled();
    });

    it("should skip destroyed windows when broadcasting", async () => {
      const mockSend = vi.fn();
      mockGetAllWindows.mockReturnValue([
        { isDestroyed: () => true, webContents: { send: mockSend } } as any,
      ]);

      await service.loadData("poe1", false);

      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  // ─── Version-check (skip re-parse) ──────────────────────────────────────

  describe("version-check", () => {
    it("should skip re-parse when cached version and league match", async () => {
      mockRepositoryGetMetadata.mockResolvedValue({
        game: "poe1",
        league: "Keepers",
        loaded_at: "2025-06-01T00:00:00.000Z",
        app_version: "1.0.0",
        card_count: 42,
        created_at: "2025-06-01T00:00:00.000Z",
      });
      mockElectronApp.getVersion.mockReturnValue("1.0.0");

      const result = await service.loadData("poe1", false);

      expect(result.success).toBe(true);
      expect(result.cardCount).toBe(42);
      expect(result.league).toBe("Keepers");
      expect(result.loadedAt).toBe("2025-06-01T00:00:00.000Z");

      // Should NOT upsert anything since we skipped
      expect(mockRepositoryUpsertCardWeights).not.toHaveBeenCalled();
      expect(mockRepositoryUpsertMetadata).not.toHaveBeenCalled();
      expect(mockRepositorySyncFromBossFlags).not.toHaveBeenCalled();
    });

    it("should re-parse when app version differs", async () => {
      mockRepositoryGetMetadata.mockResolvedValue({
        game: "poe1",
        league: "Keepers",
        loaded_at: "2025-06-01T00:00:00.000Z",
        app_version: "0.9.0", // Old version
        card_count: 42,
        created_at: "2025-06-01T00:00:00.000Z",
      });
      mockElectronApp.getVersion.mockReturnValue("1.0.0"); // New version

      const result = await service.loadData("poe1", false);

      expect(result.success).toBe(true);
      expect(mockRepositoryUpsertCardWeights).toHaveBeenCalledTimes(1);
      expect(mockRepositoryUpsertMetadata).toHaveBeenCalledTimes(1);
    });

    it("should re-parse when cached league differs from resolved league", async () => {
      mockRepositoryGetMetadata.mockResolvedValue({
        game: "poe1",
        league: "Settlers", // Different league
        loaded_at: "2025-06-01T00:00:00.000Z",
        app_version: "1.0.0",
        card_count: 42,
        created_at: "2025-06-01T00:00:00.000Z",
      });

      const result = await service.loadData("poe1", false);

      expect(result.success).toBe(true);
      expect(mockRepositoryUpsertCardWeights).toHaveBeenCalledTimes(1);
    });

    it("should re-parse when no cached metadata exists", async () => {
      mockRepositoryGetMetadata.mockResolvedValue(undefined);

      const result = await service.loadData("poe1", false);

      expect(result.success).toBe(true);
      expect(mockRepositoryUpsertCardWeights).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Force reload ───────────────────────────────────────────────────────

  describe("force reload", () => {
    it("should bypass version-check when force = true", async () => {
      mockRepositoryGetMetadata.mockResolvedValue({
        game: "poe1",
        league: "Keepers",
        loaded_at: "2025-06-01T00:00:00.000Z",
        app_version: "1.0.0", // Same version — normally would skip
        card_count: 42,
        created_at: "2025-06-01T00:00:00.000Z",
      });
      mockElectronApp.getVersion.mockReturnValue("1.0.0");

      const result = await service.loadData("poe1", true);

      expect(result.success).toBe(true);
      // Should upsert even though version matches
      expect(mockRepositoryUpsertCardWeights).toHaveBeenCalledTimes(1);
      expect(mockRepositoryUpsertMetadata).toHaveBeenCalledTimes(1);
      expect(mockRepositorySyncFromBossFlags).toHaveBeenCalledTimes(1);
    });
  });

  // ─── convertWeights (tested indirectly through loadData) ────────────────

  describe("convertWeights (via loadData)", () => {
    it("should compute rarity from absolute weight thresholds", async () => {
      await service.loadData("poe1", false);

      const upsertedRows = mockRepositoryUpsertCardWeights.mock.calls[0][0];

      // Rain of Chaos: weight=121400 → rarity 4 (common, >5000)
      const rainOfChaos = upsertedRows.find(
        (r: any) => r.cardName === "Rain of Chaos",
      );
      expect(rainOfChaos.rarity).toBe(4);

      // A Chilling Wind: weight=8000 → rarity 4 (common, >5000)
      const achillingWind = upsertedRows.find(
        (r: any) => r.cardName === "A Chilling Wind",
      );
      expect(achillingWind.rarity).toBe(4);

      // The Nurse: weight=1500 → rarity 3 (less common, 1001–5000)
      const theNurse = upsertedRows.find(
        (r: any) => r.cardName === "The Nurse",
      );
      expect(theNurse.rarity).toBe(3);

      // The Doctor: weight=10 → rarity 1 (extremely rare, ≤30)
      const theDoctor = upsertedRows.find(
        (r: any) => r.cardName === "The Doctor",
      );
      expect(theDoctor.rarity).toBe(1);
    });

    it("should assign rarity 0 (unknown) when weight is 0 and card is not boss", async () => {
      // CSV where a non-boss card has weight 0 — no drop data available yet
      const csvWithZeroWeight = [
        "patch,Bucket,col2,Ritual,col4,Keepers,All samples",
        "No Weight Card,6,,5,,0,0",
        "Has Weight Card,1,,5,,500,2000",
      ].join("\n");

      mockReadFile.mockResolvedValue(csvWithZeroWeight);

      await service.loadData("poe1", false);

      const upsertedRows = mockRepositoryUpsertCardWeights.mock.calls[0][0];

      // No Weight Card: weight=0, not boss → rarity 0 (unknown)
      const noWeightCard = upsertedRows.find(
        (r: any) => r.cardName === "No Weight Card",
      );
      expect(noWeightCard.rarity).toBe(0);

      // Has Weight Card: weight=500 → weightToDropRarity(500) = 2 (rare, 31–1000)
      const hasWeightCard = upsertedRows.find(
        (r: any) => r.cardName === "Has Weight Card",
      );
      expect(hasWeightCard.rarity).toBe(2);
    });

    it("should correctly map fromBoss — only 'Boss' text means boss", async () => {
      await service.loadData("poe1", false);

      const upsertedRows = mockRepositoryUpsertCardWeights.mock.calls[0][0];

      // The Doctor: Ritual column is not "Boss" → fromBoss=false
      const doctor = upsertedRows.find((r: any) => r.cardName === "The Doctor");
      expect(doctor.fromBoss).toBe(false);

      // Rain of Chaos: Ritual column is not "Boss" → fromBoss=false
      const rainOfChaos = upsertedRows.find(
        (r: any) => r.cardName === "Rain of Chaos",
      );
      expect(rainOfChaos.fromBoss).toBe(false);

      // The Void: Ritual="Boss" → fromBoss=true, weight=0 → rarity 0 (unknown — no stacked deck data)
      const theVoid = upsertedRows.find((r: any) => r.cardName === "The Void");
      expect(theVoid.fromBoss).toBe(true);
      expect(theVoid.rarity).toBe(0);
    });

    it("should set all rows to the same game, league, and loadedAt", async () => {
      await service.loadData("poe1", false);

      const upsertedRows = mockRepositoryUpsertCardWeights.mock.calls[0][0];
      const firstLoadedAt = upsertedRows[0].loadedAt;

      for (const row of upsertedRows) {
        expect(row.game).toBe("poe1");
        expect(row.league).toBe("Keepers");
        expect(row.loadedAt).toBe(firstLoadedAt);
      }
    });

    it("should assign rarity 0 (unknown) to all cards when all weights are zero", async () => {
      const csvAllZeroWeights = [
        "patch,Bucket,col2,Ritual,col4,Keepers,All samples",
        "Card A,1,,5,,0,0",
        "Card B,18,,5,,0,0",
        "Card C,10,,5,,0,0",
      ].join("\n");

      mockReadFile.mockResolvedValue(csvAllZeroWeights);

      await service.loadData("poe1", false);

      const upsertedRows = mockRepositoryUpsertCardWeights.mock.calls[0][0];

      // All cards have weight=0 → all get rarity 0 (unknown — no stacked deck data)
      expect(
        upsertedRows.find((r: any) => r.cardName === "Card A").rarity,
      ).toBe(0);

      expect(
        upsertedRows.find((r: any) => r.cardName === "Card B").rarity,
      ).toBe(0);

      expect(
        upsertedRows.find((r: any) => r.cardName === "Card C").rarity,
      ).toBe(0);
    });

    it("should assign rarity 0 (unknown) to boss cards with zero weight — weight is about stacked decks, not actual rarity", async () => {
      const csvBossZeroWeight = [
        "patch,Bucket,col2,Ritual,col4,Keepers,All samples",
        "Boss Card A,1,,Boss,,0,0",
        "Boss Card B,18,,Boss,,0,0",
        "Regular Card,10,,5,,0,0",
      ].join("\n");

      mockReadFile.mockResolvedValue(csvBossZeroWeight);

      await service.loadData("poe1", false);

      const upsertedRows = mockRepositoryUpsertCardWeights.mock.calls[0][0];

      // Boss cards with weight=0 → rarity 0 (unknown — no stacked deck data)
      expect(
        upsertedRows.find((r: any) => r.cardName === "Boss Card A").rarity,
      ).toBe(0);

      expect(
        upsertedRows.find((r: any) => r.cardName === "Boss Card B").rarity,
      ).toBe(0);

      // Non-boss card with weight=0 → also rarity 0 (unknown)
      expect(
        upsertedRows.find((r: any) => r.cardName === "Regular Card").rarity,
      ).toBe(0);
    });
  });

  // ─── League resolution ──────────────────────────────────────────────────

  describe("league resolution (via loadData)", () => {
    it("should resolve league name from poe_leagues_cache", async () => {
      mockPoeLeaguesGetLeagueByName.mockResolvedValue({
        id: "uuid-keepers",
        game: "poe1",
        leagueId: "Keepers",
        name: "Keepers",
        startAt: null,
        endAt: null,
        isActive: true,
        updatedAt: null,
        fetchedAt: "2025-06-01T00:00:00Z",
      });

      const result = await service.loadData("poe1", false);

      expect(result.league).toBe("Keepers");
      expect(mockPoeLeaguesGetLeagueByName).toHaveBeenCalledWith(
        "poe1",
        "Keepers",
      );
    });

    it("should use raw label as-is when league not found in cache", async () => {
      mockPoeLeaguesGetLeagueByName.mockResolvedValue(null);

      const result = await service.loadData("poe1", false);

      expect(result.league).toBe("Keepers");
      // Verify it still persists the raw label
      expect(mockRepositoryUpsertCardWeights).toHaveBeenCalledTimes(1);
    });

    it("should pass the CSV header league label to getLeagueByName", async () => {
      // CSV with a different league name
      const csvWithCustomLeague = [
        "patch,Bucket,col2,Ritual,col4,Settlers,All samples",
        "Card A,1,,5,,100,500",
      ].join("\n");
      mockReadFile.mockResolvedValue(csvWithCustomLeague);
      mockPoeLeaguesGetLeagueByName.mockResolvedValue({
        id: "uuid-settlers",
        game: "poe1",
        leagueId: "Settlers",
        name: "Settlers",
        startAt: null,
        endAt: null,
        isActive: false,
        updatedAt: null,
        fetchedAt: "2025-01-01T00:00:00Z",
      });

      const result = await service.loadData("poe1", false);

      expect(mockPoeLeaguesGetLeagueByName).toHaveBeenCalledWith(
        "poe1",
        "Settlers",
      );
      expect(result.league).toBe("Settlers");
    });
  });

  // ─── getStatus ──────────────────────────────────────────────────────────

  describe("getStatus", () => {
    it("should return empty status when no metadata exists", async () => {
      mockRepositoryGetMetadata.mockResolvedValue(undefined);

      const status = await service.getStatus("poe1");

      expect(status.hasData).toBe(false);
      expect(status.lastLoadedAt).toBeNull();
      expect(status.cardCount).toBe(0);
      expect(status.league).toBeNull();
      expect(status.appVersion).toBeNull();
    });

    it("should return populated status when metadata exists", async () => {
      mockRepositoryGetMetadata.mockResolvedValue({
        game: "poe1",
        league: "Keepers",
        loaded_at: "2025-06-01T12:00:00.000Z",
        app_version: "1.2.3",
        card_count: 42,
        created_at: "2025-06-01T12:00:00.000Z",
      });

      const status = await service.getStatus("poe1");

      expect(status.hasData).toBe(true);
      expect(status.lastLoadedAt).toBe("2025-06-01T12:00:00.000Z");
      expect(status.cardCount).toBe(42);
      expect(status.league).toBe("Keepers");
      expect(status.appVersion).toBe("1.2.3");
    });
  });

  // ─── initialize ─────────────────────────────────────────────────────────

  describe("initialize", () => {
    it("should load data for both poe1 and poe2", async () => {
      await service.initialize();

      // readFile should be called once for poe1 (poe2 is a no-op)
      expect(mockReadFile).toHaveBeenCalledTimes(1);
      // Weights should be upserted only for poe1
      expect(mockRepositoryUpsertCardWeights).toHaveBeenCalledTimes(1);
    });

    it("should not throw when poe1 load fails", async () => {
      mockReadFile.mockRejectedValue(new Error("File not found"));

      // Should not throw
      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  // ─── IPC Handlers ──────────────────────────────────────────────────────

  describe("IPC handlers", () => {
    describe("Reload", () => {
      it("should force re-parse when called via IPC", async () => {
        // Set up metadata that would normally cause a skip
        mockRepositoryGetMetadata.mockResolvedValue({
          game: "poe1",
          league: "Keepers",
          loaded_at: "2025-06-01T00:00:00.000Z",
          app_version: "1.0.0",
          card_count: 42,
          created_at: "2025-06-01T00:00:00.000Z",
        });

        const handler = getIpcHandler(ProhibitedLibraryChannel.Reload);
        const result = await handler({}, "poe1");

        expect(result.success).toBe(true);
        // Force = true should bypass version check
        expect(mockRepositoryUpsertCardWeights).toHaveBeenCalledTimes(1);
      });

      it("should return validation error for invalid game type", async () => {
        const handler = getIpcHandler(ProhibitedLibraryChannel.Reload);
        const result = await handler({}, "invalid-game");

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe("GetStatus", () => {
      it("should return status for the requested game", async () => {
        mockRepositoryGetMetadata.mockResolvedValue({
          game: "poe1",
          league: "Keepers",
          loaded_at: "2025-06-01T12:00:00.000Z",
          app_version: "1.0.0",
          card_count: 42,
          created_at: "2025-06-01T12:00:00.000Z",
        });

        const handler = getIpcHandler(ProhibitedLibraryChannel.GetStatus);
        const result = await handler({}, "poe1");

        expect(result.hasData).toBe(true);
        expect(result.cardCount).toBe(42);
        expect(result.league).toBe("Keepers");
      });

      it("should return validation error for invalid game type", async () => {
        const handler = getIpcHandler(ProhibitedLibraryChannel.GetStatus);
        const result = await handler({}, 123);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe("GetCardWeights", () => {
      it("should return card weights for active league", async () => {
        const mockWeights = [
          {
            cardName: "The Doctor",
            game: "poe1",
            league: "Keepers",
            weight: 10,
            rarity: 1,
            fromBoss: false,
            loadedAt: "2025-06-01T00:00:00.000Z",
          },
        ];
        mockSettingsGet.mockResolvedValue("Keepers");
        mockRepositoryGetCardWeights.mockResolvedValue(mockWeights);

        const handler = getIpcHandler(ProhibitedLibraryChannel.GetCardWeights);
        const result = await handler({}, "poe1");

        expect(result).toEqual(mockWeights);
        expect(mockRepositoryGetCardWeights).toHaveBeenCalledWith(
          "poe1",
          "Keepers",
        );
      });

      it("should fall back to metadata league when active league has no data", async () => {
        mockSettingsGet.mockResolvedValue("NewLeague");
        mockRepositoryGetCardWeights
          .mockResolvedValueOnce([]) // No data for NewLeague
          .mockResolvedValueOnce([
            {
              cardName: "The Doctor",
              game: "poe1",
              league: "Keepers",
              weight: 10,
              rarity: 1,
              fromBoss: false,
              loadedAt: "2025-06-01T00:00:00.000Z",
            },
          ]); // Fallback to metadata league

        mockRepositoryGetMetadata.mockResolvedValue({
          game: "poe1",
          league: "Keepers",
          loaded_at: "2025-06-01T00:00:00.000Z",
          app_version: "1.0.0",
          card_count: 42,
          created_at: "2025-06-01T00:00:00.000Z",
        });

        const handler = getIpcHandler(ProhibitedLibraryChannel.GetCardWeights);
        const result = await handler({}, "poe1");

        expect(result).toHaveLength(1);
        expect(mockRepositoryGetCardWeights).toHaveBeenCalledTimes(2);
        expect(mockRepositoryGetCardWeights).toHaveBeenNthCalledWith(
          1,
          "poe1",
          "NewLeague",
        );
        expect(mockRepositoryGetCardWeights).toHaveBeenNthCalledWith(
          2,
          "poe1",
          "Keepers",
        );
      });

      it("should return validation error for invalid game type", async () => {
        const handler = getIpcHandler(ProhibitedLibraryChannel.GetCardWeights);
        const result = await handler({}, null);

        expect(result.success).toBe(false);
      });
    });

    describe("GetFromBossCards", () => {
      it("should return boss-exclusive cards for active league", async () => {
        const mockBossCards = [
          {
            cardName: "The Void",
            game: "poe1",
            league: "Keepers",
            weight: 0,
            rarity: 1,
            fromBoss: true,
            loadedAt: "2025-06-01T00:00:00.000Z",
          },
        ];
        mockSettingsGet.mockResolvedValue("Keepers");
        mockRepositoryGetFromBossCards.mockResolvedValue(mockBossCards);

        const handler = getIpcHandler(
          ProhibitedLibraryChannel.GetFromBossCards,
        );
        const result = await handler({}, "poe1");

        expect(result).toEqual(mockBossCards);
        expect(mockRepositoryGetFromBossCards).toHaveBeenCalledWith(
          "poe1",
          "Keepers",
        );
      });

      it("should fall back to metadata league when active league has no boss cards", async () => {
        mockSettingsGet.mockResolvedValue("NewLeague");
        mockRepositoryGetFromBossCards
          .mockResolvedValueOnce([]) // No data for NewLeague
          .mockResolvedValueOnce([
            {
              cardName: "The Void",
              game: "poe1",
              league: "Keepers",
              weight: 0,
              rarity: 1,
              fromBoss: true,
              loadedAt: "2025-06-01T00:00:00.000Z",
            },
          ]);

        mockRepositoryGetMetadata.mockResolvedValue({
          game: "poe1",
          league: "Keepers",
          loaded_at: "2025-06-01T00:00:00.000Z",
          app_version: "1.0.0",
          card_count: 42,
          created_at: "2025-06-01T00:00:00.000Z",
        });

        const handler = getIpcHandler(
          ProhibitedLibraryChannel.GetFromBossCards,
        );
        const result = await handler({}, "poe1");

        expect(result).toHaveLength(1);
        expect(mockRepositoryGetFromBossCards).toHaveBeenCalledTimes(2);
      });

      it("should return validation error for invalid game type", async () => {
        const handler = getIpcHandler(
          ProhibitedLibraryChannel.GetFromBossCards,
        );
        const result = await handler({}, undefined);

        expect(result.success).toBe(false);
      });
    });
  });

  // ─── n-1 column fallback scenarios ──────────────────────────────────────

  describe("n-1 column fallback (league mismatch scenarios)", () => {
    // The CSV always contains data for the n-1 league column (the column
    // immediately before "All samples"). When the user's active league
    // doesn't match, the IPC handlers fall back to metadata.league.
    // This is by design — not an error condition.

    const keepersMetadata = {
      game: "poe1",
      league: "Keepers",
      loaded_at: "2025-06-01T00:00:00.000Z",
      app_version: "1.0.0",
      card_count: 42,
      created_at: "2025-06-01T00:00:00.000Z",
    };

    const keepersWeights: Array<{
      cardName: string;
      game: string;
      league: string;
      weight: number;
      rarity: number;
      fromBoss: boolean;
      loadedAt: string;
    }> = [
      {
        cardName: "The Doctor",
        game: "poe1",
        league: "Keepers",
        weight: 10,
        rarity: 1,
        fromBoss: false,
        loadedAt: "2025-06-01T00:00:00.000Z",
      },
      {
        cardName: "Rain of Chaos",
        game: "poe1",
        league: "Keepers",
        weight: 121400,
        rarity: 4,
        fromBoss: false,
        loadedAt: "2025-06-01T00:00:00.000Z",
      },
    ];

    const keepersBossCards: Array<{
      cardName: string;
      game: string;
      league: string;
      weight: number;
      rarity: number;
      fromBoss: boolean;
      loadedAt: string;
    }> = [
      {
        cardName: "The Void",
        game: "poe1",
        league: "Keepers",
        weight: 0,
        rarity: 1,
        fromBoss: true,
        loadedAt: "2025-06-01T00:00:00.000Z",
      },
    ];

    describe("Standard league (permanent, never has its own CSV column)", () => {
      it("should fall back to Keepers data for GetCardWeights when active league is Standard", async () => {
        mockSettingsGet.mockResolvedValue("Standard");
        mockRepositoryGetCardWeights
          .mockResolvedValueOnce([]) // No data for "Standard"
          .mockResolvedValueOnce(keepersWeights); // Fallback to Keepers
        mockRepositoryGetMetadata.mockResolvedValue(keepersMetadata);

        const handler = getIpcHandler(ProhibitedLibraryChannel.GetCardWeights);
        const result = await handler({}, "poe1");

        expect(result).toHaveLength(2);
        expect(result).toEqual(keepersWeights);
        expect(mockRepositoryGetCardWeights).toHaveBeenCalledTimes(2);
        expect(mockRepositoryGetCardWeights).toHaveBeenNthCalledWith(
          1,
          "poe1",
          "Standard",
        );
        expect(mockRepositoryGetCardWeights).toHaveBeenNthCalledWith(
          2,
          "poe1",
          "Keepers",
        );
      });

      it("should fall back to Keepers data for GetFromBossCards when active league is Standard", async () => {
        mockSettingsGet.mockResolvedValue("Standard");
        mockRepositoryGetFromBossCards
          .mockResolvedValueOnce([]) // No data for "Standard"
          .mockResolvedValueOnce(keepersBossCards); // Fallback to Keepers
        mockRepositoryGetMetadata.mockResolvedValue(keepersMetadata);

        const handler = getIpcHandler(
          ProhibitedLibraryChannel.GetFromBossCards,
        );
        const result = await handler({}, "poe1");

        expect(result).toHaveLength(1);
        expect(result[0].cardName).toBe("The Void");
        expect(mockRepositoryGetFromBossCards).toHaveBeenCalledTimes(2);
        expect(mockRepositoryGetFromBossCards).toHaveBeenNthCalledWith(
          1,
          "poe1",
          "Standard",
        );
        expect(mockRepositoryGetFromBossCards).toHaveBeenNthCalledWith(
          2,
          "poe1",
          "Keepers",
        );
      });
    });

    describe("variant league (e.g. Phrecia 2.0 based on Keepers dataset)", () => {
      it("should fall back to Keepers data for GetCardWeights when active league is a variant", async () => {
        mockSettingsGet.mockResolvedValue("Phrecia 2.0");
        mockRepositoryGetCardWeights
          .mockResolvedValueOnce([]) // No data for "Phrecia 2.0"
          .mockResolvedValueOnce(keepersWeights); // Fallback to Keepers
        mockRepositoryGetMetadata.mockResolvedValue(keepersMetadata);

        const handler = getIpcHandler(ProhibitedLibraryChannel.GetCardWeights);
        const result = await handler({}, "poe1");

        expect(result).toHaveLength(2);
        expect(result).toEqual(keepersWeights);
        expect(mockRepositoryGetCardWeights).toHaveBeenCalledTimes(2);
        expect(mockRepositoryGetCardWeights).toHaveBeenNthCalledWith(
          1,
          "poe1",
          "Phrecia 2.0",
        );
        expect(mockRepositoryGetCardWeights).toHaveBeenNthCalledWith(
          2,
          "poe1",
          "Keepers",
        );
      });

      it("should fall back to Keepers data for GetFromBossCards when active league is a variant", async () => {
        mockSettingsGet.mockResolvedValue("Phrecia 2.0");
        mockRepositoryGetFromBossCards
          .mockResolvedValueOnce([]) // No data for "Phrecia 2.0"
          .mockResolvedValueOnce(keepersBossCards); // Fallback to Keepers
        mockRepositoryGetMetadata.mockResolvedValue(keepersMetadata);

        const handler = getIpcHandler(
          ProhibitedLibraryChannel.GetFromBossCards,
        );
        const result = await handler({}, "poe1");

        expect(result).toHaveLength(1);
        expect(result[0].cardName).toBe("The Void");
        expect(mockRepositoryGetFromBossCards).toHaveBeenCalledTimes(2);
        expect(mockRepositoryGetFromBossCards).toHaveBeenNthCalledWith(
          1,
          "poe1",
          "Phrecia 2.0",
        );
        expect(mockRepositoryGetFromBossCards).toHaveBeenNthCalledWith(
          2,
          "poe1",
          "Keepers",
        );
      });
    });

    describe("new league (e.g. Vaal drops but CSV not updated yet)", () => {
      it("should fall back to Keepers (n-1) data for GetCardWeights when a new league has no CSV column", async () => {
        mockSettingsGet.mockResolvedValue("Vaal");
        mockRepositoryGetCardWeights
          .mockResolvedValueOnce([]) // No data for "Vaal"
          .mockResolvedValueOnce(keepersWeights); // Fallback to Keepers (n-1)
        mockRepositoryGetMetadata.mockResolvedValue(keepersMetadata);

        const handler = getIpcHandler(ProhibitedLibraryChannel.GetCardWeights);
        const result = await handler({}, "poe1");

        expect(result).toHaveLength(2);
        expect(result).toEqual(keepersWeights);
        expect(mockRepositoryGetCardWeights).toHaveBeenCalledTimes(2);
        expect(mockRepositoryGetCardWeights).toHaveBeenNthCalledWith(
          1,
          "poe1",
          "Vaal",
        );
        expect(mockRepositoryGetCardWeights).toHaveBeenNthCalledWith(
          2,
          "poe1",
          "Keepers",
        );
      });

      it("should fall back to Keepers (n-1) data for GetFromBossCards when a new league has no CSV column", async () => {
        mockSettingsGet.mockResolvedValue("Vaal");
        mockRepositoryGetFromBossCards
          .mockResolvedValueOnce([]) // No data for "Vaal"
          .mockResolvedValueOnce(keepersBossCards); // Fallback to Keepers (n-1)
        mockRepositoryGetMetadata.mockResolvedValue(keepersMetadata);

        const handler = getIpcHandler(
          ProhibitedLibraryChannel.GetFromBossCards,
        );
        const result = await handler({}, "poe1");

        expect(result).toHaveLength(1);
        expect(result[0].cardName).toBe("The Void");
        expect(mockRepositoryGetFromBossCards).toHaveBeenCalledTimes(2);
        expect(mockRepositoryGetFromBossCards).toHaveBeenNthCalledWith(
          1,
          "poe1",
          "Vaal",
        );
        expect(mockRepositoryGetFromBossCards).toHaveBeenNthCalledWith(
          2,
          "poe1",
          "Keepers",
        );
      });
    });

    describe("Hardcore Standard (another permanent league)", () => {
      it("should fall back to Keepers data when active league is Hardcore", async () => {
        mockSettingsGet.mockResolvedValue("Hardcore");
        mockRepositoryGetCardWeights
          .mockResolvedValueOnce([]) // No data for "Hardcore"
          .mockResolvedValueOnce(keepersWeights); // Fallback to Keepers
        mockRepositoryGetMetadata.mockResolvedValue(keepersMetadata);

        const handler = getIpcHandler(ProhibitedLibraryChannel.GetCardWeights);
        const result = await handler({}, "poe1");

        expect(result).toHaveLength(2);
        expect(mockRepositoryGetCardWeights).toHaveBeenNthCalledWith(
          1,
          "poe1",
          "Hardcore",
        );
        expect(mockRepositoryGetCardWeights).toHaveBeenNthCalledWith(
          2,
          "poe1",
          "Keepers",
        );
      });
    });

    describe("edge case: no metadata available at all", () => {
      it("should return empty array when active league has no data and no metadata exists", async () => {
        mockSettingsGet.mockResolvedValue("Standard");
        mockRepositoryGetCardWeights.mockResolvedValueOnce([]); // No data for "Standard"
        mockRepositoryGetMetadata.mockResolvedValue(undefined); // No metadata at all

        const handler = getIpcHandler(ProhibitedLibraryChannel.GetCardWeights);
        const result = await handler({}, "poe1");

        expect(result).toEqual([]);
        expect(mockRepositoryGetCardWeights).toHaveBeenCalledTimes(1);
        expect(mockRepositoryGetCardWeights).toHaveBeenCalledWith(
          "poe1",
          "Standard",
        );
      });
    });

    describe("loadData stores data under CSV header league (n-1), not active league", () => {
      it("should store data under Keepers even when active league is Standard", async () => {
        mockSettingsGet.mockResolvedValue("Standard");

        const result = await service.loadData("poe1", false);

        // The CSV header says "Keepers" (n-1 column) — data is stored under "Keepers"
        expect(result.league).toBe("Keepers");
        expect(mockRepositoryUpsertCardWeights).toHaveBeenCalledTimes(1);
        const upsertedRows = mockRepositoryUpsertCardWeights.mock.calls[0][0];
        for (const row of upsertedRows) {
          expect(row.league).toBe("Keepers");
        }
      });

      it("should store data under Keepers even when active league is Vaal (new league)", async () => {
        mockSettingsGet.mockResolvedValue("Vaal");

        const result = await service.loadData("poe1", false);

        expect(result.league).toBe("Keepers");
        expect(mockRepositoryUpsertMetadata).toHaveBeenCalledWith(
          "poe1",
          "Keepers",
          expect.any(String),
          "1.0.0",
          expect.any(Number),
        );
      });

      it("should store data under Keepers even when active league is Phrecia 2.0 (variant)", async () => {
        mockSettingsGet.mockResolvedValue("Phrecia 2.0");

        const result = await service.loadData("poe1", false);

        expect(result.league).toBe("Keepers");
        const upsertedRows = mockRepositoryUpsertCardWeights.mock.calls[0][0];
        for (const row of upsertedRows) {
          expect(row.league).toBe("Keepers");
        }
      });
    });
  });

  // ─── Packaged path resolution ───────────────────────────────────────────

  describe("packaged path resolution", () => {
    it("should use resourcesPath when packaged", async () => {
      // Set process.resourcesPath for the packaged code path
      const originalResourcesPath = process.resourcesPath;
      Object.defineProperty(process, "resourcesPath", {
        value: "/mock-resources",
        writable: true,
        configurable: true,
      });

      // Reset singleton to create new instance with packaged = true
      // @ts-expect-error — accessing private static for testing
      ProhibitedLibraryService._instance = undefined;
      mockElectronApp.isPackaged = true;

      try {
        service = ProhibitedLibraryService.getInstance();
        await service.loadData("poe1", false);

        const calledPath = mockReadFile.mock.calls[0][0] as string;
        const normalized = calledPath.replace(/\\/g, "/");
        // In packaged mode the path should NOT contain "renderer/assets"
        expect(normalized).not.toContain("renderer/assets");
        expect(normalized).toBe(
          "/mock-resources/poe1/prohibited-library-weights.csv",
        );
      } finally {
        // Restore original value
        Object.defineProperty(process, "resourcesPath", {
          value: originalResourcesPath,
          writable: true,
          configurable: true,
        });
      }
    });
  });

  // ─── getRepository ──────────────────────────────────────────────────────

  describe("getRepository", () => {
    it("should expose the repository instance", () => {
      const repo = service.getRepository();
      expect(repo).toBeDefined();
      expect(repo.upsertCardWeights).toBeDefined();
      expect(repo.getCardWeights).toBeDefined();
      expect(repo.getMetadata).toBeDefined();
      expect(repo.syncFromBossFlags).toBeDefined();
    });
  });
});
