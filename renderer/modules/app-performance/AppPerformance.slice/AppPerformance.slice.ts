import type { StateCreator } from "zustand";

import type { BoundStore } from "~/renderer/store/store.types";

import type {
  AppPerformanceCaptureSummaryDTO,
  AppPerformanceChartKey,
  AppPerformanceIndexView,
  AppPerformanceRetention,
  AppPerformanceRouteMarkerDTO,
  AppPerformanceSampleDTO,
  AppPerformanceStateDTO,
} from "../AppPerformance.types";
import { normalizeAppPerformanceRoute } from "../AppPerformance.utils/AppPerformance.utils";

const MAX_RENDERER_MARKERS = 1_000;
const MAX_RENDERER_SAMPLE_POINTS = 86_400;
const RENDERER_SAMPLE_TRIM_BATCH_SIZE = 60;

interface AppPerformanceMetricStatsState {
  current: number | null;
  min: number | null;
  avg: number | null;
  max: number | null;
  count: number;
  sum: number;
}

type AppPerformanceMetricStatsByChart = Record<
  AppPerformanceChartKey,
  AppPerformanceMetricStatsState
>;

let fpsRafId: number | null = null;
let fpsLoopRunning = false;
let frameWindowStartedAt = 0;
let frameCount = 0;

export interface AppPerformanceSlice {
  appPerformance: {
    captureId: string | null;
    captureStartedAt: string | null;
    captureStoppedAt: string | null;
    isSampling: boolean;
    captureHistory: AppPerformanceCaptureSummaryDTO[];
    isLoadingHistory: boolean;
    captureHistoryPage: number;
    captureHistoryPageSize: number;
    captureHistoryTotal: number;
    captureHistoryTotalPages: number;
    isLoadingCapture: boolean;
    deletingCaptureId: string | null;
    samples: AppPerformanceSampleDTO[];
    metricStats: AppPerformanceMetricStatsByChart;
    routeMarkers: AppPerformanceRouteMarkerDTO[];
    focusedChart: AppPerformanceChartKey | null;
    indexView: AppPerformanceIndexView;
    deleteMode: boolean;
    selectedCaptureIds: string[];
    isDeleteConfirmOpen: boolean;
    deleteError: string | null;
    isBulkDeleting: boolean;
    isStartingCapture: boolean;
    isExporting: boolean;
    lastExportFileName: string | null;
    error: string | null;
    lastRecordedRouteKey: string | null;

    hydrate: () => Promise<void>;
    startListening: () => () => void;
    setMonitorEnabled: (enabled: boolean) => Promise<void>;
    setRetentionPolicy: (retention: AppPerformanceRetention) => Promise<void>;
    startCapture: () => Promise<void>;
    stopCapture: () => Promise<void>;
    loadCaptureHistory: (page?: number) => Promise<void>;
    loadCapture: (captureId: string) => Promise<void>;
    deleteCapture: (captureId: string) => Promise<void>;
    setIndexView: (view: AppPerformanceIndexView) => void;
    startDeleteMode: () => void;
    cancelDeleteMode: () => void;
    toggleCaptureSelection: (captureId: string) => void;
    toggleAllVisibleCaptureSelection: () => void;
    openDeleteConfirm: () => void;
    closeDeleteConfirm: () => void;
    confirmBulkDelete: () => Promise<void>;
    setStartingCapture: (isStarting: boolean) => void;
    recordRoute: (pathname: string) => Promise<void>;
    exportReport: () => Promise<void>;
    setFocusedChart: (chart: AppPerformanceChartKey | null) => void;
    applyState: (state: AppPerformanceStateDTO) => void;
    addSample: (sample: AppPerformanceSampleDTO) => void;
    addRouteMarker: (marker: AppPerformanceRouteMarkerDTO) => void;
  };
}

