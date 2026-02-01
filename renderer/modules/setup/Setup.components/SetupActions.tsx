import { SETUP_STEPS } from "~/main/modules/app-setup/AppSetup.types";
import { useBoundStore } from "~/renderer/store";

const SetupActions = () => {
  const {
    setup: {
      setupState,
      validation,
      isLoading,
      advanceStep,
      goBack,
      completeSetup,
    },
  } = useBoundStore();

  const currentStep = setupState?.currentStep ?? 0;
  const isFirstStep = currentStep === SETUP_STEPS.SELECT_GAME;
  const isLastStep = currentStep === SETUP_STEPS.SELECT_CLIENT_PATH;
  const isNextDisabled =
    isLoading || (validation != null && !validation.isValid);

  const handleBack = async () => {
    await goBack();
  };

  const handleNext = async () => {
    await advanceStep();
  };

  const handleComplete = async () => {
    await completeSetup();
  };

  return (
    <div className="flex items-center justify-end">
      <div className="flex gap-3">
        <button
          onClick={handleBack}
          disabled={isLoading || isFirstStep}
          className={`btn btn-ghost ${isFirstStep ? "invisible" : ""}`}
        >
          Back
        </button>

        <button
          onClick={isLastStep ? handleComplete : handleNext}
          disabled={isNextDisabled}
          className="btn btn-primary"
        >
          {isLoading ? (
            <>
              <span className="loading loading-spinner loading-sm" />
              Loading...
            </>
          ) : isLastStep ? (
            "Finish"
          ) : (
            "Next"
          )}
        </button>
      </div>
    </div>
  );
};

export default SetupActions;
