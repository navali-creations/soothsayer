import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import SessionDetailsActions from "../SessionDetails.components/SessionDetailsActions/SessionDetailsActions";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock("react-icons/fi", () => ({
  FiArrowLeft: () => <span data-testid="icon-arrow-left" />,
  FiDownload: () => <span data-testid="icon-download" />,
}));

vi.mock("react-icons/gi", () => ({
  GiCardExchange: () => <span data-testid="icon-exchange" />,
  GiLockedChest: () => <span data-testid="icon-chest" />,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    sessionDetails: {
      getPriceSource: vi.fn(() => "exchange"),
      setPriceSource: vi.fn(),
      ...overrides.sessionDetails,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SessionDetailsActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Back Button ────────────────────────────────────────────────────────

  describe("back button", () => {
    it("renders a back button", () => {
      setupStore();
      renderWithProviders(<SessionDetailsActions />);

      expect(screen.getByTestId("icon-arrow-left")).toBeInTheDocument();
    });

    it("navigates to /sessions when back button is clicked", async () => {
      setupStore();
      const { user } = renderWithProviders(<SessionDetailsActions />);

      const backButton = screen
        .getByTestId("icon-arrow-left")
        .closest("button")!;
      await user.click(backButton);

      expect(mockNavigate).toHaveBeenCalledWith({ to: "/sessions" });
    });
  });

  // ── Price Source Tabs ──────────────────────────────────────────────────

  describe("price source tabs", () => {
    it("renders Exchange and Stash tabs", () => {
      setupStore();
      renderWithProviders(<SessionDetailsActions />);

      expect(screen.getByText("Exchange")).toBeInTheDocument();
      expect(screen.getByText("Stash")).toBeInTheDocument();
    });

    it("renders a tablist", () => {
      setupStore();
      renderWithProviders(<SessionDetailsActions />);

      expect(screen.getByRole("tablist")).toBeInTheDocument();
    });

    it("Exchange tab has tab-active class when priceSource is exchange", () => {
      setupStore({
        sessionDetails: {
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      renderWithProviders(<SessionDetailsActions />);

      const exchangeTab = screen.getByText("Exchange").closest("button")!;
      expect(exchangeTab).toHaveClass("tab-active");
    });

    it("Stash tab does not have tab-active class when priceSource is exchange", () => {
      setupStore({
        sessionDetails: {
          getPriceSource: vi.fn(() => "exchange"),
        },
      });
      renderWithProviders(<SessionDetailsActions />);

      const stashTab = screen.getByText("Stash").closest("button")!;
      expect(stashTab).not.toHaveClass("tab-active");
    });

    it("Stash tab has tab-active class when priceSource is stash", () => {
      setupStore({
        sessionDetails: {
          getPriceSource: vi.fn(() => "stash"),
        },
      });
      renderWithProviders(<SessionDetailsActions />);

      const stashTab = screen.getByText("Stash").closest("button")!;
      expect(stashTab).toHaveClass("tab-active");
    });

    it("Exchange tab does not have tab-active class when priceSource is stash", () => {
      setupStore({
        sessionDetails: {
          getPriceSource: vi.fn(() => "stash"),
        },
      });
      renderWithProviders(<SessionDetailsActions />);

      const exchangeTab = screen.getByText("Exchange").closest("button")!;
      expect(exchangeTab).not.toHaveClass("tab-active");
    });

    it('clicking Exchange tab calls setPriceSource("exchange")', async () => {
      const store = setupStore({
        sessionDetails: {
          getPriceSource: vi.fn(() => "stash"),
        },
      });
      const { user } = renderWithProviders(<SessionDetailsActions />);

      const exchangeTab = screen.getByText("Exchange").closest("button")!;
      await user.click(exchangeTab);

      expect(store.sessionDetails.setPriceSource).toHaveBeenCalledWith(
        "exchange",
      );
    });

    it('clicking Stash tab calls setPriceSource("stash")', async () => {
      const store = setupStore();
      const { user } = renderWithProviders(<SessionDetailsActions />);

      const stashTab = screen.getByText("Stash").closest("button")!;
      await user.click(stashTab);

      expect(store.sessionDetails.setPriceSource).toHaveBeenCalledWith("stash");
    });

    it("both tabs have role=tab", () => {
      setupStore();
      renderWithProviders(<SessionDetailsActions />);

      const tabs = screen.getAllByRole("tab");
      expect(tabs).toHaveLength(2);
    });
  });

  // ── Export CSV Button ──────────────────────────────────────────────────

  describe("export CSV button", () => {
    it("renders Export CSV button when onExportCsv is provided", () => {
      setupStore();
      renderWithProviders(<SessionDetailsActions onExportCsv={vi.fn()} />);

      expect(screen.getByText("Export CSV")).toBeInTheDocument();
    });

    it("does not render Export CSV button when onExportCsv is not provided", () => {
      setupStore();
      renderWithProviders(<SessionDetailsActions />);

      expect(screen.queryByText("Export CSV")).not.toBeInTheDocument();
    });

    it("calls onExportCsv when Export CSV button is clicked", async () => {
      const mockExportCsv = vi.fn();
      setupStore();
      const { user } = renderWithProviders(
        <SessionDetailsActions onExportCsv={mockExportCsv} />,
      );

      const exportButton = screen.getByText("Export CSV").closest("button")!;
      await user.click(exportButton);

      expect(mockExportCsv).toHaveBeenCalledTimes(1);
    });

    it("renders download icon inside Export CSV button", () => {
      setupStore();
      renderWithProviders(<SessionDetailsActions onExportCsv={vi.fn()} />);

      expect(screen.getByTestId("icon-download")).toBeInTheDocument();
    });
  });
});
