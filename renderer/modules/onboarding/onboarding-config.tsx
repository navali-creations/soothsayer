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
import CurrentSessionRaritySourceBeacon from "../current-session/CurrentSession.beacons/CurrentSessionRaritySourceBeacon";
import CurrentSessionStartSessionBeacon from "../current-session/CurrentSession.beacons/CurrentSessionStartSessionBeacon";
import GameInfoBeacon from "../game-info/GameInfo.beacon";
import OverlayBeacon from "../overlay/Overlay.beacon";
import RarityModelPoeNinjaBeacon from "../rarity-model/RarityModel.beacons/RarityModelPoeNinjaBeacon";
import RarityModelProhibitedLibraryBeacon from "../rarity-model/RarityModel.beacons/RarityModelProhibitedLibraryBeacon";
import RarityModelRefreshBeacon from "../rarity-model/RarityModel.beacons/RarityModelRefreshBeacon";
import RarityModelScanBeacon from "../rarity-model/RarityModel.beacons/RarityModelScanBeacon";
import RarityModelToolbarBeacon from "../rarity-model/RarityModel.beacons/RarityModelToolbarBeacon";
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
          id: "current-session-rarity-source",
          selector: "[data-onboarding='current-session-rarity-source']",
          trigger: {
            component: createTrackedTrigger("current-session-rarity-source"),
            anchorPoint: AnchorPoint.LeftCenter,
            offset: {
              x: -10,
            },
          },
          popover: {
            component: CurrentSessionRaritySourceBeacon,
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 10,
            },
          },
        },
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
            anchorPoint: AnchorPoint.BottomCenter,
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
    {
      id: "rarity-model-page",
      path: "/rarity-model",
      beacons: [
        {
          id: "rarity-model-poe-ninja",
          selector: "[data-onboarding='rarity-model-poe-ninja']",
          trigger: {
            component: createTrackedTrigger("rarity-model-poe-ninja"),
            anchorPoint: AnchorPoint.TopRight,
          },
          popover: {
            component: RarityModelPoeNinjaBeacon,
            anchorPoint: AnchorPoint.BottomLeft,
            offset: {
              y: 10,
            },
          },
        },
        {
          id: "rarity-model-prohibited-library",
          selector: "[data-onboarding='rarity-model-prohibited-library']",
          trigger: {
            component: createTrackedTrigger("rarity-model-prohibited-library"),
            anchorPoint: AnchorPoint.TopRight,
          },
          popover: {
            component: RarityModelProhibitedLibraryBeacon,
            anchorPoint: AnchorPoint.BottomLeft,
            offset: {
              y: 10,
            },
          },
        },
        {
          id: "rarity-model-refresh",
          selector: "[data-onboarding='rarity-model-refresh']",
          trigger: {
            component: createTrackedTrigger("rarity-model-refresh"),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 5,
            },
          },
          popover: {
            component: RarityModelRefreshBeacon,
            anchorPoint: AnchorPoint.BottomLeft,
            offset: {
              y: 10,
            },
          },
        },
        {
          id: "rarity-model-scan",
          selector: "[data-onboarding='rarity-model-scan']",
          trigger: {
            component: createTrackedTrigger("rarity-model-scan"),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 5,
            },
          },
          popover: {
            component: RarityModelScanBeacon,
            anchorPoint: AnchorPoint.BottomRight,
            offset: {
              y: 10,
            },
          },
        },
        {
          id: "rarity-model-toolbar",
          selector: "[data-onboarding='rarity-model-toolbar']",
          trigger: {
            component: createTrackedTrigger("rarity-model-toolbar"),
            anchorPoint: AnchorPoint.TopCenter,
            offset: {
              y: -5,
            },
          },
          popover: {
            component: RarityModelToolbarBeacon,
            anchorPoint: AnchorPoint.BottomRight,
            offset: {
              y: 10,
            },
          },
        },
      ],
    },
  ],
};
