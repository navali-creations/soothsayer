import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useUpdater } from "~/renderer/store";

import UpdateIndicator from "./UpdateIndicator";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useUpdater: vi.fn(),
}));

const mockUseUpdater = vi.mocked(useUpdater);

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiDownload: () => <span data-testid="icon-download" />,
  FiExternalLink: () => <span data-testid="icon-external-link" />,
  FiRefreshCw: () => <span data-testid="icon-refresh" />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    updateAvailable: false,
    updateInfo: null,
    isDismissed: false,
    status: "idle",
    downloadProgress: { percent: 0 },
    error: null,
    downloadAndInstall: vi.fn(),
    ...overrides,
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseUpdater.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("UpdateIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  // ── Null states (component returns nothing) ────────────────────────────

  it("returns null when no update is available", () => {
    setupStore({ updateAvailable: false });
    const { container } = renderWithProviders(<UpdateIndicator />);

    expect(container.innerHTML).toBe("");
  });

  it("returns null when update is dismissed", () => {
    setupStore({
      updateAvailable: true,
      isDismissed: true,
      updateInfo: { latestVersion: "2.0.0", manualDownload: false },
    });
    const { container } = renderWithProviders(<UpdateIndicator />);

    expect(container.innerHTML).toBe("");
  });

  it("returns null when updateInfo is null", () => {
    setupStore({
      updateAvailable: true,
      isDismissed: false,
      updateInfo: null,
    });
    const { container } = renderWithProviders(<UpdateIndicator />);

    expect(container.innerHTML).toBe("");
  });

  // ── Downloading state ──────────────────────────────────────────────────

  it("shows download progress when status is downloading", () => {
    setupStore({
      updateAvailable: true,
      updateInfo: { latestVersion: "2.0.0", manualDownload: false },
      status: "downloading",
      downloadProgress: { percent: 45 },
    });
    renderWithProviders(<UpdateIndicator />);

    expect(screen.getByText("45%")).toBeInTheDocument();
  });

  it("shows indeterminate progress when percent < 0", () => {
    setupStore({
      updateAvailable: true,
      updateInfo: { latestVersion: "2.0.0", manualDownload: false },
      status: "downloading",
      downloadProgress: { percent: -1 },
    });
    renderWithProviders(<UpdateIndicator />);

    expect(screen.getByText("Updating...")).toBeInTheDocument();
  });

  it("shows percentage label when downloading with valid percent", () => {
    setupStore({
      updateAvailable: true,
      updateInfo: { latestVersion: "2.0.0", manualDownload: false },
      status: "downloading",
      downloadProgress: { percent: 72 },
    });
    renderWithProviders(<UpdateIndicator />);

    expect(screen.getByText("72%")).toBeInTheDocument();
  });

  // ── Error state ────────────────────────────────────────────────────────

  it("shows retry button when status is error", () => {
    setupStore({
      updateAvailable: true,
      updateInfo: { latestVersion: "2.0.0", manualDownload: false },
      status: "error",
      error: "Network timeout",
    });
    renderWithProviders(<UpdateIndicator />);

    expect(screen.getByTitle("Retry update")).toBeInTheDocument();
  });

  it("shows error tooltip text", () => {
    setupStore({
      updateAvailable: true,
      updateInfo: { latestVersion: "2.0.0", manualDownload: false },
      status: "error",
      error: "Network timeout",
    });
    renderWithProviders(<UpdateIndicator />);

    const tooltip = document.querySelector("[data-tip]");
    expect(tooltip).toHaveAttribute("data-tip", "Network timeout");
  });

  it("shows fallback error text when error is null", () => {
    setupStore({
      updateAvailable: true,
      updateInfo: { latestVersion: "2.0.0", manualDownload: false },
      status: "error",
      error: null,
    });
    renderWithProviders(<UpdateIndicator />);

    const tooltip = document.querySelector("[data-tip]");
    expect(tooltip).toHaveAttribute("data-tip", "Update failed");
  });

  it("retry button calls downloadAndInstall()", async () => {
    const store = setupStore({
      updateAvailable: true,
      updateInfo: { latestVersion: "2.0.0", manualDownload: false },
      status: "error",
      error: "Failed",
    });
    const { user } = renderWithProviders(<UpdateIndicator />);

    await user.click(screen.getByTitle("Retry update"));

    expect(store.downloadAndInstall).toHaveBeenCalledTimes(1);
  });

  // ── Ready state ────────────────────────────────────────────────────────

  it('shows "Restart to update" tooltip when status is ready and not manual', () => {
    setupStore({
      updateAvailable: true,
      updateInfo: { latestVersion: "2.0.0", manualDownload: false },
      status: "ready",
    });
    renderWithProviders(<UpdateIndicator />);

    const tooltip = document.querySelector("[data-tip]");
    expect(tooltip).toHaveAttribute("data-tip", "Restart to update");
  });

  it('shows "View release" tooltip when status is ready and manual', () => {
    setupStore({
      updateAvailable: true,
      updateInfo: { latestVersion: "2.0.0", manualDownload: true },
      status: "ready",
    });
    renderWithProviders(<UpdateIndicator />);

    const tooltip = document.querySelector("[data-tip]");
    expect(tooltip).toHaveAttribute("data-tip", "View release");
  });

  // ── Default state (update available, idle) ─────────────────────────────

  it("shows update available tooltip for default state", () => {
    setupStore({
      updateAvailable: true,
      updateInfo: { latestVersion: "3.1.0", manualDownload: false },
      status: "idle",
    });
    renderWithProviders(<UpdateIndicator />);

    const tooltip = document.querySelector("[data-tip]");
    expect(tooltip).toHaveAttribute("data-tip", "v3.1.0 available!");
  });

  it("download button calls downloadAndInstall()", async () => {
    const store = setupStore({
      updateAvailable: true,
      updateInfo: { latestVersion: "3.1.0", manualDownload: false },
      status: "idle",
    });
    const { user } = renderWithProviders(<UpdateIndicator />);

    const button = screen.getByRole("button");
    await user.click(button);

    expect(store.downloadAndInstall).toHaveBeenCalledTimes(1);
  });

  // ── Icon selection based on manualDownload ─────────────────────────────

  it("shows FiExternalLink icon for manual updates in default state", () => {
    setupStore({
      updateAvailable: true,
      updateInfo: { latestVersion: "2.0.0", manualDownload: true },
      status: "idle",
    });
    renderWithProviders(<UpdateIndicator />);

    expect(screen.getByTestId("icon-external-link")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-download")).not.toBeInTheDocument();
  });

  it("shows FiDownload icon for auto updates in default state", () => {
    setupStore({
      updateAvailable: true,
      updateInfo: { latestVersion: "2.0.0", manualDownload: false },
      status: "idle",
    });
    renderWithProviders(<UpdateIndicator />);

    expect(screen.getByTestId("icon-download")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-external-link")).not.toBeInTheDocument();
  });

  it("shows FiExternalLink icon for manual updates in ready state", () => {
    setupStore({
      updateAvailable: true,
      updateInfo: { latestVersion: "2.0.0", manualDownload: true },
      status: "ready",
    });
    renderWithProviders(<UpdateIndicator />);

    expect(screen.getByTestId("icon-external-link")).toBeInTheDocument();
  });

  it("shows FiDownload icon for auto updates in ready state", () => {
    setupStore({
      updateAvailable: true,
      updateInfo: { latestVersion: "2.0.0", manualDownload: false },
      status: "ready",
    });
    renderWithProviders(<UpdateIndicator />);

    expect(screen.getByTestId("icon-download")).toBeInTheDocument();
  });
});
