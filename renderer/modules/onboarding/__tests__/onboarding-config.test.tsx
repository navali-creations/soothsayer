import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ─── Mocks ─────────────────────────────────────────────────────────────────

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
  RepereTrigger: ({ children, onClick, ...props }: any) => (
    <button data-testid="repere-trigger" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("~/renderer/components", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("react-icons/ti", () => ({
  TiInfoLargeOutline: (props: any) => (
    <span data-testid="info-icon" {...props} />
  ),
}));

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("~/renderer/modules/onboarding/repereStoreAdapter", () => ({
  repereStoreAdapter: { get: vi.fn(), set: vi.fn() },
}));

// Mock all beacon imports as simple components
vi.mock(
  "~/renderer/modules/current-session/CurrentSession.beacons/CurrentSessionPricingBeacon",
  () => ({ default: () => <div /> }),
);
vi.mock(
  "~/renderer/modules/current-session/CurrentSession.beacons/CurrentSessionRaritySourceBeacon",
  () => ({ default: () => <div /> }),
);
vi.mock(
  "~/renderer/modules/current-session/CurrentSession.beacons/CurrentSessionStartSessionBeacon",
  () => ({ default: () => <div /> }),
);
vi.mock("~/renderer/modules/game-info/GameInfo.beacon", () => ({
  default: () => <div />,
}));
vi.mock("~/renderer/modules/overlay/Overlay.beacon", () => ({
  default: () => <div />,
}));
vi.mock(
  "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFBaseRate.beacon",
  () => ({ default: () => <div /> }),
);
vi.mock(
  "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFBreakEven.beacon",
  () => ({ default: () => <div /> }),
);
vi.mock(
  "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFCostModel.beacon",
  () => ({ default: () => <div /> }),
);
vi.mock(
  "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFPlAllDrops.beacon",
  () => ({ default: () => <div /> }),
);
vi.mock(
  "~/renderer/modules/profit-forecast/ProfitForecast.beacons/PFPlCardOnly.beacon",
  () => ({ default: () => <div /> }),
);
vi.mock(
  "~/renderer/modules/rarity-insights/RarityInsights.beacons/RarityInsightsPoeNinjaBeacon",
  () => ({ default: () => <div /> }),
);
vi.mock(
  "~/renderer/modules/rarity-insights/RarityInsights.beacons/RarityInsightsProhibitedLibraryBeacon",
  () => ({ default: () => <div /> }),
);
vi.mock(
  "~/renderer/modules/rarity-insights/RarityInsights.beacons/RarityInsightsRefreshBeacon",
  () => ({ default: () => <div /> }),
);
vi.mock(
  "~/renderer/modules/rarity-insights/RarityInsights.beacons/RarityInsightsScanBeacon",
  () => ({ default: () => <div /> }),
);
vi.mock(
  "~/renderer/modules/rarity-insights/RarityInsights.beacons/RarityInsightsToolbarBeacon",
  () => ({ default: () => <div /> }),
);

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import { trackEvent } from "~/renderer/modules/umami";

import { onboardingConfig } from "../onboarding-config";

// ─── Helpers ───────────────────────────────────────────────────────────────

const findPage = (id: string) =>
  (onboardingConfig.pages as any[]).find((p: any) => p.id === id);

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("onboardingConfig", () => {
  it("has store adapter", () => {
    expect(onboardingConfig.store).toBeDefined();
    expect(onboardingConfig.store).toHaveProperty("get");
    expect(onboardingConfig.store).toHaveProperty("set");
  });

  it("has trigger settings with delay 500 and Fixed positioning strategy", () => {
    const trigger = onboardingConfig.trigger as any;
    expect(trigger.delay).toBe(500);
    expect(trigger.positioningStrategy).toBe("Fixed");
  });

  it("has popover animation settings", () => {
    const popover = onboardingConfig.popover as any;
    expect(popover.animations.onOpen).toBe("SlideDown");
    expect(popover.animations.onClose).toBe("Fade");
  });

  it("has 4 pages", () => {
    expect(onboardingConfig.pages).toHaveLength(4);
  });

  it('all-pages page has path "*" and 2 beacons', () => {
    const page = findPage("all-pages");
    expect(page).toBeDefined();
    expect(page.path).toBe("*");
    expect(page.beacons).toHaveLength(2);
  });

  it('current-session-page has path "/" and 3 beacons', () => {
    const page = findPage("current-session-page");
    expect(page).toBeDefined();
    expect(page.path).toBe("/");
    expect(page.beacons).toHaveLength(3);
  });

  it('rarity-insights-page has path "/rarity-insights" and 5 beacons', () => {
    const page = findPage("rarity-insights-page");
    expect(page).toBeDefined();
    expect(page.path).toBe("/rarity-insights");
    expect(page.beacons).toHaveLength(5);
  });

  it('profit-forecast-page has path "/profit-forecast" and 5 beacons', () => {
    const page = findPage("profit-forecast-page");
    expect(page).toBeDefined();
    expect(page.path).toBe("/profit-forecast");
    expect(page.beacons).toHaveLength(5);
  });

  it("each beacon has id, selector, trigger, and popover", () => {
    const allBeacons = (onboardingConfig.pages as any[]).flatMap(
      (page: any) => page.beacons,
    );

    for (const beacon of allBeacons) {
      expect(beacon).toHaveProperty("id");
      expect(beacon).toHaveProperty("selector");
      expect(beacon).toHaveProperty("trigger");
      expect(beacon).toHaveProperty("popover");
      expect(typeof beacon.id).toBe("string");
      expect(typeof beacon.selector).toBe("string");
      expect(beacon.trigger).toHaveProperty("component");
      expect(beacon.popover).toHaveProperty("component");
    }
  });

  it("createTrackedTrigger renders a trigger that calls trackEvent on click", async () => {
    const user = userEvent.setup();

    // Grab the first beacon's trigger component (game-selector)
    const allPagesPage = findPage("all-pages");
    const firstBeacon = allPagesPage.beacons[0];
    const TriggerComponent = firstBeacon.trigger.component;

    render(<TriggerComponent />);

    const triggerButton = screen.getByTestId("repere-trigger");
    expect(triggerButton).toBeInTheDocument();

    await user.click(triggerButton);

    expect(trackEvent).toHaveBeenCalledWith("onboarding-trigger-clicked", {
      beaconId: firstBeacon.id,
    });
  });
});
