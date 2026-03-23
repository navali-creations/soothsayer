import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { StatisticsMostCommonCardStat } from "../Statistics.components/StatisticsStats/StatisticsMostCommonCardStat";
import { StatisticsOpenedDecksStat } from "../Statistics.components/StatisticsStats/StatisticsOpenedDecksStat";
import { StatisticsStats } from "../Statistics.components/StatisticsStats/StatisticsStats";
import { StatisticsUniqueCardsStat } from "../Statistics.components/StatisticsStats/StatisticsUniqueCardsStat";
import type { CardEntry } from "../Statistics.types";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/components", () => ({
  Stat: Object.assign(
    ({ children, ...props }: any) => (
      <div data-testid="stat" {...props}>
        {children}
      </div>
    ),
    {
      Title: ({ children, ...props }: any) => (
        <div data-testid="stat-title" {...props}>
          {children}
        </div>
      ),
      Value: ({ children, ...props }: any) => (
        <div data-testid="stat-value" {...props}>
          {children}
        </div>
      ),
      Desc: ({ children, ...props }: any) => (
        <div data-testid="stat-desc" {...props}>
          {children}
        </div>
      ),
    },
  ),
}));

vi.mock("~/renderer/components/CardNameLink/CardNameLink", () => ({
  default: ({ cardName }: any) => (
    <a data-testid="card-name-link">{cardName}</a>
  ),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function setupStore(overrides: { statScope?: "all-time" | "league" } = {}) {
  mockUseBoundStore.mockReturnValue({
    statistics: {
      statScope: overrides.statScope ?? "all-time",
    },
  } as any);
}

function createCardData(
  cards: Array<{ name: string; count: number; ratio: number }>,
): CardEntry[] {
  return cards.map((c) => ({ ...c }));
}

// ─── StatisticsMostCommonCardStat ──────────────────────────────────────────

describe("StatisticsMostCommonCardStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the title 'Most Common'", () => {
    setupStore();
    renderWithProviders(
      <StatisticsMostCommonCardStat cardName="The Doctor" count={10} />,
    );

    expect(screen.getByText("Most Common")).toBeInTheDocument();
  });

  it("renders CardNameLink when cardName is provided", () => {
    setupStore();
    renderWithProviders(
      <StatisticsMostCommonCardStat cardName="Rain of Chaos" count={42} />,
    );

    const link = screen.getByTestId("card-name-link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent("Rain of Chaos");
  });

  it('renders "N/A" when cardName is null', () => {
    setupStore();
    renderWithProviders(
      <StatisticsMostCommonCardStat cardName={null} count={0} />,
    );

    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.queryByTestId("card-name-link")).not.toBeInTheDocument();
  });

  it("renders count in description as '{count} times'", () => {
    setupStore();
    renderWithProviders(
      <StatisticsMostCommonCardStat cardName="The Doctor" count={7} />,
    );

    expect(screen.getByText("7 times")).toBeInTheDocument();
  });

  it("renders '0 times' when count is 0", () => {
    setupStore();
    renderWithProviders(
      <StatisticsMostCommonCardStat cardName={null} count={0} />,
    );

    expect(screen.getByText("0 times")).toBeInTheDocument();
  });
});

// ─── StatisticsOpenedDecksStat ─────────────────────────────────────────────

describe("StatisticsOpenedDecksStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the title 'Stacked Decks Opened'", () => {
    setupStore();
    renderWithProviders(<StatisticsOpenedDecksStat totalCount={100} />);

    expect(screen.getByText("Stacked Decks Opened")).toBeInTheDocument();
  });

  it("renders totalCount as the stat value", () => {
    setupStore();
    renderWithProviders(<StatisticsOpenedDecksStat totalCount={1234} />);

    expect(screen.getByText("1234")).toBeInTheDocument();
  });

  it("renders 0 as the stat value when totalCount is 0", () => {
    setupStore();
    renderWithProviders(<StatisticsOpenedDecksStat totalCount={0} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it('shows "All time" description when statScope is "all-time"', () => {
    setupStore({ statScope: "all-time" });
    renderWithProviders(<StatisticsOpenedDecksStat totalCount={50} />);

    expect(screen.getByText("All time")).toBeInTheDocument();
    expect(screen.queryByText("Current league")).not.toBeInTheDocument();
  });

  it('shows "Current league" description when statScope is "league"', () => {
    setupStore({ statScope: "league" });
    renderWithProviders(<StatisticsOpenedDecksStat totalCount={50} />);

    expect(screen.getByText("Current league")).toBeInTheDocument();
    expect(screen.queryByText("All time")).not.toBeInTheDocument();
  });
});

// ─── StatisticsUniqueCardsStat ─────────────────────────────────────────────

describe("StatisticsUniqueCardsStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the title 'Unique Cards'", () => {
    renderWithProviders(<StatisticsUniqueCardsStat uniqueCardCount={25} />);

    expect(screen.getByText("Unique Cards")).toBeInTheDocument();
  });

  it("renders uniqueCardCount as the stat value", () => {
    renderWithProviders(<StatisticsUniqueCardsStat uniqueCardCount={42} />);

    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders 0 as the stat value when uniqueCardCount is 0", () => {
    renderWithProviders(<StatisticsUniqueCardsStat uniqueCardCount={0} />);

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it('renders static description "Different cards found"', () => {
    renderWithProviders(<StatisticsUniqueCardsStat uniqueCardCount={10} />);

    expect(screen.getByText("Different cards found")).toBeInTheDocument();
  });
});

// ─── StatisticsStats (container) ───────────────────────────────────────────

describe("StatisticsStats", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all three stat sub-components", () => {
    setupStore();
    const cardData = createCardData([
      { name: "Rain of Chaos", count: 10, ratio: 50 },
      { name: "The Doctor", count: 5, ratio: 25 },
    ]);

    renderWithProviders(
      <StatisticsStats
        totalCount={20}
        uniqueCardCount={2}
        cardData={cardData}
      />,
    );

    // OpenedDecksStat
    expect(screen.getByText("Stacked Decks Opened")).toBeInTheDocument();
    // UniqueCardsStat
    expect(screen.getByText("Unique Cards")).toBeInTheDocument();
    // MostCommonCardStat
    expect(screen.getByText("Most Common")).toBeInTheDocument();
  });

  it("passes totalCount to StatisticsOpenedDecksStat", () => {
    setupStore();
    renderWithProviders(
      <StatisticsStats totalCount={999} uniqueCardCount={0} cardData={[]} />,
    );

    expect(screen.getByText("999")).toBeInTheDocument();
  });

  it("passes uniqueCardCount to StatisticsUniqueCardsStat", () => {
    setupStore();
    renderWithProviders(
      <StatisticsStats totalCount={0} uniqueCardCount={77} cardData={[]} />,
    );

    expect(screen.getByText("77")).toBeInTheDocument();
  });

  it("computes mostCommonCard from cardData and passes it to StatisticsMostCommonCardStat", () => {
    setupStore();
    const cardData = createCardData([
      { name: "The Nurse", count: 3, ratio: 15 },
      { name: "Rain of Chaos", count: 20, ratio: 50 },
      { name: "The Doctor", count: 8, ratio: 35 },
    ]);

    renderWithProviders(
      <StatisticsStats
        totalCount={31}
        uniqueCardCount={3}
        cardData={cardData}
      />,
    );

    // The most common card is "Rain of Chaos" with count 20
    const link = screen.getByTestId("card-name-link");
    expect(link).toHaveTextContent("Rain of Chaos");
    expect(screen.getByText("20 times")).toBeInTheDocument();
  });

  it('renders "N/A" for most common card when cardData is empty', () => {
    setupStore();
    renderWithProviders(
      <StatisticsStats totalCount={0} uniqueCardCount={0} cardData={[]} />,
    );

    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.getByText("0 times")).toBeInTheDocument();
  });

  it("selects the card with the highest count as mostCommonCard", () => {
    setupStore();
    const cardData = createCardData([
      { name: "Card A", count: 5, ratio: 25 },
      { name: "Card B", count: 15, ratio: 50 },
      { name: "Card C", count: 10, ratio: 25 },
    ]);

    renderWithProviders(
      <StatisticsStats
        totalCount={30}
        uniqueCardCount={3}
        cardData={cardData}
      />,
    );

    const link = screen.getByTestId("card-name-link");
    expect(link).toHaveTextContent("Card B");
    expect(screen.getByText("15 times")).toBeInTheDocument();
  });

  it("handles a single card in cardData", () => {
    setupStore();
    const cardData = createCardData([
      { name: "Lonely Card", count: 1, ratio: 100 },
    ]);

    renderWithProviders(
      <StatisticsStats
        totalCount={1}
        uniqueCardCount={1}
        cardData={cardData}
      />,
    );

    const link = screen.getByTestId("card-name-link");
    expect(link).toHaveTextContent("Lonely Card");
    expect(screen.getByText("1 times")).toBeInTheDocument();
  });

  it("handles cards with equal counts (picks first one found by reduce)", () => {
    setupStore();
    const cardData = createCardData([
      { name: "First Card", count: 10, ratio: 50 },
      { name: "Second Card", count: 10, ratio: 50 },
    ]);

    renderWithProviders(
      <StatisticsStats
        totalCount={20}
        uniqueCardCount={2}
        cardData={cardData}
      />,
    );

    // reduce keeps the first max — "First Card" stays because card.count > max.count is false for equal
    const link = screen.getByTestId("card-name-link");
    expect(link).toHaveTextContent("First Card");
  });
});
