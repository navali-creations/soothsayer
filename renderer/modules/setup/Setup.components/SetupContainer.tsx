import type { ReactNode } from "react";

import { useBoundStore } from "~/renderer/store";

import SetupProgressBar from "./SetupProgressBar";

interface SetupContainerProps {
  children: ReactNode;
}

const SetupContainer = ({ children }: SetupContainerProps) => {
  const {
    setup: { setupState },
  } = useBoundStore();
  const currentStep = setupState?.currentStep ?? 1;

  return (
    <div className="flex items-center justify-center h-full bg-base-300 p-6">
      <div className="w-full max-w-4xl bg-base-200 rounded-lg shadow-2xl border border-base-100 flex overflow-hidden">
        {/* Left side - Vertical stepper */}
        <div className="w-48 bg-base-100/50 p-6 flex flex-col border-r border-base-content/10">
          <h2 className="text-lg font-bold text-base-content mb-6">Setup</h2>
          <SetupProgressBar currentStep={currentStep} />
        </div>

        {/* Right side - Content area */}
        <div className="flex-1 p-6 flex flex-col min-h-[500px]">{children}</div>
      </div>
    </div>
  );
};

export default SetupContainer;
