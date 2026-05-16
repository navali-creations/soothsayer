import { describe, expect, it, vi } from "vitest";

import type { LeagueStorageUsage } from "~/main/modules/storage/Storage.types";
import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { LeagueDeleteButton } from "./LeagueDeleteButton";

vi.mock("react-icons/fi", () => ({
  FiTrash2: () => <span data-testid="trash-icon" />,
}));

function createLeague(
  overrides: Partial<LeagueStorageUsage> = {},
): LeagueStorageUsage {
  return {
    leagueId: "league-1",
    leagueName: "Settlers",
    game: "poe1",
    sessionCount: 5,
    snapshotCount: 12,
    estimatedSizeBytes: 1024,
    hasActiveSession: false,
    ...overrides,
  };
}

describe("LeagueDeleteButton", () => {
  it("calls onDelete with the league when enabled", async () => {
    const league = createLeague();
    const handleDelete = vi.fn();
    const { user } = renderWithProviders(
      <LeagueDeleteButton
        league={league}
        deletingLeagueId={null}
        onDelete={handleDelete}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Delete all data for Settlers",
    });
    expect(button).toHaveAttribute("title", "Delete all data for Settlers");
    expect(button).not.toBeDisabled();
    expect(screen.getByTestId("trash-icon")).toBeInTheDocument();

    await user.click(button);

    expect(handleDelete).toHaveBeenCalledWith(league);
  });

  it("disables deletion for an active session league", async () => {
    const handleDelete = vi.fn();
    const { user } = renderWithProviders(
      <LeagueDeleteButton
        league={createLeague({ hasActiveSession: true })}
        deletingLeagueId={null}
        onDelete={handleDelete}
      />,
    );

    const button = screen.getByRole("button");

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      "Cannot delete while session is active",
    );

    await user.click(button);

    expect(handleDelete).not.toHaveBeenCalled();
  });

  it("shows a loading spinner for the league being deleted", () => {
    renderWithProviders(
      <LeagueDeleteButton
        league={createLeague({ leagueId: "league-1" })}
        deletingLeagueId="league-1"
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("button")).toBeDisabled();
    expect(document.querySelector(".loading-spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("trash-icon")).not.toBeInTheDocument();
  });

  it("disables other league buttons while any deletion is pending", () => {
    renderWithProviders(
      <LeagueDeleteButton
        league={createLeague({ leagueId: "league-2" })}
        deletingLeagueId="league-1"
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByTestId("trash-icon")).toBeInTheDocument();
  });
});
