import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { SessionDetailsDurationStat } from "./SessionDetailsDurationStat";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/components", () => ({
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
      Value: ({ children, className }: any) => (
        <div data-testid="stat-value" className={className}>
          {children}
        </div>
      ),
      Desc: ({ children }: any) => (
        <div data-testid="stat-desc">{children}</div>
      ),
      Figure: ({ children }: any) => (
        <div data-testid="stat-figure">{children}</div>
      ),
    },
  ),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUseBoundStore = vi.mocked(useBoundStore);

function setupStore(overrides: Record<string, any> = {}) {
  const sessionDetails = {
    getDuration: vi.fn().mockReturnValue("1h 30m"),
    ...overrides,
  };
  mockUseBoundStore.mockReturnValue({ sessionDetails } as any);
  return sessionDetails;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SessionDetailsDurationStat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    setupStore();
  });

  it('shows "Duration" as the title', () => {
    setupStore({ getDuration: vi.fn().mockReturnValue("2h 15m") });
    renderWithProviders(<SessionDetailsDurationStat />);

    expect(screen.getByText("Duration")).toBeInTheDocument();
  });

  it("displays the duration value", () => {
    setupStore({ getDuration: vi.fn().mockReturnValue("2h 15m") });
    renderWithProviders(<SessionDetailsDurationStat />);

    expect(screen.getByText("2h 15m")).toBeInTheDocument();
  });

  it('shows "Session length" as the description', () => {
    setupStore({ getDuration: vi.fn().mockReturnValue("2h 15m") });
    renderWithProviders(<SessionDetailsDurationStat />);

    expect(screen.getByText("Session length")).toBeInTheDocument();
  });

  it("handles a minutes-only duration", () => {
    setupStore({ getDuration: vi.fn().mockReturnValue("45m") });
    renderWithProviders(<SessionDetailsDurationStat />);

    expect(screen.getByText("45m")).toBeInTheDocument();
  });

  it('handles "—" dash duration', () => {
    setupStore({ getDuration: vi.fn().mockReturnValue("—") });
    renderWithProviders(<SessionDetailsDurationStat />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
