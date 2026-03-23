import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import CurrentSessionTable from "../CurrentSession.components/CurrentSessionTable/CurrentSessionTable";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/components", () => ({
  Table: ({ data, emptyMessage }: any) => (
    <div data-testid="table" data-rows={data.length}>
      {data.length === 0 && emptyMessage && <span>{emptyMessage}</span>}
    </div>
  ),
  createCardCountColumn: vi.fn(() => ({ id: "count" })),
  createCardNameColumn: vi.fn(() => ({ id: "name" })),
}));

vi.mock("../CurrentSession.components/CurrentSessionTable/columns", () => ({
  createCurrentSessionChaosValueColumn: vi.fn(() => ({ id: "chaosValue" })),
  createCurrentSessionHidePriceColumn: vi.fn(() => ({ id: "hidePrice" })),
  createCurrentSessionRatioColumn: vi.fn(() => ({ id: "ratio" })),
  createCurrentSessionTotalValueColumn: vi.fn(() => ({ id: "totalValue" })),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    currentSession: {
      getIsCurrentSessionActive: vi.fn(() => false),
      getSession: vi.fn(() => ({ cards: [] })),
      ...overrides.currentSession,
    },
    settings: {
      getActiveGameViewPriceSource: vi.fn(() => "exchange"),
      ...overrides.settings,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CurrentSessionTable", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "No cards in this session yet" when cards array is empty', () => {
    setupStore();
    renderWithProviders(<CurrentSessionTable />);

    expect(
      screen.getByText("No cards in this session yet"),
    ).toBeInTheDocument();
  });

  it('shows "Start a session to begin tracking" hint when not active and no cards', () => {
    setupStore({
      currentSession: {
        getIsCurrentSessionActive: vi.fn(() => false),
        getSession: vi.fn(() => ({ cards: [] })),
      },
    });
    renderWithProviders(<CurrentSessionTable />);

    expect(
      screen.getByText("Start a session to begin tracking"),
    ).toBeInTheDocument();
  });

  it('shows "Start opening stacked decks" hint when active and no cards', () => {
    setupStore({
      currentSession: {
        getIsCurrentSessionActive: vi.fn(() => true),
        getSession: vi.fn(() => ({ cards: [] })),
      },
    });
    renderWithProviders(<CurrentSessionTable />);

    expect(
      screen.getByText("Start opening stacked decks in Path of Exile!"),
    ).toBeInTheDocument();
  });

  it('renders "Cards Opened" heading', () => {
    setupStore();
    renderWithProviders(<CurrentSessionTable />);

    expect(screen.getByText("Cards Opened")).toBeInTheDocument();
  });

  it("renders Table component when cards exist", () => {
    setupStore({
      currentSession: {
        getIsCurrentSessionActive: vi.fn(() => true),
        getSession: vi.fn(() => ({
          cards: [
            { name: "The Doctor", count: 1, chaosValue: 1000 },
            { name: "Rain of Chaos", count: 5, chaosValue: 2 },
          ],
        })),
      },
    });
    renderWithProviders(<CurrentSessionTable />);

    const table = screen.getByTestId("table");
    expect(table).toBeInTheDocument();
    expect(table).toHaveAttribute("data-rows", "2");
  });

  it("does not render Table component when cards array is empty", () => {
    setupStore();
    renderWithProviders(<CurrentSessionTable />);

    expect(screen.queryByTestId("table")).not.toBeInTheDocument();
  });

  it("does not show empty message when cards exist", () => {
    setupStore({
      currentSession: {
        getIsCurrentSessionActive: vi.fn(() => true),
        getSession: vi.fn(() => ({
          cards: [{ name: "The Doctor", count: 1, chaosValue: 1000 }],
        })),
      },
    });
    renderWithProviders(<CurrentSessionTable />);

    expect(
      screen.queryByText("No cards in this session yet"),
    ).not.toBeInTheDocument();
  });

  it("handles null session gracefully", () => {
    setupStore({
      currentSession: {
        getIsCurrentSessionActive: vi.fn(() => false),
        getSession: vi.fn(() => null),
      },
    });
    renderWithProviders(<CurrentSessionTable />);

    expect(
      screen.getByText("No cards in this session yet"),
    ).toBeInTheDocument();
  });
});
