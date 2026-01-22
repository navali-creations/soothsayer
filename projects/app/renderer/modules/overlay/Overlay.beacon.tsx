import type { PopoverComponentProps } from "@repere/react";
import { useState } from "react";
import { FiInfo } from "react-icons/fi";
import Popover from "../onboarding/Onboarding.components/Popover";

const OverlayBeacon = (props: PopoverComponentProps) => {
  const [videoLoaded, setVideoLoaded] = useState(false);

  return (
    <Popover
      title="Overlay Window"
      subtitle="Track your divination card drops in real-time while playing Path of Exile."
      {...props}
    >
      <div className="space-y-3">
        <div className="rounded-lg overflow-hidden border-2 border-accent/30 shadow-lg">
          {!videoLoaded && (
            <div className="w-full h-48 bg-base-200 animate-pulse flex items-center justify-center">
              <span className="text-base-content/50">Loading video...</span>
            </div>
          )}
          <video
            src={
              new URL("../../assets/video/overlay.mp4", import.meta.url).href
            }
            autoPlay
            loop
            muted
            className={`w-full ${videoLoaded ? "" : "hidden"}`}
            onLoadedData={() => setVideoLoaded(true)}
          />
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-primary flex items-center">
            How It Works
          </p>
          <ul className="space-y-2 text-sm text-base-content/80">
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                Reads your Client.txt file to detect card drops in real-time
                during active sessions
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>View per card value at a glance</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                Switch between "All" (all cards) and "Valuable" (filters last 10
                drops to only show uncommon and above cards based on poe.ninja
                pricing)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                Rare drops (uncommon and above) play default PoE drop sounds
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                The overlay is transparent and stays on top of your game
              </span>
            </li>
          </ul>
        </div>

        <div className="alert alert-soft alert-info bg-info/10">
          <FiInfo size={20} />
          <span>
            Click the overlay icon to toggle the overlay window on/off while
            tracking.
          </span>
        </div>
      </div>
    </Popover>
  );
};

export default OverlayBeacon;
