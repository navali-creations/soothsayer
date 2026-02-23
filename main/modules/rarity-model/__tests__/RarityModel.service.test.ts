import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const {
  mockIpcHandle,
  mockSettingsGet,
  mockSettingsSet,
  mockSettingsGetAllSettings,
  mockScanAll,
  mockDirectoryExists,
  mockGetKysely,
  mockRepoGetAll,
  mockRepoGetById,
  mockRepoGetByFilePath,
  mockRepoUpsertMany,
  mockRepoDeleteNotInFilePaths,
  mockRepoMarkAsParsed,
  mockRepoDeleteById,
  mockRepoGetCardRarities,
  mockRepoReplaceCardRarities,
  mockRepoUpdateCardRarity,
  mockDivinationUpdateRaritiesFromFilter,
  mockBrowserWindowGetAllWindows,
  mockWebContentsSend,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockSettingsGet: vi.fn(),
  mockSettingsSet: vi.fn(),
  mockSettingsGetAllSettings: vi.fn(),
  mockScanAll: vi.fn(),
  mockDirectoryExists: vi.fn(),
  mockGetKysely: vi.fn(),
  mockRepoGetAll: vi.fn(),
  mockRepoGetById: vi.fn(),
  mockRepoGetByFilePath: vi.fn(),
  mockRepoUpsertMany: vi.fn(),
  mockRepoDeleteNotInFilePaths: vi.fn(),
  mockRepoMarkAsParsed: vi.fn(),
  mockRepoDeleteById: vi.fn(),
  mockRepoGetCardRarities: vi.fn(),
  mockRepoReplaceCardRarities: vi.fn(),
  mockRepoUpdateCardRarity: vi.fn(),
  mockDivinationUpdateRaritiesFromFilter: vi.fn(),
  mockBrowserWindowGetAllWindows: vi.fn(() => []),
  mockWebContentsSend: vi.fn(),
}));

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => "/mock-app-path"),
    getPath: vi.fn(() => "C:\\Users\\TestUser\\Documents"),
  },
  BrowserWindow: {
    getAllWindows: mockBrowserWindowGetAllWindows,
  },
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
      set: mockSettingsSet,
      getAllSettings: mockSettingsGetAllSettings,
    })),
  },
  SettingsKey: {
    ActiveGame: "selectedGame",
    SelectedPoe1League: "poe1SelectedLeague",
    SelectedPoe2League: "poe2SelectedLeague",
    RaritySource: "raritySource",
    SelectedFilterId: "selectedFilterId",
  },
}));

// ─── Mock RarityModelRepository ───────────────────────────────────────────────────
vi.mock("../RarityModel.repository", () => {
  return {
    RarityModelRepository: class MockRarityModelRepository {
      getAll = mockRepoGetAll;
      getById = mockRepoGetById;
      getByFilePath = mockRepoGetByFilePath;
      upsertMany = mockRepoUpsertMany;
      deleteNotInFilePaths = mockRepoDeleteNotInFilePaths;
      markAsParsed = mockRepoMarkAsParsed;
      deleteById = mockRepoDeleteById;
      getCardRarities = mockRepoGetCardRarities;
      replaceCardRarities = mockRepoReplaceCardRarities;
      updateCardRarity = mockRepoUpdateCardRarity;
    },
  };
});

// ─── Mock RarityModelScanner ──────────────────────────────────────────────────────
vi.mock("../RarityModel.scanner", () => {
  return {
    RarityModelScanner: class MockRarityModelScanner {
      scanAll = mockScanAll;
      directoryExists = mockDirectoryExists;
      getFiltersDirectory(game: string) {
        return game === "poe2"
          ? "C:\\Users\\TestUser\\Documents\\My Games\\Path of Exile 2"
          : "C:\\Users\\TestUser\\Documents\\My Games\\Path of Exile";
      }
      getOnlineFiltersDirectory(game: string) {
        return game === "poe2"
          ? "C:\\Users\\TestUser\\Documents\\My Games\\Path of Exile 2\\OnlineFilters"
          : "C:\\Users\\TestUser\\Documents\\My Games\\Path of Exile\\OnlineFilters";
      }

      static generateFilterId(filePath: string) {
        const normalized = filePath.replace(/\\/g, "/").toLowerCase();
        let hash = 2166136261;
        for (let i = 0; i < normalized.length; i++) {
          hash ^= normalized.charCodeAt(i);
          hash = Math.imul(hash, 16777619);
        }
        const hexHash = (hash >>> 0).toString(16).padStart(8, "0");
        return `filter_${hexHash}`;
      }
    },
  };
});

// ─── Mock DivinationCardsService ─────────────────────────────────────────────
vi.mock("~/main/modules/divination-cards", () => ({
  DivinationCardsService: {
    getInstance: vi.fn(() => ({
      updateRaritiesFromFilter: mockDivinationUpdateRaritiesFromFilter,
      updateRaritiesFromPrices: vi.fn(),
      getSelectedFilterId: vi.fn().mockResolvedValue(null),
      getRepository: vi.fn(),
    })),
  },
}));

