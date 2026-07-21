import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import {
  useCardDetails,
  useCommunityDropRate,
  useIsLoadingCommunityDropRate,
} from "~/renderer/store";

vi.mock("~/renderer/store", () => ({
  useCardDetails: vi.fn(),
  useCommunityDropRate: vi.fn(),
  useIsLoadingCommunityDropRate: vi.fn(),
}));

vi.mock("../../helpers", () => ({
  formatRelativeDate: vi.fn(() => ({
    relative: "2 days ago",
    absolute: "Jan 15, 2024",
  })),
}));

import CardDetailsPersonal from "./CardDetailsPersonal";

const validPersonalAnalytics = {
  cardName: "The Doctor",
  totalLifetimeDrops: 42,
  firstDiscoveredAt: "2024-01-10T00:00:00Z",
  lastSeenAt: "2024-06-15T00:00:00Z",
  sessionCount: 8,
  averageDropsPerSession: 5.25,
  fromBoss: false,
  totalDecksOpenedAllSessions: 10_000,
  dropTimeline: [],
  leagueDateRanges: [],
  firstSessionStartedAt: "2024-01-01T00:00:00Z",
  timelineEndDate: "2024-07-01T00:00:00Z",
};

const validCommunityDropRate = {
  league: "Mirage",
  dropCount: 2475,
  sampleSize: 4_207_137,
};

function renderComponent(overrides: Record<string, unknown> = {}) {
  const state = {
    personalAnalytics: validPersonalAnalytics,
    personalAnalyticsError: null,
    communityDropRate: validCommunityDropRate,
    isLoadingCommunityDropRate: false,
    ...overrides,
  };
  vi.mocked(useCardDetails).mockReturnValue(
    state as ReturnType<typeof useCardDetails>,
  );
  vi.mocked(useCommunityDropRate).mockReturnValue(state.communityDropRate);
  vi.mocked(useIsLoadingCommunityDropRate).mockReturnValue(
    state.isLoadingCommunityDropRate,
  );
  return renderWithProviders(<CardDetailsPersonal />);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CardDetailsPersonal", () => {
  it("renders the four stats in the requested order", () => {
    const { container } = renderComponent();
    const stats = [...container.querySelectorAll(".stat")];

    expect(stats).toHaveLength(4);
    expect(stats[0]).toHaveTextContent("Community Drop Chance");
    expect(stats[1]).toHaveTextContent("Your Drop Chance");
    expect(stats[2]).toHaveTextContent("Total Drops");
    expect(stats[3]).toHaveTextContent("Last Seen");
    expect(screen.queryByText("First Found")).not.toBeInTheDocument();
  });

  it("formats both drop chances to six decimal places", () => {
    renderComponent();

    expect(screen.getByText("0.058829%")).toBeInTheDocument();
    expect(screen.getByText("2,475 in 4,207,137 cards")).toBeInTheDocument();
    expect(screen.getByText("0.420000%")).toBeInTheDocument();
    expect(screen.getByText("42 in 10,000 cards")).toBeInTheDocument();
  });

  it("keeps community data visible while personal analytics is unavailable", () => {
    renderComponent({ personalAnalytics: null });

    expect(screen.getByText("0.058829%")).toBeInTheDocument();
    expect(screen.getByText("Your Drop Chance")).toBeInTheDocument();
    expect(screen.getByText("Total Drops")).toBeInTheDocument();
  });

  it("keeps community data visible when personal analytics fails", () => {
    renderComponent({
      personalAnalytics: null,
      personalAnalyticsError: "Failed to load analytics",
    });

    expect(screen.getByText("0.058829%")).toBeInTheDocument();
    expect(screen.getByText("Failed to load analytics")).toBeInTheDocument();
  });

  it("shows community and zero-valued personal stats for a never-found card", () => {
    renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalLifetimeDrops: 0,
      },
    });

    expect(screen.getByText("0.058829%")).toBeInTheDocument();
    expect(screen.getByText("0.000000%")).toBeInTheDocument();
    expect(screen.getByText("You haven't found this card yet")).toBeVisible();
  });

  it("renders the community loading and unavailable states", () => {
    const { rerender } = renderComponent({
      communityDropRate: null,
      isLoadingCommunityDropRate: true,
    });
    expect(
      screen.getByLabelText("Loading community drop chance"),
    ).toBeVisible();

    vi.mocked(useCardDetails).mockReturnValue({
      personalAnalytics: validPersonalAnalytics,
      personalAnalyticsError: null,
    } as ReturnType<typeof useCardDetails>);
    vi.mocked(useCommunityDropRate).mockReturnValue(null);
    vi.mocked(useIsLoadingCommunityDropRate).mockReturnValue(false);
    rerender(<CardDetailsPersonal />);

    expect(screen.getByText("No community data")).toBeVisible();
  });

  it("shows placeholders when no personal deck total is available", () => {
    renderComponent({
      personalAnalytics: {
        ...validPersonalAnalytics,
        totalDecksOpenedAllSessions: 0,
      },
    });

    expect(screen.getByText("Drops per cards opened")).toBeVisible();
  });

  it("keeps the Last Seen column stable when no date exists", () => {
    const { container } = renderComponent({
      personalAnalytics: { ...validPersonalAnalytics, lastSeenAt: null },
    });
    const lastSeen = [...container.querySelectorAll(".stat")][3];

    expect(lastSeen).toHaveTextContent("Last Seen");
    expect(lastSeen).toHaveTextContent("—");
  });
});
