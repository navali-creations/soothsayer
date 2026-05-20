import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import SessionDetailsActions from "./SessionDetailsActions";

const { mockHistoryBack } = vi.hoisted(() => ({
  mockHistoryBack: vi.fn(),
}));

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("@tanstack/react-router", async () => {
  const { createNavigateWithHistoryMock } = await import(
    "~/renderer/__test-setup__/router-mock"
  );
  return createNavigateWithHistoryMock(vi.fn(), mockHistoryBack);
});

vi.mock("~/renderer/components", () => ({
  BackButton: ({ fallback, label, ...props }: any) => (
    <button
      data-testid="back-button"
      data-fallback={fallback}
      onClick={() => mockHistoryBack()}
      {...props}
    >
      <span data-testid="icon-arrow-left" />
      {label && <span>{label}</span>}
    </button>
  ),
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

function setupStore(overrides: any = {}) {
  const sessionDetails = {
    ...overrides.sessionDetails,
  } as any;
  mockUseBoundStore.mockReturnValue({ sessionDetails } as any);
  return sessionDetails;
}

describe("SessionDetailsActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a back button with the sessions fallback", async () => {
    setupStore();
    const { user } = renderWithProviders(<SessionDetailsActions />);

    const backButton = screen.getByTestId("back-button");
    expect(backButton).toHaveAttribute("data-fallback", "/sessions");

    await user.click(backButton);
    expect(mockHistoryBack).toHaveBeenCalled();
  });

  it("renders no price-source tabs", () => {
    setupStore();
    renderWithProviders(<SessionDetailsActions />);

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("renders and handles the export button when provided", async () => {
    setupStore();
    const onExportCsv = vi.fn();
    const { user } = renderWithProviders(
      <SessionDetailsActions onExportCsv={onExportCsv} />,
    );

    const exportButton = screen.getByRole("button", { name: /Export CSV/i });
    expect(screen.getByTestId("icon-download")).toBeInTheDocument();

    await user.click(exportButton);
    expect(onExportCsv).toHaveBeenCalledTimes(1);
  });

  it("does not render the export button without an export handler", () => {
    setupStore();
    renderWithProviders(<SessionDetailsActions />);

    expect(screen.queryByText("Export CSV")).not.toBeInTheDocument();
  });
});
