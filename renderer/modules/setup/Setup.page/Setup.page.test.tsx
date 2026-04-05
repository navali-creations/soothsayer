import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { useSetup } from "~/renderer/store";

import SetupPage from "./Setup.page";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useSetup: vi.fn(),
}));

vi.mock("~/main/modules/app-setup/AppSetup.types", () => ({
  SETUP_STEPS: {
    NOT_STARTED: 0,
    SELECT_GAME: 1,
    SELECT_LEAGUE: 2,
    SELECT_CLIENT_PATH: 3,
    TELEMETRY_CONSENT: 4,
  },
}));

vi.mock("../Setup.components", () => ({
  SetupActions: () => <div data-testid="setup-actions" />,
  SetupClientPathStep: () => <div data-testid="setup-client-path-step" />,
  SetupContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="setup-container">{children}</div>
  ),
  SetupErrorDisplay: () => <div data-testid="setup-error-display" />,
  SetupGameStep: () => <div data-testid="setup-game-step" />,
  SetupLeagueStep: () => <div data-testid="setup-league-step" />,
  SetupTelemetryStep: () => <div data-testid="setup-telemetry-step" />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUseSetup = vi.mocked(useSetup);

function createMockStore(overrides: Record<string, unknown> = {}) {
  return {
    setupState: {
      currentStep: 1,
      isComplete: false,
      selectedGames: ["poe1"],
      poe1League: "Standard",
      poe2League: "Standard",
      poe1ClientPath: null,
      poe2ClientPath: null,
      telemetryCrashReporting: false,
      telemetryUsageAnalytics: false,
    },
    trackSetupStarted: vi.fn(),
    validateCurrentStep: vi.fn(),
    advanceStep: vi.fn(),
    ...overrides,
  } as any;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SetupPage", () => {
  beforeEach(() => {
    mockUseSetup.mockReturnValue(createMockStore());
  });

  // ── Loading states ─────────────────────────────────────────────────────

  describe("loading states", () => {
    it("shows loading spinner when setupState is null", () => {
      mockUseSetup.mockReturnValue(createMockStore({ setupState: null }));

      renderWithProviders(<SetupPage />);

      const spinner = document.querySelector(".loading-spinner");
      expect(spinner).toBeInTheDocument();
      expect(screen.queryByTestId("setup-container")).not.toBeInTheDocument();
    });

    it("shows loading spinner when currentStep is NOT_STARTED (0)", () => {
      mockUseSetup.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 0,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      );

      renderWithProviders(<SetupPage />);

      const spinner = document.querySelector(".loading-spinner");
      expect(spinner).toBeInTheDocument();
      expect(screen.queryByTestId("setup-container")).not.toBeInTheDocument();
    });
  });

  // ── Lifecycle effects ──────────────────────────────────────────────────

  describe("lifecycle effects", () => {
    it("calls trackSetupStarted on mount", () => {
      const trackSetupStarted = vi.fn();
      mockUseSetup.mockReturnValue(createMockStore({ trackSetupStarted }));

      renderWithProviders(<SetupPage />);

      expect(trackSetupStarted).toHaveBeenCalledTimes(1);
    });

    it("calls advanceStep when at step 0 (auto-advance)", async () => {
      const advanceStep = vi.fn();
      mockUseSetup.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 0,
            isComplete: false,
            selectedGames: ["poe1"],
          },
          advanceStep,
        }),
      );

      renderWithProviders(<SetupPage />);

      await waitFor(() => {
        expect(advanceStep).toHaveBeenCalledTimes(1);
      });
    });

    it("calls validateCurrentStep when step > 0", () => {
      const validateCurrentStep = vi.fn();
      mockUseSetup.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 2,
            isComplete: false,
            selectedGames: ["poe1"],
          },
          validateCurrentStep,
        }),
      );

      renderWithProviders(<SetupPage />);

      expect(validateCurrentStep).toHaveBeenCalled();
    });
  });

  // ── Step rendering ─────────────────────────────────────────────────────

  describe("step rendering", () => {
    it("renders SetupGameStep when currentStep is SELECT_GAME (1)", () => {
      mockUseSetup.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      );

      renderWithProviders(<SetupPage />);

      expect(screen.getByTestId("setup-game-step")).toBeInTheDocument();
      expect(screen.queryByTestId("setup-league-step")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("setup-client-path-step"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("setup-telemetry-step"),
      ).not.toBeInTheDocument();
    });

    it("renders SetupLeagueStep when currentStep is SELECT_LEAGUE (2)", () => {
      mockUseSetup.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 2,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      );

      renderWithProviders(<SetupPage />);

      expect(screen.getByTestId("setup-league-step")).toBeInTheDocument();
      expect(screen.queryByTestId("setup-game-step")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("setup-client-path-step"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("setup-telemetry-step"),
      ).not.toBeInTheDocument();
    });

    it("renders SetupClientPathStep when currentStep is SELECT_CLIENT_PATH (3)", () => {
      mockUseSetup.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 3,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      );

      renderWithProviders(<SetupPage />);

      expect(screen.getByTestId("setup-client-path-step")).toBeInTheDocument();
      expect(screen.queryByTestId("setup-game-step")).not.toBeInTheDocument();
      expect(screen.queryByTestId("setup-league-step")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("setup-telemetry-step"),
      ).not.toBeInTheDocument();
    });

    it("renders SetupTelemetryStep when currentStep is TELEMETRY_CONSENT (4)", () => {
      mockUseSetup.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 4,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      );

      renderWithProviders(<SetupPage />);

      expect(screen.getByTestId("setup-telemetry-step")).toBeInTheDocument();
      expect(screen.queryByTestId("setup-game-step")).not.toBeInTheDocument();
      expect(screen.queryByTestId("setup-league-step")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("setup-client-path-step"),
      ).not.toBeInTheDocument();
    });
  });

  // ── Layout elements ────────────────────────────────────────────────────

  describe("layout elements", () => {
    it("always renders SetupActions and SetupErrorDisplay when step > 0", () => {
      renderWithProviders(<SetupPage />);

      expect(screen.getByTestId("setup-actions")).toBeInTheDocument();
      expect(screen.getByTestId("setup-error-display")).toBeInTheDocument();
    });

    it("renders SetupContainer wrapping content when step > 0", () => {
      renderWithProviders(<SetupPage />);

      expect(screen.getByTestId("setup-container")).toBeInTheDocument();
    });

    it("renders SetupActions on every visible step", () => {
      // Step 2
      mockUseSetup.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 2,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      );

      const { unmount } = renderWithProviders(<SetupPage />);
      expect(screen.getByTestId("setup-actions")).toBeInTheDocument();
      unmount();

      // Step 3
      mockUseSetup.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 3,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      );

      renderWithProviders(<SetupPage />);
      expect(screen.getByTestId("setup-actions")).toBeInTheDocument();
    });

    it("renders SetupErrorDisplay on every visible step", () => {
      // Step 4
      mockUseSetup.mockReturnValue(
        createMockStore({
          setupState: {
            currentStep: 4,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      );

      renderWithProviders(<SetupPage />);
      expect(screen.getByTestId("setup-error-display")).toBeInTheDocument();
    });
  });
});
