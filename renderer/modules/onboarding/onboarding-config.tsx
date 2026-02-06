import {
  AnchorPoint,
  Animation,
  PositioningStrategy,
  type RepereReactConfig,
  RepereTrigger,
} from "@repere/react";
import { TiInfoLargeOutline } from "react-icons/ti";

import { Button } from "~/renderer/components";

import CurrentSessionPricingBeacon from "../current-session/CurrentSession.beacons/CurrentSessionPricingBeacon";
import CurrentSessionStartSessionBeacon from "../current-session/CurrentSession.beacons/CurrentSessionStartSessionBeacon";
import GameInfoBeacon from "../game-info/GameInfo.beacon";
import OverlayBeacon from "../overlay/Overlay.beacon";
import { trackEvent } from "../umami";
import { repereStoreAdapter } from "./repereStoreAdapter";

// Factory function to create tracked triggers that fire on click
const createTrackedTrigger = (beaconId: string) => {
  return () => {
    const handleClick = () => {
      trackEvent("onboarding-trigger-clicked", { beaconId });
    };

    return (
      <RepereTrigger
        as={Button}
        circle
        size="xs"
        className="bg-[color-mix(in_oklab,var(--color-accent)_70%,black)]  hover:bg-[color-mix(in_oklab,var(--color-primary)_100%,white)] hover:text-accent-content/80 animate-pulse-ring border-2 border-primary"
        onClick={handleClick}
      >
        <TiInfoLargeOutline size={18} />
      </RepereTrigger>
    );
  };
};

export const onboardingConfig: RepereReactConfig = {
  store: repereStoreAdapter,
  trigger: {
    delay: 500,
    positioningStrategy: PositioningStrategy.Fixed,
    animations: {
      onRender: Animation.SlideDown,
      onDismiss: Animation.Fade,
    },
  },
  popover: {
    animations: {
      onOpen: Animation.SlideDown,
      onClose: Animation.Fade,
    },
  },

  pages: [
    {
      id: "all-pages",
      path: "*",
      beacons: [
        {
          id: "game-selector",
          selector: "[data-onboarding='game-selector']",
          trigger: {
            component: createTrackedTrigger("game-selector"),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 5,
            },
          },
          popover: {
            component: GameInfoBeacon,
            offset: {
              y: 10,
            },
          },
        },
        {
          id: "overlay-icon",
          selector: "[data-onboarding='overlay-icon']",
          trigger: {
            component: createTrackedTrigger("overlay-icon"),
            anchorPoint: AnchorPoint.BottomCenter,
          },
          popover: {
            component: OverlayBeacon,
            anchorPoint: AnchorPoint.BottomRight,
            offset: {
              y: 10,
            },
          },
        },
      ],
    },
    {
      id: "current-session-page",
      path: "/",
      beacons: [
        {
          id: "stash-prices",
          selector: "[data-onboarding='current-session-pricing']",
          trigger: {
            component: createTrackedTrigger("stash-prices"),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 15,
            },
          },
          popover: {
            component: CurrentSessionPricingBeacon,
            anchorPoint: AnchorPoint.BottomRight,
            offset: {
              y: 10,
            },
          },
        },
        {
          id: "start-session",
          selector: "[data-onboarding='start-session']",
          trigger: {
            component: createTrackedTrigger("start-session"),
            anchorPoint: AnchorPoint.LeftCenter,
            offset: {
              y: 0,
            },
          },
          popover: {
            component: CurrentSessionStartSessionBeacon,
            anchorPoint: AnchorPoint.BottomLeft,
            offset: {
              y: 10,
            },
          },
        },
      ],
    },
  ],
};
