import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserSettingsDTO } from "~/main/modules/settings-store/SettingsStore.dto";

import {
  createAppBehaviorCategory,
  createGamePathsCategory,
  handleSelectFile,
} from "../Settings.utils";

// ─── Mocks ─────────────────────────────────────────────────────────────────

// The global setup.ts already mocks ~/renderer/modules/umami with vi.fn() stubs,
// so trackEvent is automatically a no-op spy. We import it here to assert on it.
import { trackEvent } from "~/renderer/modules/umami";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeSettings(
  overrides: Partial<UserSettingsDTO> = {},
): UserSettingsDTO {
  return {
    appExitAction: "exit",
    appOpenAtLogin: false,
    appOpenAtLoginMinimized: false,
    onboardingDismissedBeacons: [],
    overlayBounds: { x: 0, y: 0, width: 400, height: 300 },
    poe1ClientTxtPath: "/path/to/poe1/Client.txt",
    poe1SelectedLeague: "Standard",
    poe1PriceSource: "exchange",
    poe2ClientTxtPath: "/path/to/poe2/Client.txt",
    poe2SelectedLeague: "Standard",
    poe2PriceSource: "exchange",
    selectedGame: "poe1",
    installedGames: ["poe1"],
    setupCompleted: true,
    setupStep: 3,
    setupVersion: 1,
    audioEnabled: true,
    audioVolume: 0.75,
    audioRarity1Path: null,
    audioRarity2Path: null,
    audioRarity3Path: null,
    raritySource: "poe.ninja",
    selectedFilterId: null,
    lastSeenAppVersion: "1.0.0",
    overlayFontSize: 14,
    overlayToolbarFontSize: 12,
    mainWindowBounds: { x: 0, y: 0, width: 1024, height: 768 },
    telemetryCrashReporting: true,
    telemetryUsageAnalytics: true,
    csvExportPath: null,
    ...overrides,
  };
}

