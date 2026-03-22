import { beforeEach, describe, expect, it } from "vitest";

import type { UserSettingsDTO } from "~/main/modules/settings-store/SettingsStore.dto";
import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

// ---------------------------------------------------------------------------
// Helper: builds a full UserSettingsDTO with sensible non-default values so
// we can distinguish "hydrated from IPC" vs "initial defaults".
// ---------------------------------------------------------------------------
function makeFakeSettingsDTO(
  overrides: Partial<UserSettingsDTO> = {},
): UserSettingsDTO {
  return {
    appExitAction: "minimize",
    appOpenAtLogin: true,
    appOpenAtLoginMinimized: true,
    onboardingDismissedBeacons: ["beacon-1"],
    overlayBounds: { x: 10, y: 20, width: 800, height: 600 },
    poe1ClientTxtPath: "C:/poe1/Client.txt",
    poe1SelectedLeague: "Settlers",
    poe1PriceSource: "stash",
    poe2ClientTxtPath: "C:/poe2/Client.txt",
    poe2SelectedLeague: "Dawn",
    poe2PriceSource: "stash",
    selectedGame: "poe2",
    installedGames: ["poe1", "poe2"],
    setupCompleted: true,
    setupStep: 3,
    setupVersion: 2,
    audioEnabled: false,
    audioVolume: 0.8,
    audioRarity1Path: "/sounds/r1.wav",
    audioRarity2Path: "/sounds/r2.wav",
    audioRarity3Path: "/sounds/r3.wav",
    raritySource: "filter",
    selectedFilterId: "filter-abc",
    lastSeenAppVersion: "1.2.3",
    overlayFontSize: 1.2,
    overlayToolbarFontSize: 1.4,
    mainWindowBounds: { x: 0, y: 0, width: 1024, height: 768 },
    telemetryCrashReporting: true,
    telemetryUsageAnalytics: true,
    csvExportPath: "/exports",
    ...overrides,
  };
}

// ===========================================================================
// Initial State
// ===========================================================================

describe("Settings slice — initial state", () => {
  it("has correct default app and game settings", () => {
    const s = store.getState().settings;
    expect(s.appExitAction).toBe("exit");
    expect(s.appOpenAtLogin).toBe(false);
    expect(s.appOpenAtLoginMinimized).toBe(false);
    expect(s.selectedGame).toBe("poe1");
    expect(s.installedGames).toEqual(["poe1"]);
    expect(s.setupCompleted).toBe(false);
  });

  it("has correct default poe1 and poe2 settings", () => {
    const s = store.getState().settings;
    expect(s.poe1ClientTxtPath).toBeNull();
    expect(s.poe1SelectedLeague).toBe("Standard");
    expect(s.poe1PriceSource).toBe("exchange");
    expect(s.poe2ClientTxtPath).toBeNull();
    expect(s.poe2SelectedLeague).toBe("Standard");
    expect(s.poe2PriceSource).toBe("exchange");
  });

  it("has correct default audio, overlay, and telemetry settings", () => {
    const s = store.getState().settings;
    expect(s.audioEnabled).toBe(true);
    expect(s.audioVolume).toBe(0.5);
    expect(s.raritySource).toBe("poe.ninja");
    expect(s.overlayFontSize).toBe(1.0);
    expect(s.overlayToolbarFontSize).toBe(1.0);
    expect(s.telemetryCrashReporting).toBe(false);
    expect(s.telemetryUsageAnalytics).toBe(false);
  });

  it("has correct default transient UI state", () => {
    const s = store.getState().settings;
    expect(s.isLoading).toBe(false);
    expect(s.error).toBeNull();
    expect(s.audioDetectedFiles).toEqual([]);
    expect(s.audioIsScanning).toBe(false);
    expect(s.audioPreviewingFile).toBeNull();
  });
});

// ===========================================================================
// hydrate
// ===========================================================================

