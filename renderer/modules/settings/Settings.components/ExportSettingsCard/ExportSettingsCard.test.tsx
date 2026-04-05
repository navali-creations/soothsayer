import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { useSettings } from "~/renderer/store";

import ExportSettingsCard from "./ExportSettingsCard";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useSettings: vi.fn(),
}));

const mockUseSettings = vi.mocked(useSettings);

vi.mock("~/main/utils/mask-path", () => ({
  maskPath: vi.fn((_path: string) => "***masked***"),
}));

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock("react-icons/fi", () => ({
  FiDownload: () => <span data-testid="icon-download" />,
  FiEye: () => <span data-testid="icon-eye" />,
  FiEyeOff: () => <span data-testid="icon-eye-off" />,
  FiFolder: () => <span data-testid="icon-folder" />,
  FiRotateCcw: () => <span data-testid="icon-rotate" />,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const mockUpdateSetting = vi.fn().mockResolvedValue(undefined);

function setupStore(overrides: { csvExportPath?: string | null } = {}) {
  const settings = {
    csvExportPath: overrides.csvExportPath ?? null,
    updateSetting: mockUpdateSetting,
  };

  mockUseSettings.mockReturnValue(settings as any);

  return settings;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("ExportSettingsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  it('renders "Export" title', () => {
    renderWithProviders(<ExportSettingsCard />);

    expect(
      screen.getByRole("heading", { name: /Export/i }),
    ).toBeInTheDocument();
  });

  it("shows default placeholder when no custom path is set", () => {
    setupStore({ csvExportPath: null });
    renderWithProviders(<ExportSettingsCard />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("");
    expect(input).toHaveAttribute(
      "placeholder",
      "Desktop/soothsayer-exports (default)",
    );
  });

  it("shows masked path when csvExportPath is set", () => {
    setupStore({ csvExportPath: "/home/user/my-exports" });
    renderWithProviders(<ExportSettingsCard />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("***masked***");
  });

  // ── Reveal / hide toggle ───────────────────────────────────────────────

  it("toggle reveal shows full path", async () => {
    setupStore({ csvExportPath: "/home/user/my-exports" });
    const { user } = renderWithProviders(<ExportSettingsCard />);

    // Click the reveal button
    const revealButton = screen.getByTitle("Reveal full path");
    await user.click(revealButton);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("/home/user/my-exports");
  });

  it("toggle reveal back hides path (shows masked)", async () => {
    setupStore({ csvExportPath: "/home/user/my-exports" });
    const { user } = renderWithProviders(<ExportSettingsCard />);

    // Click reveal
    const revealButton = screen.getByTitle("Reveal full path");
    await user.click(revealButton);

    // Verify full path is shown
    expect(screen.getByRole("textbox")).toHaveValue("/home/user/my-exports");

    // Click hide
    const hideButton = screen.getByTitle("Hide full path");
    await user.click(hideButton);

    // Verify masked path is shown again
    expect(screen.getByRole("textbox")).toHaveValue("***masked***");
  });

  // ── Directory selection ────────────────────────────────────────────────

  it("clicking folder button calls window.electron.selectFile", async () => {
    window.electron.selectFile = vi.fn().mockResolvedValue(null);
    const { user } = renderWithProviders(<ExportSettingsCard />);

    // The folder button has the FiFolder icon inside a Button with variant="primary"
    const folderButton = screen.getByTestId("icon-folder").closest("button")!;
    await user.click(folderButton);

    expect(window.electron.selectFile).toHaveBeenCalledWith({
      title: "Select CSV Export Folder",
      properties: ["openDirectory"],
    });
  });

  it("after selecting a directory, calls updateSetting with the path", async () => {
    window.electron.selectFile = vi
      .fn()
      .mockResolvedValue("/home/user/new-exports");
    const { user } = renderWithProviders(<ExportSettingsCard />);

    const folderButton = screen.getByTestId("icon-folder").closest("button")!;
    await user.click(folderButton);

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith(
        "csvExportPath",
        "/home/user/new-exports",
      );
    });
  });

  it("does nothing if selectFile returns null/undefined", async () => {
    window.electron.selectFile = vi.fn().mockResolvedValue(null);
    const { user } = renderWithProviders(<ExportSettingsCard />);

    const folderButton = screen.getByTestId("icon-folder").closest("button")!;
    await user.click(folderButton);

    await waitFor(() => {
      expect(window.electron.selectFile).toHaveBeenCalled();
    });

    expect(mockUpdateSetting).not.toHaveBeenCalled();
  });

  // ── Reset button ───────────────────────────────────────────────────────

  it("reset button calls updateSetting with null", async () => {
    setupStore({ csvExportPath: "/home/user/my-exports" });
    const { user } = renderWithProviders(<ExportSettingsCard />);

    const resetButton = screen.getByRole("button", {
      name: /Reset to default/i,
    });
    await user.click(resetButton);

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith("csvExportPath", null);
    });
  });

  it("reset button is only visible when custom path exists", () => {
    setupStore({ csvExportPath: null });
    renderWithProviders(<ExportSettingsCard />);

    expect(
      screen.queryByRole("button", { name: /Reset to default/i }),
    ).not.toBeInTheDocument();
  });

  it("reset button is visible when custom path exists", () => {
    setupStore({ csvExportPath: "/home/user/my-exports" });
    renderWithProviders(<ExportSettingsCard />);

    expect(
      screen.getByRole("button", { name: /Reset to default/i }),
    ).toBeInTheDocument();
  });
});
