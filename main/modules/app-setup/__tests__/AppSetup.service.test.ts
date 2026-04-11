import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createElectronMock,
  createIpcValidationMock,
  createSettingsStoreMock,
  getIpcHandler,
} from "~/main/modules/__test-utils__/mock-factories";
import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const {
  mockIpcHandle,
  mockSettingsGet,
  mockSettingsSet,
  mockSettingsGetAllSettings,
  mockExistsSync,
  mockStatSync,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockSettingsGet: vi.fn(),
  mockSettingsSet: vi.fn(),
  mockSettingsGetAllSettings: vi.fn(),
  mockExistsSync: vi.fn(),
  mockStatSync: vi.fn(),
}));

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => createElectronMock({ mockIpcHandle }));

// ─── Mock node:fs ────────────────────────────────────────────────────────────
vi.mock("node:fs", () => ({
  default: {
    existsSync: mockExistsSync,
    statSync: mockStatSync,
  },
  existsSync: mockExistsSync,
  statSync: mockStatSync,
}));

// ─── Mock SettingsStoreService ───────────────────────────────────────────────
vi.mock("~/main/modules/settings-store", () =>
  createSettingsStoreMock({
    mockGet: mockSettingsGet,
    mockSet: mockSettingsSet,
    mockGetAllSettings: mockSettingsGetAllSettings,
  }),
);

// ─── Mock ipc-validation ─────────────────────────────────────────────────────
vi.mock("~/main/utils/ipc-validation", () =>
  createIpcValidationMock({
    mockHandleValidationError: vi.fn((_error: unknown, _channel: string) => ({
      success: false,
      error: "Invalid input: validation error",
    })),
  }),
);

import { SettingsKey } from "~/main/modules/settings-store";

// ─── Import under test (after mocks) ────────────────────────────────────────
import { AppSetupChannel } from "../AppSetup.channels";
import { AppSetupService } from "../AppSetup.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Default settings factory ────────────────────────────────────────────────

