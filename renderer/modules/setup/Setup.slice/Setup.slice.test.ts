import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SetupState } from "~/main/modules/app-setup/AppSetup.types";
import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";
import { trackEvent } from "~/renderer/modules/umami";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeSetupState(overrides: Partial<SetupState> = {}): SetupState {
  return {
    currentStep: 1,
    isComplete: false,
    selectedGames: ["poe1"],
    poe1League: "Standard",
    poe2League: "Standard",
    poe1ClientPath: null,
    poe2ClientPath: null,
    telemetryCrashReporting: false,
    telemetryUsageAnalytics: false,
    ...overrides,
  };
}

// ─── Test suite ────────────────────────────────────────────────────────────

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  vi.mocked(trackEvent).mockClear();
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. Initial State
// ═══════════════════════════════════════════════════════════════════════════

describe("initial state", () => {
  it("has null setupState", () => {
    expect(store.getState().setup.setupState).toBeNull();
  });

  it("has null validation", () => {
    expect(store.getState().setup.validation).toBeNull();
  });

  it("has isLoading false", () => {
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("has null error", () => {
    expect(store.getState().setup.error).toBeNull();
  });

  it("has null setupStartTime", () => {
    expect(store.getState().setup.setupStartTime).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. hydrate
// ═══════════════════════════════════════════════════════════════════════════

describe("hydrate", () => {
  it("sets isLoading true during hydration and false after", async () => {
    const state = makeSetupState();
    electron.appSetup.getSetupState.mockResolvedValue(state);

    const promise = store.getState().setup.hydrate();
    // isLoading should be true synchronously after call
    expect(store.getState().setup.isLoading).toBe(true);
    expect(store.getState().setup.error).toBeNull();

    await promise;
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("sets setupState on success", async () => {
    const state = makeSetupState({
      currentStep: 2,
      selectedGames: ["poe1", "poe2"],
    });
    electron.appSetup.getSetupState.mockResolvedValue(state);

    await store.getState().setup.hydrate();

    expect(store.getState().setup.setupState).toEqual(state);
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("sets error on failure and clears isLoading", async () => {
    electron.appSetup.getSetupState.mockRejectedValue(new Error("IPC failed"));

    await store.getState().setup.hydrate();

    expect(store.getState().setup.error).toBe("IPC failed");
    expect(store.getState().setup.isLoading).toBe(false);
    expect(store.getState().setup.setupState).toBeNull();
  });

  it("sets 'Unknown error' for non-Error thrown values", async () => {
    electron.appSetup.getSetupState.mockRejectedValue("string error");

    await store.getState().setup.hydrate();

    expect(store.getState().setup.error).toBe("Unknown error");
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("clears previous error before hydrating", async () => {
    // First call fails
    electron.appSetup.getSetupState.mockRejectedValueOnce(new Error("fail"));
    await store.getState().setup.hydrate();
    expect(store.getState().setup.error).toBe("fail");

    // Second call succeeds
    electron.appSetup.getSetupState.mockResolvedValue(makeSetupState());
    await store.getState().setup.hydrate();
    expect(store.getState().setup.error).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. validateCurrentStep
// ═══════════════════════════════════════════════════════════════════════════

describe("validateCurrentStep", () => {
  it("sets validation result on success", async () => {
    const validation = { isValid: true, errors: [] };
    electron.appSetup.validateCurrentStep.mockResolvedValue(validation);

    await store.getState().setup.validateCurrentStep();

    expect(store.getState().setup.validation).toEqual(validation);
  });

  it("sets validation with errors", async () => {
    const validation = { isValid: false, errors: ["Game is required"] };
    electron.appSetup.validateCurrentStep.mockResolvedValue(validation);

    await store.getState().setup.validateCurrentStep();

    expect(store.getState().setup.validation).toEqual(validation);
    expect(store.getState().setup.validation!.errors).toHaveLength(1);
  });

  it("sets error on failure", async () => {
    electron.appSetup.validateCurrentStep.mockRejectedValue(
      new Error("Validation IPC failed"),
    );

    await store.getState().setup.validateCurrentStep();

    expect(store.getState().setup.error).toBe("Validation IPC failed");
  });

  it("sets 'Validation failed' for non-Error thrown values", async () => {
    electron.appSetup.validateCurrentStep.mockRejectedValue("boom");

    await store.getState().setup.validateCurrentStep();

    expect(store.getState().setup.error).toBe("Validation failed");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. toggleGame
// ═══════════════════════════════════════════════════════════════════════════

describe("toggleGame", () => {
  it("adds poe2 when only poe1 is selected", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe1"] });
    const updatedState = makeSetupState({ selectedGames: ["poe1", "poe2"] });

    // Seed setup state
    store.getState().setup.setSetupState(initialState);

    electron.appSetup.getSetupState.mockResolvedValue(updatedState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store.getState().setup.toggleGame("poe2");

    // Should call settings.set for installedGames with both games (sorted)
    expect(electron.settings.set).toHaveBeenCalledWith("installedGames", [
      "poe1",
      "poe2",
    ]);
    // selectedGame should be set to first game
    expect(electron.settings.set).toHaveBeenCalledWith("selectedGame", "poe1");
    expect(store.getState().setup.setupState).toEqual(updatedState);
  });

  it("removes poe1 when both are selected", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe1", "poe2"] });
    const updatedState = makeSetupState({ selectedGames: ["poe2"] });

    store.getState().setup.setSetupState(initialState);

    electron.appSetup.getSetupState.mockResolvedValue(updatedState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store.getState().setup.toggleGame("poe1");

    expect(electron.settings.set).toHaveBeenCalledWith("installedGames", [
      "poe2",
    ]);
    expect(electron.settings.set).toHaveBeenCalledWith("selectedGame", "poe2");
  });

  it("does not remove the last remaining game", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe1"] });

    store.getState().setup.setSetupState(initialState);

    await store.getState().setup.toggleGame("poe1");

    // Should NOT call settings.set because we can't remove the last game
    expect(electron.settings.set).not.toHaveBeenCalled();
    expect(electron.appSetup.getSetupState).not.toHaveBeenCalled();
  });

  it("tracks setup-game-toggled event with action 'added'", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe1"] });
    const updatedState = makeSetupState({ selectedGames: ["poe1", "poe2"] });

    store.getState().setup.setSetupState(initialState);
    electron.appSetup.getSetupState.mockResolvedValue(updatedState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store.getState().setup.toggleGame("poe2");

    expect(trackEvent).toHaveBeenCalledWith("setup-game-toggled", {
      game: "poe2",
      action: "added",
      games: ["poe1", "poe2"],
      selection_type: "both",
    });
  });

  it("tracks setup-game-toggled event with action 'removed'", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe1", "poe2"] });
    const updatedState = makeSetupState({ selectedGames: ["poe2"] });

    store.getState().setup.setSetupState(initialState);
    electron.appSetup.getSetupState.mockResolvedValue(updatedState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store.getState().setup.toggleGame("poe1");

    expect(trackEvent).toHaveBeenCalledWith("setup-game-toggled", {
      game: "poe1",
      action: "removed",
      games: ["poe2"],
      selection_type: "poe2_only",
    });
  });

  it("refreshes setup state and re-validates after toggle", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe1"] });
    const updatedState = makeSetupState({ selectedGames: ["poe1", "poe2"] });

    store.getState().setup.setSetupState(initialState);
    electron.appSetup.getSetupState.mockResolvedValue(updatedState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store.getState().setup.toggleGame("poe2");

    expect(electron.appSetup.getSetupState).toHaveBeenCalledTimes(1);
    expect(electron.appSetup.validateCurrentStep).toHaveBeenCalledTimes(1);
    expect(store.getState().setup.setupState).toEqual(updatedState);
  });

  it("sorts games for consistent order (poe1 before poe2)", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe2"] });
    const updatedState = makeSetupState({ selectedGames: ["poe1", "poe2"] });

    store.getState().setup.setSetupState(initialState);
    electron.appSetup.getSetupState.mockResolvedValue(updatedState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store.getState().setup.toggleGame("poe1");

    // Even though poe1 was added to ["poe2"], the result should be sorted
    expect(electron.settings.set).toHaveBeenCalledWith("installedGames", [
      "poe1",
      "poe2",
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. selectLeague
// ═══════════════════════════════════════════════════════════════════════════

describe("selectLeague", () => {
  it("updates poe1 league setting", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe1"] });
    const updatedState = makeSetupState({
      selectedGames: ["poe1"],
      poe1League: "Settlers",
    });

    store.getState().setup.setSetupState(initialState);
    electron.appSetup.getSetupState.mockResolvedValue(updatedState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store.getState().setup.selectLeague("poe1", "Settlers");

    expect(electron.settings.set).toHaveBeenCalledWith(
      "poe1SelectedLeague",
      "Settlers",
    );
  });

  it("updates poe2 league setting", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe2"] });
    const updatedState = makeSetupState({
      selectedGames: ["poe2"],
      poe2League: "Dawn",
    });

    store.getState().setup.setSetupState(initialState);
    electron.appSetup.getSetupState.mockResolvedValue(updatedState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store.getState().setup.selectLeague("poe2", "Dawn");

    expect(electron.settings.set).toHaveBeenCalledWith(
      "poe2SelectedLeague",
      "Dawn",
    );
  });

  it("tracks setup-league-selected event for poe1", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe1"] });

    store.getState().setup.setSetupState(initialState);
    electron.appSetup.getSetupState.mockResolvedValue(initialState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store.getState().setup.selectLeague("poe1", "Settlers");

    expect(trackEvent).toHaveBeenCalledWith("setup-league-selected", {
      game: "poe1",
      league: "Settlers",
      selection_type: "poe1_only",
    });
  });

  it("tracks setup-league-selected for both games with selection_type 'both'", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe1", "poe2"] });

    store.getState().setup.setSetupState(initialState);
    electron.appSetup.getSetupState.mockResolvedValue(initialState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store.getState().setup.selectLeague("poe2", "Dawn");

    expect(trackEvent).toHaveBeenCalledWith("setup-league-selected", {
      game: "poe2",
      league: "Dawn",
      selection_type: "both",
    });
  });

  it("does not track event when league is empty string", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe1"] });

    store.getState().setup.setSetupState(initialState);
    electron.appSetup.getSetupState.mockResolvedValue(initialState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store.getState().setup.selectLeague("poe1", "");

    expect(trackEvent).not.toHaveBeenCalledWith(
      "setup-league-selected",
      expect.anything(),
    );
  });

  it("refreshes state and re-validates after selection", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe1"] });
    const updatedState = makeSetupState({ poe1League: "Settlers" });

    store.getState().setup.setSetupState(initialState);
    electron.appSetup.getSetupState.mockResolvedValue(updatedState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store.getState().setup.selectLeague("poe1", "Settlers");

    expect(electron.appSetup.getSetupState).toHaveBeenCalledTimes(1);
    expect(electron.appSetup.validateCurrentStep).toHaveBeenCalledTimes(1);
    expect(store.getState().setup.setupState).toEqual(updatedState);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. selectClientPath
// ═══════════════════════════════════════════════════════════════════════════

describe("selectClientPath", () => {
  it("updates poe1 client path setting", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe1"] });
    const updatedState = makeSetupState({
      poe1ClientPath: "/path/to/client.txt",
    });

    store.getState().setup.setSetupState(initialState);
    electron.appSetup.getSetupState.mockResolvedValue(updatedState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store
      .getState()
      .setup.selectClientPath("poe1", "/path/to/client.txt");

    expect(electron.settings.set).toHaveBeenCalledWith(
      "poe1ClientTxtPath",
      "/path/to/client.txt",
    );
  });

  it("updates poe2 client path setting", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe2"] });
    const updatedState = makeSetupState({ poe2ClientPath: "/poe2/client.txt" });

    store.getState().setup.setSetupState(initialState);
    electron.appSetup.getSetupState.mockResolvedValue(updatedState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store.getState().setup.selectClientPath("poe2", "/poe2/client.txt");

    expect(electron.settings.set).toHaveBeenCalledWith(
      "poe2ClientTxtPath",
      "/poe2/client.txt",
    );
  });

  it("tracks setup-client-path-selected event for poe1", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe1"] });

    store.getState().setup.setSetupState(initialState);
    electron.appSetup.getSetupState.mockResolvedValue(initialState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store
      .getState()
      .setup.selectClientPath("poe1", "/path/to/client.txt");

    expect(trackEvent).toHaveBeenCalledWith("setup-client-path-selected", {
      game: "poe1",
      has_path: true,
      selection_type: "poe1_only",
    });
  });

  it("tracks setup-client-path-selected for poe2 with selection_type poe2_only", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe2"] });

    store.getState().setup.setSetupState(initialState);
    electron.appSetup.getSetupState.mockResolvedValue(initialState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store.getState().setup.selectClientPath("poe2", "/path");

    expect(trackEvent).toHaveBeenCalledWith("setup-client-path-selected", {
      game: "poe2",
      has_path: true,
      selection_type: "poe2_only",
    });
  });

  it("refreshes state and re-validates after path selection", async () => {
    const initialState = makeSetupState({ selectedGames: ["poe1"] });
    const updatedState = makeSetupState({ poe1ClientPath: "/path" });

    store.getState().setup.setSetupState(initialState);
    electron.appSetup.getSetupState.mockResolvedValue(updatedState);
    electron.appSetup.validateCurrentStep.mockResolvedValue({
      isValid: true,
      errors: [],
    });

    await store.getState().setup.selectClientPath("poe1", "/path");

    expect(electron.appSetup.getSetupState).toHaveBeenCalledTimes(1);
    expect(electron.appSetup.validateCurrentStep).toHaveBeenCalledTimes(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. advanceStep
// ═══════════════════════════════════════════════════════════════════════════

describe("advanceStep", () => {
  it("returns true on success", async () => {
    const currentState = makeSetupState({
      currentStep: 1,
      selectedGames: ["poe1"],
    });
    const nextState = makeSetupState({ currentStep: 2 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.advanceStep.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(nextState);

    const result = await store.getState().setup.advanceStep();

    expect(result).toBe(true);
    expect(store.getState().setup.isLoading).toBe(false);
    expect(store.getState().setup.setupState).toEqual(nextState);
  });

  it("returns false on IPC failure result", async () => {
    const currentState = makeSetupState({ currentStep: 1 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.advanceStep.mockResolvedValue({
      success: false,
      error: "Validation failed",
    });

    const result = await store.getState().setup.advanceStep();

    expect(result).toBe(false);
    expect(store.getState().setup.error).toBe("Validation failed");
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("returns false and sets default error when result has no error message", async () => {
    const currentState = makeSetupState({ currentStep: 1 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.advanceStep.mockResolvedValue({ success: false });

    const result = await store.getState().setup.advanceStep();

    expect(result).toBe(false);
    expect(store.getState().setup.error).toBe("Failed to advance");
  });

  it("returns false on thrown error", async () => {
    const currentState = makeSetupState({ currentStep: 1 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.advanceStep.mockRejectedValue(new Error("Network error"));

    const result = await store.getState().setup.advanceStep();

    expect(result).toBe(false);
    expect(store.getState().setup.error).toBe("Network error");
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("clears validation on successful advance", async () => {
    const currentState = makeSetupState({ currentStep: 1 });
    const nextState = makeSetupState({ currentStep: 2 });

    store.getState().setup.setSetupState(currentState);
    store.getState().setup.setValidation({ isValid: false, errors: ["err"] });

    electron.appSetup.advanceStep.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(nextState);

    await store.getState().setup.advanceStep();

    expect(store.getState().setup.validation).toBeNull();
  });

  // ── Step completion tracking ─────────────────────────────────────────

  it("tracks setup-step-completed-game from step 1", async () => {
    const currentState = makeSetupState({
      currentStep: 1,
      selectedGames: ["poe1"],
    });
    const nextState = makeSetupState({ currentStep: 2 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.advanceStep.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(nextState);

    await store.getState().setup.advanceStep();

    expect(trackEvent).toHaveBeenCalledWith("setup-step-completed-game", {
      step_number: 1,
      step_name: "game",
      selectedGames: ["poe1"],
      selection_type: "poe1_only",
    });
  });

  it("tracks setup-step-completed-league from step 2 with league info", async () => {
    const currentState = makeSetupState({
      currentStep: 2,
      selectedGames: ["poe1", "poe2"],
      poe1League: "Settlers",
      poe2League: "Dawn",
    });
    const nextState = makeSetupState({ currentStep: 3 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.advanceStep.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(nextState);

    await store.getState().setup.advanceStep();

    expect(trackEvent).toHaveBeenCalledWith("setup-step-completed-league", {
      step_number: 2,
      step_name: "league",
      selectedGames: ["poe1", "poe2"],
      selection_type: "both",
      poe1League: "Settlers",
      poe2League: "Dawn",
    });
  });

  it("tracks setup-step-completed-league with undefined leagues for unselected games", async () => {
    const currentState = makeSetupState({
      currentStep: 2,
      selectedGames: ["poe1"],
      poe1League: "Settlers",
      poe2League: "Dawn",
    });
    const nextState = makeSetupState({ currentStep: 3 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.advanceStep.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(nextState);

    await store.getState().setup.advanceStep();

    expect(trackEvent).toHaveBeenCalledWith("setup-step-completed-league", {
      step_number: 2,
      step_name: "league",
      selectedGames: ["poe1"],
      selection_type: "poe1_only",
      poe1League: "Settlers",
      poe2League: undefined,
    });
  });

  it("tracks setup-step-completed-league with poe1League undefined when only poe2 is selected", async () => {
    const currentState = makeSetupState({
      currentStep: 2,
      selectedGames: ["poe2"],
      poe1League: "Settlers",
      poe2League: "Dawn",
    });
    const nextState = makeSetupState({ currentStep: 3 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.advanceStep.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(nextState);

    await store.getState().setup.advanceStep();

    expect(trackEvent).toHaveBeenCalledWith("setup-step-completed-league", {
      step_number: 2,
      step_name: "league",
      selectedGames: ["poe2"],
      selection_type: "poe2_only",
      poe1League: undefined,
      poe2League: "Dawn",
    });
  });

  it("tracks setup-step-completed-client-path from step 3", async () => {
    const currentState = makeSetupState({
      currentStep: 3,
      selectedGames: ["poe2"],
    });
    const nextState = makeSetupState({ currentStep: 4 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.advanceStep.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(nextState);

    await store.getState().setup.advanceStep();

    expect(trackEvent).toHaveBeenCalledWith(
      "setup-step-completed-client-path",
      {
        step_number: 3,
        step_name: "client-path",
        selectedGames: ["poe2"],
        selection_type: "poe2_only",
      },
    );
  });

  it("tracks setup-step-completed-telemetry from step 4", async () => {
    const currentState = makeSetupState({
      currentStep: 4,
      selectedGames: ["poe1"],
      telemetryCrashReporting: true,
      telemetryUsageAnalytics: false,
    });
    const nextState = makeSetupState({ currentStep: 4, isComplete: true });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.advanceStep.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(nextState);

    await store.getState().setup.advanceStep();

    expect(trackEvent).toHaveBeenCalledWith("setup-step-completed-telemetry", {
      step_number: 4,
      step_name: "telemetry",
      crashReportingEnabled: true,
      usageAnalyticsEnabled: false,
    });
  });

  // ── Step viewed tracking ─────────────────────────────────────────────

  it("tracks setup-step-viewed-league when advancing to step 2", async () => {
    const currentState = makeSetupState({
      currentStep: 1,
      selectedGames: ["poe1"],
    });
    const nextState = makeSetupState({
      currentStep: 2,
      selectedGames: ["poe1"],
    });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.advanceStep.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(nextState);

    await store.getState().setup.advanceStep();

    expect(trackEvent).toHaveBeenCalledWith("setup-step-viewed-league", {
      step_number: 2,
      step_name: "league",
      selectedGames: ["poe1"],
      selection_type: "poe1_only",
    });
  });

  it("tracks setup-step-viewed-client-path when advancing to step 3", async () => {
    const currentState = makeSetupState({
      currentStep: 2,
      selectedGames: ["poe1", "poe2"],
    });
    const nextState = makeSetupState({
      currentStep: 3,
      selectedGames: ["poe1", "poe2"],
    });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.advanceStep.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(nextState);

    await store.getState().setup.advanceStep();

    expect(trackEvent).toHaveBeenCalledWith("setup-step-viewed-client-path", {
      step_number: 3,
      step_name: "client-path",
      selectedGames: ["poe1", "poe2"],
      selection_type: "both",
    });
  });

  it("tracks setup-step-viewed-telemetry when advancing to step 4", async () => {
    const currentState = makeSetupState({
      currentStep: 3,
      selectedGames: ["poe1"],
    });
    const nextState = makeSetupState({
      currentStep: 4,
      selectedGames: ["poe1"],
    });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.advanceStep.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(nextState);

    await store.getState().setup.advanceStep();

    expect(trackEvent).toHaveBeenCalledWith("setup-step-viewed-telemetry", {
      step_number: 4,
      step_name: "telemetry",
    });
  });

  it("does not track step-viewed event when nextStep does not match any tracked step", async () => {
    const currentState = makeSetupState({
      currentStep: 4,
      selectedGames: ["poe1"],
    });
    // After advancing from step 4, the next state has isComplete=true and currentStep resets to 0
    const nextState = makeSetupState({
      currentStep: 0,
      isComplete: true,
      selectedGames: ["poe1"],
    });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.advanceStep.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(nextState);

    const result = await store.getState().setup.advanceStep();

    expect(result).toBe(true);
    expect(trackEvent).not.toHaveBeenCalledWith(
      "setup-step-viewed-league",
      expect.anything(),
    );
    expect(trackEvent).not.toHaveBeenCalledWith(
      "setup-step-viewed-client-path",
      expect.anything(),
    );
    expect(trackEvent).not.toHaveBeenCalledWith(
      "setup-step-viewed-telemetry",
      expect.anything(),
    );
  });

  it("returns false and sets 'Unknown error' when a non-Error value is thrown", async () => {
    const currentState = makeSetupState({ currentStep: 1 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.advanceStep.mockRejectedValue("string error");

    const result = await store.getState().setup.advanceStep();

    expect(result).toBe(false);
    expect(store.getState().setup.error).toBe("Unknown error");
    expect(store.getState().setup.isLoading).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. goBack
// ═══════════════════════════════════════════════════════════════════════════

describe("goBack", () => {
  it("goes from step 2 to step 1", async () => {
    const currentState = makeSetupState({ currentStep: 2 });
    const prevState = makeSetupState({ currentStep: 1 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.goToStep.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(prevState);

    await store.getState().setup.goBack();

    expect(electron.appSetup.goToStep).toHaveBeenCalledWith(1);
    expect(store.getState().setup.setupState).toEqual(prevState);
    expect(store.getState().setup.isLoading).toBe(false);
    expect(store.getState().setup.validation).toBeNull();
  });

  it("goes from step 3 to step 2", async () => {
    const currentState = makeSetupState({ currentStep: 3 });
    const prevState = makeSetupState({ currentStep: 2 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.goToStep.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(prevState);

    await store.getState().setup.goBack();

    expect(electron.appSetup.goToStep).toHaveBeenCalledWith(2);
  });

  it("is a no-op from step 1 (SELECT_GAME)", async () => {
    const currentState = makeSetupState({ currentStep: 1 });

    store.getState().setup.setSetupState(currentState);

    await store.getState().setup.goBack();

    expect(electron.appSetup.goToStep).not.toHaveBeenCalled();
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("is a no-op from step 0 (NOT_STARTED)", async () => {
    const currentState = makeSetupState({ currentStep: 0 });

    store.getState().setup.setSetupState(currentState);

    await store.getState().setup.goBack();

    expect(electron.appSetup.goToStep).not.toHaveBeenCalled();
  });

  it("is a no-op when setupState is null", async () => {
    // Default state has null setupState
    await store.getState().setup.goBack();

    expect(electron.appSetup.goToStep).not.toHaveBeenCalled();
  });

  it("tracks setup-step-back event", async () => {
    const currentState = makeSetupState({ currentStep: 3 });
    const prevState = makeSetupState({ currentStep: 2 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.goToStep.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(prevState);

    await store.getState().setup.goBack();

    expect(trackEvent).toHaveBeenCalledWith("setup-step-back", {
      from_step: 3,
      to_step: 2,
    });
  });

  it("sets error when goToStep returns failure", async () => {
    const currentState = makeSetupState({ currentStep: 2 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.goToStep.mockResolvedValue({
      success: false,
      error: "Cannot go back",
    });

    await store.getState().setup.goBack();

    expect(store.getState().setup.error).toBe("Cannot go back");
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("sets default error when goToStep returns failure with no error message", async () => {
    const currentState = makeSetupState({ currentStep: 2 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.goToStep.mockResolvedValue({ success: false });

    await store.getState().setup.goBack();

    expect(store.getState().setup.error).toBe("Failed to go back");
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("handles thrown errors", async () => {
    const currentState = makeSetupState({ currentStep: 2 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.goToStep.mockRejectedValue(new Error("IPC crashed"));

    await store.getState().setup.goBack();

    expect(store.getState().setup.error).toBe("IPC crashed");
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("sets 'Unknown error' when a non-Error value is thrown", async () => {
    const currentState = makeSetupState({ currentStep: 2 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.goToStep.mockRejectedValue("string error");

    await store.getState().setup.goBack();

    expect(store.getState().setup.error).toBe("Unknown error");
    expect(store.getState().setup.isLoading).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. completeSetup
// ═══════════════════════════════════════════════════════════════════════════

describe("completeSetup", () => {
  it("returns true on success", async () => {
    const currentState = makeSetupState({
      currentStep: 4,
      selectedGames: ["poe1"],
      telemetryCrashReporting: true,
      telemetryUsageAnalytics: true,
    });
    const completedState = makeSetupState({ isComplete: true });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.completeSetup.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(completedState);

    const result = await store.getState().setup.completeSetup();

    expect(result).toBe(true);
    expect(store.getState().setup.setupState).toEqual(completedState);
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("tracks setup-step-completed-telemetry-final event", async () => {
    const currentState = makeSetupState({
      currentStep: 4,
      selectedGames: ["poe1", "poe2"],
      telemetryCrashReporting: false,
      telemetryUsageAnalytics: true,
    });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.completeSetup.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(
      makeSetupState({ isComplete: true }),
    );

    await store.getState().setup.completeSetup();

    expect(trackEvent).toHaveBeenCalledWith(
      "setup-step-completed-telemetry-final",
      {
        step_number: 4,
        step_name: "telemetry",
        selectedGames: ["poe1", "poe2"],
        selection_type: "both",
        crashReportingEnabled: false,
        usageAnalyticsEnabled: true,
      },
    );
  });

  it("tracks setup-completed event with timing data", async () => {
    const currentState = makeSetupState({
      currentStep: 4,
      selectedGames: ["poe1"],
      poe1League: "Settlers",
      telemetryCrashReporting: true,
      telemetryUsageAnalytics: false,
    });

    store.getState().setup.setSetupState(currentState);
    // Set start time to compute timeTaken
    store.getState().setup.trackSetupStarted();

    electron.appSetup.completeSetup.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(
      makeSetupState({ isComplete: true }),
    );

    await store.getState().setup.completeSetup();

    expect(trackEvent).toHaveBeenCalledWith(
      "setup-completed",
      expect.objectContaining({
        selectedGames: ["poe1"],
        selection_type: "poe1_only",
        poe1League: "Settlers",
        poe2League: undefined,
        totalSteps: 4,
        completion_status: "completed",
        crashReportingEnabled: true,
        usageAnalyticsEnabled: false,
      }),
    );
  });

  it("includes timeTaken when setupStartTime is set", async () => {
    const currentState = makeSetupState({
      currentStep: 4,
      selectedGames: ["poe1"],
    });

    // Set setupStartTime directly on the store so completeSetup can read it
    store.setState((state) => {
      state.setup.setupState = currentState;
      state.setup.setupStartTime = Date.now() - 5000; // 5 seconds ago
    });

    electron.appSetup.completeSetup.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(
      makeSetupState({ isComplete: true }),
    );

    await store.getState().setup.completeSetup();

    // timeTaken should be a number (>= 5000 since we set start time 5s ago)
    const calls = vi.mocked(trackEvent).mock.calls;
    const completedCall = calls.find((c) => c[0] === "setup-completed");
    expect(completedCall).toBeDefined();
    expect(completedCall![1]).toHaveProperty("timeTaken");
    expect(typeof completedCall![1]!.timeTaken).toBe("number");
    expect(completedCall![1]!.timeTaken).toBeGreaterThanOrEqual(0);
  });

  it("returns false on IPC failure", async () => {
    const currentState = makeSetupState({
      currentStep: 4,
      selectedGames: ["poe1"],
    });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.completeSetup.mockResolvedValue({
      success: false,
      error: "Setup incomplete",
    });

    const result = await store.getState().setup.completeSetup();

    expect(result).toBe(false);
    expect(store.getState().setup.error).toBe("Setup incomplete");
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("returns false and sets default error when IPC failure has no error message", async () => {
    const currentState = makeSetupState({
      currentStep: 4,
      selectedGames: ["poe1"],
    });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.completeSetup.mockResolvedValue({ success: false });

    const result = await store.getState().setup.completeSetup();

    expect(result).toBe(false);
    expect(store.getState().setup.error).toBe("Failed to complete setup");
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("returns false on thrown error", async () => {
    const currentState = makeSetupState({
      currentStep: 4,
      selectedGames: ["poe1"],
    });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.completeSetup.mockRejectedValue(new Error("Crash"));

    const result = await store.getState().setup.completeSetup();

    expect(result).toBe(false);
    expect(store.getState().setup.error).toBe("Crash");
  });

  it("returns false and sets 'Unknown error' when a non-Error value is thrown", async () => {
    const currentState = makeSetupState({
      currentStep: 4,
      selectedGames: ["poe1"],
    });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.completeSetup.mockRejectedValue("string error");

    const result = await store.getState().setup.completeSetup();

    expect(result).toBe(false);
    expect(store.getState().setup.error).toBe("Unknown error");
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("uses empty selectedGames fallback when setupState is null", async () => {
    // Do NOT set setupState — it stays null so `?.selectedGames || []` hits the fallback
    electron.appSetup.completeSetup.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(
      makeSetupState({ isComplete: true }),
    );

    const result = await store.getState().setup.completeSetup();

    expect(result).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith(
      "setup-step-completed-telemetry-final",
      expect.objectContaining({
        selectedGames: [],
      }),
    );
    expect(trackEvent).toHaveBeenCalledWith(
      "setup-completed",
      expect.objectContaining({
        selectedGames: [],
        poe1League: undefined,
        poe2League: undefined,
      }),
    );
  });

  it("sets poe1League to undefined when only poe2 is selected", async () => {
    const currentState = makeSetupState({
      currentStep: 4,
      selectedGames: ["poe2"],
      poe1League: "Standard",
      poe2League: "Dawn",
      telemetryCrashReporting: true,
      telemetryUsageAnalytics: false,
    });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.completeSetup.mockResolvedValue({ success: true });
    electron.appSetup.getSetupState.mockResolvedValue(
      makeSetupState({ isComplete: true }),
    );

    const result = await store.getState().setup.completeSetup();

    expect(result).toBe(true);
    expect(trackEvent).toHaveBeenCalledWith(
      "setup-completed",
      expect.objectContaining({
        selectedGames: ["poe2"],
        selection_type: "poe2_only",
        poe1League: undefined,
        poe2League: "Dawn",
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10. skipSetup
// ═══════════════════════════════════════════════════════════════════════════

describe("skipSetup", () => {
  it("tracks setup-skipped event with current step info", async () => {
    const currentState = makeSetupState({ currentStep: 2 });
    const skippedState = makeSetupState({ isComplete: true });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.skipSetup.mockResolvedValue(undefined);
    electron.appSetup.getSetupState.mockResolvedValue(skippedState);

    await store.getState().setup.skipSetup();

    expect(trackEvent).toHaveBeenCalledWith("setup-skipped", {
      currentStep: 2,
      stepName: "league",
      reason: "user_skip",
      completion_status: "skipped",
    });
  });

  it("tracks setup-skipped from step 1 with stepName 'game'", async () => {
    const currentState = makeSetupState({ currentStep: 1 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.skipSetup.mockResolvedValue(undefined);
    electron.appSetup.getSetupState.mockResolvedValue(
      makeSetupState({ isComplete: true }),
    );

    await store.getState().setup.skipSetup();

    expect(trackEvent).toHaveBeenCalledWith("setup-skipped", {
      currentStep: 1,
      stepName: "game",
      reason: "user_skip",
      completion_status: "skipped",
    });
  });

  it("tracks setup-skipped from step 3 with stepName 'client-path'", async () => {
    const currentState = makeSetupState({ currentStep: 3 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.skipSetup.mockResolvedValue(undefined);
    electron.appSetup.getSetupState.mockResolvedValue(
      makeSetupState({ isComplete: true }),
    );

    await store.getState().setup.skipSetup();

    expect(trackEvent).toHaveBeenCalledWith("setup-skipped", {
      currentStep: 3,
      stepName: "client-path",
      reason: "user_skip",
      completion_status: "skipped",
    });
  });

  it("uses 'unknown' stepName for unmapped steps", async () => {
    const currentState = makeSetupState({ currentStep: 4 });

    store.getState().setup.setSetupState(currentState);
    electron.appSetup.skipSetup.mockResolvedValue(undefined);
    electron.appSetup.getSetupState.mockResolvedValue(
      makeSetupState({ isComplete: true }),
    );

    await store.getState().setup.skipSetup();

    expect(trackEvent).toHaveBeenCalledWith("setup-skipped", {
      currentStep: 4,
      stepName: "unknown",
      reason: "user_skip",
      completion_status: "skipped",
    });
  });

  it("calls IPC skipSetup and refreshes state", async () => {
    const skippedState = makeSetupState({ isComplete: true });

    store.getState().setup.setSetupState(makeSetupState({ currentStep: 1 }));
    electron.appSetup.skipSetup.mockResolvedValue(undefined);
    electron.appSetup.getSetupState.mockResolvedValue(skippedState);

    await store.getState().setup.skipSetup();

    expect(electron.appSetup.skipSetup).toHaveBeenCalledTimes(1);
    expect(electron.appSetup.getSetupState).toHaveBeenCalledTimes(1);
    expect(store.getState().setup.setupState).toEqual(skippedState);
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("handles errors gracefully", async () => {
    store.getState().setup.setSetupState(makeSetupState({ currentStep: 1 }));
    electron.appSetup.skipSetup.mockRejectedValue(new Error("Skip failed"));

    await store.getState().setup.skipSetup();

    expect(store.getState().setup.error).toBe("Skip failed");
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("sets 'Unknown error' when a non-Error value is thrown", async () => {
    store.getState().setup.setSetupState(makeSetupState({ currentStep: 1 }));
    electron.appSetup.skipSetup.mockRejectedValue("string error");

    await store.getState().setup.skipSetup();

    expect(store.getState().setup.error).toBe("Unknown error");
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("uses currentStep 0 fallback when setupState is null", async () => {
    // Do NOT set setupState — it stays null so `?.currentStep ?? 0` hits the fallback
    electron.appSetup.skipSetup.mockResolvedValue(undefined);
    electron.appSetup.getSetupState.mockResolvedValue(
      makeSetupState({ isComplete: true }),
    );

    await store.getState().setup.skipSetup();

    expect(trackEvent).toHaveBeenCalledWith("setup-skipped", {
      currentStep: 0,
      stepName: "unknown",
      reason: "user_skip",
      completion_status: "skipped",
    });
    expect(electron.appSetup.skipSetup).toHaveBeenCalledTimes(1);
    expect(store.getState().setup.isLoading).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11. resetSetup
// ═══════════════════════════════════════════════════════════════════════════

describe("resetSetup", () => {
  it("calls IPC resetSetup and refreshes state", async () => {
    const freshState = makeSetupState({ currentStep: 1, isComplete: false });

    store
      .getState()
      .setup.setSetupState(
        makeSetupState({ currentStep: 4, isComplete: true }),
      );
    electron.appSetup.resetSetup.mockResolvedValue(undefined);
    electron.appSetup.getSetupState.mockResolvedValue(freshState);

    await store.getState().setup.resetSetup();

    expect(electron.appSetup.resetSetup).toHaveBeenCalledTimes(1);
    expect(store.getState().setup.setupState).toEqual(freshState);
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("clears validation on reset", async () => {
    store.getState().setup.setSetupState(makeSetupState());
    store.getState().setup.setValidation({ isValid: false, errors: ["err"] });

    electron.appSetup.resetSetup.mockResolvedValue(undefined);
    electron.appSetup.getSetupState.mockResolvedValue(
      makeSetupState({ currentStep: 1 }),
    );

    await store.getState().setup.resetSetup();

    expect(store.getState().setup.validation).toBeNull();
  });

  it("handles errors gracefully", async () => {
    store.getState().setup.setSetupState(makeSetupState());
    electron.appSetup.resetSetup.mockRejectedValue(new Error("Reset failed"));

    await store.getState().setup.resetSetup();

    expect(store.getState().setup.error).toBe("Reset failed");
    expect(store.getState().setup.isLoading).toBe(false);
  });

  it("handles non-Error thrown values", async () => {
    store.getState().setup.setSetupState(makeSetupState());
    electron.appSetup.resetSetup.mockRejectedValue("oops");

    await store.getState().setup.resetSetup();

    expect(store.getState().setup.error).toBe("Unknown error");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12. trackSetupStarted
// ═══════════════════════════════════════════════════════════════════════════

describe("trackSetupStarted", () => {
  it("sets setupStartTime to a number", () => {
    store.getState().setup.trackSetupStarted();

    expect(store.getState().setup.setupStartTime).toBeTypeOf("number");
    expect(store.getState().setup.setupStartTime).toBeGreaterThan(0);
  });

  it("tracks setup-started event with timestamp", () => {
    store.getState().setup.trackSetupStarted();

    expect(trackEvent).toHaveBeenCalledWith("setup-started", {
      timestamp: expect.any(String),
    });
  });

  it("overwrites previous setupStartTime on repeated calls", () => {
    store.getState().setup.trackSetupStarted();
    const first = store.getState().setup.setupStartTime;

    store.getState().setup.trackSetupStarted();
    const second = store.getState().setup.setupStartTime;

    // Second should be >= first
    expect(second).toBeGreaterThanOrEqual(first!);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13. Getters
// ═══════════════════════════════════════════════════════════════════════════

describe("getters", () => {
  describe("isSetupComplete", () => {
    it("returns false when setupState is null", () => {
      expect(store.getState().setup.isSetupComplete()).toBe(false);
    });

    it("returns false when isComplete is false", () => {
      store
        .getState()
        .setup.setSetupState(makeSetupState({ isComplete: false }));
      expect(store.getState().setup.isSetupComplete()).toBe(false);
    });

    it("returns true when isComplete is true", () => {
      store
        .getState()
        .setup.setSetupState(makeSetupState({ isComplete: true }));
      expect(store.getState().setup.isSetupComplete()).toBe(true);
    });
  });

  describe("getCurrentStep", () => {
    it("returns 0 when setupState is null", () => {
      expect(store.getState().setup.getCurrentStep()).toBe(0);
    });

    it("returns the current step value", () => {
      store.getState().setup.setSetupState(makeSetupState({ currentStep: 3 }));
      expect(store.getState().setup.getCurrentStep()).toBe(3);
    });

    it("returns 0 for NOT_STARTED step", () => {
      store.getState().setup.setSetupState(makeSetupState({ currentStep: 0 }));
      expect(store.getState().setup.getCurrentStep()).toBe(0);
    });

    it("returns 4 for TELEMETRY_CONSENT step", () => {
      store.getState().setup.setSetupState(makeSetupState({ currentStep: 4 }));
      expect(store.getState().setup.getCurrentStep()).toBe(4);
    });
  });

  describe("getSelectedGames", () => {
    it("returns empty array when setupState is null", () => {
      expect(store.getState().setup.getSelectedGames()).toEqual([]);
    });

    it("returns selected games from setupState", () => {
      store
        .getState()
        .setup.setSetupState(
          makeSetupState({ selectedGames: ["poe1", "poe2"] }),
        );
      expect(store.getState().setup.getSelectedGames()).toEqual([
        "poe1",
        "poe2",
      ]);
    });

    it("returns single game array", () => {
      store
        .getState()
        .setup.setSetupState(makeSetupState({ selectedGames: ["poe2"] }));
      expect(store.getState().setup.getSelectedGames()).toEqual(["poe2"]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14. Internal setters
// ═══════════════════════════════════════════════════════════════════════════

describe("internal setters", () => {
  describe("setSetupState", () => {
    it("sets setupState", () => {
      const state = makeSetupState({
        currentStep: 3,
        selectedGames: ["poe1", "poe2"],
      });
      store.getState().setup.setSetupState(state);
      expect(store.getState().setup.setupState).toEqual(state);
    });

    it("overwrites previous setupState", () => {
      const first = makeSetupState({ currentStep: 1 });
      const second = makeSetupState({ currentStep: 4, isComplete: true });

      store.getState().setup.setSetupState(first);
      expect(store.getState().setup.setupState?.currentStep).toBe(1);

      store.getState().setup.setSetupState(second);
      expect(store.getState().setup.setupState?.currentStep).toBe(4);
      expect(store.getState().setup.setupState?.isComplete).toBe(true);
    });
  });

  describe("setValidation", () => {
    it("sets validation result", () => {
      const validation = { isValid: false, errors: ["Select a game"] };
      store.getState().setup.setValidation(validation);
      expect(store.getState().setup.validation).toEqual(validation);
    });

    it("clears validation when set to null", () => {
      store.getState().setup.setValidation({ isValid: true, errors: [] });
      store.getState().setup.setValidation(null);
      expect(store.getState().setup.validation).toBeNull();
    });
  });

  describe("setError", () => {
    it("sets error message", () => {
      store.getState().setup.setError("Something broke");
      expect(store.getState().setup.error).toBe("Something broke");
    });

    it("clears error when set to null", () => {
      store.getState().setup.setError("err");
      store.getState().setup.setError(null);
      expect(store.getState().setup.error).toBeNull();
    });
  });
});
