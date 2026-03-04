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
import PFBaseRateBeacon from "../profit-forecast/ProfitForecast.beacons/PFBaseRate.beacon";
import PFBreakEvenBeacon from "../profit-forecast/ProfitForecast.beacons/PFBreakEven.beacon";
import PFCostModelBeacon from "../profit-forecast/ProfitForecast.beacons/PFCostModel.beacon";
import PFPlAllDropsBeacon from "../profit-forecast/ProfitForecast.beacons/PFPlAllDrops.beacon";
import PFPlCardOnlyBeacon from "../profit-forecast/ProfitForecast.beacons/PFPlCardOnly.beacon";
import RarityInsightsPoeNinjaBeacon from "../rarity-insights/RarityInsights.beacons/RarityInsightsPoeNinjaBeacon";
import RarityInsightsProhibitedLibraryBeacon from "../rarity-insights/RarityInsights.beacons/RarityInsightsProhibitedLibraryBeacon";
import RarityInsightsRefreshBeacon from "../rarity-insights/RarityInsights.beacons/RarityInsightsRefreshBeacon";
import RarityInsightsScanBeacon from "../rarity-insights/RarityInsights.beacons/RarityInsightsScanBeacon";
import RarityInsightsToolbarBeacon from "../rarity-insights/RarityInsights.beacons/RarityInsightsToolbarBeacon";
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
      id: "rarity-insights-page",
      path: "/rarity-insights",
      beacons: [
        {
          id: "rarity-insights-poe-ninja",
          selector: "[data-onboarding='rarity-insights-poe-ninja']",
          trigger: {
            component: createTrackedTrigger("rarity-insights-poe-ninja"),
            anchorPoint: AnchorPoint.TopRight,
          },
          popover: {
            component: RarityInsightsPoeNinjaBeacon,
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
            component: createTrackedTrigger(
              "rarity-insights-prohibited-library",
            ),
            anchorPoint: AnchorPoint.TopRight,
          },
          popover: {
            component: RarityInsightsProhibitedLibraryBeacon,
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
            component: createTrackedTrigger("rarity-insights-refresh"),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 5,
            },
          },
          popover: {
            component: RarityInsightsRefreshBeacon,
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
            component: createTrackedTrigger("rarity-insights-scan"),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 5,
            },
          },
          popover: {
            component: RarityInsightsScanBeacon,
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
            component: createTrackedTrigger("rarity-insights-toolbar"),
            anchorPoint: AnchorPoint.TopCenter,
            offset: {
              y: -5,
            },
          },
          popover: {
            component: RarityInsightsToolbarBeacon,
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
            component: createTrackedTrigger("pf-pl-card-only"),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 5,
            },
          },
          popover: {
            component: PFPlCardOnlyBeacon,
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
            component: createTrackedTrigger("pf-pl-all-drops"),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: 5,
            },
          },
          popover: {
            component: PFPlAllDropsBeacon,
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
            component: createTrackedTrigger("pf-break-even-rate"),
            anchorPoint: AnchorPoint.TopCenter,
            offset: {
              y: 10,
            },
          },
          popover: {
            component: PFBreakEvenBeacon,
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
            component: createTrackedTrigger("pf-cost-model"),
            anchorPoint: AnchorPoint.BottomCenter,
            offset: {
              y: -10,
            },
          },
          popover: {
            component: PFCostModelBeacon,
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
            component: createTrackedTrigger("pf-base-rate"),
            anchorPoint: AnchorPoint.TopCenter,
            offset: {
              y: 10,
            },
          },
          popover: {
            component: PFBaseRateBeacon,
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
