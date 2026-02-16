import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const {
  mockIpcHandle,
  mockIpcOn,
  mockGetKysely,
  mockSettingsGet,
  mockSettingsSet,
  mockScanAll,
  mockDirectoryExists,
  mockRepoGetAll,
  mockRepoGetById,
  mockRepoGetByFilePath,
  mockRepoUpsertMany,
  mockRepoDeleteNotInFilePaths,
  mockRepoMarkAsParsed,
  mockRepoDeleteById,
  mockRepoGetCardRarities,
  mockRepoReplaceCardRarities,
  mockRepoGetCardRarityCount,
  mockRepoGetCardRarity,
  mockDivinationUpdateRaritiesFromFilter,
  mockDivinationUpdateRaritiesFromPrices,
  mockDivinationGetSelectedFilterId,
  mockDivinationGetRepository,
  mockParseFilterFile,
  mockAssertBoundedString,
  mockAssertEnum,
  mockAssertGameType,
  mockAssertOptionalString,
  mockHandleValidationError,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockIpcOn: vi.fn(),
  mockGetKysely: vi.fn(),
  mockSettingsGet: vi.fn(),
  mockSettingsSet: vi.fn(),
  mockScanAll: vi.fn(),
  mockDirectoryExists: vi.fn(),
  mockRepoGetAll: vi.fn(),
  mockRepoGetById: vi.fn(),
  mockRepoGetByFilePath: vi.fn(),
  mockRepoUpsertMany: vi.fn(),
  mockRepoDeleteNotInFilePaths: vi.fn(),
  mockRepoMarkAsParsed: vi.fn(),
  mockRepoDeleteById: vi.fn(),
  mockRepoGetCardRarities: vi.fn(),
  mockRepoReplaceCardRarities: vi.fn(),
  mockRepoGetCardRarityCount: vi.fn(),
  mockRepoGetCardRarity: vi.fn(),
  mockDivinationUpdateRaritiesFromFilter: vi.fn(),
  mockDivinationUpdateRaritiesFromPrices: vi.fn(),
  mockDivinationGetSelectedFilterId: vi.fn(),
  mockDivinationGetRepository: vi.fn(),
  mockParseFilterFile: vi.fn(),
  mockAssertBoundedString: vi.fn(),
  mockAssertEnum: vi.fn(),
  mockAssertGameType: vi.fn(),
  mockAssertOptionalString: vi.fn(),
  mockHandleValidationError: vi.fn(),
}));

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
    on: mockIpcOn,
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    getFocusedWindow: vi.fn(() => null),
  },
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => "/mock-app-path"),
    getPath: vi.fn(() => "C:\\Users\\TestUser\\Documents"),
  },
  dialog: {
    showMessageBox: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}));

// ─── Mock DatabaseService ────────────────────────────────────────────────────
vi.mock("~/main/modules/database", () => ({
  DatabaseService: {
    getInstance: vi.fn(() => ({
      getKysely: mockGetKysely,
      reset: vi.fn(),
    })),
  },
}));

// ─── Mock SettingsStoreService ───────────────────────────────────────────────
vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: vi.fn(() => ({
      get: mockSettingsGet,
      set: mockSettingsSet,
      getAllSettings: vi.fn(),
    })),
  },
  SettingsKey: {
    ActiveGame: "activeGame",
    SelectedPoe1League: "poe1SelectedLeague",
    SelectedPoe2League: "poe2SelectedLeague",
    RaritySource: "raritySource",
    SelectedFilterId: "selectedFilterId",
  },
}));

// ─── Mock DivinationCardsService ─────────────────────────────────────────────
vi.mock("~/main/modules/divination-cards", () => ({
  DivinationCardsService: {
    getInstance: vi.fn(() => ({
      updateRaritiesFromFilter: mockDivinationUpdateRaritiesFromFilter,
      updateRaritiesFromPrices: mockDivinationUpdateRaritiesFromPrices,
      getSelectedFilterId: mockDivinationGetSelectedFilterId,
      getRepository: mockDivinationGetRepository,
    })),
  },
}));

// ─── Mock RarityModelRepository ───────────────────────────────────────────────────
vi.mock("../RarityModel.repository", () => ({
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
    getCardRarityCount = mockRepoGetCardRarityCount;
    getCardRarity = mockRepoGetCardRarity;
  },
}));