describe("Settings slice — hydrate", () => {
  it("sets isLoading true while hydrating", async () => {
    // Create a deferred promise so we can check intermediate state
    let resolve!: (val: UserSettingsDTO) => void;
    const pending = new Promise<UserSettingsDTO>((r) => {
      resolve = r;
    });
    electron.settings.getAll.mockReturnValue(pending);

    const hydratePromise = store.getState().settings.hydrate();

    // While the promise is pending, isLoading should be true
    expect(store.getState().settings.isLoading).toBe(true);
    expect(store.getState().settings.error).toBeNull();

    resolve(makeFakeSettingsDTO());
    await hydratePromise;

    expect(store.getState().settings.isLoading).toBe(false);
  });

  it("populates all DTO properties on success", async () => {
    const dto = makeFakeSettingsDTO();
    electron.settings.getAll.mockResolvedValue(dto);

    await store.getState().settings.hydrate();

    const s = store.getState().settings;
    expect(s.appExitAction).toBe(dto.appExitAction);
    expect(s.appOpenAtLogin).toBe(dto.appOpenAtLogin);
    expect(s.appOpenAtLoginMinimized).toBe(dto.appOpenAtLoginMinimized);
    expect(s.poe1ClientTxtPath).toBe(dto.poe1ClientTxtPath);
    expect(s.poe1SelectedLeague).toBe(dto.poe1SelectedLeague);
    expect(s.poe1PriceSource).toBe(dto.poe1PriceSource);
    expect(s.poe2ClientTxtPath).toBe(dto.poe2ClientTxtPath);
    expect(s.poe2SelectedLeague).toBe(dto.poe2SelectedLeague);
    expect(s.poe2PriceSource).toBe(dto.poe2PriceSource);
    expect(s.selectedGame).toBe(dto.selectedGame);
    expect(s.installedGames).toEqual(dto.installedGames);
    expect(s.setupCompleted).toBe(dto.setupCompleted);
    expect(s.audioEnabled).toBe(dto.audioEnabled);
    expect(s.audioVolume).toBe(dto.audioVolume);
    expect(s.raritySource).toBe(dto.raritySource);
    expect(s.overlayFontSize).toBe(dto.overlayFontSize);
    expect(s.overlayToolbarFontSize).toBe(dto.overlayToolbarFontSize);
    expect(s.telemetryCrashReporting).toBe(dto.telemetryCrashReporting);
    expect(s.telemetryUsageAnalytics).toBe(dto.telemetryUsageAnalytics);
    expect(s.csvExportPath).toBe(dto.csvExportPath);
    expect(s.isLoading).toBe(false);
    expect(s.error).toBeNull();
  });

  it("sets error on hydration failure", async () => {
    electron.settings.getAll.mockRejectedValue(new Error("DB corrupt"));

    await store.getState().settings.hydrate();

    const s = store.getState().settings;
    expect(s.error).toBe("DB corrupt");
    expect(s.isLoading).toBe(false);
  });

  it("sets generic error message for non-Error rejection", async () => {
    electron.settings.getAll.mockRejectedValue("boom");

    await store.getState().settings.hydrate();

    expect(store.getState().settings.error).toBe("Unknown error");
  });

  it("clears a previous error on successful re-hydration", async () => {
    electron.settings.getAll.mockRejectedValueOnce(new Error("first fail"));
    await store.getState().settings.hydrate();
    expect(store.getState().settings.error).toBe("first fail");

    electron.settings.getAll.mockResolvedValue(makeFakeSettingsDTO());
    await store.getState().settings.hydrate();
    expect(store.getState().settings.error).toBeNull();
  });
});

// ===========================================================================
// updateSetting (optimistic update with rollback)
// ===========================================================================

describe("Settings slice — updateSetting", () => {
  it("optimistically updates state before IPC resolves", async () => {
    let resolve!: () => void;
    const pending = new Promise<void>((r) => {
      resolve = r;
    });
    electron.settings.set.mockReturnValue(pending);

    const updatePromise = store
      .getState()
      .settings.updateSetting("audioVolume", 0.9);

    // Immediately updated (optimistic)
    expect(store.getState().settings.audioVolume).toBe(0.9);

    resolve();
    await updatePromise;

    // Still 0.9 after resolve
    expect(store.getState().settings.audioVolume).toBe(0.9);
  });

  it("calls window.electron.settings.set with key and value", async () => {
    electron.settings.set.mockResolvedValue(undefined);

    await store.getState().settings.updateSetting("audioEnabled", false);

    expect(electron.settings.set).toHaveBeenCalledWith("audioEnabled", false);
  });

  it("rolls back on IPC error", async () => {
    electron.settings.set.mockRejectedValue(new Error("IPC failed"));

    // Initial value should be 0.5
    expect(store.getState().settings.audioVolume).toBe(0.5);

    await store.getState().settings.updateSetting("audioVolume", 0.9);

    // Should have rolled back to the previous value
    expect(store.getState().settings.audioVolume).toBe(0.5);
    expect(store.getState().settings.error).toBe("IPC failed");
  });

  it("sets generic error message on non-Error IPC failure", async () => {
    electron.settings.set.mockRejectedValue("oops");

    await store.getState().settings.updateSetting("audioVolume", 0.9);

    expect(store.getState().settings.audioVolume).toBe(0.5);
    expect(store.getState().settings.error).toBe("Update failed");
  });

  it("can update multiple different keys sequentially", async () => {
    electron.settings.set.mockResolvedValue(undefined);

    await store.getState().settings.updateSetting("audioVolume", 0.7);
    await store.getState().settings.updateSetting("audioEnabled", false);

    expect(store.getState().settings.audioVolume).toBe(0.7);
    expect(store.getState().settings.audioEnabled).toBe(false);
    expect(electron.settings.set).toHaveBeenCalledTimes(2);
  });
});

