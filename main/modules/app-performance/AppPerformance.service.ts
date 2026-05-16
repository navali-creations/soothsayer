import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  powerMonitor,
  shell,
} from "electron";

import { DatabaseService } from "~/main/modules/database";
import {
  SettingsKey,
  SettingsStoreService,
} from "~/main/modules/settings-store";
import {
  assertBoundedString,
  assertNumber,
  assertStringArray,
  assertTrustedSender,
  handleValidationError,
  IpcValidationError,
} from "~/main/utils/ipc-validation";

import { AppPerformanceChannel } from "./AppPerformance.channels";
import type {
  AppPerformanceBulkDeleteResultDTO,
  AppPerformanceCaptureDTO,
  AppPerformanceCaptureHistoryDTO,
  AppPerformanceDeleteResultDTO,
  AppPerformanceExportResultDTO,
  AppPerformanceListCapturesInputDTO,
  AppPerformanceRetention,
  AppPerformanceRouteMarkerDTO,
  AppPerformanceRouteMarkerInputDTO,
  AppPerformanceSampleDTO,
  AppPerformanceStateDTO,
  RendererPerformanceMetricsDTO,
} from "./AppPerformance.dto";
import {
  aggregateElectronMetrics,
  type CpuTimesSnapshot,
  calculateMemoryUsageBytes,
  calculateSystemCpuPercent,
  readCpuTimesSnapshot,
} from "./AppPerformance.metrics";
import { generateAppPerformanceReport } from "./AppPerformance.report";
import { AppPerformanceRepository } from "./AppPerformance.repository";

const SAMPLE_INTERVAL_MS = 1_000;
const MAX_IN_MEMORY_MARKERS = 1_000;
const MAX_STATE_SAMPLE_POINTS = 86_400;
const STATE_SAMPLE_TRIM_BATCH_SIZE = 60;
const FLUSH_EVERY_SAMPLES = 10;
const FLUSH_EVERY_MS = 10_000;
const RENDERER_METRIC_STALE_MS = 5_000;
const HISTORICAL_STATE_MARKER_LIMIT = MAX_IN_MEMORY_MARKERS;
const MAX_RENDERER_FPS = 1_000;
const MAX_RENDERER_HEAP_USED_BYTES = 1024 ** 4;

type ElectronProcessWithSystemMemory = NodeJS.Process & {
  getSystemMemoryInfo?: () => {
    total?: number;
    free?: number;
  };
};

interface DeferredSampleFlush {
  captureId: string;
  samples: AppPerformanceSampleDTO[];
}

interface StopCaptureOptions {
  broadcastState?: boolean;
}

class AppPerformanceService {
  private static _instance: AppPerformanceService;

  private repository: AppPerformanceRepository;
  private settingsStore: SettingsStoreService;

  private capture: AppPerformanceCaptureDTO | null = null;
  private samples: AppPerformanceSampleDTO[] = [];
  private routeMarkers: AppPerformanceRouteMarkerDTO[] = [];
  private pendingSamples: AppPerformanceSampleDTO[] = [];
  private deferredSampleFlushes: DeferredSampleFlush[] = [];
  private sampleTimer: ReturnType<typeof setInterval> | null = null;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private previousCpuTimes: CpuTimesSnapshot | null = null;
  private currentRoute: string | null = null;
  private latestRendererMetrics:
    | (RendererPerformanceMetricsDTO & {
        receivedAt: number;
      })
    | null = null;
  private stopCapturePromise: Promise<AppPerformanceStateDTO> | null = null;

  static getInstance(): AppPerformanceService {
    if (!AppPerformanceService._instance) {
      AppPerformanceService._instance = new AppPerformanceService();
    }
    return AppPerformanceService._instance;
  }

  private constructor() {
    const database = DatabaseService.getInstance();
    this.repository = new AppPerformanceRepository(database.getDb());
    this.settingsStore = SettingsStoreService.getInstance();
    this.setupHandlers();
    this.setupPowerMonitor();
  }

