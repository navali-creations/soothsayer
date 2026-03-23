import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import SetupGameStep from "./SetupGameStep";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUseBoundStore = vi.mocked(useBoundStore);

function createMockStore(overrides: Record<string, unknown> = {}) {
  return {
    setup: {
      setupState: {
        currentStep: 1,
        isComplete: false,
        selectedGames: ["poe1"] as string[],
        poe1League: "Standard",
        poe2League: "Standard",
        poe1ClientPath: null,
        poe2ClientPath: null,
        telemetryCrashReporting: false,
        telemetryUsageAnalytics: false,
      },
      toggleGame: vi.fn(),
      ...overrides,
    },
  } as any;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SetupGameStep", () => {
  beforeEach(() => {
    mockUseBoundStore.mockReturnValue(createMockStore());
  });

  // ── Heading and description ────────────────────────────────────────────

  describe("heading and description", () => {
    it("renders the heading", () => {
      renderWithProviders(<SetupGameStep />);

      expect(screen.getByText("Which games do you play?")).toBeInTheDocument();
    });

    it("renders the description text", () => {
      renderWithProviders(<SetupGameStep />);

      expect(
        screen.getByText(
          "Select one or both games. You can change this later in settings.",
        ),
      ).toBeInTheDocument();
    });
  });

  // ── Game options ───────────────────────────────────────────────────────

  describe("game options", () => {
    it("renders Path of Exile 1 option", () => {
      renderWithProviders(<SetupGameStep />);

      expect(screen.getByText("Path of Exile 1")).toBeInTheDocument();
      expect(
        screen.getByText("The original Path of Exile"),
      ).toBeInTheDocument();
    });

    it("renders Path of Exile 2 option", () => {
      renderWithProviders(<SetupGameStep />);

      expect(screen.getByText("Path of Exile 2")).toBeInTheDocument();
      expect(screen.getByText("The new standalone sequel")).toBeInTheDocument();
    });

    it("renders both game options as buttons", () => {
      renderWithProviders(<SetupGameStep />);

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(2);
    });
  });

  // ── Selection state ────────────────────────────────────────────────────

  describe("selection state", () => {
    it("shows selected state for poe1 when it is in selectedGames", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      );

      renderWithProviders(<SetupGameStep />);

      const poe1Button = screen.getByText("Path of Exile 1").closest("button");
      expect(poe1Button).toHaveClass("border-primary");
    });

    it("shows selected state for both games when both are in selectedGames", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe1", "poe2"],
          },
        }),
      );

      renderWithProviders(<SetupGameStep />);

      const poe1Button = screen.getByText("Path of Exile 1").closest("button");
      const poe2Button = screen.getByText("Path of Exile 2").closest("button");

      expect(poe1Button).toHaveClass("border-primary");
      expect(poe2Button).toHaveClass("border-primary");
    });

    it("shows unselected state for poe2 when only poe1 is selected", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      );

      renderWithProviders(<SetupGameStep />);

      const poe2Button = screen.getByText("Path of Exile 2").closest("button");
      expect(poe2Button).not.toHaveClass("border-primary");
    });

    it("renders a checkbox SVG indicator for selected games", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe1", "poe2"],
          },
        }),
      );

      renderWithProviders(<SetupGameStep />);

      // Each selected game card has a checkbox area with bg-primary
      const checkboxes = document.querySelectorAll(".bg-primary");
      // Both game cards should have their checkbox indicator filled
      expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Toggle interaction ─────────────────────────────────────────────────

  describe("toggle interaction", () => {
    it("calls toggleGame with 'poe2' when clicking PoE2 button", async () => {
      const toggleGame = vi.fn();
      mockUseBoundStore.mockReturnValue(createMockStore({ toggleGame }));

      const { user } = renderWithProviders(<SetupGameStep />);

      const poe2Button = screen.getByText("Path of Exile 2").closest("button")!;
      await user.click(poe2Button);

      expect(toggleGame).toHaveBeenCalledWith("poe2");
    });

    it("calls toggleGame with 'poe1' when clicking PoE1 button", async () => {
      const toggleGame = vi.fn();
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          toggleGame,
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe1", "poe2"],
          },
        }),
      );

      const { user } = renderWithProviders(<SetupGameStep />);

      const poe1Button = screen.getByText("Path of Exile 1").closest("button")!;
      await user.click(poe1Button);

      expect(toggleGame).toHaveBeenCalledWith("poe1");
    });
  });

  // ── Disabled state (can't deselect last game) ─────────────────────────

  describe("disabled state", () => {
    it("disables the only selected game so it cannot be deselected", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      );

      renderWithProviders(<SetupGameStep />);

      const poe1Button = screen.getByText("Path of Exile 1").closest("button");
      expect(poe1Button).toBeDisabled();
    });

    it("does not disable the only selected game's counterpart", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      );

      renderWithProviders(<SetupGameStep />);

      const poe2Button = screen.getByText("Path of Exile 2").closest("button");
      expect(poe2Button).not.toBeDisabled();
    });

    it("shows tooltip title on the disabled button", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe2"],
          },
        }),
      );

      renderWithProviders(<SetupGameStep />);

      const poe2Button = screen.getByText("Path of Exile 2").closest("button");
      expect(poe2Button).toHaveAttribute(
        "title",
        "At least one game must be selected",
      );
    });

    it("does not disable either game when both are selected", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe1", "poe2"],
          },
        }),
      );

      renderWithProviders(<SetupGameStep />);

      const poe1Button = screen.getByText("Path of Exile 1").closest("button");
      const poe2Button = screen.getByText("Path of Exile 2").closest("button");

      expect(poe1Button).not.toBeDisabled();
      expect(poe2Button).not.toBeDisabled();
    });

    it("does not call toggleGame when clicking a disabled button", async () => {
      const toggleGame = vi.fn();
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          toggleGame,
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      );

      const { user } = renderWithProviders(<SetupGameStep />);

      const poe1Button = screen.getByText("Path of Exile 1").closest("button")!;
      await user.click(poe1Button);

      expect(toggleGame).not.toHaveBeenCalled();
    });
  });

  // ── "Playing both?" hint ───────────────────────────────────────────────

  describe("both games hint", () => {
    it("shows 'Playing both?' hint when both games are selected", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe1", "poe2"],
          },
        }),
      );

      renderWithProviders(<SetupGameStep />);

      expect(screen.getByText("Playing both?")).toBeInTheDocument();
      expect(
        screen.getByText(
          /You'll configure leagues and client paths for each game\./,
        ),
      ).toBeInTheDocument();
    });

    it("does not show 'Playing both?' hint when only one game is selected", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      );

      renderWithProviders(<SetupGameStep />);

      expect(screen.queryByText("Playing both?")).not.toBeInTheDocument();
    });
  });

  // ── Edge case: null setupState ─────────────────────────────────────────

  describe("edge cases", () => {
    it("handles null setupState gracefully (defaults to empty selectedGames)", () => {
      mockUseBoundStore.mockReturnValue(createMockStore({ setupState: null }));

      renderWithProviders(<SetupGameStep />);

      // Should still render the heading and both game options
      expect(screen.getByText("Which games do you play?")).toBeInTheDocument();
      expect(screen.getByText("Path of Exile 1")).toBeInTheDocument();
      expect(screen.getByText("Path of Exile 2")).toBeInTheDocument();
    });
  });
});
