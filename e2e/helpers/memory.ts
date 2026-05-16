/**
 * E2E Memory Profiling Helpers
 *
 * Provides utilities for measuring memory usage of both the Electron main process
 * and the renderer process during E2E tests. These helpers enable:
 *
 * - Capturing memory snapshots (heap, RSS, external) from the main process
 * - Capturing JS heap metrics from the renderer (Chrome DevTools `performance.memory`)
 * - Taking baselines and computing deltas between snapshots
 * - Forcing garbage collection before measurements (when `--expose-gc` is available)
 * - Formatting memory values for human-readable test output
 *
 * ## Usage
 *
 * ```ts
 * import { captureMainMemory, captureRendererMemory, MemoryProfiler } from "../helpers/memory";
 *
 * // One-shot snapshot
 * const mainMem = await captureMainMemory(app);
 * console.log(`Main heap: ${formatBytes(mainMem.heapUsed)}`);
 *
 * // Profiler for tracking deltas across a test
 * const profiler = new MemoryProfiler(app, page);
 * await profiler.baseline();
 * // ... do stuff ...
 * const report = await profiler.snapshot("after card sync");
 * console.log(report.summary);
 * ```
 *
 * ## Notes
 *
 * - `performance.memory` is a Chrome-only API but is always available in Electron's
 *   Chromium renderer. It requires no flags.
 * - For the main process, `process.memoryUsage()` is always available.
 * - To enable `global.gc()` for forced GC, pass `--js-flags=--expose-gc` via
 *   the `electronArgs` fixture in `electron-test.ts`.
 * - Memory measurements are inherently noisy. Tests using these helpers should
 *   use generous thresholds and focus on detecting large regressions (e.g., >50 MB
 *   growth) rather than exact values.
 *
 * @module e2e/helpers/memory
 */

import type { ElectronApplication, Page } from "@playwright/test";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Memory snapshot from the Electron main process.
 * Values mirror `process.memoryUsage()` — all in bytes.
 */
export interface MainProcessMemory {
  /** Resident Set Size — total memory allocated for the process */
  rss: number;
  /** Total size of the allocated V8 heap */
  heapTotal: number;
  /** Portion of the V8 heap that is in active use */
  heapUsed: number;
  /** Memory used by C++ objects bound to JS (e.g., Buffers, native modules) */
  external: number;
  /** Memory allocated for ArrayBuffers and SharedArrayBuffers */
  arrayBuffers: number;
  /** Timestamp of the measurement (ms since epoch) */
  timestamp: number;
}

/**
 * Memory snapshot from the Chromium renderer process.
 * Values come from `performance.memory` (Chrome-only, always available in Electron).
 * All values in bytes.
 */
export interface RendererMemory {
  /** Maximum heap size available to the renderer */
  jsHeapSizeLimit: number;
  /** Total allocated JS heap size */
  totalJSHeapSize: number;
  /** Currently used portion of the JS heap */
  usedJSHeapSize: number;
  /** Timestamp of the measurement (ms since epoch) */
  timestamp: number;
}

/**
 * Combined memory snapshot from both processes.
 */
export interface MemorySnapshot {
  label: string;
  main: MainProcessMemory;
  renderer: RendererMemory;
  timestamp: number;
}

/**
 * Delta between two snapshots, with both absolute and relative values.
 */
export interface MemoryDelta {
  fromLabel: string;
  toLabel: string;
  /** Duration between snapshots (ms) */
  elapsed: number;
  main: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  renderer: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
  };
}

/**
 * A profiler report with the snapshot, optional delta from baseline, and a
 * human-readable summary string for logging in test output.
 */
