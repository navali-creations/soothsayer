export const onboardingPageLabels = {
  "all-pages": "All Pages",
  "current-session-page": "Current Session",
  "rarity-insights-page": "Rarity Insights",
  "profit-forecast-page": "Profit Forecast",
} as const;

export const onboardingBeaconLabels = {
  "game-selector": "Game selector",
  "overlay-icon": "Overlay icon",
  "current-session-rarity-source": "Rarity source",
  "stash-prices": "Stash prices",
  "start-session": "Start session",
  "rarity-insights-poe-ninja": "poe.ninja prices",
  "rarity-insights-prohibited-library": "Prohibited Library prices",
  "rarity-insights-refresh": "Refresh insights",
  "rarity-insights-scan": "Scan insights",
  "rarity-insights-toolbar": "Insights toolbar",
  "pf-pl-card-only": "P&L card-only view",
  "pf-pl-all-drops": "P&L all-drops view",
  "pf-break-even-rate": "Break-even rate",
  "pf-cost-model": "Cost model",
  "pf-base-rate": "Base rate",
} as const;

export type OnboardingPageId = keyof typeof onboardingPageLabels;
export type OnboardingBeaconId = keyof typeof onboardingBeaconLabels;

export interface OnboardingBeaconGroup {
  pageId: OnboardingPageId;
  pageLabel: string;
  beacons: {
    id: OnboardingBeaconId;
    label: string;
  }[];
}

export interface OnboardingBeaconDefinition {
  pageId: OnboardingPageId;
  pageLabel: string;
  beaconId: OnboardingBeaconId;
  label: string;
}

export const onboardingBeaconGroups: OnboardingBeaconGroup[] = [
  {
    pageId: "all-pages",
    pageLabel: onboardingPageLabels["all-pages"],
    beacons: [
      {
        id: "game-selector",
        label: onboardingBeaconLabels["game-selector"],
      },
      {
        id: "overlay-icon",
        label: onboardingBeaconLabels["overlay-icon"],
      },
    ],
  },
  {
    pageId: "current-session-page",
    pageLabel: onboardingPageLabels["current-session-page"],
    beacons: [
      {
        id: "current-session-rarity-source",
        label: onboardingBeaconLabels["current-session-rarity-source"],
      },
      {
        id: "stash-prices",
        label: onboardingBeaconLabels["stash-prices"],
      },
      {
        id: "start-session",
        label: onboardingBeaconLabels["start-session"],
      },
    ],
  },
  {
    pageId: "rarity-insights-page",
    pageLabel: onboardingPageLabels["rarity-insights-page"],
    beacons: [
      {
        id: "rarity-insights-poe-ninja",
        label: onboardingBeaconLabels["rarity-insights-poe-ninja"],
      },
      {
        id: "rarity-insights-prohibited-library",
        label: onboardingBeaconLabels["rarity-insights-prohibited-library"],
      },
      {
        id: "rarity-insights-refresh",
        label: onboardingBeaconLabels["rarity-insights-refresh"],
      },
      {
        id: "rarity-insights-scan",
        label: onboardingBeaconLabels["rarity-insights-scan"],
      },
      {
        id: "rarity-insights-toolbar",
        label: onboardingBeaconLabels["rarity-insights-toolbar"],
      },
    ],
  },
  {
    pageId: "profit-forecast-page",
    pageLabel: onboardingPageLabels["profit-forecast-page"],
    beacons: [
      {
        id: "pf-pl-card-only",
        label: onboardingBeaconLabels["pf-pl-card-only"],
      },
      {
        id: "pf-pl-all-drops",
        label: onboardingBeaconLabels["pf-pl-all-drops"],
      },
      {
        id: "pf-break-even-rate",
        label: onboardingBeaconLabels["pf-break-even-rate"],
      },
      {
        id: "pf-cost-model",
        label: onboardingBeaconLabels["pf-cost-model"],
      },
      {
        id: "pf-base-rate",
        label: onboardingBeaconLabels["pf-base-rate"],
      },
    ],
  },
];

export const allOnboardingBeaconIds = onboardingBeaconGroups.flatMap((group) =>
  group.beacons.map((beacon) => beacon.id),
);

export const getAllOnboardingBeaconDefinitions =
  (): OnboardingBeaconDefinition[] => {
    return onboardingBeaconGroups.flatMap((group) =>
      group.beacons.map((beacon) => ({
        pageId: group.pageId,
        pageLabel: group.pageLabel,
        beaconId: beacon.id,
        label: beacon.label,
      })),
    );
  };