// ===========================================================================
// setSetting (direct setter, no IPC)
// ===========================================================================

describe("Settings slice — setSetting", () => {
  it("directly sets a single setting without IPC", () => {
    store.getState().settings.setSetting("poe1SelectedLeague", "Necropolis");

    expect(store.getState().settings.poe1SelectedLeague).toBe("Necropolis");
    expect(electron.settings.set).not.toHaveBeenCalled();
  });

  it("can set poe2ClientTxtPath", () => {
    store
      .getState()
      .settings.setSetting("poe2ClientTxtPath", "D:/Games/PoE2/Client.txt");

    expect(store.getState().settings.poe2ClientTxtPath).toBe(
      "D:/Games/PoE2/Client.txt",
    );
  });

  it("can set selectedGame to poe2", () => {
    store.getState().settings.setSetting("selectedGame", "poe2");

    expect(store.getState().settings.selectedGame).toBe("poe2");
  });
});

// ===========================================================================
// setSettings (bulk setter)
// ===========================================================================

describe("Settings slice — setSettings", () => {
  it("sets all DTO properties at once", () => {
    const dto = makeFakeSettingsDTO();
    store.getState().settings.setSettings(dto);

    const s = store.getState().settings;
    expect(s.appExitAction).toBe("minimize");
    expect(s.selectedGame).toBe("poe2");
    expect(s.installedGames).toEqual(["poe1", "poe2"]);
    expect(s.poe1SelectedLeague).toBe("Settlers");
    expect(s.poe2SelectedLeague).toBe("Dawn");
    expect(s.audioEnabled).toBe(false);
    expect(s.audioVolume).toBe(0.8);
    expect(s.overlayFontSize).toBe(1.2);
  });

  it("does not reset transient UI state like isLoading or error", () => {
    store.getState().settings.setError("some error");

    store.getState().settings.setSettings(makeFakeSettingsDTO());

    // setSettings only updates DTO fields; transient state should remain
    expect(store.getState().settings.error).toBe("some error");
    expect(store.getState().settings.audioDetectedFiles).toEqual([]);
  });
});

// ===========================================================================
// setError
// ===========================================================================

describe("Settings slice — setError", () => {
  it("sets error message", () => {
    store.getState().settings.setError("Something went wrong");

    expect(store.getState().settings.error).toBe("Something went wrong");
  });

  it("clears error when null is passed", () => {
    store.getState().settings.setError("initial error");
    store.getState().settings.setError(null);

    expect(store.getState().settings.error).toBeNull();
  });
});

// ===========================================================================
// scanCustomSounds
// ===========================================================================

describe("Settings slice — scanCustomSounds", () => {
  it("sets audioIsScanning true while scanning", async () => {
    let resolve!: (val: any) => void;
    const pending = new Promise((r) => {
      resolve = r;
    });
    electron.settings.scanCustomSounds.mockReturnValue(pending);

    const scanPromise = store.getState().settings.scanCustomSounds();

    expect(store.getState().settings.audioIsScanning).toBe(true);

    resolve([]);
    await scanPromise;

    expect(store.getState().settings.audioIsScanning).toBe(false);
  });

  it("populates audioDetectedFiles on success", async () => {
    const files = [
      { filename: "drop.wav", fullPath: "/sounds/drop.wav" },
      { filename: "ding.mp3", fullPath: "/sounds/ding.mp3" },
    ];
    electron.settings.scanCustomSounds.mockResolvedValue(files);

    await store.getState().settings.scanCustomSounds();

    expect(store.getState().settings.audioDetectedFiles).toEqual(files);
    expect(store.getState().settings.audioIsScanning).toBe(false);
  });

  it("replaces previously detected files on re-scan", async () => {
    electron.settings.scanCustomSounds.mockResolvedValue([
      { filename: "old.wav", fullPath: "/sounds/old.wav" },
    ]);
    await store.getState().settings.scanCustomSounds();
    expect(store.getState().settings.audioDetectedFiles).toHaveLength(1);

    electron.settings.scanCustomSounds.mockResolvedValue([
      { filename: "new1.wav", fullPath: "/sounds/new1.wav" },
      { filename: "new2.wav", fullPath: "/sounds/new2.wav" },
    ]);
    await store.getState().settings.scanCustomSounds();
    expect(store.getState().settings.audioDetectedFiles).toHaveLength(2);
    expect(store.getState().settings.audioDetectedFiles[0].filename).toBe(
      "new1.wav",
    );
  });

  it("sets audioIsScanning false on error", async () => {
    electron.settings.scanCustomSounds.mockRejectedValue(
      new Error("scan failed"),
    );

    await store.getState().settings.scanCustomSounds();

    expect(store.getState().settings.audioIsScanning).toBe(false);
  });
});

