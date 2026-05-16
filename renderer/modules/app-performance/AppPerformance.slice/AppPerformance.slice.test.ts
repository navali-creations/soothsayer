import { describe, expect, it } from "vitest";

import { createTestStore } from "~/renderer/__test-setup__/test-store";

import type {
  AppPerformanceCaptureHistoryDTO,
  AppPerformanceCaptureSummaryDTO,
  AppPerformanceSampleDTO,
  AppPerformanceStateDTO,
} from "../AppPerformance.types";
import { normalizeAppPerformanceRoute } from "./AppPerformance.slice";

const requestAnimationFrameSpy = vi.hoisted(() => vi.fn(() => 1));
const cancelAnimationFrameSpy = vi.hoisted(() => vi.fn());
const rafCallbacks = vi.hoisted(() => [] as FrameRequestCallback[]);

function metricSummary(
  min: number | null,
  avg: number | null,
  max: number | null,
) {
  return { min, avg, max };
}

function captureSummary(
  overrides: Partial<AppPerformanceCaptureSummaryDTO> = {},
): AppPerformanceCaptureSummaryDTO {
  return {
    id: "capture-1",
    startedAt: "2024-05-04T00:00:00.000Z",
    stoppedAt: "2024-05-04T00:01:00.000Z",
    durationMs: 60_000,
    sampleCount: 3,
    routeMarkerCount: 1,
    estimatedSizeBytes: 2048,
    fps: metricSummary(30, 60, 60),
    cpu: metricSummary(1, 2, 3),
    memory: metricSummary(1, 2, 3),
    systemMemory: metricSummary(60, 65, 70),
    appMemoryBytes: metricSummary(1024, 2048, 4096),
    sparklineSamples: [],
    comparison: {
      fps: { min: null, avg: null, max: null },
      cpu: { min: null, avg: null, max: null },
      memory: { min: null, avg: null, max: null },
      appMemoryBytes: { min: null, avg: null, max: null },
    },
    ...overrides,
  };
}

function sample(
  overrides: Partial<AppPerformanceSampleDTO> = {},
): AppPerformanceSampleDTO {
  return {
    sampledAt: "2024-05-04T00:00:00.000Z",
    uptimeMs: 1000,
    captureElapsedMs: 1000,
    route: "/current-session",
    fps: 60,
    systemCpuPercent: 12,
    appCpuPercent: 2,
    systemMemoryUsedPercent: 70,
    systemMemoryTotalBytes: 16 * 1024 ** 3,
    systemMemoryFreeBytes: 4 * 1024 ** 3,
    appMemoryBytes: 512 * 1024 ** 2,
    appMemoryPercent: 3,
    mainHeapUsedBytes: 128 * 1024 ** 2,
    rendererMemoryBytes: 256 * 1024 ** 2,
    rendererHeapUsedBytes: 64 * 1024 ** 2,
    ...overrides,
  };
}

function activeState(
  overrides: Partial<AppPerformanceStateDTO> = {},
): AppPerformanceStateDTO {
  return {
    capture: {
      id: "capture-active",
      startedAt: "2024-05-04T00:00:00.000Z",
      stoppedAt: null,
    },
    isSampling: true,
    samples: [sample()],
    routeMarkers: [
      {
        id: "marker-1",
        route: "/current-session",
        label: "/current-session",
        markedAt: "2024-05-04T00:00:00.000Z",
        elapsedMs: 0,
      },
    ],
    ...overrides,
  };
}

function history(
  captures: AppPerformanceCaptureSummaryDTO[] = [captureSummary()],
): AppPerformanceCaptureHistoryDTO {
  return {
    captures,
    total: captures.length,
    page: 1,
    pageSize: 5,
    totalPages: 1,
  };
}

beforeEach(() => {
  rafCallbacks.length = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    rafCallbacks.push(callback);
    return requestAnimationFrameSpy(callback);
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(
    cancelAnimationFrameSpy,
  );
  requestAnimationFrameSpy.mockClear();
  cancelAnimationFrameSpy.mockClear();
});

