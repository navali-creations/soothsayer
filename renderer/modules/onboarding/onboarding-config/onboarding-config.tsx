import {
  AnchorPoint,
  Animation,
  PositioningStrategy,
  type RepereReactConfig,
  RepereTrigger,
} from "@repere/react";
import type { ComponentType } from "react";
import { TiInfoLargeOutline } from "react-icons/ti";

import { Button } from "~/renderer/components";

import CurrentSessionRaritySourceBeacon from "../../current-session/CurrentSession.beacons/CurrentSessionRaritySourceBeacon";
import CurrentSessionStartSessionBeacon from "../../current-session/CurrentSession.beacons/CurrentSessionStartSessionBeacon";
import GameInfoBeacon from "../../game-info/GameInfo.beacon";
import OverlayBeacon from "../../overlay/Overlay.beacon";
import PFBaseRateBeacon from "../../profit-forecast/ProfitForecast.beacons/PFBaseRate.beacon";
import PFBreakEvenBeacon from "../../profit-forecast/ProfitForecast.beacons/PFBreakEven.beacon";
import PFCostModelBeacon from "../../profit-forecast/ProfitForecast.beacons/PFCostModel.beacon";
import PFPlAllDropsBeacon from "../../profit-forecast/ProfitForecast.beacons/PFPlAllDrops.beacon";
import PFPlCardOnlyBeacon from "../../profit-forecast/ProfitForecast.beacons/PFPlCardOnly.beacon";
import RarityInsightsPoeNinjaBeacon from "../../rarity-insights/RarityInsights.beacons/RarityInsightsPoeNinjaBeacon";
import RarityInsightsProhibitedLibraryBeacon from "../../rarity-insights/RarityInsights.beacons/RarityInsightsProhibitedLibraryBeacon";
import RarityInsightsRefreshBeacon from "../../rarity-insights/RarityInsights.beacons/RarityInsightsRefreshBeacon";
import RarityInsightsScanBeacon from "../../rarity-insights/RarityInsights.beacons/RarityInsightsScanBeacon";
import RarityInsightsToolbarBeacon from "../../rarity-insights/RarityInsights.beacons/RarityInsightsToolbarBeacon";
import { repereStoreAdapter } from "../repereStoreAdapter/repereStoreAdapter";

