import fs from "node:fs";
import path from "node:path";
import { ipcMain } from "electron";
import {
  type GameVersion,
  SettingsKey,
  type SetupStep,
} from "../settings-store/SettingsStore.schemas";
import { SettingsStoreService } from "../settings-store/SettingsStore.service";
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
    ipcMain.handle(AppSetupChannel.GetSetupState, () => {
      return this.getSetupState();
    });

    // Check if setup is complete
    ipcMain.handle(AppSetupChannel.IsSetupComplete, () => {
      return this.isSetupComplete();
    });

    // Advance to next step
    ipcMain.handle(AppSetupChannel.AdvanceStep, async () => {
      return await this.advanceStep();
    });

    // Go to specific step
    ipcMain.handle(AppSetupChannel.GoToStep, (_event, step: SetupStep) => {
      return this.goToStep(step);
    });

    // Validate current step
    ipcMain.handle(AppSetupChannel.ValidateCurrentStep, () => {
      return this.validateCurrentStep();
    });

    // Complete setup
    ipcMain.handle(AppSetupChannel.CompleteSetup, () => {
      return this.completeSetup();
    });

    // Reset setup
    ipcMain.handle(AppSetupChannel.ResetSetup, () => {
      return this.resetSetup();
    });

    // Skip setup (for power users)
    ipcMain.handle(AppSetupChannel.SkipSetup, () => {
      return this.skipSetup();
    });
  }

  /**
   * Get the current setup state
   */
  public getSetupState(): SetupState {
    return {
      currentStep: this.settingsStore.get(SettingsKey.SetupStep),
      isComplete: this.settingsStore.get(SettingsKey.SetupCompleted),
      selectedGame: this.settingsStore.get(SettingsKey.InstalledGames),
      poe1League: this.settingsStore.get(SettingsKey.SelectedPoe1League),
      poe2League: this.settingsStore.get(SettingsKey.SelectedPoe2League),
      poe1ClientPath: this.settingsStore.get(SettingsKey.Poe1ClientTxtPath),
      poe2ClientPath: this.settingsStore.get(SettingsKey.Poe2ClientTxtPath),
    };
  }

  /**
   * Check if setup is complete
   */
  public isSetupComplete(): boolean {
    return this.settingsStore.get(SettingsKey.SetupCompleted);
  }

  /**
   * Validate the current setup step
   */
  public validateCurrentStep(): StepValidationResult {
    const currentStep = this.settingsStore.get(SettingsKey.SetupStep);

    switch (currentStep) {
      case SETUP_STEPS.SELECT_GAME:
        return this.validateGameSelection();
      case SETUP_STEPS.SELECT_LEAGUE:
        return this.validateLeagueSelection();
      case SETUP_STEPS.SELECT_CLIENT_PATH:
        return this.validateClientPaths();
      default:
        return { isValid: true, errors: [] };
    }
  }

  /**
   * Validate game selection (Step 1)
   */
  private validateGameSelection(): StepValidationResult {
    const selectedGame = this.settingsStore.get(SettingsKey.InstalledGames);
    const errors: string[] = [];

    if (!selectedGame) {
      errors.push("Please select at least one game");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate league selection (Step 2)
   */
  private validateLeagueSelection(): StepValidationResult {
    const selectedGame = this.settingsStore.get(SettingsKey.InstalledGames);
    const poe1League = this.settingsStore.get(SettingsKey.SelectedPoe1League);
    const poe2League = this.settingsStore.get(SettingsKey.SelectedPoe2League);
    const errors: string[] = [];

    if (selectedGame === "poe1" || selectedGame === "both") {
      if (!poe1League || poe1League.trim() === "") {
        errors.push("Please select a PoE1 league");
      }
    }

    if (selectedGame === "poe2" || selectedGame === "both") {
      if (!poe2League || poe2League.trim() === "") {
        errors.push("Please select a PoE2 league");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate client.txt paths (Step 3)
   */
  private validateClientPaths(): StepValidationResult {
    const selectedGame = this.settingsStore.get(SettingsKey.InstalledGames);
    const poe1Path = this.settingsStore.get(SettingsKey.Poe1ClientTxtPath);
    const poe2Path = this.settingsStore.get(SettingsKey.Poe2ClientTxtPath);
    const errors: string[] = [];

    if (selectedGame === "poe1" || selectedGame === "both") {
      if (!poe1Path) {
        errors.push("Please select PoE1 Client.txt path");
      } else if (!this.isValidClientPath(poe1Path)) {
        errors.push("PoE1 Client.txt path is invalid or file does not exist");
      }
    }

    if (selectedGame === "poe2" || selectedGame === "both") {
      if (!poe2Path) {
        errors.push("Please select PoE2 Client.txt path");
      } else if (!this.isValidClientPath(poe2Path)) {
        errors.push("PoE2 Client.txt path is invalid or file does not exist");
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
      const fileName = path.basename(filePath);
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
    const validation = this.validateCurrentStep();
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(", "),
      };
    }

    const currentStep = this.settingsStore.get(SettingsKey.SetupStep);
    const nextStep = (currentStep + 1) as SetupStep;

    // If we've completed all steps, mark setup as complete
    if (nextStep > SETUP_STEPS.SELECT_CLIENT_PATH) {
      return this.completeSetup();
    }

    this.settingsStore.set(SettingsKey.SetupStep, nextStep);
    return { success: true };
  }

  /**
   * Go to a specific setup step
   */
  public goToStep(step: SetupStep): { success: boolean; error?: string } {
    const currentStep = this.settingsStore.get(SettingsKey.SetupStep);

    // Don't allow skipping ahead
    if (step > currentStep + 1) {
      return {
        success: false,
        error: "Cannot skip ahead in setup",
      };
    }

    this.settingsStore.set(SettingsKey.SetupStep, step);
    return { success: true };
  }

  /**
   * Complete the setup process
   */
  public completeSetup(): { success: boolean; error?: string } {
    // Validate all steps one final time
    const gameValidation = this.validateGameSelection();
    const leagueValidation = this.validateLeagueSelection();
    const pathValidation = this.validateClientPaths();

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

    // Mark setup as complete
    this.settingsStore.set(SettingsKey.SetupCompleted, true);
    this.settingsStore.set(SettingsKey.SetupStep, 3);

    return { success: true };
  }

  /**
   * Reset setup (for re-running the wizard)
   */
  public resetSetup(): void {
    this.settingsStore.set(SettingsKey.SetupCompleted, false);
    this.settingsStore.set(SettingsKey.SetupStep, 0);
    this.settingsStore.set(SettingsKey.TourCompleted, false);
  }

  /**
   * Skip setup (for power users who want to configure manually)
   */
  public skipSetup(): void {
    this.settingsStore.set(SettingsKey.SetupCompleted, true);
    this.settingsStore.set(SettingsKey.SetupStep, 3);
  }
}

export { AppSetupService };
