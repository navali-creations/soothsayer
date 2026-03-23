import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { trackEvent } from "~/renderer/modules/umami";
import { useBoundStore } from "~/renderer/store";

import StorageSettingsCard from "./StorageSettingsCard";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);
const mockTrackEvent = vi.mocked(trackEvent);

vi.mock("../storage/DeleteLeagueModal/DeleteLeagueModal", () => ({
  default: (props: any) => (
    <div data-testid="delete-modal" data-league={props.league?.leagueId || ""}>
      <button
        data-testid="modal-confirm"
        onClick={() => props.onConfirm?.(props.league?.leagueId)}
      >
        Confirm
      </button>
      <button data-testid="modal-close" onClick={() => props.onClose?.()}>
        Close
      </button>
    </div>
  ),
}));

vi.mock("../storage/DiskUsageSection/DiskUsageSection", () => ({
  default: (_props: any) => <div data-testid="disk-usage" />,
}));

vi.mock("../storage/LeagueDataSection/LeagueDataSection", () => ({
  default: (props: any) => (
    <div data-testid="league-data">
      <button
        data-testid="league-delete-btn"
        onClick={() =>
          props.onDeleteRequest?.({
            leagueId: "test-league-123",
            leagueName: "Test League",
            totalBytes: 5000,
          })
        }
      >
        Delete League
      </button>
    </div>
  ),
}));

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiAlertTriangle: () => <span data-testid="icon-alert-triangle" />,
  FiHardDrive: () => <span data-testid="icon-hard-drive" />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockFetchStorageInfo = vi.fn();
const mockFetchLeagueUsage = vi.fn();
const mockDeleteLeagueData = vi.fn();

interface StorageOverrides {
  info?: any;
  leagueUsage?: any[];
  isLoading?: boolean;
  error?: string | null;
  deletingLeagueId?: string | null;
}

