import {
  AnchorPoint,
  Animation,
  PositioningStrategy,
  type RepereReactConfig,
} from "@repere/react";

import CurrentSessionPricingBeacon from "../current-session/CurrentSession.beacons/CurrentSessionPricingBeacon";
import CurrentSessionStartSessionBeacon from "../current-session/CurrentSession.beacons/CurrentSessionStartSessionBeacon";
import GameInfoBeacon from "../game-info/GameInfo.beacon";
import OverlayBeacon from "../overlay/Overlay.beacon";
import Trigger from "./Onboarding.components/Trigger";
import { repereStoreAdapter } from "./repereStoreAdapter";

export const onboardingConfig: RepereReactConfig = {
  store: repereStoreAdapter,
  trigger: {
    delay: 500,
    component: Trigger,
    positioningStrategy: PositioningStrategy.Absolute,
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
      path: "/current-session",
      beacons: [
        {
          id: "stash-prices",
          selector: "[data-onboarding='current-session-pricing']",
          trigger: {
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
