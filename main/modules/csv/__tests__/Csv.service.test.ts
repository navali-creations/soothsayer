import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const {
  mockIpcHandle,
  mockShowSaveDialog,
  mockGetAllWindows,
  mockWriteFile,
  mockGetKysely,
  mockGetAllTimeStats,
  mockSettingsGet,
  mockSettingsSet,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockShowSaveDialog: vi.fn(),
  mockGetAllWindows: vi.fn(),
  mockWriteFile: vi.fn(),
  mockGetKysely: vi.fn(),
  mockGetAllTimeStats: vi.fn(),
  mockSettingsGet: vi.fn(),
  mockSettingsSet: vi.fn(),
}));

// ─── Mock Electron before any imports that use it ────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: mockGetAllWindows,
    getFocusedWindow: vi.fn(() => null),
  },
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => "/mock-app-path"),
    getPath: vi.fn(() => "/mock-path"),
  },
  dialog: {
    showMessageBox: vi.fn(),
    showSaveDialog: mockShowSaveDialog,
  },
}));

// ─── Mock fs.promises ────────────────────────────────────────────────────────
vi.mock("node:fs", () => ({
  promises: {
    writeFile: mockWriteFile,
  },
}));

// ─── Mock DatabaseService singleton ──────────────────────────────────────────
vi.mock("~/main/modules/database", () => ({
  DatabaseService: {
    getInstance: vi.fn(() => ({
      getKysely: mockGetKysely,
      reset: vi.fn(),
    })),
  },
}));

// ─── Mock PerformanceLoggerService ───────────────────────────────────────────
vi.mock("~/main/modules/performance-logger", () => ({
  PerformanceLoggerService: {
    getInstance: vi.fn(() => ({
      log: vi.fn(),
      startTimer: vi.fn(() => null),
      startTimers: vi.fn(() => null),
    })),
  },
}));

