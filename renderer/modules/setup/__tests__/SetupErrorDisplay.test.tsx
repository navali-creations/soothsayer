import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import SetupErrorDisplay from "../Setup.components/SetupErrorDisplay";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUseBoundStore = vi.mocked(useBoundStore);

function createMockStore(overrides: Record<string, unknown> = {}) {
  return {
    setup: {
      error: null,
      ...overrides,
    },
  } as any;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SetupErrorDisplay", () => {
  beforeEach(() => {
    mockUseBoundStore.mockReturnValue(createMockStore());
  });

  // ── No error state ─────────────────────────────────────────────────────

  describe("when there is no error", () => {
    it("renders nothing when error is null", () => {
      mockUseBoundStore.mockReturnValue(createMockStore({ error: null }));

      const { container } = renderWithProviders(<SetupErrorDisplay />);

      expect(container.innerHTML).toBe("");
    });

    it("does not render an alert role element", () => {
      mockUseBoundStore.mockReturnValue(createMockStore({ error: null }));

      renderWithProviders(<SetupErrorDisplay />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  // ── Error state ────────────────────────────────────────────────────────

  describe("when there is an error", () => {
    it("renders an alert when error exists", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({ error: "Something went wrong" }),
      );

      renderWithProviders(<SetupErrorDisplay />);

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
    });

    it("has error styling on the alert", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({ error: "Something went wrong" }),
      );

      renderWithProviders(<SetupErrorDisplay />);

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("alert-error");
    });

    it("displays the error message text", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({ error: "Something went wrong" }),
      );

      renderWithProviders(<SetupErrorDisplay />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("displays a different error message", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({ error: "Failed to save settings" }),
      );

      renderWithProviders(<SetupErrorDisplay />);

      expect(screen.getByText("Failed to save settings")).toBeInTheDocument();
    });

    it("renders an error icon SVG", () => {
      mockUseBoundStore.mockReturnValue(
        createMockStore({ error: "Network error" }),
      );

      renderWithProviders(<SetupErrorDisplay />);

      const alert = screen.getByRole("alert");
      const svg = alert.querySelector("svg");
      expect(svg).toBeInTheDocument();
    });
  });

  // ── Transition between states ──────────────────────────────────────────

  describe("state transitions", () => {
    it("shows alert when error changes from null to a message", () => {
      // First render: no error
      mockUseBoundStore.mockReturnValue(createMockStore({ error: null }));
      const { rerender } = renderWithProviders(<SetupErrorDisplay />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      // Update mock to return an error
      mockUseBoundStore.mockReturnValue(
        createMockStore({ error: "New error occurred" }),
      );
      rerender(<SetupErrorDisplay />);

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("New error occurred")).toBeInTheDocument();
    });

    it("hides alert when error changes from a message to null", () => {
      // First render: with error
      mockUseBoundStore.mockReturnValue(
        createMockStore({ error: "Some error" }),
      );
      const { rerender } = renderWithProviders(<SetupErrorDisplay />);
      expect(screen.getByRole("alert")).toBeInTheDocument();

      // Update mock to clear error
      mockUseBoundStore.mockReturnValue(createMockStore({ error: null }));
      rerender(<SetupErrorDisplay />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
