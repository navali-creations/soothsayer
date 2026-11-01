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

vi.mock("react-icons/fi", () => ({
  FiAlertTriangle: () => <span data-testid="icon-alert-triangle" />,
  FiInfo: () => <span data-testid="icon-info" />,
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
    communityUploadsEnabled?: boolean;
    gggAuthenticated?: boolean;
    gggUsername?: string | null;
    isAuthenticating?: boolean;
    isUnlinking?: boolean;
    authError?: string | null;
    uploadWarning?: "verification-required" | "account-mismatch";
  } = {},
) {
  const settings = {
    telemetryCrashReporting: overrides.telemetryCrashReporting ?? true,
    communityUploadsEnabled: overrides.communityUploadsEnabled ?? true,
    updateSetting: mockUpdateSetting,
  };

  const communityUpload = {
    gggAuthenticated: overrides.gggAuthenticated ?? false,
    gggUsername: overrides.gggUsername ?? null,
    isAuthenticating: overrides.isAuthenticating ?? false,
    isUnlinking: overrides.isUnlinking ?? false,
    authError: overrides.authError ?? null,
    authenticate: mockAuthenticate,
    logout: mockLogout,
    fetchStatus: mockFetchStatus,
    dropContextUploadStatus: {
      pendingEvents: 0,
      isUploading: false,
      revision: 1,
      uploadWarning: overrides.uploadWarning,
    },
  };

  mockUseBoundStore.mockReturnValue({ settings, communityUpload } as any);

  return settings;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PrivacySettingsCard", () => {
  it("shows the paused-upload explanation beside the account controls", () => {
    setupStore({ uploadWarning: "verification-required" });
    renderWithProviders(<PrivacySettingsCard />);
    expect(
      screen.getByRole("alert", { name: "Community uploads paused" }),
    ).toHaveTextContent("Link the GGG account previously used to verify");
    expect(
      screen.getByRole("button", { name: "Link GGG Account" }),
    ).toBeEnabled();
  });

  it("disables Unlink while switching upload identities", () => {
    setupStore({
      gggAuthenticated: true,
      gggUsername: "TestUser",
      isUnlinking: true,
    });
    renderWithProviders(<PrivacySettingsCard />);
    expect(screen.getByRole("button", { name: "Unlink" })).toBeDisabled();
  });

  it("shows unlink failures while the account remains linked", () => {
    setupStore({
      gggAuthenticated: true,
      gggUsername: "TestUser",
      authError: "Community data could not be unlinked",
    });
    renderWithProviders(<PrivacySettingsCard />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Community data could not be unlinked",
    );
    expect(screen.getByRole("button", { name: "Unlink" })).toBeEnabled();
  });
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

  // ── Community uploads toggle ─────────────────────────────────────────

  it("toggling community uploads calls updateSetting", async () => {
    setupStore({ communityUploadsEnabled: true });
    const { user } = renderWithProviders(<PrivacySettingsCard />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);

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
    await user.click(checkboxes[1]);

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
    expect(screen.getByRole("alert")).toHaveTextContent("Auth failed");
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
    ).toHaveTextContent(/^Link your Path of Exile account/);
    expect(
      screen.getByText(
        /Soothsayer can only see your account name and account ID/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No character, stash, item, trade, password, or email/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("icon-external-link")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "If you choose to verify your data, we associate it with your GGG account.",
      ),
    ).not.toBeInTheDocument();
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

  it("discloses location and coarse local-time community data", () => {
    renderWithProviders(<PrivacySettingsCard />);

    expect(screen.getByText(/in-game area where/)).toBeInTheDocument();
    expect(
      screen.getByText(/local minute of day, UTC offset/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Exact dates and timestamps stay on your device/),
    ).toBeInTheDocument();
  });

  // ── Privacy notices ────────────────────────────────────────────────────

  it("explains community identifiers in an info alert and scopes the restart note to crash reporting", () => {
    renderWithProviders(<PrivacySettingsCard />);
    const info = screen.getByRole("note", { name: "Community data sharing" });
    expect(info).toHaveTextContent(
      "we store a random upload ID with your uploads",
    );
    expect(info).toHaveTextContent(
      "If you verify your data, we associate future uploads with your GGG account",
    );
    expect(
      screen.getByText(
        "If you verify your data, we associate future uploads with your GGG account.",
      ).tagName,
    ).toBe("P");
    const restart = screen.getByText(
      "Changes take effect after restarting the app.",
    );
    expect(restart.tagName).toBe("P");
    expect(restart.closest("label")).toHaveTextContent("Crash Reporting");
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
