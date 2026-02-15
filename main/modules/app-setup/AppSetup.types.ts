import type { SetupStep } from "~/main/modules/settings-store";

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
 * Game selection type for analytics
 */
export type GameSelectionType = "poe1_only" | "poe2_only" | "both";

/**
 * Helper to determine game selection type from array
 */
export function getGameSelectionType(
  games: ("poe1" | "poe2")[],
): GameSelectionType {
  const hasPoe1 = games.includes("poe1");
  const hasPoe2 = games.includes("poe2");

  if (hasPoe1 && hasPoe2) return "both";
  if (hasPoe2) return "poe2_only";
  return "poe1_only";
}

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
};

/**
 * Validation result for each step
 */
export type StepValidationResult = {
  isValid: boolean;
  errors: string[];
};

export type SetupStepType = (typeof SETUP_STEPS)[keyof typeof SETUP_STEPS];
