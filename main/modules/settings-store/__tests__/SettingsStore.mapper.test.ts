import { describe, expect, it } from "vitest";

import type { UserSettingsRow } from "~/main/modules/database";

import {
  boolToInt,
  toAppSettingsDTO,
  toDBKey,
  toPoe1SettingsDTO,
  toPoe2SettingsDTO,
  toSetupSettingsDTO,
  toUserSettingsDTO,
} from "../SettingsStore.mapper";

/**
 * Factory to create a realistic UserSettingsRow with sensible defaults.
 * Override any field as needed per test.
 */
function createSettingsRow(
  overrides: Partial<UserSettingsRow> = {},
): UserSettingsRow {
  return {
    id: 1,
    app_exit_action: "exit",
    app_open_at_login: 0,
    app_open_at_login_minimized: 0,
    onboarding_dismissed_beacons: "[]",
    overlay_bounds: null,
    poe1_client_txt_path: null,
    poe1_selected_league: "Standard",
    poe1_price_source: "exchange",
    poe2_client_txt_path: null,
    poe2_selected_league: "Standard",
    poe2_price_source: "exchange",
    selected_game: "poe1",
    installed_games: '["poe1"]',
    setup_completed: 0,
    setup_step: 0,
    setup_version: 1,
    audio_enabled: 1,
    audio_volume: 0.5,
    audio_rarity1_path: null,
    audio_rarity2_path: null,
    audio_rarity3_path: null,
    rarity_source: "poe.ninja",
    selected_filter_id: null,
    last_seen_app_version: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("SettingsStore.mapper", () => {
  // ─── toUserSettingsDTO ───────────────────────────────────────────────

  describe("toUserSettingsDTO", () => {
    it("should map default row values correctly", () => {
      const row = createSettingsRow();
      const dto = toUserSettingsDTO(row);

      expect(dto.appExitAction).toBe("exit");
      expect(dto.appOpenAtLogin).toBe(false);
      expect(dto.appOpenAtLoginMinimized).toBe(false);
      expect(dto.onboardingDismissedBeacons).toEqual([]);
      expect(dto.overlayBounds).toBeNull();
      expect(dto.poe1ClientTxtPath).toBeNull();
      expect(dto.poe1SelectedLeague).toBe("Standard");
      expect(dto.poe1PriceSource).toBe("exchange");
      expect(dto.poe2ClientTxtPath).toBeNull();
      expect(dto.poe2SelectedLeague).toBe("Standard");
      expect(dto.poe2PriceSource).toBe("exchange");
      expect(dto.selectedGame).toBe("poe1");
      expect(dto.installedGames).toEqual(["poe1"]);
      expect(dto.setupCompleted).toBe(false);
      expect(dto.setupStep).toBe(0);
      expect(dto.setupVersion).toBe(1);
    });

    it("should convert SQLite boolean integers to real booleans", () => {
      const row = createSettingsRow({
        app_open_at_login: 1,
        app_open_at_login_minimized: 1,
        setup_completed: 1,
      });
      const dto = toUserSettingsDTO(row);

      expect(dto.appOpenAtLogin).toBe(true);
      expect(dto.appOpenAtLoginMinimized).toBe(true);
      expect(dto.setupCompleted).toBe(true);
    });

    it("should handle falsy SQLite boolean integers as false", () => {
      const row = createSettingsRow({
        app_open_at_login: 0,
        app_open_at_login_minimized: 0,
        setup_completed: 0,
      });
      const dto = toUserSettingsDTO(row);

      expect(dto.appOpenAtLogin).toBe(false);
      expect(dto.appOpenAtLoginMinimized).toBe(false);
      expect(dto.setupCompleted).toBe(false);
    });

    it("should parse onboarding_dismissed_beacons JSON array", () => {
      const row = createSettingsRow({
        onboarding_dismissed_beacons: '["beacon-1","beacon-2","beacon-3"]',
      });
      const dto = toUserSettingsDTO(row);

      expect(dto.onboardingDismissedBeacons).toEqual([
        "beacon-1",
        "beacon-2",
        "beacon-3",
      ]);
    });

    it("should return empty array when onboarding_dismissed_beacons is null", () => {
      const row = createSettingsRow({
        onboarding_dismissed_beacons: null as unknown as string,
      });
      const dto = toUserSettingsDTO(row);

      expect(dto.onboardingDismissedBeacons).toEqual([]);
    });

    it("should parse overlay_bounds JSON when present", () => {
      const bounds = { x: 100, y: 200, width: 800, height: 600 };
      const row = createSettingsRow({
        overlay_bounds: JSON.stringify(bounds),
      });
      const dto = toUserSettingsDTO(row);

      expect(dto.overlayBounds).toEqual(bounds);
    });

    it("should return null overlay_bounds when not set", () => {
      const row = createSettingsRow({ overlay_bounds: null });
      const dto = toUserSettingsDTO(row);

      expect(dto.overlayBounds).toBeNull();
    });

    it("should parse installed_games JSON array", () => {
      const row = createSettingsRow({
        installed_games: '["poe1","poe2"]',
      });
      const dto = toUserSettingsDTO(row);

      expect(dto.installedGames).toEqual(["poe1", "poe2"]);
    });

    it("should handle single game in installed_games", () => {
      const row = createSettingsRow({
        installed_games: '["poe2"]',
      });
      const dto = toUserSettingsDTO(row);

      expect(dto.installedGames).toEqual(["poe2"]);
    });

    it("should return default ['poe1'] when installed_games is null", () => {
      const row = createSettingsRow({
        installed_games: null as unknown as string,
      });
      const dto = toUserSettingsDTO(row);

      expect(dto.installedGames).toEqual(["poe1"]);
    });

    it("should map minimize exit action", () => {
      const row = createSettingsRow({ app_exit_action: "minimize" });
      const dto = toUserSettingsDTO(row);

      expect(dto.appExitAction).toBe("minimize");
    });

    it("should map poe2 as selected game", () => {
      const row = createSettingsRow({ selected_game: "poe2" });
      const dto = toUserSettingsDTO(row);

      expect(dto.selectedGame).toBe("poe2");
    });

    it("should map client txt paths when set", () => {
      const row = createSettingsRow({
        poe1_client_txt_path: "C:\\Games\\PoE\\logs\\Client.txt",
        poe2_client_txt_path: "D:\\PoE2\\logs\\Client.txt",
      });
      const dto = toUserSettingsDTO(row);

      expect(dto.poe1ClientTxtPath).toBe("C:\\Games\\PoE\\logs\\Client.txt");
      expect(dto.poe2ClientTxtPath).toBe("D:\\PoE2\\logs\\Client.txt");
    });

    it("should map all setup step values", () => {
      for (const step of [0, 1, 2, 3] as const) {
        const row = createSettingsRow({ setup_step: step });
        const dto = toUserSettingsDTO(row);
        expect(dto.setupStep).toBe(step);
      }
    });

    it("should map league selections", () => {
      const row = createSettingsRow({
        poe1_selected_league: "Settlers",
        poe2_selected_league: "Dawn",
      });
      const dto = toUserSettingsDTO(row);

      expect(dto.poe1SelectedLeague).toBe("Settlers");
      expect(dto.poe2SelectedLeague).toBe("Dawn");
    });

    it("should map stash price source for poe1", () => {
      const row = createSettingsRow({ poe1_price_source: "stash" });
      const dto = toUserSettingsDTO(row);

      expect(dto.poe1PriceSource).toBe("stash");
    });

    it("should map exchange price source for poe2", () => {
      const row = createSettingsRow({ poe2_price_source: "exchange" });
      const dto = toUserSettingsDTO(row);

      expect(dto.poe2PriceSource).toBe("exchange");
    });

    it("should map a fully populated row", () => {
      const row = createSettingsRow({
        app_exit_action: "minimize",
        app_open_at_login: 1,
        app_open_at_login_minimized: 1,
        onboarding_dismissed_beacons: '["intro","overlay"]',
        overlay_bounds: '{"x":50,"y":50,"width":1200,"height":900}',
        poe1_client_txt_path: "C:\\PoE\\Client.txt",
        poe1_selected_league: "Settlers",
        poe1_price_source: "stash",
        poe2_client_txt_path: "D:\\PoE2\\Client.txt",
        poe2_selected_league: "Dawn",
        poe2_price_source: "exchange",
        selected_game: "poe2",
        installed_games: '["poe1","poe2"]',
        setup_completed: 1,
        setup_step: 3,
        setup_version: 2,
        audio_enabled: 0,
        audio_volume: 0.75,
        audio_rarity1_path: "C:\\sounds\\rarity1.mp3",
        audio_rarity2_path: "C:\\sounds\\rarity2.mp3",
        audio_rarity3_path: null,
      });
      const dto = toUserSettingsDTO(row);

      expect(dto).toEqual({
        appExitAction: "minimize",
        appOpenAtLogin: true,
        appOpenAtLoginMinimized: true,
        onboardingDismissedBeacons: ["intro", "overlay"],
        overlayBounds: { x: 50, y: 50, width: 1200, height: 900 },
        poe1ClientTxtPath: "C:\\PoE\\Client.txt",
        poe1SelectedLeague: "Settlers",
        poe1PriceSource: "stash",
        poe2ClientTxtPath: "D:\\PoE2\\Client.txt",
        poe2SelectedLeague: "Dawn",
        poe2PriceSource: "exchange",
        selectedGame: "poe2",
        installedGames: ["poe1", "poe2"],
        setupCompleted: true,
        setupStep: 3,
        setupVersion: 2,
        audioEnabled: false,
        audioVolume: 0.75,
        audioRarity1Path: "C:\\sounds\\rarity1.mp3",
        audioRarity2Path: "C:\\sounds\\rarity2.mp3",
        audioRarity3Path: null,
        raritySource: "poe.ninja",
        selectedFilterId: null,
        lastSeenAppVersion: null,
      });
    });
  });

  // ─── toAppSettingsDTO ────────────────────────────────────────────────

  describe("toAppSettingsDTO", () => {
    it("should map default app settings", () => {
      const row = createSettingsRow();
      const dto = toAppSettingsDTO(row);

      expect(dto).toEqual({
        exitAction: "exit",
        openAtLogin: false,
        openAtLoginMinimized: false,
      });
    });

    it("should map customized app settings", () => {
      const row = createSettingsRow({
        app_exit_action: "minimize",
        app_open_at_login: 1,
        app_open_at_login_minimized: 1,
      });
      const dto = toAppSettingsDTO(row);

      expect(dto).toEqual({
        exitAction: "minimize",
        openAtLogin: true,
        openAtLoginMinimized: true,
      });
    });

    it("should only include app-related fields", () => {
      const row = createSettingsRow({
        app_exit_action: "minimize",
        poe1_selected_league: "Settlers",
        selected_game: "poe2",
      });
      const dto = toAppSettingsDTO(row);

      expect(Object.keys(dto)).toEqual([
        "exitAction",
        "openAtLogin",
        "openAtLoginMinimized",
      ]);
    });
  });

  // ─── toPoe1SettingsDTO ───────────────────────────────────────────────

  describe("toPoe1SettingsDTO", () => {
    it("should map default PoE1 settings", () => {
      const row = createSettingsRow();
      const dto = toPoe1SettingsDTO(row);

      expect(dto).toEqual({
        clientTxtPath: null,
        selectedLeague: "Standard",
        priceSource: "exchange",
      });
    });

    it("should map customized PoE1 settings", () => {
      const row = createSettingsRow({
        poe1_client_txt_path: "C:\\Games\\PoE\\logs\\Client.txt",
        poe1_selected_league: "Settlers",
        poe1_price_source: "stash",
      });
      const dto = toPoe1SettingsDTO(row);

      expect(dto).toEqual({
        clientTxtPath: "C:\\Games\\PoE\\logs\\Client.txt",
        selectedLeague: "Settlers",
        priceSource: "stash",
      });
    });

    it("should only include PoE1-related fields", () => {
      const row = createSettingsRow();
      const dto = toPoe1SettingsDTO(row);

      expect(Object.keys(dto)).toEqual([
        "clientTxtPath",
        "selectedLeague",
        "priceSource",
      ]);
    });
  });

  // ─── toPoe2SettingsDTO ───────────────────────────────────────────────

  describe("toPoe2SettingsDTO", () => {
    it("should map default PoE2 settings", () => {
      const row = createSettingsRow();
      const dto = toPoe2SettingsDTO(row);

      expect(dto).toEqual({
        clientTxtPath: null,
        selectedLeague: "Standard",
        priceSource: "exchange",
      });
    });

    it("should map customized PoE2 settings", () => {
      const row = createSettingsRow({
        poe2_client_txt_path: "D:\\PoE2\\logs\\Client.txt",
        poe2_selected_league: "Dawn",
        poe2_price_source: "exchange",
      });
      const dto = toPoe2SettingsDTO(row);

      expect(dto).toEqual({
        clientTxtPath: "D:\\PoE2\\logs\\Client.txt",
        selectedLeague: "Dawn",
        priceSource: "exchange",
      });
    });

    it("should only include PoE2-related fields", () => {
      const row = createSettingsRow();
      const dto = toPoe2SettingsDTO(row);

      expect(Object.keys(dto)).toEqual([
        "clientTxtPath",
        "selectedLeague",
        "priceSource",
      ]);
    });
  });

  // ─── toSetupSettingsDTO ──────────────────────────────────────────────

  describe("toSetupSettingsDTO", () => {
    it("should map default setup settings", () => {
      const row = createSettingsRow();
      const dto = toSetupSettingsDTO(row);

      expect(dto).toEqual({
        completed: false,
        step: 0,
        version: 1,
      });
    });

    it("should map completed setup", () => {
      const row = createSettingsRow({
        setup_completed: 1,
        setup_step: 3,
        setup_version: 2,
      });
      const dto = toSetupSettingsDTO(row);

      expect(dto).toEqual({
        completed: true,
        step: 3,
        version: 2,
      });
    });

    it("should map intermediate setup step", () => {
      const row = createSettingsRow({
        setup_completed: 0,
        setup_step: 2,
        setup_version: 1,
      });
      const dto = toSetupSettingsDTO(row);

      expect(dto.completed).toBe(false);
      expect(dto.step).toBe(2);
    });

    it("should only include setup-related fields", () => {
      const row = createSettingsRow();
      const dto = toSetupSettingsDTO(row);

      expect(Object.keys(dto)).toEqual(["completed", "step", "version"]);
    });
  });

  // ─── toDBKey ─────────────────────────────────────────────────────────

  describe("toDBKey", () => {
    it("should map appExitAction to app_exit_action", () => {
      expect(toDBKey("appExitAction")).toBe("app_exit_action");
    });

    it("should map appOpenAtLogin to app_open_at_login", () => {
      expect(toDBKey("appOpenAtLogin")).toBe("app_open_at_login");
    });

    it("should map appOpenAtLoginMinimized to app_open_at_login_minimized", () => {
      expect(toDBKey("appOpenAtLoginMinimized")).toBe(
        "app_open_at_login_minimized",
      );
    });

    it("should map onboardingDismissedBeacons to onboarding_dismissed_beacons", () => {
      expect(toDBKey("onboardingDismissedBeacons")).toBe(
        "onboarding_dismissed_beacons",
      );
    });

    it("should map overlayBounds to overlay_bounds", () => {
      expect(toDBKey("overlayBounds")).toBe("overlay_bounds");
    });

    it("should map poe1ClientTxtPath to poe1_client_txt_path", () => {
      expect(toDBKey("poe1ClientTxtPath")).toBe("poe1_client_txt_path");
    });

    it("should map poe1SelectedLeague to poe1_selected_league", () => {
      expect(toDBKey("poe1SelectedLeague")).toBe("poe1_selected_league");
    });

    it("should map poe1PriceSource to poe1_price_source", () => {
      expect(toDBKey("poe1PriceSource")).toBe("poe1_price_source");
    });

    it("should map poe2ClientTxtPath to poe2_client_txt_path", () => {
      expect(toDBKey("poe2ClientTxtPath")).toBe("poe2_client_txt_path");
    });

    it("should map poe2SelectedLeague to poe2_selected_league", () => {
      expect(toDBKey("poe2SelectedLeague")).toBe("poe2_selected_league");
    });

    it("should map poe2PriceSource to poe2_price_source", () => {
      expect(toDBKey("poe2PriceSource")).toBe("poe2_price_source");
    });

    it("should map selectedGame to selected_game", () => {
      expect(toDBKey("selectedGame")).toBe("selected_game");
    });

    it("should map installedGames to installed_games", () => {
      expect(toDBKey("installedGames")).toBe("installed_games");
    });

    it("should map setupCompleted to setup_completed", () => {
      expect(toDBKey("setupCompleted")).toBe("setup_completed");
    });

    it("should map setupStep to setup_step", () => {
      expect(toDBKey("setupStep")).toBe("setup_step");
    });

    it("should map setupVersion to setup_version", () => {
      expect(toDBKey("setupVersion")).toBe("setup_version");
    });

    it("should have a mapping for every key in UserSettingsDTO", () => {
      const allKeys = [
        "appExitAction",
        "appOpenAtLogin",
        "appOpenAtLoginMinimized",
        "onboardingDismissedBeacons",
        "overlayBounds",
        "poe1ClientTxtPath",
        "poe1SelectedLeague",
        "poe1PriceSource",
        "poe2ClientTxtPath",
        "poe2SelectedLeague",
        "poe2PriceSource",
        "selectedGame",
        "installedGames",
        "setupCompleted",
        "setupStep",
        "setupVersion",
        "audioEnabled",
        "audioVolume",
        "audioRarity1Path",
        "audioRarity2Path",
        "audioRarity3Path",
        "raritySource",
        "selectedFilterId",
        "lastSeenAppVersion",
      ] as const;

      for (const key of allKeys) {
        const dbKey = toDBKey(key);
        expect(dbKey).toBeDefined();
        expect(typeof dbKey).toBe("string");
        expect(dbKey.length).toBeGreaterThan(0);
      }
    });
  });

  // ─── boolToInt ───────────────────────────────────────────────────────

  describe("boolToInt", () => {
    it("should convert true to 1", () => {
      expect(boolToInt(true)).toBe(1);
    });

    it("should convert false to 0", () => {
      expect(boolToInt(false)).toBe(0);
    });

    it("should return a number type", () => {
      expect(typeof boolToInt(true)).toBe("number");
      expect(typeof boolToInt(false)).toBe("number");
    });
  });
});
