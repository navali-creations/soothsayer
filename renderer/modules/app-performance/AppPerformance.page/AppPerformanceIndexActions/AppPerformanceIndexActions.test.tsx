import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import { AppPerformanceIndexActions } from "./AppPerformanceIndexActions";

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("AppPerformanceIndexActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    useBoundStore.getState().reset();
  });

  it("switches index views and starts delete mode from the menu", async () => {
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.captureHistoryTotal = 1;
    });
    const { user } = renderWithProviders(<AppPerformanceIndexActions />);

    await user.click(screen.getByLabelText("Trends"));

    expect(useBoundStore.getState().appPerformance.indexView).toBe("trends");

    await user.click(
      screen.getByRole("button", { name: "More App Performance actions" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete captures" }));

    expect(useBoundStore.getState().appPerformance.deleteMode).toBe(true);
    expect(useBoundStore.getState().appPerformance.indexView).toBe("captures");
  });

  it("starts diagnostics from the store action", async () => {
    window.electron.appPerformance.startCapture.mockResolvedValue({
      capture: {
        id: "capture-1",
        startedAt: "2024-05-04T00:00:00.000Z",
        stoppedAt: null,
      },
      isSampling: true,
      samples: [],
      routeMarkers: [],
    });
    const { user } = renderWithProviders(<AppPerformanceIndexActions />);

    await user.click(
      screen.getByRole("button", { name: /start diagnostics/i }),
    );

    expect(window.electron.appPerformance.startCapture).toHaveBeenCalledTimes(
      1,
    );
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/app-performance/live" });
  });
});
