import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import SetupLeagueStep from "../Setup.components/SetupLeagueStep";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUseBoundStore = vi.mocked(useBoundStore);

function createMockStore(overrides: any = {}) {
  return {
    setup: {
      setupState: {
        currentStep: 3,
        isComplete: false,
        selectedGames: ["poe1"],
        poe1League: "",
        poe2League: "",
        ...overrides.setupState,
      },
      selectLeague: vi.fn(),
      ...overrides.setup,
    },
    gameInfo: {
      poe1Leagues: [
        { id: "standard", name: "Standard" },
        { id: "settlers", name: "Settlers" },
      ],
      poe2Leagues: [{ id: "standard2", name: "Standard" }],
      isLoadingLeagues: false,
      leaguesError: null,
      fetchLeagues: vi.fn(),
      ...overrides.gameInfo,
    },
  } as any;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SetupLeagueStep", () => {
  beforeEach(() => {
    mockUseBoundStore.mockReturnValue(createMockStore());
  });

  // ── Heading and description ──────────────────────────────────────────

  describe("heading and description", () => {
    it("renders the heading", () => {
      renderWithProviders(<SetupLeagueStep />);

      expect(screen.getByText("Select your league")).toBeInTheDocument();
    });

    it("renders the description text", () => {
      renderWithProviders(<SetupLeagueStep />);

      expect(
        screen.getByText(
          "Choose the league you want to track divination cards for.",
        ),
      ).toBeInTheDocument();
    });
  });

  // ── League dropdowns based on selected games ─────────────────────────

  describe("league dropdowns", () => {
    it("shows PoE1 league dropdown when poe1 is selected", () => {
      renderWithProviders(<SetupLeagueStep />);

      expect(screen.getByText("Path of Exile 1 League")).toBeInTheDocument();
    });

    it("shows PoE2 league dropdown when poe2 is selected", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 3,
            isComplete: false,
            selectedGames: ["poe2"],
            poe1League: "",
            poe2League: "",
          },
        }),
      );

      renderWithProviders(<SetupLeagueStep />);

      expect(screen.getByText("Path of Exile 2 League")).toBeInTheDocument();
      expect(
        screen.queryByText("Path of Exile 1 League"),
      ).not.toBeInTheDocument();
    });

    it("shows both dropdowns when both games are selected", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 3,
            isComplete: false,
            selectedGames: ["poe1", "poe2"],
            poe1League: "",
            poe2League: "",
          },
        }),
      );

      renderWithProviders(<SetupLeagueStep />);

      expect(screen.getByText("Path of Exile 1 League")).toBeInTheDocument();
      expect(screen.getByText("Path of Exile 2 League")).toBeInTheDocument();
    });
  });

  // ── Fetching leagues on mount ────────────────────────────────────────

  describe("fetching leagues on mount", () => {
    it("calls fetchLeagues on mount for selected games", () => {
      const fetchLeagues = vi.fn();
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 3,
            isComplete: false,
            selectedGames: ["poe1", "poe2"],
            poe1League: "",
            poe2League: "",
          },
          gameInfo: { fetchLeagues },
        }),
      );

      renderWithProviders(<SetupLeagueStep />);

      expect(fetchLeagues).toHaveBeenCalledWith("poe1");
      expect(fetchLeagues).toHaveBeenCalledWith("poe2");
    });

    it("calls fetchLeagues only for poe1 when only poe1 is selected", () => {
      const fetchLeagues = vi.fn();
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          gameInfo: { fetchLeagues },
        }),
      );

      renderWithProviders(<SetupLeagueStep />);

      expect(fetchLeagues).toHaveBeenCalledWith("poe1");
      expect(fetchLeagues).not.toHaveBeenCalledWith("poe2");
    });
  });

  // ── Loading state ────────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows loading state when isLoadingLeagues is true", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          gameInfo: { isLoadingLeagues: true },
        }),
      );

      renderWithProviders(<SetupLeagueStep />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("does not render select element when loading", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          gameInfo: { isLoadingLeagues: true },
        }),
      );

      renderWithProviders(<SetupLeagueStep />);

      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });
  });

  // ── Error state ──────────────────────────────────────────────────────

  describe("error state", () => {
    it("shows error message when leaguesError is set", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          gameInfo: { leaguesError: "Network error" },
        }),
      );

      renderWithProviders(<SetupLeagueStep />);

      expect(screen.getByText("Failed to load leagues")).toBeInTheDocument();
    });

    it("shows Retry button when leaguesError is set", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          gameInfo: { leaguesError: "Network error" },
        }),
      );

      renderWithProviders(<SetupLeagueStep />);

      expect(screen.getByText("Retry")).toBeInTheDocument();
    });

    it("calls fetchLeagues when Retry button is clicked", async () => {
      const fetchLeagues = vi.fn();
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          gameInfo: { leaguesError: "Network error", fetchLeagues },
        }),
      );

      const { user } = renderWithProviders(<SetupLeagueStep />);

      const retryButton = screen.getByText("Retry");
      await user.click(retryButton);

      // fetchLeagues is called on mount AND on retry
      expect(fetchLeagues).toHaveBeenCalledWith("poe1");
    });
  });

  // ── Selecting a league ───────────────────────────────────────────────

  describe("league selection", () => {
    it("selecting a league calls selectLeague", async () => {
      const selectLeague = vi.fn();
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setup: { selectLeague },
        }),
      );

      const { user } = renderWithProviders(<SetupLeagueStep />);

      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "settlers");

      expect(selectLeague).toHaveBeenCalledWith("poe1", "settlers");
    });

    it("renders league options from the store", () => {
      renderWithProviders(<SetupLeagueStep />);

      const select = screen.getByRole("combobox");
      const options = select.querySelectorAll("option");

      // "Select a league..." placeholder + 2 leagues
      expect(options).toHaveLength(3);
      expect(options[1]).toHaveTextContent("Standard");
      expect(options[2]).toHaveTextContent("Settlers");
    });
  });

  // ── Both leagues configured message ──────────────────────────────────

  describe("both leagues configured", () => {
    it("shows 'Both leagues configured' when both leagues are set", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 3,
            isComplete: false,
            selectedGames: ["poe1", "poe2"],
            poe1League: "standard",
            poe2League: "standard2",
          },
        }),
      );

      renderWithProviders(<SetupLeagueStep />);

      expect(screen.getByText("✓ Both leagues configured")).toBeInTheDocument();
    });

    it("does not show 'Both leagues configured' when only one league is set", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 3,
            isComplete: false,
            selectedGames: ["poe1", "poe2"],
            poe1League: "standard",
            poe2League: "",
          },
        }),
      );

      renderWithProviders(<SetupLeagueStep />);

      expect(
        screen.queryByText("✓ Both leagues configured"),
      ).not.toBeInTheDocument();
    });

    it("does not show 'Both leagues configured' when only one game is selected", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 3,
            isComplete: false,
            selectedGames: ["poe1"],
            poe1League: "standard",
            poe2League: "",
          },
        }),
      );

      renderWithProviders(<SetupLeagueStep />);

      expect(
        screen.queryByText("✓ Both leagues configured"),
      ).not.toBeInTheDocument();
    });
  });

  // ── Empty leagues ────────────────────────────────────────────────────

  describe("empty leagues", () => {
    it("shows 'No leagues available' when leagues array is empty", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          gameInfo: {
            poe1Leagues: [],
            poe2Leagues: [],
          },
        }),
      );

      renderWithProviders(<SetupLeagueStep />);

      expect(screen.getByText("No leagues available.")).toBeInTheDocument();
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles null setupState gracefully", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({
          setupState: null,
        }),
      );

      renderWithProviders(<SetupLeagueStep />);

      expect(screen.getByText("Select your league")).toBeInTheDocument();
    });
  });
});
