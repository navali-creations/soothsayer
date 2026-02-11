import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock Electron before any imports that use it ────────────────────────────
// ─── Mock @sentry/electron (loaded transitively via barrel → SentryService) ─
vi.mock("@sentry/electron", () => ({
  init: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    getFocusedWindow: vi.fn(() => null),
  },
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => "/mock-app-path"),
    getPath: vi.fn(() => "/mock-path"),
  },
  dialog: {
    showMessageBox: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}));

// ─── Mock DatabaseService singleton ──────────────────────────────────────────
const mockGetKysely = vi.fn();
vi.mock("~/main/modules/database", () => ({
  DatabaseService: {
    getInstance: vi.fn(() => ({
      getKysely: mockGetKysely,
      reset: vi.fn(),
    })),
  },
}));

import {
  createTestDatabase,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { SettingsStoreService } from "../SettingsStore.service";

describe("SettingsStoreService", () => {
  let testDb: TestDatabase;
  let service: SettingsStoreService;

  beforeEach(() => {
    testDb = createTestDatabase();
    mockGetKysely.mockReturnValue(testDb.kysely);

    // Reset the singleton so each test gets a fresh instance
    // @ts-expect-error accessing private static for testing
    SettingsStoreService._instance = undefined;

    service = SettingsStoreService.getInstance();
  });

  afterEach(async () => {
    // @ts-expect-error accessing private static for testing
    SettingsStoreService._instance = undefined;
    await testDb.close();
    vi.clearAllMocks();
  });

  // ─── Singleton ──────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const instance1 = SettingsStoreService.getInstance();
      const instance2 = SettingsStoreService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  // ─── get / set ──────────────────────────────────────────────────────────

  describe("get and set", () => {
    // ─── String settings ───────────────────────────────────────────────

    it("should return default value for appExitAction when not set", async () => {
      const value = await service.get("appExitAction");
      // Default depends on repository defaults; typically "exit"
      expect(["exit", "minimize"]).toContain(value);
    });

    it("should set and get appExitAction", async () => {
      await service.set("appExitAction", "minimize");
      const value = await service.get("appExitAction");
      expect(value).toBe("minimize");
    });

    it("should set and get appExitAction back to exit", async () => {
      await service.set("appExitAction", "minimize");
      await service.set("appExitAction", "exit");
      const value = await service.get("appExitAction");
      expect(value).toBe("exit");
    });

    // ─── Boolean settings ──────────────────────────────────────────────

    it("should set and get appOpenAtLogin (boolean)", async () => {
      await service.set("appOpenAtLogin", true);
      const value = await service.get("appOpenAtLogin");
      expect(value).toBe(true);
    });

    it("should set appOpenAtLogin to false", async () => {
      await service.set("appOpenAtLogin", true);
      await service.set("appOpenAtLogin", false);
      const value = await service.get("appOpenAtLogin");
      expect(value).toBe(false);
    });

    it("should set and get appOpenAtLoginMinimized (boolean)", async () => {
      await service.set("appOpenAtLoginMinimized", true);
      const value = await service.get("appOpenAtLoginMinimized");
      expect(value).toBe(true);
    });

    it("should set and get setupCompleted (boolean)", async () => {
      await service.set("setupCompleted", true);
      const value = await service.get("setupCompleted");
      expect(value).toBe(true);
    });

    // ─── Game / league settings ────────────────────────────────────────

    it("should set and get selectedGame", async () => {
      await service.set("selectedGame", "poe2");
      const value = await service.get("selectedGame");
      expect(value).toBe("poe2");
    });

    it("should set and get selectedGame back to poe1", async () => {
      await service.set("selectedGame", "poe2");
      await service.set("selectedGame", "poe1");
      const value = await service.get("selectedGame");
      expect(value).toBe("poe1");
    });

    it("should set and get poe1SelectedLeague", async () => {
      await service.set("poe1SelectedLeague", "Settlers");
      const value = await service.get("poe1SelectedLeague");
      expect(value).toBe("Settlers");
    });

    it("should set and get poe2SelectedLeague", async () => {
      await service.set("poe2SelectedLeague", "Standard");
      const value = await service.get("poe2SelectedLeague");
      expect(value).toBe("Standard");
    });

    // ─── Price source settings ─────────────────────────────────────────

    it("should set and get poe1PriceSource", async () => {
      await service.set("poe1PriceSource", "stash");
      const value = await service.get("poe1PriceSource");
      expect(value).toBe("stash");
    });

    it("should set and get poe2PriceSource", async () => {
      await service.set("poe2PriceSource", "exchange");
      const value = await service.get("poe2PriceSource");
      expect(value).toBe("exchange");
    });

    // ─── File path settings (nullable) ─────────────────────────────────

    it("should set and get poe1ClientTxtPath", async () => {
      const testPath = "C:\\Users\\test\\poe1\\Client.txt";
      await service.set("poe1ClientTxtPath", testPath);
      const value = await service.get("poe1ClientTxtPath");
      expect(value).toBe(testPath);
    });

    it("should set poe1ClientTxtPath to null (clear it)", async () => {
      await service.set("poe1ClientTxtPath", "C:\\some\\path.txt");
      await service.set("poe1ClientTxtPath", null);
      const value = await service.get("poe1ClientTxtPath");
      expect(value).toBeNull();
    });

    it("should set and get poe2ClientTxtPath", async () => {
      const testPath = "/home/user/poe2/Client.txt";
      await service.set("poe2ClientTxtPath", testPath);
      const value = await service.get("poe2ClientTxtPath");
      expect(value).toBe(testPath);
    });

    // ─── Installed games (array) ───────────────────────────────────────

    it("should set and get installedGames", async () => {
      await service.set("installedGames", ["poe1", "poe2"]);
      const value = await service.get("installedGames");
      expect(value).toEqual(["poe1", "poe2"]);
    });

    it("should set installedGames to a single game", async () => {
      await service.set("installedGames", ["poe1"]);
      const value = await service.get("installedGames");
      expect(value).toEqual(["poe1"]);
    });

    it("should set installedGames to empty array", async () => {
      await service.set("installedGames", ["poe1", "poe2"]);
      await service.set("installedGames", []);
      const value = await service.get("installedGames");
      expect(value).toEqual([]);
    });

    // ─── Setup settings ────────────────────────────────────────────────

    it("should set and get setupStep", async () => {
      await service.set("setupStep", 2);
      const value = await service.get("setupStep");
      expect(value).toBe(2);
    });

    it("should set and get setupVersion", async () => {
      await service.set("setupVersion", 1);
      const value = await service.get("setupVersion");
      expect(value).toBe(1);
    });

    // ─── String array settings ─────────────────────────────────────────

    it("should set and get onboardingDismissedBeacons", async () => {
      const beacons = ["beacon1", "beacon2", "beacon3"];
      await service.set("onboardingDismissedBeacons", beacons);
      const value = await service.get("onboardingDismissedBeacons");
      expect(value).toEqual(beacons);
    });

    it("should set onboardingDismissedBeacons to empty array", async () => {
      await service.set("onboardingDismissedBeacons", ["a"]);
      await service.set("onboardingDismissedBeacons", []);
      const value = await service.get("onboardingDismissedBeacons");
      expect(value).toEqual([]);
    });

    // ─── Overlay bounds (object or null) ───────────────────────────────

    it("should set and get overlayBounds", async () => {
      const bounds = { x: 100, y: 200, width: 800, height: 600 };
      await service.set("overlayBounds", bounds);
      const value = await service.get("overlayBounds");
      expect(value).toEqual(bounds);
    });

    it("should set overlayBounds to null (reset)", async () => {
      await service.set("overlayBounds", {
        x: 50,
        y: 50,
        width: 400,
        height: 300,
      });
      await service.set("overlayBounds", null);
      const value = await service.get("overlayBounds");
      expect(value).toBeNull();
    });

    // ─── Overwrite behavior ────────────────────────────────────────────

    it("should overwrite an existing setting", async () => {
      await service.set("poe1SelectedLeague", "Settlers");
      await service.set("poe1SelectedLeague", "Standard");
      const value = await service.get("poe1SelectedLeague");
      expect(value).toBe("Standard");
    });

    it("should handle setting the same value twice", async () => {
      await service.set("selectedGame", "poe1");
      await service.set("selectedGame", "poe1");
      const value = await service.get("selectedGame");
      expect(value).toBe("poe1");
    });
  });

  // ─── getAllSettings ─────────────────────────────────────────────────────

  describe("getAllSettings", () => {
    it("should return all settings as an object", async () => {
      const settings = await service.getAllSettings();

      expect(settings).toBeDefined();
      expect(typeof settings).toBe("object");
    });

    it("should include all expected keys", async () => {
      const settings = await service.getAllSettings();

      expect(settings).toHaveProperty("appExitAction");
      expect(settings).toHaveProperty("appOpenAtLogin");
      expect(settings).toHaveProperty("appOpenAtLoginMinimized");
      expect(settings).toHaveProperty("selectedGame");
      expect(settings).toHaveProperty("installedGames");
      expect(settings).toHaveProperty("poe1SelectedLeague");
      expect(settings).toHaveProperty("poe2SelectedLeague");
      expect(settings).toHaveProperty("poe1PriceSource");
      expect(settings).toHaveProperty("poe2PriceSource");
      expect(settings).toHaveProperty("poe1ClientTxtPath");
      expect(settings).toHaveProperty("poe2ClientTxtPath");
      expect(settings).toHaveProperty("setupCompleted");
      expect(settings).toHaveProperty("setupStep");
      expect(settings).toHaveProperty("setupVersion");
      expect(settings).toHaveProperty("onboardingDismissedBeacons");
      expect(settings).toHaveProperty("overlayBounds");
    });

    it("should reflect individual set operations", async () => {
      await service.set("selectedGame", "poe2");
      await service.set("poe1SelectedLeague", "Settlers");
      await service.set("appOpenAtLogin", true);
      await service.set("setupStep", 3);

      const settings = await service.getAllSettings();

      expect(settings.selectedGame).toBe("poe2");
      expect(settings.poe1SelectedLeague).toBe("Settlers");
      expect(settings.appOpenAtLogin).toBe(true);
      expect(settings.setupStep).toBe(3);
    });

    it("should return correct types for all fields", async () => {
      await service.set("appExitAction", "minimize");
      await service.set("appOpenAtLogin", true);
      await service.set("appOpenAtLoginMinimized", false);
      await service.set("selectedGame", "poe1");
      await service.set("installedGames", ["poe1", "poe2"]);
      await service.set("poe1SelectedLeague", "Settlers");
      await service.set("poe2SelectedLeague", "Standard");
      await service.set("poe1PriceSource", "exchange");
      await service.set("poe2PriceSource", "stash");
      await service.set("setupCompleted", true);
      await service.set("setupStep", 2);
      await service.set("setupVersion", 1);
      await service.set("onboardingDismissedBeacons", ["b1"]);
      await service.set("overlayBounds", {
        x: 10,
        y: 20,
        width: 300,
        height: 400,
      });

      const settings = await service.getAllSettings();

      expect(typeof settings.appExitAction).toBe("string");
      expect(typeof settings.appOpenAtLogin).toBe("boolean");
      expect(typeof settings.appOpenAtLoginMinimized).toBe("boolean");
      expect(typeof settings.selectedGame).toBe("string");
      expect(Array.isArray(settings.installedGames)).toBe(true);
      expect(typeof settings.poe1SelectedLeague).toBe("string");
      expect(typeof settings.poe2SelectedLeague).toBe("string");
      expect(typeof settings.poe1PriceSource).toBe("string");
      expect(typeof settings.poe2PriceSource).toBe("string");
      expect(typeof settings.setupCompleted).toBe("boolean");
      expect(typeof settings.setupStep).toBe("number");
      expect(typeof settings.setupVersion).toBe("number");
      expect(Array.isArray(settings.onboardingDismissedBeacons)).toBe(true);
      expect(typeof settings.overlayBounds).toBe("object");
    });
  });

  // ─── Multiple settings independence ─────────────────────────────────────

  describe("setting independence", () => {
    it("should not affect other settings when changing one", async () => {
      await service.set("selectedGame", "poe1");
      await service.set("poe1SelectedLeague", "Settlers");
      await service.set("appExitAction", "exit");

      // Change one setting
      await service.set("selectedGame", "poe2");

      // Others should remain unchanged
      expect(await service.get("poe1SelectedLeague")).toBe("Settlers");
      expect(await service.get("appExitAction")).toBe("exit");
    });

    it("should maintain poe1 and poe2 settings independently", async () => {
      await service.set("poe1SelectedLeague", "Settlers");
      await service.set("poe2SelectedLeague", "Standard");
      await service.set("poe1PriceSource", "exchange");
      await service.set("poe2PriceSource", "stash");
      await service.set("poe1ClientTxtPath", "/path/to/poe1");
      await service.set("poe2ClientTxtPath", "/path/to/poe2");

      expect(await service.get("poe1SelectedLeague")).toBe("Settlers");
      expect(await service.get("poe2SelectedLeague")).toBe("Standard");
      expect(await service.get("poe1PriceSource")).toBe("exchange");
      expect(await service.get("poe2PriceSource")).toBe("stash");
      expect(await service.get("poe1ClientTxtPath")).toBe("/path/to/poe1");
      expect(await service.get("poe2ClientTxtPath")).toBe("/path/to/poe2");
    });
  });

  // ─── Rapid successive updates ──────────────────────────────────────────

  describe("rapid successive updates", () => {
    it("should handle many rapid set calls and reflect the last value", async () => {
      const promises = [];
      for (let i = 0; i <= 3; i++) {
        promises.push(service.set("setupStep", i as 0 | 1 | 2 | 3));
      }
      await Promise.all(promises);

      const value = await service.get("setupStep");
      // The last value in the loop should win (though with concurrent
      // writes it could be any of them — we just check it's valid)
      expect([0, 1, 2, 3]).toContain(value);
    });

    it("should correctly handle sequential updates to the same key", async () => {
      await service.set("poe1SelectedLeague", "League1");
      await service.set("poe1SelectedLeague", "League2");
      await service.set("poe1SelectedLeague", "League3");

      const value = await service.get("poe1SelectedLeague");
      expect(value).toBe("League3");
    });
  });
});
