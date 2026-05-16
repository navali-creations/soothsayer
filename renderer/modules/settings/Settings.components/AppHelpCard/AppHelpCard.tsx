import { useCallback, useEffect, useRef, useState } from "react";
import { FiExternalLink, FiGithub } from "react-icons/fi";
import { RiDiscordLine } from "react-icons/ri";

import { Badge, Button } from "~/renderer/components";
import { OnboardingButton } from "~/renderer/modules/onboarding";
import { allOnboardingBeaconIds } from "~/renderer/modules/onboarding/onboarding-config/onboarding-labels";
import { trackEvent } from "~/renderer/modules/umami";
import {
  useBoundStore,
  useOnboardingActions,
  useOnboardingState,
} from "~/renderer/store";

import BeaconManagementList from "./BeaconManagementList/BeaconManagementList";

const DISMISS_ALL_BADGE_DURATION_MS = 2_000;
const DISCORD_URL = "https://discord.gg/mrqmPYXHHT";
const REPO_URL = "https://github.com/navali-creations/soothsayer";

const AppHelpCard = () => {
  const [isDismissingAll, setIsDismissingAll] = useState(false);
  const [showDismissedBadge, setShowDismissedBadge] = useState(false);
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
  const visibleCount = allOnboardingBeaconIds.length - dismissedCount;
  const visiblePercentage =
    allOnboardingBeaconIds.length > 0
      ? (visibleCount / allOnboardingBeaconIds.length) * 100
      : 0;
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
        window.clearTimeout(dismissBadgeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-8">
      <div className="sr-only">
        <h2>App Help</h2>
        <p>Need help getting started or want a refresher?</p>
      </div>

      <section className="space-y-3">
        <div className="divide-y divide-base-content/10">
          <div className="flex items-start justify-between gap-4 py-4">
            <div>
              <h3 className="font-semibold">Discord</h3>
              <p className="mt-1 text-sm text-base-content/60">
                Join the community for questions, feedback, and release help.
              </p>
            </div>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open Discord"
              className="btn btn-outline btn-sm"
            >
              <RiDiscordLine />
              Open
              <FiExternalLink />
            </a>
          </div>

          <div className="flex items-start justify-between gap-4 py-4">
            <div>
              <h3 className="font-semibold">GitHub</h3>
              <p className="mt-1 text-sm text-base-content/60">
                View source, releases, issues, and project discussions.
              </p>
            </div>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open GitHub"
              className="btn btn-outline btn-sm"
            >
              <FiGithub />
              Open
              <FiExternalLink />
            </a>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="font-semibold">Interactive beacons</div>
            <p className="mt-1 text-sm text-base-content/60">
              Interactive beacons guide you through Soothsayer's features.
              <span className="block">
                Dismissed a beacon? Reset the tour to see them all again.
              </span>
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

        <div
          className="border-t border-base-content/10 pt-4"
          data-testid="manage-beacons-section"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold">Manage beacons</h3>
              <p className="mt-1 text-sm text-base-content/60">
                Toggle on keeps a beacon visible in the tour. Toggle off
                dismisses it until you reset it.
              </p>
            </div>
            <div className="w-36 shrink-0 text-right">
              <div className="text-xs font-medium text-base-content/60">
                {visibleCount} / {allOnboardingBeaconIds.length} visible
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-base-300">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${visiblePercentage}%` }}
                />
              </div>
            </div>
          </div>

          <BeaconManagementList
            beaconStates={beaconStates}
            onDismiss={handleDismissBeacon}
            onReset={handleResetBeacon}
          />
        </div>
      </section>
    </div>
  );
};

export default AppHelpCard;