// ===========================================================================
// setAudioPreviewingFile
// ===========================================================================

describe("Settings slice — setAudioPreviewingFile", () => {
  it("sets the previewing file path", () => {
    store.getState().settings.setAudioPreviewingFile("/sounds/test.wav");

    expect(store.getState().settings.audioPreviewingFile).toBe(
      "/sounds/test.wav",
    );
  });

  it("clears the previewing file when null", () => {
    store.getState().settings.setAudioPreviewingFile("/sounds/test.wav");
    store.getState().settings.setAudioPreviewingFile(null);

    expect(store.getState().settings.audioPreviewingFile).toBeNull();
  });
});

// ===========================================================================
// Getters — App behavior
// ===========================================================================

describe("Settings slice — getters (app behavior)", () => {
  it("getAppExitAction returns appExitAction", () => {
    expect(store.getState().settings.getAppExitAction()).toBe("exit");

    store.getState().settings.setSetting("appExitAction", "minimize");
    expect(store.getState().settings.getAppExitAction()).toBe("minimize");
  });

  it("getAppOpenAtLogin returns appOpenAtLogin", () => {
    expect(store.getState().settings.getAppOpenAtLogin()).toBe(false);

    store.getState().settings.setSetting("appOpenAtLogin", true);
    expect(store.getState().settings.getAppOpenAtLogin()).toBe(true);
  });

  it("getAppOpenAtLoginMinimized returns appOpenAtLoginMinimized", () => {
    expect(store.getState().settings.getAppOpenAtLoginMinimized()).toBe(false);

    store.getState().settings.setSetting("appOpenAtLoginMinimized", true);
    expect(store.getState().settings.getAppOpenAtLoginMinimized()).toBe(true);
  });
});

// ===========================================================================
// Getters — File paths
// ===========================================================================

describe("Settings slice — getters (file paths)", () => {
  it("getPoe1ClientTxtPath returns poe1ClientTxtPath", () => {
    expect(store.getState().settings.getPoe1ClientTxtPath()).toBeNull();

    store
      .getState()
      .settings.setSetting("poe1ClientTxtPath", "C:/poe1/Client.txt");
    expect(store.getState().settings.getPoe1ClientTxtPath()).toBe(
      "C:/poe1/Client.txt",
    );
  });

  it("getPoe2ClientTxtPath returns poe2ClientTxtPath", () => {
    expect(store.getState().settings.getPoe2ClientTxtPath()).toBeNull();

    store
      .getState()
      .settings.setSetting("poe2ClientTxtPath", "D:/poe2/Client.txt");
    expect(store.getState().settings.getPoe2ClientTxtPath()).toBe(
      "D:/poe2/Client.txt",
    );
  });
});

// ===========================================================================
// Getters — Game and league selection
// ===========================================================================

