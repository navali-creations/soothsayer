import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import Popover from "../../onboarding/Onboarding.components/Popover";

const CurrentSessionStartSessionBeacon = (props: PopoverComponentProps) => {
  return (
    <Popover
      title="Current Session"
      subtitle="Track your stacked deck openings in real-time with automatic data persistence."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="font-semibold text-primary flex items-center">
            Real-Time Tracking
          </p>
          <ul className="space-y-2 text-sm text-base-content/80">
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                Updates instantly as you open stacked decks in Path of Exile
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                All data is saved locally on your PC - no third-party services
                or cloud connections
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                You can open up to 10 stacked decks before starting a session to
                capture initial data
              </span>
            </li>
          </ul>
        </div>

        <div className="divider my-2"></div>

        <div className="space-y-2">
          <p className="font-semibold text-primary flex items-center">
            Session Management
          </p>
          <ul className="space-y-2 text-sm text-base-content/80">
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                Click "Start Session" to begin tracking your stacked deck
                openings
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                Sessions can only be started or stopped - there is no pause
                functionality
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                Closing the app will automatically stop the active session
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                When you end a session, it will appear in the Sessions page for
                future reference
              </span>
            </li>
          </ul>
        </div>

        <div className="alert alert-soft alert-info bg-info/10">
          <FiInfo size={20} />
          <span>
            Make sure you have selected the correct game and league before
            starting a session.
          </span>
        </div>
      </div>
    </Popover>
  );
};

export default CurrentSessionStartSessionBeacon;