describe("normalizeAppPerformanceRoute", () => {
  it.each([
    ["/", "/current-session"],
    ["/cards", "/cards"],
    ["/cards/the-doctor", "/cards/:id"],
    ["/sessions", "/sessions"],
    ["/sessions/session-1", "/sessions/:id"],
    ["/statistics", "/statistics"],
    ["/profit-forecast", "/profit-forecast"],
    ["/rarity-insights", "/rarity-insights"],
    ["/settings", "/settings"],
    ["/app-performance", "/app-performance"],
    ["/app-performance/live", "/app-performance/live"],
    ["/app-performance/capture-1", "/app-performance/:id"],
  ])("maps %s to %s", (route, label) => {
    expect(normalizeAppPerformanceRoute(route)).toEqual({ route, label });
  });

  it("keeps unknown route labels as pathnames", () => {
    expect(normalizeAppPerformanceRoute("/setup/game-client")).toEqual({
      route: "/setup/game-client",
      label: "/setup/game-client",
    });
  });
});

describe("AppPerformanceSlice", () => {
  it("hydrates current state, loads first history page, and starts FPS loop when sampling", async () => {
    const store = createTestStore();
    window.electron.appPerformance.getState.mockResolvedValue(activeState());
    window.electron.appPerformance.listCaptures.mockResolvedValue(history());

    await store.getState().appPerformance.hydrate();

    expect(store.getState().appPerformance.captureId).toBe("capture-active");
    expect(store.getState().appPerformance.captureHistory).toHaveLength(1);
    expect(requestAnimationFrameSpy).toHaveBeenCalled();

    store.getState().appPerformance.startListening()();
  });

  it("stores hydrate errors", async () => {
    const store = createTestStore();
    window.electron.appPerformance.getState.mockRejectedValue(
      new Error("IPC offline"),
    );

    await store.getState().appPerformance.hydrate();

    expect(store.getState().appPerformance.error).toBe("IPC offline");
  });

  it("listens for state, sample, and route-marker events and cleans them up", async () => {
    const store = createTestStore();
    const cleanupState = vi.fn();
    const cleanupSample = vi.fn();
    const cleanupMarker = vi.fn();
    window.electron.appPerformance.onStateChanged.mockReturnValue(cleanupState);
    window.electron.appPerformance.onSampleAdded.mockReturnValue(cleanupSample);
    window.electron.appPerformance.onRouteMarkerAdded.mockReturnValue(
      cleanupMarker,
    );
    window.electron.appPerformance.listCaptures.mockResolvedValue(history());

    const cleanup = store.getState().appPerformance.startListening();
    const stateHandler =
      window.electron.appPerformance.onStateChanged.mock.calls[0][0];
    const sampleHandler =
      window.electron.appPerformance.onSampleAdded.mock.calls[0][0];
    const markerHandler =
      window.electron.appPerformance.onRouteMarkerAdded.mock.calls[0][0];

    stateHandler(activeState());
    sampleHandler(sample({ sampledAt: "event-sample", captureElapsedMs: 2 }));
    markerHandler({
      id: "event-marker",
      route: "/settings",
      label: "/settings",
      markedAt: "2024-05-04T00:00:02.000Z",
      elapsedMs: 2,
    });

    expect(store.getState().appPerformance.isSampling).toBe(true);
    expect(requestAnimationFrameSpy).toHaveBeenCalled();
    expect(store.getState().appPerformance.samples.at(-1)?.sampledAt).toBe(
      "event-sample",
    );
    expect(store.getState().appPerformance.routeMarkers.at(-1)?.id).toBe(
      "event-marker",
    );

    stateHandler({
      capture: null,
      isSampling: false,
      samples: [],
      routeMarkers: [],
    });
    cleanup();

    expect(cleanupState).toHaveBeenCalled();
    expect(cleanupSample).toHaveBeenCalled();
    expect(cleanupMarker).toHaveBeenCalled();
    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
  });

  it("starts the FPS loop immediately when listening to an active capture", () => {
    const store = createTestStore();
    store.getState().appPerformance.applyState(activeState());

    const cleanup = store.getState().appPerformance.startListening();

    expect(requestAnimationFrameSpy).toHaveBeenCalled();

    cleanup();
  });

  it("starts and stops captures through IPC", async () => {
    const store = createTestStore();
    window.electron.appPerformance.startCapture.mockResolvedValue(
      activeState(),
    );
    window.electron.appPerformance.stopCapture.mockResolvedValue(
      activeState({
        capture: {
          id: "capture-active",
          startedAt: "2024-05-04T00:00:00.000Z",
          stoppedAt: "2024-05-04T00:01:00.000Z",
        },
        isSampling: false,
      }),
    );
    window.electron.appPerformance.listCaptures.mockResolvedValue(history());

    await store.getState().appPerformance.startCapture();
    expect(store.getState().appPerformance.isSampling).toBe(true);

    await store.getState().appPerformance.stopCapture();
    expect(store.getState().appPerformance.isSampling).toBe(false);
    expect(window.electron.storage.getInfo).toHaveBeenCalled();
  });

  it("records start and stop errors", async () => {
    const store = createTestStore();
    window.electron.appPerformance.startCapture.mockRejectedValue(
      new Error("start failed"),
    );
    window.electron.appPerformance.stopCapture.mockRejectedValue(
      new Error("stop failed"),
    );

    await store.getState().appPerformance.startCapture();
    expect(store.getState().appPerformance.error).toBe("start failed");

    await store.getState().appPerformance.stopCapture();
    expect(store.getState().appPerformance.error).toBe("stop failed");
  });

  it("loads capture history and records load errors", async () => {
    const store = createTestStore();
    window.electron.appPerformance.listCaptures.mockResolvedValue(
      history([captureSummary({ id: "capture-2" })]),
    );

    await store.getState().appPerformance.loadCaptureHistory(2);

    expect(window.electron.appPerformance.listCaptures).toHaveBeenCalledWith({
      page: 2,
      pageSize: 5,
    });
    expect(store.getState().appPerformance.captureHistory[0].id).toBe(
      "capture-2",
    );

    window.electron.appPerformance.listCaptures.mockRejectedValue(
      new Error("history failed"),
    );

    await store.getState().appPerformance.loadCaptureHistory();

    expect(store.getState().appPerformance.isLoadingHistory).toBe(false);
    expect(store.getState().appPerformance.error).toBe("history failed");
  });

  it("loads a capture and clears loading state", async () => {
    const store = createTestStore();
    window.electron.appPerformance.getCaptureState.mockResolvedValue(
      activeState({
        capture: {
          id: "capture-2",
          startedAt: "2024-05-04T00:00:00.000Z",
          stoppedAt: "2024-05-04T00:01:00.000Z",
        },
        isSampling: false,
      }),
    );

    await store.getState().appPerformance.loadCapture("capture-2");

    expect(window.electron.appPerformance.getCaptureState).toHaveBeenCalledWith(
      "capture-2",
    );
    expect(store.getState().appPerformance.captureId).toBe("capture-2");
    expect(store.getState().appPerformance.isLoadingCapture).toBe(false);
  });

  it("loads active captures and records capture loading errors", async () => {
    const store = createTestStore();
    window.electron.appPerformance.getCaptureState.mockResolvedValue(
      activeState(),
    );

    await store.getState().appPerformance.loadCapture("capture-active");

    expect(requestAnimationFrameSpy).toHaveBeenCalled();

    window.electron.appPerformance.getCaptureState.mockRejectedValue(
      new Error("capture failed"),
    );

    await store.getState().appPerformance.loadCapture("missing-capture");

    expect(store.getState().appPerformance.isLoadingCapture).toBe(false);
    expect(store.getState().appPerformance.error).toBe("capture failed");

    store.getState().appPerformance.startListening()();
  });

  it("deletes a selected capture, reloads the previous page when needed, and clears selection state", async () => {
    const store = createTestStore();
    store.getState().appPerformance.applyState(
      activeState({
        capture: {
          id: "capture-1",
          startedAt: "2024-05-04T00:00:00.000Z",
          stoppedAt: "2024-05-04T00:01:00.000Z",
        },
        isSampling: false,
      }),
    );
    store.setState((state) => ({
      appPerformance: {
        ...state.appPerformance,
        captureHistory: [captureSummary()],
        captureHistoryPage: 2,
      },
    }));
    window.electron.appPerformance.deleteCapture.mockResolvedValue({
      success: true,
      deleted: true,
    });
    window.electron.appPerformance.listCaptures.mockResolvedValue(history([]));

    await store.getState().appPerformance.deleteCapture("capture-1");

    expect(store.getState().appPerformance.captureId).toBeNull();
    expect(window.electron.appPerformance.listCaptures).toHaveBeenCalledWith({
      page: 1,
      pageSize: 5,
    });
    expect(window.electron.storage.getInfo).toHaveBeenCalled();
  });

  it("records delete errors from IPC failures", async () => {
    const store = createTestStore();
    window.electron.appPerformance.deleteCapture.mockResolvedValue({
      success: false,
      error: "active capture",
    });

    await store.getState().appPerformance.deleteCapture("capture-1");

    expect(store.getState().appPerformance.deletingCaptureId).toBeNull();
    expect(store.getState().appPerformance.error).toBe("active capture");
  });

  it("bulk deletes selected captures through one IPC call", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      appPerformance: {
        ...state.appPerformance,
        captureHistory: [
          captureSummary({ id: "capture-1" }),
          captureSummary({ id: "capture-2" }),
        ],
        captureHistoryPage: 1,
        deleteMode: true,
        isDeleteConfirmOpen: true,
        selectedCaptureIds: ["capture-1", "capture-2"],
      },
    }));
    window.electron.appPerformance.deleteCaptures.mockResolvedValue({
      success: true,
      deletedCount: 2,
    });
    window.electron.appPerformance.listCaptures.mockResolvedValue(history([]));

    await store.getState().appPerformance.confirmBulkDelete();

    expect(window.electron.appPerformance.deleteCaptures).toHaveBeenCalledWith([
      "capture-1",
      "capture-2",
    ]);
    expect(window.electron.appPerformance.deleteCapture).not.toHaveBeenCalled();
    expect(store.getState().appPerformance.deleteMode).toBe(false);
    expect(store.getState().appPerformance.isDeleteConfirmOpen).toBe(false);
    expect(store.getState().appPerformance.selectedCaptureIds).toEqual([]);
    expect(window.electron.storage.getInfo).toHaveBeenCalled();
  });

  it("keeps bulk delete selection when main rejects the batch", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      appPerformance: {
        ...state.appPerformance,
        deleteMode: true,
        isDeleteConfirmOpen: true,
        isBulkDeleting: false,
        selectedCaptureIds: ["active-capture"],
      },
    }));
    window.electron.appPerformance.deleteCaptures.mockResolvedValue({
      success: false,
      error: "Stop diagnostics before deleting selected captures.",
    });

    await store.getState().appPerformance.confirmBulkDelete();

    expect(window.electron.appPerformance.listCaptures).not.toHaveBeenCalled();
    expect(store.getState().appPerformance.deleteMode).toBe(true);
    expect(store.getState().appPerformance.isDeleteConfirmOpen).toBe(true);
    expect(store.getState().appPerformance.selectedCaptureIds).toEqual([
      "active-capture",
    ]);
    expect(store.getState().appPerformance.deleteError).toBe(
      "Stop diagnostics before deleting selected captures.",
    );
    expect(store.getState().appPerformance.isBulkDeleting).toBe(false);
  });

  it("handles delete mode selection guards and empty bulk deletes", async () => {
    const store = createTestStore();
    store.setState((state) => ({
      appPerformance: {
        ...state.appPerformance,
        captureHistory: [
          captureSummary({ id: "capture-1" }),
          captureSummary({ id: "capture-2" }),
        ],
        deleteMode: true,
        selectedCaptureIds: ["capture-1", "capture-2"],
        isDeleteConfirmOpen: true,
      },
    }));

    store.getState().appPerformance.setIndexView("trends");
    expect(store.getState().appPerformance.indexView).toBe("captures");

    store.getState().appPerformance.toggleCaptureSelection("capture-1");
    expect(store.getState().appPerformance.selectedCaptureIds).toEqual([
      "capture-2",
    ]);

    store.getState().appPerformance.toggleCaptureSelection("capture-1");
    expect(store.getState().appPerformance.selectedCaptureIds).toEqual([
      "capture-2",
      "capture-1",
    ]);

    store.getState().appPerformance.toggleAllVisibleCaptureSelection();
    expect(store.getState().appPerformance.selectedCaptureIds).toEqual([]);

    store.setState((state) => ({
      appPerformance: {
        ...state.appPerformance,
        isDeleteConfirmOpen: true,
        isBulkDeleting: true,
      },
    }));
    store.getState().appPerformance.closeDeleteConfirm();
    expect(store.getState().appPerformance.isDeleteConfirmOpen).toBe(true);

    store.setState((state) => ({
      appPerformance: {
        ...state.appPerformance,
        isBulkDeleting: false,
      },
    }));
    store.getState().appPerformance.closeDeleteConfirm();
    expect(store.getState().appPerformance.isDeleteConfirmOpen).toBe(false);

    await store.getState().appPerformance.confirmBulkDelete();

    expect(
      window.electron.appPerformance.deleteCaptures,
    ).not.toHaveBeenCalled();
  });

  it("records route markers only while sampling and de-dupes identical routes", async () => {
    const store = createTestStore();

    await store.getState().appPerformance.recordRoute("/cards/the-doctor");
    expect(
      window.electron.appPerformance.recordRouteMarker,
    ).not.toHaveBeenCalled();

    store.getState().appPerformance.applyState(activeState());

    await store.getState().appPerformance.recordRoute("/cards/the-doctor");
    await store.getState().appPerformance.recordRoute("/cards/the-doctor");

    expect(
      window.electron.appPerformance.recordRouteMarker,
    ).toHaveBeenCalledTimes(1);
    expect(
      window.electron.appPerformance.recordRouteMarker,
    ).toHaveBeenCalledWith({
      route: "/cards/the-doctor",
      label: "/cards/:id",
    });
  });

  it("ignores route marker IPC errors after recording the local route key", async () => {
    const store = createTestStore();
    store.getState().appPerformance.applyState(activeState());
    window.electron.appPerformance.recordRouteMarker.mockRejectedValue(
      new Error("marker failed"),
    );

    await store.getState().appPerformance.recordRoute("/settings");

    expect(store.getState().appPerformance.lastRecordedRouteKey).toBe(
      "/settings|/settings",
    );
  });

  it("exports reports and stores canceled/errors without stale paths", async () => {
    const store = createTestStore();
    store.getState().appPerformance.applyState(
      activeState({
        capture: {
          id: "capture-1",
          startedAt: "2024-05-04T00:00:00.000Z",
          stoppedAt: "2024-05-04T00:01:00.000Z",
        },
        isSampling: false,
      }),
    );
    window.electron.appPerformance.exportReport.mockResolvedValue({
      success: true,
      fileName: "report.txt",
    });

    await store.getState().appPerformance.exportReport();

    expect(store.getState().appPerformance.lastExportFileName).toBe(
      "report.txt",
    );

    window.electron.appPerformance.exportReport.mockResolvedValue({
      success: false,
      canceled: true,
    });

    await store.getState().appPerformance.exportReport();

    expect(store.getState().appPerformance.lastExportFileName).toBeNull();
    expect(store.getState().appPerformance.error).toBeNull();

    window.electron.appPerformance.exportReport.mockRejectedValue(
      new Error("export failed"),
    );

    await store.getState().appPerformance.exportReport();

    expect(store.getState().appPerformance.error).toBe("export failed");
  });

  it("updates feature visibility and retention settings", async () => {
    const store = createTestStore();
    window.electron.appPerformance.listCaptures.mockResolvedValue(history());

    await store.getState().appPerformance.setMonitorEnabled(true);
    await store.getState().appPerformance.setRetentionPolicy("24h");

    expect(
      window.electron.appPerformance.applyRetentionCleanup,
    ).toHaveBeenCalledWith("24h");
  });

  it("stops a live capture before hiding the feature", async () => {
    const store = createTestStore();
    store.getState().appPerformance.applyState(activeState());
    window.electron.appPerformance.stopCapture.mockResolvedValue(
      activeState({
        capture: {
          id: "capture-active",
          startedAt: "2024-05-04T00:00:00.000Z",
          stoppedAt: "2024-05-04T00:01:00.000Z",
        },
        isSampling: false,
      }),
    );
    window.electron.appPerformance.listCaptures.mockResolvedValue(history());

    await store.getState().appPerformance.setMonitorEnabled(false);

    expect(window.electron.appPerformance.stopCapture).toHaveBeenCalledTimes(1);
    expect(
      window.electron.settings.set.mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      window.electron.appPerformance.stopCapture.mock.invocationCallOrder[0],
    );
    expect(window.electron.settings.set).toHaveBeenCalledWith(
      "appPerformanceMonitorEnabled",
      false,
    );
  });

  it("applies state, sample updates, marker updates, and focused chart changes", () => {
    const store = createTestStore();
    const first = sample({ sampledAt: "first", captureElapsedMs: 1 });
    const next = sample({ sampledAt: "next", captureElapsedMs: 2 });

    store.getState().appPerformance.applyState(
      activeState({
        samples: [first],
        routeMarkers: [],
      }),
    );
    store.getState().appPerformance.addSample(first);
    store.getState().appPerformance.addSample(next);
    store.getState().appPerformance.addRouteMarker({
      id: "marker-2",
      route: "/settings",
      label: "/settings",
      markedAt: "2024-05-04T00:00:02.000Z",
      elapsedMs: 2,
    });
    store.getState().appPerformance.addRouteMarker({
      id: "marker-2",
      route: "/settings",
      label: "/settings",
      markedAt: "2024-05-04T00:00:02.000Z",
      elapsedMs: 2,
    });
    store.getState().appPerformance.setFocusedChart("fps");

    expect(store.getState().appPerformance.samples).toHaveLength(2);
    expect(store.getState().appPerformance.routeMarkers).toHaveLength(1);
    expect(store.getState().appPerformance.focusedChart).toBe("fps");

    store.getState().appPerformance.applyState({
      capture: null,
      isSampling: false,
      samples: [],
      routeMarkers: [],
    });

    expect(store.getState().appPerformance.lastRecordedRouteKey).toBeNull();
  });

  it("keeps all capture samples in renderer state", () => {
    const store = createTestStore();
    const samples = Array.from({ length: 3_605 }, (_, index) =>
      sample({
        sampledAt: `sample-${index}`,
        captureElapsedMs: index * 1_000,
      }),
    );
    const next = sample({
      sampledAt: "sample-3605",
      captureElapsedMs: 3_605_000,
    });

    store.getState().appPerformance.applyState(
      activeState({
        samples,
        routeMarkers: [],
      }),
    );
    store.getState().appPerformance.addSample(next);

    expect(store.getState().appPerformance.samples).toHaveLength(3_606);
    expect(store.getState().appPerformance.samples[0].sampledAt).toBe(
      "sample-0",
    );
    expect(store.getState().appPerformance.samples.at(-1)?.sampledAt).toBe(
      "sample-3605",
    );
  });

  it("bounds very long renderer sample streams to the latest rolling window", () => {
    const store = createTestStore();
    const samples = Array.from({ length: 86_460 }, (_, index) =>
      sample({
        sampledAt: `sample-${index}`,
        captureElapsedMs: index * 1_000,
      }),
    );
    const next = sample({
      sampledAt: "sample-86460",
      captureElapsedMs: 86_460_000,
    });

    store.setState(({ appPerformance }) => {
      appPerformance.isSampling = true;
      appPerformance.samples = samples;
    });
    store.getState().appPerformance.addSample(next);

    expect(store.getState().appPerformance.samples).toHaveLength(86_400);
    expect(store.getState().appPerformance.samples[0].sampledAt).toBe(
      "sample-61",
    );
    expect(store.getState().appPerformance.samples.at(-1)?.sampledAt).toBe(
      "sample-86460",
    );
  });

  it("records renderer FPS metrics from the animation-frame loop", async () => {
    const store = createTestStore();
    Object.defineProperty(performance, "memory", {
      configurable: true,
      value: { usedJSHeapSize: 123_456 },
    });

    store.getState().appPerformance.applyState(activeState());
    const cleanup = store.getState().appPerformance.startListening();

    rafCallbacks[0]?.(performance.now() + 2_000);

    expect(
      window.electron.appPerformance.recordRendererMetrics,
    ).toHaveBeenCalledWith({
      fps: expect.any(Number),
      rendererHeapUsedBytes: 123_456,
    });

    cleanup();
  });

  it("records null FPS when the document is hidden and stops when sampling ends", () => {
    const store = createTestStore();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    Object.defineProperty(performance, "memory", {
      configurable: true,
      value: undefined,
    });

    store.getState().appPerformance.applyState(activeState());
    const cleanup = store.getState().appPerformance.startListening();

    rafCallbacks[0]?.(performance.now() + 2_000);

    expect(
      window.electron.appPerformance.recordRendererMetrics,
    ).toHaveBeenCalledWith({
      fps: null,
      rendererHeapUsedBytes: null,
    });

    store.getState().appPerformance.applyState({
      capture: null,
      isSampling: false,
      samples: [],
      routeMarkers: [],
    });
    rafCallbacks.at(-1)?.(performance.now() + 3_000);

    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    cleanup();
  });
});