describe("Settings slice — getters (game and league)", () => {
  it("getSelectedGame returns selectedGame", () => {
    expect(store.getState().settings.getSelectedGame()).toBe("poe1");

    store.getState().settings.setSetting("selectedGame", "poe2");
    expect(store.getState().settings.getSelectedGame()).toBe("poe2");
  });

  it("getSelectedPoe1League returns poe1SelectedLeague", () => {
    expect(store.getState().settings.getSelectedPoe1League()).toBe("Standard");

    store.getState().settings.setSetting("poe1SelectedLeague", "Settlers");
    expect(store.getState().settings.getSelectedPoe1League()).toBe("Settlers");
  });

  it("getSelectedPoe2League returns poe2SelectedLeague", () => {
    expect(store.getState().settings.getSelectedPoe2League()).toBe("Standard");

    store.getState().settings.setSetting("poe2SelectedLeague", "Dawn");
    expect(store.getState().settings.getSelectedPoe2League()).toBe("Dawn");
  });

  it("getActiveGameViewSelectedLeague returns poe1 league when selectedGame is poe1", () => {
    store.getState().settings.setSetting("selectedGame", "poe1");
    store.getState().settings.setSetting("poe1SelectedLeague", "Necropolis");
    store.getState().settings.setSetting("poe2SelectedLeague", "Dawn");

    expect(store.getState().settings.getActiveGameViewSelectedLeague()).toBe(
      "Necropolis",
    );
  });

  it("getActiveGameViewSelectedLeague returns poe2 league when selectedGame is poe2", () => {
    store.getState().settings.setSetting("selectedGame", "poe2");
    store.getState().settings.setSetting("poe1SelectedLeague", "Necropolis");
    store.getState().settings.setSetting("poe2SelectedLeague", "Dawn");

    expect(store.getState().settings.getActiveGameViewSelectedLeague()).toBe(
      "Dawn",
    );
  });

  it("getActiveGameViewSelectedLeague reflects changes when selectedGame switches", () => {
    store.getState().settings.setSetting("poe1SelectedLeague", "Settlers");
    store.getState().settings.setSetting("poe2SelectedLeague", "Early Access");

    store.getState().settings.setSetting("selectedGame", "poe1");
    expect(store.getState().settings.getActiveGameViewSelectedLeague()).toBe(
      "Settlers",
    );

    store.getState().settings.setSetting("selectedGame", "poe2");
    expect(store.getState().settings.getActiveGameViewSelectedLeague()).toBe(
      "Early Access",
    );
  });
});

// ===========================================================================
// Getters — Price sources
// ===========================================================================

describe("Settings slice — getters (price source)", () => {
  it("getActiveGameViewPriceSource returns poe1PriceSource when selectedGame is poe1", () => {
    store.getState().settings.setSetting("selectedGame", "poe1");
    store.getState().settings.setSetting("poe1PriceSource", "stash");
    store.getState().settings.setSetting("poe2PriceSource", "exchange");

    expect(store.getState().settings.getActiveGameViewPriceSource()).toBe(
      "stash",
    );
  });

  it("getActiveGameViewPriceSource returns poe2PriceSource when selectedGame is poe2", () => {
    store.getState().settings.setSetting("selectedGame", "poe2");
    store.getState().settings.setSetting("poe1PriceSource", "stash");
    store.getState().settings.setSetting("poe2PriceSource", "exchange");

    expect(store.getState().settings.getActiveGameViewPriceSource()).toBe(
      "exchange",
    );
  });

  it("setActiveGameViewPriceSource updates poe1PriceSource when selectedGame is poe1", async () => {
    electron.settings.set.mockResolvedValue(undefined);

    store.getState().settings.setSetting("selectedGame", "poe1");
    await store.getState().settings.setActiveGameViewPriceSource("stash");

    expect(store.getState().settings.poe1PriceSource).toBe("stash");
    expect(electron.settings.set).toHaveBeenCalledWith(
      "poe1PriceSource",
      "stash",
    );
  });

  it("setActiveGameViewPriceSource updates poe2PriceSource when selectedGame is poe2", async () => {
    electron.settings.set.mockResolvedValue(undefined);

    store.getState().settings.setSetting("selectedGame", "poe2");
    await store.getState().settings.setActiveGameViewPriceSource("stash");

    expect(store.getState().settings.poe2PriceSource).toBe("stash");
    expect(electron.settings.set).toHaveBeenCalledWith(
      "poe2PriceSource",
      "stash",
    );
  });

  it("setActiveGameViewPriceSource does not affect the other game's price source", async () => {
    electron.settings.set.mockResolvedValue(undefined);

    store.getState().settings.setSetting("selectedGame", "poe1");
    store.getState().settings.setSetting("poe2PriceSource", "exchange");

    await store.getState().settings.setActiveGameViewPriceSource("stash");

    // poe1 changed
    expect(store.getState().settings.poe1PriceSource).toBe("stash");
    // poe2 unchanged
    expect(store.getState().settings.poe2PriceSource).toBe("exchange");
  });

  it("getActiveGameViewPriceSource reflects changes after switching games", () => {
    store.getState().settings.setSetting("poe1PriceSource", "stash");
    store.getState().settings.setSetting("poe2PriceSource", "exchange");

    store.getState().settings.setSetting("selectedGame", "poe1");
    expect(store.getState().settings.getActiveGameViewPriceSource()).toBe(
      "stash",
    );

    store.getState().settings.setSetting("selectedGame", "poe2");
    expect(store.getState().settings.getActiveGameViewPriceSource()).toBe(
      "exchange",
    );
  });
});