export interface MemoryReport {
  snapshot: MemorySnapshot;
  delta: MemoryDelta | null;
  summary: string;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

/**
 * Format a byte value into a human-readable string (e.g., "12.45 MB").
 */
export function formatBytes(bytes: number): string {
  const sign = bytes < 0 ? "-" : "";
  const abs = Math.abs(bytes);

  if (abs < 1024) return `${sign}${abs} B`;
  if (abs < 1024 * 1024) return `${sign}${(abs / 1024).toFixed(2)} KB`;
  if (abs < 1024 * 1024 * 1024)
    return `${sign}${(abs / (1024 * 1024)).toFixed(2)} MB`;
  return `${sign}${(abs / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Format a signed delta value with +/- prefix.
 */
export function formatDelta(bytes: number): string {
  const prefix = bytes >= 0 ? "+" : "";
  return `${prefix}${formatBytes(bytes)}`;
}

// ─── Snapshot Capture ─────────────────────────────────────────────────────────

/**
 * Attempt to trigger garbage collection in the main process.
 * Only works if Electron was launched with `--js-flags=--expose-gc`.
 * Silently no-ops otherwise.
 */
export async function tryGCMain(app: ElectronApplication): Promise<boolean> {
  return app.evaluate(() => {
    if (typeof globalThis.gc === "function") {
      globalThis.gc();
      return true;
    }
    return false;
  });
}

/**
 * Attempt to trigger garbage collection in the renderer process.
 * Only works if the renderer was launched with `--js-flags=--expose-gc`.
 * Silently no-ops otherwise.
 */
export async function tryGCRenderer(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    if (typeof (globalThis as any).gc === "function") {
      (globalThis as any).gc();
      return true;
    }
    return false;
  });
}

/**
 * Capture a memory snapshot from the Electron main process.
 *
 * Optionally triggers GC before measuring (if `--expose-gc` is available)
 * and waits a short stabilization period to let freed memory be reclaimed.
 */
export async function captureMainMemory(
  app: ElectronApplication,
  options: { gc?: boolean; stabilizeMs?: number } = {},
): Promise<MainProcessMemory> {
  const { gc = true, stabilizeMs = 100 } = options;

  if (gc) {
    await tryGCMain(app);
    if (stabilizeMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, stabilizeMs));
    }
  }

  return app.evaluate(() => {
    const mem = process.memoryUsage();
    return {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
      timestamp: Date.now(),
    };
  });
}

/**
 * Capture a memory snapshot from the Chromium renderer process.
 *
 * Uses `performance.memory` which is a Chrome-only API (always available
 * in Electron's Chromium renderer without any flags).
 *
 * Optionally triggers GC before measuring if `--expose-gc` is available.
 */
export async function captureRendererMemory(
  page: Page,
  options: { gc?: boolean; stabilizeMs?: number } = {},
): Promise<RendererMemory> {
  const { gc = true, stabilizeMs = 100 } = options;

  if (gc) {
    await tryGCRenderer(page);
    if (stabilizeMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, stabilizeMs));
    }
  }

  return page.evaluate(() => {
    const perf = (performance as any).memory;
    if (!perf) {
      // Fallback if performance.memory is somehow unavailable
      return {
        jsHeapSizeLimit: 0,
        totalJSHeapSize: 0,
        usedJSHeapSize: 0,
        timestamp: Date.now(),
      };
    }
    return {
      jsHeapSizeLimit: perf.jsHeapSizeLimit,
      totalJSHeapSize: perf.totalJSHeapSize,
      usedJSHeapSize: perf.usedJSHeapSize,
      timestamp: Date.now(),
    };
  });
}

/**
 * Capture a combined memory snapshot from both processes.
 */
export async function captureMemorySnapshot(
  app: ElectronApplication,
  page: Page,
  label: string,
  options: { gc?: boolean; stabilizeMs?: number } = {},
): Promise<MemorySnapshot> {
  // Capture both in parallel for minimal timing skew
  const [main, renderer] = await Promise.all([
    captureMainMemory(app, options),
    captureRendererMemory(page, options),
  ]);

  return {
    label,
    main,
    renderer,
    timestamp: Date.now(),
  };
}

/**
 * Compute the delta between two memory snapshots.
 */
export function computeDelta(
  from: MemorySnapshot,
  to: MemorySnapshot,
): MemoryDelta {
  return {
    fromLabel: from.label,
    toLabel: to.label,
    elapsed: to.timestamp - from.timestamp,
    main: {
      rss: to.main.rss - from.main.rss,
      heapUsed: to.main.heapUsed - from.main.heapUsed,
      heapTotal: to.main.heapTotal - from.main.heapTotal,
      external: to.main.external - from.main.external,
    },
    renderer: {
      usedJSHeapSize: to.renderer.usedJSHeapSize - from.renderer.usedJSHeapSize,
      totalJSHeapSize:
        to.renderer.totalJSHeapSize - from.renderer.totalJSHeapSize,
    },
  };
}

/**
 * Format a snapshot into a multi-line human-readable summary.
 */
export function formatSnapshot(snapshot: MemorySnapshot): string {
  const lines = [
    `📊 Memory Snapshot: "${snapshot.label}"`,
    `   Main Process:`,
    `     RSS:          ${formatBytes(snapshot.main.rss)}`,
    `     Heap Used:    ${formatBytes(snapshot.main.heapUsed)}`,
    `     Heap Total:   ${formatBytes(snapshot.main.heapTotal)}`,
    `     External:     ${formatBytes(snapshot.main.external)}`,
    `     ArrayBuffers: ${formatBytes(snapshot.main.arrayBuffers)}`,
    `   Renderer:`,
    `     JS Heap Used:  ${formatBytes(snapshot.renderer.usedJSHeapSize)}`,
    `     JS Heap Total: ${formatBytes(snapshot.renderer.totalJSHeapSize)}`,
    `     JS Heap Limit: ${formatBytes(snapshot.renderer.jsHeapSizeLimit)}`,
  ];
  return lines.join("\n");
}

/**
 * Format a delta into a multi-line human-readable summary.
 */
export function formatDeltaSummary(delta: MemoryDelta): string {
  const lines = [
    `📈 Memory Delta: "${delta.fromLabel}" → "${delta.toLabel}" (${(delta.elapsed / 1000).toFixed(1)}s)`,
    `   Main Process:`,
    `     RSS:       ${formatDelta(delta.main.rss)}`,
    `     Heap Used: ${formatDelta(delta.main.heapUsed)}`,
    `     External:  ${formatDelta(delta.main.external)}`,
    `   Renderer:`,
    `     JS Heap Used:  ${formatDelta(delta.renderer.usedJSHeapSize)}`,
    `     JS Heap Total: ${formatDelta(delta.renderer.totalJSHeapSize)}`,
  ];
  return lines.join("\n");
}

// ─── MemoryProfiler ───────────────────────────────────────────────────────────

/**
 * Stateful memory profiler that tracks snapshots over the lifetime of a test
 * (or test suite) and computes deltas from a recorded baseline.
 *
 * ## Example
 *
 * ```ts
 * const profiler = new MemoryProfiler(app, page);
 * await profiler.baseline();
 *
 * // ... perform operations ...
 *
 * const report = await profiler.snapshot("after card sync");
 * console.log(report.summary);
 * expect(report.delta!.main.heapUsed).toBeLessThan(50 * 1024 * 1024); // <50 MB growth
 *
 * // Get all snapshots at the end
 * const all = profiler.allSnapshots();
 * ```
 */
export class MemoryProfiler {
  private app: ElectronApplication;
  private page: Page;
  private _baseline: MemorySnapshot | null = null;
  private _snapshots: MemorySnapshot[] = [];
  private gcEnabled: boolean;
  private stabilizeMs: number;

  constructor(
    app: ElectronApplication,
    page: Page,
    options: { gc?: boolean; stabilizeMs?: number } = {},
  ) {
    this.app = app;
    this.page = page;
    this.gcEnabled = options.gc ?? true;
    this.stabilizeMs = options.stabilizeMs ?? 200;
  }

  /**
   * Capture the baseline memory snapshot. This is the reference point
   * for all subsequent `snapshot()` calls.
   */
  async baseline(): Promise<MemorySnapshot> {
    this._baseline = await captureMemorySnapshot(
      this.app,
      this.page,
      "baseline",
      { gc: this.gcEnabled, stabilizeMs: this.stabilizeMs },
    );
    this._snapshots = [this._baseline];
    return this._baseline;
  }

  /**
   * Capture a labeled snapshot and compute delta from baseline.
   * Returns a `MemoryReport` with the snapshot, delta, and a formatted summary.
   */
  async snapshot(label: string): Promise<MemoryReport> {
    const snap = await captureMemorySnapshot(this.app, this.page, label, {
      gc: this.gcEnabled,
      stabilizeMs: this.stabilizeMs,
    });
    this._snapshots.push(snap);

    const delta = this._baseline ? computeDelta(this._baseline, snap) : null;

    const summaryParts = [formatSnapshot(snap)];
    if (delta) {
      summaryParts.push(formatDeltaSummary(delta));
    }

    return {
      snapshot: snap,
      delta,
      summary: summaryParts.join("\n"),
    };
  }

  /**
   * Capture a snapshot and compute delta from the most recent snapshot
   * (not the baseline). Useful for measuring incremental growth.
   */
  async incrementalSnapshot(label: string): Promise<MemoryReport> {
    const snap = await captureMemorySnapshot(this.app, this.page, label, {
      gc: this.gcEnabled,
      stabilizeMs: this.stabilizeMs,
    });

    const previous =
      this._snapshots.length > 0
        ? this._snapshots[this._snapshots.length - 1]
        : null;

    this._snapshots.push(snap);

    const delta = previous ? computeDelta(previous, snap) : null;

    const summaryParts = [formatSnapshot(snap)];
    if (delta) {
      summaryParts.push(formatDeltaSummary(delta));
    }

    return {
      snapshot: snap,
      delta,
      summary: summaryParts.join("\n"),
    };
  }

  /**
   * Get the baseline snapshot, or null if not yet captured.
   */
  getBaseline(): MemorySnapshot | null {
    return this._baseline;
  }

  /**
   * Get all captured snapshots (including baseline) in order.
   */
  allSnapshots(): readonly MemorySnapshot[] {
    return this._snapshots;
  }

  /**
   * Get the most recent snapshot.
   */
  lastSnapshot(): MemorySnapshot | null {
    return this._snapshots.length > 0
      ? this._snapshots[this._snapshots.length - 1]
      : null;
  }

  /**
   * Generate a full report of all snapshots with deltas from baseline.
   * Useful for logging at the end of a test suite.
   */
  fullReport(): string {
    if (this._snapshots.length === 0) {
      return "No memory snapshots captured.";
    }

    const lines: string[] = [
      "═══════════════════════════════════════════════════",
      "        MEMORY PROFILING REPORT",
      "═══════════════════════════════════════════════════",
      "",
    ];

    for (const snap of this._snapshots) {
      lines.push(formatSnapshot(snap));
      if (this._baseline && snap !== this._baseline) {
        lines.push(formatDeltaSummary(computeDelta(this._baseline, snap)));
      }
      lines.push("");
    }

    // Summary table
    if (this._baseline && this._snapshots.length > 1) {
      const last = this._snapshots[this._snapshots.length - 1];
      const totalDelta = computeDelta(this._baseline, last);

      lines.push("───────────────────────────────────────────────────");
      lines.push("  TOTAL CHANGE (baseline → last snapshot)");
      lines.push("───────────────────────────────────────────────────");
      lines.push(
        `  Duration:           ${(totalDelta.elapsed / 1000).toFixed(1)}s`,
      );
      lines.push(`  Main RSS:           ${formatDelta(totalDelta.main.rss)}`);
      lines.push(
        `  Main Heap Used:     ${formatDelta(totalDelta.main.heapUsed)}`,
      );
      lines.push(
        `  Main External:      ${formatDelta(totalDelta.main.external)}`,
      );
      lines.push(
        `  Renderer Heap Used: ${formatDelta(totalDelta.renderer.usedJSHeapSize)}`,
      );
      lines.push("═══════════════════════════════════════════════════");
    }

    return lines.join("\n");
  }
}

// ─── Assertion Helpers ────────────────────────────────────────────────────────

/**
 * Threshold presets for memory growth assertions.
 * These are intentionally generous to account for GC timing variance
 * and platform differences.
 */
export const MEMORY_THRESHOLDS = {
  /** Acceptable growth for a single operation (e.g., sync cards, load page) */
  singleOperation: {
    mainHeapGrowth: 50 * 1024 * 1024, // 50 MB
    rendererHeapGrowth: 30 * 1024 * 1024, // 30 MB
    mainRssGrowth: 80 * 1024 * 1024, // 80 MB
  },
  /** Acceptable growth for navigation stress tests */
  navigationStress: {
    mainHeapGrowth: 30 * 1024 * 1024, // 30 MB
    rendererHeapGrowth: 50 * 1024 * 1024, // 50 MB
    mainRssGrowth: 100 * 1024 * 1024, // 100 MB
  },
  /** Acceptable total footprint for the app at idle after setup */
  idleFootprint: {
    mainRss: 300 * 1024 * 1024, // 300 MB
    mainHeapUsed: 150 * 1024 * 1024, // 150 MB
    rendererHeapUsed: 100 * 1024 * 1024, // 100 MB
  },
} as const;

/**
 * Repeatedly capture memory snapshots during an operation to detect
 * monotonically increasing memory (potential leak). Runs the provided
 * action `iterations` times, taking a snapshot after each.
 *
 * Returns the array of snapshots and a boolean indicating whether
 * memory grew monotonically across all iterations (a leak signal).
 */
export async function detectMemoryTrend(
  app: ElectronApplication,
  page: Page,
  action: () => Promise<void>,
  iterations: number = 5,
  options: { gc?: boolean; stabilizeMs?: number } = {},
): Promise<{
  snapshots: MemorySnapshot[];
  mainHeapMonotonicallyIncreasing: boolean;
  rendererHeapMonotonicallyIncreasing: boolean;
  mainHeapGrowthPerIteration: number;
  rendererHeapGrowthPerIteration: number;
}> {
  const snapshots: MemorySnapshot[] = [];

  // Initial baseline
  const baseline = await captureMemorySnapshot(
    app,
    page,
    "iteration-0",
    options,
  );
  snapshots.push(baseline);

  for (let i = 1; i <= iterations; i++) {
    await action();
    const snap = await captureMemorySnapshot(
      app,
      page,
      `iteration-${i}`,
      options,
    );
    snapshots.push(snap);
  }

  // Check if main heap grew monotonically
  let mainMonotonic = true;
  let rendererMonotonic = true;

  for (let i = 1; i < snapshots.length; i++) {
    if (snapshots[i].main.heapUsed <= snapshots[i - 1].main.heapUsed) {
      mainMonotonic = false;
    }
    if (
      snapshots[i].renderer.usedJSHeapSize <=
      snapshots[i - 1].renderer.usedJSHeapSize
    ) {
      rendererMonotonic = false;
    }
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];

  return {
    snapshots,
    mainHeapMonotonicallyIncreasing: mainMonotonic,
    rendererHeapMonotonicallyIncreasing: rendererMonotonic,
    mainHeapGrowthPerIteration:
      (last.main.heapUsed - first.main.heapUsed) / iterations,
    rendererHeapGrowthPerIteration:
      (last.renderer.usedJSHeapSize - first.renderer.usedJSHeapSize) /
      iterations,
  };
}