// ─── Mock RarityModelScanner ─────────────────────────────────────────────────────
vi.mock("../RarityModel.scanner", () => ({
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

    static generateFilterId(filePath: string): string {
      const normalized = filePath.toLowerCase().replace(/\\/g, "/");
      let hash = 0;
      for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      const hexHash = Math.abs(hash).toString(16).padStart(8, "0");
      return `filter_${hexHash}`;
    }
  },
}));

// ─── Mock RarityModelParser ──────────────────────────────────────────────────────
vi.mock("../RarityModel.parser", () => ({
  RarityModelParser: {
    parseFilterFile: mockParseFilterFile,
  },
}));

// ─── Mock IPC validation utils ───────────────────────────────────────────────
vi.mock("~/main/utils/ipc-validation", () => ({
  assertBoundedString: mockAssertBoundedString,
  assertEnum: mockAssertEnum,
  assertGameType: mockAssertGameType,
  assertOptionalString: mockAssertOptionalString,
  handleValidationError: mockHandleValidationError,
}));

// ─── Import under test ──────────────────────────────────────────────────────
import { RarityModelChannel } from "../RarityModel.channels";
import { RarityModelService } from "../RarityModel.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getIpcHandler(channel: string): (...args: any[]) => any {
  const call = mockIpcHandle.mock.calls.find(
    ([ch]: [string]) => ch === channel,
  );
  if (!call) {
    const registered = mockIpcHandle.mock.calls
      .map(([ch]: [string]) => ch)
      .join(", ");
    throw new Error(
      `ipcMain.handle was not called with "${channel}". Registered: ${registered}`,
    );
  }
  return call[1];
}

const SAMPLE_FILTER_METADATA = {
  id: "filter_abc12345",
  filterType: "online" as const,
  filePath:
    "C:\\Users\\TestUser\\Documents\\My Games\\Path of Exile\\OnlineFilters\\NeverSink",
  filterName: "NeverSink's Filter",
  lastUpdate: "2025-01-15T10:00:00Z",
  isFullyParsed: true,
  parsedAt: "2025-01-15T11:00:00Z",
  createdAt: "2025-01-10T08:00:00Z",
  updatedAt: "2025-01-15T11:00:00Z",
};