// ─── Mock DataStoreService ───────────────────────────────────────────────────
vi.mock("~/main/modules/data-store", () => ({
  DataStoreService: {
    getInstance: vi.fn(() => ({
      getAllTimeStats: mockGetAllTimeStats,
      getLeagueStats: vi.fn(),
      addCard: vi.fn(),
      getGlobalStats: vi.fn(),
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
    ActiveGame: "selectedGame",
  },
}));

// Also mock the barrel import path
vi.mock("~/main/modules", () => ({
  DataStoreService: {
    getInstance: vi.fn(() => ({
      getAllTimeStats: mockGetAllTimeStats,
    })),
  },
  SettingsStoreService: {
    getInstance: vi.fn(() => ({
      get: mockSettingsGet,
      set: mockSettingsSet,
      getAllSettings: vi.fn(),
    })),
  },
  SettingsKey: {
    ActiveGame: "selectedGame",
  },
}));

import { CsvService } from "../Csv.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * After CsvService is instantiated, the constructor calls setupHandlers()
 * which registers an ipcMain.handle for "export-divination-cards-csv".
 * This helper extracts and returns the handler callback for direct invocation.
 */
function getExportHandler(): (...args: any[]) => Promise<any> {
  const call = mockIpcHandle.mock.calls.find(
    ([channel]: [string]) => channel === "export-divination-cards-csv",
  );
  if (!call) {
    throw new Error(
      'ipcMain.handle was not called with "export-divination-cards-csv"',
    );
  }
  return call[1];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CsvService", () => {
  let _service: CsvService;
  let exportHandler: (...args: any[]) => Promise<any>;

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
    mockSettingsGet.mockReset();
    mockSettingsSet.mockReset();

    // Default: main window available
    mockGetAllWindows.mockReturnValue([mockMainWindow]);

    // Default: active game is poe1
    mockSettingsGet.mockResolvedValue("poe1");

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
    // @ts-expect-error accessing private static for testing
    CsvService._instance = undefined;

    _service = CsvService.getInstance();
    exportHandler = getExportHandler();
  });

  afterEach(() => {
    // @ts-expect-error accessing private static for testing
    CsvService._instance = undefined;
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
    it("should register the export-divination-cards-csv handler", () => {
      expect(mockIpcHandle).toHaveBeenCalledWith(
        "export-divination-cards-csv",
        expect.any(Function),
      );
    });
  });

  // ─── Successful Export ──────────────────────────────────────────────────

  describe("export-divination-cards-csv handler — success path", () => {
    it("should fetch the active game from settings", async () => {
      await exportHandler();

      expect(mockSettingsGet).toHaveBeenCalledWith("selectedGame");
    });

    it("should fetch all-time stats for the active game", async () => {
      mockSettingsGet.mockResolvedValue("poe2");

      await exportHandler();

      expect(mockGetAllTimeStats).toHaveBeenCalledWith("poe2");
    });

    it("should show a save dialog with correct default path", async () => {
      mockSettingsGet.mockResolvedValue("poe1");

      await exportHandler();

      expect(mockShowSaveDialog).toHaveBeenCalledWith(
        mockMainWindow,
        expect.objectContaining({
          title: expect.stringContaining("POE1"),
          defaultPath: expect.stringMatching(
            /^poe1-cards-\d{4}-\d{2}-\d{2}\.csv$/,
          ),
          filters: [{ name: "CSV Files", extensions: ["csv"] }],
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

      await exportHandler();

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

    it("should return success with the file path", async () => {
      const result = await exportHandler();

      expect(result).toEqual({
        success: true,
        filePath: "/tmp/poe1-cards-2025-01-15.csv",
      });
    });

    it("should handle cards with commas in name by quoting them", async () => {
      mockGetAllTimeStats.mockResolvedValue({
        totalCount: 1,
        cards: {
          'Card, The "Rare" One': { count: 1 },
        },
      });

      await exportHandler();

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

      await exportHandler();

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

      await exportHandler();

      const [, content] = mockWriteFile.mock.calls[0];
      const lines = content.split("\n");
      // header + 50 data lines
      expect(lines.length).toBe(51);
    });
  });

  // ─── Dialog Cancellation ────────────────────────────────────────────────

  describe("export-divination-cards-csv handler — cancellation", () => {
    it("should return canceled result when user cancels the save dialog", async () => {
      mockShowSaveDialog.mockResolvedValue({
        canceled: true,
        filePath: undefined,
      });

      const result = await exportHandler();

      expect(result).toEqual({ success: false, canceled: true });
      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("should return canceled when filePath is empty string", async () => {
      mockShowSaveDialog.mockResolvedValue({
        canceled: false,
        filePath: "",
      });

      const result = await exportHandler();

      expect(result).toEqual({ success: false, canceled: true });
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  // ─── Error Handling ─────────────────────────────────────────────────────

  describe("export-divination-cards-csv handler — error cases", () => {
    it("should return error when no main window is available", async () => {
      mockGetAllWindows.mockReturnValue([]);

      const result = await exportHandler();

      expect(result).toEqual({
        success: false,
        error: "Main window not available",
      });
    });

    it("should return error when writeFile fails", async () => {
      mockWriteFile.mockRejectedValue(new Error("Permission denied"));

      const result = await exportHandler();

      expect(result).toEqual({
        success: false,
        error: "Permission denied",
      });
    });

    it("should return error when getAllTimeStats throws", async () => {
      mockGetAllTimeStats.mockRejectedValue(new Error("Database error"));

      const result = await exportHandler();

      expect(result).toEqual({
        success: false,
        error: "Database error",
      });
    });

    it("should return error when settings get fails", async () => {
      mockSettingsGet.mockRejectedValue(new Error("Settings unavailable"));

      const result = await exportHandler();

      expect(result).toEqual({
        success: false,
        error: "Settings unavailable",
      });
    });

    it("should return error when showSaveDialog rejects", async () => {
      mockShowSaveDialog.mockRejectedValue(new Error("Dialog error"));

      const result = await exportHandler();

      expect(result).toEqual({
        success: false,
        error: "Dialog error",
      });
    });

    it("should not write file when an error occurs before dialog", async () => {
      mockGetAllTimeStats.mockRejectedValue(new Error("DB failure"));

      await exportHandler();

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

      await exportHandler();

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
      mockSettingsGet.mockResolvedValue("poe2");

      await exportHandler();

      expect(mockShowSaveDialog).toHaveBeenCalledWith(
        mockMainWindow,
        expect.objectContaining({
          title: expect.stringContaining("POE2"),
        }),
      );
    });

    it("should handle null activeGame gracefully in title", async () => {
      mockSettingsGet.mockResolvedValue(null);

      // getAllTimeStats should still be called with null
      mockGetAllTimeStats.mockResolvedValue({
        totalCount: 0,
        cards: {},
      });

      await exportHandler();

      expect(mockShowSaveDialog).toHaveBeenCalledWith(
        mockMainWindow,
        expect.objectContaining({
          title: expect.stringContaining("POE"),
        }),
      );
    });
  });

  // ─── Integration-style ─────────────────────────────────────────────────

  describe("end-to-end export flow", () => {
    it("should complete the full export pipeline correctly", async () => {
      // Setup: poe1 game with specific cards
      mockSettingsGet.mockResolvedValue("poe1");
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

      const result = await exportHandler();

      // 1. Settings were queried
      expect(mockSettingsGet).toHaveBeenCalledTimes(1);

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

      // 5. Success result returned
      expect(result).toEqual({
        success: true,
        filePath: "/home/user/exports/poe1-export.csv",
      });
    });
  });
});
