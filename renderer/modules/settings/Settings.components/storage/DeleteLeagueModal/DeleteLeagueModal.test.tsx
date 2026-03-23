import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LeagueStorageUsage } from "~/main/modules/storage/Storage.types";
import {
  act,
  renderWithProviders,
  screen,
} from "~/renderer/__test-setup__/render";

import DeleteLeagueModal from "./DeleteLeagueModal";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiAlertTriangle: () => <span data-testid="icon-alert-triangle" />,
  FiTrash2: () => <span data-testid="icon-trash" />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function createLeague(
  overrides: Partial<LeagueStorageUsage> = {},
): LeagueStorageUsage {
  return {
    leagueId: "league-123",
    leagueName: "Settlers",
    game: "poe1",
    sessionCount: 5,
    snapshotCount: 12,
    estimatedSizeBytes: 1048576, // 1 MB
    hasActiveSession: false,
    ...overrides,
  };
}

const defaultProps = {
  league: null as LeagueStorageUsage | null,
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("DeleteLeagueModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
  });

  // ── Rendering when league is null ──────────────────────────────────────

  it("does not show dialog content when league is null", () => {
    renderWithProviders(<DeleteLeagueModal {...defaultProps} league={null} />);

    // The league-specific content should not be rendered
    expect(screen.queryByText("Settlers")).not.toBeInTheDocument();
    expect(
      screen.queryByText("This action cannot be undone."),
    ).not.toBeInTheDocument();
  });

  // ── Rendering when league is provided ──────────────────────────────────

  it("shows dialog when league prop is provided", () => {
    const league = createLeague();

    renderWithProviders(
      <DeleteLeagueModal {...defaultProps} league={league} />,
    );

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1);
  });

  it("shows league name and game label", () => {
    const league = createLeague({
      leagueName: "Necropolis",
      game: "poe1",
    });

    renderWithProviders(
      <DeleteLeagueModal {...defaultProps} league={league} />,
    );

    expect(screen.getByText(/Necropolis/)).toBeInTheDocument();
    expect(screen.getByText(/PoE1/)).toBeInTheDocument();
  });

  it("shows league name and PoE2 game label", () => {
    const league = createLeague({
      leagueName: "Standard",
      game: "poe2",
    });

    renderWithProviders(
      <DeleteLeagueModal {...defaultProps} league={league} />,
    );

    expect(screen.getByText(/Standard/)).toBeInTheDocument();
    expect(screen.getByText(/PoE2/)).toBeInTheDocument();
  });

  it("shows session count and snapshot count", () => {
    const league = createLeague({
      sessionCount: 5,
      snapshotCount: 12,
    });

    renderWithProviders(
      <DeleteLeagueModal {...defaultProps} league={league} />,
    );

    expect(
      screen.getByText(/5 sessions and their card data/),
    ).toBeInTheDocument();
    expect(screen.getByText(/12 price snapshots/)).toBeInTheDocument();
  });

  it("shows singular session and snapshot when counts are 1", () => {
    const league = createLeague({
      sessionCount: 1,
      snapshotCount: 1,
    });

    renderWithProviders(
      <DeleteLeagueModal {...defaultProps} league={league} />,
    );

    expect(
      screen.getByText(/1 session and their card data/),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 price snapshot$/)).toBeInTheDocument();
  });

  it("shows estimated size", () => {
    const league = createLeague({
      estimatedSizeBytes: 1048576, // 1 MB
    });

    renderWithProviders(
      <DeleteLeagueModal {...defaultProps} league={league} />,
    );

    expect(screen.getByText(/Estimated space freed/)).toBeInTheDocument();
    expect(screen.getByText(/1\.00 MB/)).toBeInTheDocument();
  });

  it('shows "This action cannot be undone." warning', () => {
    const league = createLeague();

    renderWithProviders(
      <DeleteLeagueModal {...defaultProps} league={league} />,
    );

    expect(
      screen.getByText("This action cannot be undone."),
    ).toBeInTheDocument();
  });

  // ── Interactions ───────────────────────────────────────────────────────

  it("closes the dialog when Cancel button is clicked", async () => {
    const onClose = vi.fn();
    const league = createLeague();

    const { user } = renderWithProviders(
      <DeleteLeagueModal
        league={league}
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );

    // Find Cancel button — it's in the modal-action area
    const buttons = screen.getAllByRole("button", { hidden: true });
    const cancelBtn = buttons.find(
      (btn) => btn.textContent?.trim() === "Cancel",
    );
    expect(cancelBtn).toBeDefined();

    await user.click(cancelBtn!);

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("calls onConfirm with leagueId when Delete button is clicked", async () => {
    const onConfirm = vi.fn();
    const league = createLeague({ leagueId: "league-456" });

    const { user } = renderWithProviders(
      <DeleteLeagueModal
        league={league}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    // Find the Delete button
    const buttons = screen.getAllByRole("button", { hidden: true });
    const deleteBtn = buttons.find((btn) =>
      btn.textContent?.includes("Delete League Data"),
    );
    expect(deleteBtn).toBeDefined();

    await user.click(deleteBtn!);

    expect(onConfirm).toHaveBeenCalledWith("league-456");
  });

  it("closes the dialog when Delete button is clicked", async () => {
    const league = createLeague();

    const { user } = renderWithProviders(
      <DeleteLeagueModal
        league={league}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const buttons = screen.getAllByRole("button", { hidden: true });
    const deleteBtn = buttons.find((btn) =>
      btn.textContent?.includes("Delete League Data"),
    );

    await user.click(deleteBtn!);

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("renders Delete League Data heading", () => {
    const league = createLeague();

    renderWithProviders(
      <DeleteLeagueModal {...defaultProps} league={league} />,
    );

    expect(
      screen.getByRole("heading", {
        name: /Delete League Data/i,
        hidden: true,
      }),
    ).toBeInTheDocument();
  });

  // ── handleDialogClose ──────────────────────────────────────────────────

  it("calls onClose immediately and clears snapshot after 200ms when dialog close event fires", () => {
    vi.useFakeTimers();

    const onClose = vi.fn();
    const league = createLeague({ leagueName: "Necropolis" });

    renderWithProviders(
      <DeleteLeagueModal
        league={league}
        onConfirm={vi.fn()}
        onClose={onClose}
      />,
    );

    const dialog = document.querySelector("dialog")!;
    expect(dialog).toBeDefined();

    // Fire the native close event on the dialog
    fireEvent(dialog, new Event("close"));

    // onClose should be called immediately
    expect(onClose).toHaveBeenCalledTimes(1);

    // Snapshot content should still be visible (animation delay hasn't elapsed)
    expect(screen.getByText(/Necropolis/)).toBeInTheDocument();

    // Advance past the 200ms animation delay
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Snapshot content should now be gone (setSnapshot(null) ran)
    expect(screen.queryByText(/Necropolis/)).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