function makeUpdateSetting(): <K extends keyof UserSettingsDTO>(
  key: K,
  value: UserSettingsDTO[K],
) => Promise<void> {
  return vi.fn().mockResolvedValue(undefined);
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("Settings.utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // createGamePathsCategory
  // ═══════════════════════════════════════════════════════════════════════

  describe("createGamePathsCategory", () => {
    it('returns the correct title "Game Configuration"', () => {
      const settings = makeSettings();
      const onSelectFile = vi.fn();

      const category = createGamePathsCategory(settings, onSelectFile);

      expect(category.title).toBe("Game Configuration");
    });

    it("returns the correct description", () => {
      const settings = makeSettings();
      const onSelectFile = vi.fn();

      const category = createGamePathsCategory(settings, onSelectFile);

      expect(category.description).toBe(
        "Configure paths to your Path of Exile client logs",
      );
    });

    it("returns 2 file path settings (poe1 and poe2)", () => {
      const settings = makeSettings();
      const onSelectFile = vi.fn();

      const category = createGamePathsCategory(settings, onSelectFile);

      expect(category.settings).toHaveLength(2);
      expect(category.settings[0].key).toBe("poe1ClientTxtPath");
      expect(category.settings[1].key).toBe("poe2ClientTxtPath");
    });

    it("populates the poe1 setting with the correct label and value", () => {
      const settings = makeSettings({
        poe1ClientTxtPath: "/custom/path/poe1/Client.txt",
      });
      const onSelectFile = vi.fn();

      const category = createGamePathsCategory(settings, onSelectFile);
      const poe1 = category.settings[0];

      expect(poe1.label).toBe("Path of Exile 1 Client.txt");
      expect(poe1.value).toBe("/custom/path/poe1/Client.txt");
      expect(poe1.placeholder).toBe("No file selected");
    });

    it("populates the poe2 setting with the correct label and value", () => {
      const settings = makeSettings({
        poe2ClientTxtPath: "/custom/path/poe2/Client.txt",
      });
      const onSelectFile = vi.fn();

      const category = createGamePathsCategory(settings, onSelectFile);
      const poe2 = category.settings[1];

      expect(poe2.label).toBe("Path of Exile 2 Client.txt");
      expect(poe2.value).toBe("/custom/path/poe2/Client.txt");
      expect(poe2.placeholder).toBe("No file selected");
    });

    it("calls onSelectFile with poe1 key and title when poe1 onSelect is invoked", () => {
      const settings = makeSettings();
      const onSelectFile = vi.fn();

      const category = createGamePathsCategory(settings, onSelectFile);
      category.settings[0].onSelect();

      expect(onSelectFile).toHaveBeenCalledWith(
        "poe1ClientTxtPath",
        "Select Path of Exile 1 Client.txt",
      );
    });

    it("calls onSelectFile with poe2 key and title when poe2 onSelect is invoked", () => {
      const settings = makeSettings();
      const onSelectFile = vi.fn();

      const category = createGamePathsCategory(settings, onSelectFile);
      category.settings[1].onSelect();

      expect(onSelectFile).toHaveBeenCalledWith(
        "poe2ClientTxtPath",
        "Select Path of Exile 2 Client.txt",
      );
    });

    it("reflects null paths correctly", () => {
      const settings = makeSettings({
        poe1ClientTxtPath: null as any,
        poe2ClientTxtPath: null as any,
      });
      const onSelectFile = vi.fn();

      const category = createGamePathsCategory(settings, onSelectFile);

      expect(category.settings[0].value).toBeNull();
      expect(category.settings[1].value).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // createAppBehaviorCategory
  // ═══════════════════════════════════════════════════════════════════════

  describe("createAppBehaviorCategory", () => {
    it('returns the correct title "Application Behavior"', () => {
      const settings = makeSettings();
      const updateSetting = makeUpdateSetting();

      const category = createAppBehaviorCategory(settings, updateSetting);

      expect(category.title).toBe("Application Behavior");
    });

    it("returns the correct description", () => {
      const settings = makeSettings();
      const updateSetting = makeUpdateSetting();

      const category = createAppBehaviorCategory(settings, updateSetting);

      expect(category.description).toBe(
        "Customize how the application behaves",
      );
    });

    it("returns 3 settings: exit action, launch on startup, start minimized", () => {
      const settings = makeSettings();
      const updateSetting = makeUpdateSetting();

      const category = createAppBehaviorCategory(settings, updateSetting);

      expect(category.settings).toHaveLength(3);
      expect(category.settings[0].key).toBe("appExitAction");
      expect(category.settings[1].key).toBe("appOpenAtLogin");
      expect(category.settings[2].key).toBe("appOpenAtLoginMinimized");
    });

    it("returns appExitAction as a select type with correct options", () => {
      const settings = makeSettings({ appExitAction: "minimize" });
      const updateSetting = makeUpdateSetting();

      const category = createAppBehaviorCategory(settings, updateSetting);
      const exitAction = category.settings[0];

      expect(exitAction.type).toBe("select");
      expect(exitAction.value).toBe("minimize");
      if (exitAction.type === "select") {
        expect(exitAction.options).toEqual([
          { value: "exit", label: "Exit Application" },
          { value: "minimize", label: "Minimize to Tray" },
        ]);
      }
    });

    it("returns appOpenAtLogin as a toggle type", () => {
      const settings = makeSettings({ appOpenAtLogin: true });
      const updateSetting = makeUpdateSetting();

      const category = createAppBehaviorCategory(settings, updateSetting);
      const openAtLogin = category.settings[1];

      expect(openAtLogin.type).toBe("toggle");
      expect(openAtLogin.label).toBe("Launch on startup");
      expect(openAtLogin.value).toBe(true);
    });

    it("returns appOpenAtLoginMinimized as a toggle type", () => {
      const settings = makeSettings({ appOpenAtLoginMinimized: true });
      const updateSetting = makeUpdateSetting();

      const category = createAppBehaviorCategory(settings, updateSetting);
      const minimized = category.settings[2];

      expect(minimized.type).toBe("toggle");
      expect(minimized.label).toBe("Start minimized");
      expect(minimized.value).toBe(true);
    });

    it("calls updateSetting and trackEvent when appExitAction onChange is invoked", () => {
      const settings = makeSettings();
      const updateSetting = makeUpdateSetting();

      const category = createAppBehaviorCategory(settings, updateSetting);
      const exitAction = category.settings[0];

      if (exitAction.type === "select") {
        exitAction.onChange("minimize");
      }

      expect(updateSetting).toHaveBeenCalledWith("appExitAction", "minimize");
      expect(trackEvent).toHaveBeenCalledWith("settings-change", {
        setting: "appExitAction",
        value: "minimize",
      });
    });

    it("calls updateSetting and trackEvent when appOpenAtLogin onChange is invoked", () => {
      const settings = makeSettings();
      const updateSetting = makeUpdateSetting();

      const category = createAppBehaviorCategory(settings, updateSetting);
      const openAtLogin = category.settings[1];

      if (openAtLogin.type === "toggle") {
        openAtLogin.onChange(true);
      }

      expect(updateSetting).toHaveBeenCalledWith("appOpenAtLogin", true);
      expect(trackEvent).toHaveBeenCalledWith("settings-change", {
        setting: "appOpenAtLogin",
        value: true,
      });
    });

    it("calls updateSetting and trackEvent when appOpenAtLoginMinimized onChange is invoked", () => {
      const settings = makeSettings();
      const updateSetting = makeUpdateSetting();

      const category = createAppBehaviorCategory(settings, updateSetting);
      const minimized = category.settings[2];

      if (minimized.type === "toggle") {
        minimized.onChange(true);
      }

      expect(updateSetting).toHaveBeenCalledWith(
        "appOpenAtLoginMinimized",
        true,
      );
      expect(trackEvent).toHaveBeenCalledWith("settings-change", {
        setting: "appOpenAtLoginMinimized",
        value: true,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // SelectFile
  // ═══════════════════════════════════════════════════════════════════════

  describe("handleSelectFile", () => {
    it("opens the file dialog via window.electron.selectFile with correct options", async () => {
      window.electron.selectFile = vi
        .fn()
        .mockResolvedValue("/selected/path/Client.txt");
      const updateSetting = makeUpdateSetting();

      await handleSelectFile(
        "poe1ClientTxtPath",
        "Select Path of Exile 1 Client.txt",
        updateSetting,
      );

      expect(window.electron.selectFile).toHaveBeenCalledWith({
        title: "Select Path of Exile 1 Client.txt",
        filters: [{ name: "Text Files", extensions: ["txt"] }],
        properties: ["openFile"],
      });
    });

    it("calls updateSetting with the selected file path", async () => {
      window.electron.selectFile = vi
        .fn()
        .mockResolvedValue("/selected/path/Client.txt");
      const updateSetting = makeUpdateSetting();

      await handleSelectFile(
        "poe1ClientTxtPath",
        "Select PoE1 Client.txt",
        updateSetting,
      );

      expect(updateSetting).toHaveBeenCalledWith(
        "poe1ClientTxtPath",
        "/selected/path/Client.txt",
      );
    });

    it("tracks a settings-change event after selecting a file", async () => {
      window.electron.selectFile = vi
        .fn()
        .mockResolvedValue("/selected/path/Client.txt");
      const updateSetting = makeUpdateSetting();

      await handleSelectFile(
        "poe2ClientTxtPath",
        "Select PoE2 Client.txt",
        updateSetting,
      );

      expect(trackEvent).toHaveBeenCalledWith("settings-change", {
        setting: "poe2ClientTxtPath",
        hasPath: true,
      });
    });

    it("does nothing when the file dialog is cancelled (returns undefined)", async () => {
      window.electron.selectFile = vi.fn().mockResolvedValue(undefined);
      const updateSetting = makeUpdateSetting();

      await handleSelectFile(
        "poe1ClientTxtPath",
        "Select PoE1 Client.txt",
        updateSetting,
      );

      expect(updateSetting).not.toHaveBeenCalled();
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it("does nothing when the file dialog is cancelled (returns null)", async () => {
      window.electron.selectFile = vi.fn().mockResolvedValue(null);
      const updateSetting = makeUpdateSetting();

      await handleSelectFile(
        "poe1ClientTxtPath",
        "Select PoE1 Client.txt",
        updateSetting,
      );

      expect(updateSetting).not.toHaveBeenCalled();
      expect(trackEvent).not.toHaveBeenCalled();
    });

    it("handles errors from selectFile gracefully without throwing", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      window.electron.selectFile = vi
        .fn()
        .mockRejectedValue(new Error("Dialog failed"));
      const updateSetting = makeUpdateSetting();

      // Should not throw
      await expect(
        handleSelectFile(
          "poe1ClientTxtPath",
          "Select PoE1 Client.txt",
          updateSetting,
        ),
      ).resolves.toBeUndefined();

      expect(updateSetting).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("works correctly with poe2ClientTxtPath key", async () => {
      window.electron.selectFile = vi
        .fn()
        .mockResolvedValue("/poe2/logs/Client.txt");
      const updateSetting = makeUpdateSetting();

      await handleSelectFile(
        "poe2ClientTxtPath",
        "Select Path of Exile 2 Client.txt",
        updateSetting,
      );

      expect(window.electron.selectFile).toHaveBeenCalledWith({
        title: "Select Path of Exile 2 Client.txt",
        filters: [{ name: "Text Files", extensions: ["txt"] }],
        properties: ["openFile"],
      });
      expect(updateSetting).toHaveBeenCalledWith(
        "poe2ClientTxtPath",
        "/poe2/logs/Client.txt",
      );
    });
  });
});
