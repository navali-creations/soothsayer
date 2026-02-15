import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const {
  mockIpcHandle,
  mockGetKysely,
  mockDatabaseReset,
  mockShowMessageBox,
  mockGetFocusedWindow,
  mockClientLogReaderSetClientLogPath,
  mockClientLogReaderGetInstance,
  mockRepositoryGetPoe1ClientTxtPath,
  mockRepositorySetPoe1ClientTxtPath,
  mockRepositoryGetPoe2ClientTxtPath,
  mockRepositorySetPoe2ClientTxtPath,
  mockRepositoryGetAppExitAction,
  mockRepositorySetAppExitAction,
  mockRepositoryGetAppOpenAtLogin,
  mockRepositorySetAppOpenAtLogin,
  mockRepositoryGetAppOpenAtLoginMinimized,
  mockRepositorySetAppOpenAtLoginMinimized,
  mockRepositoryGetSelectedGame,
  mockRepositorySetSelectedGame,
  mockRepositoryGetInstalledGames,
  mockRepositorySetInstalledGames,
  mockRepositoryGetPoe1SelectedLeague,
  mockRepositorySetPoe1SelectedLeague,
  mockRepositoryGetPoe2SelectedLeague,
  mockRepositorySetPoe2SelectedLeague,
  mockRepositoryGetPoe1PriceSource,
  mockRepositorySetPoe1PriceSource,
  mockRepositoryGetPoe2PriceSource,
  mockRepositorySetPoe2PriceSource,
  mockRepositoryGet,
  mockRepositorySet,
  mockRepositoryGetAll,
} = vi.hoisted(() => {
  const mockClientLogReaderSetClientLogPath = vi.fn();
  const mockClientLogReaderGetInstance = vi.fn().mockResolvedValue({
    setClientLogPath: mockClientLogReaderSetClientLogPath,
  });
  return {
    mockIpcHandle: vi.fn(),
    mockGetKysely: vi.fn(),
    mockDatabaseReset: vi.fn(),
    mockShowMessageBox: vi.fn(),
    mockGetFocusedWindow: vi.fn(() => null),
    mockClientLogReaderSetClientLogPath,
    mockClientLogReaderGetInstance,
    mockRepositoryGetPoe1ClientTxtPath: vi.fn().mockResolvedValue(null),
    mockRepositorySetPoe1ClientTxtPath: vi.fn().mockResolvedValue(undefined),
    mockRepositoryGetPoe2ClientTxtPath: vi.fn().mockResolvedValue(null),
    mockRepositorySetPoe2ClientTxtPath: vi.fn().mockResolvedValue(undefined),
    mockRepositoryGetAppExitAction: vi.fn().mockResolvedValue("exit"),
    mockRepositorySetAppExitAction: vi.fn().mockResolvedValue(undefined),
    mockRepositoryGetAppOpenAtLogin: vi.fn().mockResolvedValue(false),
    mockRepositorySetAppOpenAtLogin: vi.fn().mockResolvedValue(undefined),
    mockRepositoryGetAppOpenAtLoginMinimized: vi.fn().mockResolvedValue(false),
    mockRepositorySetAppOpenAtLoginMinimized: vi
      .fn()
      .mockResolvedValue(undefined),
    mockRepositoryGetSelectedGame: vi.fn().mockResolvedValue("poe1"),
    mockRepositorySetSelectedGame: vi.fn().mockResolvedValue(undefined),
    mockRepositoryGetInstalledGames: vi.fn().mockResolvedValue(["poe1"]),
    mockRepositorySetInstalledGames: vi.fn().mockResolvedValue(undefined),
    mockRepositoryGetPoe1SelectedLeague: vi.fn().mockResolvedValue(""),
    mockRepositorySetPoe1SelectedLeague: vi.fn().mockResolvedValue(undefined),
    mockRepositoryGetPoe2SelectedLeague: vi.fn().mockResolvedValue(""),
    mockRepositorySetPoe2SelectedLeague: vi.fn().mockResolvedValue(undefined),
    mockRepositoryGetPoe1PriceSource: vi.fn().mockResolvedValue("exchange"),
    mockRepositorySetPoe1PriceSource: vi.fn().mockResolvedValue(undefined),
    mockRepositoryGetPoe2PriceSource: vi.fn().mockResolvedValue("exchange"),
    mockRepositorySetPoe2PriceSource: vi.fn().mockResolvedValue(undefined),
    mockRepositoryGet: vi.fn().mockResolvedValue(null),
    mockRepositorySet: vi.fn().mockResolvedValue(undefined),
    mockRepositoryGetAll: vi.fn().mockResolvedValue({
      appExitAction: "exit",
      appOpenAtLogin: false,
      appOpenAtLoginMinimized: false,
      onboardingDismissedBeacons: [],
      overlayBounds: null,
      poe1ClientTxtPath: null,
      poe1SelectedLeague: "",
      poe1PriceSource: "exchange",
      poe2ClientTxtPath: null,
      poe2SelectedLeague: "",
      poe2PriceSource: "exchange",
      selectedGame: "poe1",
      installedGames: ["poe1"],
      setupCompleted: false,
      setupStep: 0,
      setupVersion: 0,
      audioEnabled: true,
      audioVolume: 0.5,
      audioRarity1Path: null,
      audioRarity2Path: null,
      audioRarity3Path: null,
    }),
  };
});

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    getFocusedWindow: mockGetFocusedWindow,
  },
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => "/mock-app-path"),
    getPath: vi.fn(() => "/mock-path"),
  },
  dialog: {
    showMessageBox: mockShowMessageBox,
    showSaveDialog: vi.fn(),
  },
}));

