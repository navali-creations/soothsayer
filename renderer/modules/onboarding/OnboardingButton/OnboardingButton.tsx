import type React from "react";
import { useState } from "react";
import { FaRedo } from "react-icons/fa";

import Button from "~/renderer/components/Button/Button";
import Tooltip from "~/renderer/components/Tooltip/Tooltip";
import { useOnboardingActions } from "~/renderer/store";

interface OnboardingButtonProps {
  variant?: "icon" | "button";
  size?: "lg" | "md" | "sm" | "xs";
  className?: string;
}

export const OnboardingButton: React.FC<OnboardingButtonProps> = ({
  variant = "button",
  size,
  className = "",
}) => {
  const [isResetting, setIsResetting] = useState(false);
  const { resetAll } = useOnboardingActions();

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await resetAll();
      // Reload to re-show all beacons
      window.location.reload();
    } catch (error) {
      console.error("Failed to reset onboarding:", error);
      setIsResetting(false);
    }
  };

  if (variant === "icon") {
    return (
      <Tooltip as="div" content="Reset Onboarding Tour" describeChild>
        <Button
          aria-label="Reset Onboarding Tour"
          onClick={handleReset}
          variant="ghost"
          size={size}
          circle
          className={className}
          disabled={isResetting}
          data-onboarding="onboarding-button"
        >
          <FaRedo className="w-5 h-5" />
        </Button>
      </Tooltip>
    );
  }

  return (
    <Button
      onClick={handleReset}
      variant="primary"
      size={size}
      className={className}
      disabled={isResetting}
      data-onboarding="onboarding-button"
    >
      <FaRedo className="w-4 h-4" />
      {isResetting ? "Resetting..." : "Reset Tour"}
    </Button>
  );
};