export const createAppPerformanceSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  AppPerformanceSlice
> = (set, get) => ({
  appPerformance: {
    captureId: null,
    captureStartedAt: null,
    captureStoppedAt: null,
    isSampling: false,
    captureHistory: [],
    isLoadingHistory: false,
    captureHistoryPage: 1,
    captureHistoryPageSize: 5,
    captureHistoryTotal: 0,
    captureHistoryTotalPages: 1,
    isLoadingCapture: false,
    deletingCaptureId: null,
    samples: [],
    metricStats: createEmptyMetricStatsByChart(),
    routeMarkers: [],
    focusedChart: null,
    indexView: "captures",
    deleteMode: false,
    selectedCaptureIds: [],
    isDeleteConfirmOpen: false,
    deleteError: null,
    isBulkDeleting: false,
    isStartingCapture: false,
    isExporting: false,
    lastExportFileName: null,
    error: null,
    lastRecordedRouteKey: null,

    hydrate: async () => {
      try {
        const state = await window.electron.appPerformance.getState();
        get().appPerformance.applyState(state);
        await get().appPerformance.loadCaptureHistory(1);

        if (state.isSampling) {
          startRendererFpsLoop(get);
        } else {
          stopRendererFpsLoop();
        }
      } catch (error) {
        console.error("[AppPerformanceSlice] Failed to hydrate:", error);
        set(
          ({ appPerformance }) => {
            appPerformance.error =
              error instanceof Error ? error.message : "Hydration failed";
          },
          false,
          "appPerformanceSlice/hydrate/error",
        );
      }
    },

    startListening: () => {
      const cleanupState = window.electron.appPerformance.onStateChanged(
        (state) => {
          get().appPerformance.applyState(state);
          void get().appPerformance.loadCaptureHistory();
          if (state.isSampling) {
            startRendererFpsLoop(get);
          } else {
            stopRendererFpsLoop();
          }
        },
      );
      const cleanupSample = window.electron.appPerformance.onSampleAdded(
        (sample) => get().appPerformance.addSample(sample),
      );
      const cleanupMarker = window.electron.appPerformance.onRouteMarkerAdded(
        (marker) => get().appPerformance.addRouteMarker(marker),
      );

      if (get().appPerformance.isSampling) {
        startRendererFpsLoop(get);
      }

      return () => {
        cleanupState();
        cleanupSample();
        cleanupMarker();
        stopRendererFpsLoop();
      };
    },

    setMonitorEnabled: async (enabled: boolean) => {
      if (!enabled && get().appPerformance.isSampling) {
        await get().appPerformance.stopCapture();
      }

      await get().settings.updateSetting(
        "appPerformanceMonitorEnabled",
        enabled,
      );
    },

    setRetentionPolicy: async (retention: AppPerformanceRetention) => {
      await get().settings.updateSetting("appPerformanceRetention", retention);
      await window.electron.appPerformance.applyRetentionCleanup(retention);
      await get().appPerformance.loadCaptureHistory(1);
      get().storage.fetchStorageInfo();
    },

    startCapture: async () => {
      try {
        const state = await window.electron.appPerformance.startCapture();
        get().appPerformance.applyState(state);
        await get().appPerformance.loadCaptureHistory(1);
        startRendererFpsLoop(get);
      } catch (error) {
        console.error("[AppPerformanceSlice] Failed to start capture:", error);
        set(
          ({ appPerformance }) => {
            appPerformance.error =
              error instanceof Error ? error.message : "Failed to start";
          },
          false,
          "appPerformanceSlice/startCapture/error",
        );
      }
    },

    stopCapture: async () => {
      stopRendererFpsLoop();
      try {
        const state = await window.electron.appPerformance.stopCapture();
        get().appPerformance.applyState(state);
        await get().appPerformance.loadCaptureHistory();
        get().storage.fetchStorageInfo();
      } catch (error) {
        console.error("[AppPerformanceSlice] Failed to stop capture:", error);
        set(
          ({ appPerformance }) => {
            appPerformance.error =
              error instanceof Error ? error.message : "Failed to stop";
          },
          false,
          "appPerformanceSlice/stopCapture/error",
        );
      }
    },

    loadCaptureHistory: async (page?: number) => {
      const requestedPage = page ?? get().appPerformance.captureHistoryPage;
      set(
        ({ appPerformance }) => {
          appPerformance.isLoadingHistory = true;
        },
        false,
        "appPerformanceSlice/loadCaptureHistory/start",
      );

      try {
        const result = await window.electron.appPerformance.listCaptures({
          page: requestedPage,
          pageSize: get().appPerformance.captureHistoryPageSize,
        });
        set(
          ({ appPerformance }) => {
            appPerformance.captureHistory = result.captures;
            appPerformance.captureHistoryPage = result.page;
            appPerformance.captureHistoryPageSize = result.pageSize;
            appPerformance.captureHistoryTotal = result.total;
            appPerformance.captureHistoryTotalPages = result.totalPages;
            appPerformance.isLoadingHistory = false;
            appPerformance.selectedCaptureIds =
              appPerformance.selectedCaptureIds.filter((id) =>
                result.captures.some((capture) => capture.id === id),
              );
          },
          false,
          "appPerformanceSlice/loadCaptureHistory/success",
        );
      } catch (error) {
        console.error(
          "[AppPerformanceSlice] Failed to load capture history:",
          error,
        );
        set(
          ({ appPerformance }) => {
            appPerformance.isLoadingHistory = false;
            appPerformance.error =
              error instanceof Error ? error.message : "Failed to load history";
          },
          false,
          "appPerformanceSlice/loadCaptureHistory/error",
        );
      }
    },

    loadCapture: async (captureId: string) => {
      set(
        ({ appPerformance }) => {
          appPerformance.isLoadingCapture = true;
          appPerformance.error = null;
        },
        false,
        "appPerformanceSlice/loadCapture/start",
      );

      try {
        const state =
          await window.electron.appPerformance.getCaptureState(captureId);
        get().appPerformance.applyState(state);
        set(
          ({ appPerformance }) => {
            appPerformance.isLoadingCapture = false;
          },
          false,
          "appPerformanceSlice/loadCapture/success",
        );
        if (state.isSampling) {
          startRendererFpsLoop(get);
        } else {
          stopRendererFpsLoop();
        }
      } catch (error) {
        console.error("[AppPerformanceSlice] Failed to load capture:", error);
        set(
          ({ appPerformance }) => {
            appPerformance.isLoadingCapture = false;
            appPerformance.error =
              error instanceof Error ? error.message : "Failed to load capture";
          },
          false,
          "appPerformanceSlice/loadCapture/error",
        );
      }
    },

    deleteCapture: async (captureId: string) => {
      set(
        ({ appPerformance }) => {
          appPerformance.deletingCaptureId = captureId;
          appPerformance.error = null;
        },
        false,
        "appPerformanceSlice/deleteCapture/start",
      );

      try {
        const wasSelected = get().appPerformance.captureId === captureId;
        const wasLastOnPage =
          get().appPerformance.captureHistory.length === 1 &&
          get().appPerformance.captureHistoryPage > 1;
        const result =
          await window.electron.appPerformance.deleteCapture(captureId);

        if (!result.success) {
          throw new Error(result.error ?? "Failed to delete capture");
        }

        if (result.deleted && wasSelected) {
          set(
            ({ appPerformance }) => {
              appPerformance.captureId = null;
              appPerformance.captureStartedAt = null;
              appPerformance.captureStoppedAt = null;
              appPerformance.isSampling = false;
              appPerformance.samples = [];
              appPerformance.metricStats = createEmptyMetricStatsByChart();
              appPerformance.routeMarkers = [];
              appPerformance.focusedChart = null;
            },
            false,
            "appPerformanceSlice/deleteCapture/clearSelected",
          );
        }

        await get().appPerformance.loadCaptureHistory(
          wasLastOnPage
            ? get().appPerformance.captureHistoryPage - 1
            : get().appPerformance.captureHistoryPage,
        );
        get().storage.fetchStorageInfo();

        set(
          ({ appPerformance }) => {
            appPerformance.deletingCaptureId = null;
          },
          false,
          "appPerformanceSlice/deleteCapture/success",
        );
      } catch (error) {
        console.error("[AppPerformanceSlice] Failed to delete capture:", error);
        set(
          ({ appPerformance }) => {
            appPerformance.deletingCaptureId = null;
            appPerformance.error =
              error instanceof Error ? error.message : "Failed to delete";
          },
          false,
          "appPerformanceSlice/deleteCapture/error",
        );
      }
    },

    setIndexView: (view: AppPerformanceIndexView) => {
      set(
        ({ appPerformance }) => {
          if (appPerformance.deleteMode) return;
          appPerformance.indexView = view;
        },
        false,
        "appPerformanceSlice/setIndexView",
      );
    },

    startDeleteMode: () => {
      set(
        ({ appPerformance }) => {
          appPerformance.indexView = "captures";
          appPerformance.deleteMode = true;
          appPerformance.selectedCaptureIds = [];
          appPerformance.deleteError = null;
        },
        false,
        "appPerformanceSlice/startDeleteMode",
      );
    },

    cancelDeleteMode: () => {
      set(
        ({ appPerformance }) => {
          appPerformance.deleteMode = false;
          appPerformance.selectedCaptureIds = [];
          appPerformance.isDeleteConfirmOpen = false;
          appPerformance.deleteError = null;
          appPerformance.isBulkDeleting = false;
        },
        false,
        "appPerformanceSlice/cancelDeleteMode",
      );
    },

    toggleCaptureSelection: (captureId: string) => {
      set(
        ({ appPerformance }) => {
          if (appPerformance.selectedCaptureIds.includes(captureId)) {
            appPerformance.selectedCaptureIds =
              appPerformance.selectedCaptureIds.filter(
                (id) => id !== captureId,
              );
          } else {
            appPerformance.selectedCaptureIds.push(captureId);
          }
        },
        false,
        "appPerformanceSlice/toggleCaptureSelection",
      );
    },

    toggleAllVisibleCaptureSelection: () => {
      set(
        ({ appPerformance }) => {
          if (!appPerformance.deleteMode) return;

          const selectableIds = appPerformance.captureHistory
            .filter((capture) => capture.stoppedAt !== null)
            .map((capture) => capture.id);
          const current = new Set(appPerformance.selectedCaptureIds);
          const allVisibleSelected =
            selectableIds.length > 0 &&
            selectableIds.every((id) => current.has(id));

          for (const id of selectableIds) {
            if (allVisibleSelected) {
              current.delete(id);
            } else {
              current.add(id);
            }
          }

          appPerformance.selectedCaptureIds = Array.from(current);
        },
        false,
        "appPerformanceSlice/toggleAllVisibleCaptureSelection",
      );
    },

    openDeleteConfirm: () => {
      set(
        ({ appPerformance }) => {
          appPerformance.deleteError = null;
          appPerformance.isDeleteConfirmOpen = true;
        },
        false,
        "appPerformanceSlice/openDeleteConfirm",
      );
    },

    closeDeleteConfirm: () => {
      set(
        ({ appPerformance }) => {
          if (appPerformance.isBulkDeleting) return;
          appPerformance.deleteError = null;
          appPerformance.isDeleteConfirmOpen = false;
        },
        false,
        "appPerformanceSlice/closeDeleteConfirm",
      );
    },

    confirmBulkDelete: async () => {
      const selectedCaptureIds = [...get().appPerformance.selectedCaptureIds];
      if (selectedCaptureIds.length === 0) return;

      set(
        ({ appPerformance }) => {
          appPerformance.isBulkDeleting = true;
          appPerformance.deleteError = null;
        },
        false,
        "appPerformanceSlice/confirmBulkDelete/start",
      );

      try {
        const result =
          await window.electron.appPerformance.deleteCaptures(
            selectedCaptureIds,
          );
        if (!result.success) {
          throw new Error(result.error ?? "Failed to delete captures");
        }

        const {
          captureHistory,
          captureHistoryPage,
          selectedCaptureIds: latestSelectedCaptureIds,
        } = get().appPerformance;
        const nextPage =
          latestSelectedCaptureIds.length >= captureHistory.length &&
          captureHistoryPage > 1
            ? captureHistoryPage - 1
            : captureHistoryPage;

        await get().appPerformance.loadCaptureHistory(nextPage);
        get().storage.fetchStorageInfo();
        set(
          ({ appPerformance }) => {
            appPerformance.isDeleteConfirmOpen = false;
            appPerformance.deleteMode = false;
            appPerformance.selectedCaptureIds = [];
            appPerformance.isBulkDeleting = false;
          },
          false,
          "appPerformanceSlice/confirmBulkDelete/success",
        );
      } catch (error) {
        set(
          ({ appPerformance }) => {
            appPerformance.deleteError =
              error instanceof Error
                ? error.message
                : "Failed to delete captures";
            appPerformance.isBulkDeleting = false;
          },
          false,
          "appPerformanceSlice/confirmBulkDelete/error",
        );
      }
    },

    setStartingCapture: (isStarting: boolean) => {
      set(
        ({ appPerformance }) => {
          appPerformance.isStartingCapture = isStarting;
        },
        false,
        "appPerformanceSlice/setStartingCapture",
      );
    },

    recordRoute: async (pathname: string) => {
      const { appPerformance } = get();
      if (!appPerformance.isSampling) {
        return;
      }

      const normalized = normalizeAppPerformanceRoute(pathname);
      const routeKey = `${normalized.route}|${normalized.label}`;
      if (appPerformance.lastRecordedRouteKey === routeKey) return;

      set(
        ({ appPerformance }) => {
          appPerformance.lastRecordedRouteKey = routeKey;
        },
        false,
        "appPerformanceSlice/recordRoute/local",
      );

      try {
        await window.electron.appPerformance.recordRouteMarker(normalized);
      } catch (error) {
        console.error("[AppPerformanceSlice] Failed to record route:", error);
      }
    },

    exportReport: async () => {
      set(
        ({ appPerformance }) => {
          appPerformance.isExporting = true;
          appPerformance.error = null;
          appPerformance.lastExportFileName = null;
        },
        false,
        "appPerformanceSlice/exportReport/start",
      );

      try {
        const { captureId } = get().appPerformance;
        const result = await window.electron.appPerformance.exportReport(
          captureId ?? undefined,
        );
        set(
          ({ appPerformance }) => {
            appPerformance.isExporting = false;
            appPerformance.lastExportFileName = result.fileName ?? null;
            appPerformance.error =
              result.success || result.canceled
                ? null
                : (result.error ?? "Export failed");
          },
          false,
          "appPerformanceSlice/exportReport/result",
        );
      } catch (error) {
        console.error("[AppPerformanceSlice] Failed to export report:", error);
        set(
          ({ appPerformance }) => {
            appPerformance.isExporting = false;
            appPerformance.error =
              error instanceof Error ? error.message : "Export failed";
          },
          false,
          "appPerformanceSlice/exportReport/error",
        );
      }
    },

    setFocusedChart: (chart: AppPerformanceChartKey | null) => {
      set(
        ({ appPerformance }) => {
          appPerformance.focusedChart = chart;
        },
        false,
        "appPerformanceSlice/setFocusedChart",
      );
    },

    applyState: (state: AppPerformanceStateDTO) => {
      set(
        ({ appPerformance }) => {
          appPerformance.captureId = state.capture?.id ?? null;
          appPerformance.captureStartedAt = state.capture?.startedAt ?? null;
          appPerformance.captureStoppedAt = state.capture?.stoppedAt ?? null;
          appPerformance.isSampling = state.isSampling;
          appPerformance.samples = takeLatestItems(
            state.samples,
            MAX_RENDERER_SAMPLE_POINTS,
          );
          appPerformance.metricStats = createMetricStatsByChart(
            appPerformance.samples,
          );
          appPerformance.routeMarkers = state.routeMarkers.slice(
            -MAX_RENDERER_MARKERS,
          );
          appPerformance.error = null;
          appPerformance.lastRecordedRouteKey = state.isSampling
            ? appPerformance.lastRecordedRouteKey
            : null;
        },
        false,
        "appPerformanceSlice/applyState",
      );
    },

    addSample: (sample: AppPerformanceSampleDTO) => {
      set(
        ({ appPerformance }) => {
          if (!appPerformance.isSampling) return;
          const last =
            appPerformance.samples[appPerformance.samples.length - 1];
          if (last?.sampledAt === sample.sampledAt) return;
          appPerformance.samples.push(sample);
          updateMetricStatsByChart(appPerformance.metricStats, sample);
          if (trimSampleBuffer(appPerformance.samples)) {
            appPerformance.metricStats = createMetricStatsByChart(
              appPerformance.samples,
            );
          }
        },
        false,
        "appPerformanceSlice/addSample",
      );
    },

    addRouteMarker: (marker: AppPerformanceRouteMarkerDTO) => {
      set(
        ({ appPerformance }) => {
          if (!appPerformance.isSampling) return;
          if (appPerformance.routeMarkers.some((m) => m.id === marker.id)) {
            return;
          }
          appPerformance.routeMarkers.push(marker);
          if (appPerformance.routeMarkers.length > MAX_RENDERER_MARKERS) {
            appPerformance.routeMarkers.splice(
              0,
              appPerformance.routeMarkers.length - MAX_RENDERER_MARKERS,
            );
          }
        },
        false,
        "appPerformanceSlice/addRouteMarker",
      );
    },
  },
});

