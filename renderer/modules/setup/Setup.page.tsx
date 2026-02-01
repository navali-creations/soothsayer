import { useEffect, useRef } from "react";

import { SETUP_STEPS } from "~/main/modules/app-setup/AppSetup.types";
import { useBoundStore } from "~/renderer/store";

import {
  SetupActions,
  SetupClientPathStep,
  SetupContainer,
  SetupErrorDisplay,
  SetupGameStep,
  SetupLeagueStep,
} from "./Setup.components";

const SetupPage = () => {
  const {
    setup: { setupState, trackSetupStarted, validateCurrentStep, advanceStep },
  } = useBoundStore();

  // Track whether we've already auto-advanced to prevent loops
  const hasAutoAdvanced = useRef(false);

  // Track setup started on mount
  useEffect(() => {
    trackSetupStarted();
  }, [trackSetupStarted]);

  // Auto-advance from step 0 to step 1 (game selection should be first visible step)
  useEffect(() => {
    if (
      setupState &&
      setupState.currentStep === SETUP_STEPS.NOT_STARTED &&
      !hasAutoAdvanced.current
    ) {
      hasAutoAdvanced.current = true;
      advanceStep();
    }
  }, [setupState, advanceStep]);

  // Validate on step change (only for steps > 0)
  useEffect(() => {
    if (setupState && setupState.currentStep > SETUP_STEPS.NOT_STARTED) {
      validateCurrentStep();
    }
  }, [setupState?.currentStep, validateCurrentStep, setupState]);

  const currentStep = setupState?.currentStep ?? 0;

  // Show loading while at step 0 (auto-advancing) or while setupState is null
  if (!setupState || currentStep === SETUP_STEPS.NOT_STARTED) {
    return (
      <div className="flex items-center justify-center h-full bg-base-300">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <SetupContainer>
      <SetupErrorDisplay />

      <div className="flex-1">
        {currentStep === SETUP_STEPS.SELECT_GAME && <SetupGameStep />}
        {currentStep === SETUP_STEPS.SELECT_LEAGUE && <SetupLeagueStep />}
        {currentStep === SETUP_STEPS.SELECT_CLIENT_PATH && (
          <SetupClientPathStep />
        )}
      </div>

      <SetupActions />
    </SetupContainer>
  );
};

export default SetupPage;
