import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createBarrelMock,
  createDatabaseServiceMock,
  createDataStoreServiceMock,
  createElectronMock,
  createPerformanceLoggerMock,
  createSettingsStoreMock,
  getIpcHandler,
} from "~/main/modules/__test-utils__/mock-factories";
import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const {
  mockIpcHandle,
  mockShowSaveDialog,
  mockGetAllWindows,
  mockWriteFile,
  mockGetKysely,
  mockGetAllTimeStats,
  mockGetLeagueStats,
  mockSettingsGet,
  mockSettingsSet,
  mockGetSessionById,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockShowSaveDialog: vi.fn(),
  mockGetAllWindows: vi.fn(),
  mockWriteFile: vi.fn(),
  mockGetKysely: vi.fn(),
  mockGetAllTimeStats: vi.fn(),
  mockGetLeagueStats: vi.fn(),
  mockSettingsGet: vi.fn(),
  mockSettingsSet: vi.fn(),
  mockGetSessionById: vi.fn(),
}));

/**
 * Creates a chainable mock Kysely instance that supports the query patterns
 * used by CsvRepository (selectFrom, insertInto, deleteFrom on csv_export_snapshots).
 *
 * - selectFrom().select().where().where().executeTakeFirst() → returns mockSelectResult
 * - selectFrom().selectAll().where().where().execute() → returns mockSelectAllResult
 * - insertInto().values().onConflict().execute() → resolves
 * - deleteFrom().where().where().execute() → resolves
 */
function createMockKysely(options?: {
  selectResult?: any;
  selectAllResult?: any[];
}) {
  const mockExecuteTakeFirst = vi
    .fn()
    .mockResolvedValue(options?.selectResult ?? null);

  const chainable: any = {};
  // Every method returns `chainable` so calls can be chained arbitrarily
  for (const method of [
    "selectFrom",
    "selectAll",
    "select",
    "where",
    "insertInto",
    "values",
    "onConflict",
    "columns",
    "doUpdateSet",
    "deleteFrom",
    "set",
    "transaction",
  ]) {
    chainable[method] = vi.fn().mockReturnValue(chainable);
  }

  // Terminal methods
  chainable.execute = vi.fn().mockResolvedValue(options?.selectAllResult ?? []);
  chainable.executeTakeFirst = mockExecuteTakeFirst;

  // onConflict receives a callback — invoke it with chainable so .columns().doUpdateSet() works
  chainable.onConflict = vi.fn().mockImplementation((cb: any) => {
    if (typeof cb === "function") cb(chainable);
    return chainable;
  });

  // select receives a callback for expression builder — invoke it with a mock eb
  chainable.select = vi.fn().mockImplementation((arg: any) => {
    if (typeof arg === "function") {
      const mockFn = vi
        .fn()
        .mockReturnValue({ as: vi.fn().mockReturnValue("mock_col") });
      const eb = { fn: { sum: mockFn, max: mockFn, count: mockFn } };
      arg(eb);
    }
    return chainable;
  });

  return chainable;
}

// ─── Mock Electron before any imports that use it ────────────────────────────
vi.mock("electron", () =>
  createElectronMock({
    mockIpcHandle,
    mockGetAllWindows,
    mockShowSaveDialog,
  }),
);

// ─── Mock fs.promises ────────────────────────────────────────────────────────
vi.mock("node:fs", () => ({
  promises: {
    writeFile: mockWriteFile,
    mkdir: vi.fn().mockResolvedValue(undefined),
  },
}));

// ─── Mock DatabaseService singleton ──────────────────────────────────────────
vi.mock("~/main/modules/database", () =>
  createDatabaseServiceMock({ mockGetKysely }),
);

// ─── Mock PerformanceLoggerService ───────────────────────────────────────────
vi.mock("~/main/modules/performance-logger", () =>
  createPerformanceLoggerMock(),
);

// ─── Mock DataStoreService ───────────────────────────────────────────────────
vi.mock("~/main/modules/data-store", () =>
  createDataStoreServiceMock({
    mockGetAllTimeStats,
    mockGetLeagueStats,
  }),
);

// ─── Mock SettingsStoreService ───────────────────────────────────────────────
vi.mock("~/main/modules/settings-store", () =>
  createSettingsStoreMock({
    mockGet: mockSettingsGet,
    mockSet: mockSettingsSet,
  }),
);

// ─── Mock SessionsService ────────────────────────────────────────────────────
vi.mock("~/main/modules/sessions", () => ({
  SessionsService: {
    getInstance: vi.fn(() => ({
      getSessionById: mockGetSessionById,
    })),
  },
}));

// ─── Mock the barrel import path ─────────────────────────────────────────────
vi.mock("~/main/modules", () =>
  createBarrelMock({
    DataStoreService: {
      getInstance: vi.fn(() => ({
        getAllTimeStats: mockGetAllTimeStats,
        getLeagueStats: mockGetLeagueStats,
      })),
    },
    SettingsStoreService: {
      getInstance: vi.fn(() => ({
        get: mockSettingsGet,
        set: mockSettingsSet,
        getAllSettings: vi.fn(),
      })),
    },
    SessionsService: {
      getInstance: vi.fn(() => ({
        getSessionById: mockGetSessionById,
      })),
    },
  }),
);

