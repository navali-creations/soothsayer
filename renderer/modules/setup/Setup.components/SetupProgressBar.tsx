import { SETUP_STEPS } from "~/main/modules/app-setup/AppSetup.types";

interface SetupProgressBarProps {
  currentStep: number;
}

const steps = [
  { step: SETUP_STEPS.SELECT_GAME, label: "Select Game" },
  { step: SETUP_STEPS.SELECT_LEAGUE, label: "Select League" },
  { step: SETUP_STEPS.SELECT_CLIENT_PATH, label: "Client.txt Path" },
];

const SetupProgressBar = ({ currentStep }: SetupProgressBarProps) => {
  return (
    <div className="flex flex-col gap-0">
      {steps.map(({ step, label }, index) => {
        const isActive = currentStep === step;
        const isCompleted = currentStep > step;
        const isLast = index === steps.length - 1;

        return (
          <div key={step} className="flex items-stretch">
            {/* Step indicator and connector line */}
            <div className="flex flex-col items-center">
              {/* Circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors shrink-0 ${
                  isActive
                    ? "bg-primary text-primary-content ring-2 ring-primary ring-offset-2 ring-offset-base-200"
                    : isCompleted
                      ? "bg-primary text-primary-content"
                      : "bg-primary/20 text-base-content/70 border border-primary/30"
                }`}
              >
                {isCompleted ? (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  step
                )}
              </div>

              {/* Vertical connector line */}
              {!isLast && (
                <div
                  className={`w-0.5 flex-1 min-h-[24px] transition-colors ${
                    isCompleted ? "bg-primary" : "bg-primary/20"
                  }`}
                />
              )}
            </div>

            {/* Label */}
            <div className="ml-3 pb-6">
              <span
                className={`text-sm font-medium transition-colors ${
                  isActive
                    ? "text-primary"
                    : isCompleted
                      ? "text-base-content"
                      : "text-base-content/50"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SetupProgressBar;