export { normalizeAppPerformanceRoute };

function startRendererFpsLoop(get: () => BoundStore): void {
  if (fpsLoopRunning || typeof requestAnimationFrame !== "function") return;

  fpsLoopRunning = true;
  frameWindowStartedAt = performance.now();
  frameCount = 0;

  const tick = (now: number) => {
    const state = get();
    const enabled = state.appPerformance.isSampling;

    if (!enabled) {
      stopRendererFpsLoop();
      return;
    }

    const visible = document.visibilityState === "visible";
    if (visible) {
      frameCount += 1;
    }

    const elapsedMs = now - frameWindowStartedAt;
    if (elapsedMs >= 1_000) {
      const fps = visible ? (frameCount * 1000) / elapsedMs : null;
      void window.electron.appPerformance.recordRendererMetrics({
        fps,
        rendererHeapUsedBytes: readRendererHeapUsedBytes(),
      });
      frameWindowStartedAt = now;
      frameCount = 0;
    }

    fpsRafId = requestAnimationFrame(tick);
  };

  fpsRafId = requestAnimationFrame(tick);
}

function stopRendererFpsLoop(): void {
  if (fpsRafId !== null) {
    cancelAnimationFrame(fpsRafId);
    fpsRafId = null;
  }
  fpsLoopRunning = false;
  frameCount = 0;
}

