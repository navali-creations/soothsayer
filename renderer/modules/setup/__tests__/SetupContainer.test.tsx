import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import SetupContainer from "../Setup.components/SetupContainer";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("../Setup.components/SetupProgressBar", () => ({
  default: ({ currentStep }: any) => (
    <div data-testid="progress-bar" data-step={currentStep} />
  ),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUseBoundStore = vi.mocked(useBoundStore);

function createMockStore(overrides: any = {}) {
  return {
    setup: {
      setupState: {
        currentStep: 1,
        isComplete: false,
        selectedGames: ["poe1"],
        ...overrides.setupState,
      },
      ...overrides,
    },
  } as any;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SetupContainer", () => {
  beforeEach(() => {
    mockUseBoundStore.mockReturnValue(createMockStore());
  });

  // ── Renders children ─────────────────────────────────────────────────

  it("renders children content", () => {
    renderWithProviders(
      <SetupContainer>
        <div data-testid="child-content">Hello from child</div>
      </SetupContainer>,
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Hello from child")).toBeInTheDocument();
  });

  // ── Setup heading ────────────────────────────────────────────────────

  it('renders "Setup" heading', () => {
    renderWithProviders(
      <SetupContainer>
        <div />
      </SetupContainer>,
    );

    expect(screen.getByText("Setup")).toBeInTheDocument();
  });

  // ── Progress bar ─────────────────────────────────────────────────────

  it("renders SetupProgressBar with the correct current step", () => {
    mockUseBoundStore.mockReturnValue(
      createMockStore({ setupState: { currentStep: 3 } }),
    );

    renderWithProviders(
      <SetupContainer>
        <div />
      </SetupContainer>,
    );

    const progressBar = screen.getByTestId("progress-bar");
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute("data-step", "3");
  });

  it("renders SetupProgressBar with step 1 by default", () => {
    renderWithProviders(
      <SetupContainer>
        <div />
      </SetupContainer>,
    );

    const progressBar = screen.getByTestId("progress-bar");
    expect(progressBar).toHaveAttribute("data-step", "1");
  });

  // ── Null setupState edge case ────────────────────────────────────────

  it("defaults to step 1 when setupState is null", () => {
    mockUseBoundStore.mockReturnValue(createMockStore({ setupState: null }));

    renderWithProviders(
      <SetupContainer>
        <div />
      </SetupContainer>,
    );

    const progressBar = screen.getByTestId("progress-bar");
    expect(progressBar).toHaveAttribute("data-step", "1");
  });
});
