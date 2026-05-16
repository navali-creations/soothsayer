import clsx from "clsx";
import type { ChangeEvent } from "react";

import type { OnboardingBeaconId } from "~/renderer/modules/onboarding/onboarding-config/onboarding-labels";

interface BeaconManagementRowProps {
  beacon: {
    id: OnboardingBeaconId;
    label: string;
  };
  isVisible: boolean;
  onDismiss: (key: OnboardingBeaconId) => Promise<void> | void;
  onReset: (key: OnboardingBeaconId) => Promise<void> | void;
}

export function BeaconManagementRow({
  beacon,
  isVisible,
  onDismiss,
  onReset,
}: BeaconManagementRowProps) {
  const handleVisibilityChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      onReset(beacon.id);
      return;
    }

    onDismiss(beacon.id);
  };

  return (
    <div
      className="flex items-center justify-between gap-3 py-2"
      data-testid={`beacon-row-${beacon.id}`}
      data-beacon-id={beacon.id}
    >
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {beacon.label}
      </span>
      <label className="flex shrink-0 items-center gap-2">
        <span
          className={clsx("text-xs font-medium", {
            "text-success": isVisible,
            "text-base-content/50": !isVisible,
          })}
        >
          {isVisible ? "Visible" : "Hidden"}
        </span>
        <input
          type="checkbox"
          className="toggle toggle-sm toggle-primary"
          checked={isVisible}
          aria-label={`${isVisible ? "Dismiss" : "Show"} ${beacon.label} beacon`}
          onChange={handleVisibilityChange}
        />
      </label>
    </div>
  );
}
