import type { SetupStep } from "~/main/modules/settings-store";

/**
 * Setup step names for clarity
 */
export const SETUP_STEPS = {
  NOT_STARTED: 0,
  SELECT_GAME: 1,
  SELECT_LEAGUE: 2,
  SELECT_CLIENT_PATH: 3,
  TELEMETRY_CONSENT: 4,
} as const;

/**
 * Setup state for tracking progress
 */
export type SetupState = {
  currentStep: SetupStep;
  isComplete: boolean;
  /** Array of games the user has selected to play */
  selectedGames: ("poe1" | "poe2")[];
  poe1League: string;
  poe2League: string;
  poe1ClientPath: string | null;
  poe2ClientPath: string | null;
  /** Whether the user has opted in to crash reporting (Sentry) */
  telemetryCrashReporting: boolean;
};

/**
 * Validation result for each step
 */
export type StepValidationResult = {
  isValid: boolean;
  errors: string[];
};

export type SetupStepType = (typeof SETUP_STEPS)[keyof typeof SETUP_STEPS];
