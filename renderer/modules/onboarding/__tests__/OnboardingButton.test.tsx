import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { OnboardingButton } from "../OnboardingButton";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

vi.mock("~/renderer/components/Button/Button", () => ({
  default: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("react-icons/fa", () => ({
  FaRedo: () => <span data-testid="icon-redo" />,
}));

// ─── Window.location.reload mock ───────────────────────────────────────────

const reloadMock = vi.fn();
Object.defineProperty(window, "location", {
  value: { ...window.location, reload: reloadMock },
  writable: true,
});

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockResetAll = vi.fn().mockResolvedValue(undefined);

function setupStore() {
  mockUseBoundStore.mockImplementation((selector?: any) => {
    const state = {
      onboarding: {
        resetAll: mockResetAll,
      },
    } as any;
    return selector ? selector(state) : state;
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("OnboardingButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  // ── Button variant (default) ───────────────────────────────────────────

  it('renders "Reset Tour" text in button variant (default)', () => {
    renderWithProviders(<OnboardingButton />);

    expect(screen.getByText("Reset Tour")).toBeInTheDocument();
  });

  it('renders button with data-onboarding="onboarding-button" attribute', () => {
    renderWithProviders(<OnboardingButton />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-onboarding", "onboarding-button");
  });

  it("clicking calls resetAll() then window.location.reload()", async () => {
    const { user } = renderWithProviders(<OnboardingButton />);

    const button = screen.getByRole("button");
    await user.click(button);

    await waitFor(() => {
      expect(mockResetAll).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(reloadMock).toHaveBeenCalledTimes(1);
    });

    // resetAll should be called before reload
    const resetOrder = mockResetAll.mock.invocationCallOrder[0];
    const reloadOrder = reloadMock.mock.invocationCallOrder[0];
    expect(resetOrder).toBeLessThan(reloadOrder);
  });

  it('shows "Resetting..." text while resetting', async () => {
    // Make resetAll hang so we can observe the intermediate state
    let resolveReset!: () => void;
    mockResetAll.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveReset = resolve;
      }),
    );

    const { user } = renderWithProviders(<OnboardingButton />);

    const button = screen.getByRole("button");
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("Resetting...")).toBeInTheDocument();
    });

    // Cleanup: resolve the pending promise
    resolveReset();
  });

  it("button is disabled while resetting", async () => {
    let resolveReset!: () => void;
    mockResetAll.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveReset = resolve;
      }),
    );

    const { user } = renderWithProviders(<OnboardingButton />);

    const button = screen.getByRole("button");
    await user.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    // Cleanup
    resolveReset();
  });

  // ── Icon variant ───────────────────────────────────────────────────────

  it("in icon variant, renders circle button without text", () => {
    renderWithProviders(<OnboardingButton variant="icon" />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(screen.queryByText("Reset Tour")).not.toBeInTheDocument();
    expect(screen.queryByText("Resetting...")).not.toBeInTheDocument();
  });

  it('in icon variant, has title "Reset Onboarding Tour"', () => {
    renderWithProviders(<OnboardingButton variant="icon" />);

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("title", "Reset Onboarding Tour");
  });
});