function setupStore(overrides: StorageOverrides = {}) {
  const storage = {
    info: overrides.info ?? null,
    leagueUsage: overrides.leagueUsage ?? [],
    isLoading: overrides.isLoading ?? false,
    error: overrides.error ?? null,
    deletingLeagueId: overrides.deletingLeagueId ?? null,
    fetchStorageInfo: mockFetchStorageInfo,
    fetchLeagueUsage: mockFetchLeagueUsage,
    deleteLeagueData: mockDeleteLeagueData,
  };

  mockUseBoundStore.mockImplementation((selector?: any) => {
    const state = { storage } as any;
    return selector ? selector(state) : state;
  });

  return storage;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("StorageSettingsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  it('renders "Storage" title', () => {
    renderWithProviders(<StorageSettingsCard />);

    expect(
      screen.getByRole("heading", { name: /Storage/i }),
    ).toBeInTheDocument();
  });

  it("renders description text about disk usage", () => {
    renderWithProviders(<StorageSettingsCard />);

    expect(
      screen.getByText("Disk usage for application data and database"),
    ).toBeInTheDocument();
  });

  // ── Loading state ──────────────────────────────────────────────────────

  it("shows loading spinner when isLoading and no info", () => {
    setupStore({ isLoading: true, info: null });
    renderWithProviders(<StorageSettingsCard />);

    const spinner = document.querySelector(".loading-spinner");
    expect(spinner).toBeInTheDocument();
  });

  it("does not show loading spinner when info exists even if isLoading", () => {
    setupStore({
      isLoading: true,
      info: { totalBytes: 1000, databaseBytes: 500 },
    });
    renderWithProviders(<StorageSettingsCard />);

    const spinner = document.querySelector(".loading-spinner");
    expect(spinner).not.toBeInTheDocument();
  });

  // ── Error state ────────────────────────────────────────────────────────

  it("shows error alert when error exists", () => {
    setupStore({ error: "Failed to fetch storage info" });
    renderWithProviders(<StorageSettingsCard />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("Failed to fetch storage info");
  });

  it("shows Retry button in error state that calls refresh", async () => {
    setupStore({ error: "Something went wrong" });
    const { user } = renderWithProviders(<StorageSettingsCard />);

    const retryButton = screen.getByRole("button", { name: /Retry/i });
    expect(retryButton).toBeInTheDocument();

    await user.click(retryButton);

    await waitFor(() => {
      expect(mockFetchStorageInfo).toHaveBeenCalled();
      expect(mockFetchLeagueUsage).toHaveBeenCalled();
    });
  });

  // ── Content when info exists ───────────────────────────────────────────

  it("renders DiskUsageSection and LeagueDataSection when info exists", () => {
    setupStore({
      info: { totalBytes: 1000, databaseBytes: 500 },
      leagueUsage: [],
    });
    renderWithProviders(<StorageSettingsCard />);

    expect(screen.getByTestId("disk-usage")).toBeInTheDocument();
    expect(screen.getByTestId("league-data")).toBeInTheDocument();
  });

  it("does not render DiskUsageSection or LeagueDataSection when info is null", () => {
    setupStore({ info: null });
    renderWithProviders(<StorageSettingsCard />);

    expect(screen.queryByTestId("disk-usage")).not.toBeInTheDocument();
    expect(screen.queryByTestId("league-data")).not.toBeInTheDocument();
  });

  // ── Fetch on mount ─────────────────────────────────────────────────────

  it("calls fetchStorageInfo and fetchLeagueUsage on mount", () => {
    renderWithProviders(<StorageSettingsCard />);

    expect(mockFetchStorageInfo).toHaveBeenCalledTimes(1);
    expect(mockFetchLeagueUsage).toHaveBeenCalledTimes(1);
  });

  // ── Delete modal ───────────────────────────────────────────────────────

  it("renders DeleteLeagueModal", () => {
    renderWithProviders(<StorageSettingsCard />);

    expect(screen.getByTestId("delete-modal")).toBeInTheDocument();
  });

  // ── handleRefresh calls trackEvent ─────────────────────────────────────

  it("calls trackEvent with refresh action after Retry click", async () => {
    mockFetchStorageInfo.mockResolvedValue(undefined);
    mockFetchLeagueUsage.mockResolvedValue(undefined);
    setupStore({ error: "Something went wrong" });
    const { user } = renderWithProviders(<StorageSettingsCard />);

    const retryButton = screen.getByRole("button", { name: /Retry/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith("settings-storage", {
        action: "refresh",
      });
    });
  });

  // ── handleDeleteRequest ────────────────────────────────────────────────

  it("sets leagueToDelete when onDeleteRequest is called from LeagueDataSection", async () => {
    setupStore({
      info: { totalBytes: 1000, databaseBytes: 500 },
      leagueUsage: [],
    });
    const { user } = renderWithProviders(<StorageSettingsCard />);

    const deleteBtn = screen.getByTestId("league-delete-btn");
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByTestId("delete-modal")).toHaveAttribute(
        "data-league",
        "test-league-123",
      );
    });
  });

  // ── handleDeleteConfirm ────────────────────────────────────────────────

  it("calls deleteLeagueData and trackEvent when confirm is clicked", async () => {
    mockDeleteLeagueData.mockResolvedValue(undefined);
    setupStore({
      info: { totalBytes: 1000, databaseBytes: 500 },
      leagueUsage: [],
    });
    const { user } = renderWithProviders(<StorageSettingsCard />);

    // First trigger a delete request so leagueToDelete is set
    const deleteBtn = screen.getByTestId("league-delete-btn");
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByTestId("delete-modal")).toHaveAttribute(
        "data-league",
        "test-league-123",
      );
    });

    // Now confirm the deletion
    const confirmBtn = screen.getByTestId("modal-confirm");
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockDeleteLeagueData).toHaveBeenCalledWith("test-league-123");
      expect(mockTrackEvent).toHaveBeenCalledWith("settings-storage", {
        action: "delete-league",
        leagueId: "test-league-123",
      });
    });
  });

  it("clears leagueToDelete after confirm", async () => {
    mockDeleteLeagueData.mockResolvedValue(undefined);
    setupStore({
      info: { totalBytes: 1000, databaseBytes: 500 },
      leagueUsage: [],
    });
    const { user } = renderWithProviders(<StorageSettingsCard />);

    // Trigger delete request
    await user.click(screen.getByTestId("league-delete-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("delete-modal")).toHaveAttribute(
        "data-league",
        "test-league-123",
      );
    });

    // Confirm deletion
    await user.click(screen.getByTestId("modal-confirm"));

    await waitFor(() => {
      expect(screen.getByTestId("delete-modal")).toHaveAttribute(
        "data-league",
        "",
      );
    });
  });

  // ── handleDeleteModalClose ─────────────────────────────────────────────

  it("clears leagueToDelete when modal close is clicked", async () => {
    setupStore({
      info: { totalBytes: 1000, databaseBytes: 500 },
      leagueUsage: [],
    });
    const { user } = renderWithProviders(<StorageSettingsCard />);

    // First set a league to delete
    await user.click(screen.getByTestId("league-delete-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("delete-modal")).toHaveAttribute(
        "data-league",
        "test-league-123",
      );
    });

    // Close the modal
    await user.click(screen.getByTestId("modal-close"));

    await waitFor(() => {
      expect(screen.getByTestId("delete-modal")).toHaveAttribute(
        "data-league",
        "",
      );
    });
  });
});
