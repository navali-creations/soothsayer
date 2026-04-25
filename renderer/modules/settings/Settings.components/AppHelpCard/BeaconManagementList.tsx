import { Accordion } from "~/renderer/components";
import {
  type OnboardingBeaconId,
  onboardingBeaconGroups,
} from "~/renderer/modules/onboarding/onboarding-config/onboarding-labels";

interface BeaconManagementListProps {
  beaconStates: {
    id: string;
    dismissed: boolean;
  }[];
  onDismiss: (key: OnboardingBeaconId) => Promise<void> | void;
  onReset: (key: OnboardingBeaconId) => Promise<void> | void;
}

const BeaconManagementList = ({
  beaconStates,
  onDismiss,
  onReset,
}: BeaconManagementListProps) => {
  const beaconStatesById = new Map(
    beaconStates.map((beacon) => [beacon.id, beacon.dismissed]),
  );

  return (
    <div className="space-y-3" data-testid="beacon-management-list">
      {onboardingBeaconGroups.map((group, index) => {
        const dismissedCount = group.beacons.filter((beacon) => {
          return beaconStatesById.get(beacon.id) === true;
        }).length;

        return (
          <div
            key={group.pageId}
            data-testid={`beacon-group-${group.pageId}`}
            data-beacon-page={group.pageId}
          >
            <Accordion
              title={group.pageLabel}
              defaultOpen={index === 0}
              headerRight={`${dismissedCount} / ${group.beacons.length} dismissed`}
              contentClassName="pt-2"
            >
              <div className="space-y-2">
                {group.beacons.map((beacon) => {
                  const dismissed = beaconStatesById.get(beacon.id) === true;
                  const isVisible = !dismissed;

                  return (
                    <div
                      key={beacon.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-base-300 bg-base-100 px-3 py-2"
                      data-testid={`beacon-row-${beacon.id}`}
                      data-beacon-id={beacon.id}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{beacon.label}</p>
                      </div>
                      <label className="flex shrink-0 items-center gap-3">
                        <span
                          className={`text-xs font-medium ${
                            isVisible ? "text-success" : "text-base-content/60"
                          }`}
                        >
                          {isVisible ? "Visible in tour" : "Dismissed"}
                        </span>
                        <input
                          type="checkbox"
                          className="toggle toggle-sm toggle-primary"
                          checked={isVisible}
                          aria-label={`${isVisible ? "Dismiss" : "Show"} ${beacon.label} beacon`}
                          onChange={(event) => {
                            if (event.target.checked) {
                              onReset(beacon.id);
                              return;
                            }

                            onDismiss(beacon.id);
                          }}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            </Accordion>
          </div>
        );
      })}
    </div>
  );
};

export default BeaconManagementList;