const SAMPLE_CARD_RARITIES = [
  { filterId: "filter_abc12345", cardName: "Rain of Chaos", rarity: 4 },
  { filterId: "filter_abc12345", cardName: "The Doctor", rarity: 1 },
  { filterId: "filter_abc12345", cardName: "The Nurse", rarity: 1 },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("RarityModelService — IPC handlers and input validation", () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let _service: RarityModelService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    RarityModelService._instance = undefined;

    // Reset validation mocks to no-op implementations
    mockAssertBoundedString.mockImplementation(() => {});
    mockAssertEnum.mockImplementation(() => {});
    mockAssertGameType.mockImplementation(() => {});
    mockAssertOptionalString.mockImplementation(() => {});
    mockHandleValidationError.mockImplementation(() => ({
      success: false,
      error: "Validation error",
    }));

    // Default mock return values
    mockSettingsGet.mockResolvedValue(null);
    mockSettingsSet.mockResolvedValue(undefined);
    mockScanAll.mockResolvedValue([]);
    mockRepoGetAll.mockResolvedValue([]);
    mockRepoGetById.mockResolvedValue(SAMPLE_FILTER_METADATA);
    mockRepoUpsertMany.mockResolvedValue(undefined);
    mockRepoDeleteNotInFilePaths.mockResolvedValue(0);
    mockRepoMarkAsParsed.mockResolvedValue(undefined);
    mockRepoGetCardRarities.mockResolvedValue(SAMPLE_CARD_RARITIES);
    mockRepoReplaceCardRarities.mockResolvedValue(undefined);
    mockRepoGetCardRarityCount.mockResolvedValue(3);
    mockParseFilterFile.mockResolvedValue({
      hasDivinationSection: true,
      totalCards: 3,
      cardRarities: new Map([
        ["The Doctor", 1],
        ["Rain of Chaos", 4],
        ["The Nurse", 1],
      ]),
    });
    mockDivinationUpdateRaritiesFromFilter.mockResolvedValue(undefined);

    _service = RarityModelService.getInstance();
  });

  afterEach(() => {
    // @ts-expect-error — accessing private static for testing
    RarityModelService._instance = undefined;
    vi.restoreAllMocks();
  });

  // ─── Handler Registration ────────────────────────────────────────────

  describe("IPC handler registration", () => {
    it("should register all expected IPC handlers", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch,
      );

      expect(registeredChannels).toContain(RarityModelChannel.ScanRarityModels);
      expect(registeredChannels).toContain(RarityModelChannel.GetRarityModels);
      expect(registeredChannels).toContain(RarityModelChannel.GetRarityModel);
      expect(registeredChannels).toContain(RarityModelChannel.ParseRarityModel);
      expect(registeredChannels).toContain(
        RarityModelChannel.SelectRarityModel,
      );
      expect(registeredChannels).toContain(
        RarityModelChannel.GetSelectedRarityModel,
      );
      expect(registeredChannels).toContain(RarityModelChannel.GetRaritySource);
      expect(registeredChannels).toContain(RarityModelChannel.SetRaritySource);
      expect(registeredChannels).toContain(
        RarityModelChannel.ApplyRarityModelRarities,
      );
      expect(registeredChannels).toContain(
        RarityModelChannel.UpdateRarityModelCardRarity,
      );
    });

    it("should register exactly 10 IPC handlers", () => {
      expect(mockIpcHandle).toHaveBeenCalledTimes(10);
    });

    it("should register each channel only once", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch,
      );
      const uniqueChannels = new Set(registeredChannels);
      expect(uniqueChannels.size).toBe(registeredChannels.length);
    });
  });

  // ─── ScanFilters (no params — no validation needed) ───────────────────

  describe("ScanFilters handler", () => {
    it("should not require any input validation", async () => {
      const handler = getIpcHandler(RarityModelChannel.ScanRarityModels);
      await handler({});

      // No validation assertions needed — handler takes no params
      expect(mockAssertBoundedString).not.toHaveBeenCalled();
      expect(mockAssertGameType).not.toHaveBeenCalled();
      expect(mockAssertEnum).not.toHaveBeenCalled();
    });

    it("should return scan results", async () => {
      const handler = getIpcHandler(RarityModelChannel.ScanRarityModels);
      const result = await handler({});

      expect(result).toEqual({
        filters: [],
        localCount: 0,
        onlineCount: 0,
      });
    });
  });

  // ─── GetFilters (no params — no validation needed) ────────────────────

  describe("GetFilters handler", () => {
    it("should not require any input validation", async () => {
      const handler = getIpcHandler(RarityModelChannel.GetRarityModels);
      await handler({});

      expect(mockAssertBoundedString).not.toHaveBeenCalled();
      expect(mockAssertGameType).not.toHaveBeenCalled();
    });

    it("should return all filters", async () => {
      mockRepoGetAll.mockResolvedValue([SAMPLE_FILTER_METADATA]);
      const handler = getIpcHandler(RarityModelChannel.GetRarityModels);
      const result = await handler({});

      expect(result).toHaveLength(1);
    });
  });

  // ─── GetFilter handler ────────────────────────────────────────────────

  describe("GetFilter handler", () => {
    it("should validate filterId as a bounded string", async () => {
      const handler = getIpcHandler(RarityModelChannel.GetRarityModel);
      await handler({}, "filter_abc12345");

      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "filter_abc12345",
        "filterId",
        RarityModelChannel.GetRarityModel,
        256,
      );
    });

    it("should return filter metadata on valid input", async () => {
      const handler = getIpcHandler(RarityModelChannel.GetRarityModel);
      const result = await handler({}, "filter_abc12345");

      expect(mockRepoGetById).toHaveBeenCalledWith("filter_abc12345");
      expect(result).toEqual(SAMPLE_FILTER_METADATA);
    });

    it("should return null for non-existent filter", async () => {
      mockRepoGetById.mockResolvedValue(null);
      const handler = getIpcHandler(RarityModelChannel.GetRarityModel);
      const result = await handler({}, "filter_nonexistent");

      expect(result).toBeNull();
    });

    it("should handle validation error for non-string filterId", async () => {
      const validationError = new Error("Invalid filterId");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.GetRarityModel);
      await handler({}, 12345);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.GetRarityModel,
      );
      expect(mockRepoGetById).not.toHaveBeenCalled();
    });

    it("should handle validation error for null filterId", async () => {
      const validationError = new Error("Invalid filterId");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.GetRarityModel);
      await handler({}, null);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.GetRarityModel,
      );
    });

    it("should handle validation error for undefined filterId", async () => {
      const validationError = new Error("Invalid filterId");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.GetRarityModel);
      await handler({}, undefined);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.GetRarityModel,
      );
    });

    it("should handle validation error for overly long filterId", async () => {
      const validationError = new Error("filterId exceeds max length");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.GetRarityModel);
      const longId = "a".repeat(300);
      await handler({}, longId);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.GetRarityModel,
      );
      expect(mockRepoGetById).not.toHaveBeenCalled();
    });
  });

  // ─── ParseFilter handler ──────────────────────────────────────────────

  describe("ParseFilter handler", () => {
    it("should validate filterId as a bounded string", async () => {
      const handler = getIpcHandler(RarityModelChannel.ParseRarityModel);
      await handler({}, "filter_abc12345");

      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "filter_abc12345",
        "filterId",
        RarityModelChannel.ParseRarityModel,
        256,
      );
    });

    it("should return parse result on valid input", async () => {
      const handler = getIpcHandler(RarityModelChannel.ParseRarityModel);
      const result = await handler({}, "filter_abc12345");

      expect(result).toMatchObject({
        filterId: "filter_abc12345",
        filterName: SAMPLE_FILTER_METADATA.filterName,
        hasDivinationSection: true,
      });
    });

    it("should handle validation error for non-string filterId", async () => {
      const validationError = new Error("Invalid filterId");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.ParseRarityModel);
      await handler({}, 42);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.ParseRarityModel,
      );
      expect(mockRepoGetById).not.toHaveBeenCalled();
    });

    it("should handle validation error for null filterId", async () => {
      const validationError = new Error("Invalid filterId");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.ParseRarityModel);
      await handler({}, null);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.ParseRarityModel,
      );
    });

    it("should handle validation error for object filterId", async () => {
      const validationError = new Error("Invalid filterId");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.ParseRarityModel);
      await handler({}, { malicious: true });

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.ParseRarityModel,
      );
      expect(mockRepoGetById).not.toHaveBeenCalled();
    });

    it("should rethrow non-validation errors", async () => {
      mockRepoGetById.mockRejectedValue(new Error("Database connection lost"));

      // Make handleValidationError behave like the real implementation:
      // rethrow non-IpcValidationError errors
      mockHandleValidationError.mockImplementation((error: unknown) => {
        throw error;
      });

      const handler = getIpcHandler(RarityModelChannel.ParseRarityModel);
      await expect(handler({}, "filter_abc12345")).rejects.toThrow(
        "Database connection lost",
      );
    });
  });

  // ─── SelectFilter handler ─────────────────────────────────────────────

  describe("SelectFilter handler", () => {
    it("should validate filterId with assertOptionalString (accepts string)", async () => {
      const handler = getIpcHandler(RarityModelChannel.SelectRarityModel);
      await handler({}, "filter_abc12345");

      expect(mockAssertOptionalString).toHaveBeenCalledWith(
        "filter_abc12345",
        "filterId",
        RarityModelChannel.SelectRarityModel,
        256,
      );
    });

    it("should validate filterId with assertOptionalString (accepts null)", async () => {
      mockRepoGetById.mockResolvedValue(null); // null case — clearing selection
      const handler = getIpcHandler(RarityModelChannel.SelectRarityModel);
      await handler({}, null);

      expect(mockAssertOptionalString).toHaveBeenCalledWith(
        null,
        "filterId",
        RarityModelChannel.SelectRarityModel,
        256,
      );
    });

    it("should call settingsStore.set when selecting a valid filter", async () => {
      const handler = getIpcHandler(RarityModelChannel.SelectRarityModel);
      await handler({}, "filter_abc12345");

      expect(mockSettingsSet).toHaveBeenCalledWith(
        "selectedFilterId",
        "filter_abc12345",
      );
    });

    it("should call settingsStore.set with null when clearing selection", async () => {
      const handler = getIpcHandler(RarityModelChannel.SelectRarityModel);
      await handler({}, null);

      expect(mockSettingsSet).toHaveBeenCalledWith("selectedFilterId", null);
    });

    it("should handle validation error for numeric filterId", async () => {
      const validationError = new Error("Invalid filterId");
      mockAssertOptionalString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.SelectRarityModel);
      await handler({}, 999);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.SelectRarityModel,
      );
      expect(mockSettingsSet).not.toHaveBeenCalled();
    });

    it("should handle validation error for boolean filterId", async () => {
      const validationError = new Error("Invalid filterId");
      mockAssertOptionalString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.SelectRarityModel);
      await handler({}, true);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.SelectRarityModel,
      );
    });

    it("should handle validation error for array filterId", async () => {
      const validationError = new Error("Invalid filterId");
      mockAssertOptionalString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.SelectRarityModel);
      await handler({}, ["filter_abc12345"]);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.SelectRarityModel,
      );
    });
  });

  // ─── GetSelectedFilter (no params — no validation needed) ─────────────

  describe("GetSelectedFilter handler", () => {
    it("should not require any input validation", async () => {
      const handler = getIpcHandler(RarityModelChannel.GetSelectedRarityModel);
      await handler({});

      expect(mockAssertBoundedString).not.toHaveBeenCalled();
      expect(mockAssertGameType).not.toHaveBeenCalled();
    });

    it("should return null when no filter is selected", async () => {
      mockSettingsGet.mockResolvedValue(null);
      const handler = getIpcHandler(RarityModelChannel.GetSelectedRarityModel);
      const result = await handler({});

      expect(result).toBeNull();
    });

    it("should return filter metadata when a filter is selected", async () => {
      mockSettingsGet.mockResolvedValue("filter_abc12345");
      const handler = getIpcHandler(RarityModelChannel.GetSelectedRarityModel);
      const result = await handler({});

      expect(result).toEqual(SAMPLE_FILTER_METADATA);
    });
  });

  // ─── GetRaritySource (no params — no validation needed) ───────────────

  describe("GetRaritySource handler", () => {
    it("should not require any input validation", async () => {
      const handler = getIpcHandler(RarityModelChannel.GetRaritySource);
      await handler({});

      expect(mockAssertBoundedString).not.toHaveBeenCalled();
      expect(mockAssertEnum).not.toHaveBeenCalled();
    });

    it("should return current rarity source from settings", async () => {
      mockSettingsGet.mockResolvedValue("poe.ninja");
      const handler = getIpcHandler(RarityModelChannel.GetRaritySource);
      const result = await handler({});

      expect(result).toBe("poe.ninja");
    });
  });

  // ─── SetRaritySource handler ──────────────────────────────────────────

  describe("SetRaritySource handler", () => {
    it("should validate source as an enum value", async () => {
      const handler = getIpcHandler(RarityModelChannel.SetRaritySource);
      await handler({}, "poe.ninja");

      expect(mockAssertEnum).toHaveBeenCalledWith(
        "poe.ninja",
        "source",
        RarityModelChannel.SetRaritySource,
        ["poe.ninja", "filter", "prohibited-library"],
      );
    });

    it("should accept 'filter' as a valid rarity source", async () => {
      const handler = getIpcHandler(RarityModelChannel.SetRaritySource);
      await handler({}, "filter");

      expect(mockAssertEnum).toHaveBeenCalledWith(
        "filter",
        "source",
        RarityModelChannel.SetRaritySource,
        ["poe.ninja", "filter", "prohibited-library"],
      );
    });

    it("should accept 'prohibited-library' as a valid rarity source", async () => {
      const handler = getIpcHandler(RarityModelChannel.SetRaritySource);
      await handler({}, "prohibited-library");

      expect(mockAssertEnum).toHaveBeenCalledWith(
        "prohibited-library",
        "source",
        RarityModelChannel.SetRaritySource,
        ["poe.ninja", "filter", "prohibited-library"],
      );
    });

    it("should handle validation error for invalid source string", async () => {
      const validationError = new Error("Invalid source");
      mockAssertEnum.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.SetRaritySource);
      await handler({}, "invalid-source");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.SetRaritySource,
      );
      expect(mockSettingsSet).not.toHaveBeenCalled();
    });

    it("should handle validation error for numeric source", async () => {
      const validationError = new Error("Invalid source");
      mockAssertEnum.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.SetRaritySource);
      await handler({}, 42);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.SetRaritySource,
      );
    });

    it("should handle validation error for null source", async () => {
      const validationError = new Error("Invalid source");
      mockAssertEnum.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.SetRaritySource);
      await handler({}, null);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.SetRaritySource,
      );
    });

    it("should handle validation error for undefined source", async () => {
      const validationError = new Error("Invalid source");
      mockAssertEnum.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.SetRaritySource);
      await handler({}, undefined);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.SetRaritySource,
      );
    });

    it("should handle validation error for object source", async () => {
      const validationError = new Error("Invalid source");
      mockAssertEnum.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.SetRaritySource);
      await handler({}, { type: "poe.ninja" });

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.SetRaritySource,
      );
    });
  });

  // ─── ApplyFilterRarities handler ──────────────────────────────────────

  describe("ApplyFilterRarities handler", () => {
    it("should validate all three parameters", async () => {
      const handler = getIpcHandler(
        RarityModelChannel.ApplyRarityModelRarities,
      );
      await handler({}, "filter_abc12345", "poe1", "Settlers");

      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "filter_abc12345",
        "filterId",
        RarityModelChannel.ApplyRarityModelRarities,
        256,
      );
      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe1",
        RarityModelChannel.ApplyRarityModelRarities,
      );
      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "Settlers",
        "league",
        RarityModelChannel.ApplyRarityModelRarities,
        256,
      );
    });

    it("should accept poe2 as game type", async () => {
      const handler = getIpcHandler(
        RarityModelChannel.ApplyRarityModelRarities,
      );
      await handler({}, "filter_abc12345", "poe2", "Early Access");

      expect(mockAssertGameType).toHaveBeenCalledWith(
        "poe2",
        RarityModelChannel.ApplyRarityModelRarities,
      );
    });

    it("should return success result with filter info", async () => {
      const handler = getIpcHandler(
        RarityModelChannel.ApplyRarityModelRarities,
      );
      const result = await handler({}, "filter_abc12345", "poe1", "Settlers");

      expect(result).toMatchObject({
        success: true,
        filterName: SAMPLE_FILTER_METADATA.filterName,
      });
    });

    it("should handle validation error for invalid filterId", async () => {
      const validationError = new Error("Invalid filterId");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(
        RarityModelChannel.ApplyRarityModelRarities,
      );
      await handler({}, null, "poe1", "Settlers");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.ApplyRarityModelRarities,
      );
      expect(mockDivinationUpdateRaritiesFromFilter).not.toHaveBeenCalled();
    });

    it("should handle validation error for invalid game type", async () => {
      // Let filterId pass, but game fails
      mockAssertBoundedString.mockImplementation(() => {
        // first call is filterId — pass
      });
      const validationError = new Error("Invalid game");
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(
        RarityModelChannel.ApplyRarityModelRarities,
      );
      await handler({}, "filter_abc12345", "invalid-game", "Settlers");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.ApplyRarityModelRarities,
      );
      expect(mockDivinationUpdateRaritiesFromFilter).not.toHaveBeenCalled();
    });

    it("should handle validation error for invalid league", async () => {
      // Let filterId and game pass, but league fails
      mockAssertBoundedString.mockImplementation(
        (_value: unknown, paramName: string) => {
          if (paramName === "league") {
            throw new Error("Invalid league");
          }
        },
      );

      const handler = getIpcHandler(
        RarityModelChannel.ApplyRarityModelRarities,
      );
      await handler({}, "filter_abc12345", "poe1", 999);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        expect.any(Error),
        RarityModelChannel.ApplyRarityModelRarities,
      );
      expect(mockDivinationUpdateRaritiesFromFilter).not.toHaveBeenCalled();
    });

    it("should handle validation error for numeric game", async () => {
      const validationError = new Error("Invalid game");
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(
        RarityModelChannel.ApplyRarityModelRarities,
      );
      await handler({}, "filter_abc12345", 123, "Settlers");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.ApplyRarityModelRarities,
      );
    });

    it("should handle validation error for boolean league", async () => {
      mockAssertBoundedString.mockImplementation(
        (_value: unknown, paramName: string) => {
          if (paramName === "league") {
            throw new Error("Invalid league type");
          }
        },
      );

      const handler = getIpcHandler(
        RarityModelChannel.ApplyRarityModelRarities,
      );
      await handler({}, "filter_abc12345", "poe1", true);

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        expect.any(Error),
        RarityModelChannel.ApplyRarityModelRarities,
      );
    });

    it("should rethrow non-validation errors from business logic", async () => {
      mockDivinationUpdateRaritiesFromFilter.mockRejectedValue(
        new Error("DB write failed"),
      );

      // Make handleValidationError behave like the real implementation:
      // rethrow non-IpcValidationError errors
      mockHandleValidationError.mockImplementation((error: unknown) => {
        throw error;
      });

      const handler = getIpcHandler(
        RarityModelChannel.ApplyRarityModelRarities,
      );
      await expect(
        handler({}, "filter_abc12345", "poe1", "Settlers"),
      ).rejects.toThrow("DB write failed");
    });
  });

  // ─── Input sanitization edge cases ────────────────────────────────────

  describe("input sanitization edge cases", () => {
    it("GetFilter should reject filterId with null bytes via validation", async () => {
      const validationError = new Error("Contains null bytes");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.GetRarityModel);
      await handler({}, "filter_abc\0malicious");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.GetRarityModel,
      );
    });

    it("ParseFilter should reject empty string filterId if validation throws", async () => {
      const validationError = new Error("filterId is empty");
      mockAssertBoundedString.mockImplementation(
        (value: unknown, _paramName: string) => {
          if (typeof value === "string" && value.length === 0) {
            throw validationError;
          }
        },
      );

      const handler = getIpcHandler(RarityModelChannel.ParseRarityModel);
      await handler({}, "");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.ParseRarityModel,
      );
    });

    it("ApplyFilterRarities should validate all params even with malicious inputs", async () => {
      const validationError = new Error("Invalid filterId");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(
        RarityModelChannel.ApplyRarityModelRarities,
      );
      await handler({}, { __proto__: { isAdmin: true } }, "poe1", "Settlers");

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.ApplyRarityModelRarities,
      );
    });

    it("SetRaritySource should reject prototype pollution attempts", async () => {
      const validationError = new Error("Invalid source");
      mockAssertEnum.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(RarityModelChannel.SetRaritySource);
      await handler({}, { toString: () => "poe.ninja" });

      expect(mockHandleValidationError).toHaveBeenCalledWith(
        validationError,
        RarityModelChannel.SetRaritySource,
      );
    });
  });

  // ─── Validation call order ────────────────────────────────────────────

  describe("validation call order", () => {
    it("ApplyFilterRarities should validate filterId before game", async () => {
      const callOrder: string[] = [];
      mockAssertBoundedString.mockImplementation(
        (_v: unknown, paramName: string) => {
          callOrder.push(`assertBoundedString:${paramName}`);
        },
      );
      mockAssertGameType.mockImplementation(() => {
        callOrder.push("assertGameType");
      });

      const handler = getIpcHandler(
        RarityModelChannel.ApplyRarityModelRarities,
      );
      await handler({}, "filter_abc12345", "poe1", "Settlers");

      expect(callOrder[0]).toBe("assertBoundedString:filterId");
      expect(callOrder[1]).toBe("assertGameType");
      expect(callOrder[2]).toBe("assertBoundedString:league");
    });

    it("ApplyFilterRarities should not validate league if game validation fails", async () => {
      const validationError = new Error("Invalid game");
      mockAssertGameType.mockImplementation(() => {
        throw validationError;
      });

      const handler = getIpcHandler(
        RarityModelChannel.ApplyRarityModelRarities,
      );
      await handler({}, "filter_abc12345", "invalid", "Settlers");

      // assertBoundedString should only have been called once for filterId, not for league
      expect(mockAssertBoundedString).toHaveBeenCalledTimes(1);
      expect(mockAssertBoundedString).toHaveBeenCalledWith(
        "filter_abc12345",
        "filterId",
        RarityModelChannel.ApplyRarityModelRarities,
        256,
      );
    });
  });

  // ─── Handlers that don't need validation still work ───────────────────

  describe("parameterless handlers", () => {
    it("ScanFilters should call scanner.scanAll", async () => {
      const handler = getIpcHandler(RarityModelChannel.ScanRarityModels);
      await handler({});

      expect(mockScanAll).toHaveBeenCalledTimes(1);
    });

    it("GetFilters should call repository.getAll", async () => {
      const handler = getIpcHandler(RarityModelChannel.GetRarityModels);
      await handler({});

      expect(mockRepoGetAll).toHaveBeenCalledTimes(1);
    });

    it("GetSelectedFilter should query settings and repository", async () => {
      mockSettingsGet.mockResolvedValue("filter_abc12345");
      const handler = getIpcHandler(RarityModelChannel.GetSelectedRarityModel);
      const result = await handler({});

      expect(mockSettingsGet).toHaveBeenCalled();
      expect(result).toEqual(SAMPLE_FILTER_METADATA);
    });

    it("GetRaritySource should query settings", async () => {
      mockSettingsGet.mockResolvedValue("filter");
      const handler = getIpcHandler(RarityModelChannel.GetRaritySource);
      const result = await handler({});

      expect(result).toBe("filter");
    });
  });

  // ─── Error response format ────────────────────────────────────────────

  describe("error response format", () => {
    it("should return { success: false, error: string } for validation errors", async () => {
      const validationError = new Error("Invalid filterId");
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });
      mockHandleValidationError.mockReturnValue({
        success: false,
        error: 'Invalid input: Expected "filterId" to be a string, got number',
      });

      const handler = getIpcHandler(RarityModelChannel.GetRarityModel);
      const result = await handler({}, 42);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should return consistent error format across all validated handlers", async () => {
      const validationError = new Error("Validation failed");
      const errorResponse = { success: false, error: "Validation error" };

      // Get all handlers before any mock clearing
      const getHandler = getIpcHandler(RarityModelChannel.GetRarityModel);
      const parseHandler = getIpcHandler(RarityModelChannel.ParseRarityModel);
      const setHandler = getIpcHandler(RarityModelChannel.SetRaritySource);

      // Test GetFilter
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });
      mockHandleValidationError.mockReturnValue(errorResponse);
      expect(await getHandler({}, null)).toEqual(errorResponse);

      // Reset mocks for next handler (without clearing mockIpcHandle calls)
      mockAssertBoundedString.mockReset();
      mockHandleValidationError.mockReset();

      // Test ParseFilter
      mockAssertBoundedString.mockImplementation(() => {
        throw validationError;
      });
      mockHandleValidationError.mockReturnValue(errorResponse);
      expect(await parseHandler({}, null)).toEqual(errorResponse);

      // Reset mocks for next handler
      mockAssertBoundedString.mockReset();
      mockAssertEnum.mockReset();
      mockHandleValidationError.mockReset();

      // Test SetRaritySource
      mockAssertEnum.mockImplementation(() => {
        throw validationError;
      });
      mockHandleValidationError.mockReturnValue(errorResponse);
      expect(await setHandler({}, "bad")).toEqual(errorResponse);
    });
  });

  // ─── Channel string values ────────────────────────────────────────────

  describe("channel string values", () => {
    it("should use correct channel string for ScanFilters", () => {
      expect(RarityModelChannel.ScanRarityModels).toBe("rarity-model:scan");
    });

    it("should use correct channel string for GetFilters", () => {
      expect(RarityModelChannel.GetRarityModels).toBe("rarity-model:get-all");
    });

    it("should use correct channel string for GetFilter", () => {
      expect(RarityModelChannel.GetRarityModel).toBe("rarity-model:get");
    });

    it("should use correct channel string for ParseFilter", () => {
      expect(RarityModelChannel.ParseRarityModel).toBe("rarity-model:parse");
    });

    it("should use correct channel string for SelectFilter", () => {
      expect(RarityModelChannel.SelectRarityModel).toBe("rarity-model:select");
    });

    it("should use correct channel string for GetSelectedFilter", () => {
      expect(RarityModelChannel.GetSelectedRarityModel).toBe(
        "rarity-model:get-selected",
      );
    });

    it("should use correct channel string for GetRaritySource", () => {
      expect(RarityModelChannel.GetRaritySource).toBe(
        "rarity-model:get-rarity-source",
      );
    });

    it("should use correct channel string for SetRaritySource", () => {
      expect(RarityModelChannel.SetRaritySource).toBe(
        "rarity-model:set-rarity-source",
      );
    });

    it("should use correct channel string for ApplyFilterRarities", () => {
      expect(RarityModelChannel.ApplyRarityModelRarities).toBe(
        "rarity-model:apply-rarities",
      );
    });

    it("should use correct channel string for OnFilterRaritiesApplied", () => {
      expect(RarityModelChannel.OnRarityModelRaritiesApplied).toBe(
        "rarity-model:on-rarities-applied",
      );
    });
  });
});
