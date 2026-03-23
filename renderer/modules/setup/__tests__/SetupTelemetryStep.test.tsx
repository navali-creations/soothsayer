import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import SetupTelemetryStep from "../Setup.components/SetupTelemetryStep";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUseBoundStore = vi.mocked(useBoundStore);

function setupMock(overrides: { hydrate?: ReturnType<typeof vi.fn> } = {}) {
  const hydrateMock = overrides.hydrate ?? vi.fn();

  mockUseBoundStore.mockImplementation((selector?: any) => {
    const state = {
      settings: { hydrate: hydrateMock },
    } as any;
    return selector ? selector(state) : state;
  });

  return { hydrateMock };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SetupTelemetryStep", () => {
  beforeEach(() => {
    setupMock();
  });

  // ── Heading and description ────────────────────────────────────────────

  describe("heading and description", () => {
    it("renders the 'Privacy & Telemetry' heading", () => {
      renderWithProviders(<SetupTelemetryStep />);

      expect(screen.getByText("Privacy & Telemetry")).toBeInTheDocument();
    });

    it("renders the description about anonymous data collection", () => {
      renderWithProviders(<SetupTelemetryStep />);

      expect(
        screen.getByText(
          /Soothsayer collects anonymous data to help us improve the app/,
        ),
      ).toBeInTheDocument();
    });
  });

  // ── Crash Reporting section ────────────────────────────────────────────

  describe("Crash Reporting section", () => {
    it("renders the Crash Reporting heading", () => {
      renderWithProviders(<SetupTelemetryStep />);

      expect(screen.getByText("Crash Reporting")).toBeInTheDocument();
    });

    it("shows the Sentry badge", () => {
      renderWithProviders(<SetupTelemetryStep />);

      expect(screen.getByText("Sentry")).toBeInTheDocument();
    });

    it("describes what crash reporting collects", () => {
      renderWithProviders(<SetupTelemetryStep />);

      expect(
        screen.getByText(
          /anonymous error report is sent so we can find and fix bugs quickly/,
        ),
      ).toBeInTheDocument();
    });

    it("shows privacy reassurance about no personal data", () => {
      renderWithProviders(<SetupTelemetryStep />);

      expect(
        screen.getByText(
          /No usernames, file paths, or IP addresses are stored/,
        ),
      ).toBeInTheDocument();
    });
  });

  // ── Usage Analytics section ────────────────────────────────────────────

  describe("Usage Analytics section", () => {
    it("renders the Usage Analytics heading", () => {
      renderWithProviders(<SetupTelemetryStep />);

      expect(screen.getByText("Usage Analytics")).toBeInTheDocument();
    });

    it("shows the Umami badge", () => {
      renderWithProviders(<SetupTelemetryStep />);

      expect(screen.getByText("Umami")).toBeInTheDocument();
    });

    it("describes what usage analytics collects", () => {
      renderWithProviders(<SetupTelemetryStep />);

      expect(
        screen.getByText(
          /Anonymous page views and feature usage help us understand/,
        ),
      ).toBeInTheDocument();
    });

    it("shows privacy reassurance about no personal data", () => {
      renderWithProviders(<SetupTelemetryStep />);

      expect(
        screen.getByText(
          /No personal data is collected\. We see aggregated counts/,
        ),
      ).toBeInTheDocument();
    });
  });

  // ── Opt-out info ───────────────────────────────────────────────────────

  describe("opt-out info", () => {
    it("shows opt-out information text", () => {
      renderWithProviders(<SetupTelemetryStep />);

      expect(
        screen.getByText(
          /Both are enabled by default\. You can opt out of either at any time/,
        ),
      ).toBeInTheDocument();
    });

    it("mentions Settings → Privacy & Telemetry for opt-out", () => {
      renderWithProviders(<SetupTelemetryStep />);

      expect(
        screen.getByText("Settings → Privacy & Telemetry"),
      ).toBeInTheDocument();
    });
  });

  // ── Privacy Policy link ────────────────────────────────────────────────

  describe("privacy policy link", () => {
    it("shows a link to the Privacy Policy", () => {
      renderWithProviders(<SetupTelemetryStep />);

      const link = screen.getByRole("link", { name: /Privacy Policy/i });
      expect(link).toBeInTheDocument();
    });

    it("has the correct Privacy Policy URL", () => {
      renderWithProviders(<SetupTelemetryStep />);

      const link = screen.getByRole("link", { name: /Privacy Policy/i });
      expect(link).toHaveAttribute(
        "href",
        "https://github.com/navali-creations/soothsayer/blob/master/PRIVACY.md",
      );
    });

    it("opens the Privacy Policy link in a new tab", () => {
      renderWithProviders(<SetupTelemetryStep />);

      const link = screen.getByRole("link", { name: /Privacy Policy/i });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  // ── Hydrate on mount ──────────────────────────────────────────────────

  describe("hydrate on mount", () => {
    it("calls hydrate() on mount", () => {
      const hydrateMock = vi.fn();
      setupMock({ hydrate: hydrateMock });

      renderWithProviders(<SetupTelemetryStep />);

      expect(hydrateMock).toHaveBeenCalledTimes(1);
    });

    it("does not call hydrate again on re-render when hydrate reference is stable", () => {
      const hydrateMock = vi.fn();
      setupMock({ hydrate: hydrateMock });

      const { rerender } = renderWithProviders(<SetupTelemetryStep />);
      rerender(<SetupTelemetryStep />);

      expect(hydrateMock).toHaveBeenCalledTimes(1);
    });
  });
});
