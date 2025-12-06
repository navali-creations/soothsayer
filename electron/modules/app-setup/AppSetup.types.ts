import type {
  GameVersion,
  SetupStep,
} from "../settings-store/SettingsStore.schemas";

/**
 * Setup step names for clarity
 */
export const SETUP_STEPS = {
  NOT_STARTED: 0,
  SELECT_GAME: 1,
  SELECT_LEAGUE: 2,
  SELECT_CLIENT_PATH: 3,
} as const;

/**
 * Setup state for tracking progress
 */
export type SetupState = {
  currentStep: SetupStep;
  isComplete: boolean;
  selectedGame?: GameVersion;
  poe1League?: string;
  poe2League?: string;
  poe1ClientPath?: string;
  poe2ClientPath?: string;
};

/**
 * Validation result for each step
 */
export type StepValidationResult = {
  isValid: boolean;
  errors: string[];
};

export type SetupStepType = (typeof SETUP_STEPS)[keyof typeof SETUP_STEPS];
