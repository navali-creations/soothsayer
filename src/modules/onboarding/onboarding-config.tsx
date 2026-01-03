import { Animation, Position, type RepereReactConfig } from "@repere/react";
import CurrentSessionPricingBeacon from "../current-session/CurrentSession.beacons/CurrentSessionPricingBeacon";
import GameInfoBeacon from "../game-info/GameInfo.beacon";
import OverlayBeacon from "../overlay/Overlay.beacon";
import Trigger from "./Onboarding.components/Trigger";
import { repereStoreAdapter } from "./repereStoreAdapter";

export const onboardingConfig: RepereReactConfig = {
  store: repereStoreAdapter,
  trigger: {
    component: Trigger,
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
            position: Position.BottomCenter,
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
            position: Position.BottomCenter,
          },
          popover: {
            component: OverlayBeacon,
            position: Position.BottomRight,
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
            position: Position.BottomCenter,
            offset: {
              y: 15,
            },
          },
          popover: {
            component: CurrentSessionPricingBeacon,
            position: Position.BottomRight,
            offset: {
              y: 10,
            },
          },
        },
      ],
    },
  ],
};
