import type React from "react";
import { useState } from "react";
import { FaRedo } from "react-icons/fa";
import Button from "~/renderer/components/Button/Button";
import { useBoundStore } from "~/renderer/store";

interface OnboardingButtonProps {
  variant?: "icon" | "button";
  className?: string;
}

export const OnboardingButton: React.FC<OnboardingButtonProps> = ({
  variant = "button",
  className = "",
}) => {
  const [isResetting, setIsResetting] = useState(false);
  const resetAll = useBoundStore((state) => state.onboarding.resetAll);

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
      <Button
        onClick={handleReset}
        variant="ghost"
        circle
        className={className}
        title="Reset Onboarding Tour"
        disabled={isResetting}
        data-onboarding="onboarding-button"
      >
        <FaRedo className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <Button
      onClick={handleReset}
      variant="primary"
      className={className}
      disabled={isResetting}
      data-onboarding="onboarding-button"
    >
      <FaRedo className="w-4 h-4" />
      {isResetting ? "Resetting..." : "Reset Tour"}
    </Button>
  );
};
