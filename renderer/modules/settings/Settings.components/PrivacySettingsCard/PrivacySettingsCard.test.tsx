import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PrivacySettingsCard from "./PrivacySettingsCard";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

const mockUseBoundStore = vi.mocked(useBoundStore);

vi.mock("~/renderer/components", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/renderer/components")>();
  return {
    ...actual,
    Link: ({ children, to, ...props }: any) => (
      <a href={to} data-testid="privacy-link" {...props}>
        {children}
      </a>
    ),
  };
});

const mockTrackEvent = vi.fn();
vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: (...args: any[]) => mockTrackEvent(...args),
}));

vi.mock("react-icons/fi", () => ({
  FiAlertTriangle: () => <span data-testid="icon-alert-triangle" />,
  FiInfo: () => <span data-testid="icon-info" />,
  FiShield: () => <span data-testid="icon-shield" />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUpdateSetting = vi.fn().mockResolvedValue(undefined);

const mockAuthenticate = vi.fn();
const mockLogout = vi.fn();
const mockFetchStatus = vi.fn();

function setupStore(
  overrides: {
    telemetryCrashReporting?: boolean;
    telemetryUsageAnalytics?: boolean;
    communityUploadsEnabled?: boolean;
    gggAuthenticated?: boolean;
    gggUsername?: string | null;
    isAuthenticating?: boolean;
    authError?: string | null;
  } = {},
) {
  const settings = {
    telemetryCrashReporting: overrides.telemetryCrashReporting ?? true,
    telemetryUsageAnalytics: overrides.telemetryUsageAnalytics ?? true,
    communityUploadsEnabled: overrides.communityUploadsEnabled ?? true,
    updateSetting: mockUpdateSetting,
  };

  const communityUpload = {
    gggAuthenticated: overrides.gggAuthenticated ?? false,
    gggUsername: overrides.gggUsername ?? null,
    isAuthenticating: overrides.isAuthenticating ?? false,
    authError: overrides.authError ?? null,
    authenticate: mockAuthenticate,
    logout: mockLogout,
    fetchStatus: mockFetchStatus,
  };

  mockUseBoundStore.mockReturnValue({ settings, communityUpload } as any);

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

  // ── Community uploads toggle ─────────────────────────────────────────

  it("toggling community uploads calls updateSetting and trackEvent", async () => {
    setupStore({ communityUploadsEnabled: true });
    const { user } = renderWithProviders(<PrivacySettingsCard />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[2]);

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "communityUploadsEnabled",
        false,
      );
    });
  });

  it("enabling community uploads passes true to updateSetting", async () => {
    setupStore({ communityUploadsEnabled: false });
    const { user } = renderWithProviders(<PrivacySettingsCard />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[2]);

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "communityUploadsEnabled",
        true,
      );
    });
  });

  // ── GGG account link/unlink ──────────────────────────────────────────

  it("shows GGG authenticated state with username and Unlink button", () => {
    setupStore({
      communityUploadsEnabled: true,
      gggAuthenticated: true,
      gggUsername: "TestUser",
    });
    renderWithProviders(<PrivacySettingsCard />);

    expect(screen.getByText("TestUser")).toBeInTheDocument();
    expect(screen.getByText("Unlink")).toBeInTheDocument();
  });

  it("shows anonymous upload state with Link GGG Account button when not authenticated", () => {
    setupStore({ communityUploadsEnabled: true, gggAuthenticated: false });
    renderWithProviders(<PrivacySettingsCard />);

    expect(screen.getByText("Uploading anonymously")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Link GGG Account/i }),
    ).toBeInTheDocument();
  });

  it("calls authenticate when Link GGG Account button is clicked", async () => {
    setupStore({ communityUploadsEnabled: true, gggAuthenticated: false });
    const { user } = renderWithProviders(<PrivacySettingsCard />);

    await user.click(screen.getByRole("button", { name: /Link GGG Account/i }));

    expect(mockAuthenticate).toHaveBeenCalled();
  });

  it("calls logout when Unlink button is clicked", async () => {
    setupStore({
      communityUploadsEnabled: true,
      gggAuthenticated: true,
      gggUsername: "TestUser",
    });
    const { user } = renderWithProviders(<PrivacySettingsCard />);

    await user.click(screen.getByText("Unlink"));

    expect(mockLogout).toHaveBeenCalled();
  });

  it("shows auth error message when authError is set", () => {
    setupStore({
      communityUploadsEnabled: true,
      gggAuthenticated: false,
      authError: "Auth failed",
    });
    renderWithProviders(<PrivacySettingsCard />);

    expect(screen.getByText("Auth failed")).toBeInTheDocument();
  });

  it("disables Link GGG Account button when isAuthenticating is true", () => {
    setupStore({
      communityUploadsEnabled: true,
      gggAuthenticated: false,
      isAuthenticating: true,
    });
    renderWithProviders(<PrivacySettingsCard />);

    expect(
      screen.getByRole("button", { name: /Link GGG Account/i }),
    ).toBeDisabled();
  });

  it("does not show GGG section when community uploads are disabled", () => {
    setupStore({ communityUploadsEnabled: false });
    renderWithProviders(<PrivacySettingsCard />);

    expect(screen.queryByText("Uploading anonymously")).not.toBeInTheDocument();
    expect(screen.queryByText("Unlink")).not.toBeInTheDocument();
  });

  it("renders Community Drop Rates toggle", () => {
    renderWithProviders(<PrivacySettingsCard />);

    expect(screen.getByText("Community Drop Rates")).toBeInTheDocument();
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

  it("tracks settings-privacy-policy-viewed when privacy policy link is clicked", async () => {
    const { user } = renderWithProviders(<PrivacySettingsCard />);

    const link = screen.getByTestId("privacy-link");
    await user.click(link);

    expect(mockTrackEvent).toHaveBeenCalledWith(
      "settings-privacy-policy-viewed",
    );
  });
});
