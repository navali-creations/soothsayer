import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import CurrentSessionOpenedDecksStat from "./CurrentSessionOpenedDecksStat";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/components", () => ({
  AnimatedNumber: ({ value, decimals, suffix, className }: any) => (
    <span data-testid="animated-number" className={className}>
      {decimals != null ? Number(value).toFixed(decimals) : value}
      {suffix ?? ""}
    </span>
  ),
  Stat: Object.assign(
    ({ children, className }: any) => (
      <div data-testid="stat" className={className}>
        {children}
      </div>
    ),
    {
      Title: ({ children }: any) => (
        <div data-testid="stat-title">{children}</div>
      ),
      Value: ({ children }: any) => (
        <div data-testid="stat-value">{children}</div>
      ),
      Desc: ({ children, className }: any) => (
        <div data-testid="stat-desc" className={className}>
          {children}
        </div>
      ),
      Figure: ({ children, className }: any) => (
        <div data-testid="stat-figure" className={className}>
          {children}
        </div>
      ),
    },
  ),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

function setupStore(overrides: any = {}) {
  const store = {
    currentSession: {
      getSession: vi.fn(() => overrides.session ?? null),
    },
  } as any;
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

describe("CurrentSessionOpenedDecksStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders zero when there is no session", () => {
    setupStore({ session: null });

    renderWithProviders(<CurrentSessionOpenedDecksStat />);

    expect(screen.getByText("Stacked Decks Opened")).toBeInTheDocument();
    expect(screen.getByTestId("stat-value")).toHaveTextContent("0");
    expect(screen.getByText("This session")).toBeInTheDocument();
  });

  it("renders the session total count", () => {
    setupStore({ session: { totalCount: 42 } });

    renderWithProviders(<CurrentSessionOpenedDecksStat />);

    expect(screen.getByTestId("stat-value")).toHaveTextContent("42");
  });
});
