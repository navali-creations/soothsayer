import { makeSessionsSummary } from "~/renderer/__test-setup__/fixtures";
import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { SessionCard } from "./SessionsCard";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components", () => ({
  Link: ({ children, to, params, ...rest }: any) => (
    <a
      data-testid="session-link"
      href={`${to.replace("$sessionId", params?.sessionId ?? "")}`}
      {...rest}
    >
      {children}
    </a>
  ),
  StaticProfitSparkline: ({ linePoints }: any) => (
    <div data-testid="sparkline">{linePoints.length}</div>
  ),
}));

vi.mock("~/renderer/utils", () => ({
  formatCurrency: (value: number, ratio: number) => {
    if (Math.abs(value) >= ratio) {
      return `${(value / ratio).toFixed(2)}d`;
    }
    return `${value.toFixed(2)}c`;
  },
}));

vi.mock("../../Sessions.utils/Sessions.utils", () => ({
  formatSessionDate: (date: string) => `Date:${date}`,
  formatSessionTime: (date: string) => `Time:${date}`,
}));

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

const mockUseBoundStore = vi.mocked(useBoundStore);

// Mock react-icons to render simple spans with identifiable text
vi.mock("react-icons/fi", () => ({
  FiClock: () => <span data-testid="icon-clock" />,
  FiInfo: () => <span data-testid="icon-info" />,
}));