// ─── Mock ClientLogReaderService ─────────────────────────────────────────────
vi.mock("~/main/modules/client-log-reader", () => ({
  ClientLogReaderService: {
    getInstance: mockClientLogReaderGetInstance,
  },
}));

// ─── Mock DatabaseService ────────────────────────────────────────────────────
vi.mock("~/main/modules/database", () => ({
  DatabaseService: {
    getInstance: vi.fn(() => ({
      getKysely: mockGetKysely,
      reset: mockDatabaseReset,
    })),
  },
}));

// ─── Mock SettingsStoreRepository ────────────────────────────────────────────
vi.mock("../SettingsStore.repository", () => ({
  SettingsStoreRepository: class MockSettingsStoreRepository {
    get = mockRepositoryGet;
    set = mockRepositorySet;
    getAll = mockRepositoryGetAll;
    getPoe1ClientTxtPath = mockRepositoryGetPoe1ClientTxtPath;
    setPoe1ClientTxtPath = mockRepositorySetPoe1ClientTxtPath;
    getPoe2ClientTxtPath = mockRepositoryGetPoe2ClientTxtPath;
    setPoe2ClientTxtPath = mockRepositorySetPoe2ClientTxtPath;
    getAppExitAction = mockRepositoryGetAppExitAction;
    setAppExitAction = mockRepositorySetAppExitAction;
    getAppOpenAtLogin = mockRepositoryGetAppOpenAtLogin;
    setAppOpenAtLogin = mockRepositorySetAppOpenAtLogin;
    getAppOpenAtLoginMinimized = mockRepositoryGetAppOpenAtLoginMinimized;
    setAppOpenAtLoginMinimized = mockRepositorySetAppOpenAtLoginMinimized;
    getSelectedGame = mockRepositoryGetSelectedGame;
    setSelectedGame = mockRepositorySetSelectedGame;
    getInstalledGames = mockRepositoryGetInstalledGames;
    setInstalledGames = mockRepositorySetInstalledGames;
    getPoe1SelectedLeague = mockRepositoryGetPoe1SelectedLeague;
    setPoe1SelectedLeague = mockRepositorySetPoe1SelectedLeague;
    getPoe2SelectedLeague = mockRepositoryGetPoe2SelectedLeague;
    setPoe2SelectedLeague = mockRepositorySetPoe2SelectedLeague;
    getPoe1PriceSource = mockRepositoryGetPoe1PriceSource;
    setPoe1PriceSource = mockRepositorySetPoe1PriceSource;
    getPoe2PriceSource = mockRepositoryGetPoe2PriceSource;
    setPoe2PriceSource = mockRepositorySetPoe2PriceSource;
  },
}));

