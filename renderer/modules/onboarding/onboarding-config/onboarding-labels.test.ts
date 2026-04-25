import { describe, expect, it, vi } from "vitest";

vi.mock("@repere/react", () => ({
  AnchorPoint: {
    BottomCenter: "BottomCenter",
    LeftCenter: "LeftCenter",
    TopRight: "TopRight",
    TopCenter: "TopCenter",
    BottomRight: "BottomRight",
    BottomLeft: "BottomLeft",
  },
  Animation: { SlideDown: "SlideDown", Fade: "Fade" },
  PositioningStrategy: { Fixed: "Fixed" },
  RepereTrigger: () => null,
}));

vi.mock("~/renderer/components", () => ({
  Button: () => null,
}));

vi.mock("react-icons/ti", () => ({
  TiInfoLargeOutline: () => null,
}));

vi.mock(
  "~/renderer/modules/onboarding/repereStoreAdapter/repereStoreAdapter",
  () => ({
    repereStoreAdapter: {},
  }),
);

vi.mock(
  "~/renderer/modules/current-session/CurrentSession.beacons/CurrentSessionPricingBeacon",
  () => ({ default: () => null }),
);
vi.mock(
  "~/renderer/modules/current-session/CurrentSession.beacons/CurrentSessionRaritySourceBeacon",
  () => ({ default: () => null }),
);
vi.mock(
  "~/renderer/modules/current-session/CurrentSession.beacons/CurrentSessionStartSessionBeacon",
  () => ({ default: () => null }),
);
vi.mock("~/renderer/modules/game-info/GameInfo.beacon", () => ({
  default: () => null,
}));
vi.mock("~/renderer/modules/overlay/Overlay.beacon", () => ({
  default: () => null,
}));
vi.mock(
  "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFBaseRate.beacon",
  () => ({ default: () => null }),
);
vi.mock(
  "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFBreakEven.beacon",
  () => ({ default: () => null }),
);
vi.mock(
  "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFCostModel.beacon",
  () => ({ default: () => null }),
);
vi.mock(
  "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFPlAllDrops.beacon",
  () => ({ default: () => null }),
);
vi.mock(
  "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFPlCardOnly.beacon",
  () => ({ default: () => null }),
);
vi.mock(
  "~/renderer/modules/rarity-insights/RarityInsights.beacons/RarityInsightsPoeNinjaBeacon",
  () => ({ default: () => null }),
);
vi.mock(
  "~/renderer/modules/rarity-insights/RarityInsights.beacons/RarityInsightsProhibitedLibraryBeacon",
  () => ({ default: () => null }),
);
vi.mock(
  "~/renderer/modules/rarity-insights/RarityInsights.beacons/RarityInsightsRefreshBeacon",
  () => ({ default: () => null }),
);
vi.mock(
  "~/renderer/modules/rarity-insights/RarityInsights.beacons/RarityInsightsScanBeacon",
  () => ({ default: () => null }),
);
vi.mock(
  "~/renderer/modules/rarity-insights/RarityInsights.beacons/RarityInsightsToolbarBeacon",
  () => ({ default: () => null }),
);

import { onboardingConfig } from "./onboarding-config";
import {
  allOnboardingBeaconIds,
  getAllOnboardingBeaconDefinitions,
  onboardingBeaconGroups,
  onboardingBeaconLabels,
} from "./onboarding-labels";

describe("onboarding-labels", () => {
  it("covers every beacon id defined in onboardingConfig", () => {
    const configIds = new Set(
      onboardingConfig.pages.flatMap((page) =>
        page.beacons.map((beacon) => beacon.id),
      ),
    );
    const labelledIds = new Set(allOnboardingBeaconIds);

    expect(labelledIds).toEqual(configIds);
  });

  it("exposes labels for every known beacon id", () => {
    for (const beaconId of allOnboardingBeaconIds) {
      expect(onboardingBeaconLabels[beaconId]).toBeTruthy();
    }
  });

  it("returns flattened beacon definitions with matching group order", () => {
    expect(getAllOnboardingBeaconDefinitions()).toEqual(
      onboardingBeaconGroups.flatMap((group) =>
        group.beacons.map((beacon) => ({
          pageId: group.pageId,
          pageLabel: group.pageLabel,
          beaconId: beacon.id,
          label: beacon.label,
        })),
      ),
    );
  });
});