vi.mock("react-icons/gi", () => ({
  GiCardExchange: () => <span data-testid="icon-exchange" />,
  GiLockedChest: () => <span data-testid="icon-chest" />,
  GiReceiveMoney: () => <span data-testid="icon-profit" />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeSession(
  overrides: Parameters<typeof makeSessionsSummary>[0] = {},
) {
  return makeSessionsSummary({
    sessionId: "sess-abc-123",
    durationMinutes: 45,
    ...overrides,
  });
}

function setupStore(
  overrides: {
    isBulkMode?: boolean;
    isDeleteMode?: boolean;
    selectedSessionIds?: string[];
    toggleSessionSelection?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const selectedIds = new Set(overrides.selectedSessionIds ?? []);
  const toggleSessionSelection = overrides.toggleSessionSelection ?? vi.fn();

  mockUseBoundStore.mockReturnValue({
    sessions: {
      getIsBulkMode: () => overrides.isBulkMode ?? false,
      getIsDeleteMode: () => overrides.isDeleteMode ?? false,
      getIsSessionSelected: (id: string) => selectedIds.has(id),
      toggleSessionSelection,
    },
  } as any);

  return { toggleSessionSelection };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SessionCard", () => {
  beforeEach(() => {
    setupStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Header / metadata ──────────────────────────────────────────────────

  it("renders session date using formatSessionDate", () => {
    const session = makeSession({ startedAt: "2024-06-01T14:30:00Z" });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.getByText("Date:2024-06-01T14:30:00Z")).toBeInTheDocument();
  });

  it("renders session time using formatSessionTime", () => {
    const session = makeSession({ startedAt: "2024-06-01T14:30:00Z" });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.getByText("Time:2024-06-01T14:30:00Z")).toBeInTheDocument();
  });

  it("shows league badge", () => {
    const session = makeSession({ league: "Necropolis" });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.getByText("Necropolis")).toBeInTheDocument();
  });

  // ── Active / Corrupted badges ──────────────────────────────────────────

  it('shows "Active" badge for active sessions', () => {
    const session = makeSession({ isActive: true });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it('does not show "Active" badge for inactive sessions', () => {
    const session = makeSession({ isActive: false });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it('shows "Corrupted" badge for sessions without endedAt that are not active', () => {
    const session = makeSession({ isActive: false, endedAt: null });
    renderWithProviders(<SessionCard session={session} />);

    // The component renders "Corrupted " with a trailing space
    const corruptedBadge = screen.getByText(/Corrupted/);
    expect(corruptedBadge).toBeInTheDocument();
  });

  it('does not show "Corrupted" badge for active sessions without endedAt', () => {
    const session = makeSession({ isActive: true, endedAt: null });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.queryByText(/Corrupted/)).not.toBeInTheDocument();
  });

  it('does not show "Corrupted" badge for sessions with endedAt', () => {
    const session = makeSession({
      isActive: false,
      endedAt: "2024-01-15T11:00:00Z",
    });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.queryByText(/Corrupted/)).not.toBeInTheDocument();
  });

  // ── Duration ───────────────────────────────────────────────────────────

  it("shows duration in minutes format for < 60 minutes", () => {
    const session = makeSession({ durationMinutes: 45 });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.getByText("45m")).toBeInTheDocument();
  });

  it("shows duration in hours+minutes format for >= 60 minutes", () => {
    const session = makeSession({ durationMinutes: 125 });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.getByText("2h 5m")).toBeInTheDocument();
  });

  it("shows duration for exact hours", () => {
    const session = makeSession({ durationMinutes: 120 });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.getByText("2h 0m")).toBeInTheDocument();
  });

  it('shows "Unknown" for null duration', () => {
    const session = makeSession({ durationMinutes: null });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  // ── Decks opened ───────────────────────────────────────────────────────

  it("shows total decks opened", () => {
    const session = makeSession({ totalDecksOpened: 250 });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.getByText("250")).toBeInTheDocument();
  });

  // ── Exchange value ─────────────────────────────────────────────────────

  it("shows exchange value with formatCurrency", () => {
    const session = makeSession({
      totalExchangeValue: 500,
      exchangeChaosToDivine: 150,
    });
    renderWithProviders(<SessionCard session={session} />);

    // 500 / 150 = 3.33d
    expect(screen.getByText("3.33d")).toBeInTheDocument();
  });

  it('shows "N/A" when exchange value is null', () => {
    const session = makeSession({
      totalExchangeValue: null,
      exchangeChaosToDivine: 150,
    });
    renderWithProviders(<SessionCard session={session} />);

    // There may be multiple N/A elements (exchange + stash); find by context
    const naElements = screen.getAllByText("N/A");
    expect(naElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "N/A" when exchangeChaosToDivine is null', () => {
    const session = makeSession({
      totalExchangeValue: 500,
      exchangeChaosToDivine: null,
    });
    renderWithProviders(<SessionCard session={session} />);

    const naElements = screen.getAllByText("N/A");
    expect(naElements.length).toBeGreaterThanOrEqual(1);
  });

  // ── Stash value ────────────────────────────────────────────────────────

  it("shows stash value with formatCurrency", () => {
    const session = makeSession({
      totalStashValue: 600,
      stashChaosToDivine: 150,
    });
    renderWithProviders(<SessionCard session={session} />);

    // 600 / 150 = 4.00d
    expect(screen.getByText("4.00d")).toBeInTheDocument();
  });

  it('shows "N/A" when stash value is null', () => {
    const session = makeSession({
      totalStashValue: null,
      stashChaosToDivine: 150,
    });
    renderWithProviders(<SessionCard session={session} />);

    const naElements = screen.getAllByText("N/A");
    expect(naElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "N/A" when stashChaosToDivine is null', () => {
    const session = makeSession({
      totalStashValue: 600,
      stashChaosToDivine: null,
    });
    renderWithProviders(<SessionCard session={session} />);

    const naElements = screen.getAllByText("N/A");
    expect(naElements.length).toBeGreaterThanOrEqual(1);
  });

  // ── Net profit ─────────────────────────────────────────────────────────

  it("shows net profit with success color for positive values", () => {
    const session = makeSession({
      totalExchangeNetProfit: 200,
      exchangeChaosToDivine: 150,
    });
    renderWithProviders(<SessionCard session={session} />);

    // 200 / 150 = 1.33d
    const profitElement = screen.getByText("1.33d");
    expect(profitElement).toBeInTheDocument();
    expect(profitElement).toHaveClass("text-success");
  });

  it("shows net profit with error color for negative values", () => {
    const session = makeSession({
      totalExchangeNetProfit: -300,
      exchangeChaosToDivine: 150,
    });
    renderWithProviders(<SessionCard session={session} />);

    // -300 / 150 = -2.00d
    const profitElement = screen.getByText("-2.00d");
    expect(profitElement).toBeInTheDocument();
    expect(profitElement).toHaveClass("text-error");
  });

  it("does not render net profit when totalExchangeNetProfit is null", () => {
    const session = makeSession({
      totalExchangeNetProfit: null,
      exchangeChaosToDivine: 150,
    });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.queryByText("Net Profit:")).not.toBeInTheDocument();
  });

  it("does not render net profit when exchangeChaosToDivine is null", () => {
    const session = makeSession({
      totalExchangeNetProfit: 200,
      exchangeChaosToDivine: null,
    });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.queryByText("Net Profit:")).not.toBeInTheDocument();
  });

  // ── Link ───────────────────────────────────────────────────────────────

  it("links to the correct session detail page", () => {
    const session = makeSession({ sessionId: "sess-xyz-789" });
    renderWithProviders(<SessionCard session={session} />);

    const link = screen.getByTestId("session-link");
    expect(link).toHaveAttribute("href", "/sessions/sess-xyz-789");
  });

  it("renders all content inside the link", () => {
    const session = makeSession();
    renderWithProviders(<SessionCard session={session} />);

    const link = screen.getByTestId("session-link");
    expect(link).toBeInTheDocument();
    // The card content should be a descendant of the link
    expect(link.querySelector(".card-body")).toBeInTheDocument();
  });

  it("renders a non-link selectable card in bulk mode", async () => {
    const toggleSessionSelection = vi.fn();
    const session = makeSession({ sessionId: "sess-export" });
    setupStore({
      isBulkMode: true,
      selectedSessionIds: ["sess-export"],
      toggleSessionSelection,
    });
    const { user } = renderWithProviders(<SessionCard session={session} />);

    expect(screen.queryByTestId("session-link")).not.toBeInTheDocument();
    await user.click(screen.getByText("Date:2024-01-15T10:00:00Z"));
    expect(toggleSessionSelection).toHaveBeenCalledWith("sess-export");
  });

  it("uses primary border for selected export bulk cards", () => {
    const session = makeSession({ sessionId: "sess-export" });
    setupStore({ isBulkMode: true, selectedSessionIds: ["sess-export"] });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.getByText(/Date:/).closest(".card")).toHaveClass(
      "border-primary",
    );
  });

  it("uses error border for selected delete bulk cards", () => {
    const session = makeSession({ sessionId: "sess-delete" });
    setupStore({
      isBulkMode: true,
      isDeleteMode: true,
      selectedSessionIds: ["sess-delete"],
    });
    renderWithProviders(<SessionCard session={session} />);

    expect(screen.getByText(/Date:/).closest(".card")).toHaveClass(
      "border-error",
    );
  });

  it("uses neutral dashed border for unselected bulk cards", () => {
    const session = makeSession();
    setupStore({ isBulkMode: true });
    renderWithProviders(<SessionCard session={session} />);

    const card = screen.getByText(/Date:/).closest(".card");
    expect(card).toHaveClass("border-dashed");
    expect(card).toHaveClass("border-base-content/30");
  });

  it("renders sparkline background when at least two points are provided", () => {
    const session = makeSession();
    renderWithProviders(
      <SessionCard
        session={session}
        linePoints={[
          { x: 0, profit: 0 },
          { x: 1, profit: 10 },
        ]}
      />,
    );

    expect(screen.getByTestId("sparkline")).toHaveTextContent("2");
  });
});
