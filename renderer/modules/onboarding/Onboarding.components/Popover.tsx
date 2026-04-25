import { type PopoverComponentProps, ReperePopover } from "@repere/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useBoundStore, useOnboardingActions } from "~/renderer/store";

type PopoverProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
} & PopoverComponentProps;

const Popover = ({
  title,
  subtitle,
  children,
  className,
  ...props
}: PopoverProps) => {
  const [isDismissingAll, setIsDismissingAll] = useState(false);
  const { dismissAll, refreshBeaconHost } = useOnboardingActions();

  const handleAcknowledge = () => {
    trackEvent("onboarding-step-acknowledged", {
      beaconId: props.beaconId,
    });
  };

  const handleDismissAll = async () => {
    setIsDismissingAll(true);

    try {
      const previousDismissed = useBoundStore
        .getState()
        .onboarding.dismissedBeacons.join("|");

      await dismissAll();

      const nextDismissed = useBoundStore
        .getState()
        .onboarding.dismissedBeacons.join("|");

      if (previousDismissed === nextDismissed) {
        return;
      }

      refreshBeaconHost();
      trackEvent("onboarding-all-dismissed", {
        source: "popover",
        beaconId: props.beaconId,
      });
    } catch (error) {
      console.error("Failed to dismiss all onboarding beacons:", error);
    } finally {
      setIsDismissingAll(false);
    }
  };

  return (
    <ReperePopover
      {...props}
      className={`w-[400px] p-3 rounded-2xl shadow-lg shadow-primary/50 border-2 border-primary [background:color-mix(in_oklab,var(--color-accent)_30%,black)] ${
        className ?? ""
      }`}
    >
      <ReperePopover.Title>
        <span className="text-lg font-bold text-primary">{title}</span>
      </ReperePopover.Title>
      <ReperePopover.Content className="text-sm">
        {subtitle && <p className="text-base-content">{subtitle}</p>}
        {children && (
          <>
            <div className="divider divider-primary mt-2 mb-1" />
            {children}
          </>
        )}
      </ReperePopover.Content>
      <ReperePopover.Footer className="mt-3 flex gap-2">
        <Button
          variant="ghost"
          className="h-8 flex-1 bg-white/10 text-primary-content hover:bg-white/15"
          onClick={handleDismissAll}
          disabled={isDismissingAll}
        >
          {isDismissingAll ? "Dismissing..." : "Dismiss All"}
        </Button>
        <ReperePopover.AcknowledgeButton
          as={Button}
          variant="primary"
          className="h-8 flex-1"
          onClick={handleAcknowledge}
        >
          Got it
        </ReperePopover.AcknowledgeButton>
      </ReperePopover.Footer>
    </ReperePopover>
  );
};

export default Popover;
