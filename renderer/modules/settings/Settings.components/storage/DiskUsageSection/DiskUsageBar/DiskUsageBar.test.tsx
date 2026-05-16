import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { type BarSegment, DiskUsageBar } from "./DiskUsageBar";

vi.mock("../../storage.utils/storage.utils", () => ({
  formatBytes: (bytes: number) => `${bytes} B`,
  formatPercentage: (fraction: number) => `${Math.round(fraction * 100)}%`,
}));

vi.mock("react-icons/fi", () => ({
  FiEye: () => <span data-testid="eye-icon" />,
  FiEyeOff: () => <span data-testid="eye-off-icon" />,
}));

const segments: BarSegment[] = [
  { label: "Other disk usage", bytes: 400, colorClass: "bg-base-content/20" },
  { label: "Soothsayer size", bytes: 100, colorClass: "bg-secondary" },
  { label: "Database", bytes: 100, colorClass: "bg-warning" },
];

describe("DiskUsageBar", () => {
  it("renders the path and reveal button in masked mode", async () => {
    const handleRevealToggle = vi.fn();
    const maskedPath = String.raw`C:\Users\***\AppData`;
    const { user } = renderWithProviders(
      <DiskUsageBar
        segments={segments}
        totalBytes={1000}
        path={maskedPath}
        onRevealToggle={handleRevealToggle}
        isRevealed={false}
      />,
    );

    expect(screen.getByText(maskedPath)).toBeInTheDocument();
    expect(screen.getByTitle("Reveal full path")).toBeInTheDocument();
    expect(screen.getByTestId("eye-icon")).toBeInTheDocument();

    await user.click(screen.getByTitle("Reveal full path"));

    expect(handleRevealToggle).toHaveBeenCalledTimes(1);
  });

  it("renders the hide button in revealed mode", () => {
    renderWithProviders(
      <DiskUsageBar
        segments={segments}
        totalBytes={1000}
        path="C:\\Users\\seb\\AppData"
        onRevealToggle={vi.fn()}
        isRevealed
      />,
    );

    expect(screen.getByTitle("Hide full path")).toBeInTheDocument();
    expect(screen.getByTestId("eye-off-icon")).toBeInTheDocument();
  });

  it("renders segment titles, total usage, free space, and legend", () => {
    renderWithProviders(<DiskUsageBar segments={segments} totalBytes={1000} />);

    expect(screen.getByTitle("Other disk usage: 400 B")).toBeInTheDocument();
    expect(screen.getByTitle("Soothsayer size: 100 B")).toBeInTheDocument();
    expect(screen.getByTitle("Database: 100 B")).toBeInTheDocument();
    expect(screen.getByText(/600 B used of 1000 B/)).toBeInTheDocument();
    expect(screen.getByText("400 B free")).toBeInTheDocument();
    expect(screen.getByText("Other disk usage")).toBeInTheDocument();
    expect(screen.getByText("Soothsayer size")).toBeInTheDocument();
    expect(screen.getByText("Database")).toBeInTheDocument();
  });

  it("omits tiny bar segments and hides the legend when only one segment is visible", () => {
    renderWithProviders(
      <DiskUsageBar
        segments={[
          { label: "Tiny", bytes: 0, colorClass: "bg-base-content/20" },
          { label: "Database", bytes: 100, colorClass: "bg-warning" },
        ]}
        totalBytes={1000}
      />,
    );

    expect(screen.queryByTitle("Tiny: 0 B")).not.toBeInTheDocument();
    expect(screen.getByTitle("Database: 100 B")).toBeInTheDocument();
    expect(screen.queryByText("Tiny")).not.toBeInTheDocument();
  });

  it("handles zero total bytes without rendering segment bars", () => {
    renderWithProviders(
      <DiskUsageBar
        segments={[{ label: "Database", bytes: 0, colorClass: "bg-warning" }]}
        totalBytes={0}
      />,
    );

    expect(screen.queryByTitle("Database: 0 B")).not.toBeInTheDocument();
    expect(screen.getByText(/0 B used of 0 B/)).toBeInTheDocument();
    expect(screen.getByText("0 B free")).toBeInTheDocument();
  });
});
