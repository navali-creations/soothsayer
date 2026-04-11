import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import SetupErrorDisplay from "./SetupErrorDisplay";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUseBoundStore = vi.mocked(useBoundStore);

function createMockStore(overrides: Record<string, unknown> = {}) {
  return {
    error: null,
    ...overrides,
  } as any;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SetupErrorDisplay", () => {
  beforeEach(() => {
    mockUseBoundStore.mockReturnValue({ setup: createMockStore() } as any);
  });

  // ── No error state ─────────────────────────────────────────────────────

  describe("when there is no error", () => {
    it("renders nothing when error is null", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({ error: null }),
      } as any);

      const { container } = renderWithProviders(<SetupErrorDisplay />);

      expect(container.innerHTML).toBe("");
    });

    it("does not render an alert role element", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({ error: null }),
      } as any);

      renderWithProviders(<SetupErrorDisplay />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  // ── Error state ────────────────────────────────────────────────────────

  describe("when there is an error", () => {
    it("renders an alert when error exists", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({ error: "Something went wrong" }),
      } as any);

      renderWithProviders(<SetupErrorDisplay />);

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
    });

    it("has error styling on the alert", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({ error: "Something went wrong" }),
      } as any);

      renderWithProviders(<SetupErrorDisplay />);

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("alert-error");
    });

    it("displays the error message text", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({ error: "Something went wrong" }),
      } as any);

      renderWithProviders(<SetupErrorDisplay />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("displays a different error message", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({ error: "Failed to save settings" }),
      } as any);

      renderWithProviders(<SetupErrorDisplay />);

      expect(screen.getByText("Failed to save settings")).toBeInTheDocument();
    });

    it("renders an error icon SVG", () => {
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({ error: "Network error" }),
      } as any);

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
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({ error: null }),
      } as any);
      const { rerender } = renderWithProviders(<SetupErrorDisplay />);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();

      // Update mock to return an error
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({ error: "New error occurred" }),
      } as any);
      rerender(<SetupErrorDisplay />);

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("New error occurred")).toBeInTheDocument();
    });

    it("hides alert when error changes from a message to null", () => {
      // First render: with error
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({ error: "Some error" }),
      } as any);
      const { rerender } = renderWithProviders(<SetupErrorDisplay />);
      expect(screen.getByRole("alert")).toBeInTheDocument();

      // Update mock to clear error
      mockUseBoundStore.mockReturnValue({
        setup: createMockStore({ error: null }),
      } as any);
      rerender(<SetupErrorDisplay />);

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
