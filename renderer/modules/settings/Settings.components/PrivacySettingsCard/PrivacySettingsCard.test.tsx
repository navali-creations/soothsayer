import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PrivacySettingsCard from "./PrivacySettingsCard";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

vi.mock("~/renderer/components", () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} data-testid="privacy-link" {...props}>
      {children}
    </a>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiAlertTriangle: () => <span data-testid="icon-alert-triangle" />,
  FiShield: () => <span data-testid="icon-shield" />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUpdateSetting = vi.fn().mockResolvedValue(undefined);

function setupStore(
  overrides: {
    telemetryCrashReporting?: boolean;
    telemetryUsageAnalytics?: boolean;
  } = {},
) {
  const settings = {
    telemetryCrashReporting: true,
    telemetryUsageAnalytics: true,
    updateSetting: mockUpdateSetting,
    ...overrides,
  };

  mockUseBoundStore.mockImplementation((selector?: any) => {
    const state = { settings } as any;
    return selector ? selector(state) : state;
  });

  return settings;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PrivacySettingsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  it('renders "Privacy & Telemetry" title', () => {
    renderWithProviders(<PrivacySettingsCard />);

    expect(
      screen.getByRole("heading", { name: /Privacy & Telemetry/i }),
    ).toBeInTheDocument();
  });

  it("renders Crash Reporting toggle", () => {
    renderWithProviders(<PrivacySettingsCard />);

    expect(screen.getByText("Crash Reporting")).toBeInTheDocument();
  });

  it("renders Usage Analytics toggle", () => {
    renderWithProviders(<PrivacySettingsCard />);

    expect(screen.getByText("Usage Analytics")).toBeInTheDocument();
  });

  // ── Toggle state reflects store ────────────────────────────────────────

  it("crash reporting toggle is checked when store value is true", () => {
    setupStore({ telemetryCrashReporting: true });
    renderWithProviders(<PrivacySettingsCard />);

    const checkboxes = screen.getAllByRole("checkbox");
    // First checkbox is crash reporting
    expect(checkboxes[0]).toBeChecked();
  });

  it("crash reporting toggle is unchecked when store value is false", () => {
    setupStore({ telemetryCrashReporting: false });
    renderWithProviders(<PrivacySettingsCard />);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[0]).not.toBeChecked();
  });

  it("usage analytics toggle is checked when store value is true", () => {
    setupStore({ telemetryUsageAnalytics: true });
    renderWithProviders(<PrivacySettingsCard />);

    const checkboxes = screen.getAllByRole("checkbox");
    // Second checkbox is usage analytics
    expect(checkboxes[1]).toBeChecked();
  });

  it("usage analytics toggle is unchecked when store value is false", () => {
    setupStore({ telemetryUsageAnalytics: false });
    renderWithProviders(<PrivacySettingsCard />);

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[1]).not.toBeChecked();
  });

  // ── Toggle interactions ────────────────────────────────────────────────

  it('toggling crash reporting calls updateSetting with "telemetryCrashReporting"', async () => {
    setupStore({ telemetryCrashReporting: true });
    const { user } = renderWithProviders(<PrivacySettingsCard />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "telemetryCrashReporting",
        false,
      );
    });
  });

  it('toggling usage analytics calls updateSetting with "telemetryUsageAnalytics"', async () => {
    setupStore({ telemetryUsageAnalytics: true });
    const { user } = renderWithProviders(<PrivacySettingsCard />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "telemetryUsageAnalytics",
        false,
      );
    });
  });

  it("enabling crash reporting passes true to updateSetting", async () => {
    setupStore({ telemetryCrashReporting: false });
    const { user } = renderWithProviders(<PrivacySettingsCard />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[0]);

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "telemetryCrashReporting",
        true,
      );
    });
  });

  it("enabling usage analytics passes true to updateSetting", async () => {
    setupStore({ telemetryUsageAnalytics: false });
    const { user } = renderWithProviders(<PrivacySettingsCard />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "telemetryUsageAnalytics",
        true,
      );
    });
  });

  // ── Restart warning ────────────────────────────────────────────────────

  it("shows restart warning alert", () => {
    renderWithProviders(<PrivacySettingsCard />);

    expect(
      screen.getByText("Changes take effect after restarting the app."),
    ).toBeInTheDocument();
  });

  // ── Privacy Policy link ────────────────────────────────────────────────

  it('shows Privacy Policy link pointing to "/privacy-policy"', () => {
    renderWithProviders(<PrivacySettingsCard />);

    const link = screen.getByTestId("privacy-link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/privacy-policy");
  });

  it("renders View text in the Privacy Policy link", () => {
    renderWithProviders(<PrivacySettingsCard />);

    const link = screen.getByTestId("privacy-link");
    expect(link).toHaveTextContent("View");
  });
});