  async initialize(): Promise<void> {
    this.flushDeferredSamples();
    this.repository.closeOpenCaptures(new Date().toISOString());

    const retention = await this.settingsStore.get(
      SettingsKey.AppPerformanceRetention,
    );
    this.repository.cleanup(retention ?? "7d");
  }

  getState(): AppPerformanceStateDTO {
    if (this.capture) {
      return {
        capture: this.capture,
        isSampling: this.sampleTimer !== null,
        samples: this.getStateSamples(),
        routeMarkers: [...this.routeMarkers],
      };
    }

    const latest = this.repository.getLatestCapture();
    if (!latest) {
      return {
        capture: null,
        isSampling: false,
        samples: [],
        routeMarkers: [],
      };
    }

    return this.repository.getStateForCapture(latest.id, false, {
      sampleLimit: MAX_STATE_SAMPLE_POINTS,
      sampleMode: "span",
      routeMarkerLimit: HISTORICAL_STATE_MARKER_LIMIT,
    });
  }

  listCaptures(
    input: AppPerformanceListCapturesInputDTO = {},
  ): AppPerformanceCaptureHistoryDTO {
    this.flushPendingSamples();
    this.flushDeferredSamples();

    const pageSize = clampInteger(input.pageSize ?? 5, 1, 100);
    const total = this.repository.countCaptures();
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = clampInteger(input.page ?? 1, 1, totalPages);
    const captures = this.repository.listCaptureSummaries({
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return {
      captures,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  getCaptureState(captureId: string): AppPerformanceStateDTO {
    if (this.capture?.id === captureId) {
      return this.getState();
    }

    this.flushDeferredSamples();
    const capture = this.repository.getCapture(captureId);
    if (!capture) {
      return {
        capture: null,
        isSampling: false,
        samples: [],
        routeMarkers: [],
      };
    }

    return this.repository.getStateForCapture(captureId, false, {
      sampleLimit: MAX_STATE_SAMPLE_POINTS,
      sampleMode: "span",
      routeMarkerLimit: HISTORICAL_STATE_MARKER_LIMIT,
    });
  }

  deleteCapture(captureId: string): AppPerformanceDeleteResultDTO {
    if (this.capture?.id === captureId) {
      return {
        success: false,
        error: "Stop diagnostics before deleting this capture.",
      };
    }

    this.flushDeferredSamples();
    const deleted = this.repository.deleteCapture(captureId) > 0;
    if (deleted) {
      this.dropDeferredSampleFlushes([captureId]);
    }

    return {
      success: true,
      deleted,
    };
  }

  deleteCaptures(captureIds: string[]): AppPerformanceBulkDeleteResultDTO {
    if (this.capture && captureIds.includes(this.capture.id)) {
      return {
        success: false,
        error: "Stop diagnostics before deleting selected captures.",
      };
    }

    this.flushDeferredSamples();
    const deletedCount = this.repository.deleteCaptures(captureIds);
    if (deletedCount > 0) {
      this.dropDeferredSampleFlushes(captureIds);
    }

    return {
      success: true,
      deletedCount,
    };
  }

  startCapture(): AppPerformanceStateDTO {
    if (this.capture) {
      this.sendStateChanged();
      return this.getState();
    }

    this.flushDeferredSamples();
    const now = new Date();
    this.capture = {
      id: crypto.randomUUID(),
      startedAt: now.toISOString(),
      stoppedAt: null,
    };
    this.samples = [];
    this.routeMarkers = [];
    this.pendingSamples = [];
    this.currentRoute = null;
    this.previousCpuTimes = readCpuTimesSnapshot();
    this.latestRendererMetrics = null;

    this.repository.createCapture(this.capture);

    this.sampleTimer = setInterval(() => {
      this.sampleNow();
    }, SAMPLE_INTERVAL_MS);
    this.flushTimer = setInterval(() => {
      this.flushPendingSamples();
    }, FLUSH_EVERY_MS);

    this.sampleNow();
    this.sendStateChanged();
    return this.getState();
  }

  async startFreshCapture(): Promise<AppPerformanceStateDTO> {
    if (this.capture) {
      await this.stopCapture({ broadcastState: false });
    }

    return this.startCapture();
  }

  async stopCapture(
    options: StopCaptureOptions = {},
  ): Promise<AppPerformanceStateDTO> {
    if (this.stopCapturePromise) {
      return this.stopCapturePromise;
    }

    if (!this.capture) {
      return this.getState();
    }

    this.stopCapturePromise = this.performStopCapture(options).finally(() => {
      this.stopCapturePromise = null;
    });

    return this.stopCapturePromise;
  }

  private async performStopCapture(
    options: StopCaptureOptions,
  ): Promise<AppPerformanceStateDTO> {
    const activeCapture = this.capture;
    if (!activeCapture) {
      return this.getState();
    }

    this.clearTimers();
    const samplesFlushed = this.flushPendingSamples(activeCapture.id);
    if (!samplesFlushed) {
      this.deferPendingSamples(activeCapture.id);
    }

    const stoppedAt = new Date().toISOString();
    this.repository.stopCapture(activeCapture.id, stoppedAt);
    this.capture = {
      ...activeCapture,
      stoppedAt,
    };

    const retention = await this.settingsStore.get(
      SettingsKey.AppPerformanceRetention,
    );
    this.repository.cleanup(retention ?? "7d");

    const state = this.getState();
    this.capture = null;
    this.samples = [];
    this.routeMarkers = [];
    this.pendingSamples = [];
    this.currentRoute = null;
    this.previousCpuTimes = null;
    this.latestRendererMetrics = null;

    if (options.broadcastState ?? true) {
      this.sendStateChanged();
    }
    return state;
  }

  async shutdown(): Promise<void> {
    if (this.stopCapturePromise) {
      try {
        await this.stopCapturePromise;
      } catch (error) {
        console.error(
          "[AppPerformance] Failed to stop capture during shutdown:",
          error,
        );
        this.clearTimers();
        this.flushPendingSamples();
      }
      return;
    }

    if (!this.capture) {
      this.clearTimers();
      return;
    }

    try {
      await this.stopCapture({ broadcastState: false });
    } catch (error) {
      console.error(
        "[AppPerformance] Failed to stop capture on shutdown:",
        error,
      );
      this.clearTimers();
      this.flushPendingSamples();
    }
  }

  recordRendererMetrics(metrics: RendererPerformanceMetricsDTO): void {
    this.latestRendererMetrics = {
      fps: sanitizeNullableNumber(metrics.fps),
      rendererHeapUsedBytes: sanitizeNullableNumber(
        metrics.rendererHeapUsedBytes,
      ),
      receivedAt: Date.now(),
    };
  }

  recordRouteMarker(
    input: AppPerformanceRouteMarkerInputDTO,
  ): AppPerformanceRouteMarkerDTO | null {
    return this.recordMarker(input, { updateCurrentRoute: true });
  }

  recordOverlayMarker(isVisible: boolean): AppPerformanceRouteMarkerDTO | null {
    return this.recordMarker(
      {
        route: isVisible ? "/overlay/opened" : "/overlay/closed",
        label: isVisible ? "Overlay opened" : "Overlay closed",
      },
      { updateCurrentRoute: false },
    );
  }

  private recordMarker(
    input: AppPerformanceRouteMarkerInputDTO,
    options: { updateCurrentRoute: boolean },
  ): AppPerformanceRouteMarkerDTO | null {
    if (!this.capture) return null;

    const previous = this.routeMarkers[this.routeMarkers.length - 1];
    if (previous?.route === input.route && previous.label === input.label) {
      return previous;
    }

    const now = new Date();
    const elapsedMs = Math.max(
      0,
      now.getTime() - new Date(this.capture.startedAt).getTime(),
    );
    const marker: AppPerformanceRouteMarkerDTO = {
      id: crypto.randomUUID(),
      route: input.route,
      label: input.label,
      markedAt: now.toISOString(),
      elapsedMs,
    };

    if (options.updateCurrentRoute) {
      this.currentRoute = input.route;
    }
    this.routeMarkers.push(marker);
    if (this.routeMarkers.length > MAX_IN_MEMORY_MARKERS) {
      this.routeMarkers.splice(
        0,
        this.routeMarkers.length - MAX_IN_MEMORY_MARKERS,
      );
    }
    this.repository.insertRouteMarker(this.capture.id, marker);
    this.sendToRenderer(AppPerformanceChannel.RouteMarkerAdded, marker);
    return marker;
  }

  async applyRetentionCleanup(
    retention?: AppPerformanceRetention,
  ): Promise<number> {
    this.flushDeferredSamples();
    const resolvedRetention =
      retention ??
      (await this.settingsStore.get(SettingsKey.AppPerformanceRetention)) ??
      "7d";
    return this.repository.cleanup(resolvedRetention);
  }

  async exportReport(
    captureId?: string,
  ): Promise<AppPerformanceExportResultDTO> {
    try {
      this.flushPendingSamples();
      this.flushDeferredSamples();

      const state = captureId
        ? this.getCaptureState(captureId)
        : this.getState();
      if (!state.capture) {
        return {
          success: false,
          error: "No diagnostics capture is available to export.",
        };
      }

      if (state.isSampling || state.capture.stoppedAt === null) {
        return {
          success: false,
          error: "Stop diagnostics before exporting the report.",
        };
      }

      const reportData = this.repository.getReportDataForCapture(
        state.capture.id,
        state.isSampling,
      );
      const report = generateAppPerformanceReport({
        capture: reportData.capture,
        samples: reportData.samples,
        routeMarkers: reportData.routeMarkers,
        sampleCount: reportData.sampleCount,
        routeMarkerCount: reportData.routeMarkerCount,
        stats: reportData.stats,
        metadata: {
          generatedAt: new Date().toISOString(),
          appVersion: app.getVersion(),
          electron: process.versions.electron ?? "n/a",
          chrome: process.versions.chrome ?? "n/a",
          node: process.versions.node,
          os: `${process.platform} ${os.release()} ${os.arch()}`,
        },
      });

      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (!mainWindow) {
        return { success: false, error: "Main window not available." };
      }

      const dateSuffix = new Date().toISOString().slice(0, 10);
      const defaultPath = path.join(
        app.getPath("desktop"),
        `soothsayer-app-performance-${dateSuffix}.txt`,
      );
      const result = await dialog.showSaveDialog(mainWindow, {
        title: "Export Soothsayer App Performance Report",
        defaultPath,
        filters: [{ name: "Text Files", extensions: ["txt"] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true };
      }

      await fs.writeFile(result.filePath, report, "utf-8");
      shell.showItemInFolder(result.filePath);
      return { success: true, fileName: path.basename(result.filePath) };
    } catch (error) {
      console.error("[AppPerformance] Failed to export report:", error);
      return {
        success: false,
        error: "Failed to export diagnostics report.",
      };
    }
  }

  private setupHandlers(): void {
    ipcMain.handle(AppPerformanceChannel.GetState, (event) => {
      try {
        assertTrustedSender(event, AppPerformanceChannel.GetState);
        return this.getState();
      } catch (error) {
        return handleValidationError(error, AppPerformanceChannel.GetState);
      }
    });

    ipcMain.handle(
      AppPerformanceChannel.ListCaptures,
      (event, input?: AppPerformanceListCapturesInputDTO) => {
        try {
          assertTrustedSender(event, AppPerformanceChannel.ListCaptures);
          validateListCapturesInput(input);
          return this.listCaptures(input);
        } catch (error) {
          return handleValidationError(
            error,
            AppPerformanceChannel.ListCaptures,
          );
        }
      },
    );

    ipcMain.handle(
      AppPerformanceChannel.DeleteCapture,
      (event, captureId: string) => {
        try {
          assertTrustedSender(event, AppPerformanceChannel.DeleteCapture);
          validateCaptureId(captureId, AppPerformanceChannel.DeleteCapture);
          return this.deleteCapture(captureId);
        } catch (error) {
          return handleValidationError(
            error,
            AppPerformanceChannel.DeleteCapture,
          );
        }
      },
    );

    ipcMain.handle(
      AppPerformanceChannel.DeleteCaptures,
      (event, captureIds: string[]) => {
        try {
          assertTrustedSender(event, AppPerformanceChannel.DeleteCaptures);
          validateCaptureIds(captureIds, AppPerformanceChannel.DeleteCaptures);
          return this.deleteCaptures(captureIds);
        } catch (error) {
          return handleValidationError(
            error,
            AppPerformanceChannel.DeleteCaptures,
          );
        }
      },
    );

    ipcMain.handle(
      AppPerformanceChannel.GetCaptureState,
      (event, captureId: string) => {
        try {
          assertTrustedSender(event, AppPerformanceChannel.GetCaptureState);
          validateCaptureId(captureId, AppPerformanceChannel.GetCaptureState);
          return this.getCaptureState(captureId);
        } catch (error) {
          return handleValidationError(
            error,
            AppPerformanceChannel.GetCaptureState,
          );
        }
      },
    );

    ipcMain.handle(AppPerformanceChannel.StartCapture, (event) => {
      try {
        assertTrustedSender(event, AppPerformanceChannel.StartCapture);
        return this.startCapture();
      } catch (error) {
        return handleValidationError(error, AppPerformanceChannel.StartCapture);
      }
    });

    ipcMain.handle(AppPerformanceChannel.StopCapture, async (event) => {
      try {
        assertTrustedSender(event, AppPerformanceChannel.StopCapture);
        return await this.stopCapture({ broadcastState: false });
      } catch (error) {
        return handleValidationError(error, AppPerformanceChannel.StopCapture);
      }
    });

    ipcMain.handle(
      AppPerformanceChannel.RecordRendererMetrics,
      (event, metrics: RendererPerformanceMetricsDTO) => {
        try {
          assertTrustedSender(
            event,
            AppPerformanceChannel.RecordRendererMetrics,
          );
          validateRendererMetrics(metrics);
          this.recordRendererMetrics(metrics);
          return { success: true };
        } catch (error) {
          return handleValidationError(
            error,
            AppPerformanceChannel.RecordRendererMetrics,
          );
        }
      },
    );

    ipcMain.handle(
      AppPerformanceChannel.RecordRouteMarker,
      (event, input: AppPerformanceRouteMarkerInputDTO) => {
        try {
          assertTrustedSender(event, AppPerformanceChannel.RecordRouteMarker);
          validateRouteMarkerInput(input);
          return this.recordRouteMarker(input);
        } catch (error) {
          return handleValidationError(
            error,
            AppPerformanceChannel.RecordRouteMarker,
          );
        }
      },
    );

    ipcMain.handle(
      AppPerformanceChannel.ApplyRetentionCleanup,
      async (event, retention?: AppPerformanceRetention) => {
        try {
          assertTrustedSender(
            event,
            AppPerformanceChannel.ApplyRetentionCleanup,
          );
          validateRetention(retention);
          return await this.applyRetentionCleanup(retention);
        } catch (error) {
          return handleValidationError(
            error,
            AppPerformanceChannel.ApplyRetentionCleanup,
          );
        }
      },
    );

    ipcMain.handle(
      AppPerformanceChannel.ExportReport,
      async (event, captureId?: string) => {
        try {
          assertTrustedSender(event, AppPerformanceChannel.ExportReport);
          validateCaptureId(
            captureId,
            AppPerformanceChannel.ExportReport,
            true,
          );
          return await this.exportReport(captureId);
        } catch (error) {
          return handleValidationError(
            error,
            AppPerformanceChannel.ExportReport,
          );
        }
      },
    );
  }

  private setupPowerMonitor(): void {
    powerMonitor.on("suspend", () => {
      if (!this.capture && !this.stopCapturePromise) return;

      console.log(
        "[AppPerformance] System suspending, stopping diagnostics capture",
      );
      void this.stopCapture({ broadcastState: true }).catch((error) => {
        console.error(
          "[AppPerformance] Failed to stop capture on system suspend:",
          error,
        );
        this.clearTimers();
        this.flushPendingSamples();
      });
    });
  }

  private sampleNow(): void {
    if (!this.capture) return;

    const now = new Date();
    const elapsedMs = Math.max(
      0,
      now.getTime() - new Date(this.capture.startedAt).getTime(),
    );
    const cpuTimes = readCpuTimesSnapshot();
    const systemCpuPercent = calculateSystemCpuPercent(
      this.previousCpuTimes,
      cpuTimes,
    );
    this.previousCpuTimes = cpuTimes;

    const systemMemory = this.getSystemMemory();
    const rendererProcesses = this.getRendererProcesses();
    const electronMetrics = this.getElectronMetrics(rendererProcesses);
    const mainHeapUsedBytes = process.memoryUsage().heapUsed;
    const rendererMetrics = this.getFreshRendererMetrics();
    const rendererHeapUsedBytes =
      rendererMetrics?.rendererHeapUsedBytes ?? null;
    const memoryUsageBytes = calculateMemoryUsageBytes({
      rendererMemoryBytes: electronMetrics.rendererMemoryBytes,
      rendererHeapUsedBytes,
      mainHeapUsedBytes,
    });

    const systemMemoryUsedPercent =
      systemMemory.totalBytes && systemMemory.freeBytes !== null
        ? ((systemMemory.totalBytes - systemMemory.freeBytes) /
            systemMemory.totalBytes) *
          100
        : null;
    const appMemoryPercent =
      memoryUsageBytes !== null && systemMemory.totalBytes
        ? (memoryUsageBytes / systemMemory.totalBytes) * 100
        : null;

    const sample: AppPerformanceSampleDTO = {
      sampledAt: now.toISOString(),
      uptimeMs: Math.round(process.uptime() * 1000),
      captureElapsedMs: elapsedMs,
      route: this.currentRoute,
      fps: rendererMetrics?.fps ?? null,
      systemCpuPercent,
      appCpuPercent: electronMetrics.appCpuPercent,
      systemMemoryUsedPercent,
      systemMemoryTotalBytes: systemMemory.totalBytes,
      systemMemoryFreeBytes: systemMemory.freeBytes,
      appMemoryBytes: memoryUsageBytes,
      appMemoryPercent,
      mainHeapUsedBytes,
      rendererMemoryBytes: electronMetrics.rendererMemoryBytes,
      rendererHeapUsedBytes,
    };

    this.samples.push(sample);
    this.trimSamplesForState();

    this.pendingSamples.push(sample);
    if (this.pendingSamples.length >= FLUSH_EVERY_SAMPLES) {
      this.flushPendingSamples();
    }

    this.sendToRenderer(AppPerformanceChannel.SampleAdded, sample);
  }

  private flushPendingSamples(captureId = this.capture?.id ?? null): boolean {
    if (this.pendingSamples.length === 0) return true;
    if (!captureId) return false;

    const toFlush = this.pendingSamples;
    this.pendingSamples = [];
    try {
      this.repository.insertSamples(captureId, toFlush);
      return true;
    } catch (error) {
      console.error("[AppPerformance] Failed to persist samples:", error);
      this.pendingSamples.unshift(...toFlush);
      return false;
    }
  }

  private trimSamplesForState(): void {
    const trimThreshold =
      MAX_STATE_SAMPLE_POINTS + STATE_SAMPLE_TRIM_BATCH_SIZE;
    if (this.samples.length <= trimThreshold) return;

    this.samples.splice(0, this.samples.length - MAX_STATE_SAMPLE_POINTS);
  }

  private getStateSamples(): AppPerformanceSampleDTO[] {
    if (this.samples.length <= MAX_STATE_SAMPLE_POINTS) {
      return [...this.samples];
    }

    return this.samples.slice(-MAX_STATE_SAMPLE_POINTS);
  }

  private deferPendingSamples(captureId: string): void {
    if (this.pendingSamples.length === 0) return;

    this.deferredSampleFlushes.push({
      captureId,
      samples: [...this.pendingSamples],
    });
    this.pendingSamples = [];
  }

  private flushDeferredSamples(): void {
    if (this.deferredSampleFlushes.length === 0) return;

    const failedFlushes: DeferredSampleFlush[] = [];
    for (const flush of this.deferredSampleFlushes) {
      if (!this.repository.getCapture(flush.captureId)) {
        continue;
      }

      try {
        this.repository.insertSamples(flush.captureId, flush.samples);
      } catch (error) {
        console.error(
          "[AppPerformance] Failed to persist deferred samples:",
          error,
        );
        failedFlushes.push(flush);
      }
    }
    this.deferredSampleFlushes = failedFlushes;
  }

  private dropDeferredSampleFlushes(captureIds: readonly string[]): void {
    if (this.deferredSampleFlushes.length === 0 || captureIds.length === 0) {
      return;
    }

    const deletedIds = new Set(captureIds);
    this.deferredSampleFlushes = this.deferredSampleFlushes.filter(
      (flush) => !deletedIds.has(flush.captureId),
    );
  }

  private clearTimers(): void {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private getFreshRendererMetrics():
    | (RendererPerformanceMetricsDTO & { receivedAt: number })
    | null {
    if (!this.latestRendererMetrics) return null;
    const ageMs = Date.now() - this.latestRendererMetrics.receivedAt;
    return ageMs <= RENDERER_METRIC_STALE_MS
      ? this.latestRendererMetrics
      : null;
  }

  private getRendererProcesses(): {
    primaryRendererPid: number | null;
    rendererPids: number[];
  } {
    const rendererPids = new Set<number>();
    let primaryRendererPid: number | null = null;

    let windows: BrowserWindow[] = [];
    try {
      windows = BrowserWindow.getAllWindows();
    } catch {
      return {
        primaryRendererPid,
        rendererPids: [],
      };
    }

    for (const win of windows) {
      if (win.isDestroyed()) continue;

      try {
        const pid = win.webContents.getOSProcessId();
        if (typeof pid === "number") {
          rendererPids.add(pid);
          if (primaryRendererPid === null && !isOverlayWindow(win)) {
            primaryRendererPid = pid;
          }
        }
      } catch {
        // Ignore windows that are closing or whose renderer PID is unavailable.
      }
    }

    return {
      primaryRendererPid,
      rendererPids: [...rendererPids],
    };
  }

  private getElectronMetrics(rendererProcesses: {
    primaryRendererPid: number | null;
    rendererPids: readonly number[];
  }) {
    try {
      return aggregateElectronMetrics(app.getAppMetrics(), rendererProcesses);
    } catch (error) {
      console.warn("[AppPerformance] Failed to read app metrics:", error);
      return {
        appCpuPercent: null,
        rendererMemoryBytes: null,
      };
    }
  }

  private getSystemMemory(): {
    totalBytes: number | null;
    freeBytes: number | null;
  } {
    const electronProcess = process as ElectronProcessWithSystemMemory;
    const info = electronProcess.getSystemMemoryInfo?.();

    if (info?.total && info?.free !== undefined) {
      return {
        totalBytes: toBytesFromElectronMemory(info.total),
        freeBytes: toBytesFromElectronMemory(info.free),
      };
    }

    return {
      totalBytes: os.totalmem(),
      freeBytes: os.freemem(),
    };
  }

  private sendStateChanged(): void {
    this.sendToRenderer(AppPerformanceChannel.StateChanged, this.getState());
  }

  private sendToRenderer(channel: string, payload: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    }
  }
}

function validateRendererMetrics(metrics: RendererPerformanceMetricsDTO): void {
  if (!metrics || typeof metrics !== "object") {
    throw new IpcValidationError(
      AppPerformanceChannel.RecordRendererMetrics,
      "Expected renderer metrics object",
    );
  }

  validateNullableNumberRange(
    metrics.fps,
    "fps",
    AppPerformanceChannel.RecordRendererMetrics,
    {
      min: 0,
      max: MAX_RENDERER_FPS,
    },
  );
  validateNullableNumberRange(
    metrics.rendererHeapUsedBytes,
    "rendererHeapUsedBytes",
    AppPerformanceChannel.RecordRendererMetrics,
    {
      min: 0,
      max: MAX_RENDERER_HEAP_USED_BYTES,
    },
  );
}

function validateRouteMarkerInput(
  input: AppPerformanceRouteMarkerInputDTO,
): void {
  if (!input || typeof input !== "object") {
    throw new IpcValidationError(
      AppPerformanceChannel.RecordRouteMarker,
      "Expected route marker object",
    );
  }

  assertBoundedString(
    input.route,
    "route",
    AppPerformanceChannel.RecordRouteMarker,
    512,
  );
  assertBoundedString(
    input.label,
    "label",
    AppPerformanceChannel.RecordRouteMarker,
    80,
  );
}

function validateCaptureId(
  captureId: string | undefined,
  channel: AppPerformanceChannel,
  optional = false,
): void {
  if (captureId === undefined || captureId === null) {
    if (optional) return;
    throw new IpcValidationError(channel, "Expected capture id");
  }

  assertBoundedString(captureId, "captureId", channel, 128);
}

function validateCaptureIds(
  captureIds: string[] | undefined,
  channel: AppPerformanceChannel,
): void {
  assertStringArray(captureIds, "captureIds", channel, {
    maxLength: 100,
    maxItemLength: 128,
  });
}

function validateListCapturesInput(
  input?: AppPerformanceListCapturesInputDTO,
): void {
  if (input === undefined || input === null) return;
  if (typeof input !== "object") {
    throw new IpcValidationError(
      AppPerformanceChannel.ListCaptures,
      "Expected capture list options object",
    );
  }

  if (input.page !== undefined) {
    assertNumber(input.page, "page", AppPerformanceChannel.ListCaptures);
    if (input.page < 1) {
      throw new IpcValidationError(
        AppPerformanceChannel.ListCaptures,
        "Page must be at least 1",
      );
    }
  }

  if (input.pageSize !== undefined) {
    assertNumber(
      input.pageSize,
      "pageSize",
      AppPerformanceChannel.ListCaptures,
    );
    if (input.pageSize < 1 || input.pageSize > 100) {
      throw new IpcValidationError(
        AppPerformanceChannel.ListCaptures,
        "Page size must be between 1 and 100",
      );
    }
  }
}

function validateRetention(retention?: AppPerformanceRetention): void {
  if (retention === undefined || retention === null) return;
  if (!["24h", "7d", "indefinite"].includes(retention)) {
    throw new IpcValidationError(
      AppPerformanceChannel.ApplyRetentionCleanup,
      `Invalid retention policy "${retention}"`,
    );
  }
}

function validateNullableNumberRange(
  value: number | null,
  name: string,
  channel: string,
  range: { min: number; max: number },
): void {
  if (value === null) return;
  assertNumber(value, name, channel);
  if (value < range.min || value > range.max) {
    throw new IpcValidationError(
      channel,
      `"${name}" must be between ${range.min} and ${range.max}`,
    );
  }
}

function sanitizeNullableNumber(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toBytesFromElectronMemory(value: number): number {
  return value < 1_000_000_000 ? value * 1024 : value;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function isOverlayWindow(win: BrowserWindow): boolean {
  try {
    return win.webContents.getURL().includes("overlay.html");
  } catch {
    return false;
  }
}

export { AppPerformanceService };