// ─── Import under test (after mocks) ────────────────────────────────────────
import { RarityModelChannel } from "../RarityModel.channels";
import type {
  DiscoveredRarityModelDTO,
  RarityModelMetadataDTO,
  RarityModelScanResultDTO,
  RaritySource,
} from "../RarityModel.dto";
import { RarityModelService } from "../RarityModel.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getIpcHandler(channel: string): (...args: any[]) => Promise<any> {
  const call = mockIpcHandle.mock.calls.find(
    ([ch]: [string]) => ch === channel,
  );
  if (!call) {
    throw new Error(`ipcMain.handle was not called with "${channel}"`);
  }
  return call[1];
}

function makeRarityModelMetadataDTO(
  overrides: Partial<RarityModelMetadataDTO> = {},
): RarityModelMetadataDTO {
  return {
    id: "filter_abc12345",
    filterType: "local",
    filePath: "C:\\path\\to\\MyFilter.filter",
    filterName: "MyFilter",
    lastUpdate: "2025-07-01T10:00:00Z",
    isFullyParsed: false,
    parsedAt: null,
    createdAt: "2025-06-01T00:00:00Z",
    updatedAt: "2025-07-01T10:00:00Z",
    ...overrides,
  };
}

function makeScannedFilter(
  overrides: Partial<{
    filterType: "local" | "online";
    filePath: string;
    filterName: string;
    lastUpdate: string | null;
  }> = {},
) {
  return {
    filterType: "local" as const,
    filePath: "C:\\path\\to\\MyFilter.filter",
    filterName: "MyFilter",
    lastUpdate: "2025-07-01T10:00:00Z",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("RarityModelService", () => {
  let service: RarityModelService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    RarityModelService._instance = undefined;

    // Default mock implementations
    mockSettingsGet.mockImplementation(async (key: string) => {
      const defaults: Record<string, any> = {
        selectedGame: "poe1",
        poe1SelectedLeague: "Settlers",
        poe2SelectedLeague: "",
        raritySource: "poe.ninja",
        selectedFilterId: null,
      };
      return defaults[key];
    });

    mockSettingsSet.mockResolvedValue(undefined);
    mockScanAll.mockResolvedValue([]);
    mockRepoGetAll.mockResolvedValue([]);
    mockRepoGetById.mockResolvedValue(null);
    mockRepoUpsertMany.mockResolvedValue(undefined);
    mockRepoDeleteNotInFilePaths.mockResolvedValue(0);
    mockRepoUpdateCardRarity.mockResolvedValue(undefined);
    mockRepoGetCardRarities.mockResolvedValue([]);
    mockRepoReplaceCardRarities.mockResolvedValue(undefined);
    mockDivinationUpdateRaritiesFromFilter.mockResolvedValue(undefined);
    mockBrowserWindowGetAllWindows.mockReturnValue([]);
    mockWebContentsSend.mockReturnValue(undefined);

    service = RarityModelService.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Singleton
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const a = RarityModelService.getInstance();
      const b = RarityModelService.getInstance();
      expect(a).toBe(b);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IPC Handler Registration
  // ═══════════════════════════════════════════════════════════════════════════

  describe("setupIpcHandlers", () => {
    it("should register all expected IPC channels", () => {
      const channels = mockIpcHandle.mock.calls.map(([ch]: [string]) => ch);

      expect(channels).toContain(RarityModelChannel.ScanRarityModels);
      expect(channels).toContain(RarityModelChannel.GetRarityModels);
      expect(channels).toContain(RarityModelChannel.GetRarityModel);
      expect(channels).toContain(RarityModelChannel.ParseRarityModel);
      expect(channels).toContain(RarityModelChannel.SelectRarityModel);
      expect(channels).toContain(RarityModelChannel.GetSelectedRarityModel);
      expect(channels).toContain(RarityModelChannel.GetRaritySource);
      expect(channels).toContain(RarityModelChannel.SetRaritySource);
      expect(channels).toContain(
        RarityModelChannel.UpdateRarityModelCardRarity,
      );
      expect(channels).toContain(RarityModelChannel.ApplyRarityModelRarities);
    });

    it("should register exactly 10 IPC handlers", () => {
      // One for each channel defined in RarityModelChannel (excluding event-only channels)
      expect(mockIpcHandle).toHaveBeenCalledTimes(10);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // scanFilters
  // ═══════════════════════════════════════════════════════════════════════════

  describe("scanFilters", () => {
    it("should return empty result when no filters found on disk", async () => {
      mockScanAll.mockResolvedValue([]);
      mockRepoGetAll.mockResolvedValue([]);

      const result = await service.scanFilters();

      expect(result.filters).toEqual([]);
      expect(result.localCount).toBe(0);
      expect(result.onlineCount).toBe(0);
    });

    it("should scan filesystem and upsert discovered filters into database", async () => {
      const scannedFilters = [
        makeScannedFilter({
          filterType: "local",
          filePath: "C:\\path\\Local.filter",
          filterName: "Local",
        }),
        makeScannedFilter({
          filterType: "online",
          filePath: "C:\\path\\OnlineFilters\\abc",
          filterName: "OnlineFilter",
        }),
      ];

      mockScanAll.mockResolvedValue(scannedFilters);
      mockRepoGetAll.mockResolvedValue([
        makeRarityModelMetadataDTO({
          id: "filter_00000001",
          filterType: "local",
          filePath: "C:\\path\\Local.filter",
          filterName: "Local",
        }),
        makeRarityModelMetadataDTO({
          id: "filter_00000002",
          filterType: "online",
          filePath: "C:\\path\\OnlineFilters\\abc",
          filterName: "OnlineFilter",
        }),
      ]);

      const result = await service.scanFilters();

      expect(mockScanAll).toHaveBeenCalledOnce();
      expect(mockRepoUpsertMany).toHaveBeenCalledOnce();
      expect(mockRepoUpsertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            filterType: "local",
            filePath: "C:\\path\\Local.filter",
            filterName: "Local",
            isFullyParsed: false,
          }),
          expect.objectContaining({
            filterType: "online",
            filePath: "C:\\path\\OnlineFilters\\abc",
            filterName: "OnlineFilter",
            isFullyParsed: false,
          }),
        ]),
      );

      expect(result.localCount).toBe(1);
      expect(result.onlineCount).toBe(1);
      expect(result.filters).toHaveLength(2);
    });

    it("should clean up stale entries after scan", async () => {
      const scannedFilters = [
        makeScannedFilter({
          filePath: "C:\\path\\StillExists.filter",
        }),
      ];

      mockScanAll.mockResolvedValue(scannedFilters);
      mockRepoDeleteNotInFilePaths.mockResolvedValue(2);
      mockRepoGetAll.mockResolvedValue([
        makeRarityModelMetadataDTO({
          filePath: "C:\\path\\StillExists.filter",
        }),
      ]);

      await service.scanFilters();

      expect(mockRepoDeleteNotInFilePaths).toHaveBeenCalledWith([
        "C:\\path\\StillExists.filter",
      ]);
    });

    it("should return DiscoveredRarityModelDTOs with correct types", async () => {
      mockScanAll.mockResolvedValue([
        makeScannedFilter({ filterType: "local", filterName: "LocalOne" }),
      ]);
      mockRepoGetAll.mockResolvedValue([
        makeRarityModelMetadataDTO({
          filterType: "local",
          filterName: "LocalOne",
        }),
      ]);

      const result = await service.scanFilters();

      expect(result.filters[0]).toEqual(
        expect.objectContaining({
          type: "local",
          name: "LocalOne",
          isFullyParsed: false,
          isOutdated: false,
        }),
      );
    });

    it("should work through the IPC handler", async () => {
      mockScanAll.mockResolvedValue([]);
      mockRepoGetAll.mockResolvedValue([]);

      const handler = getIpcHandler(RarityModelChannel.ScanRarityModels);
      const result: RarityModelScanResultDTO = await handler({});

      expect(result.filters).toEqual([]);
      expect(result.localCount).toBe(0);
      expect(result.onlineCount).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getAllFilters
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getAllFilters", () => {
    it("should return all filters from repository as DiscoveredRarityModelDTOs", async () => {
      mockRepoGetAll.mockResolvedValue([
        makeRarityModelMetadataDTO({
          filterType: "local",
          filterName: "FilterA",
        }),
        makeRarityModelMetadataDTO({
          filterType: "online",
          filterName: "FilterB",
        }),
      ]);

      const result = await service.getAllFilters();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("FilterA");
      expect(result[1].name).toBe("FilterB");
    });

    it("should return empty array when no filters in database", async () => {
      mockRepoGetAll.mockResolvedValue([]);

      const result = await service.getAllFilters();

      expect(result).toEqual([]);
    });

    it("should work through the IPC handler", async () => {
      mockRepoGetAll.mockResolvedValue([]);

      const handler = getIpcHandler(RarityModelChannel.GetRarityModels);
      const result: DiscoveredRarityModelDTO[] = await handler({});

      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getFilter
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getFilter", () => {
    it("should return filter metadata by ID", async () => {
      const metadata = makeRarityModelMetadataDTO({ id: "filter_abc12345" });
      mockRepoGetById.mockResolvedValue(metadata);

      const result = await service.getFilter("filter_abc12345");

      expect(result).toEqual(metadata);
      expect(mockRepoGetById).toHaveBeenCalledWith("filter_abc12345");
    });

    it("should return null for non-existent filter ID", async () => {
      mockRepoGetById.mockResolvedValue(null);

      const result = await service.getFilter("filter_nonexist");

      expect(result).toBeNull();
    });

    it("should work through the IPC handler", async () => {
      mockRepoGetById.mockResolvedValue(null);

      const handler = getIpcHandler(RarityModelChannel.GetRarityModel);
      const result = await handler({}, "filter_abc12345");

      expect(result).toBeNull();
      expect(mockRepoGetById).toHaveBeenCalledWith("filter_abc12345");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // parseFilter (Milestone 3 stub)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("parseFilter", () => {
    it("should return empty parse result for existing filter (stub)", async () => {
      const metadata = makeRarityModelMetadataDTO({
        id: "filter_abc12345",
        filterName: "MyFilter",
      });
      mockRepoGetById.mockResolvedValue(metadata);

      const result = await service.parseFilter("filter_abc12345");

      expect(result).toEqual({
        filterId: "filter_abc12345",
        filterName: "MyFilter",
        totalCards: 0,
        rarities: [],
        hasDivinationSection: false,
      });
    });

    it("should throw for non-existent filter", async () => {
      mockRepoGetById.mockResolvedValue(null);

      await expect(service.parseFilter("filter_nonexist")).rejects.toThrow(
        "Filter not found: filter_nonexist",
      );
    });

    it("should work through the IPC handler", async () => {
      const metadata = makeRarityModelMetadataDTO({ id: "filter_abc12345" });
      mockRepoGetById.mockResolvedValue(metadata);

      const handler = getIpcHandler(RarityModelChannel.ParseRarityModel);
      const result = await handler({}, "filter_abc12345");

      expect(result.filterId).toBe("filter_abc12345");
      expect(result.hasDivinationSection).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // selectFilter
  // ═══════════════════════════════════════════════════════════════════════════

  describe("selectFilter", () => {
    it("should set selected filter ID in settings when filter exists", async () => {
      const metadata = makeRarityModelMetadataDTO({ id: "filter_abc12345" });
      mockRepoGetById.mockResolvedValue(metadata);

      await service.selectFilter("filter_abc12345");

      expect(mockSettingsSet).toHaveBeenCalledWith(
        "selectedFilterId",
        "filter_abc12345",
      );
    });

    it("should throw when selecting a non-existent filter", async () => {
      mockRepoGetById.mockResolvedValue(null);

      await expect(service.selectFilter("filter_nonexist")).rejects.toThrow(
        "Filter not found: filter_nonexist",
      );

      expect(mockSettingsSet).not.toHaveBeenCalled();
    });

    it("should clear selected filter when null is passed", async () => {
      await service.selectFilter(null);

      expect(mockSettingsSet).toHaveBeenCalledWith("selectedFilterId", null);
      expect(mockRepoGetById).not.toHaveBeenCalled();
    });

    it("should work through the IPC handler (select)", async () => {
      const metadata = makeRarityModelMetadataDTO({ id: "filter_abc12345" });
      mockRepoGetById.mockResolvedValue(metadata);

      const handler = getIpcHandler(RarityModelChannel.SelectRarityModel);
      await handler({}, "filter_abc12345");

      expect(mockSettingsSet).toHaveBeenCalledWith(
        "selectedFilterId",
        "filter_abc12345",
      );
    });

    it("should work through the IPC handler (clear)", async () => {
      const handler = getIpcHandler(RarityModelChannel.SelectRarityModel);
      await handler({}, null);

      expect(mockSettingsSet).toHaveBeenCalledWith("selectedFilterId", null);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getSelectedFilter
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getSelectedFilter", () => {
    it("should return null when no filter is selected", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedFilterId") return null;
        return undefined;
      });

      const result = await service.getSelectedFilter();

      expect(result).toBeNull();
    });

    it("should return filter metadata for selected filter", async () => {
      const metadata = makeRarityModelMetadataDTO({ id: "filter_abc12345" });

      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedFilterId") return "filter_abc12345";
        return undefined;
      });
      mockRepoGetById.mockResolvedValue(metadata);

      const result = await service.getSelectedFilter();

      expect(result).toEqual(metadata);
      expect(mockRepoGetById).toHaveBeenCalledWith("filter_abc12345");
    });

    it("should return null when selected filter no longer exists in DB", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedFilterId") return "filter_deleted";
        return undefined;
      });
      mockRepoGetById.mockResolvedValue(null);

      const result = await service.getSelectedFilter();

      expect(result).toBeNull();
    });

    it("should work through the IPC handler", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedFilterId") return null;
        return undefined;
      });

      const handler = getIpcHandler(RarityModelChannel.GetSelectedRarityModel);
      const result = await handler({});

      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getRaritySource
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getRaritySource", () => {
    it("should return the current rarity source from settings", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "raritySource") return "poe.ninja";
        return undefined;
      });

      const result = await service.getRaritySource();

      expect(result).toBe("poe.ninja");
    });

    it("should return 'filter' when that is the configured source", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "raritySource") return "filter";
        return undefined;
      });

      const result = await service.getRaritySource();

      expect(result).toBe("filter");
    });

    it("should work through the IPC handler", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "raritySource") return "poe.ninja";
        return undefined;
      });

      const handler = getIpcHandler(RarityModelChannel.GetRaritySource);
      const result: RaritySource = await handler({});

      expect(result).toBe("poe.ninja");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setRaritySource
  // ═══════════════════════════════════════════════════════════════════════════

  describe("setRaritySource", () => {
    it("should set 'poe.ninja' as rarity source", async () => {
      await service.setRaritySource("poe.ninja");

      expect(mockSettingsSet).toHaveBeenCalledWith("raritySource", "poe.ninja");
    });

    it("should set 'filter' as rarity source", async () => {
      await service.setRaritySource("filter");

      expect(mockSettingsSet).toHaveBeenCalledWith("raritySource", "filter");
    });

    it("should set 'prohibited-library' as rarity source", async () => {
      await service.setRaritySource("prohibited-library");

      expect(mockSettingsSet).toHaveBeenCalledWith(
        "raritySource",
        "prohibited-library",
      );
    });

    it("should throw for invalid rarity source", async () => {
      await expect(
        service.setRaritySource("invalid" as RaritySource),
      ).rejects.toThrow("Invalid rarity source: invalid");

      expect(mockSettingsSet).not.toHaveBeenCalled();
    });

    it("should work through the IPC handler", async () => {
      const handler = getIpcHandler(RarityModelChannel.SetRaritySource);
      await handler({}, "filter");

      expect(mockSettingsSet).toHaveBeenCalledWith("raritySource", "filter");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration: scan → select → get flow
  // ═══════════════════════════════════════════════════════════════════════════

  describe("scan → select → getSelectedFilter flow", () => {
    it("should support the full lifecycle of scan, select, and retrieve", async () => {
      // Step 1: Scan discovers filters
      const scannedFilters = [
        makeScannedFilter({
          filterType: "local",
          filePath: "C:\\path\\MyFilter.filter",
          filterName: "MyFilter",
        }),
      ];
      mockScanAll.mockResolvedValue(scannedFilters);

      const storedMetadata = makeRarityModelMetadataDTO({
        id: "filter_abcdef01",
        filterName: "MyFilter",
        filePath: "C:\\path\\MyFilter.filter",
      });
      mockRepoGetAll.mockResolvedValue([storedMetadata]);

      const scanResult = await service.scanFilters();
      expect(scanResult.filters).toHaveLength(1);
      expect(scanResult.localCount).toBe(1);

      // Step 2: Select the discovered filter
      mockRepoGetById.mockResolvedValue(storedMetadata);
      await service.selectFilter("filter_abcdef01");

      expect(mockSettingsSet).toHaveBeenCalledWith(
        "selectedFilterId",
        "filter_abcdef01",
      );

      // Step 3: Retrieve the selected filter
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "selectedFilterId") return "filter_abcdef01";
        return "poe1";
      });

      const selected = await service.getSelectedFilter();
      expect(selected).toEqual(storedMetadata);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Integration: rarity source change flow
  // ═══════════════════════════════════════════════════════════════════════════

  describe("rarity source change flow", () => {
    it("should allow switching from poe.ninja to filter and back", async () => {
      // Initially poe.ninja
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "raritySource") return "poe.ninja";
        return undefined;
      });

      let currentSource = await service.getRaritySource();
      expect(currentSource).toBe("poe.ninja");

      // Switch to filter
      await service.setRaritySource("filter");
      expect(mockSettingsSet).toHaveBeenCalledWith("raritySource", "filter");

      // Mock the setting having changed
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "raritySource") return "filter";
        return undefined;
      });

      currentSource = await service.getRaritySource();
      expect(currentSource).toBe("filter");

      // Switch back to poe.ninja
      await service.setRaritySource("poe.ninja");
      expect(mockSettingsSet).toHaveBeenCalledWith("raritySource", "poe.ninja");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Edge Cases
  // ═══════════════════════════════════════════════════════════════════════════

  describe("edge cases", () => {
    it("should handle scan when filesystem returns empty but DB has stale entries", async () => {
      mockScanAll.mockResolvedValue([]);
      mockRepoDeleteNotInFilePaths.mockResolvedValue(5);
      mockRepoGetAll.mockResolvedValue([]);

      const result = await service.scanFilters();

      expect(result.filters).toEqual([]);
      expect(mockRepoDeleteNotInFilePaths).toHaveBeenCalledWith([]);
    });

    it("should handle scanner throwing an error gracefully via IPC", async () => {
      mockScanAll.mockRejectedValue(new Error("Disk read error"));

      const handler = getIpcHandler(RarityModelChannel.ScanRarityModels);

      // The IPC handler doesn't catch errors — they propagate to the renderer
      await expect(handler({})).rejects.toThrow("Disk read error");
    });

    it("should handle concurrent scan requests", async () => {
      let resolveFirst: () => void;
      const firstScanPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      mockScanAll
        .mockImplementationOnce(async () => {
          await firstScanPromise;
          return [makeScannedFilter({ filterName: "First" })];
        })
        .mockResolvedValueOnce([makeScannedFilter({ filterName: "Second" })]);

      mockRepoGetAll.mockResolvedValue([]);

      // Start two scans
      const scan1 = service.scanFilters();
      const scan2 = service.scanFilters();

      // Resolve the first scan
      resolveFirst!();

      const [result1, result2] = await Promise.all([scan1, scan2]);

      // Both should complete
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it("should not validate filter existence when clearing selection (null)", async () => {
      await service.selectFilter(null);

      // getById should NOT be called when clearing
      expect(mockRepoGetById).not.toHaveBeenCalled();
      expect(mockSettingsSet).toHaveBeenCalledWith("selectedFilterId", null);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getRepository / getScanner accessors
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // ensureFilterParsed
  // ═══════════════════════════════════════════════════════════════════════════

  describe("ensureFilterParsed", () => {
    it("should return null when filter does not exist", async () => {
      mockRepoGetById.mockResolvedValue(null);

      const result = await service.ensureFilterParsed("filter_nonexist");

      expect(result).toBeNull();
    });

    it("should return cached results when filter is already fully parsed", async () => {
      const metadata = makeRarityModelMetadataDTO({
        id: "filter_parsed",
        filterName: "ParsedFilter",
        isFullyParsed: true,
      });
      mockRepoGetById.mockResolvedValue(metadata);
      mockRepoGetCardRarities.mockResolvedValue([
        { filterId: "filter_parsed", cardName: "The Doctor", rarity: 1 },
        { filterId: "filter_parsed", cardName: "Rain of Chaos", rarity: 4 },
      ]);

      const result = await service.ensureFilterParsed("filter_parsed");

      expect(result).toBeDefined();
      expect(result!.filterId).toBe("filter_parsed");
      expect(result!.filterName).toBe("ParsedFilter");
      expect(result!.totalCards).toBe(2);
      expect(result!.rarities).toHaveLength(2);
      expect(result!.hasDivinationSection).toBe(true);
    });

    it("should return hasDivinationSection=false when cached rarities are empty", async () => {
      const metadata = makeRarityModelMetadataDTO({
        id: "filter_empty",
        filterName: "EmptyFilter",
        isFullyParsed: true,
      });
      mockRepoGetById.mockResolvedValue(metadata);
      mockRepoGetCardRarities.mockResolvedValue([]);

      const result = await service.ensureFilterParsed("filter_empty");

      expect(result).toBeDefined();
      expect(result!.hasDivinationSection).toBe(false);
      expect(result!.totalCards).toBe(0);
    });

    it("should trigger a full parse when filter is not yet parsed", async () => {
      // First call to getById returns unparsed metadata (for ensureFilterParsed)
      // Second call to getById returns the same (for parseFilter inside)
      const metadata = makeRarityModelMetadataDTO({
        id: "filter_unparsed",
        filterName: "UnparsedFilter",
        isFullyParsed: false,
      });
      mockRepoGetById.mockResolvedValue(metadata);
      // parseFilter for an unparsed filter with no file content returns empty results
      mockRepoGetCardRarities.mockResolvedValue([]);

      const result = await service.ensureFilterParsed("filter_unparsed");

      // parseFilter was called internally — it returns a parse result
      expect(result).toBeDefined();
      expect(result!.filterId).toBe("filter_unparsed");
      expect(result!.filterName).toBe("UnparsedFilter");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // applyFilterRarities
  // ═══════════════════════════════════════════════════════════════════════════

  describe("applyFilterRarities", () => {
    it("should throw when filter does not exist", async () => {
      mockRepoGetById.mockResolvedValue(null);

      await expect(
        service.applyFilterRarities("filter_nonexist", "poe1", "Settlers"),
      ).rejects.toThrow("Filter not found: filter_nonexist");
    });

    it("should return success=false when filter has no divination section", async () => {
      const metadata = makeRarityModelMetadataDTO({
        id: "filter_nodiv",
        filterName: "NoDivFilter",
        isFullyParsed: true,
      });
      mockRepoGetById.mockResolvedValue(metadata);
      mockRepoGetCardRarities.mockResolvedValue([]);

      const result = await service.applyFilterRarities(
        "filter_nodiv",
        "poe1",
        "Settlers",
      );

      expect(result.success).toBe(false);
      expect(result.totalCards).toBe(0);
      expect(result.filterName).toBe("NoDivFilter");
      // Should NOT have called updateRaritiesFromFilter
      expect(mockDivinationUpdateRaritiesFromFilter).not.toHaveBeenCalled();
    });

    it("should apply filter rarities and emit event on success", async () => {
      const metadata = makeRarityModelMetadataDTO({
        id: "filter_good",
        filterName: "GoodFilter",
        isFullyParsed: true,
      });
      mockRepoGetById.mockResolvedValue(metadata);
      mockRepoGetCardRarities.mockResolvedValue([
        { filterId: "filter_good", cardName: "The Doctor", rarity: 1 },
        { filterId: "filter_good", cardName: "Rain of Chaos", rarity: 4 },
        { filterId: "filter_good", cardName: "Her Mask", rarity: 3 },
      ]);

      const mockSend = vi.fn();
      mockBrowserWindowGetAllWindows.mockReturnValue([
        {
          isDestroyed: () => false,
          webContents: { isDestroyed: () => false, send: mockSend },
        },
      ] as any);

      const result = await service.applyFilterRarities(
        "filter_good",
        "poe1",
        "Settlers",
      );

      expect(result.success).toBe(true);
      expect(result.totalCards).toBe(3);
      expect(result.filterName).toBe("GoodFilter");

      // Should have called updateRaritiesFromFilter on DivinationCardsService
      expect(mockDivinationUpdateRaritiesFromFilter).toHaveBeenCalledWith(
        "filter_good",
        "poe1",
        "Settlers",
      );

      // Should have emitted IPC event
      expect(mockSend).toHaveBeenCalledWith(
        RarityModelChannel.OnRarityModelRaritiesApplied,
        expect.objectContaining({
          filterId: "filter_good",
          filterName: "GoodFilter",
          game: "poe1",
          league: "Settlers",
          totalCards: 3,
        }),
      );
    });

    it("should work through the IPC handler", async () => {
      const metadata = makeRarityModelMetadataDTO({
        id: "filter_ipc",
        filterName: "IpcFilter",
        isFullyParsed: true,
      });
      mockRepoGetById.mockResolvedValue(metadata);
      mockRepoGetCardRarities.mockResolvedValue([
        { filterId: "filter_ipc", cardName: "The Doctor", rarity: 1 },
      ]);

      const handler = getIpcHandler(
        RarityModelChannel.ApplyRarityModelRarities,
      );
      const result = await handler({}, "filter_ipc", "poe1", "Settlers");

      expect(result.success).toBe(true);
      expect(result.filterName).toBe("IpcFilter");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UpdateRarityModelCardRarity IPC handler
  // ═══════════════════════════════════════════════════════════════════════════

  describe("UpdateRarityModelCardRarity IPC handler", () => {
    it("should update card rarity with valid inputs", async () => {
      const handler = getIpcHandler(
        RarityModelChannel.UpdateRarityModelCardRarity,
      );
      const result = await handler({}, "filter_abc12345", "The Doctor", 1);

      expect(result).toEqual({ success: true });
      expect(mockRepoUpdateCardRarity).toHaveBeenCalledWith(
        "filter_abc12345",
        "The Doctor",
        1,
      );
    });

    it("should update card rarity with rarity 4", async () => {
      const handler = getIpcHandler(
        RarityModelChannel.UpdateRarityModelCardRarity,
      );
      const result = await handler({}, "filter_abc12345", "Rain of Chaos", 4);

      expect(result).toEqual({ success: true });
      expect(mockRepoUpdateCardRarity).toHaveBeenCalledWith(
        "filter_abc12345",
        "Rain of Chaos",
        4,
      );
    });

    it("should reject rarity below 1", async () => {
      const handler = getIpcHandler(
        RarityModelChannel.UpdateRarityModelCardRarity,
      );
      const result = await handler({}, "filter_abc12345", "The Doctor", 0);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
      expect(mockRepoUpdateCardRarity).not.toHaveBeenCalled();
    });

    it("should reject rarity above 4", async () => {
      const handler = getIpcHandler(
        RarityModelChannel.UpdateRarityModelCardRarity,
      );
      const result = await handler({}, "filter_abc12345", "The Doctor", 5);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
      expect(mockRepoUpdateCardRarity).not.toHaveBeenCalled();
    });

    it("should reject non-string filterId", async () => {
      const handler = getIpcHandler(
        RarityModelChannel.UpdateRarityModelCardRarity,
      );
      const result = await handler({}, 123, "The Doctor", 1);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject non-string cardName", async () => {
      const handler = getIpcHandler(
        RarityModelChannel.UpdateRarityModelCardRarity,
      );
      const result = await handler({}, "filter_abc12345", null, 1);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // emitFilterRaritiesApplied (tested via applyFilterRarities)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("emitFilterRaritiesApplied", () => {
    it("should emit to multiple non-destroyed windows", async () => {
      const metadata = makeRarityModelMetadataDTO({
        id: "filter_multi",
        filterName: "MultiWindowFilter",
        isFullyParsed: true,
      });
      mockRepoGetById.mockResolvedValue(metadata);
      mockRepoGetCardRarities.mockResolvedValue([
        { filterId: "filter_multi", cardName: "The Doctor", rarity: 1 },
      ]);

      const send1 = vi.fn();
      const send2 = vi.fn();
      const send3 = vi.fn();
      mockBrowserWindowGetAllWindows.mockReturnValue([
        {
          isDestroyed: () => false,
          webContents: { isDestroyed: () => false, send: send1 },
        },
        {
          isDestroyed: () => true,
          webContents: { isDestroyed: () => false, send: send2 },
        },
        {
          isDestroyed: () => false,
          webContents: { isDestroyed: () => false, send: send3 },
        },
      ] as any);

      await service.applyFilterRarities("filter_multi", "poe1", "Settlers");

      expect(send1).toHaveBeenCalledWith(
        RarityModelChannel.OnRarityModelRaritiesApplied,
        expect.any(Object),
      );
      expect(send2).not.toHaveBeenCalled(); // destroyed window
      expect(send3).toHaveBeenCalledWith(
        RarityModelChannel.OnRarityModelRaritiesApplied,
        expect.any(Object),
      );
    });

    it("should skip windows with destroyed webContents", async () => {
      const metadata = makeRarityModelMetadataDTO({
        id: "filter_wc",
        filterName: "WCFilter",
        isFullyParsed: true,
      });
      mockRepoGetById.mockResolvedValue(metadata);
      mockRepoGetCardRarities.mockResolvedValue([
        { filterId: "filter_wc", cardName: "The Doctor", rarity: 1 },
      ]);

      const send1 = vi.fn();
      mockBrowserWindowGetAllWindows.mockReturnValue([
        {
          isDestroyed: () => false,
          webContents: { isDestroyed: () => true, send: send1 },
        },
      ] as any);

      await service.applyFilterRarities("filter_wc", "poe1", "Settlers");

      expect(send1).not.toHaveBeenCalled();
    });

    it("should handle errors from window.webContents.send gracefully", async () => {
      const metadata = makeRarityModelMetadataDTO({
        id: "filter_err",
        filterName: "ErrFilter",
        isFullyParsed: true,
      });
      mockRepoGetById.mockResolvedValue(metadata);
      mockRepoGetCardRarities.mockResolvedValue([
        { filterId: "filter_err", cardName: "The Doctor", rarity: 1 },
      ]);

      const sendThatThrows = vi.fn().mockImplementation(() => {
        throw new Error("IPC channel destroyed");
      });
      const sendOk = vi.fn();
      mockBrowserWindowGetAllWindows.mockReturnValue([
        {
          isDestroyed: () => false,
          webContents: { isDestroyed: () => false, send: sendThatThrows },
        },
        {
          isDestroyed: () => false,
          webContents: { isDestroyed: () => false, send: sendOk },
        },
      ] as any);

      // Should not throw — errors are caught per-window
      const result = await service.applyFilterRarities(
        "filter_err",
        "poe1",
        "Settlers",
      );

      expect(result.success).toBe(true);
      // Second window should still receive the event
      expect(sendOk).toHaveBeenCalled();
    });

    it("should not emit when no windows exist", async () => {
      const metadata = makeRarityModelMetadataDTO({
        id: "filter_nowin",
        filterName: "NoWinFilter",
        isFullyParsed: true,
      });
      mockRepoGetById.mockResolvedValue(metadata);
      mockRepoGetCardRarities.mockResolvedValue([
        { filterId: "filter_nowin", cardName: "The Doctor", rarity: 1 },
      ]);

      mockBrowserWindowGetAllWindows.mockReturnValue([]);

      const result = await service.applyFilterRarities(
        "filter_nowin",
        "poe1",
        "Settlers",
      );

      expect(result.success).toBe(true);
      // No send calls because no windows
    });

    it("should handle non-Error thrown objects in emitFilterRaritiesApplied gracefully", async () => {
      const metadata = makeRarityModelMetadataDTO({
        id: "filter_nonerr",
        filterName: "NonErrFilter",
        isFullyParsed: true,
      });
      mockRepoGetById.mockResolvedValue(metadata);
      mockRepoGetCardRarities.mockResolvedValue([
        { filterId: "filter_nonerr", cardName: "The Doctor", rarity: 1 },
      ]);

      const sendThatThrowsString = vi.fn().mockImplementation(() => {
        throw "unexpected string error";
      });
      const sendOk = vi.fn();
      mockBrowserWindowGetAllWindows.mockReturnValue([
        {
          isDestroyed: () => false,
          webContents: { isDestroyed: () => false, send: sendThatThrowsString },
        },
        {
          isDestroyed: () => false,
          webContents: { isDestroyed: () => false, send: sendOk },
        },
      ] as any);

      // Should not throw — non-Error values are stringified in the catch block
      const result = await service.applyFilterRarities(
        "filter_nonerr",
        "poe1",
        "Settlers",
      );

      expect(result.success).toBe(true);
      // Second window should still receive the event despite first throwing
      expect(sendOk).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getLeagueStartDate (tested indirectly via scanFilters — it passes through)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getLeagueStartDate edge cases", () => {
    it("should handle settings.get throwing an error gracefully", async () => {
      // getLeagueStartDate is called internally by scanFilters and getAllFilters
      // If settingsGet throws during the getLeagueStartDate portion, it should
      // return null (caught) and still produce results

      // Make scanAll return a filter so scanFilters does work
      mockScanAll.mockResolvedValue([
        makeScannedFilter({ filterName: "TestFilter" }),
      ]);
      mockRepoGetAll.mockResolvedValue([
        makeRarityModelMetadataDTO({ filterName: "TestFilter" }),
      ]);
      mockRepoDeleteNotInFilePaths.mockResolvedValue(0);

      // Make settingsGet throw only for ActiveGame (used by getLeagueStartDate)
      // but succeed for other keys
      let callCount = 0;
      mockSettingsGet.mockImplementation(async (key: string) => {
        callCount++;
        // The first calls are for ActiveGame in scanFilters
        if (key === "selectedGame") {
          // First call is from scanFilters for activeGame
          if (callCount <= 1) return "poe1";
          // Subsequent calls (from getLeagueStartDate) throw
          throw new Error("Settings unavailable");
        }
        return null;
      });

      // Should not throw — getLeagueStartDate catches the error
      const result = await service.scanFilters();
      expect(result.filters).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getRepository / getScanner accessors
  // ═══════════════════════════════════════════════════════════════════════════

  describe("accessor methods", () => {
    it("should expose repository via getRepository()", () => {
      const repo = service.getRepository();
      expect(repo).toBeDefined();
      expect(repo.getAll).toBeDefined();
      expect(repo.getById).toBeDefined();
    });

    it("should expose scanner via getScanner()", () => {
      const scanner = service.getScanner();
      expect(scanner).toBeDefined();
      expect(scanner.scanAll).toBeDefined();
    });
  });
});