function readRendererHeapUsedBytes(): number | null {
  const memory = (
    performance as Performance & {
      memory?: { usedJSHeapSize?: number };
    }
  ).memory;
  const used = memory?.usedJSHeapSize;
  return typeof used === "number" && Number.isFinite(used) ? used : null;
}

function takeLatestItems<T>(items: T[], maxItems: number): T[] {
  if (maxItems <= 0) return [];
  if (items.length <= maxItems) return [...items];
  return items.slice(-maxItems);
}

function trimSampleBuffer(samples: AppPerformanceSampleDTO[]): boolean {
  const trimThreshold =
    MAX_RENDERER_SAMPLE_POINTS + RENDERER_SAMPLE_TRIM_BATCH_SIZE;
  if (samples.length <= trimThreshold) return false;

  samples.splice(0, samples.length - MAX_RENDERER_SAMPLE_POINTS);
  return true;
}

function createEmptyMetricStats(): AppPerformanceMetricStatsState {
  return {
    current: null,
    min: null,
    avg: null,
    max: null,
    count: 0,
    sum: 0,
  };
}

function createEmptyMetricStatsByChart(): AppPerformanceMetricStatsByChart {
  return {
    fps: createEmptyMetricStats(),
    cpu: createEmptyMetricStats(),
    memory: createEmptyMetricStats(),
  };
}

function createMetricStatsByChart(
  samples: readonly AppPerformanceSampleDTO[],
): AppPerformanceMetricStatsByChart {
  const stats = createEmptyMetricStatsByChart();
  for (const sample of samples) {
    updateMetricStatsByChart(stats, sample);
  }
  return stats;
}

function updateMetricStatsByChart(
  stats: AppPerformanceMetricStatsByChart,
  sample: AppPerformanceSampleDTO,
): void {
  updateMetricStats(stats.fps, sample.fps);
  updateMetricStats(stats.cpu, sample.appCpuPercent);
  updateMetricStats(stats.memory, sample.appMemoryBytes);
}

function updateMetricStats(
  stats: AppPerformanceMetricStatsState,
  value: number | null,
): void {
  if (typeof value !== "number" || !Number.isFinite(value)) return;

  stats.current = value;
  stats.count += 1;
  stats.sum += value;
  stats.avg = stats.sum / stats.count;
  stats.min = stats.min === null ? value : Math.min(stats.min, value);
  stats.max = stats.max === null ? value : Math.max(stats.max, value);
}
