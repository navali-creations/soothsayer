import fs from "node:fs";

import { ipcMain } from "electron";

import {
  SettingsKey,
  SettingsStoreService,
  type SetupStep,
} from "~/main/modules/settings-store";
import {
  assertSetupStep,
  handleValidationError,
} from "~/main/utils/ipc-validation";

import { AppSetupChannel } from "./AppSetup.channels";
import {
  SETUP_STEPS,
  type SetupState,
  type StepValidationResult,
} from "./AppSetup.types";

class AppSetupService {
  private static _instance: AppSetupService;
  private settingsStore: SettingsStoreService;

  static getInstance() {
    if (!AppSetupService._instance) {
      AppSetupService._instance = new AppSetupService();
    }
    return AppSetupService._instance;
  }

  constructor() {
    this.settingsStore = SettingsStoreService.getInstance();
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    // Get current setup state
    ipcMain.handle(AppSetupChannel.GetSetupState, async () => {
      return await this.getSetupState();
    });

    // Check if setup is complete
    ipcMain.handle(AppSetupChannel.IsSetupComplete, async () => {
      return await this.isSetupComplete();
    });

    // Advance to next step
    ipcMain.handle(AppSetupChannel.AdvanceStep, async () => {
      return await this.advanceStep();
    });

    // Go to specific step
    ipcMain.handle(
      AppSetupChannel.GoToStep,
      async (_event, step: SetupStep) => {
        try {
          assertSetupStep(step, AppSetupChannel.GoToStep);
          return await this.goToStep(step);
        } catch (error) {
          return handleValidationError(error, AppSetupChannel.GoToStep);
        }
      },
    );

    // Validate current step
    ipcMain.handle(AppSetupChannel.ValidateCurrentStep, async () => {
      return await this.validateCurrentStep();
    });

    // Complete setup
    ipcMain.handle(AppSetupChannel.CompleteSetup, async () => {
      return await this.completeSetup();
    });

    // Reset setup
    ipcMain.handle(AppSetupChannel.ResetSetup, async () => {
      return await this.resetSetup();
    });

    // Skip setup (for power users)
    ipcMain.handle(AppSetupChannel.SkipSetup, async () => {
      return await this.skipSetup();
    });
  }

  /**
   * Get the current setup state
   */
  public async getSetupState(): Promise<SetupState> {
    const settings = await this.settingsStore.getAllSettings();

    return {
      currentStep: settings.setupStep,
      isComplete: settings.setupCompleted,
      selectedGames: settings.installedGames,
      poe1League: settings.poe1SelectedLeague,
      poe2League: settings.poe2SelectedLeague,
      poe1ClientPath: settings.poe1ClientTxtPath,
      poe2ClientPath: settings.poe2ClientTxtPath,
      telemetryCrashReporting: settings.telemetryCrashReporting,
      telemetryUsageAnalytics: settings.telemetryUsageAnalytics,
    };
  }

  /**
   * Check if setup is complete
   */
  public async isSetupComplete(): Promise<boolean> {
    return await this.settingsStore.get(SettingsKey.SetupCompleted);
  }

  /**
   * Validate the current setup step
   */
  public async validateCurrentStep(): Promise<StepValidationResult> {
    const currentStep = await this.settingsStore.get(SettingsKey.SetupStep);

    switch (currentStep) {
      case SETUP_STEPS.SELECT_GAME:
        return await this.validateGameSelection();
      case SETUP_STEPS.SELECT_LEAGUE:
        return await this.validateLeagueSelection();
      case SETUP_STEPS.SELECT_CLIENT_PATH:
        return await this.validateClientPaths();
      case SETUP_STEPS.TELEMETRY_CONSENT:
        // No validation required — both toggles off is a valid choice
        return { isValid: true, errors: [] };
      default:
        return { isValid: true, errors: [] };
    }
  }

