import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
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
vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: vi.fn(() => ({
      get: mockSettingsGet,
      set: mockSettingsSet,
      getAllSettings: mockSettingsGetAllSettings,
    })),
  },
  SettingsKey: {
    ActiveGame: "selectedGame",
    InstalledGames: "installedGames",
    SetupCompleted: "setupCompleted",
    SetupStep: "setupStep",
  },
}));

// ─── Mock ipc-validation ─────────────────────────────────────────────────────
vi.mock("~/main/utils/ipc-validation", () => ({
  assertSetupStep: vi.fn(),
  handleValidationError: vi.fn((_error: unknown, _channel: string) => ({
    success: false,
    error: "Invalid input: validation error",
  })),
}));

// ─── Import under test (after mocks) ────────────────────────────────────────
import { AppSetupChannel } from "../AppSetup.channels";
import { AppSetupService } from "../AppSetup.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getIpcHandler(channel: string): (...args: any[]) => Promise<any> {
  const call = mockIpcHandle.mock.calls.find(
    ([ch]: [string]) => ch === channel,
  );
  if (!call) {
    throw new Error(`ipcMain.handle was not called with "${channel}"`);
  }
  return call[1];
}

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
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AppSetupService", () => {
  let service: AppSetupService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    AppSetupService._instance = undefined;

    // Default mock implementations
    mockSettingsGet.mockImplementation(async (key: string) => {
      const defaults: Record<string, any> = {
        setupStep: 0,
        setupCompleted: false,
        selectedGame: "poe1",
        installedGames: ["poe1"],
        poe1SelectedLeague: "Settlers",
        poe2SelectedLeague: "",
        poe1ClientTxtPath: "C:\\Games\\PoE\\logs\\Client.txt",
        poe2ClientTxtPath: null,
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
      const handler = getIpcHandler(AppSetupChannel.GetSetupState);
      const result = await handler();

      expect(result).toHaveProperty("currentStep");
      expect(result).toHaveProperty("isComplete");
    });
  });

  // ─── isSetupComplete ─────────────────────────────────────────────────────

  describe("isSetupComplete", () => {
    it("should return false when setup is not completed", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupCompleted") return false;
        return undefined;
      });

      const result = await service.isSetupComplete();
      expect(result).toBe(false);
    });

    it("should return true when setup is completed", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupCompleted") return true;
        return undefined;
      });

      const result = await service.isSetupComplete();
      expect(result).toBe(true);
    });

    it("should work through the IPC handler", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupCompleted") return true;
        return undefined;
      });

      const handler = getIpcHandler(AppSetupChannel.IsSetupComplete);
      const result = await handler();
      expect(result).toBe(true);
    });
  });

  // ─── validateCurrentStep ─────────────────────────────────────────────────

  describe("validateCurrentStep", () => {
    describe("step 0 (NOT_STARTED)", () => {
      it("should return valid for step 0 (default/unknown step)", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === "setupStep") return 0;
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result).toEqual({ isValid: true, errors: [] });
      });
    });

    describe("step 1 (SELECT_GAME)", () => {
      it("should return valid when at least one game is installed", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === "setupStep") return 1;
          if (key === "installedGames") return ["poe1"];
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should return invalid when no games are installed", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === "setupStep") return 1;
          if (key === "installedGames") return [];
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain("Please select at least one game");
      });

      it("should return invalid when installedGames is null/undefined", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === "setupStep") return 1;
          if (key === "installedGames") return null;
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should return valid when both games are installed", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === "setupStep") return 1;
          if (key === "installedGames") return ["poe1", "poe2"];
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(true);
      });
    });

    describe("step 2 (SELECT_LEAGUE)", () => {
      it("should return valid when poe1 league is selected for poe1 game", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === "setupStep") return 2;
          if (key === "installedGames") return ["poe1"];
          if (key === "poe1SelectedLeague") return "Settlers";
          if (key === "poe2SelectedLeague") return "";
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it("should return invalid when poe1 has no league selected", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === "setupStep") return 2;
          if (key === "installedGames") return ["poe1"];
          if (key === "poe1SelectedLeague") return "";
          if (key === "poe2SelectedLeague") return "";
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
          if (key === "setupStep") return 2;
          if (key === "installedGames") return ["poe2"];
          if (key === "poe1SelectedLeague") return "";
          if (key === "poe2SelectedLeague") return "";
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
          if (key === "setupStep") return 2;
          if (key === "installedGames") return ["poe1", "poe2"];
          if (key === "poe1SelectedLeague") return "";
          if (key === "poe2SelectedLeague") return null;
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(2);
      });

      it("should return valid when both games have leagues selected", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === "setupStep") return 2;
          if (key === "installedGames") return ["poe1", "poe2"];
          if (key === "poe1SelectedLeague") return "Settlers";
          if (key === "poe2SelectedLeague") return "Early Access";
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(true);
      });

      it("should ignore poe2 league validation when only poe1 is installed", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === "setupStep") return 2;
          if (key === "installedGames") return ["poe1"];
          if (key === "poe1SelectedLeague") return "Settlers";
          if (key === "poe2SelectedLeague") return "";
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(true);
      });

      it("should treat whitespace-only league as empty", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === "setupStep") return 2;
          if (key === "installedGames") return ["poe1"];
          if (key === "poe1SelectedLeague") return "   ";
          if (key === "poe2SelectedLeague") return "";
          return undefined;
        });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
      });
    });

    describe("step 3 (SELECT_CLIENT_PATH)", () => {
      it("should return valid when poe1 has a valid client path", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === "setupStep") return 3;
          if (key === "installedGames") return ["poe1"];
          if (key === "poe1ClientTxtPath")
            return "C:\\Games\\PoE\\logs\\Client.txt";
          if (key === "poe2ClientTxtPath") return null;
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
          if (key === "setupStep") return 3;
          if (key === "installedGames") return ["poe1"];
          if (key === "poe1ClientTxtPath") return null;
          if (key === "poe2ClientTxtPath") return null;
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
          if (key === "setupStep") return 3;
          if (key === "installedGames") return ["poe1"];
          if (key === "poe1ClientTxtPath") return "C:\\Nonexistent\\Client.txt";
          if (key === "poe2ClientTxtPath") return null;
          return undefined;
        });
        mockExistsSync.mockReturnValue(false);

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain("invalid or file does not exist");
      });

      it("should return invalid when path points to a directory", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === "setupStep") return 3;
          if (key === "installedGames") return ["poe1"];
          if (key === "poe1ClientTxtPath") return "C:\\Games\\PoE\\logs";
          if (key === "poe2ClientTxtPath") return null;
          return undefined;
        });
        mockExistsSync.mockReturnValue(true);
        mockStatSync.mockReturnValue({ isFile: () => false });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
      });

      it("should return invalid when filename is not Client.txt", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === "setupStep") return 3;
          if (key === "installedGames") return ["poe1"];
          if (key === "poe1ClientTxtPath")
            return "C:\\Games\\PoE\\logs\\notclient.txt";
          if (key === "poe2ClientTxtPath") return null;
          return undefined;
        });
        mockExistsSync.mockReturnValue(true);
        mockStatSync.mockReturnValue({ isFile: () => true });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(false);
      });

      it("should accept Client.txt case-insensitively", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === "setupStep") return 3;
          if (key === "installedGames") return ["poe1"];
          if (key === "poe1ClientTxtPath")
            return "C:\\Games\\PoE\\logs\\CLIENT.TXT";
          if (key === "poe2ClientTxtPath") return null;
          return undefined;
        });
        mockExistsSync.mockReturnValue(true);
        mockStatSync.mockReturnValue({ isFile: () => true });

        const result = await service.validateCurrentStep();
        expect(result.isValid).toBe(true);
      });

      it("should validate both poe1 and poe2 paths when both games installed", async () => {
        mockSettingsGet.mockImplementation(async (key: string) => {
          if (key === "setupStep") return 3;
          if (key === "installedGames") return ["poe1", "poe2"];
          if (key === "poe1ClientTxtPath") return null;
          if (key === "poe2ClientTxtPath") return null;
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
          if (key === "setupStep") return 3;
          if (key === "installedGames") return ["poe1"];
          if (key === "poe1ClientTxtPath")
            return "C:\\Games\\PoE\\logs\\Client.txt";
          if (key === "poe2ClientTxtPath") return null;
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
        if (key === "setupStep") return 1;
        if (key === "installedGames") return ["poe1"];
        return undefined;
      });

      const handler = getIpcHandler(AppSetupChannel.ValidateCurrentStep);
      const result = await handler();
      expect(result.isValid).toBe(true);
    });
  });

  // ─── advanceStep ─────────────────────────────────────────────────────────

  describe("advanceStep", () => {
    it("should advance from step 0 to step 1 when validation passes", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupStep") return 0;
        return undefined;
      });

      const result = await service.advanceStep();
      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith("setupStep", 1);
    });

    it("should advance from step 1 to step 2 when game is selected", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupStep") return 1;
        if (key === "installedGames") return ["poe1"];
        return undefined;
      });

      const result = await service.advanceStep();
      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith("setupStep", 2);
    });

    it("should advance from step 2 to step 3 when league is selected", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupStep") return 2;
        if (key === "installedGames") return ["poe1"];
        if (key === "poe1SelectedLeague") return "Settlers";
        if (key === "poe2SelectedLeague") return "";
        return undefined;
      });

      const result = await service.advanceStep();
      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith("setupStep", 3);
    });

    it("should fail to advance when validation fails", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupStep") return 1;
        if (key === "installedGames") return [];
        return undefined;
      });

      const result = await service.advanceStep();
      expect(result.success).toBe(false);
      expect(result.error).toContain("Please select at least one game");
    });

    it("should complete setup when advancing past the last step", async () => {
      // Step 3 is SELECT_CLIENT_PATH — advancing past it should complete setup
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupStep") return 3;
        if (key === "installedGames") return ["poe1"];
        if (key === "poe1SelectedLeague") return "Settlers";
        if (key === "poe2SelectedLeague") return "";
        if (key === "poe1ClientTxtPath")
          return "C:\\Games\\PoE\\logs\\Client.txt";
        if (key === "poe2ClientTxtPath") return null;
        return undefined;
      });
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isFile: () => true });

      const result = await service.advanceStep();
      expect(result.success).toBe(true);
      expect(mockSettingsSet).toHaveBeenCalledWith("setupCompleted", true);
    });

    it("should work through the IPC handler", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupStep") return 0;
        return undefined;
      });

      const handler = getIpcHandler(AppSetupChannel.AdvanceStep);
      const result = await handler();
      expect(result.success).toBe(true);
    });
  });

  // ─── goToStep ────────────────────────────────────────────────────────────

  describe("goToStep", () => {
    it("should allow going to a step equal to currentStep", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupStep") return 2;
        return undefined;
      });

      const result = await service.goToStep(2);
      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith("setupStep", 2);
    });

    it("should allow going back to a previous step", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupStep") return 2;
        return undefined;
      });

      const result = await service.goToStep(1);
      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith("setupStep", 1);
    });

    it("should allow going one step forward", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupStep") return 1;
        return undefined;
      });

      const result = await service.goToStep(2);
      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith("setupStep", 2);
    });

    it("should NOT allow skipping ahead more than one step", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupStep") return 0;
        return undefined;
      });

      const result = await service.goToStep(2);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Cannot skip ahead");
    });

    it("should NOT allow jumping from step 0 to step 3", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupStep") return 0;
        return undefined;
      });

      const result = await service.goToStep(3);
      expect(result.success).toBe(false);
    });

    it("should allow going from step 2 to step 0 (going back)", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupStep") return 2;
        return undefined;
      });

      const result = await service.goToStep(0);
      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith("setupStep", 0);
    });
  });

  // ─── completeSetup ──────────────────────────────────────────────────────

  describe("completeSetup", () => {
    it("should complete setup when all validations pass", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "installedGames") return ["poe1"];
        if (key === "poe1SelectedLeague") return "Settlers";
        if (key === "poe2SelectedLeague") return "";
        if (key === "poe1ClientTxtPath")
          return "C:\\Games\\PoE\\logs\\Client.txt";
        if (key === "poe2ClientTxtPath") return null;
        return undefined;
      });
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isFile: () => true });

      const result = await service.completeSetup();

      expect(result).toEqual({ success: true });
      expect(mockSettingsSet).toHaveBeenCalledWith("selectedGame", "poe1");
      expect(mockSettingsSet).toHaveBeenCalledWith("setupCompleted", true);
      expect(mockSettingsSet).toHaveBeenCalledWith("setupStep", 3);
    });

    it("should set activeGame to the first installed game", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "installedGames") return ["poe2", "poe1"];
        if (key === "poe1SelectedLeague") return "Settlers";
        if (key === "poe2SelectedLeague") return "Early Access";
        if (key === "poe1ClientTxtPath")
          return "C:\\Games\\PoE\\logs\\Client.txt";
        if (key === "poe2ClientTxtPath")
          return "C:\\Games\\PoE2\\logs\\Client.txt";
        return undefined;
      });
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isFile: () => true });

      const result = await service.completeSetup();
      expect(result.success).toBe(true);
      expect(mockSettingsSet).toHaveBeenCalledWith("selectedGame", "poe2");
    });

    it("should fail when game selection is invalid", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "installedGames") return [];
        if (key === "poe1SelectedLeague") return "";
        if (key === "poe2SelectedLeague") return "";
        if (key === "poe1ClientTxtPath") return null;
        if (key === "poe2ClientTxtPath") return null;
        return undefined;
      });

      const result = await service.completeSetup();
      expect(result.success).toBe(false);
      expect(result.error).toContain("Setup incomplete");
    });

    it("should aggregate errors from all validation steps", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "installedGames") return ["poe1", "poe2"];
        if (key === "poe1SelectedLeague") return "";
        if (key === "poe2SelectedLeague") return "";
        if (key === "poe1ClientTxtPath") return null;
        if (key === "poe2ClientTxtPath") return null;
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
        if (key === "installedGames") return ["poe1"];
        if (key === "poe1SelectedLeague") return "Settlers";
        if (key === "poe2SelectedLeague") return "";
        if (key === "poe1ClientTxtPath")
          return "C:\\Games\\PoE\\logs\\Client.txt";
        if (key === "poe2ClientTxtPath") return null;
        return undefined;
      });
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isFile: () => true });

      const handler = getIpcHandler(AppSetupChannel.CompleteSetup);
      const result = await handler();
      expect(result.success).toBe(true);
    });
  });

  // ─── resetSetup ──────────────────────────────────────────────────────────

  describe("resetSetup", () => {
    it("should reset setupCompleted to false and setupStep to 0", async () => {
      await service.resetSetup();

      expect(mockSettingsSet).toHaveBeenCalledWith("setupCompleted", false);
      expect(mockSettingsSet).toHaveBeenCalledWith("setupStep", 0);
    });

    it("should work through the IPC handler", async () => {
      const handler = getIpcHandler(AppSetupChannel.ResetSetup);
      await handler();

      expect(mockSettingsSet).toHaveBeenCalledWith("setupCompleted", false);
      expect(mockSettingsSet).toHaveBeenCalledWith("setupStep", 0);
    });
  });

  // ─── skipSetup ───────────────────────────────────────────────────────────

  describe("skipSetup", () => {
    it("should mark setup as completed and set step to 3", async () => {
      await service.skipSetup();

      expect(mockSettingsSet).toHaveBeenCalledWith("setupCompleted", true);
      expect(mockSettingsSet).toHaveBeenCalledWith("setupStep", 3);
    });

    it("should work through the IPC handler", async () => {
      const handler = getIpcHandler(AppSetupChannel.SkipSetup);
      await handler();

      expect(mockSettingsSet).toHaveBeenCalledWith("setupCompleted", true);
      expect(mockSettingsSet).toHaveBeenCalledWith("setupStep", 3);
    });
  });

  // ─── goToStep IPC handler with validation ────────────────────────────────

  describe("goToStep IPC handler", () => {
    it("should call assertSetupStep for input validation", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupStep") return 0;
        return undefined;
      });

      const handler = getIpcHandler(AppSetupChannel.GoToStep);
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

      const handler = getIpcHandler(AppSetupChannel.GoToStep);
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
        if (key === "setupStep") return currentStep;
        if (key === "installedGames") return ["poe1"];
        if (key === "poe1SelectedLeague") return "Settlers";
        if (key === "poe2SelectedLeague") return "";
        if (key === "poe1ClientTxtPath")
          return "C:\\Games\\PoE\\logs\\Client.txt";
        if (key === "poe2ClientTxtPath") return null;
        return undefined;
      });
      mockSettingsSet.mockImplementation(async (key: string, value: any) => {
        if (key === "setupStep") currentStep = value;
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

      // Step 3 → complete (advancing past the last step triggers completeSetup)
      result = await service.advanceStep();
      expect(result.success).toBe(true);
      expect(mockSettingsSet).toHaveBeenCalledWith("setupCompleted", true);
    });

    it("should support going back and re-advancing", async () => {
      let currentStep = 2;

      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "setupStep") return currentStep;
        if (key === "installedGames") return ["poe1"];
        if (key === "poe1SelectedLeague") return "Settlers";
        if (key === "poe2SelectedLeague") return "";
        if (key === "poe1ClientTxtPath")
          return "C:\\Games\\PoE\\logs\\Client.txt";
        if (key === "poe2ClientTxtPath") return null;
        return undefined;
      });
      mockSettingsSet.mockImplementation(async (key: string, value: any) => {
        if (key === "setupStep") currentStep = value;
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
        if (key === "setupStep") return currentStep;
        if (key === "setupCompleted") return completed;
        if (key === "installedGames") return ["poe1"];
        return undefined;
      });
      mockSettingsSet.mockImplementation(async (key: string, value: any) => {
        if (key === "setupStep") currentStep = value;
        if (key === "setupCompleted") completed = value;
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
        if (key === "installedGames") return ["poe1", "poe2"];
        if (key === "poe1SelectedLeague") return "Settlers";
        if (key === "poe2SelectedLeague") return "Early Access";
        if (key === "poe1ClientTxtPath")
          return "C:\\Games\\PoE\\logs\\Client.txt";
        if (key === "poe2ClientTxtPath")
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
        if (key === "installedGames") return [];
        if (key === "poe1SelectedLeague") return "";
        if (key === "poe2SelectedLeague") return "";
        if (key === "poe1ClientTxtPath") return null;
        if (key === "poe2ClientTxtPath") return null;
        return undefined;
      });

      const result = await service.completeSetup();
      expect(result.success).toBe(false);
      expect(mockSettingsSet).not.toHaveBeenCalledWith(
        "selectedGame",
        expect.anything(),
      );
    });
  });
});