import { CsvChannel } from "../Csv.channels";
import { CsvService } from "../Csv.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getExportAllHandler(): (...args: any[]) => Promise<any> {
  return getIpcHandler(mockIpcHandle, CsvChannel.ExportAll);
}

function getExportIncrementalHandler(): (...args: any[]) => Promise<any> {
  return getIpcHandler(mockIpcHandle, CsvChannel.ExportIncremental);
}

function getExportSessionHandler(): (...args: any[]) => Promise<any> {
  return getIpcHandler(mockIpcHandle, CsvChannel.ExportSession);
}

function getSnapshotMetaHandler(): (...args: any[]) => Promise<any> {
  return getIpcHandler(mockIpcHandle, CsvChannel.GetSnapshotMeta);
}

/**
 * Helper to re-create the CsvService singleton with a different Kysely mock.
 * Resets mockIpcHandle so getHandler() finds the NEW handler, not the old one.
 * Re-applies the default mock values for settings, stats, dialog, etc.
 */
function recreateServiceWithKysely(
  kyselyMock: any,
  defaults: {
    mockMainWindow: any;
    settingsGame?: string;
    allTimeStats?: any;
  },
) {
  // Update the Kysely mock BEFORE re-creating the service
  mockGetKysely.mockReturnValue(kyselyMock);

  // Reset ipcMain.handle so .find() picks up the new handlers
  mockIpcHandle.mockReset();

  // Destroy singleton
  resetSingleton(CsvService);

  // Re-apply default mocks (they were cleared by the reset above or need fresh values)
  mockGetAllWindows.mockReturnValue([defaults.mockMainWindow]);
  mockSettingsGet.mockImplementation((key: string) => {
    if (key === "csvExportPath") return Promise.resolve(null);
    return Promise.resolve(defaults.settingsGame ?? "poe1");
  });
  if (defaults.allTimeStats) {
    mockGetAllTimeStats.mockResolvedValue(defaults.allTimeStats);
  }
  mockShowSaveDialog.mockResolvedValue({
    canceled: false,
    filePath: "/tmp/poe1-cards-2025-01-15.csv",
  });
  mockWriteFile.mockResolvedValue(undefined);

  // Create fresh service (registers new handlers with mockIpcHandle)
  const service = CsvService.getInstance();

  return { service };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CsvService", () => {
  let _service: CsvService;
  let exportAllHandler: (...args: any[]) => Promise<any>;

  const mockMainWindow = {
    webContents: { send: vi.fn() },
    isDestroyed: vi.fn(() => false),
  };

  beforeEach(() => {
    // Reset mock implementations
    mockIpcHandle.mockReset();
    mockShowSaveDialog.mockReset();
    mockGetAllWindows.mockReset();
    mockWriteFile.mockReset();
    mockGetAllTimeStats.mockReset();
    mockGetLeagueStats.mockReset();
    mockSettingsGet.mockReset();
    mockSettingsSet.mockReset();
    mockGetSessionById.mockReset();

    // Default: Kysely mock that handles CsvRepository queries
    mockGetKysely.mockReturnValue(createMockKysely());

    // Default: main window available
    mockGetAllWindows.mockReturnValue([mockMainWindow]);

    // Default: key-aware settings mock
    mockSettingsGet.mockImplementation((key: string) => {
      if (key === "csvExportPath") return Promise.resolve(null);
      return Promise.resolve("poe1");
    });

    // Default: some card data
    mockGetAllTimeStats.mockResolvedValue({
      totalCount: 15,
      cards: {
        "The Doctor": { count: 3 },
        "The Nurse": { count: 7 },
        "Rain of Chaos": { count: 5 },
      },
    });

    // Default: dialog returns a file path
    mockShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: "/tmp/poe1-cards-2025-01-15.csv",
    });

    // Default: writeFile succeeds
    mockWriteFile.mockResolvedValue(undefined);

    // Reset singleton
    resetSingleton(CsvService);

    _service = CsvService.getInstance();
    exportAllHandler = getExportAllHandler();
  });

  afterEach(() => {
    resetSingleton(CsvService);
    vi.clearAllMocks();
  });

  // ─── Singleton ──────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = CsvService.getInstance();
      const instance2 = CsvService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  // ─── IPC Handler Registration ───────────────────────────────────────────

  describe("setupHandlers", () => {
    it("should register the ExportAll handler", () => {
      expect(mockIpcHandle).toHaveBeenCalledWith(
        CsvChannel.ExportAll,
        expect.any(Function),
      );
    });

    it("should register the ExportIncremental handler", () => {
      expect(mockIpcHandle).toHaveBeenCalledWith(
        CsvChannel.ExportIncremental,
        expect.any(Function),
      );
    });

    it("should register the ExportSession handler", () => {
      expect(mockIpcHandle).toHaveBeenCalledWith(
        CsvChannel.ExportSession,
        expect.any(Function),
      );
    });

    it("should register the GetSnapshotMeta handler", () => {
      expect(mockIpcHandle).toHaveBeenCalledWith(
        CsvChannel.GetSnapshotMeta,
        expect.any(Function),
      );
    });

    it("should register exactly four handlers", () => {
      // Four channels: ExportAll, ExportIncremental, ExportSession, GetSnapshotMeta
      expect(mockIpcHandle).toHaveBeenCalledTimes(4);
    });
  });

  // ─── ExportAll — success path ───────────────────────────────────────────

  describe("ExportAll handler — success path", () => {
    it("should fetch the active game from settings", async () => {
      await exportAllHandler({}, "all-time");

      expect(mockSettingsGet).toHaveBeenCalledWith("selectedGame");
    });

    it("should fetch all-time stats for the active game when scope is all-time", async () => {
      mockSettingsGet.mockImplementation((key: string) => {
        if (key === "csvExportPath") return Promise.resolve(null);
        return Promise.resolve("poe2");
      });

      await exportAllHandler({}, "all-time");

      expect(mockGetAllTimeStats).toHaveBeenCalledWith("poe2");
    });

    it("should fetch league stats when scope is a league name", async () => {
      mockGetLeagueStats.mockResolvedValue({
        totalCount: 5,
        cards: {
          "The Doctor": { count: 2 },
          "Rain of Chaos": { count: 3 },
        },
      });

      await exportAllHandler({}, "Settlers");

      expect(mockGetLeagueStats).toHaveBeenCalledWith("poe1", "Settlers");
    });

    it("should show a save dialog with correct default path for all-time", async () => {
      mockSettingsGet.mockImplementation((key: string) => {
        if (key === "csvExportPath") return Promise.resolve(null);
        return Promise.resolve("poe1");
      });

      await exportAllHandler({}, "all-time");

      expect(mockShowSaveDialog).toHaveBeenCalledWith(
        mockMainWindow,
        expect.objectContaining({
          title: expect.stringContaining("POE1"),
          defaultPath: expect.stringMatching(
            /poe1-cards-\d{4}-\d{2}-\d{2}\.csv$/,
          ),
          filters: [{ name: "CSV Files", extensions: ["csv"] }],
        }),
      );
    });

    it("should show a save dialog with scope in filename for league exports", async () => {
      mockGetLeagueStats.mockResolvedValue({
        totalCount: 5,
        cards: { "The Doctor": { count: 5 } },
      });

      await exportAllHandler({}, "Settlers");

      expect(mockShowSaveDialog).toHaveBeenCalledWith(
        mockMainWindow,
        expect.objectContaining({
          defaultPath: expect.stringMatching(
            /poe1-cards-Settlers-\d{4}-\d{2}-\d{2}\.csv$/,
          ),
        }),
      );
    });

    it("should write correct CSV content to the selected file", async () => {
      mockGetAllTimeStats.mockResolvedValue({
        totalCount: 5,
        cards: {
          "The Doctor": { count: 2 },
          "Rain of Chaos": { count: 3 },
        },
      });

      await exportAllHandler({}, "all-time");

      expect(mockWriteFile).toHaveBeenCalledTimes(1);

      const [filePath, content, encoding] = mockWriteFile.mock.calls[0];
      expect(filePath).toBe("/tmp/poe1-cards-2025-01-15.csv");
      expect(encoding).toBe("utf-8");

      // Parse the CSV content
      const lines = content.split("\n");
      expect(lines[0]).toBe("name,amount");
      expect(lines).toContain("The Doctor,2");
      expect(lines).toContain("Rain of Chaos,3");
    });

    it("should return success with file path and exported count", async () => {
      const result = await exportAllHandler({}, "all-time");

      expect(result).toEqual({
        success: true,
        exportedCount: 3,
      });
    });

    it("should handle cards with commas in name by quoting them", async () => {
      mockGetAllTimeStats.mockResolvedValue({
        totalCount: 1,
        cards: {
          'Card, The "Rare" One': { count: 1 },
        },
      });

      await exportAllHandler({}, "all-time");

      const [, content] = mockWriteFile.mock.calls[0];
      const lines = content.split("\n");
      // Commas and quotes should be escaped per CSV spec
      expect(lines[1]).toBe('"Card, The ""Rare"" One",1');
    });

    it("should handle empty card data", async () => {
      mockGetAllTimeStats.mockResolvedValue({
        totalCount: 0,
        cards: {},
      });

      await exportAllHandler({}, "all-time");

      const [, content] = mockWriteFile.mock.calls[0];
      // Should only have the header row with no data rows
      expect(content).toBe("name,amount\n");
    });

    it("should handle many cards correctly", async () => {
      const manyCards: Record<string, { count: number }> = {};
      for (let i = 0; i < 50; i++) {
        manyCards[`Card ${i}`] = { count: i + 1 };
      }

      mockGetAllTimeStats.mockResolvedValue({
        totalCount: 1275,
        cards: manyCards,
      });

      await exportAllHandler({}, "all-time");

      const [, content] = mockWriteFile.mock.calls[0];
      const lines = content.split("\n");
      // header + 50 data lines
      expect(lines.length).toBe(51);
    });
  });

  // ─── ExportAll — cancellation ───────────────────────────────────────────

  describe("ExportAll handler — cancellation", () => {
    it("should return canceled result when user cancels the save dialog", async () => {
      mockShowSaveDialog.mockResolvedValue({
        canceled: true,
        filePath: undefined,
      });

      const result = await exportAllHandler({}, "all-time");

      expect(result).toEqual({ success: false, canceled: true });
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("should return canceled when filePath is empty string", async () => {
      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: "",
      });

      const result = await exportAllHandler({}, "all-time");

      expect(result).toEqual({ success: false, canceled: true });
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  // ─── ExportAll — error handling ─────────────────────────────────────────

  describe("ExportAll handler — error cases", () => {
    it("should return error when no main window is available", async () => {
      mockGetAllWindows.mockReturnValue([]);

      const result = await exportAllHandler({}, "all-time");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: "Export failed. See logs for details.",
        }),
      );
    });

    it("should return error when writeFile fails", async () => {
      mockWriteFile.mockRejectedValue(new Error("Permission denied"));

      const result = await exportAllHandler({}, "all-time");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    it("should return error when getAllTimeStats throws", async () => {
      mockGetAllTimeStats.mockRejectedValue(new Error("Database error"));

      const result = await exportAllHandler({}, "all-time");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    it("should return error when settings get fails", async () => {
      mockSettingsGet.mockRejectedValue(new Error("Settings unavailable"));

      const result = await exportAllHandler({}, "all-time");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    it("should return error when showSaveDialog rejects", async () => {
      mockShowSaveDialog.mockRejectedValue(new Error("Dialog error"));

      const result = await exportAllHandler({}, "all-time");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    it("should not write file when an error occurs before dialog", async () => {
      mockGetAllTimeStats.mockRejectedValue(new Error("DB failure"));

      await exportAllHandler({}, "all-time");

      expect(mockWriteFile).not.toHaveBeenCalled();
      expect(mockShowSaveDialog).not.toHaveBeenCalled();
    });
  });

  // ─── Data Transformation ────────────────────────────────────────────────

  describe("data transformation", () => {
    it("should transform card stats entries to flat key-value pairs", async () => {
      mockGetAllTimeStats.mockResolvedValue({
        totalCount: 10,
        cards: {
          "The Surgeon": { count: 9 },
          "The Doppelganger": { count: 1 },
        },
      });

      await exportAllHandler({}, "all-time");

      const [, content] = mockWriteFile.mock.calls[0];
      const lines = content.split("\n");
      expect(lines[0]).toBe("name,amount");

      // Both cards should appear in the CSV
      const dataLines = lines.slice(1);
      const cardData = dataLines.map((line: string) => {
        const [name, amount] = line.split(",");
        return { name, amount: parseInt(amount, 10) };
      });

      expect(cardData).toContainEqual({ name: "The Surgeon", amount: 9 });
      expect(cardData).toContainEqual({
        name: "The Doppelganger",
        amount: 1,
      });
    });

    it("should use activeGame for the dialog title", async () => {
      mockSettingsGet.mockImplementation((key: string) => {
        if (key === "csvExportPath") return Promise.resolve(null);
        return Promise.resolve("poe2");
      });

      await exportAllHandler({}, "all-time");

      expect(mockShowSaveDialog).toHaveBeenCalledWith(
        mockMainWindow,
        expect.objectContaining({
          title: expect.stringContaining("POE2"),
        }),
      );
    });
  });

  // ─── ExportIncremental ──────────────────────────────────────────────────

  describe("ExportIncremental handler", () => {
    let incrementalHandler: (...args: any[]) => Promise<any>;

    beforeEach(() => {
      incrementalHandler = getExportIncrementalHandler();
    });

    it("should fetch the active game from settings", async () => {
      await incrementalHandler({}, "all-time");

      expect(mockSettingsGet).toHaveBeenCalledWith("selectedGame");
    });

    it("should export all cards as delta when no prior snapshot exists", async () => {
      // No prior snapshot: selectAll().execute() returns [] (default mock)
      mockGetAllTimeStats.mockResolvedValue({
        totalCount: 15,
        cards: {
          "The Doctor": { count: 3 },
          "The Nurse": { count: 7 },
          "Rain of Chaos": { count: 5 },
        },
      });

      const result = await incrementalHandler({}, "all-time");

      // All 3 cards are "new" (delta = current - 0), so all are exported
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          exportedCount: 3,
        }),
      );

      // Verify CSV content includes all cards with their full counts
      const [, content] = mockWriteFile.mock.calls[0];
      const lines = content.split("\n");
      expect(lines[0]).toBe("name,amount");
      expect(lines).toContain("The Doctor,3");
      expect(lines).toContain("The Nurse,7");
      expect(lines).toContain("Rain of Chaos,5");
    });

    it("should return error when snapshot matches current stats (no delta)", async () => {
      // Current stats
      const currentStats = {
        totalCount: 15,
        cards: {
          "The Doctor": { count: 3 },
          "The Nurse": { count: 7 },
          "Rain of Chaos": { count: 5 },
        },
      };
      mockGetAllTimeStats.mockResolvedValue(currentStats);

      // Snapshot rows match current — configure Kysely mock to return them
      const snapshotRows = [
        {
          id: 1,
          game: "poe1",
          scope: "all-time",
          card_name: "The Doctor",
          count: 3,
          total_count: 15,
          exported_at: "2025-06-01T10:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-01T10:00:00.000Z",
          updated_at: "2025-06-01T10:00:00.000Z",
        },
        {
          id: 2,
          game: "poe1",
          scope: "all-time",
          card_name: "The Nurse",
          count: 7,
          total_count: 15,
          exported_at: "2025-06-01T10:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-01T10:00:00.000Z",
          updated_at: "2025-06-01T10:00:00.000Z",
        },
        {
          id: 3,
          game: "poe1",
          scope: "all-time",
          card_name: "Rain of Chaos",
          count: 5,
          total_count: 15,
          exported_at: "2025-06-01T10:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-01T10:00:00.000Z",
          updated_at: "2025-06-01T10:00:00.000Z",
        },
      ];

      recreateServiceWithKysely(
        createMockKysely({ selectAllResult: snapshotRows }),
        { mockMainWindow, allTimeStats: currentStats },
      );
      incrementalHandler = getExportIncrementalHandler();

      const result = await incrementalHandler({}, "all-time");

      expect(result).toEqual({
        success: false,
        error: "No new cards since last export.",
      });
      expect(mockWriteFile).not.toHaveBeenCalled();
      expect(mockShowSaveDialog).not.toHaveBeenCalled();
    });

    it("should export only positive deltas when some cards changed", async () => {
      // Current stats: Doctor went from 3→8, Nurse unchanged at 7, Rain unchanged
      const currentStats = {
        totalCount: 20,
        cards: {
          "The Doctor": { count: 8 },
          "The Nurse": { count: 7 },
          "Rain of Chaos": { count: 5 },
        },
      };
      mockGetAllTimeStats.mockResolvedValue(currentStats);

      // Snapshot has old counts
      const snapshotRows = [
        {
          id: 1,
          game: "poe1",
          scope: "all-time",
          card_name: "The Doctor",
          count: 3,
          total_count: 15,
          exported_at: "2025-06-01T10:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-01T10:00:00.000Z",
          updated_at: "2025-06-01T10:00:00.000Z",
        },
        {
          id: 2,
          game: "poe1",
          scope: "all-time",
          card_name: "The Nurse",
          count: 7,
          total_count: 15,
          exported_at: "2025-06-01T10:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-01T10:00:00.000Z",
          updated_at: "2025-06-01T10:00:00.000Z",
        },
        {
          id: 3,
          game: "poe1",
          scope: "all-time",
          card_name: "Rain of Chaos",
          count: 5,
          total_count: 15,
          exported_at: "2025-06-01T10:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-01T10:00:00.000Z",
          updated_at: "2025-06-01T10:00:00.000Z",
        },
      ];

      recreateServiceWithKysely(
        createMockKysely({ selectAllResult: snapshotRows }),
        { mockMainWindow, allTimeStats: currentStats },
      );
      incrementalHandler = getExportIncrementalHandler();

      const result = await incrementalHandler({}, "all-time");

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          exportedCount: 1, // Only The Doctor has a positive delta
        }),
      );

      // Verify CSV content — only The Doctor with delta of 5 (8-3)
      const [, content] = mockWriteFile.mock.calls[0];
      const lines = content.split("\n");
      expect(lines[0]).toBe("name,amount");
      expect(lines).toContain("The Doctor,5");
      // The Nurse and Rain of Chaos should NOT appear (delta is 0)
      expect(content).not.toContain("The Nurse");
      expect(content).not.toContain("Rain of Chaos");
    });

    it("should include brand-new cards in the delta", async () => {
      // Current stats: same old cards plus a brand-new one
      const currentStats = {
        totalCount: 17,
        cards: {
          "The Doctor": { count: 3 },
          "The Nurse": { count: 7 },
          "Rain of Chaos": { count: 5 },
          "House of Mirrors": { count: 2 },
        },
      };
      mockGetAllTimeStats.mockResolvedValue(currentStats);

      // Snapshot only has the original 3 cards
      const snapshotRows = [
        {
          id: 1,
          game: "poe1",
          scope: "all-time",
          card_name: "The Doctor",
          count: 3,
          total_count: 15,
          exported_at: "2025-06-01T10:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-01T10:00:00.000Z",
          updated_at: "2025-06-01T10:00:00.000Z",
        },
        {
          id: 2,
          game: "poe1",
          scope: "all-time",
          card_name: "The Nurse",
          count: 7,
          total_count: 15,
          exported_at: "2025-06-01T10:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-01T10:00:00.000Z",
          updated_at: "2025-06-01T10:00:00.000Z",
        },
        {
          id: 3,
          game: "poe1",
          scope: "all-time",
          card_name: "Rain of Chaos",
          count: 5,
          total_count: 15,
          exported_at: "2025-06-01T10:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-01T10:00:00.000Z",
          updated_at: "2025-06-01T10:00:00.000Z",
        },
      ];

      recreateServiceWithKysely(
        createMockKysely({ selectAllResult: snapshotRows }),
        { mockMainWindow, allTimeStats: currentStats },
      );
      incrementalHandler = getExportIncrementalHandler();

      const result = await incrementalHandler({}, "all-time");

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          exportedCount: 1, // Only House of Mirrors is new
        }),
      );

      const [, content] = mockWriteFile.mock.calls[0];
      expect(content).toContain("House of Mirrors,2");
      expect(content).not.toContain("The Doctor");
      expect(content).not.toContain("The Nurse");
      expect(content).not.toContain("Rain of Chaos");
    });

    it("should show incremental suffix in the default filename", async () => {
      await incrementalHandler({}, "all-time");

      expect(mockShowSaveDialog).toHaveBeenCalledWith(
        mockMainWindow,
        expect.objectContaining({
          defaultPath: expect.stringMatching(
            /poe1-cards-incremental-\d{4}-\d{2}-\d{2}\.csv$/,
          ),
        }),
      );
    });

    it("should not save snapshot when user cancels the dialog", async () => {
      mockShowSaveDialog.mockResolvedValue({
        canceled: true,
        filePath: undefined,
      });

      const result = await incrementalHandler({}, "all-time");

      expect(result).toEqual({ success: false, canceled: true });
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("should work with league scope", async () => {
      mockGetLeagueStats.mockResolvedValue({
        totalCount: 5,
        cards: {
          "The Doctor": { count: 2 },
          "Rain of Chaos": { count: 3 },
        },
      });

      const result = await incrementalHandler({}, "Settlers");

      // No prior snapshot for league → all cards are deltas
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          exportedCount: 2,
        }),
      );
      expect(mockGetLeagueStats).toHaveBeenCalledWith("poe1", "Settlers");
    });

    it("should return error when no main window is available", async () => {
      mockGetAllWindows.mockReturnValue([]);

      const result = await incrementalHandler({}, "all-time");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: "Export failed. See logs for details.",
        }),
      );
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("should return error when writeFile fails", async () => {
      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: "/tmp/fail.csv",
      });
      mockWriteFile.mockRejectedValue(new Error("Permission denied"));

      const result = await incrementalHandler({}, "all-time");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    it("should return validation error for invalid scope", async () => {
      const result = await incrementalHandler({}, null);

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("scope"),
        }),
      );
      expect(mockGetAllTimeStats).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("should return error when settings get fails", async () => {
      mockSettingsGet.mockRejectedValue(new Error("Settings unavailable"));

      const result = await incrementalHandler({}, "all-time");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
        }),
      );
    });
  });

  // ─── ExportSession ──────────────────────────────────────────────────────

  describe("ExportSession handler", () => {
    let sessionHandler: (...args: any[]) => Promise<any>;

    beforeEach(() => {
      sessionHandler = getExportSessionHandler();
    });

    it("should return error when session is not found", async () => {
      mockGetSessionById.mockResolvedValue(null);

      const result = await sessionHandler(
        {},
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: "Session not found.",
        }),
      );
    });

    it("should export session cards as CSV", async () => {
      mockGetSessionById.mockResolvedValue({
        totalCount: 5,
        cards: [
          { name: "The Doctor", count: 2 },
          { name: "Rain of Chaos", count: 3 },
        ],
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
        league: "Settlers",
      });
      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: "/tmp/session-export.csv",
      });

      const result = await sessionHandler(
        {},
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          exportedCount: 2,
        }),
      );

      // Verify CSV content
      const [, content] = mockWriteFile.mock.calls[0];
      const lines = content.split("\n");
      expect(lines[0]).toBe("name,amount");
      expect(lines).toContain("The Doctor,2");
      expect(lines).toContain("Rain of Chaos,3");
    });

    it("should return canceled when user cancels the save dialog", async () => {
      mockGetSessionById.mockResolvedValue({
        totalCount: 1,
        cards: [{ name: "The Doctor", count: 1 }],
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
        league: "Settlers",
      });
      mockShowSaveDialog.mockResolvedValue({
        canceled: true,
        filePath: undefined,
      });

      const result = await sessionHandler(
        {},
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(result).toEqual({ success: false, canceled: true });
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("should handle session with empty cards array", async () => {
      mockGetSessionById.mockResolvedValue({
        totalCount: 0,
        cards: [],
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
        league: "Settlers",
      });
      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: "/tmp/empty-session.csv",
      });

      const result = await sessionHandler(
        {},
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          exportedCount: 0,
        }),
      );

      // CSV should contain only the header (jsonToCsv always appends \n after header)
      const [, content] = mockWriteFile.mock.calls[0];
      expect(content).toBe("name,amount\n");
    });

    it("should handle cards with special characters (commas, quotes) in name", async () => {
      mockGetSessionById.mockResolvedValue({
        totalCount: 3,
        cards: [
          { name: 'Card, The "Rare" One', count: 2 },
          { name: "Normal Card", count: 1 },
        ],
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
        league: "Settlers",
      });
      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: "/tmp/special-chars.csv",
      });

      const result = await sessionHandler(
        {},
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          exportedCount: 2,
        }),
      );

      const [, content] = mockWriteFile.mock.calls[0];
      const lines = content.split("\n");
      expect(lines[0]).toBe("name,amount");
      // Card name with comma/quotes should be properly escaped
      expect(lines).toContain('"Card, The ""Rare"" One",2');
      expect(lines).toContain("Normal Card,1");
    });

    it("should return error when no main window is available", async () => {
      mockGetSessionById.mockResolvedValue({
        totalCount: 1,
        cards: [{ name: "The Doctor", count: 1 }],
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
        league: "Settlers",
      });
      mockGetAllWindows.mockReturnValue([]);

      const result = await sessionHandler(
        {},
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: "Export failed. See logs for details.",
        }),
      );
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("should return error when writeFile fails", async () => {
      mockGetSessionById.mockResolvedValue({
        totalCount: 1,
        cards: [{ name: "The Doctor", count: 1 }],
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
        league: "Settlers",
      });
      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: "/tmp/fail.csv",
      });
      mockWriteFile.mockRejectedValue(new Error("Disk full"));

      const result = await sessionHandler(
        {},
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
        }),
      );
    });

    it("should include session suffix in the default filename", async () => {
      mockGetSessionById.mockResolvedValue({
        totalCount: 1,
        cards: [{ name: "The Doctor", count: 1 }],
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
        league: "Settlers",
      });

      await sessionHandler({}, "550e8400-e29b-41d4-a716-446655440000");

      expect(mockShowSaveDialog).toHaveBeenCalledWith(
        mockMainWindow,
        expect.objectContaining({
          defaultPath: expect.stringMatching(
            /poe1-cards-session-550e8400-session-\d{4}-\d{2}-\d{2}\.csv$/,
          ),
        }),
      );
    });

    it("should not save a snapshot after session export", async () => {
      const kyselyMock = createMockKysely();
      const { service: _svc } = recreateServiceWithKysely(kyselyMock, {
        mockMainWindow,
        settingsGame: "poe1",
      });
      const handler = getExportSessionHandler();

      mockGetSessionById.mockResolvedValue({
        totalCount: 3,
        cards: [
          { name: "The Doctor", count: 1 },
          { name: "Rain of Chaos", count: 2 },
        ],
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
        league: "Settlers",
      });
      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: "/tmp/session.csv",
      });

      const result = await handler({}, "550e8400-e29b-41d4-a716-446655440000");

      expect(result.success).toBe(true);
      // insertInto should NOT be called — session exports don't persist snapshots
      expect(kyselyMock.insertInto).not.toHaveBeenCalled();
    });

    it("should fall back to poe1 when activeGame is null", async () => {
      mockSettingsGet.mockImplementation((key: string) => {
        if (key === "csvExportPath") return Promise.resolve(null);
        return Promise.resolve(null);
      });
      mockGetSessionById.mockResolvedValue({
        totalCount: 2,
        cards: [{ name: "Rain of Chaos", count: 2 }],
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
        league: "Settlers",
      });
      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: "/tmp/fallback.csv",
      });

      const result = await sessionHandler(
        {},
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          exportedCount: 1,
        }),
      );

      // Dialog title should use poe1 as fallback
      expect(mockShowSaveDialog).toHaveBeenCalledWith(
        mockMainWindow,
        expect.objectContaining({
          defaultPath: expect.stringContaining("poe1"),
        }),
      );
    });

    it("should export a single card correctly", async () => {
      mockGetSessionById.mockResolvedValue({
        totalCount: 7,
        cards: [{ name: "The Doctor", count: 7 }],
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:00:00Z",
        league: "Settlers",
      });
      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: "/tmp/single-card.csv",
      });

      const result = await sessionHandler(
        {},
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          exportedCount: 1,
        }),
      );

      const [, content] = mockWriteFile.mock.calls[0];
      const lines = content.split("\n");
      expect(lines).toHaveLength(2); // header + 1 card
      expect(lines[0]).toBe("name,amount");
      expect(lines[1]).toBe("The Doctor,7");
    });

    it("should return validation error for invalid session ID", async () => {
      const result = await sessionHandler({}, null);

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("sessionId"),
        }),
      );
      expect(mockGetSessionById).not.toHaveBeenCalled();
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  // ─── GetSnapshotMeta ────────────────────────────────────────────────────

  describe("GetSnapshotMeta handler", () => {
    let metaHandler: (...args: any[]) => Promise<any>;

    beforeEach(() => {
      metaHandler = getSnapshotMetaHandler();
    });

    it("should fetch the active game from settings", async () => {
      await metaHandler({}, "all-time");

      expect(mockSettingsGet).toHaveBeenCalledWith("selectedGame");
    });

    it("should return exists: false when no snapshot exists", async () => {
      // With mocked Kysely returning nothing, the repository should return null
      const result = await metaHandler({}, "all-time");

      // The handler wraps the result; if repo returns null it returns exists: false
      expect(result).toEqual(
        expect.objectContaining({
          exists: false,
        }),
      );
    });

    it("should return exists: true with totalCount and exportedAt when snapshot exists", async () => {
      const kyselyMock = createMockKysely({
        selectResult: {
          total_count: 42,
          exported_at: "2025-06-15T12:00:00.000Z",
        },
      });

      recreateServiceWithKysely(kyselyMock, { mockMainWindow });
      metaHandler = getSnapshotMetaHandler();

      const result = await metaHandler({}, "all-time");

      expect(result).toEqual({
        exists: true,
        exportedAt: "2025-06-15T12:00:00.000Z",
        totalCount: 42,
        newCardCount: 3,
        newTotalDrops: 15,
      });
    });

    it("should pass the correct scope to the repository for league scope", async () => {
      const kyselyMock = createMockKysely();
      recreateServiceWithKysely(kyselyMock, { mockMainWindow });
      metaHandler = getSnapshotMetaHandler();

      await metaHandler({}, "Settlers");

      // Verify where() was called (the scope is passed through the query chain)
      expect(kyselyMock.where).toHaveBeenCalled();
    });

    it("should return validation error for invalid scope", async () => {
      const result = await metaHandler({}, null);

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("scope"),
        }),
      );
    });

    it("should return error when settings get fails", async () => {
      mockSettingsGet.mockRejectedValue(new Error("Settings unavailable"));

      const result = await metaHandler({}, "all-time");

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
        }),
      );
    });
  });

  // ─── Integration-style ─────────────────────────────────────────────────

  describe("end-to-end export flow", () => {
    it("should complete the full ExportAll pipeline correctly", async () => {
      // Setup: poe1 game with specific cards
      mockSettingsGet.mockImplementation((key: string) => {
        if (key === "csvExportPath") return Promise.resolve(null);
        return Promise.resolve("poe1");
      });
      mockGetAllTimeStats.mockResolvedValue({
        totalCount: 20,
        cards: {
          "The Doctor": { count: 5 },
          "House of Mirrors": { count: 2 },
          "The Wretched": { count: 13 },
        },
      });
      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: "/home/user/exports/poe1-export.csv",
      });
      mockWriteFile.mockResolvedValue(undefined);

      const result = await exportAllHandler({}, "all-time");

      // 1. Settings were queried
      expect(mockSettingsGet).toHaveBeenCalledTimes(2);

      // 2. Stats were fetched for the correct game
      expect(mockGetAllTimeStats).toHaveBeenCalledWith("poe1");

      // 3. Dialog was shown
      expect(mockShowSaveDialog).toHaveBeenCalledTimes(1);

      // 4. File was written with correct content
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const [filePath, content, encoding] = mockWriteFile.mock.calls[0];
      expect(filePath).toBe("/home/user/exports/poe1-export.csv");
      expect(encoding).toBe("utf-8");

      // Verify CSV structure
      const lines = content.split("\n");
      expect(lines[0]).toBe("name,amount");
      expect(lines.length).toBe(4); // header + 3 cards

      // 5. Success result returned with exported count
      expect(result).toEqual({
        success: true,
        exportedCount: 3,
      });
    });

    it("should complete the full ExportSession pipeline correctly", async () => {
      const sessionHandler = getExportSessionHandler();

      mockSettingsGet.mockImplementation((key: string) => {
        if (key === "csvExportPath") return Promise.resolve(null);
        return Promise.resolve("poe1");
      });
      mockGetSessionById.mockResolvedValue({
        totalCount: 8,
        cards: [
          { name: "The Doctor", count: 3 },
          { name: "House of Mirrors", count: 5 },
        ],
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:30:00Z",
        league: "Settlers",
      });
      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: "/home/user/exports/session-export.csv",
      });
      mockWriteFile.mockResolvedValue(undefined);

      const result = await sessionHandler(
        {},
        "550e8400-e29b-41d4-a716-446655440000",
      );

      // Session data was fetched
      expect(mockGetSessionById).toHaveBeenCalledWith(
        "550e8400-e29b-41d4-a716-446655440000",
      );

      // File was written
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const [, content] = mockWriteFile.mock.calls[0];
      const lines = content.split("\n");
      expect(lines[0]).toBe("name,amount");
      expect(lines.length).toBe(3); // header + 2 cards

      // Success with exported count
      expect(result).toEqual({
        success: true,
        exportedCount: 2,
      });
    });
  });
});
