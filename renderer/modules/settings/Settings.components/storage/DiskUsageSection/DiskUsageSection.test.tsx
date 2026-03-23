import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StorageInfo } from "~/main/modules/storage/Storage.types";
import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";

import DiskUsageSection from "./DiskUsageSection";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components", () => ({
  Accordion: ({
    title,
    children,
    icon,
    headerRight,
  }: {
    title: React.ReactNode;
    children: React.ReactNode;
    icon?: React.ReactNode;
    headerRight?: React.ReactNode;
  }) => (
    <div data-testid="accordion">
      <div data-testid="accordion-title">{title}</div>
      {icon && <span data-testid="accordion-icon">{icon}</span>}
      {headerRight && (
        <span data-testid="accordion-header-right">{headerRight}</span>
      )}
      <div data-testid="accordion-content">{children}</div>
    </div>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiArchive: (props: any) => <span data-testid="icon-archive" {...props} />,
  FiDatabase: (props: any) => <span data-testid="icon-database" {...props} />,
  FiEye: (props: any) => <span data-testid="icon-eye" {...props} />,
  FiEyeOff: (props: any) => <span data-testid="icon-eye-off" {...props} />,
  FiFile: (props: any) => <span data-testid="icon-file" {...props} />,
}));

vi.mock("../storage.utils/storage.utils", () => ({
  formatBytes: vi.fn((b: number) => `${b} bytes`),
  formatPercentage: vi.fn((f: number) => `${(f * 100).toFixed(1)}%`),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function createStorageInfo(overrides: Partial<StorageInfo> = {}): StorageInfo {
  return {
    appDataPath: "C:\\Users\\***\\AppData\\Roaming\\soothsayer",
    appDataSizeBytes: 500_000_000, // 500 MB
    dbSizeBytes: 200_000_000, // 200 MB
    diskTotalBytes: 1_000_000_000_000, // 1 TB
    diskFreeBytes: 500_000_000_000, // 500 GB
    dbDiskTotalBytes: 1_000_000_000_000, // same drive
    dbDiskFreeBytes: 500_000_000_000, // same drive
    breakdown: [],
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("DiskUsageSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Basic rendering ────────────────────────────────────────────────────

  it('renders "Disk Usage" heading', () => {
    renderWithProviders(<DiskUsageSection info={createStorageInfo()} />);

    expect(screen.getByText("Disk Usage")).toBeInTheDocument();
  });

  it("renders the masked app data path by default", () => {
    const info = createStorageInfo({
      appDataPath: "C:\\Users\\***\\AppData\\Roaming\\soothsayer",
    });

    renderWithProviders(<DiskUsageSection info={info} />);

    expect(
      screen.getByText("C:\\Users\\***\\AppData\\Roaming\\soothsayer"),
    ).toBeInTheDocument();
  });

  it("renders usage bar segments for all three categories", () => {
    const info = createStorageInfo({
      diskTotalBytes: 1_000_000,
      diskFreeBytes: 400_000,
      appDataSizeBytes: 200_000,
      dbSizeBytes: 100_000,
    });

    renderWithProviders(<DiskUsageSection info={info} />);

    // Other disk usage = total - free - appData = 1M - 400K - 200K = 400K
    expect(
      screen.getByTitle("Other disk usage: 400000 bytes"),
    ).toBeInTheDocument();
    // Soothsayer size = appData - db = 200K - 100K = 100K
    expect(
      screen.getByTitle("Soothsayer size: 100000 bytes"),
    ).toBeInTheDocument();
    // Database = 100K
    expect(screen.getByTitle("Database: 100000 bytes")).toBeInTheDocument();
  });

  it('shows "used of" and "free" text with correct values', () => {
    const info = createStorageInfo({
      diskTotalBytes: 1_000_000,
      diskFreeBytes: 400_000,
      appDataSizeBytes: 200_000,
      dbSizeBytes: 100_000,
    });

    renderWithProviders(<DiskUsageSection info={info} />);

    // usedBytes = otherDiskUsed + otherAppData + db = 400K + 100K + 100K = 600K
    expect(
      screen.getByText(/600000 bytes used of 1000000 bytes/),
    ).toBeInTheDocument();
    expect(screen.getByText("400000 bytes free")).toBeInTheDocument();
  });

  it("renders legend with segment labels when multiple segments are visible", () => {
    const info = createStorageInfo({
      diskTotalBytes: 1_000_000,
      diskFreeBytes: 400_000,
      appDataSizeBytes: 200_000,
      dbSizeBytes: 100_000,
    });

    renderWithProviders(<DiskUsageSection info={info} />);

    // All three segments have bytes > 0, so legend should show all three
    expect(screen.getByText("Other disk usage")).toBeInTheDocument();
    expect(screen.getByText("Soothsayer size")).toBeInTheDocument();
    expect(screen.getByText("Database")).toBeInTheDocument();
  });

  it("hides legend when only one segment is visible", () => {
    // Only database has bytes > 0: appData == db, diskTotal == diskFree + appData
    const info = createStorageInfo({
      diskTotalBytes: 200_000,
      diskFreeBytes: 0,
      appDataSizeBytes: 200_000,
      dbSizeBytes: 200_000,
    });

    renderWithProviders(<DiskUsageSection info={info} />);

    // otherDiskUsed = total - free - appData = 200K - 0 - 200K = 0
    // otherAppData = appData - db = 200K - 200K = 0
    // db = 200K → only one visible segment
    // Legend only renders when visibleSegments.length > 1, so these should not appear
    expect(screen.queryByText("Soothsayer size")).not.toBeInTheDocument();
    expect(screen.queryByText("Other disk usage")).not.toBeInTheDocument();
  });

  it("hides segments with < 0.01% of total", () => {
    // Make one segment effectively zero relative to total
    const info = createStorageInfo({
      diskTotalBytes: 10_000_000_000, // 10 GB
      diskFreeBytes: 5_000_000_000,
      appDataSizeBytes: 5_000_000_000,
      dbSizeBytes: 0, // database is 0 → 0%
    });

    renderWithProviders(<DiskUsageSection info={info} />);

    // Database segment (0 bytes) should not render a bar
    expect(screen.queryByTitle(/Database:/)).not.toBeInTheDocument();
  });

  // ── Path reveal toggle ─────────────────────────────────────────────────

  it("calls revealPaths on first click and shows revealed path", async () => {
    const info = createStorageInfo({
      appDataPath: "C:\\Users\\***\\hidden",
    });

    (window.electron as any).storage.revealPaths = vi.fn().mockResolvedValue({
      appDataPath: "C:\\Users\\realuser\\AppData\\Roaming\\soothsayer",
    });

    const { user } = renderWithProviders(<DiskUsageSection info={info} />);

    // Initially shows masked path
    expect(screen.getByText("C:\\Users\\***\\hidden")).toBeInTheDocument();

    // Click the reveal button
    const revealBtn = screen.getByTitle("Reveal full path");
    await user.click(revealBtn);

    await waitFor(() => {
      expect(
        screen.getByText("C:\\Users\\realuser\\AppData\\Roaming\\soothsayer"),
      ).toBeInTheDocument();
    });

    expect((window.electron as any).storage.revealPaths).toHaveBeenCalledTimes(
      1,
    );
  });

  it("toggles back to masked path on second click without calling revealPaths again", async () => {
    const info = createStorageInfo({
      appDataPath: "C:\\Users\\***\\hidden",
    });

    (window.electron as any).storage.revealPaths = vi.fn().mockResolvedValue({
      appDataPath: "C:\\Users\\realuser\\full-path",
    });

    const { user } = renderWithProviders(<DiskUsageSection info={info} />);

    // First click → reveal
    const revealBtn = screen.getByTitle("Reveal full path");
    await user.click(revealBtn);

    await waitFor(() => {
      expect(
        screen.getByText("C:\\Users\\realuser\\full-path"),
      ).toBeInTheDocument();
    });

    // Second click → hide
    const hideBtn = screen.getByTitle("Hide full path");
    await user.click(hideBtn);

    await waitFor(() => {
      expect(screen.getByText("C:\\Users\\***\\hidden")).toBeInTheDocument();
    });

    // Should NOT have called revealPaths a second time
    expect((window.electron as any).storage.revealPaths).toHaveBeenCalledTimes(
      1,
    );
  });

  it("uses cached paths on third click without new IPC call", async () => {
    const info = createStorageInfo({
      appDataPath: "C:\\Users\\***\\hidden",
    });

    (window.electron as any).storage.revealPaths = vi.fn().mockResolvedValue({
      appDataPath: "C:\\Users\\realuser\\full-path",
    });

    const { user } = renderWithProviders(<DiskUsageSection info={info} />);

    // First click → reveal (fetches paths)
    await user.click(screen.getByTitle("Reveal full path"));
    await waitFor(() => {
      expect(
        screen.getByText("C:\\Users\\realuser\\full-path"),
      ).toBeInTheDocument();
    });

    // Second click → hide
    await user.click(screen.getByTitle("Hide full path"));
    await waitFor(() => {
      expect(screen.getByText("C:\\Users\\***\\hidden")).toBeInTheDocument();
    });

    // Third click → reveal again using cached value
    await user.click(screen.getByTitle("Reveal full path"));
    await waitFor(() => {
      expect(
        screen.getByText("C:\\Users\\realuser\\full-path"),
      ).toBeInTheDocument();
    });

    // Still only 1 IPC call total
    expect((window.electron as any).storage.revealPaths).toHaveBeenCalledTimes(
      1,
    );
  });

  it("stays masked when revealPaths rejects", async () => {
    const info = createStorageInfo({
      appDataPath: "C:\\Users\\***\\masked",
    });

    (window.electron as any).storage.revealPaths = vi
      .fn()
      .mockRejectedValue(new Error("IPC failure"));

    const { user } = renderWithProviders(<DiskUsageSection info={info} />);

    await user.click(screen.getByTitle("Reveal full path"));

    // Wait a tick for the async rejection to settle
    await waitFor(() => {
      expect(screen.getByText("C:\\Users\\***\\masked")).toBeInTheDocument();
    });

    // Button should still say "Reveal full path" (not toggled)
    expect(screen.getByTitle("Reveal full path")).toBeInTheDocument();
  });

  // ── Different drive notice ─────────────────────────────────────────────

  it("shows different drive notice when disk stats differ", () => {
    const info = createStorageInfo({
      diskTotalBytes: 1_000_000_000,
      diskFreeBytes: 500_000_000,
      dbDiskTotalBytes: 2_000_000_000, // different!
      dbDiskFreeBytes: 1_000_000_000,
    });

    renderWithProviders(<DiskUsageSection info={info} />);

    expect(
      screen.getByText(
        "Database is on a different drive than application data",
      ),
    ).toBeInTheDocument();
  });

  it("hides different drive notice when disk stats match", () => {
    const info = createStorageInfo({
      diskTotalBytes: 1_000_000_000,
      diskFreeBytes: 500_000_000,
      dbDiskTotalBytes: 1_000_000_000, // same
      dbDiskFreeBytes: 500_000_000, // same
    });

    renderWithProviders(<DiskUsageSection info={info} />);

    expect(
      screen.queryByText(
        "Database is on a different drive than application data",
      ),
    ).not.toBeInTheDocument();
  });

  // ── Breakdown accordion ────────────────────────────────────────────────

  it("renders accordion when breakdown items exist", () => {
    const info = createStorageInfo({
      breakdown: [
        {
          label: "SQLite Database",
          category: "database",
          sizeBytes: 200_000_000,
          fileCount: 1,
        },
      ],
    });

    renderWithProviders(<DiskUsageSection info={info} />);

    expect(screen.getByTestId("accordion")).toBeInTheDocument();
    expect(screen.getByTestId("accordion-title")).toHaveTextContent(
      "What's using space?",
    );
  });

  it("hides accordion when breakdown is empty", () => {
    const info = createStorageInfo({ breakdown: [] });

    renderWithProviders(<DiskUsageSection info={info} />);

    expect(screen.queryByTestId("accordion")).not.toBeInTheDocument();
  });

  it("renders accordion headerRight with formatted appDataSizeBytes", () => {
    const info = createStorageInfo({
      appDataSizeBytes: 500_000_000,
      breakdown: [
        {
          label: "Database",
          category: "database",
          sizeBytes: 500_000_000,
          fileCount: 1,
        },
      ],
    });

    renderWithProviders(<DiskUsageSection info={info} />);

    expect(screen.getByTestId("accordion-header-right")).toHaveTextContent(
      "500000000 bytes",
    );
  });

  it("renders label, size, and progress bar for each breakdown item", () => {
    const info = createStorageInfo({
      appDataSizeBytes: 500_000,
      breakdown: [
        {
          label: "SQLite Database",
          category: "database",
          sizeBytes: 300_000,
          fileCount: 1,
        },
        {
          label: "Cache Files",
          category: "cache",
          sizeBytes: 200_000,
          fileCount: 5,
        },
      ],
    });

    renderWithProviders(<DiskUsageSection info={info} />);

    // Labels
    expect(screen.getByText("SQLite Database")).toBeInTheDocument();
    expect(screen.getByText("Cache Files")).toBeInTheDocument();

    // Sizes
    expect(screen.getByText("300000 bytes")).toBeInTheDocument();
    expect(screen.getByText("200000 bytes")).toBeInTheDocument();
  });

  it("renders correct icon for known categories", () => {
    const info = createStorageInfo({
      breakdown: [
        {
          label: "SQLite Database",
          category: "database",
          sizeBytes: 100_000,
          fileCount: 1,
        },
        {
          label: "Cache Files",
          category: "cache",
          sizeBytes: 50_000,
          fileCount: 3,
        },
      ],
    });

    renderWithProviders(<DiskUsageSection info={info} />);

    // The accordion content renders icons from CATEGORY_ICON_MAP
    const accordionContent = screen.getByTestId("accordion-content");
    // database → FiDatabase, cache → FiArchive
    expect(
      accordionContent.querySelectorAll('[data-testid="icon-database"]').length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      accordionContent.querySelectorAll('[data-testid="icon-archive"]').length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders fallback FiFile icon for unknown categories", () => {
    const info = createStorageInfo({
      breakdown: [
        {
          label: "Unknown stuff",
          category: "other" as any,
          sizeBytes: 10_000,
          fileCount: 2,
        },
      ],
    });

    renderWithProviders(<DiskUsageSection info={info} />);

    // "other" maps to FiFile in CATEGORY_ICON_MAP
    const accordionContent = screen.getByTestId("accordion-content");
    expect(
      accordionContent.querySelectorAll('[data-testid="icon-file"]').length,
    ).toBeGreaterThanOrEqual(1);
  });
});
