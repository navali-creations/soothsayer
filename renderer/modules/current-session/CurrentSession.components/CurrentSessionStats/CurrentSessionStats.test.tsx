import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";
import type { BoundStore } from "~/renderer/store/store.types";

import CurrentSessionStats from "./CurrentSessionStats";

let store: TestStore;
vi.mock("~/renderer/store", () => ({
  useBoundStore: (selector: (state: BoundStore) => unknown) => store(selector),
}));
beforeEach(() => {
  store = createTestStore({
    currentSession: {
      poe1SessionInfo: {
        league: "poe1:Settlers",
        startedAt: "2026-11-16T00:00:00Z",
      },
    },
  });
});

vi.mock("../CardPriceThresholdInput/CardPriceThresholdInput", () => ({
  default: () => <input aria-label="Threshold" />,
}));

vi.mock("../StackedDeckPriceInput/StackedDeckPriceInput", () => ({
  default: () => <input aria-label="Override Deck Price" />,
}));

vi.mock("~/renderer/components", () => ({
  GroupedStats: ({ children, ...props }: any) => (
    <div data-testid="grouped-stats" {...props}>
      {children}
    </div>
  ),
}));

vi.mock("./", () => ({
  CurrentSessionMostValueableCardStat: () => (
    <div data-testid="most-valuable-stat" />
  ),
  CurrentSessionNetProfitStat: (props: any) => (
    <div
      data-testid="net-profit-stat"
      data-expanded={String(props.expanded ?? "")}
      data-has-timeline={String(props.hasTimeline ?? "")}
    />
  ),
  CurrentSessionOpenedDecksStat: () => <div data-testid="opened-decks-stat" />,
  CurrentSessionTotalValueStat: () => <div data-testid="total-value-stat" />,
}));

describe("CurrentSessionStats", () => {
  it("keeps an idle override save error visible with instructions to retry", () => {
    store = createTestStore({
      currentSession: {
        stackedDeckPriceErrors: {
          poe1: "Unable to save the deck price. Please try again.",
        },
      },
    });
    renderWithProviders(<CurrentSessionStats />);
    expect(
      screen.queryByLabelText("Override Deck Price"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Unable to save the deck price",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Start a session to retry",
    );
  });

  it("leaves active override errors in the input card", () => {
    store.setState((state) => {
      state.currentSession.stackedDeckPriceErrors.poe1 =
        "Unable to save the deck price";
    });
    renderWithProviders(<CurrentSessionStats />);
    expect(screen.getByLabelText("Override Deck Price")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows idle errors only for the selected game", () => {
    store = createTestStore({
      settings: { selectedGame: "poe2" },
      currentSession: {
        stackedDeckPriceErrors: { poe1: "Unable to save the deck price" },
      },
    });
    renderWithProviders(<CurrentSessionStats />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the threshold visible and hides the deck price override while idle", () => {
    store = createTestStore();
    renderWithProviders(<CurrentSessionStats />);
    expect(screen.getByLabelText("Threshold")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Override Deck Price"),
    ).not.toBeInTheDocument();
  });

  it("shows the override only for the selected game's active session", () => {
    store = createTestStore({
      settings: { selectedGame: "poe2" },
      currentSession: {
        poe1SessionInfo: {
          league: "poe1:Settlers",
          startedAt: "2026-11-16T00:00:00Z",
        },
      },
    });
    renderWithProviders(<CurrentSessionStats />);
    expect(
      screen.queryByLabelText("Override Deck Price"),
    ).not.toBeInTheDocument();
  });
  it("renders GroupedStats wrapper", () => {
    renderWithProviders(<CurrentSessionStats />);

    expect(screen.getAllByTestId("grouped-stats")).toHaveLength(2);
  });

  it("renders the opened decks stat", () => {
    renderWithProviders(<CurrentSessionStats />);

    expect(screen.getByTestId("opened-decks-stat")).toBeInTheDocument();
  });

  it("groups the threshold and deck price separately from the four session statistics", () => {
    renderWithProviders(<CurrentSessionStats />);

    expect(screen.queryByText("Unique Cards")).not.toBeInTheDocument();
    const input = screen.getByLabelText("Threshold");
    expect(input).toBeInTheDocument();
    const stats = screen.getByRole("group", { name: "Session statistics" });
    const controls = screen.getByRole("group", {
      name: "Session pricing controls",
    });
    expect(stats).not.toContainElement(input);
    expect(controls).toContainElement(input);
    expect(controls).toContainElement(
      screen.getByLabelText("Override Deck Price"),
    );
  });

  it("renders the most valuable card stat", () => {
    renderWithProviders(<CurrentSessionStats />);

    expect(screen.getByTestId("most-valuable-stat")).toBeInTheDocument();
  });

  it("renders the total value stat", () => {
    renderWithProviders(<CurrentSessionStats />);

    expect(screen.getByTestId("total-value-stat")).toBeInTheDocument();
  });

  it("renders the net profit stat", () => {
    renderWithProviders(<CurrentSessionStats />);

    expect(screen.getByTestId("net-profit-stat")).toBeInTheDocument();
  });

  it("passes expanded prop to NetProfitStat", () => {
    renderWithProviders(
      <CurrentSessionStats
        expanded={true}
        onToggleExpanded={vi.fn()}
        hasTimeline={true}
      />,
    );

    expect(screen.getByTestId("net-profit-stat")).toHaveAttribute(
      "data-expanded",
      "true",
    );
  });

  it("passes hasTimeline prop to NetProfitStat", () => {
    renderWithProviders(<CurrentSessionStats hasTimeline={true} />);

    expect(screen.getByTestId("net-profit-stat")).toHaveAttribute(
      "data-has-timeline",
      "true",
    );
  });

  it("defaults expanded and hasTimeline to undefined when not provided", () => {
    renderWithProviders(<CurrentSessionStats />);

    expect(screen.getByTestId("net-profit-stat")).toHaveAttribute(
      "data-expanded",
      "",
    );
    expect(screen.getByTestId("net-profit-stat")).toHaveAttribute(
      "data-has-timeline",
      "",
    );
  });

  it("renders all 4 stat components inside GroupedStats", () => {
    renderWithProviders(<CurrentSessionStats />);

    const wrapper = screen.getByRole("group", { name: "Session statistics" });

    expect(wrapper).toContainElement(screen.getByTestId("opened-decks-stat"));
    expect(wrapper).toContainElement(screen.getByTestId("most-valuable-stat"));
    expect(wrapper).toContainElement(screen.getByTestId("total-value-stat"));
    expect(wrapper).toContainElement(screen.getByTestId("net-profit-stat"));
  });
});
