import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
  FiExternalLink: () => <span data-testid="icon-external-link" />,
  FiShield: () => <span data-testid="icon-shield" />,
  FiX: () => <span data-testid="icon-x" />,
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
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (
      this: HTMLDialogElement,
    ) {
      this.removeAttribute("open");
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  it("renders privacy controls without a section title", () => {
    renderWithProviders(<PrivacySettingsCard />);

    expect(
      screen.queryByRole("heading", { name: /Privacy & Telemetry/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Crash Reporting")).toBeInTheDocument();
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

  it("shows linked GGG account section when community uploads are enabled", () => {
    setupStore({
      communityUploadsEnabled: true,
      gggAuthenticated: true,
      gggUsername: "TestUser",
      authError: "Auth failed",
    });
    renderWithProviders(<PrivacySettingsCard />);

    expect(
      screen.queryByText("Uploading without a linked account"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("TestUser")).toBeInTheDocument();
    expect(screen.getByText("Unlink")).toBeInTheDocument();
    expect(screen.queryByText("Auth failed")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Link GGG Account/i }),
    ).not.toBeInTheDocument();
  });

  it("shows reassuring GGG account link copy when account is not linked", () => {
    setupStore({
      communityUploadsEnabled: true,
      gggAuthenticated: false,
    });
    renderWithProviders(<PrivacySettingsCard />);

    expect(
      screen.getByText("Uploading without a linked account"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /link your Path of Exile account to show your community drop data as verified/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Soothsayer can only see your account name and account ID/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No character, stash, item, trade, password, or email/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("icon-external-link")).toBeInTheDocument();
  });

  it("opens a confirmation modal before starting GGG account linking", async () => {
    const { user } = renderWithProviders(<PrivacySettingsCard />);

    await user.click(screen.getByRole("button", { name: /Link GGG Account/i }));

    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(
      screen.getByText("This opens the official Path of Exile website."),
    ).toBeInTheDocument();
    expect(screen.getByText("Your account name")).toBeInTheDocument();
    expect(screen.getByText("Your account ID")).toBeInTheDocument();
    expect(screen.getByText("Your stash tabs or items")).toBeInTheDocument();
  });

  it("starts GGG account linking after confirmation", async () => {
    const { user } = renderWithProviders(<PrivacySettingsCard />);

    await user.click(screen.getByRole("button", { name: /Link GGG Account/i }));
    await user.click(
      screen.getByRole("button", { name: /Continue to Path of Exile/i }),
    );

    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });

  it("cancels GGG account linking from the confirmation modal", async () => {
    const { user } = renderWithProviders(<PrivacySettingsCard />);

    await user.click(screen.getByRole("button", { name: /Link GGG Account/i }));
    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    expect(mockAuthenticate).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.queryByText("This opens the official Path of Exile website."),
      ).not.toBeInTheDocument();
    });
  });

  it("fetches GGG status by default", () => {
    renderWithProviders(<PrivacySettingsCard />);

    expect(mockFetchStatus).toHaveBeenCalledTimes(1);
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