  /**
   * Validate game selection (Step 1)
   * Now validates that at least one game is selected
   */
  private async validateGameSelection(): Promise<StepValidationResult> {
    const installedGames = await this.settingsStore.get(
      SettingsKey.InstalledGames,
    );
    const errors: string[] = [];

    if (!installedGames || installedGames.length === 0) {
      errors.push("Please select at least one game");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate league selection (Step 2)
   * Validates that each selected game has a league chosen
   */
  private async validateLeagueSelection(): Promise<StepValidationResult> {
    const installedGames = await this.settingsStore.get(
      SettingsKey.InstalledGames,
    );
    const poe1League = await this.settingsStore.get(
      SettingsKey.SelectedPoe1League,
    );
    const poe2League = await this.settingsStore.get(
      SettingsKey.SelectedPoe2League,
    );
    const errors: string[] = [];

    if (installedGames.includes("poe1")) {
      if (!poe1League || poe1League.trim() === "") {
        errors.push("Please select a Path of Exile 1 league");
      }
    }

    if (installedGames.includes("poe2")) {
      if (!poe2League || poe2League.trim() === "") {
        errors.push("Please select a Path of Exile 2 league");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate client.txt paths (Step 3)
   * Validates that each selected game has a valid client.txt path
   */
  private async validateClientPaths(): Promise<StepValidationResult> {
    const installedGames = await this.settingsStore.get(
      SettingsKey.InstalledGames,
    );
    const poe1Path = await this.settingsStore.get(
      SettingsKey.Poe1ClientTxtPath,
    );
    const poe2Path = await this.settingsStore.get(
      SettingsKey.Poe2ClientTxtPath,
    );
    const errors: string[] = [];

    if (installedGames.includes("poe1")) {
      if (!poe1Path) {
        errors.push("Please select Path of Exile 1 Client.txt path");
      } else if (!this.isValidClientPath(poe1Path)) {
        errors.push(
          "Path of Exile 1 Client.txt path is invalid or file does not exist",
        );
      }
    }

    if (installedGames.includes("poe2")) {
      if (!poe2Path) {
        errors.push("Please select Path of Exile 2 Client.txt path");
      } else if (!this.isValidClientPath(poe2Path)) {
        errors.push(
          "Path of Exile 2 Client.txt path is invalid or file does not exist",
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if a client.txt path is valid
   */
  private isValidClientPath(filePath: string): boolean {
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return false;
      }

      // Check if it's a file (not a directory)
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return false;
      }

      // Check if filename is Client.txt (case-insensitive)
      // Split on both \ and / to handle Windows paths on any platform
      const fileName = filePath.split(/[\\/]/).pop() || "";
      if (fileName.toLowerCase() !== "client.txt") {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error validating client path:", error);
      return false;
    }
  }

  /**
   * Advance to the next setup step
   */
  public async advanceStep(): Promise<{ success: boolean; error?: string }> {
    // Validate current step before advancing
    const validation = await this.validateCurrentStep();
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(", "),
      };
    }

    const currentStep = await this.settingsStore.get(SettingsKey.SetupStep);
    const nextStep = (currentStep + 1) as SetupStep;

    // If we've completed all steps, mark setup as complete
    if (nextStep > SETUP_STEPS.TELEMETRY_CONSENT) {
      return await this.completeSetup();
    }

    // When entering the telemetry consent step for the first time,
    // default both toggles to ON (opt-out model for new users).
    // Existing users upgrading already have these defaulted to 0 via migration.
    if (nextStep === SETUP_STEPS.TELEMETRY_CONSENT) {
      await this.settingsStore.set(SettingsKey.TelemetryCrashReporting, true);
      await this.settingsStore.set(SettingsKey.TelemetryUsageAnalytics, true);
    }

    await this.settingsStore.set(SettingsKey.SetupStep, nextStep);
    return { success: true };
  }

  /**
   * Go to a specific setup step
   */
  public async goToStep(
    step: SetupStep,
  ): Promise<{ success: boolean; error?: string }> {
    const currentStep = await this.settingsStore.get(SettingsKey.SetupStep);

    // Don't allow skipping ahead
    if (step > currentStep + 1) {
      return {
        success: false,
        error: "Cannot skip ahead in setup",
      };
    }

    await this.settingsStore.set(SettingsKey.SetupStep, step);
    return { success: true };
  }

  /**
   * Complete the setup process
   */
  public async completeSetup(): Promise<{ success: boolean; error?: string }> {
    // Validate all steps one final time
    const gameValidation = await this.validateGameSelection();
    const leagueValidation = await this.validateLeagueSelection();
    const pathValidation = await this.validateClientPaths();

    const allErrors = [
      ...gameValidation.errors,
      ...leagueValidation.errors,
      ...pathValidation.errors,
    ];

    if (allErrors.length > 0) {
      return {
        success: false,
        error: `Setup incomplete: ${allErrors.join(", ")}`,
      };
    }

    // Set the active game to the first installed game
    const installedGames = await this.settingsStore.get(
      SettingsKey.InstalledGames,
    );
    if (installedGames.length > 0) {
      await this.settingsStore.set(SettingsKey.ActiveGame, installedGames[0]);
    }

    // Mark setup as complete
    await this.settingsStore.set(SettingsKey.SetupCompleted, true);
    await this.settingsStore.set(SettingsKey.SetupStep, 4);

    return { success: true };
  }

  /**
   * Reset setup (for re-running the wizard)
   */
  public async resetSetup(): Promise<void> {
    await this.settingsStore.set(SettingsKey.SetupCompleted, false);
    await this.settingsStore.set(SettingsKey.SetupStep, 0);
  }

  /**
   * Skip setup (for power users who want to configure manually)
   */
  public async skipSetup(): Promise<void> {
    // When skipping, enable telemetry by default (opt-out model for new users)
    await this.settingsStore.set(SettingsKey.TelemetryCrashReporting, true);
    await this.settingsStore.set(SettingsKey.TelemetryUsageAnalytics, true);
    await this.settingsStore.set(SettingsKey.SetupCompleted, true);
    await this.settingsStore.set(SettingsKey.SetupStep, 4);
  }
}

export { AppSetupService };
