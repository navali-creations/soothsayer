import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import SettingsPage from "./Settings.page";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

vi.mock("../Settings.components", () => ({
  AppHelpCard: () => <div data-testid="app-help-card" />,
  AudioSettingsCard: () => <div data-testid="audio-settings-card" />,
  DangerZoneCard: () => <div data-testid="danger-zone-card" />,
  ExportSettingsCard: () => <div data-testid="export-settings-card" />,
  FilePathSettingCard: ({ category }: any) => (
    <div data-testid="file-path-card" data-title={category?.title} />
  ),
  FilterSettingsCard: () => <div data-testid="filter-settings-card" />,
  OverlaySettingsCard: () => <div data-testid="overlay-settings-card" />,
  PrivacySettingsCard: () => <div data-testid="privacy-settings-card" />,
  SettingsCategoryCard: ({ category }: any) => (
    <div data-testid="settings-category-card" data-title={category?.title} />
  ),
  StorageSettingsCard: () => <div data-testid="storage-settings-card" />,
}));

vi.mock("../Settings.utils/Settings.utils", () => ({
  createGamePathsCategory: vi.fn(() => ({
    title: "Game Configuration",
    description: "Configure paths to your Path of Exile client logs",
    settings: [],
  })),
  createAppBehaviorCategory: vi.fn(() => ({
    title: "Application Behavior",
    description: "Customize how the application behaves",
    settings: [],
  })),
  handleSelectFile: vi.fn(),
}));

vi.mock("~/renderer/components", () => ({
  Grid: Object.assign(
    ({ children, ...props }: any) => (
      <div data-testid="grid" {...props}>
        {children}
      </div>
    ),
    {
      Col: ({ children }: any) => <div data-testid="grid-col">{children}</div>,
    },
  ),
  PageContainer: Object.assign(
    ({ children }: any) => <div data-testid="page-container">{children}</div>,
    {
      Header: ({ title, subtitle }: any) => (
        <div data-testid="page-header">
          <span data-testid="page-title">{title}</span>
          {subtitle && <span data-testid="page-subtitle">{subtitle}</span>}
        </div>
      ),
      Content: ({ children }: any) => (
        <div data-testid="page-content">{children}</div>
      ),
    },
  ),
}));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockSettings = {
  isLoading: false,
  updateSetting: vi.fn(),
  poe1ClientTxtPath: "/path/to/poe1",
  poe2ClientTxtPath: "/path/to/poe2",
  appExitAction: "exit" as const,
  appOpenAtLogin: false,
  appOpenAtLoginMinimized: false,
  selectedGame: "poe1" as const,
  poe1SelectedLeague: "Standard",
  poe2SelectedLeague: "Standard",
};

function setupStore(overrides: Partial<typeof mockSettings> = {}) {
  const settings = { ...mockSettings, ...overrides };

  mockUseBoundStore.mockImplementation((selector?: any) => {
    const state = { settings } as any;
    return selector ? selector(state) : state;
  });

  return settings;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SettingsPage", () => {
  beforeEach(() => {
    setupStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────────────────

  it("shows loading spinner when isLoading is true", () => {
    setupStore({ isLoading: true });
    renderWithProviders(<SettingsPage />);

    const spinner = document.querySelector(".loading-spinner");
    expect(spinner).toBeInTheDocument();
    expect(screen.queryByTestId("page-title")).not.toBeInTheDocument();
  });

  it("does not show loading spinner when isLoading is false", () => {
    setupStore({ isLoading: false });
    renderWithProviders(<SettingsPage />);

    const spinner = document.querySelector(".loading-spinner");
    expect(spinner).not.toBeInTheDocument();
  });

  // ── Page structure ─────────────────────────────────────────────────────

  it('renders page title "Settings" when loaded', () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByTestId("page-title")).toHaveTextContent("Settings");
  });

  it("renders page subtitle when loaded", () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByTestId("page-subtitle")).toHaveTextContent(
      "Configure your application preferences and game paths",
    );
  });

  it("renders the PageContainer", () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByTestId("page-container")).toBeInTheDocument();
  });

  it("renders the Grid", () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByTestId("grid")).toBeInTheDocument();
  });

  // ── Settings cards ─────────────────────────────────────────────────────

  it("renders all 10 settings cards", () => {
    renderWithProviders(<SettingsPage />);

    expect(screen.getByTestId("file-path-card")).toBeInTheDocument();
    expect(screen.getByTestId("settings-category-card")).toBeInTheDocument();
    expect(screen.getByTestId("filter-settings-card")).toBeInTheDocument();
    expect(screen.getByTestId("audio-settings-card")).toBeInTheDocument();
    expect(screen.getByTestId("export-settings-card")).toBeInTheDocument();
    expect(screen.getByTestId("overlay-settings-card")).toBeInTheDocument();
    expect(screen.getByTestId("app-help-card")).toBeInTheDocument();
    expect(screen.getByTestId("storage-settings-card")).toBeInTheDocument();
    expect(screen.getByTestId("privacy-settings-card")).toBeInTheDocument();
    expect(screen.getByTestId("danger-zone-card")).toBeInTheDocument();
  });

  it("renders 10 grid columns for the cards", () => {
    renderWithProviders(<SettingsPage />);

    const cols = screen.getAllByTestId("grid-col");
    expect(cols).toHaveLength(10);
  });

  it("passes gamePaths category to FilePathSettingCard", () => {
    renderWithProviders(<SettingsPage />);

    const filePathCard = screen.getByTestId("file-path-card");
    expect(filePathCard).toHaveAttribute("data-title", "Game Configuration");
  });

  it("passes appBehavior category to SettingsCategoryCard", () => {
    renderWithProviders(<SettingsPage />);

    const categoryCard = screen.getByTestId("settings-category-card");
    expect(categoryCard).toHaveAttribute("data-title", "Application Behavior");
  });

  // ── Loading state does not render settings ─────────────────────────────

  it("does not render settings cards when loading", () => {
    setupStore({ isLoading: true });
    renderWithProviders(<SettingsPage />);

    expect(screen.queryByTestId("file-path-card")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("settings-category-card"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("filter-settings-card"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("audio-settings-card")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("export-settings-card"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("overlay-settings-card"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("app-help-card")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("storage-settings-card"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("privacy-settings-card"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("danger-zone-card")).not.toBeInTheDocument();
  });
});