// ─── Import under test ──────────────────────────────────────────────────────
import { SettingsStoreService } from "../SettingsStore.service";

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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SettingsStoreService — IPC handlers", () => {
  let _service: SettingsStoreService;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Re-apply default implementations after clearAllMocks
    mockRepositoryGetPoe1ClientTxtPath.mockResolvedValue(null);
    mockRepositoryGetPoe2ClientTxtPath.mockResolvedValue(null);
    mockRepositoryGetAppExitAction.mockResolvedValue("exit");
    mockRepositoryGetAppOpenAtLogin.mockResolvedValue(false);
    mockRepositoryGetAppOpenAtLoginMinimized.mockResolvedValue(false);
    mockRepositoryGetSelectedGame.mockResolvedValue("poe1");
    mockRepositoryGetInstalledGames.mockResolvedValue(["poe1"]);
    mockRepositoryGetPoe1SelectedLeague.mockResolvedValue("");
    mockRepositoryGetPoe2SelectedLeague.mockResolvedValue("");
    mockRepositoryGetPoe1PriceSource.mockResolvedValue("exchange");
    mockRepositoryGetPoe2PriceSource.mockResolvedValue("exchange");
    mockRepositoryGet.mockResolvedValue(null);
    mockRepositorySet.mockResolvedValue(undefined);
    mockGetFocusedWindow.mockReturnValue(null);

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    SettingsStoreService._instance = undefined;

    _service = SettingsStoreService.getInstance();
  });

  afterEach(() => {
    // @ts-expect-error — accessing private static for testing
    SettingsStoreService._instance = undefined;
    vi.restoreAllMocks();
  });

  // ─── IPC handler registration ─────────────────────────────────────────

  describe("IPC handler registration", () => {
    it("should register all expected IPC handlers", () => {
      const registeredChannels = mockIpcHandle.mock.calls.map(
        ([ch]: [string]) => ch,
      );

      const expectedChannels = [
        "settings-store:get-all",
        "settings-store:get",
        "settings-store:set",
        "settings-store:get-poe1-client-path",
        "settings-store:set-poe1-client-path",
        "settings-store:get-poe2-client-path",
        "settings-store:set-poe2-client-path",
        "settings-store:get-app-exit-behavior",
        "settings-store:set-app-exit-behavior",
        "settings-store:get-launch-on-startup",
        "settings-store:set-launch-on-startup",
        "settings-store:get-start-minimized",
        "settings-store:set-start-minimized",
        "settings-store:set-active-game",
        "settings-store:get-active-game",
        "settings-store:get-installed-games",
        "settings-store:set-installed-games",
        "settings-store:get-selected-poe1-league",
        "settings-store:set-selected-poe1-league",
        "settings-store:get-selected-poe2-league",
        "settings-store:set-selected-poe2-league",
        "settings-store:get-selected-poe1-price-source",
        "settings-store:set-selected-poe1-price-source",
        "settings-store:get-selected-poe2-price-source",
        "settings-store:set-selected-poe2-price-source",
        "settings-store:scan-custom-sounds",
        "settings-store:get-custom-sound-data",
        "settings-store:open-custom-sounds-folder",
        "settings-store:reset-database",
      ];

      for (const channel of expectedChannels) {
        expect(registeredChannels).toContain(channel);
      }
    });
  });

  // ─── GetAllSettings handler ───────────────────────────────────────────

  describe("GetAllSettings handler", () => {
    it("should return all settings", async () => {
      const handler = getIpcHandler("settings-store:get-all");
      const result = await handler({});

      expect(mockRepositoryGetAll).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({ appExitAction: "exit" }),
      );
    });
  });

  // ─── GetSetting handler ───────────────────────────────────────────────

  describe("GetSetting handler", () => {
    it("should return a setting value by key", async () => {
      mockRepositoryGet.mockResolvedValue("exit");
      const handler = getIpcHandler("settings-store:get");
      const result = await handler({}, "appExitAction");

      expect(result).toBe("exit");
    });

    it("should return validation error for non-string key", async () => {
      const handler = getIpcHandler("settings-store:get");
      const result = await handler({}, 123);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should return validation error for null key", async () => {
      const handler = getIpcHandler("settings-store:get");
      const result = await handler({}, null);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });
  });

  // ─── SetSetting handler — generic with validation switch ──────────────

  describe("SetSetting handler", () => {
    const handler = () => getIpcHandler("settings-store:set");

    // ── poe1ClientTxtPath ──

    it("should accept a valid file path for poe1ClientTxtPath", async () => {
      const h = handler();
      await h({}, "poe1ClientTxtPath", "C:\\Users\\test\\client.txt");

      expect(mockRepositorySet).toHaveBeenCalledWith(
        "poe1ClientTxtPath",
        "C:\\Users\\test\\client.txt",
      );
      expect(mockClientLogReaderGetInstance).toHaveBeenCalled();
      expect(mockClientLogReaderSetClientLogPath).toHaveBeenCalledWith(
        "C:\\Users\\test\\client.txt",
        "poe1",
      );
    });

    it("should accept null for poe1ClientTxtPath (clear it)", async () => {
      const h = handler();
      await h({}, "poe1ClientTxtPath", null);

      expect(mockRepositorySet).toHaveBeenCalledWith("poe1ClientTxtPath", null);
      // Should NOT notify ClientLogReader when value is null
      expect(mockClientLogReaderSetClientLogPath).not.toHaveBeenCalled();
    });

    it("should reject non-string for poe1ClientTxtPath", async () => {
      const h = handler();
      const result = await h({}, "poe1ClientTxtPath", 123);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject path with null bytes for poe1ClientTxtPath", async () => {
      const h = handler();
      const result = await h({}, "poe1ClientTxtPath", "path\0malicious");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── poe2ClientTxtPath ──

    it("should accept a valid file path for poe2ClientTxtPath and notify ClientLogReader", async () => {
      const h = handler();
      await h({}, "poe2ClientTxtPath", "/home/user/poe2/client.txt");

      expect(mockRepositorySet).toHaveBeenCalledWith(
        "poe2ClientTxtPath",
        "/home/user/poe2/client.txt",
      );
      expect(mockClientLogReaderGetInstance).toHaveBeenCalled();
      expect(mockClientLogReaderSetClientLogPath).toHaveBeenCalledWith(
        "/home/user/poe2/client.txt",
        "poe2",
      );
    });

    it("should accept null for poe2ClientTxtPath", async () => {
      const h = handler();
      await h({}, "poe2ClientTxtPath", null);

      expect(mockRepositorySet).toHaveBeenCalledWith("poe2ClientTxtPath", null);
    });

    // ── appExitAction ──

    it("should accept 'exit' for appExitAction", async () => {
      const h = handler();
      await h({}, "appExitAction", "exit");

      expect(mockRepositorySet).toHaveBeenCalledWith("appExitAction", "exit");
    });

    it("should accept 'minimize' for appExitAction", async () => {
      const h = handler();
      await h({}, "appExitAction", "minimize");

      expect(mockRepositorySet).toHaveBeenCalledWith(
        "appExitAction",
        "minimize",
      );
    });

    it("should reject invalid value for appExitAction", async () => {
      const h = handler();
      const result = await h({}, "appExitAction", "shutdown");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject non-string for appExitAction", async () => {
      const h = handler();
      const result = await h({}, "appExitAction", true);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── Boolean settings ──

    it("should accept true for appOpenAtLogin", async () => {
      const h = handler();
      await h({}, "appOpenAtLogin", true);

      expect(mockRepositorySet).toHaveBeenCalledWith("appOpenAtLogin", true);
    });

    it("should accept false for appOpenAtLogin", async () => {
      const h = handler();
      await h({}, "appOpenAtLogin", false);

      expect(mockRepositorySet).toHaveBeenCalledWith("appOpenAtLogin", false);
    });

    it("should reject non-boolean for appOpenAtLogin", async () => {
      const h = handler();
      const result = await h({}, "appOpenAtLogin", "true");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should accept boolean for appOpenAtLoginMinimized", async () => {
      const h = handler();
      await h({}, "appOpenAtLoginMinimized", true);

      expect(mockRepositorySet).toHaveBeenCalledWith(
        "appOpenAtLoginMinimized",
        true,
      );
    });

    it("should reject non-boolean for appOpenAtLoginMinimized", async () => {
      const h = handler();
      const result = await h({}, "appOpenAtLoginMinimized", 1);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should accept boolean for setupCompleted", async () => {
      const h = handler();
      await h({}, "setupCompleted", true);

      expect(mockRepositorySet).toHaveBeenCalledWith("setupCompleted", true);
    });

    it("should reject non-boolean for setupCompleted", async () => {
      const h = handler();
      const result = await h({}, "setupCompleted", "yes");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── selectedGame ──

    it("should accept 'poe1' for selectedGame", async () => {
      const h = handler();
      await h({}, "selectedGame", "poe1");

      expect(mockRepositorySet).toHaveBeenCalledWith("selectedGame", "poe1");
    });

    it("should accept 'poe2' for selectedGame", async () => {
      const h = handler();
      await h({}, "selectedGame", "poe2");

      expect(mockRepositorySet).toHaveBeenCalledWith("selectedGame", "poe2");
    });

    it("should reject invalid value for selectedGame", async () => {
      const h = handler();
      const result = await h({}, "selectedGame", "poe3");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── installedGames ──

    it("should accept ['poe1', 'poe2'] for installedGames", async () => {
      const h = handler();
      await h({}, "installedGames", ["poe1", "poe2"]);

      expect(mockRepositorySet).toHaveBeenCalledWith("installedGames", [
        "poe1",
        "poe2",
      ]);
    });

    it("should accept ['poe1'] for installedGames", async () => {
      const h = handler();
      await h({}, "installedGames", ["poe1"]);

      expect(mockRepositorySet).toHaveBeenCalledWith("installedGames", [
        "poe1",
      ]);
    });

    it("should accept empty array for installedGames", async () => {
      const h = handler();
      await h({}, "installedGames", []);

      expect(mockRepositorySet).toHaveBeenCalledWith("installedGames", []);
    });

    it("should reject non-array for installedGames", async () => {
      const h = handler();
      const result = await h({}, "installedGames", "poe1");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject array with invalid game for installedGames", async () => {
      const h = handler();
      const result = await h({}, "installedGames", ["poe1", "poe3"]);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject array exceeding max length for installedGames", async () => {
      const h = handler();
      const result = await h({}, "installedGames", ["poe1", "poe2", "poe1"]);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── league strings ──

    it("should accept a string for poe1SelectedLeague", async () => {
      const h = handler();
      await h({}, "poe1SelectedLeague", "Settlers");

      expect(mockRepositorySet).toHaveBeenCalledWith(
        "poe1SelectedLeague",
        "Settlers",
      );
    });

    it("should reject non-string for poe1SelectedLeague", async () => {
      const h = handler();
      const result = await h({}, "poe1SelectedLeague", 42);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should accept a string for poe2SelectedLeague", async () => {
      const h = handler();
      await h({}, "poe2SelectedLeague", "Standard");

      expect(mockRepositorySet).toHaveBeenCalledWith(
        "poe2SelectedLeague",
        "Standard",
      );
    });

    // ── price source ──

    it("should accept 'exchange' for poe1PriceSource", async () => {
      const h = handler();
      await h({}, "poe1PriceSource", "exchange");

      expect(mockRepositorySet).toHaveBeenCalledWith(
        "poe1PriceSource",
        "exchange",
      );
    });

    it("should accept 'stash' for poe1PriceSource", async () => {
      const h = handler();
      await h({}, "poe1PriceSource", "stash");

      expect(mockRepositorySet).toHaveBeenCalledWith(
        "poe1PriceSource",
        "stash",
      );
    });

    it("should reject invalid value for poe1PriceSource", async () => {
      const h = handler();
      const result = await h({}, "poe1PriceSource", "market");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should accept 'exchange' for poe2PriceSource", async () => {
      const h = handler();
      await h({}, "poe2PriceSource", "exchange");

      expect(mockRepositorySet).toHaveBeenCalledWith(
        "poe2PriceSource",
        "exchange",
      );
    });

    it("should reject invalid value for poe2PriceSource", async () => {
      const h = handler();
      const result = await h({}, "poe2PriceSource", "invalid");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── setupStep ──

    it("should accept valid setup step (0)", async () => {
      const h = handler();
      await h({}, "setupStep", 0);

      expect(mockRepositorySet).toHaveBeenCalledWith("setupStep", 0);
    });

    it("should accept valid setup step (3)", async () => {
      const h = handler();
      await h({}, "setupStep", 3);

      expect(mockRepositorySet).toHaveBeenCalledWith("setupStep", 3);
    });

    it("should reject invalid setup step (5)", async () => {
      const h = handler();
      const result = await h({}, "setupStep", 5);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject non-number setup step", async () => {
      const h = handler();
      const result = await h({}, "setupStep", "1");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── setupVersion ──

    it("should accept valid setup version", async () => {
      const h = handler();
      await h({}, "setupVersion", 1);

      expect(mockRepositorySet).toHaveBeenCalledWith("setupVersion", 1);
    });

    it("should accept setup version 0", async () => {
      const h = handler();
      await h({}, "setupVersion", 0);

      expect(mockRepositorySet).toHaveBeenCalledWith("setupVersion", 0);
    });

    it("should reject negative setup version", async () => {
      const h = handler();
      const result = await h({}, "setupVersion", -1);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject setup version above max (1000)", async () => {
      const h = handler();
      const result = await h({}, "setupVersion", 1001);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject non-integer setup version", async () => {
      const h = handler();
      const result = await h({}, "setupVersion", 1.5);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── onboardingDismissedBeacons ──

    it("should accept a string array for onboardingDismissedBeacons", async () => {
      const h = handler();
      await h({}, "onboardingDismissedBeacons", ["beacon1", "beacon2"]);

      expect(mockRepositorySet).toHaveBeenCalledWith(
        "onboardingDismissedBeacons",
        ["beacon1", "beacon2"],
      );
    });

    it("should accept empty array for onboardingDismissedBeacons", async () => {
      const h = handler();
      await h({}, "onboardingDismissedBeacons", []);

      expect(mockRepositorySet).toHaveBeenCalledWith(
        "onboardingDismissedBeacons",
        [],
      );
    });

    it("should reject non-array for onboardingDismissedBeacons", async () => {
      const h = handler();
      const result = await h({}, "onboardingDismissedBeacons", "beacon1");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject array with non-string items for onboardingDismissedBeacons", async () => {
      const h = handler();
      const result = await h({}, "onboardingDismissedBeacons", [123, 456]);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject array exceeding max length (100) for onboardingDismissedBeacons", async () => {
      const h = handler();
      const items = Array.from({ length: 101 }, (_, i) => `beacon${i}`);
      const result = await h({}, "onboardingDismissedBeacons", items);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject items exceeding max item length (256) for onboardingDismissedBeacons", async () => {
      const h = handler();
      const result = await h({}, "onboardingDismissedBeacons", [
        "x".repeat(257),
      ]);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── overlayBounds ──

    it("should accept valid overlayBounds object", async () => {
      const h = handler();
      const bounds = { x: 100, y: 200, width: 800, height: 600 };
      await h({}, "overlayBounds", bounds);

      expect(mockRepositorySet).toHaveBeenCalledWith("overlayBounds", bounds);
    });

    it("should accept null for overlayBounds (reset)", async () => {
      const h = handler();
      await h({}, "overlayBounds", null);

      expect(mockRepositorySet).toHaveBeenCalledWith("overlayBounds", null);
    });

    it("should accept overlayBounds with negative x and y", async () => {
      const h = handler();
      const bounds = { x: -100, y: -200, width: 800, height: 600 };
      await h({}, "overlayBounds", bounds);

      expect(mockRepositorySet).toHaveBeenCalledWith("overlayBounds", bounds);
    });

    it("should reject non-object for overlayBounds", async () => {
      const h = handler();
      const result = await h({}, "overlayBounds", "not-an-object");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject overlayBounds with non-integer x", async () => {
      const h = handler();
      const result = await h({}, "overlayBounds", {
        x: 1.5,
        y: 0,
        width: 100,
        height: 100,
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject overlayBounds with width below min (1)", async () => {
      const h = handler();
      const result = await h({}, "overlayBounds", {
        x: 0,
        y: 0,
        width: 0,
        height: 100,
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject overlayBounds with height below min (1)", async () => {
      const h = handler();
      const result = await h({}, "overlayBounds", {
        x: 0,
        y: 0,
        width: 100,
        height: 0,
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject overlayBounds with x exceeding max (100000)", async () => {
      const h = handler();
      const result = await h({}, "overlayBounds", {
        x: 100_001,
        y: 0,
        width: 100,
        height: 100,
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject overlayBounds with x below min (-100000)", async () => {
      const h = handler();
      const result = await h({}, "overlayBounds", {
        x: -100_001,
        y: 0,
        width: 100,
        height: 100,
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject overlayBounds with missing fields", async () => {
      const h = handler();
      const result = await h({}, "overlayBounds", {
        x: 0,
        y: 0,
        // missing width and height
      });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── undefined value ──

    it("should reject undefined value for any key", async () => {
      const h = handler();
      const result = await h({}, "appExitAction", undefined);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── unknown key ──

    it("should reject unknown setting key", async () => {
      const h = handler();
      const result = await h({}, "unknownKey", "value");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject non-string key", async () => {
      const h = handler();
      const result = await h({}, 123, "value");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });
  });

  // ─── Individual typed getters ─────────────────────────────────────────

  describe("individual typed getter handlers", () => {
    it("GetPoe1ClientPath should return the path", async () => {
      mockRepositoryGetPoe1ClientTxtPath.mockResolvedValue("/path/to/poe1");
      const handler = getIpcHandler("settings-store:get-poe1-client-path");
      const result = await handler({});

      expect(result).toBe("/path/to/poe1");
    });

    it("GetPoe1ClientPath should return null when not set", async () => {
      mockRepositoryGetPoe1ClientTxtPath.mockResolvedValue(null);
      const handler = getIpcHandler("settings-store:get-poe1-client-path");
      const result = await handler({});

      expect(result).toBeNull();
    });

    it("GetPoe2ClientPath should return the path", async () => {
      mockRepositoryGetPoe2ClientTxtPath.mockResolvedValue("/path/to/poe2");
      const handler = getIpcHandler("settings-store:get-poe2-client-path");
      const result = await handler({});

      expect(result).toBe("/path/to/poe2");
    });

    it("GetAppExitBehavior should return the behavior", async () => {
      mockRepositoryGetAppExitAction.mockResolvedValue("minimize");
      const handler = getIpcHandler("settings-store:get-app-exit-behavior");
      const result = await handler({});

      expect(result).toBe("minimize");
    });

    it("GetLaunchOnStartup should return boolean", async () => {
      mockRepositoryGetAppOpenAtLogin.mockResolvedValue(true);
      const handler = getIpcHandler("settings-store:get-launch-on-startup");
      const result = await handler({});

      expect(result).toBe(true);
    });

    it("GetStartMinimized should return boolean", async () => {
      mockRepositoryGetAppOpenAtLoginMinimized.mockResolvedValue(true);
      const handler = getIpcHandler("settings-store:get-start-minimized");
      const result = await handler({});

      expect(result).toBe(true);
    });

    it("GetActiveGame should return the game", async () => {
      mockRepositoryGetSelectedGame.mockResolvedValue("poe2");
      const handler = getIpcHandler("settings-store:get-active-game");
      const result = await handler({});

      expect(result).toBe("poe2");
    });

    it("GetInstalledGames should return the games array", async () => {
      mockRepositoryGetInstalledGames.mockResolvedValue(["poe1", "poe2"]);
      const handler = getIpcHandler("settings-store:get-installed-games");
      const result = await handler({});

      expect(result).toEqual(["poe1", "poe2"]);
    });

    it("GetSelectedPoe1League should return the league", async () => {
      mockRepositoryGetPoe1SelectedLeague.mockResolvedValue("Settlers");
      const handler = getIpcHandler("settings-store:get-selected-poe1-league");
      const result = await handler({});

      expect(result).toBe("Settlers");
    });

    it("GetSelectedPoe2League should return the league", async () => {
      mockRepositoryGetPoe2SelectedLeague.mockResolvedValue("Standard");
      const handler = getIpcHandler("settings-store:get-selected-poe2-league");
      const result = await handler({});

      expect(result).toBe("Standard");
    });

    it("GetSelectedPoe1PriceSource should return the source", async () => {
      mockRepositoryGetPoe1PriceSource.mockResolvedValue("stash");
      const handler = getIpcHandler(
        "settings-store:get-selected-poe1-price-source",
      );
      const result = await handler({});

      expect(result).toBe("stash");
    });

    it("GetSelectedPoe2PriceSource should return the source", async () => {
      mockRepositoryGetPoe2PriceSource.mockResolvedValue("exchange");
      const handler = getIpcHandler(
        "settings-store:get-selected-poe2-price-source",
      );
      const result = await handler({});

      expect(result).toBe("exchange");
    });
  });

  // ─── Individual typed setter handlers ─────────────────────────────────

  describe("individual typed setter handlers", () => {
    // ── SetPoe1ClientPath ──

    it("should set poe1 client path with valid path and notify ClientLogReader", async () => {
      const handler = getIpcHandler("settings-store:set-poe1-client-path");
      await handler({}, "C:\\Program Files\\PoE\\client.txt");

      expect(mockRepositorySetPoe1ClientTxtPath).toHaveBeenCalledWith(
        "C:\\Program Files\\PoE\\client.txt",
      );
      expect(mockClientLogReaderGetInstance).toHaveBeenCalled();
      expect(mockClientLogReaderSetClientLogPath).toHaveBeenCalledWith(
        "C:\\Program Files\\PoE\\client.txt",
        "poe1",
      );
    });

    it("should reject non-string for poe1 client path", async () => {
      const handler = getIpcHandler("settings-store:set-poe1-client-path");
      const result = await handler({}, 123);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject path with null bytes for poe1 client path", async () => {
      const handler = getIpcHandler("settings-store:set-poe1-client-path");
      const result = await handler({}, "path\0injection");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── SetPoe2ClientPath ──

    it("should set poe2 client path with valid path and notify ClientLogReader", async () => {
      const handler = getIpcHandler("settings-store:set-poe2-client-path");
      await handler({}, "/home/user/poe2/client.txt");

      expect(mockRepositorySetPoe2ClientTxtPath).toHaveBeenCalledWith(
        "/home/user/poe2/client.txt",
      );
      expect(mockClientLogReaderGetInstance).toHaveBeenCalled();
      expect(mockClientLogReaderSetClientLogPath).toHaveBeenCalledWith(
        "/home/user/poe2/client.txt",
        "poe2",
      );
    });

    it("should reject non-string for poe2 client path", async () => {
      const handler = getIpcHandler("settings-store:set-poe2-client-path");
      const result = await handler({}, true);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── SetAppExitBehavior ──

    it("should set exit behavior to 'exit'", async () => {
      const handler = getIpcHandler("settings-store:set-app-exit-behavior");
      await handler({}, "exit");

      expect(mockRepositorySetAppExitAction).toHaveBeenCalledWith("exit");
    });

    it("should set exit behavior to 'minimize'", async () => {
      const handler = getIpcHandler("settings-store:set-app-exit-behavior");
      await handler({}, "minimize");

      expect(mockRepositorySetAppExitAction).toHaveBeenCalledWith("minimize");
    });

    it("should reject invalid exit behavior", async () => {
      const handler = getIpcHandler("settings-store:set-app-exit-behavior");
      const result = await handler({}, "close");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject non-string exit behavior", async () => {
      const handler = getIpcHandler("settings-store:set-app-exit-behavior");
      const result = await handler({}, 42);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── SetLaunchOnStartup ──

    it("should set launch on startup to true", async () => {
      const handler = getIpcHandler("settings-store:set-launch-on-startup");
      await handler({}, true);

      expect(mockRepositorySetAppOpenAtLogin).toHaveBeenCalledWith(true);
    });

    it("should set launch on startup to false", async () => {
      const handler = getIpcHandler("settings-store:set-launch-on-startup");
      await handler({}, false);

      expect(mockRepositorySetAppOpenAtLogin).toHaveBeenCalledWith(false);
    });

    it("should reject non-boolean for launch on startup", async () => {
      const handler = getIpcHandler("settings-store:set-launch-on-startup");
      const result = await handler({}, "true");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── SetStartMinimized ──

    it("should set start minimized to true", async () => {
      const handler = getIpcHandler("settings-store:set-start-minimized");
      await handler({}, true);

      expect(mockRepositorySetAppOpenAtLoginMinimized).toHaveBeenCalledWith(
        true,
      );
    });

    it("should reject non-boolean for start minimized", async () => {
      const handler = getIpcHandler("settings-store:set-start-minimized");
      const result = await handler({}, 1);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── SetActiveGame ──

    it("should set active game to 'poe1'", async () => {
      const handler = getIpcHandler("settings-store:set-active-game");
      await handler({}, "poe1");

      expect(mockRepositorySetSelectedGame).toHaveBeenCalledWith("poe1");
    });

    it("should set active game to 'poe2'", async () => {
      const handler = getIpcHandler("settings-store:set-active-game");
      await handler({}, "poe2");

      expect(mockRepositorySetSelectedGame).toHaveBeenCalledWith("poe2");
    });

    it("should reject invalid game type for active game", async () => {
      const handler = getIpcHandler("settings-store:set-active-game");
      const result = await handler({}, "poe3");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── SetInstalledGames ──

    it("should set installed games", async () => {
      const handler = getIpcHandler("settings-store:set-installed-games");
      await handler({}, ["poe1", "poe2"]);

      expect(mockRepositorySetInstalledGames).toHaveBeenCalledWith([
        "poe1",
        "poe2",
      ]);
    });

    it("should reject non-array for installed games", async () => {
      const handler = getIpcHandler("settings-store:set-installed-games");
      const result = await handler({}, "poe1");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should reject array with invalid game for installed games", async () => {
      const handler = getIpcHandler("settings-store:set-installed-games");
      const result = await handler({}, ["poe1", "invalid"]);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── SetSelectedPoe1League ──

    it("should set poe1 league", async () => {
      const handler = getIpcHandler("settings-store:set-selected-poe1-league");
      await handler({}, "Settlers");

      expect(mockRepositorySetPoe1SelectedLeague).toHaveBeenCalledWith(
        "Settlers",
      );
    });

    it("should reject non-string for poe1 league", async () => {
      const handler = getIpcHandler("settings-store:set-selected-poe1-league");
      const result = await handler({}, 42);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── SetSelectedPoe2League ──

    it("should set poe2 league", async () => {
      const handler = getIpcHandler("settings-store:set-selected-poe2-league");
      await handler({}, "Standard");

      expect(mockRepositorySetPoe2SelectedLeague).toHaveBeenCalledWith(
        "Standard",
      );
    });

    it("should reject non-string for poe2 league", async () => {
      const handler = getIpcHandler("settings-store:set-selected-poe2-league");
      const result = await handler({}, null);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── SetSelectedPoe1PriceSource ──

    it("should set poe1 price source to 'exchange'", async () => {
      const handler = getIpcHandler(
        "settings-store:set-selected-poe1-price-source",
      );
      await handler({}, "exchange");

      expect(mockRepositorySetPoe1PriceSource).toHaveBeenCalledWith("exchange");
    });

    it("should set poe1 price source to 'stash'", async () => {
      const handler = getIpcHandler(
        "settings-store:set-selected-poe1-price-source",
      );
      await handler({}, "stash");

      expect(mockRepositorySetPoe1PriceSource).toHaveBeenCalledWith("stash");
    });

    it("should reject invalid poe1 price source", async () => {
      const handler = getIpcHandler(
        "settings-store:set-selected-poe1-price-source",
      );
      const result = await handler({}, "market");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    // ── SetSelectedPoe2PriceSource ──

    it("should set poe2 price source to 'exchange'", async () => {
      const handler = getIpcHandler(
        "settings-store:set-selected-poe2-price-source",
      );
      await handler({}, "exchange");

      expect(mockRepositorySetPoe2PriceSource).toHaveBeenCalledWith("exchange");
    });

    it("should set poe2 price source to 'stash'", async () => {
      const handler = getIpcHandler(
        "settings-store:set-selected-poe2-price-source",
      );
      await handler({}, "stash");

      expect(mockRepositorySetPoe2PriceSource).toHaveBeenCalledWith("stash");
    });

    it("should reject invalid poe2 price source", async () => {
      const handler = getIpcHandler(
        "settings-store:set-selected-poe2-price-source",
      );
      const result = await handler({}, "auction");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });
  });

  // ─── ResetDatabase handler ────────────────────────────────────────────

  describe("ResetDatabase handler", () => {
    it("should call database reset and return success", async () => {
      const handler = getIpcHandler("settings-store:reset-database");
      const result = await handler({});

      expect(mockDatabaseReset).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        requiresRestart: true,
      });
    });

    it("should return error when database reset throws", async () => {
      mockDatabaseReset.mockImplementation(() => {
        throw new Error("Database file locked");
      });

      const handler = getIpcHandler("settings-store:reset-database");
      const result = await handler({});

      expect(result).toEqual({
        success: false,
        error: "Database file locked",
      });
    });
  });

  // ─── Security: validation prevents type confusion ─────────────────────

  describe("security validation", () => {
    it("should not allow a boolean to be set as a string setting", async () => {
      const h = getIpcHandler("settings-store:set");
      const result = await h({}, "poe1SelectedLeague", true);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should not allow a string to be set as a boolean setting", async () => {
      const h = getIpcHandler("settings-store:set");
      const result = await h({}, "appOpenAtLogin", "true");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should not allow a number to be set as a game type", async () => {
      const h = getIpcHandler("settings-store:set");
      const result = await h({}, "selectedGame", 1);

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should not allow injection via file path with null bytes in typed setter", async () => {
      const handler = getIpcHandler("settings-store:set-poe1-client-path");
      const result = await handler({}, "safe/path\0/etc/passwd");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should not allow an excessively long file path in typed setter", async () => {
      const handler = getIpcHandler("settings-store:set-poe1-client-path");
      const result = await handler({}, "x".repeat(4097));

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should accept file path at max length boundary (4096)", async () => {
      const handler = getIpcHandler("settings-store:set-poe1-client-path");
      await handler({}, "x".repeat(4096));

      expect(mockRepositorySetPoe1ClientTxtPath).toHaveBeenCalledWith(
        "x".repeat(4096),
      );
    });

    it("should prevent setting an unknown key through the generic SetSetting handler", async () => {
      const h = getIpcHandler("settings-store:set");
      const result = await h({}, "dangerousKey", "malicious_value");

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
      expect(mockRepositorySet).not.toHaveBeenCalled();
    });

    it("should prevent SQL-like injection in league name (but accept the string)", async () => {
      // SQL injection strings are still valid strings — the validation
      // only checks type, not content (SQL injection is prevented by
      // parameterized queries in the repository)
      const h = getIpcHandler("settings-store:set");
      await h({}, "poe1SelectedLeague", "'; DROP TABLE user_settings;--");

      expect(mockRepositorySet).toHaveBeenCalledWith(
        "poe1SelectedLeague",
        "'; DROP TABLE user_settings;--",
      );
    });
  });
});