const createTrigger = () => () => (
  <RepereTrigger
    as={Button}
    circle
    size="xs"
    className="bg-[color-mix(in_oklab,var(--color-accent)_70%,black)]  hover:bg-[color-mix(in_oklab,var(--color-primary)_100%,white)] hover:text-accent-content/80 animate-pulse-ring border-2 border-primary"
  >
    <TiInfoLargeOutline size={18} />
  </RepereTrigger>
);

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
            component: createTrigger(),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 5,
            },
          },
          popover: {
            component: GameInfoBeacon as ComponentType<any>,
            offset: {
              y: 10,
            },
          },
        },
        {
          id: "overlay-icon",
          selector: "[data-onboarding='overlay-icon']",
          trigger: {
            component: createTrigger(),
            anchorPoint: AnchorPoint.BottomCenter,
          },
          popover: {
            component: OverlayBeacon as ComponentType<any>,
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
            component: createTrigger(),
            anchorPoint: AnchorPoint.LeftCenter,
            offset: {
              x: -10,
            },
          },
          popover: {
            component: CurrentSessionRaritySourceBeacon as ComponentType<any>,
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 10,
            },
          },
        },
        {
          id: "start-session",
          selector: "[data-onboarding='start-session']",
          trigger: {
            component: createTrigger(),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 0,
            },
          },
          popover: {
            component: CurrentSessionStartSessionBeacon as ComponentType<any>,
            anchorPoint: AnchorPoint.BottomLeft,
            offset: {
              y: 10,
            },
          },
        },
      ],
    },
    {
      id: "rarity-insights-page",
      path: "/rarity-insights",
      beacons: [
        {
          id: "rarity-insights-poe-ninja",
          selector: "[data-onboarding='rarity-insights-poe-ninja']",
          trigger: {
            component: createTrigger(),
            anchorPoint: AnchorPoint.TopRight,
          },
          popover: {
            component: RarityInsightsPoeNinjaBeacon as ComponentType<any>,
            anchorPoint: AnchorPoint.BottomLeft,
            offset: {
              y: 10,
            },
          },
        },
        {
          id: "rarity-insights-prohibited-library",
          selector: "[data-onboarding='rarity-insights-prohibited-library']",
          trigger: {
            component: createTrigger(),
            anchorPoint: AnchorPoint.TopRight,
          },
          popover: {
            component:
              RarityInsightsProhibitedLibraryBeacon as ComponentType<any>,
            anchorPoint: AnchorPoint.BottomLeft,
            offset: {
              y: 10,
            },
          },
        },
        {
          id: "rarity-insights-refresh",
          selector: "[data-onboarding='rarity-insights-refresh']",
          trigger: {
            component: createTrigger(),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 5,
            },
          },
          popover: {
            component: RarityInsightsRefreshBeacon as ComponentType<any>,
            anchorPoint: AnchorPoint.BottomLeft,
            offset: {
              y: 10,
            },
          },
        },
        {
          id: "rarity-insights-scan",
          selector: "[data-onboarding='rarity-insights-scan']",
          trigger: {
            component: createTrigger(),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 5,
            },
          },
          popover: {
            component: RarityInsightsScanBeacon as ComponentType<any>,
            anchorPoint: AnchorPoint.BottomRight,
            offset: {
              y: 10,
            },
          },
        },
        {
          id: "rarity-insights-toolbar",
          selector: "[data-onboarding='rarity-insights-toolbar']",
          trigger: {
            component: createTrigger(),
            anchorPoint: AnchorPoint.TopCenter,
            offset: {
              y: -5,
            },
          },
          popover: {
            component: RarityInsightsToolbarBeacon as ComponentType<any>,
            anchorPoint: AnchorPoint.BottomRight,
            offset: {
              y: 10,
            },
          },
        },
      ],
    },
    {
      id: "profit-forecast-page",
      path: "/profit-forecast",
      beacons: [
        {
          id: "pf-pl-card-only",
          selector: "[data-onboarding='pf-pl-card-only']",
          trigger: {
            component: createTrigger(),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 5,
            },
          },
          popover: {
            component: PFPlCardOnlyBeacon as ComponentType<any>,
            anchorPoint: AnchorPoint.BottomLeft,
            offset: {
              y: 5,
            },
          },
        },
        {
          id: "pf-pl-all-drops",
          selector: "[data-onboarding='pf-pl-all-drops']",
          trigger: {
            component: createTrigger(),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 5,
            },
          },
          popover: {
            component: PFPlAllDropsBeacon as ComponentType<any>,
            anchorPoint: AnchorPoint.BottomLeft,
            offset: {
              y: 5,
            },
          },
        },
        {
          id: "pf-break-even-rate",
          selector: "[data-onboarding='pf-break-even-rate']",
          trigger: {
            component: createTrigger(),
            anchorPoint: AnchorPoint.TopCenter,
            offset: {
              y: 10,
            },
          },
          popover: {
            component: PFBreakEvenBeacon as ComponentType<any>,
            anchorPoint: AnchorPoint.BottomLeft,
            offset: {
              y: 10,
            },
          },
        },
        {
          id: "pf-cost-model",
          selector: "[data-onboarding='pf-cost-model']",
          trigger: {
            component: createTrigger(),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: -10,
            },
          },
          popover: {
            component: PFCostModelBeacon as ComponentType<any>,
            anchorPoint: AnchorPoint.BottomRight,
            offset: {
              x: 20,
            },
          },
        },
        {
          id: "pf-base-rate",
          selector: "[data-onboarding='pf-base-rate']",
          trigger: {
            component: createTrigger(),
            anchorPoint: AnchorPoint.TopCenter,
            offset: {
              y: 10,
            },
          },
          popover: {
            component: PFBaseRateBeacon as ComponentType<any>,
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