function makeDefaultSettings(overrides: Record<string, any> = {}) {
  return {
    setupStep: 0,
    setupCompleted: false,
    selectedGame: "poe1",
    installedGames: ["poe1"],
    poe1SelectedLeague: "Settlers",
    poe2SelectedLeague: "",
    poe1ClientTxtPath: "C:\\Games\\PoE\\logs\\Client.txt",
    poe2ClientTxtPath: null,
    telemetryCrashReporting: false,
    telemetryUsageAnalytics: false,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AppSetupService", () => {
  let service: AppSetupService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    resetSingleton(AppSetupService);

    // Default mock implementations
    mockSettingsGet.mockImplementation(async (key: string) => {
      const defaults: Record<string, any> = {
        [SettingsKey.SetupStep]: 0,
        [SettingsKey.SetupCompleted]: false,
        [SettingsKey.ActiveGame]: "poe1",
        [SettingsKey.InstalledGames]: ["poe1"],
        [SettingsKey.SelectedPoe1League]: "Settlers",
        [SettingsKey.SelectedPoe2League]: "",
        [SettingsKey.Poe1ClientTxtPath]: "C:\\Games\\PoE\\logs\\Client.txt",
        [SettingsKey.Poe2ClientTxtPath]: null,
      };
      return defaults[key];
    });

    mockSettingsSet.mockResolvedValue(undefined);

    mockSettingsGetAllSettings.mockResolvedValue(makeDefaultSettings());

    // fs mocks: by default, client paths are valid
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ isFile: () => true });

    service = AppSetupService.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const a = AppSetupService.getInstance();
      const b = AppSetupService.getInstance();
      expect(a).toBe(b);
    });
  });

  // ─── IPC Handler Registration ────────────────────────────────────────────

  describe("setupIpcHandlers", () => {
    it("should register all expected IPC channels", () => {
      const channels = mockIpcHandle.mock.calls.map(([ch]: [string]) => ch);

      expect(channels).toContain(AppSetupChannel.GetSetupState);
      expect(channels).toContain(AppSetupChannel.IsSetupComplete);
      expect(channels).toContain(AppSetupChannel.AdvanceStep);
      expect(channels).toContain(AppSetupChannel.GoToStep);
      expect(channels).toContain(AppSetupChannel.ValidateCurrentStep);
      expect(channels).toContain(AppSetupChannel.CompleteSetup);
      expect(channels).toContain(AppSetupChannel.ResetSetup);
      expect(channels).toContain(AppSetupChannel.SkipSetup);
    });
  });

  // ─── getSetupState ───────────────────────────────────────────────────────

  describe("getSetupState", () => {
    it("should return the full setup state from settings", async () => {
      const state = await service.getSetupState();

      expect(state).toEqual({
        currentStep: 0,
        isComplete: false,
        selectedGames: ["poe1"],
        poe1League: "Settlers",
        poe2League: "",
        poe1ClientPath: "C:\\Games\\PoE\\logs\\Client.txt",
        poe2ClientPath: null,
        telemetryCrashReporting: false,
        telemetryUsageAnalytics: false,
      });
    });

    it("should return installedGames as selectedGames", async () => {
      mockSettingsGetAllSettings.mockResolvedValue(
        makeDefaultSettings({
          installedGames: ["poe2", "poe1"],
        }),
      );

      const state = await service.getSetupState();
      expect(state.selectedGames).toEqual(["poe2", "poe1"]);
    });

    it("should work through the IPC handler", async () => {
      const handler = getIpcHandler(
        mockIpcHandle,
        AppSetupChannel.GetSetupState,
      );
      const result = await handler();

      expect(result).toHaveProperty("currentStep");
      expect(result).toHaveProperty("isComplete");
    });
  });

  // ─── isSetupComplete ─────────────────────────────────────────────────────

  describe("isSetupComplete", () => {
    it("should return false when setup is not completed", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupCompleted) return false;
        return undefined;
      });

      const result = await service.isSetupComplete();
      expect(result).toBe(false);
    });

    it("should return true when setup is completed", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupCompleted) return true;
        return undefined;
      });

      const result = await service.isSetupComplete();
      expect(result).toBe(true);
    });

    it("should work through the IPC handler", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupCompleted) return true;
        return undefined;
      });

      const handler = getIpcHandler(
        mockIpcHandle,
        AppSetupChannel.IsSetupComplete,
      );
      const result = await handler();
      expect(result).toBe(true);
    });
  });

  // ─── validateCurrentStep ─────────────────────────────────────────────────

  describe("validateCurrentStep", () => {
    describe("step 0 (NOT_STARTED)", () => {
      it("should return valid for step 0 (default/unknown step)", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 0;
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result).toEqual({ isValid: true, errors: [] });
      });
    });

    describe("step 1 (SELECT_GAME)", () => {
      it("should return valid when at least one game is installed", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 1;
          if (key === SettingsKey.InstalledGames) return ["poe1"];
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should return invalid when no games are installed", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 1;
          if (key === SettingsKey.InstalledGames) return [];
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Please select at least one game");
      });

      it("should return invalid when installedGames is null/undefined", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 1;
          if (key === SettingsKey.InstalledGames) return null;
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should return valid when both games are installed", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 1;
          if (key === SettingsKey.InstalledGames) return ["poe1", "poe2"];
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(true);
      });
    });

    describe("step 2 (SELECT_LEAGUE)", () => {
      it("should return valid when poe1 league is selected for poe1 game", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 2;
          if (key === SettingsKey.InstalledGames) return ["poe1"];
          if (key === SettingsKey.SelectedPoe1League) return "Settlers";
          if (key === SettingsKey.SelectedPoe2League) return "";
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should return invalid when poe1 has no league selected", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 2;
          if (key === SettingsKey.InstalledGames) return ["poe1"];
          if (key === SettingsKey.SelectedPoe1League) return "";
          if (key === SettingsKey.SelectedPoe2League) return "";
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Please select a Path of Exile 1 league",
        );
      });

      it("should return invalid when poe2 has no league selected", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 2;
          if (key === SettingsKey.InstalledGames) return ["poe2"];
          if (key === SettingsKey.SelectedPoe1League) return "";
          if (key === SettingsKey.SelectedPoe2League) return "";
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Please select a Path of Exile 2 league",
        );
      });

      it("should return two errors when both games lack leagues", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 2;
          if (key === SettingsKey.InstalledGames) return ["poe1", "poe2"];
          if (key === SettingsKey.SelectedPoe1League) return "";
          if (key === SettingsKey.SelectedPoe2League) return null;
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(2);
      });

      it("should return valid when both games have leagues selected", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 2;
          if (key === SettingsKey.InstalledGames) return ["poe1", "poe2"];
          if (key === SettingsKey.SelectedPoe1League) return "Settlers";
          if (key === SettingsKey.SelectedPoe2League) return "Early Access";
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(true);
      });

      it("should ignore poe2 league validation when only poe1 is installed", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 2;
          if (key === SettingsKey.InstalledGames) return ["poe1"];
          if (key === SettingsKey.SelectedPoe1League) return "Settlers";
          if (key === SettingsKey.SelectedPoe2League) return "";
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(true);
      });

      it("should treat whitespace-only league as empty", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 2;
          if (key === SettingsKey.InstalledGames) return ["poe1"];
          if (key === SettingsKey.SelectedPoe1League) return "   ";
          if (key === SettingsKey.SelectedPoe2League) return "";
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
      });
    });

    describe("step 3 (SELECT_CLIENT_PATH)", () => {
      it("should return valid when poe1 has a valid client path", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 3;
          if (key === SettingsKey.InstalledGames) return ["poe1"];
          if (key === SettingsKey.Poe1ClientTxtPath)
            return "C:\\Games\\PoE\\logs\\Client.txt";
          if (key === SettingsKey.Poe2ClientTxtPath) return null;
          return undefined;
        });
        mockExistsSync.mockReturnValue(true);
        mockStatSync.mockReturnValue({ isFile: () => true });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should return invalid when poe1 client path is missing", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 3;
          if (key === SettingsKey.InstalledGames) return ["poe1"];
          if (key === SettingsKey.Poe1ClientTxtPath) return null;
          if (key === SettingsKey.Poe2ClientTxtPath) return null;
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          "Please select Path of Exile 1 Client.txt path",
        );
      });

      it("should return invalid when poe1 client path does not exist", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 3;
          if (key === SettingsKey.InstalledGames) return ["poe1"];
          if (key === SettingsKey.Poe1ClientTxtPath)
            return "C:\\Nonexistent\\Client.txt";
          if (key === SettingsKey.Poe2ClientTxtPath) return null;
          return undefined;
        });
        mockExistsSync.mockReturnValue(false);

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain("invalid or file does not exist");
      });

      it("should return invalid when path points to a directory", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 3;
          if (key === SettingsKey.InstalledGames) return ["poe1"];
          if (key === SettingsKey.Poe1ClientTxtPath)
            return "C:\\Games\\PoE\\logs";
          if (key === SettingsKey.Poe2ClientTxtPath) return null;
          return undefined;
        });
        mockExistsSync.mockReturnValue(true);
        mockStatSync.mockReturnValue({ isFile: () => false });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
      });

      it("should return invalid when filename is not Client.txt", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 3;
          if (key === SettingsKey.InstalledGames) return ["poe1"];
          if (key === SettingsKey.Poe1ClientTxtPath)
            return "C:\\Games\\PoE\\logs\\notclient.txt";
          if (key === SettingsKey.Poe2ClientTxtPath) return null;
          return undefined;
        });
        mockExistsSync.mockReturnValue(true);
        mockStatSync.mockReturnValue({ isFile: () => true });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
      });

      it("should accept Client.txt case-insensitively", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 3;
          if (key === SettingsKey.InstalledGames) return ["poe1"];
          if (key === SettingsKey.Poe1ClientTxtPath)
            return "C:\\Games\\PoE\\logs\\CLIENT.TXT";
          if (key === SettingsKey.Poe2ClientTxtPath) return null;
          return undefined;
        });
        mockExistsSync.mockReturnValue(true);
        mockStatSync.mockReturnValue({ isFile: () => true });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(true);
      });

      it("should validate both poe1 and poe2 paths when both games installed", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 3;
          if (key === SettingsKey.InstalledGames) return ["poe1", "poe2"];
          if (key === SettingsKey.Poe1ClientTxtPath) return null;
          if (key === SettingsKey.Poe2ClientTxtPath) return null;
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(2);
        expect(result.errors[0]).toContain("Path of Exile 1");
        expect(result.errors[1]).toContain("Path of Exile 2");
      });

      it("should handle fs.existsSync throwing an error gracefully", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === SettingsKey.SetupStep) return 3;
          if (key === SettingsKey.InstalledGames) return ["poe1"];
          if (key === SettingsKey.Poe1ClientTxtPath)
            return "C:\\Games\\PoE\\logs\\Client.txt";
          if (key === SettingsKey.Poe2ClientTxtPath) return null;
          return undefined;
        });
        mockExistsSync.mockImplementation(() => {
          throw new Error("Permission denied");
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
      });
    });

    it("should work through the IPC handler", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return 1;
        if (key === SettingsKey.InstalledGames) return ["poe1"];
        return undefined;
      });

      const handler = getIpcHandler(
        mockIpcHandle,
        AppSetupChannel.ValidateCurrentStep,
      );
      const result = await handler();
      expect(result.isValid).toBe(true);
    });
  });

  // ─── advanceStep ─────────────────────────────────────────────────────────

  describe("advanceStep", () => {
    it("should advance from step 0 to step 1 when validation passes", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return 0;
        return undefined;
      });

      const result = await service.advanceStep();
      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith(SettingsKey.SetupStep, 1);
    });

    it("should advance from step 1 to step 2 when game is selected", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return 1;
        if (key === SettingsKey.InstalledGames) return ["poe1"];
        return undefined;
      });

      const result = await service.advanceStep();
      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith(SettingsKey.SetupStep, 2);
    });

    it("should advance from step 2 to step 3 when league is selected", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return 2;
        if (key === SettingsKey.InstalledGames) return ["poe1"];
        if (key === SettingsKey.SelectedPoe1League) return "Settlers";
        if (key === SettingsKey.SelectedPoe2League) return "";
        return undefined;
      });

      const result = await service.advanceStep();
      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith(SettingsKey.SetupStep, 3);
    });

    it("should fail to advance when validation fails", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return 1;
        if (key === SettingsKey.InstalledGames) return [];
        return undefined;
      });

      const result = await service.advanceStep();
      expect(result.success).toBe(false);
      expect(result.error).toContain("Please select at least one game");
    });

    it("should advance from step 3 to step 4 (telemetry consent)", async () => {
      // Step 3 is SELECT_CLIENT_PATH — advancing goes to step 4 (TELEMETRY_CONSENT)
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return 3;
        if (key === SettingsKey.InstalledGames) return ["poe1"];
        if (key === SettingsKey.SelectedPoe1League) return "Settlers";
        if (key === SettingsKey.SelectedPoe2League) return "";
        if (key === SettingsKey.Poe1ClientTxtPath)
          return "C:\\Games\\PoE\\logs\\Client.txt";
        if (key === SettingsKey.Poe2ClientTxtPath) return null;
        return undefined;
      });
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isFile: () => true });

      const result = await service.advanceStep();
      expect(result.success).toBe(true);
      // Should set telemetry defaults to ON for new users entering step 4
      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.TelemetryCrashReporting,
        true,
      );
      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.TelemetryUsageAnalytics,
        true,
      );
      expect(mockSettingsSet).toHaveBeenCalledWith(SettingsKey.SetupStep, 4);
    });

    it("should complete setup when advancing past the last step (step 4)", async () => {
      // Step 4 is TELEMETRY_CONSENT — advancing past it should complete setup
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return 4;
        if (key === SettingsKey.InstalledGames) return ["poe1"];
        if (key === SettingsKey.SelectedPoe1League) return "Settlers";
        if (key === SettingsKey.SelectedPoe2League) return "";
        if (key === SettingsKey.Poe1ClientTxtPath)
          return "C:\\Games\\PoE\\logs\\Client.txt";
        if (key === SettingsKey.Poe2ClientTxtPath) return null;
        return undefined;
      });
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isFile: () => true });

      const result = await service.advanceStep();
      expect(result.success).toBe(true);
      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.SetupCompleted,
        true,
      );
    });

    it("should work through the IPC handler", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return 0;
        return undefined;
      });

      const handler = getIpcHandler(mockIpcHandle, AppSetupChannel.AdvanceStep);
      const result = await handler();
      expect(result.success).toBe(true);
    });
  });

  // ─── goToStep ────────────────────────────────────────────────────────────

  describe("goToStep", () => {
    it("should allow going to a step equal to currentStep", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return 2;
        return undefined;
      });

      const result = await service.goToStep(2);
      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith(SettingsKey.SetupStep, 2);
    });

    it("should allow going back to a previous step", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return 2;
        return undefined;
      });

      const result = await service.goToStep(1);
      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith(SettingsKey.SetupStep, 1);
    });

    it("should allow going one step forward", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return 1;
        return undefined;
      });

      const result = await service.goToStep(2);
      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith(SettingsKey.SetupStep, 2);
    });

    it("should NOT allow skipping ahead more than one step", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return 0;
        return undefined;
      });

      const result = await service.goToStep(2);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot skip ahead");
    });

    it("should NOT allow jumping from step 0 to step 3", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return 0;
        return undefined;
      });

      const result = await service.goToStep(3);
      expect(result.success).toBe(false);
    });

    it("should allow going from step 2 to step 0 (going back)", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return 2;
        return undefined;
      });

      const result = await service.goToStep(0);
      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith(SettingsKey.SetupStep, 0);
    });
  });

  // ─── completeSetup ──────────────────────────────────────────────────────

  describe("completeSetup", () => {
    it("should complete setup when all validations pass", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.InstalledGames) return ["poe1"];
        if (key === SettingsKey.SelectedPoe1League) return "Settlers";
        if (key === SettingsKey.SelectedPoe2League) return "";
        if (key === SettingsKey.Poe1ClientTxtPath)
          return "C:\\Games\\PoE\\logs\\Client.txt";
        if (key === SettingsKey.Poe2ClientTxtPath) return null;
        return undefined;
      });
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isFile: () => true });

      const result = await service.completeSetup();

      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.ActiveGame,
        "poe1",
      );
      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.SetupCompleted,
        true,
      );
      expect(mockSettingsSet).toHaveBeenCalledWith(SettingsKey.SetupStep, 4);
    });

    it("should set activeGame to the first installed game", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.InstalledGames) return ["poe2", "poe1"];
        if (key === SettingsKey.SelectedPoe1League) return "Settlers";
        if (key === SettingsKey.SelectedPoe2League) return "Early Access";
        if (key === SettingsKey.Poe1ClientTxtPath)
          return "C:\\Games\\PoE\\logs\\Client.txt";
        if (key === SettingsKey.Poe2ClientTxtPath)
          return "C:\\Games\\PoE2\\logs\\Client.txt";
        return undefined;
      });
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isFile: () => true });

      const result = await service.completeSetup();
      expect(result.success).toBe(true);
      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.ActiveGame,
        "poe2",
      );
    });

    it("should fail when game selection is invalid", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.InstalledGames) return [];
        if (key === SettingsKey.SelectedPoe1League) return "";
        if (key === SettingsKey.SelectedPoe2League) return "";
        if (key === SettingsKey.Poe1ClientTxtPath) return null;
        if (key === SettingsKey.Poe2ClientTxtPath) return null;
        return undefined;
      });

      const result = await service.completeSetup();
      expect(result.success).toBe(false);
      expect(result.error).toContain("Setup incomplete");
    });

    it("should aggregate errors from all validation steps", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.InstalledGames) return ["poe1", "poe2"];
        if (key === SettingsKey.SelectedPoe1League) return "";
        if (key === SettingsKey.SelectedPoe2League) return "";
        if (key === SettingsKey.Poe1ClientTxtPath) return null;
        if (key === SettingsKey.Poe2ClientTxtPath) return null;
        return undefined;
      });

      const result = await service.completeSetup();
      expect(result.success).toBe(false);
      // Should contain league errors + path errors
      expect(result.error).toContain("Path of Exile 1 league");
      expect(result.error).toContain("Path of Exile 2 league");
      expect(result.error).toContain("Path of Exile 1 Client.txt");
      expect(result.error).toContain("Path of Exile 2 Client.txt");
    });

    it("should work through the IPC handler", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.InstalledGames) return ["poe1"];
        if (key === SettingsKey.SelectedPoe1League) return "Settlers";
        if (key === SettingsKey.SelectedPoe2League) return "";
        if (key === SettingsKey.Poe1ClientTxtPath)
          return "C:\\Games\\PoE\\logs\\Client.txt";
        if (key === SettingsKey.Poe2ClientTxtPath) return null;
        return undefined;
      });
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isFile: () => true });

      const handler = getIpcHandler(
        mockIpcHandle,
        AppSetupChannel.CompleteSetup,
      );
      const result = await handler();
      expect(result.success).toBe(true);
    });
  });

  // ─── resetSetup ──────────────────────────────────────────────────────────

  describe("resetSetup", () => {
    it("should reset setupCompleted to false and setupStep to 0", async () => {
      await service.resetSetup();

      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.SetupCompleted,
        false,
      );
      expect(mockSettingsSet).toHaveBeenCalledWith(SettingsKey.SetupStep, 0);
    });

    it("should work through the IPC handler", async () => {
      const handler = getIpcHandler(mockIpcHandle, AppSetupChannel.ResetSetup);
      await handler();

      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.SetupCompleted,
        false,
      );
      expect(mockSettingsSet).toHaveBeenCalledWith(SettingsKey.SetupStep, 0);
    });
  });

  // ─── skipSetup ───────────────────────────────────────────────────────────

  describe("skipSetup", () => {
    it("should mark setup as completed and set step to 4", async () => {
      await service.skipSetup();

      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.TelemetryCrashReporting,
        true,
      );
      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.TelemetryUsageAnalytics,
        true,
      );
      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.SetupCompleted,
        true,
      );
      expect(mockSettingsSet).toHaveBeenCalledWith(SettingsKey.SetupStep, 4);
    });

    it("should work through the IPC handler", async () => {
      const handler = getIpcHandler(mockIpcHandle, AppSetupChannel.SkipSetup);
      await handler();

      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.TelemetryCrashReporting,
        true,
      );
      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.TelemetryUsageAnalytics,
        true,
      );
      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.SetupCompleted,
        true,
      );
      expect(mockSettingsSet).toHaveBeenCalledWith(SettingsKey.SetupStep, 4);
    });
  });

  // ─── goToStep IPC handler with validation ────────────────────────────────

  describe("goToStep IPC handler", () => {
    it("should call assertSetupStep for input validation", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return 0;
        return undefined;
      });

      const handler = getIpcHandler(mockIpcHandle, AppSetupChannel.GoToStep);
      await handler({}, 1);

      const { assertSetupStep } = await import("~/main/utils/ipc-validation");
      expect(assertSetupStep).toHaveBeenCalledWith(1, AppSetupChannel.GoToStep);
    });

    it("should return validation error when assertSetupStep throws", async () => {
      const { assertSetupStep, handleValidationError } = await import(
        "~/main/utils/ipc-validation"
      );

      const validationError = new Error("Invalid step");
      vi.mocked(assertSetupStep).mockImplementation(() => {
        throw validationError;
      });
      vi.mocked(handleValidationError).mockReturnValue({
        success: false,
        error: "Invalid input: validation error",
      });

      const handler = getIpcHandler(mockIpcHandle, AppSetupChannel.GoToStep);
      const result = await handler({}, 999);

      expect(result).toEqual({
        success: false,
        error: "Invalid input: validation error",
      });
    });
  });

  // ─── Full wizard flow (end-to-end) ───────────────────────────────────────

  describe("full setup wizard flow", () => {
    it("should complete the entire wizard from step 0 to done", async () => {
      let currentStep = 0;

      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return currentStep;
        if (key === SettingsKey.InstalledGames) return ["poe1"];
        if (key === SettingsKey.SelectedPoe1League) return "Settlers";
        if (key === SettingsKey.SelectedPoe2League) return "";
        if (key === SettingsKey.Poe1ClientTxtPath)
          return "C:\\Games\\PoE\\logs\\Client.txt";
        if (key === SettingsKey.Poe2ClientTxtPath) return null;
        return undefined;
      });
      mockSettingsSet.mockImplementation(async (key: string, value: any) => {
        if (key === SettingsKey.SetupStep) currentStep = value;
      });
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isFile: () => true });

      // Step 0 → 1
      let result = await service.advanceStep();
      expect(result.success).toBe(true);
      expect(currentStep).toBe(1);

      // Step 1 → 2
      result = await service.advanceStep();
      expect(result.success).toBe(true);
      expect(currentStep).toBe(2);

      // Step 2 → 3
      result = await service.advanceStep();
      expect(result.success).toBe(true);
      expect(currentStep).toBe(3);

      // Step 3 → 4 (telemetry consent)
      result = await service.advanceStep();
      expect(result.success).toBe(true);
      expect(currentStep).toBe(4);
      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.TelemetryCrashReporting,
        true,
      );
      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.TelemetryUsageAnalytics,
        true,
      );

      // Step 4 → complete (advancing past the last step triggers completeSetup)
      result = await service.advanceStep();
      expect(result.success).toBe(true);
      expect(mockSettingsSet).toHaveBeenCalledWith(
        SettingsKey.SetupCompleted,
        true,
      );
    });

    it("should support going back and re-advancing", async () => {
      let currentStep = 2;

      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return currentStep;
        if (key === SettingsKey.InstalledGames) return ["poe1"];
        if (key === SettingsKey.SelectedPoe1League) return "Settlers";
        if (key === SettingsKey.SelectedPoe2League) return "";
        if (key === SettingsKey.Poe1ClientTxtPath)
          return "C:\\Games\\PoE\\logs\\Client.txt";
        if (key === SettingsKey.Poe2ClientTxtPath) return null;
        return undefined;
      });
      mockSettingsSet.mockImplementation(async (key: string, value: any) => {
        if (key === SettingsKey.SetupStep) currentStep = value;
      });
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isFile: () => true });

      // Go back to step 1
      let result = await service.goToStep(1);
      expect(result.success).toBe(true);
      expect(currentStep).toBe(1);

      // Advance from step 1 → 2
      result = await service.advanceStep();
      expect(result.success).toBe(true);
      expect(currentStep).toBe(2);
    });

    it("should support resetting and restarting the wizard", async () => {
      let currentStep = 3;
      let completed = true;

      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.SetupStep) return currentStep;
        if (key === SettingsKey.SetupCompleted) return completed;
        if (key === SettingsKey.InstalledGames) return ["poe1"];
        return undefined;
      });
      mockSettingsSet.mockImplementation(async (key: string, value: any) => {
        if (key === SettingsKey.SetupStep) currentStep = value;
        if (key === SettingsKey.SetupCompleted) completed = value;
      });

      // Reset
      await service.resetSetup();
      expect(currentStep).toBe(0);
      expect(completed).toBe(false);

      // Should be able to advance again
      const result = await service.advanceStep();
      expect(result.success).toBe(true);
      expect(currentStep).toBe(1);
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle both games with valid configuration for completion", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.InstalledGames) return ["poe1", "poe2"];
        if (key === SettingsKey.SelectedPoe1League) return "Settlers";
        if (key === SettingsKey.SelectedPoe2League) return "Early Access";
        if (key === SettingsKey.Poe1ClientTxtPath)
          return "C:\\Games\\PoE\\logs\\Client.txt";
        if (key === SettingsKey.Poe2ClientTxtPath)
          return "C:\\Games\\PoE2\\logs\\Client.txt";
        return undefined;
      });
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isFile: () => true });

      const result = await service.completeSetup();
      expect(result.success).toBe(true);
    });

    it("should not set selectedGame if installedGames is empty on complete", async () => {
      // This should fail validation before reaching the setActiveGame code
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === SettingsKey.InstalledGames) return [];
        if (key === SettingsKey.SelectedPoe1League) return "";
        if (key === SettingsKey.SelectedPoe2League) return "";
        if (key === SettingsKey.Poe1ClientTxtPath) return null;
        if (key === SettingsKey.Poe2ClientTxtPath) return null;
        return undefined;
      });

      const result = await service.completeSetup();
      expect(result.success).toBe(false);
      expect(mockSettingsSet).not.toHaveBeenCalledWith(
        SettingsKey.ActiveGame,
        expect.anything(),
      );
    });
  });
});
