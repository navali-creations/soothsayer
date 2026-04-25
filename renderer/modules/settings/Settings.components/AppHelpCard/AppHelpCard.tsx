import { useCallback, useEffect, useRef, useState } from "react";
import { FiFileText } from "react-icons/fi";

import { Accordion, Badge, Button } from "~/renderer/components";
import { OnboardingButton } from "~/renderer/modules/onboarding";
import { allOnboardingBeaconIds } from "~/renderer/modules/onboarding/onboarding-config/onboarding-labels";
import { trackEvent } from "~/renderer/modules/umami";
import {
  useBoundStore,
  useOnboardingActions,
  useOnboardingState,
} from "~/renderer/store";

import BeaconManagementList from "./BeaconManagementList";

const DISMISS_ALL_BADGE_DURATION_MS = 2_000;

const AppHelpCard = () => {
  const [isDismissingAll, setIsDismissingAll] = useState(false);
  const [showDismissedBadge, setShowDismissedBadge] = useState(false);
  // Keep track of the pending auto-hide timer so repeat clicks and unmounts
  // can cancel the previous badge dismissal cleanly.
  const dismissBadgeTimeoutRef = useRef<number | null>(null);

  const { dismissAll, dismiss, resetOne, refreshBeaconHost } =
    useOnboardingActions();
  const { dismissedBeacons } = useOnboardingState();

  const dismissedBeaconSet = new Set(dismissedBeacons);
  const beaconStates = allOnboardingBeaconIds.map((id) => ({
    id,
    dismissed: dismissedBeaconSet.has(id),
  }));
  const dismissedCount = beaconStates.filter(
    (beacon) => beacon.dismissed,
  ).length;
  const allDismissed =
    beaconStates.length > 0 && dismissedCount === allOnboardingBeaconIds.length;

  const runBeaconManagementMutation = useCallback(
    async (mutation: () => Promise<void>) => {
      const previousDismissed = useBoundStore
        .getState()
        .onboarding.dismissedBeacons.join("|");

      await mutation();

      const nextDismissed = useBoundStore
        .getState()
        .onboarding.dismissedBeacons.join("|");

      if (previousDismissed !== nextDismissed) {
        refreshBeaconHost();
        return true;
      }

      return false;
    },
    [refreshBeaconHost],
  );

  const handleOpenDiagLog = useCallback(async () => {
    await window.electron.diagLog.revealLogFile();
  }, []);

  const handleDismissBeacon = useCallback(
    async (key: (typeof allOnboardingBeaconIds)[number]) => {
      await runBeaconManagementMutation(() => dismiss(key));
    },
    [dismiss, runBeaconManagementMutation],
  );

  const handleResetBeacon = useCallback(
    async (key: (typeof allOnboardingBeaconIds)[number]) => {
      await runBeaconManagementMutation(() => resetOne(key));
    },
    [resetOne, runBeaconManagementMutation],
  );

  const handleDismissAllBeacons = useCallback(async () => {
    setIsDismissingAll(true);

    try {
      const didDismiss = await runBeaconManagementMutation(() => dismissAll());

      if (!didDismiss) {
        return;
      }

      trackEvent("onboarding-all-dismissed", {
        source: "settings",
      });
      setShowDismissedBadge(true);

      if (dismissBadgeTimeoutRef.current !== null) {
        window.clearTimeout(dismissBadgeTimeoutRef.current);
      }

      // Show a brief confirmation badge, then hide it automatically.
      dismissBadgeTimeoutRef.current = window.setTimeout(() => {
        setShowDismissedBadge(false);
      }, DISMISS_ALL_BADGE_DURATION_MS);
    } catch (error) {
      console.error("Failed to dismiss all onboarding beacons:", error);
    } finally {
      setIsDismissingAll(false);
    }
  }, [dismissAll, runBeaconManagementMutation]);

  useEffect(() => {
    return () => {
      if (dismissBadgeTimeoutRef.current !== null) {
        // Avoid firing the delayed state update after the card unmounts.
        window.clearTimeout(dismissBadgeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">App Help</h2>
        <p className="text-sm text-base-content/60">
          Need help getting started or want a refresher?
        </p>

        <div className="divider"></div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold">App Tour</h3>
            <p className="mt-1 text-sm text-base-content/60">
              Interactive beacons guide you through Soothsayer's features.
              Dismissed a beacon? Reset the tour to see them all again.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissAllBeacons}
                disabled={isDismissingAll || allDismissed}
              >
                {isDismissingAll ? "Dismissing..." : "Dismiss All Beacons"}
              </Button>
              <OnboardingButton variant="button" size="sm" />
            </div>
            {showDismissedBadge && (
              <Badge variant="success" size="sm">
                All dismissed
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-4" data-testid="manage-beacons-section">
          <Accordion
            title="Manage Beacons"
            headerRight={`${dismissedCount} / ${allOnboardingBeaconIds.length} dismissed`}
            contentClassName="pt-3"
          >
            <p className="mb-3 text-sm text-base-content/60">
              Toggle on keeps a beacon visible in the tour. Toggle off dismisses
              it until you reset it.
            </p>
            <BeaconManagementList
              beaconStates={beaconStates}
              onDismiss={handleDismissBeacon}
              onReset={handleResetBeacon}
            />
          </Accordion>
        </div>

        <div className="divider"></div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold">Diagnostic Log</h3>
            <p className="mt-1 text-sm text-base-content/60">
              View startup and authentication logs for troubleshooting. The log
              is cleared on each app launch.
            </p>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleOpenDiagLog}
          >
            <FiFileText />
            Open log file
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppHelpCard;
