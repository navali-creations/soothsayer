import path from "node:path";

import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestDatabase,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";
import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";

const {
  mockAppGetAppMetrics,
  mockDialogShowSaveDialog,
  mockFsWriteFile,
  mockAppGetVersion,
  mockBrowserWindowGetAllWindows,
  mockIpcHandle,
  mockPowerMonitorOn,
  mockShellShowItemInFolder,
  mockSettingsGet,
  ipcHandlers,
  powerHandlers,
} = vi.hoisted(() => {
  const handlers = new Map<string, () => void>();
  const ipcHandlerMap = new Map<string, (...args: any[]) => unknown>();

  return {
    mockAppGetAppMetrics: vi.fn(() => []),
    mockDialogShowSaveDialog: vi.fn(),
    mockFsWriteFile: vi.fn().mockResolvedValue(undefined),
    mockAppGetVersion: vi.fn(() => "0.16.0"),
    mockBrowserWindowGetAllWindows: vi.fn(() => []),
    mockIpcHandle: vi.fn(
      (channel: string, handler: (...args: any[]) => unknown) => {
        ipcHandlerMap.set(channel, handler);
      },
    ),
    mockPowerMonitorOn: vi.fn((event: string, handler: () => void) => {
      handlers.set(event, handler);
    }),
    mockShellShowItemInFolder: vi.fn(),
    mockSettingsGet: vi.fn(),
    ipcHandlers: ipcHandlerMap,
    powerHandlers: handlers,
  };
});

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    promises: {
      ...actual.promises,
      writeFile: mockFsWriteFile,
    },
  };
});

vi.mock("electron", () => ({
  app: {
    getAppMetrics: mockAppGetAppMetrics,
    getPath: vi.fn(() => "C:\\Users\\seb\\Desktop"),
    getVersion: mockAppGetVersion,
  },
  BrowserWindow: {
    getAllWindows: mockBrowserWindowGetAllWindows,
  },
  dialog: {
    showSaveDialog: mockDialogShowSaveDialog,
  },
  ipcMain: {
    handle: mockIpcHandle,
  },
  powerMonitor: {
    on: mockPowerMonitorOn,
  },
  shell: {
    showItemInFolder: mockShellShowItemInFolder,
  },
}));

vi.mock("~/main/modules/settings-store", () => ({
  SettingsKey: {
    AppPerformanceRetention: "appPerformanceRetention",
  },
  SettingsStoreService: {
    getInstance: vi.fn(() => ({
      get: mockSettingsGet,
    })),
  },
}));

import { DatabaseService } from "~/main/modules/database";
import { registerTrustedWebContents } from "~/main/utils/ipc-validation";

import { AppPerformanceChannel } from "../AppPerformance.channels";
import type { AppPerformanceSampleDTO } from "../AppPerformance.dto";
import { AppPerformanceService } from "../AppPerformance.service";

vi.mock("~/main/modules/database", () => ({
  DatabaseService: {
    getInstance: vi.fn(),
  },
}));

