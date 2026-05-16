import { act, renderHook } from "@testing-library/react";

import { useBoundStore } from "~/renderer/store";

import { useStartAppPerformanceCapture } from "./useStartAppPerformanceCapture";

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("useStartAppPerformanceCapture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBoundStore.getState().reset();
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
  });

  it("starts diagnostics before navigating to the live capture", async () => {
    const { result } = renderHook(() => useStartAppPerformanceCapture());

    await act(async () => {
      await result.current();
    });

    expect(window.electron.appPerformance.startCapture).toHaveBeenCalledTimes(
      1,
    );
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/app-performance/live" });
    expect(useBoundStore.getState().appPerformance.isStartingCapture).toBe(
      false,
    );
  });

  it("navigates without starting a second capture when already sampling", async () => {
    useBoundStore.setState(({ appPerformance }) => {
      appPerformance.isSampling = true;
    });
    const { result } = renderHook(() => useStartAppPerformanceCapture());

    await act(async () => {
      await result.current();
    });

    expect(window.electron.appPerformance.startCapture).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/app-performance/live" });
    expect(useBoundStore.getState().appPerformance.isStartingCapture).toBe(
      false,
    );
  });
});
