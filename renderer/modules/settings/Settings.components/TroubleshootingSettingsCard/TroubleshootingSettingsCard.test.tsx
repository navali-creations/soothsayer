import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import TroubleshootingSettingsCard from "./TroubleshootingSettingsCard";

const mockSettings = vi.hoisted(() => ({
  appPerformanceAutoStartOnSession: false,
  appPerformanceMonitorEnabled: true,
  appPerformanceRetention: "7d",
  updateSetting: vi.fn(),
}));
const mockAppPerformance = vi.hoisted(() => ({
  setMonitorEnabled: vi.fn(),
  setRetentionPolicy: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useSettings: () => mockSettings,
  useAppPerformanceShallow: (selector: any) => selector(mockAppPerformance),
}));

describe("TroubleshootingSettingsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings.appPerformanceAutoStartOnSession = false;
    mockSettings.appPerformanceMonitorEnabled = true;
    mockSettings.appPerformanceRetention = "7d";
    mockSettings.updateSetting.mockResolvedValue(undefined);
    mockAppPerformance.setMonitorEnabled.mockResolvedValue(undefined);
    mockAppPerformance.setRetentionPolicy.mockResolvedValue(undefined);
    window.electron.diagLog.revealLogFile.mockResolvedValue({
      success: true,
      path: "C:\\logs\\diag.log",
    });
  });

  it("opens the diagnostic log file", async () => {
    const { user } = renderWithProviders(<TroubleshootingSettingsCard />);

    await user.click(screen.getByRole("button", { name: /Open log file/i }));

    expect(window.electron.diagLog.revealLogFile).toHaveBeenCalledTimes(1);
  });

  it("updates feature visibility and clears session auto-start when disabling the feature", async () => {
    mockSettings.appPerformanceAutoStartOnSession = true;
    const { user } = renderWithProviders(<TroubleshootingSettingsCard />);

    await user.click(
      screen.getByRole("checkbox", {
        name: "Show App Performance feature",
      }),
    );

    expect(mockAppPerformance.setMonitorEnabled).toHaveBeenCalledWith(false);
    expect(mockSettings.updateSetting).toHaveBeenCalledWith(
      "appPerformanceAutoStartOnSession",
      false,
    );
  });

  it("updates retention and session auto-start when the feature is enabled", async () => {
    const { user } = renderWithProviders(<TroubleshootingSettingsCard />);

    await user.selectOptions(
      screen.getByLabelText("Keep diagnostics captures"),
      "24h",
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: "Start diagnostics with sessions",
      }),
    );

    expect(mockAppPerformance.setRetentionPolicy).toHaveBeenCalledWith("24h");
    expect(mockSettings.updateSetting).toHaveBeenCalledWith(
      "appPerformanceAutoStartOnSession",
      true,
    );
  });

  it("disables dependent controls when the feature is hidden", () => {
    mockSettings.appPerformanceMonitorEnabled = false;

    renderWithProviders(<TroubleshootingSettingsCard />);

    expect(screen.getByLabelText("Keep diagnostics captures")).toBeDisabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Start diagnostics with sessions",
      }),
    ).toBeDisabled();
  });
});