describe("AppPerformanceService", () => {
  let db: Database.Database;
  let testDb: TestDatabase;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    ipcHandlers.clear();
    powerHandlers.clear();
    resetSingleton(AppPerformanceService);
    testDb = createTestDatabase();
    db = testDb.db;
    vi.mocked(DatabaseService.getInstance).mockReturnValue({
      getDb: () => db,
    } as never);
    mockAppGetAppMetrics.mockReturnValue([]);
    mockBrowserWindowGetAllWindows.mockReturnValue([]);
    mockSettingsGet.mockResolvedValue("7d");
    mockDialogShowSaveDialog.mockResolvedValue({
      canceled: true,
    });
    mockFsWriteFile.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    vi.useRealTimers();
    resetSingleton(AppPerformanceService);
    await testDb.close();
  });

  function makeWindow(rendererPid?: number, url = "app://index.html") {
    return {
      isDestroyed: vi.fn(() => false),
      webContents: {
        getOSProcessId: vi.fn(() => rendererPid ?? 0),
        getURL: vi.fn(() => url),
        send: vi.fn(),
      },
    };
  }

  function makeStoppedCapture(service: AppPerformanceService) {
    service.startCapture();
    const activeId = service.getState().capture?.id;
    expect(activeId).toBeTruthy();
    return service.stopCapture().then(() => activeId!);
  }

  function createDeferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  function trustedEvent() {
    registerTrustedWebContents({ id: 1 } as never);
    return { sender: { id: 1 } } as never;
  }

  function getHandler(channel: AppPerformanceChannel) {
    const handler = ipcHandlers.get(channel);
    expect(handler).toBeTypeOf("function");
    return handler!;
  }

  function appPerformanceSample(index: number): AppPerformanceSampleDTO {
    return {
      sampledAt: `sample-${index}`,
      uptimeMs: index * 1_000,
      captureElapsedMs: index * 1_000,
      route: null,
      fps: null,
      systemCpuPercent: null,
      appCpuPercent: null,
      systemMemoryUsedPercent: null,
      systemMemoryTotalBytes: null,
      systemMemoryFreeBytes: null,
      appMemoryBytes: null,
      appMemoryPercent: null,
      mainHeapUsedBytes: null,
      rendererMemoryBytes: null,
      rendererHeapUsedBytes: null,
    };
  }

  it("initializes by closing open captures and applying retention cleanup", async () => {
    const service = AppPerformanceService.getInstance();
    db.prepare(
      "INSERT INTO app_performance_captures (id, started_at, stopped_at) VALUES (?, ?, NULL)",
    ).run("open-capture", "2024-01-01T00:00:00.000Z");
    mockSettingsGet.mockResolvedValue("24h");

    await service.initialize();

    const row = db
      .prepare("SELECT stopped_at FROM app_performance_captures WHERE id = ?")
      .get("open-capture") as { stopped_at: string | null } | undefined;

    expect(row?.stopped_at).not.toBeNull();
    expect(service.listCaptures().total).toBe(0);
  });

  it("returns an empty state when there are no captures", () => {
    const service = AppPerformanceService.getInstance();

    expect(service.getState()).toEqual({
      capture: null,
      isSampling: false,
      samples: [],
      routeMarkers: [],
    });
  });

  it("returns paged capture history with bounded page and page size", async () => {
    const service = AppPerformanceService.getInstance();

    await makeStoppedCapture(service);
    await makeStoppedCapture(service);

    const history = service.listCaptures({ page: 5, pageSize: 1 });

    expect(history.total).toBe(2);
    expect(history.page).toBe(2);
    expect(history.pageSize).toBe(1);
    expect(history.totalPages).toBe(2);
    expect(history.captures).toHaveLength(1);
  });

  it("returns the active capture state for the active id and an empty state for a missing id", () => {
    const service = AppPerformanceService.getInstance();
    const state = service.startCapture();

    expect(service.getCaptureState(state.capture!.id).isSampling).toBe(true);
    expect(service.getCaptureState("missing-capture")).toEqual({
      capture: null,
      isSampling: false,
      samples: [],
      routeMarkers: [],
    });
  });

  it("does not delete an active capture", () => {
    const service = AppPerformanceService.getInstance();
    const state = service.startCapture();

    expect(service.deleteCapture(state.capture!.id)).toEqual({
      success: false,
      error: "Stop diagnostics before deleting this capture.",
    });
  });

  it("reports whether an inactive capture was deleted", () => {
    const service = AppPerformanceService.getInstance();

    expect(service.deleteCapture("missing-capture")).toEqual({
      success: true,
      deleted: false,
    });
  });

  it("deletes inactive captures in a bounded main-owned batch", async () => {
    const service = AppPerformanceService.getInstance();
    const first = await makeStoppedCapture(service);
    const second = await makeStoppedCapture(service);
    service.startCapture();
    const activeId = service.getState().capture!.id;

    expect(service.deleteCaptures([first, second])).toEqual({
      success: true,
      deletedCount: 2,
    });
    expect(service.getCaptureState(first).capture).toBeNull();
    expect(service.getCaptureState(second).capture).toBeNull();

    expect(service.deleteCaptures([activeId])).toEqual({
      success: false,
      error: "Stop diagnostics before deleting selected captures.",
    });
    expect(service.getCaptureState(activeId).capture?.id).toBe(activeId);
  });

  it("returns the existing state when starting or stopping is idempotent", async () => {
    const service = AppPerformanceService.getInstance();
    const first = service.startCapture();

    expect(service.startCapture().capture?.id).toBe(first.capture?.id);

    await service.stopCapture();

    expect(await service.stopCapture()).toMatchObject({
      isSampling: false,
    });
  });

  it("starts a fresh capture by stopping the previous active capture", async () => {
    const service = AppPerformanceService.getInstance();
    const first = service.startCapture().capture!.id;

    const state = await service.startFreshCapture();

    expect(state.capture?.id).not.toBe(first);
    expect(service.listCaptures().total).toBe(2);
  });

  it("records renderer metrics, route markers, and sample notifications", async () => {
    vi.useFakeTimers();
    const window = makeWindow(20);
    const overlayWindow = makeWindow(30, "app://overlay.html");
    mockBrowserWindowGetAllWindows.mockReturnValue([window, overlayWindow]);
    mockAppGetAppMetrics.mockReturnValue([
      {
        pid: 10,
        type: "Browser",
        cpu: { percentCPUUsage: 3 },
        memory: { workingSetSize: 1_024 },
      },
      {
        pid: 20,
        type: "Tab",
        cpu: { percentCPUUsage: 2 },
        memory: { workingSetSize: 2_048, privateBytes: 512 },
      },
      {
        pid: 30,
        type: "Tab",
        cpu: { percentCPUUsage: 1 },
        memory: { workingSetSize: 4_096, privateBytes: 1_024 },
      },
    ]);
    const service = AppPerformanceService.getInstance();

    service.startCapture();
    await Promise.resolve();
    service.recordRendererMetrics({
      fps: 58.7,
      rendererHeapUsedBytes: Number.NaN,
    });
    const marker = service.recordRouteMarker({
      route: "/cards/the-doctor",
      label: "/cards/:id",
    });
    const duplicate = service.recordRouteMarker({
      route: "/cards/the-doctor",
      label: "/cards/:id",
    });

    vi.advanceTimersByTime(1_000);

    const state = service.getState();
    const latest = state.samples.at(-1);

    expect(marker).not.toBeNull();
    expect(duplicate?.id).toBe(marker?.id);
    expect(state.routeMarkers).toHaveLength(1);
    expect(latest?.route).toBe("/cards/the-doctor");
    expect(latest?.fps).toBe(58.7);
    expect(latest?.rendererHeapUsedBytes).toBeNull();
    expect(latest?.appCpuPercent).toBe(6);
    expect(latest?.rendererMemoryBytes).toBe(3_072 * 1024);
    expect(window.webContents.send).toHaveBeenCalledWith(
      AppPerformanceChannel.RouteMarkerAdded,
      marker,
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      AppPerformanceChannel.SampleAdded,
      expect.objectContaining({ route: "/cards/the-doctor" }),
    );

    await service.stopCapture();
  });

  it("records overlay markers without replacing the sampled route", async () => {
    vi.useFakeTimers();
    const window = makeWindow(20);
    mockBrowserWindowGetAllWindows.mockReturnValue([window as never]);
    mockAppGetAppMetrics.mockReturnValue([
      {
        pid: 20,
        type: "Tab",
        cpu: { percentCPUUsage: 1 },
        memory: { workingSetSize: 2_048, privateBytes: 512 },
      },
    ]);
    const service = AppPerformanceService.getInstance();

    const captureId = service.startCapture().capture!.id;
    service.recordRouteMarker({
      route: "/cards/the-doctor",
      label: "/cards/:id",
    });
    const opened = service.recordOverlayMarker(true);
    const duplicateOpened = service.recordOverlayMarker(true);
    const closed = service.recordOverlayMarker(false);

    vi.advanceTimersByTime(1_000);

    const state = service.getState();

    expect(opened).toMatchObject({
      route: "/overlay/opened",
      label: "Overlay opened",
    });
    expect(duplicateOpened?.id).toBe(opened?.id);
    expect(closed).toMatchObject({
      route: "/overlay/closed",
      label: "Overlay closed",
    });
    expect(state.routeMarkers.map((marker) => marker.route)).toEqual([
      "/cards/the-doctor",
      "/overlay/opened",
      "/overlay/closed",
    ]);
    expect(state.samples.at(-1)?.route).toBe("/cards/the-doctor");
    expect(window.webContents.send).toHaveBeenCalledWith(
      AppPerformanceChannel.RouteMarkerAdded,
      opened,
    );
    expect(window.webContents.send).toHaveBeenCalledWith(
      AppPerformanceChannel.RouteMarkerAdded,
      closed,
    );
    expect(service.getCaptureState(captureId).routeMarkers).toHaveLength(3);

    await service.stopCapture();
  });

  it("starts a fresh capture without carrying over the previous route", async () => {
    vi.useFakeTimers();
    const service = AppPerformanceService.getInstance();

    service.startCapture();
    service.recordRouteMarker({
      route: "/cards/the-doctor",
      label: "/cards/:id",
    });
    vi.advanceTimersByTime(1_000);
    expect(service.getState().samples.at(-1)?.route).toBe("/cards/the-doctor");

    await service.stopCapture();
    const freshState = service.startCapture();

    expect(freshState.samples.at(-1)?.route).toBeNull();
    await service.stopCapture();
  });

  it("samples through interval timers and flushes pending samples", async () => {
    vi.useFakeTimers();
    const service = AppPerformanceService.getInstance();

    service.startCapture();

    await vi.advanceTimersByTimeAsync(10_000);

    const state = service.getState();
    expect(state.samples.length).toBeGreaterThanOrEqual(10);

    await service.stopCapture();
  });

  it("keeps live samples beyond the previous one-hour window", async () => {
    const service = AppPerformanceService.getInstance();
    const internals = service as unknown as {
      sampleNow: () => void;
    };

    const captureId = service.startCapture().capture!.id;

    for (let index = 0; index < 3_605; index += 1) {
      internals.sampleNow();
    }

    expect(service.getState().samples).toHaveLength(3_606);

    await service.stopCapture();

    expect(service.getCaptureState(captureId).samples).toHaveLength(3_606);
  });

  it("bounds long state sample payloads to the latest rolling window", async () => {
    const service = AppPerformanceService.getInstance();
    const internals = service as unknown as {
      samples: AppPerformanceSampleDTO[];
      trimSamplesForState: () => void;
    };

    service.startCapture();
    internals.samples = Array.from({ length: 86_461 }, (_, index) =>
      appPerformanceSample(index),
    );
    internals.trimSamplesForState();

    expect(service.getState().samples).toHaveLength(86_400);
    expect(service.getState().samples[0]?.sampledAt).toBe("sample-61");
    expect(service.getState().samples.at(-1)?.captureElapsedMs).toBe(
      86_460_000,
    );

    await service.stopCapture();
  });

  it("keeps pending samples when persistence fails", () => {
    const service = AppPerformanceService.getInstance();
    service.startCapture();
    const internals = service as unknown as {
      repository: { insertSamples: ReturnType<typeof vi.fn> };
      pendingSamples: unknown[];
      flushPendingSamples: () => void;
    };
    internals.repository.insertSamples = vi.fn(() => {
      throw new Error("sqlite locked");
    });

    internals.flushPendingSamples();

    expect(internals.pendingSamples.length).toBeGreaterThan(0);
  });

  it("defers final samples when stop-time persistence fails and retries later", async () => {
    const service = AppPerformanceService.getInstance();
    service.startCapture();
    const captureId = service.getState().capture!.id;
    const internals = service as unknown as {
      repository: {
        insertSamples: (
          captureId: string,
          samples: Array<Record<string, unknown>>,
        ) => void;
      };
      pendingSamples: unknown[];
      deferredSampleFlushes: unknown[];
    };
    const originalInsertSamples = internals.repository.insertSamples.bind(
      internals.repository,
    );
    const insertSamplesSpy = vi.spyOn(internals.repository, "insertSamples");
    insertSamplesSpy.mockImplementationOnce(() => {
      throw new Error("sqlite locked");
    });

    await service.stopCapture();

    const countSamples = () =>
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM app_performance_samples WHERE collection_id = ?",
          )
          .get(captureId) as { count: number }
      ).count;

    expect(internals.pendingSamples).toHaveLength(0);
    expect(internals.deferredSampleFlushes).toHaveLength(1);
    expect(countSamples()).toBe(0);

    insertSamplesSpy.mockImplementation(originalInsertSamples);
    service.listCaptures();

    expect(internals.deferredSampleFlushes).toHaveLength(0);
    expect(countSamples()).toBeGreaterThan(0);
  });

  it("drops deferred samples for captures deleted after retry failures", async () => {
    const service = AppPerformanceService.getInstance();
    service.startCapture();
    const captureId = service.getState().capture!.id;
    const internals = service as unknown as {
      repository: {
        insertSamples: (
          captureId: string,
          samples: Array<Record<string, unknown>>,
        ) => void;
      };
      deferredSampleFlushes: unknown[];
    };
    const insertSamplesSpy = vi.spyOn(internals.repository, "insertSamples");
    insertSamplesSpy.mockImplementationOnce(() => {
      throw new Error("sqlite locked");
    });

    await service.stopCapture();
    expect(internals.deferredSampleFlushes).toHaveLength(1);

    insertSamplesSpy.mockImplementation(() => {
      throw new Error("sqlite locked");
    });

    expect(service.deleteCapture(captureId)).toEqual({
      success: true,
      deleted: true,
    });
    expect(internals.deferredSampleFlushes).toHaveLength(0);
  });

  it("falls back when renderer process and app metrics cannot be read", () => {
    const window = makeWindow(20);
    window.webContents.getOSProcessId.mockImplementation(() => {
      throw new Error("renderer gone");
    });
    mockBrowserWindowGetAllWindows.mockReturnValue([window]);
    mockAppGetAppMetrics.mockImplementation(() => {
      throw new Error("metrics gone");
    });
    const service = AppPerformanceService.getInstance();

    service.startCapture();

    const latest = service.getState().samples.at(-1);
    expect(latest?.appCpuPercent).toBeNull();
    expect(latest?.rendererMemoryBytes).toBeNull();
  });

  it("uses Electron system memory information when it is available", () => {
    const original = (
      process as NodeJS.Process & {
        getSystemMemoryInfo?: () => { total: number; free: number };
      }
    ).getSystemMemoryInfo;
    (
      process as NodeJS.Process & {
        getSystemMemoryInfo?: () => { total: number; free: number };
      }
    ).getSystemMemoryInfo = () => ({ total: 1024, free: 512 });
    const service = AppPerformanceService.getInstance();

    try {
      service.startCapture();

      const latest = service.getState().samples.at(-1);
      expect(latest?.systemMemoryTotalBytes).toBe(1024 * 1024);
      expect(latest?.systemMemoryFreeBytes).toBe(512 * 1024);
    } finally {
      (
        process as NodeJS.Process & {
          getSystemMemoryInfo?: () => { total: number; free: number };
        }
      ).getSystemMemoryInfo = original;
    }
  });

  it("limits in-memory route markers to the configured maximum", () => {
    const service = AppPerformanceService.getInstance();
    service.startCapture();

    for (let index = 0; index < 1_005; index++) {
      service.recordRouteMarker({
        route: `/route-${index}`,
        label: `/route-${index}`,
      });
    }

    expect(service.getState().routeMarkers).toHaveLength(1_000);
  });

  it("ignores route markers when no capture is active", () => {
    const service = AppPerformanceService.getInstance();

    expect(
      service.recordRouteMarker({
        route: "/current-session",
        label: "/current-session",
      }),
    ).toBeNull();
  });

  it("applies explicit retention cleanup", async () => {
    const service = AppPerformanceService.getInstance();
    db.prepare(
      "INSERT INTO app_performance_captures (id, started_at, stopped_at) VALUES (?, ?, ?)",
    ).run(
      "old-capture",
      "2024-01-01T00:00:00.000Z",
      "2024-01-01T00:01:00.000Z",
    );

    const deleted = await service.applyRetentionCleanup("24h");

    expect(deleted).toBe(1);
  });

  it("returns export errors when no stopped capture can be exported", async () => {
    const service = AppPerformanceService.getInstance();

    await expect(service.exportReport()).resolves.toEqual({
      success: false,
      error: "No diagnostics capture is available to export.",
    });

    service.startCapture();
    await expect(service.exportReport()).resolves.toEqual({
      success: false,
      error: "Stop diagnostics before exporting the report.",
    });
  });

  it("exports a stopped diagnostics report to a selected file", async () => {
    const service = AppPerformanceService.getInstance();
    const captureId = await makeStoppedCapture(service);
    const window = makeWindow();
    const reportPath = path.join("tmp", "report.txt");
    mockBrowserWindowGetAllWindows.mockReturnValue([window]);
    mockDialogShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: reportPath,
    });

    const result = await service.exportReport(captureId);

    expect(result).toEqual({
      success: true,
      fileName: "report.txt",
    });
    expect(mockFsWriteFile).toHaveBeenCalledWith(
      reportPath,
      expect.stringContaining("Soothsayer App Performance Report"),
      "utf-8",
    );
    expect(mockShellShowItemInFolder).toHaveBeenCalledWith(reportPath);
  });

  it("handles canceled export dialogs and missing main windows", async () => {
    const service = AppPerformanceService.getInstance();
    const captureId = await makeStoppedCapture(service);

    await expect(service.exportReport(captureId)).resolves.toEqual({
      success: false,
      error: "Main window not available.",
    });

    mockBrowserWindowGetAllWindows.mockReturnValue([makeWindow()]);
    mockDialogShowSaveDialog.mockResolvedValue({ canceled: true });

    await expect(service.exportReport(captureId)).resolves.toEqual({
      success: false,
      canceled: true,
    });
  });

  it("wraps export write failures in a user-facing error", async () => {
    const service = AppPerformanceService.getInstance();
    const captureId = await makeStoppedCapture(service);
    mockBrowserWindowGetAllWindows.mockReturnValue([makeWindow()]);
    mockDialogShowSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: "C:\\report.txt",
    });
    mockFsWriteFile.mockRejectedValue(new Error("disk full"));

    await expect(service.exportReport(captureId)).resolves.toEqual({
      success: false,
      error: "Failed to export diagnostics report.",
    });
  });

  it("registers IPC handlers and validates invalid inputs", async () => {
    AppPerformanceService.getInstance();
    const event = trustedEvent();

    expect(
      getHandler(AppPerformanceChannel.GetState)({ sender: { id: 99 } }),
    ).toEqual({
      success: false,
      error: expect.stringContaining("untrusted webContents"),
    });
    expect(
      getHandler(AppPerformanceChannel.ListCaptures)(event, { page: 0 }),
    ).toEqual({
      success: false,
      error: "Invalid input: Page must be at least 1",
    });
    expect(
      getHandler(AppPerformanceChannel.ListCaptures)(event, "bad"),
    ).toEqual({
      success: false,
      error: "Invalid input: Expected capture list options object",
    });
    expect(
      getHandler(AppPerformanceChannel.ListCaptures)(event, { pageSize: 101 }),
    ).toEqual({
      success: false,
      error: "Invalid input: Page size must be between 1 and 100",
    });
    expect(
      getHandler(AppPerformanceChannel.DeleteCapture)(event, undefined),
    ).toEqual({
      success: false,
      error: "Invalid input: Expected capture id",
    });
    expect(
      getHandler(AppPerformanceChannel.DeleteCaptures)(event, "bad"),
    ).toEqual({
      success: false,
      error: 'Invalid input: Expected "captureIds" to be an array, got string',
    });
    expect(
      getHandler(AppPerformanceChannel.DeleteCaptures)(event, [
        "x".repeat(129),
      ]),
    ).toEqual({
      success: false,
      error: 'Invalid input: "captureIds[0]" exceeds max length of 128',
    });
    expect(
      getHandler(AppPerformanceChannel.RecordRendererMetrics)(event, null),
    ).toEqual({
      success: false,
      error: "Invalid input: Expected renderer metrics object",
    });
    expect(
      getHandler(AppPerformanceChannel.RecordRendererMetrics)(event, {
        fps: "fast",
        rendererHeapUsedBytes: 1,
      }),
    ).toEqual({
      success: false,
      error: 'Invalid input: Expected "fps" to be a finite number, got string',
    });
    expect(
      getHandler(AppPerformanceChannel.RecordRendererMetrics)(event, {
        fps: -1,
        rendererHeapUsedBytes: 1,
      }),
    ).toEqual({
      success: false,
      error: 'Invalid input: "fps" must be between 0 and 1000',
    });
    expect(
      getHandler(AppPerformanceChannel.RecordRendererMetrics)(event, {
        fps: 60,
        rendererHeapUsedBytes: 1024 ** 5,
      }),
    ).toEqual({
      success: false,
      error:
        'Invalid input: "rendererHeapUsedBytes" must be between 0 and 1099511627776',
    });
    expect(
      getHandler(AppPerformanceChannel.RecordRouteMarker)(event, null),
    ).toEqual({
      success: false,
      error: "Invalid input: Expected route marker object",
    });
    expect(
      getHandler(AppPerformanceChannel.GetCaptureState)(event, undefined),
    ).toEqual({
      success: false,
      error: "Invalid input: Expected capture id",
    });
    await expect(
      getHandler(AppPerformanceChannel.ApplyRetentionCleanup)(event, "forever"),
    ).resolves.toEqual({
      success: false,
      error: 'Invalid input: Invalid retention policy "forever"',
    });
    await expect(
      getHandler(AppPerformanceChannel.ExportReport)(event, 123),
    ).resolves.toEqual({
      success: false,
      error: 'Invalid input: Expected "captureId" to be a string, got number',
    });
  });

  it("returns IPC handler results for valid inputs", async () => {
    const service = AppPerformanceService.getInstance();
    const event = trustedEvent();

    expect(getHandler(AppPerformanceChannel.GetState)(event)).toMatchObject({
      isSampling: false,
    });
    const startState = getHandler(AppPerformanceChannel.StartCapture)(event);
    expect(startState).toMatchObject({ isSampling: true });

    expect(
      getHandler(AppPerformanceChannel.RecordRendererMetrics)(event, {
        fps: 60,
        rendererHeapUsedBytes: 4096,
      }),
    ).toEqual({ success: true });
    expect(
      getHandler(AppPerformanceChannel.RecordRouteMarker)(event, {
        route: "/settings",
        label: "/settings",
      }),
    ).toMatchObject({ route: "/settings", label: "/settings" });

    await expect(
      getHandler(AppPerformanceChannel.StopCapture)(event),
    ).resolves.toMatchObject({ isSampling: false });
    await service.shutdown();
  });

  it("does not broadcast a duplicate full state for direct IPC stops", async () => {
    const window = makeWindow();
    mockBrowserWindowGetAllWindows.mockReturnValue([window]);
    AppPerformanceService.getInstance();
    const event = trustedEvent();

    getHandler(AppPerformanceChannel.StartCapture)(event);
    window.webContents.send.mockClear();

    await expect(
      getHandler(AppPerformanceChannel.StopCapture)(event),
    ).resolves.toMatchObject({ isSampling: false });

    expect(window.webContents.send).not.toHaveBeenCalledWith(
      AppPerformanceChannel.StateChanged,
      expect.anything(),
    );
  });

  it("serializes concurrent stop calls through the same promise", async () => {
    const deferred = createDeferred<"7d">();
    mockSettingsGet.mockReturnValue(deferred.promise);
    const service = AppPerformanceService.getInstance();
    service.startCapture();

    const first = service.stopCapture();
    const second = service.stopCapture();
    deferred.resolve("7d");

    await expect(second).resolves.toBe(await first);
  });

  it("clears timers and pending samples when shutdown stop promises fail", async () => {
    const service = AppPerformanceService.getInstance();
    service.startCapture();
    const internals = service as unknown as {
      stopCapturePromise: Promise<never>;
      shutdown: () => Promise<void>;
    };
    internals.stopCapturePromise = Promise.reject(new Error("stop failed"));

    await expect(service.shutdown()).resolves.toBeUndefined();
  });

  it("clears timers and pending samples when active shutdown stop fails", async () => {
    const service = AppPerformanceService.getInstance();
    service.startCapture();
    vi.spyOn(service, "stopCapture").mockRejectedValueOnce(
      new Error("stop failed"),
    );

    await expect(service.shutdown()).resolves.toBeUndefined();
  });

  it("clears timers when shutting down without an active capture", async () => {
    const service = AppPerformanceService.getInstance();

    await expect(service.shutdown()).resolves.toBeUndefined();
  });

  it("stops an active diagnostics capture when the system suspends", async () => {
    const service = AppPerformanceService.getInstance();

    service.startCapture();
    const activeState = service.getState();

    expect(activeState.isSampling).toBe(true);
    expect(activeState.capture?.stoppedAt).toBeNull();
    expect(mockPowerMonitorOn).toHaveBeenCalledWith(
      "suspend",
      expect.any(Function),
    );

    powerHandlers.get("suspend")?.();

    await vi.waitFor(() => {
      const suspendedState = service.getState();
      expect(suspendedState.isSampling).toBe(false);
      expect(suspendedState.capture?.id).toBe(activeState.capture?.id);
      expect(suspendedState.capture?.stoppedAt).not.toBeNull();
    });
  });

  it("ignores suspend events when no capture is active and clears timers when suspend stop fails", async () => {
    const service = AppPerformanceService.getInstance();

    powerHandlers.get("suspend")?.();
    expect(service.getState().isSampling).toBe(false);

    service.startCapture();
    vi.spyOn(service, "stopCapture").mockRejectedValueOnce(
      new Error("stop failed"),
    );

    powerHandlers.get("suspend")?.();

    await Promise.resolve();
    expect(service.getState().samples.length).toBeGreaterThan(0);
  });
});
