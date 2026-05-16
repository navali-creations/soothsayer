import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { OverlayRestoreDefaultsRow } from "./OverlayRestoreDefaultsRow";

vi.mock("~/renderer/components", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiMonitor: () => <span data-testid="monitor-icon" />,
}));

describe("OverlayRestoreDefaultsRow", () => {
  it("renders the restore defaults label, description, and icon", () => {
    renderWithProviders(
      <OverlayRestoreDefaultsRow onRestoreDefaults={vi.fn()} />,
    );

    expect(screen.getByTestId("monitor-icon")).toBeInTheDocument();
    expect(screen.getAllByText("Restore defaults")).toHaveLength(2);
    expect(
      screen.getByText("Reset position, size, and font sizes to defaults"),
    ).toBeInTheDocument();
  });

  it("calls the restore handler when clicked", async () => {
    const handleRestoreDefaults = vi.fn();
    const { user } = renderWithProviders(
      <OverlayRestoreDefaultsRow onRestoreDefaults={handleRestoreDefaults} />,
    );

    await user.click(screen.getByRole("button", { name: "Restore defaults" }));

    expect(handleRestoreDefaults).toHaveBeenCalledTimes(1);
  });
});
