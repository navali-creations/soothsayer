import { ipcRenderer } from "electron";
import type { SetupStep } from "~/electron/modules/settings-store";
import { AppSetupChannel } from "./AppSetup.channels";
import type { SetupState, StepValidationResult } from "./AppSetup.types";

const AppSetupAPI = {
  getSetupState: (): Promise<SetupState> =>
    ipcRenderer.invoke(AppSetupChannel.GetSetupState),

  isSetupComplete: (): Promise<boolean> =>
    ipcRenderer.invoke(AppSetupChannel.IsSetupComplete),

  advanceStep: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(AppSetupChannel.AdvanceStep),

  goToStep: (step: SetupStep): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(AppSetupChannel.GoToStep, step),

  validateCurrentStep: (): Promise<StepValidationResult> =>
    ipcRenderer.invoke(AppSetupChannel.ValidateCurrentStep),

  completeSetup: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(AppSetupChannel.CompleteSetup),

  resetSetup: (): Promise<void> =>
    ipcRenderer.invoke(AppSetupChannel.ResetSetup),

  skipSetup: (): Promise<void> => ipcRenderer.invoke(AppSetupChannel.SkipSetup),
};

export { AppSetupAPI };
