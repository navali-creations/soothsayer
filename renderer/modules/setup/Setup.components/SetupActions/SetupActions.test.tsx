import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import SetupActions from "./SetupActions";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/main/modules/app-setup/AppSetup.types", () => ({
  SETUP_STEPS: {
    NOT_STARTED: 0,
    SELECT_GAME: 1,
    SELECT_LEAGUE: 2,
    SELECT_CLIENT_PATH: 3,
    TELEMETRY_CONSENT: 4,
  },
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUseBoundStore = vi.mocked(useBoundStore);

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
    validation: { isValid: true, errors: [] },
    isLoading: false,
    advanceStep: vi.fn(),
    goBack: vi.fn(),
    completeSetup: vi.fn(),
    ...overrides,
  } as any;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SetupActions", () => {
  beforeEach(() => {
    mockUseBoundStore.mockReturnValue({ setup: createMockStore() } as any);
  });

  // ── Button rendering ───────────────────────────────────────────────────

  describe("button rendering", () => {
    it("renders both Next and Back buttons", () => {
      renderWithProviders(<SetupActions />);

      expect(screen.getByText("Next")).toBeInTheDocument();
      expect(screen.getByText("Back")).toBeInTheDocument();
    });
  });

  // ── Back button behavior ───────────────────────────────────────────────

  describe("Back button", () => {
    it("is invisible on the first step (SELECT_GAME, step 1)", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      } as any);

      renderWithProviders(<SetupActions />);

      const backButton = screen.getByText("Back").closest("button");
      expect(backButton).toHaveClass("invisible");
    });

    it("is visible on later steps", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          setupState: {
            currentStep: 2,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      } as any);

      renderWithProviders(<SetupActions />);

      const backButton = screen.getByText("Back").closest("button");
      expect(backButton).not.toHaveClass("invisible");
    });

    it("is visible on step 3", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          setupState: {
            currentStep: 3,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      } as any);

      renderWithProviders(<SetupActions />);

      const backButton = screen.getByText("Back").closest("button");
      expect(backButton).not.toHaveClass("invisible");
    });

    it("is disabled on first step", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      } as any);

      renderWithProviders(<SetupActions />);

      const backButton = screen.getByText("Back").closest("button");
      expect(backButton).toBeDisabled();
    });

    it("calls goBack when clicked", async () => {
      const goBack = vi.fn();
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          setupState: {
            currentStep: 2,
            isComplete: false,
            selectedGames: ["poe1"],
          },
          goBack,
        }),
      } as any);

      const { user } = renderWithProviders(<SetupActions />);

      const backButton = screen.getByText("Back").closest("button")!;
      await user.click(backButton);

      expect(goBack).toHaveBeenCalledTimes(1);
    });

    it("is disabled when isLoading is true", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          setupState: {
            currentStep: 2,
            isComplete: false,
            selectedGames: ["poe1"],
          },
          isLoading: true,
        }),
      } as any);

      renderWithProviders(<SetupActions />);

      const backButton = screen.getByText("Back").closest("button");
      expect(backButton).toBeDisabled();
    });
  });

  // ── Next button behavior ───────────────────────────────────────────────

  describe("Next button", () => {
    it("shows 'Next' text on non-last steps", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          setupState: {
            currentStep: 1,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      } as any);

      renderWithProviders(<SetupActions />);

      expect(screen.getByText("Next")).toBeInTheDocument();
      expect(screen.queryByText("Finish")).not.toBeInTheDocument();
    });

    it("calls advanceStep when clicked on non-last step", async () => {
      const advanceStep = vi.fn();
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          setupState: {
            currentStep: 2,
            isComplete: false,
            selectedGames: ["poe1"],
          },
          advanceStep,
        }),
      } as any);

      const { user } = renderWithProviders(<SetupActions />);

      const nextButton = screen.getByText("Next").closest("button")!;
      await user.click(nextButton);

      expect(advanceStep).toHaveBeenCalledTimes(1);
    });

    it("shows 'Finish' on the last step (TELEMETRY_CONSENT, step 4)", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          setupState: {
            currentStep: 4,
            isComplete: false,
            selectedGames: ["poe1"],
          },
        }),
      } as any);

      renderWithProviders(<SetupActions />);

      expect(screen.getByText("Finish")).toBeInTheDocument();
      expect(screen.queryByText("Next")).not.toBeInTheDocument();
    });

    it("calls completeSetup when Finish is clicked on the last step", async () => {
      const completeSetup = vi.fn();
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          setupState: {
            currentStep: 4,
            isComplete: false,
            selectedGames: ["poe1"],
          },
          completeSetup,
        }),
      } as any);

      const { user } = renderWithProviders(<SetupActions />);

      const finishButton = screen.getByText("Finish").closest("button")!;
      await user.click(finishButton);

      expect(completeSetup).toHaveBeenCalledTimes(1);
    });

    it("does not call advanceStep when Finish is clicked", async () => {
      const advanceStep = vi.fn();
      const completeSetup = vi.fn();
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          setupState: {
            currentStep: 4,
            isComplete: false,
            selectedGames: ["poe1"],
          },
          advanceStep,
          completeSetup,
        }),
      } as any);

      const { user } = renderWithProviders(<SetupActions />);

      const finishButton = screen.getByText("Finish").closest("button")!;
      await user.click(finishButton);

      expect(advanceStep).not.toHaveBeenCalled();
      expect(completeSetup).toHaveBeenCalledTimes(1);
    });

    it("is disabled when validation is invalid", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          validation: { isValid: false, errors: ["Some field is missing"] },
        }),
      } as any);

      renderWithProviders(<SetupActions />);

      const nextButton = screen.getByText("Next").closest("button");
      expect(nextButton).toBeDisabled();
    });

    it("is enabled when validation is valid", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          validation: { isValid: true, errors: [] },
        }),
      } as any);

      renderWithProviders(<SetupActions />);

      const nextButton = screen.getByText("Next").closest("button");
      expect(nextButton).not.toBeDisabled();
    });

    it("is enabled when validation is null (no validation result yet)", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          validation: null,
        }),
      } as any);

      renderWithProviders(<SetupActions />);

      const nextButton = screen.getByText("Next").closest("button");
      expect(nextButton).not.toBeDisabled();
    });

    it("is disabled when isLoading is true", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          isLoading: true,
        }),
      } as any);

      renderWithProviders(<SetupActions />);

      // The button now shows "Loading..." text instead of "Next"
      const loadingButton = screen.getByText("Loading...").closest("button");
      expect(loadingButton).toBeDisabled();
    });
  });

  // ── Loading state ──────────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows loading spinner and 'Loading...' text when isLoading is true", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          isLoading: true,
        }),
      } as any);

      renderWithProviders(<SetupActions />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();

      const spinner = document.querySelector(".loading-spinner");
      expect(spinner).toBeInTheDocument();
    });

    it("does not show loading text when isLoading is false", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          isLoading: false,
        }),
      } as any);

      renderWithProviders(<SetupActions />);

      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    it("shows loading instead of 'Finish' on last step when loading", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({
          setupState: {
            currentStep: 4,
            isComplete: false,
            selectedGames: ["poe1"],
          },
          isLoading: true,
        }),
      } as any);

      renderWithProviders(<SetupActions />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
      expect(screen.queryByText("Finish")).not.toBeInTheDocument();
    });
  });

  // ── Edge case: null setupState ─────────────────────────────────────────

  describe("edge cases", () => {
    it("handles null setupState by defaulting to step 0", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({ setupState: null }),
      } as any);

      renderWithProviders(<SetupActions />);

      // With currentStep defaulting to 0, isFirstStep would be false (step 0 !== step 1)
      // and isLastStep would also be false, so Next should be shown
      expect(screen.getByText("Next")).toBeInTheDocument();
    });
  });
});
