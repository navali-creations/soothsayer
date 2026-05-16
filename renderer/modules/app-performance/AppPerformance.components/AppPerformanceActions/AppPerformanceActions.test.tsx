import type { ButtonHTMLAttributes } from "react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { AppPerformanceActions } from "./AppPerformanceActions";

const mockNavigate = vi.hoisted(() => vi.fn());
const mockAppPerformance = vi.hoisted(() => ({
  captureId: null as string | null,
  captureStoppedAt: null as string | null,
  exportReport: vi.fn(),
  isExporting: false,
  isSampling: false,
  stopCapture: vi.fn(),
}));
const mockGetState = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("~/renderer/store", () => ({
  useAppPerformanceShallow: (selector: any) => selector(mockAppPerformance),
  useBoundStore: {
    getState: mockGetState,
  },
}));

vi.mock("~/renderer/components", () => {
  return {
    AnimatedStopIcon: () => <span data-testid="stop-icon" />,
    BackButton: ({ fallback }: { fallback: string }) => (
      <button type="button">Back to {fallback}</button>
    ),
    Button: ({
      children,
      loading,
      ...props
    }: ButtonHTMLAttributes<HTMLButtonElement> & {
      loading?: boolean;
    }) => (
      <button type="button" {...props}>
        {loading ? "Loading " : null}
        {children}
      </button>
    ),
  };
});

describe("AppPerformanceActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAppPerformance.captureId = null;
    mockAppPerformance.captureStoppedAt = null;
    mockAppPerformance.isExporting = false;
    mockAppPerformance.isSampling = false;
    mockAppPerformance.exportReport.mockResolvedValue(undefined);
    mockAppPerformance.stopCapture.mockResolvedValue(undefined);
    mockGetState.mockReturnValue({
      appPerformance: {
        captureId: "capture-stopped",
      },
    });
  });

  it("renders a stop action while diagnostics are running and navigates to the stopped capture", async () => {
    mockAppPerformance.isSampling = true;
    const { user } = renderWithProviders(<AppPerformanceActions />);

    await user.click(screen.getByRole("button", { name: /Stop diagnostics/i }));

    expect(mockAppPerformance.stopCapture).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/app-performance/$captureId",
      params: { captureId: "capture-stopped" },
      replace: true,
    });
    expect(screen.getByTestId("stop-icon")).toBeInTheDocument();
  });

  it("stops diagnostics without navigation when no capture remains selected", async () => {
    mockAppPerformance.isSampling = true;
    mockGetState.mockReturnValue({
      appPerformance: {
        captureId: null,
      },
    });
    const { user } = renderWithProviders(<AppPerformanceActions />);

    await user.click(screen.getByRole("button", { name: /Stop diagnostics/i }));

    expect(mockAppPerformance.stopCapture).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("renders only the back action when there is nothing exportable", () => {
    renderWithProviders(<AppPerformanceActions />);

    expect(
      screen.getByRole("button", { name: "Back to /app-performance" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Export report/i }),
    ).not.toBeInTheDocument();
  });

  it("exports stopped captures", async () => {
    mockAppPerformance.captureId = "capture-1";
    mockAppPerformance.captureStoppedAt = "2024-05-04T00:01:00.000Z";
    const { user } = renderWithProviders(<AppPerformanceActions />);

    await user.click(screen.getByRole("button", { name: /Export report/i }));

    expect(mockAppPerformance.exportReport).toHaveBeenCalledTimes(1);
  });

  it("shows export loading state", () => {
    mockAppPerformance.captureId = "capture-1";
    mockAppPerformance.captureStoppedAt = "2024-05-04T00:01:00.000Z";
    mockAppPerformance.isExporting = true;

    renderWithProviders(<AppPerformanceActions />);

    expect(
      screen.getByRole("button", { name: /Loading Export report/i }),
    ).toBeInTheDocument();
  });
});
