import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { SettingsStoreRepository } from "../SettingsStore.repository";

describe("SettingsStoreRepository", () => {
  let testDb: TestDatabase;
  let repository: SettingsStoreRepository;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new SettingsStoreRepository(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // ─── getAll ────────────────────────────────────────────────────────────

  describe("getAll", () => {
    it("should return all default settings for a fresh database", async () => {
      const settings = await repository.getAll();

      expect(settings.appExitAction).toBe("exit");
      expect(settings.appOpenAtLogin).toBe(false);
      expect(settings.appOpenAtLoginMinimized).toBe(false);
      expect(settings.onboardingDismissedBeacons).toEqual([]);
      expect(settings.overlayBounds).toBeNull();
      expect(settings.poe1ClientTxtPath).toBeNull();
      expect(settings.poe1SelectedLeague).toBe("Standard");
      expect(settings.poe1PriceSource).toBe("exchange");
      expect(settings.poe2ClientTxtPath).toBeNull();
      expect(settings.poe2SelectedLeague).toBe("Standard");
      expect(settings.poe2PriceSource).toBe("stash");
      expect(settings.selectedGame).toBe("poe1");
      expect(settings.installedGames).toEqual(["poe1"]);
      expect(settings.setupCompleted).toBe(false);
      expect(settings.setupStep).toBe(0);
      expect(settings.setupVersion).toBe(1);
    });

    it("should return boolean types for boolean fields", async () => {
      const settings = await repository.getAll();

      expect(typeof settings.appOpenAtLogin).toBe("boolean");
      expect(typeof settings.appOpenAtLoginMinimized).toBe("boolean");
      expect(typeof settings.setupCompleted).toBe("boolean");
    });

    it("should return array types for array fields", async () => {
      const settings = await repository.getAll();

      expect(Array.isArray(settings.onboardingDismissedBeacons)).toBe(true);
      expect(Array.isArray(settings.installedGames)).toBe(true);
    });
  });

  // ─── get ───────────────────────────────────────────────────────────────

  describe("get", () => {
    it("should return a specific string setting", async () => {
      const value = await repository.get("appExitAction");
      expect(value).toBe("exit");
    });

    it("should return a specific boolean setting", async () => {
      const value = await repository.get("appOpenAtLogin");
      expect(value).toBe(false);
    });

    it("should return a specific null setting", async () => {
      const value = await repository.get("poe1ClientTxtPath");
      expect(value).toBeNull();
    });

    it("should return a specific array setting", async () => {
      const value = await repository.get("installedGames");
      expect(value).toEqual(["poe1"]);
    });

    it("should return a specific number setting", async () => {
      const value = await repository.get("setupVersion");
      expect(value).toBe(1);
    });
  });

  // ─── set ───────────────────────────────────────────────────────────────

  describe("set", () => {
    it("should update a string setting", async () => {
      await repository.set("appExitAction", "minimize");
      const value = await repository.get("appExitAction");
      expect(value).toBe("minimize");
    });

    it("should update a boolean setting to true", async () => {
      await repository.set("appOpenAtLogin", true);
      const value = await repository.get("appOpenAtLogin");
      expect(value).toBe(true);
    });

    it("should update a boolean setting to false", async () => {
      await repository.set("appOpenAtLogin", true);
      await repository.set("appOpenAtLogin", false);
      const value = await repository.get("appOpenAtLogin");
      expect(value).toBe(false);
    });

    it("should update a nullable string setting", async () => {
      await repository.set(
        "poe1ClientTxtPath",
        "C:\\Games\\PoE\\logs\\Client.txt",
      );
      const value = await repository.get("poe1ClientTxtPath");
      expect(value).toBe("C:\\Games\\PoE\\logs\\Client.txt");
    });

    it("should set a nullable string setting back to null", async () => {
      await repository.set("poe1ClientTxtPath", "some/path");
      await repository.set("poe1ClientTxtPath", null);
      const value = await repository.get("poe1ClientTxtPath");
      expect(value).toBeNull();
    });

    it("should update the selected game", async () => {
      await repository.set("selectedGame", "poe2");
      const value = await repository.get("selectedGame");
      expect(value).toBe("poe2");
    });

    it("should update the setup step", async () => {
      await repository.set("setupStep", 2);
      const value = await repository.get("setupStep");
      expect(value).toBe(2);
    });

    it("should update the setup version", async () => {
      await repository.set("setupVersion", 3);
      const value = await repository.get("setupVersion");
      expect(value).toBe(3);
    });

    it("should update the setup completed flag", async () => {
      await repository.set("setupCompleted", true);
      const value = await repository.get("setupCompleted");
      expect(value).toBe(true);
    });

    it("should update the poe1 selected league", async () => {
      await repository.set("poe1SelectedLeague", "Settlers");
      const value = await repository.get("poe1SelectedLeague");
      expect(value).toBe("Settlers");
    });

    it("should update the poe2 selected league", async () => {
      await repository.set("poe2SelectedLeague", "Dawn");
      const value = await repository.get("poe2SelectedLeague");
      expect(value).toBe("Dawn");
    });

    it("should update the poe1 price source", async () => {
      await repository.set("poe1PriceSource", "stash");
      const value = await repository.get("poe1PriceSource");
      expect(value).toBe("stash");
    });

    it("should update the poe2 price source", async () => {
      await repository.set("poe2PriceSource", "exchange");
      const value = await repository.get("poe2PriceSource");
      expect(value).toBe("exchange");
    });
  });

  // ─── JSON Serialization ────────────────────────────────────────────────

  describe("JSON serialization", () => {
    it("should serialize and deserialize overlayBounds", async () => {
      const bounds = { x: 100, y: 200, width: 800, height: 600 };
      await repository.set("overlayBounds", bounds);

      const settings = await repository.getAll();
      expect(settings.overlayBounds).toEqual(bounds);
    });

    it("should handle null overlayBounds", async () => {
      await repository.set("overlayBounds", {
        x: 50,
        y: 50,
        width: 400,
        height: 300,
      });
      await repository.set("overlayBounds", null);

      const settings = await repository.getAll();
      expect(settings.overlayBounds).toBeNull();
    });

    it("should serialize and deserialize installedGames array", async () => {
      await repository.set("installedGames", ["poe1", "poe2"]);
      const value = await repository.get("installedGames");
      expect(value).toEqual(["poe1", "poe2"]);
    });

    it("should handle single game in installedGames", async () => {
      await repository.set("installedGames", ["poe2"]);
      const value = await repository.get("installedGames");
      expect(value).toEqual(["poe2"]);
    });

    it("should serialize and deserialize onboardingDismissedBeacons", async () => {
      await repository.set("onboardingDismissedBeacons", [
        "beacon-1",
        "beacon-2",
        "beacon-3",
      ]);
      const value = await repository.get("onboardingDismissedBeacons");
      expect(value).toEqual(["beacon-1", "beacon-2", "beacon-3"]);
    });

    it("should handle empty onboardingDismissedBeacons array", async () => {
      await repository.set("onboardingDismissedBeacons", ["some-beacon"]);
      await repository.set("onboardingDismissedBeacons", []);
      const value = await repository.get("onboardingDismissedBeacons");
      expect(value).toEqual([]);
    });

    it("should preserve overlayBounds values precisely", async () => {
      const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
      await repository.set("overlayBounds", bounds);

      const settings = await repository.getAll();
      expect(settings.overlayBounds).not.toBeNull();
      expect(settings.overlayBounds!.x).toBe(0);
      expect(settings.overlayBounds!.y).toBe(0);
      expect(settings.overlayBounds!.width).toBe(1920);
      expect(settings.overlayBounds!.height).toBe(1080);
    });
  });

  // ─── setMultiple ───────────────────────────────────────────────────────

  describe("setMultiple", () => {
    it("should update multiple settings at once", async () => {
      await repository.setMultiple({
        appExitAction: "minimize",
        appOpenAtLogin: true,
        selectedGame: "poe2",
      });

      const settings = await repository.getAll();
      expect(settings.appExitAction).toBe("minimize");
      expect(settings.appOpenAtLogin).toBe(true);
      expect(settings.selectedGame).toBe("poe2");
    });

    it("should not affect other settings when updating a subset", async () => {
      await repository.setMultiple({
        appExitAction: "minimize",
      });

      const settings = await repository.getAll();
      // Updated
      expect(settings.appExitAction).toBe("minimize");
      // Unchanged defaults
      expect(settings.appOpenAtLogin).toBe(false);
      expect(settings.selectedGame).toBe("poe1");
      expect(settings.poe1SelectedLeague).toBe("Standard");
    });

    it("should handle boolean conversion in setMultiple", async () => {
      await repository.setMultiple({
        appOpenAtLogin: true,
        appOpenAtLoginMinimized: true,
        setupCompleted: true,
      });

      const settings = await repository.getAll();
      expect(settings.appOpenAtLogin).toBe(true);
      expect(settings.appOpenAtLoginMinimized).toBe(true);
      expect(settings.setupCompleted).toBe(true);
    });

    it("should handle an empty update object without error", async () => {
      await repository.setMultiple({});
      const settings = await repository.getAll();
      expect(settings.appExitAction).toBe("exit");
    });

    it("should update game-specific settings together", async () => {
      await repository.setMultiple({
        poe1SelectedLeague: "Settlers",
        poe1PriceSource: "stash",
        poe1ClientTxtPath: "C:\\PoE\\Client.txt",
      });

      const settings = await repository.getAll();
      expect(settings.poe1SelectedLeague).toBe("Settlers");
      expect(settings.poe1PriceSource).toBe("stash");
      expect(settings.poe1ClientTxtPath).toBe("C:\\PoE\\Client.txt");
    });

    it("should update setup-related settings together", async () => {
      await repository.setMultiple({
        setupCompleted: true,
        setupStep: 3,
        setupVersion: 2,
      });

      const settings = await repository.getAll();
      expect(settings.setupCompleted).toBe(true);
      expect(settings.setupStep).toBe(3);
      expect(settings.setupVersion).toBe(2);
    });
  });

  // ─── Convenience Getters / Setters ─────────────────────────────────────

  describe("convenience getters and setters", () => {
    // ─── App Exit Action ─────────────────────────────────────────────

    it("should get default app exit action", async () => {
      const value = await repository.getAppExitAction();
      expect(value).toBe("exit");
    });

    it("should set and get app exit action to minimize", async () => {
      await repository.setAppExitAction("minimize");
      const value = await repository.getAppExitAction();
      expect(value).toBe("minimize");
    });

    it("should set and get app exit action back to exit", async () => {
      await repository.setAppExitAction("minimize");
      await repository.setAppExitAction("exit");
      const value = await repository.getAppExitAction();
      expect(value).toBe("exit");
    });

    // ─── App Open At Login ───────────────────────────────────────────

    it("should get default app open at login", async () => {
      const value = await repository.getAppOpenAtLogin();
      expect(value).toBe(false);
    });

    it("should set app open at login to true", async () => {
      await repository.setAppOpenAtLogin(true);
      const value = await repository.getAppOpenAtLogin();
      expect(value).toBe(true);
    });

    it("should toggle app open at login back to false", async () => {
      await repository.setAppOpenAtLogin(true);
      await repository.setAppOpenAtLogin(false);
      const value = await repository.getAppOpenAtLogin();
      expect(value).toBe(false);
    });

    // ─── App Open At Login Minimized ─────────────────────────────────

    it("should get default app open at login minimized", async () => {
      const value = await repository.getAppOpenAtLoginMinimized();
      expect(value).toBe(false);
    });

    it("should set app open at login minimized to true", async () => {
      await repository.setAppOpenAtLoginMinimized(true);
      const value = await repository.getAppOpenAtLoginMinimized();
      expect(value).toBe(true);
    });

    // ─── PoE1 Client Txt Path ────────────────────────────────────────

    it("should get default poe1 client txt path as null", async () => {
      const value = await repository.getPoe1ClientTxtPath();
      expect(value).toBeNull();
    });

    it("should set and get poe1 client txt path", async () => {
      await repository.setPoe1ClientTxtPath("C:\\Games\\PoE\\logs\\Client.txt");
      const value = await repository.getPoe1ClientTxtPath();
      expect(value).toBe("C:\\Games\\PoE\\logs\\Client.txt");
    });

    it("should clear poe1 client txt path back to null", async () => {
      await repository.setPoe1ClientTxtPath("some/path");
      await repository.setPoe1ClientTxtPath(null);
      const value = await repository.getPoe1ClientTxtPath();
      expect(value).toBeNull();
    });

    // ─── PoE2 Client Txt Path ────────────────────────────────────────

    it("should get default poe2 client txt path as null", async () => {
      const value = await repository.getPoe2ClientTxtPath();
      expect(value).toBeNull();
    });

    it("should set and get poe2 client txt path", async () => {
      await repository.setPoe2ClientTxtPath("D:\\PoE2\\logs\\Client.txt");
      const value = await repository.getPoe2ClientTxtPath();
      expect(value).toBe("D:\\PoE2\\logs\\Client.txt");
    });

    // ─── Selected Game ───────────────────────────────────────────────

    it("should get default selected game as poe1", async () => {
      const value = await repository.getSelectedGame();
      expect(value).toBe("poe1");
    });

    it("should set selected game to poe2", async () => {
      await repository.setSelectedGame("poe2");
      const value = await repository.getSelectedGame();
      expect(value).toBe("poe2");
    });

    it("should set selected game back to poe1", async () => {
      await repository.setSelectedGame("poe2");
      await repository.setSelectedGame("poe1");
      const value = await repository.getSelectedGame();
      expect(value).toBe("poe1");
    });

    // ─── Installed Games ─────────────────────────────────────────────

    it("should get default installed games", async () => {
      const value = await repository.getInstalledGames();
      expect(value).toEqual(["poe1"]);
    });

    it("should set installed games to both", async () => {
      await repository.setInstalledGames(["poe1", "poe2"]);
      const value = await repository.getInstalledGames();
      expect(value).toEqual(["poe1", "poe2"]);
    });

    it("should set installed games to only poe2", async () => {
      await repository.setInstalledGames(["poe2"]);
      const value = await repository.getInstalledGames();
      expect(value).toEqual(["poe2"]);
    });

    // ─── PoE1 Selected League ────────────────────────────────────────

    it("should get default poe1 selected league", async () => {
      const value = await repository.getPoe1SelectedLeague();
      expect(value).toBe("Standard");
    });

    it("should set poe1 selected league", async () => {
      await repository.setPoe1SelectedLeague("Settlers");
      const value = await repository.getPoe1SelectedLeague();
      expect(value).toBe("Settlers");
    });

    // ─── PoE2 Selected League ────────────────────────────────────────

    it("should get default poe2 selected league", async () => {
      const value = await repository.getPoe2SelectedLeague();
      expect(value).toBe("Standard");
    });

    it("should set poe2 selected league", async () => {
      await repository.setPoe2SelectedLeague("Dawn");
      const value = await repository.getPoe2SelectedLeague();
      expect(value).toBe("Dawn");
    });

    // ─── PoE1 Price Source ───────────────────────────────────────────

    it("should get default poe1 price source as exchange", async () => {
      const value = await repository.getPoe1PriceSource();
      expect(value).toBe("exchange");
    });

    it("should set poe1 price source to stash", async () => {
      await repository.setPoe1PriceSource("stash");
      const value = await repository.getPoe1PriceSource();
      expect(value).toBe("stash");
    });

    it("should set poe1 price source back to exchange", async () => {
      await repository.setPoe1PriceSource("stash");
      await repository.setPoe1PriceSource("exchange");
      const value = await repository.getPoe1PriceSource();
      expect(value).toBe("exchange");
    });

    // ─── PoE2 Price Source ───────────────────────────────────────────

    it("should get default poe2 price source as stash", async () => {
      const value = await repository.getPoe2PriceSource();
      expect(value).toBe("stash");
    });

    it("should set poe2 price source to exchange", async () => {
      await repository.setPoe2PriceSource("exchange");
      const value = await repository.getPoe2PriceSource();
      expect(value).toBe("exchange");
    });

    // ─── Setup Completed ─────────────────────────────────────────────

    it("should get default setup completed as false", async () => {
      const value = await repository.getSetupCompleted();
      expect(value).toBe(false);
    });

    it("should set setup completed to true", async () => {
      await repository.setSetupCompleted(true);
      const value = await repository.getSetupCompleted();
      expect(value).toBe(true);
    });

    // ─── Setup Step ──────────────────────────────────────────────────

    it("should get default setup step as 0", async () => {
      const value = await repository.getSetupStep();
      expect(value).toBe(0);
    });

    it("should set setup step to each valid value", async () => {
      for (const step of [0, 1, 2, 3] as const) {
        await repository.setSetupStep(step);
        const value = await repository.getSetupStep();
        expect(value).toBe(step);
      }
    });

    // ─── Setup Version ───────────────────────────────────────────────

    it("should get default setup version as 1", async () => {
      const value = await repository.getSetupVersion();
      expect(value).toBe(1);
    });

    it("should set setup version", async () => {
      await repository.setSetupVersion(5);
      const value = await repository.getSetupVersion();
      expect(value).toBe(5);
    });
  });

  // ─── Persistence & Consistency ─────────────────────────────────────────

  describe("persistence and consistency", () => {
    it("should persist changes across multiple get calls", async () => {
      await repository.set("appExitAction", "minimize");

      const first = await repository.get("appExitAction");
      const second = await repository.get("appExitAction");
      expect(first).toBe("minimize");
      expect(second).toBe("minimize");
    });

    it("should overwrite previous values on successive set calls", async () => {
      await repository.set("poe1SelectedLeague", "Settlers");
      await repository.set("poe1SelectedLeague", "Crucible");
      await repository.set("poe1SelectedLeague", "Necropolis");

      const value = await repository.get("poe1SelectedLeague");
      expect(value).toBe("Necropolis");
    });

    it("should reflect set changes in getAll", async () => {
      await repository.set("appExitAction", "minimize");
      await repository.set("selectedGame", "poe2");
      await repository.set("setupCompleted", true);

      const settings = await repository.getAll();
      expect(settings.appExitAction).toBe("minimize");
      expect(settings.selectedGame).toBe("poe2");
      expect(settings.setupCompleted).toBe(true);
    });

    it("should reflect setMultiple changes in individual get calls", async () => {
      await repository.setMultiple({
        poe1SelectedLeague: "Settlers",
        poe2SelectedLeague: "Dawn",
        selectedGame: "poe2",
      });

      expect(await repository.getPoe1SelectedLeague()).toBe("Settlers");
      expect(await repository.getPoe2SelectedLeague()).toBe("Dawn");
      expect(await repository.getSelectedGame()).toBe("poe2");
    });

    it("should reflect convenience setter changes in getAll", async () => {
      await repository.setAppExitAction("minimize");
      await repository.setAppOpenAtLogin(true);
      await repository.setSelectedGame("poe2");

      const settings = await repository.getAll();
      expect(settings.appExitAction).toBe("minimize");
      expect(settings.appOpenAtLogin).toBe(true);
      expect(settings.selectedGame).toBe("poe2");
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle paths with special characters", async () => {
      const path =
        "C:\\Users\\Seb's PC\\Games\\Path of Exile\\logs\\Client.txt";
      await repository.setPoe1ClientTxtPath(path);
      const value = await repository.getPoe1ClientTxtPath();
      expect(value).toBe(path);
    });

    it("should handle paths with unicode characters", async () => {
      const path = "C:\\Użytkownicy\\Gry\\PoE\\Client.txt";
      await repository.setPoe1ClientTxtPath(path);
      const value = await repository.getPoe1ClientTxtPath();
      expect(value).toBe(path);
    });

    it("should handle rapid successive updates to the same key", async () => {
      const promises = [];
      for (let i = 0; i <= 3; i++) {
        promises.push(repository.setSetupStep(i as 0 | 1 | 2 | 3));
      }
      await Promise.all(promises);

      const value = await repository.getSetupStep();
      // The value should be one of the valid steps (exact order may vary)
      expect([0, 1, 2, 3]).toContain(value);
    });

    it("should handle overlayBounds with zero dimensions", async () => {
      const bounds = { x: 0, y: 0, width: 0, height: 0 };
      await repository.set("overlayBounds", bounds);
      const settings = await repository.getAll();
      expect(settings.overlayBounds).toEqual(bounds);
    });

    it("should handle overlayBounds with negative position", async () => {
      const bounds = { x: -100, y: -50, width: 800, height: 600 };
      await repository.set("overlayBounds", bounds);
      const settings = await repository.getAll();
      expect(settings.overlayBounds).toEqual(bounds);
    });

    it("should handle a full settings lifecycle", async () => {
      // 1. Fresh defaults
      let settings = await repository.getAll();
      expect(settings.setupCompleted).toBe(false);
      expect(settings.setupStep).toBe(0);

      // 2. Start setup
      await repository.setSetupStep(1);
      settings = await repository.getAll();
      expect(settings.setupStep).toBe(1);

      // 3. Configure game paths
      // NOTE: setMultiple doesn't handle JSON serialization for array/object
      // fields (installedGames, overlayBounds, onboardingDismissedBeacons),
      // so we use individual `set` calls for those.
      await repository.setMultiple({
        poe1ClientTxtPath: "C:\\PoE\\Client.txt",
        poe2ClientTxtPath: "D:\\PoE2\\Client.txt",
      });
      await repository.set("installedGames", ["poe1", "poe2"]);

      // 4. Select league and price source
      await repository.setPoe1SelectedLeague("Settlers");
      await repository.setPoe1PriceSource("stash");

      // 5. Complete setup
      await repository.setMultiple({
        setupCompleted: true,
        setupStep: 3,
      });

      // 6. Configure app preferences
      await repository.setAppExitAction("minimize");
      await repository.setAppOpenAtLogin(true);
      await repository.set("overlayBounds", {
        x: 100,
        y: 100,
        width: 600,
        height: 400,
      });

      // 7. Verify final state
      settings = await repository.getAll();
      expect(settings.setupCompleted).toBe(true);
      expect(settings.setupStep).toBe(3);
      expect(settings.poe1ClientTxtPath).toBe("C:\\PoE\\Client.txt");
      expect(settings.poe2ClientTxtPath).toBe("D:\\PoE2\\Client.txt");
      expect(settings.installedGames).toEqual(["poe1", "poe2"]);
      expect(settings.poe1SelectedLeague).toBe("Settlers");
      expect(settings.poe1PriceSource).toBe("stash");
      expect(settings.appExitAction).toBe("minimize");
      expect(settings.appOpenAtLogin).toBe(true);
      expect(settings.overlayBounds).toEqual({
        x: 100,
        y: 100,
        width: 600,
        height: 400,
      });
      // Defaults unchanged
      expect(settings.poe2SelectedLeague).toBe("Standard");
      expect(settings.poe2PriceSource).toBe("stash");
      expect(settings.selectedGame).toBe("poe1");
    });
  });
});
