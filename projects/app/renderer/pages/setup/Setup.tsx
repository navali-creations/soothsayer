import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useBoundStore } from "~/renderer/store";

import { SETUP_STEPS } from "../../../electron/modules/app-setup/AppSetup.types";

const SetupPage = () => {
  const navigate = useNavigate();

  // Zustand state
  const setupState = useBoundStore((state) => state.setupState);
  const validation = useBoundStore((state) => state.validation);
  const isLoading = useBoundStore((state) => state.isLoading);
  const error = useBoundStore((state) => state.error);

  // Zustand actions
  const validateCurrentStep = useBoundStore(
    (state) => state.validateCurrentStep,
  );
  const advanceStep = useBoundStore((state) => state.advanceStep);
  const goToStep = useBoundStore((state) => state.goToStep);
  const completeSetup = useBoundStore((state) => state.completeSetup);
  const skipSetup = useBoundStore((state) => state.skipSetup);

  // Settings actions
  const updateSetting = useBoundStore((state) => state.settings.updateSetting);

  // Local UI state
  const [selectedGame, setSelectedGame] = useState<"poe1" | "poe2" | null>(
    null,
  );
  const [poe1League, setPoe1League] = useState("");
  const [poe2League, setPoe2League] = useState("");
  const [poe1ClientPath, setPoe1ClientPath] = useState("");
  const [poe2ClientPath, setPoe2ClientPath] = useState("");

  // Sync local state with setup state
  useEffect(() => {
    if (setupState) {
      setSelectedGame(setupState.selectedGame || null);
      setPoe1League(setupState.poe1League || "");
      setPoe2League(setupState.poe2League || "");
      setPoe1ClientPath(setupState.poe1ClientPath || "");
      setPoe2ClientPath(setupState.poe2ClientPath || "");
    }
  }, [setupState]);

  // Validate on step change
  useEffect(() => {
    if (setupState && setupState.currentStep > 0) {
      validateCurrentStep();
    }
  }, [setupState?.currentStep, validateCurrentStep, setupState]);

  const currentStep = setupState?.currentStep ?? 0;

  // Step 1: Select Game
  const handleGameSelect = async (game: "poe1" | "poe2") => {
    setSelectedGame(game);
    await updateSetting("selectedGame", game);
    // Re-validate after selection
    await validateCurrentStep();
  };

  // Step 2: Select League(s)
  const handlePoe1LeagueSelect = async (league: string) => {
    setPoe1League(league);
    await updateSetting("poe1SelectedLeague", league);
    // Re-validate after selection
    await validateCurrentStep();
  };

  const handlePoe2LeagueSelect = async (league: string) => {
    setPoe2League(league);
    await updateSetting("poe2SelectedLeague", league);
    // Re-validate after selection
    await validateCurrentStep();
  };

  // Step 3: Select Client.txt path(s)
  const handlePoe1FileSelect = async () => {
    const filePath = await window.electron.selectFile({
      title: "Select Path of Exile 1 Client.txt",
      filters: [{ name: "Text Files", extensions: ["txt"] }],
      properties: ["openFile"],
    });

    if (filePath) {
      setPoe1ClientPath(filePath);
      await updateSetting("poe1ClientTxtPath", filePath);
      // Re-validate after setting the path
      await validateCurrentStep();
    }
  };

  const handlePoe2FileSelect = async () => {
    const filePath = await window.electron.selectFile({
      title: "Select Path of Exile 2 Client.txt",
      filters: [{ name: "Text Files", extensions: ["txt"] }],
      properties: ["openFile"],
    });

    if (filePath) {
      setPoe2ClientPath(filePath);
      await updateSetting("poe2ClientTxtPath", filePath);
      // Re-validate after setting the path
      await validateCurrentStep();
    }
  };

  // Navigation
  const handleNext = async () => {
    const success = await advanceStep();

    if (success && setupState?.isComplete) {
      // Setup complete, navigate to home
      navigate({ to: "/" });
    }
  };

  const handleBack = async () => {
    if (currentStep > SETUP_STEPS.SELECT_GAME) {
      await goToStep((currentStep - 1) as any);
    }
  };

  const handleSkip = async () => {
    await skipSetup();
    navigate({ to: "/" });
  };

  const handleComplete = async () => {
    const success = await completeSetup();
    if (success) {
      navigate({ to: "/" });
    }
  };

  if (!setupState) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="w-full max-w-2xl bg-gray-800 rounded-lg shadow-2xl p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome to Soothsayer
          </h1>
          <p className="text-gray-400">
            Let's get you set up in just a few steps
          </p>

          {/* Progress indicator */}
          <div className="flex items-center justify-between mt-6">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`flex items-center ${step < 3 ? "flex-1" : ""}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    currentStep >= step
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {step}
                </div>
                {step < 3 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      currentStep > step ? "bg-blue-600" : "bg-gray-700"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Validation Errors */}
        {validation && !validation.isValid && (
          <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
            <ul className="list-disc list-inside text-yellow-400">
              {validation.errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Step Content */}
        <div className="mb-8 min-h-[300px]">
          {/* Step 1: Select Game */}
          {currentStep === SETUP_STEPS.SELECT_GAME && (
            <div>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Which game do you play?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { value: "poe1" as const, label: "Path of Exile 1" },
                  { value: "poe2" as const, label: "Path of Exile 2" },
                ].map((game) => (
                  <button
                    key={game.value}
                    onClick={() => handleGameSelect(game.value)}
                    className={`p-6 rounded-lg border-2 transition-all ${
                      selectedGame === game.value
                        ? "border-blue-600 bg-blue-900/20"
                        : "border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <div className="text-white font-semibold text-lg">
                      {game.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Select League(s) */}
          {currentStep === SETUP_STEPS.SELECT_LEAGUE && (
            <div>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Select your league
              </h2>

              {selectedGame === "poe1" && (
                <div className="mb-6">
                  <label className="block text-gray-300 mb-2">
                    Path of Exile 1 League
                  </label>
                  <input
                    type="text"
                    value={poe1League}
                    onChange={(e) => handlePoe1LeagueSelect(e.target.value)}
                    placeholder="e.g., Settlers, Standard"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              )}

              {selectedGame === "poe2" && (
                <div className="mb-6">
                  <label className="block text-gray-300 mb-2">
                    Path of Exile 2 League
                  </label>
                  <input
                    type="text"
                    value={poe2League}
                    onChange={(e) => handlePoe2LeagueSelect(e.target.value)}
                    placeholder="e.g., Standard"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 3: Select Client.txt Path(s) */}
          {currentStep === SETUP_STEPS.SELECT_CLIENT_PATH && (
            <div>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Select Client.txt location
              </h2>

              {selectedGame === "poe1" && (
                <div className="mb-6">
                  <label className="block text-gray-300 mb-2">
                    Path of Exile 1 Client.txt
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={poe1ClientPath}
                      readOnly
                      placeholder="No file selected"
                      className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    />
                    <button
                      onClick={handlePoe1FileSelect}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold"
                    >
                      Browse
                    </button>
                  </div>
                </div>
              )}

              {selectedGame === "poe2" && (
                <div className="mb-6">
                  <label className="block text-gray-300 mb-2">
                    Path of Exile 2 Client.txt
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={poe2ClientPath}
                      readOnly
                      placeholder="No file selected"
                      className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    />
                    <button
                      onClick={handlePoe2FileSelect}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold"
                    >
                      Browse
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Skip Setup
          </button>

          <div className="flex gap-3">
            {currentStep > SETUP_STEPS.SELECT_GAME && (
              <button
                onClick={handleBack}
                disabled={isLoading}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-semibold disabled:opacity-50"
              >
                Back
              </button>
            )}

            <button
              onClick={
                currentStep === SETUP_STEPS.SELECT_CLIENT_PATH
                  ? handleComplete
                  : handleNext
              }
              disabled={isLoading || (validation && !validation.isValid)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading
                ? "Loading..."
                : currentStep === SETUP_STEPS.SELECT_CLIENT_PATH
                  ? "Complete Setup"
                  : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { SetupPage };
