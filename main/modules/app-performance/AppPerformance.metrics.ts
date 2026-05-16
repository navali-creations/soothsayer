import os from "node:os";

export interface CpuTimesSnapshot {
  idle: number;
  total: number;
}

export interface ElectronMetricsAggregate {
  appCpuPercent: number | null;
  /** App renderer-window memory estimate, with extra windows counted incrementally. */
  rendererMemoryBytes: number | null;
}

export interface ElectronMetricsProcessSelection {
  primaryRendererPid: number | null;
  rendererPids: readonly number[];
}

export interface MemoryUsageComponents {
  rendererMemoryBytes: number | null;
  rendererHeapUsedBytes: number | null;
  mainHeapUsedBytes: number | null;
}

export function readCpuTimesSnapshot(
  cpus: os.CpuInfo[] = os.cpus(),
): CpuTimesSnapshot {
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total +=
      cpu.times.user +
      cpu.times.nice +
      cpu.times.sys +
      cpu.times.idle +
      cpu.times.irq;
  }

  return { idle, total };
}

export function calculateSystemCpuPercent(
  previous: CpuTimesSnapshot | null,
  current: CpuTimesSnapshot,
): number | null {
  if (!previous) return null;

  const idleDelta = current.idle - previous.idle;
  const totalDelta = current.total - previous.total;
  if (totalDelta <= 0) return null;

  const usedDelta = totalDelta - idleDelta;
  return clampPercent((usedDelta / totalDelta) * 100);
}

export function aggregateElectronMetrics(
  metrics: Electron.ProcessMetric[],
  { primaryRendererPid, rendererPids }: ElectronMetricsProcessSelection,
): ElectronMetricsAggregate {
  if (metrics.length === 0) {
    return {
      appCpuPercent: null,
      rendererMemoryBytes: null,
    };
  }

  let appCpuPercent = 0;
  let rendererMemoryBytes: number | null = null;
  const rendererPidSet = new Set(rendererPids);

  for (const metric of metrics) {
    appCpuPercent += Number(metric.cpu?.percentCPUUsage ?? 0);

    if (rendererPidSet.has(metric.pid)) {
      const memoryBytes =
        metric.pid === primaryRendererPid
          ? readProcessWorkingSetBytes(metric)
          : readIncrementalRendererMemoryBytes(metric);
      rendererMemoryBytes = (rendererMemoryBytes ?? 0) + memoryBytes;
    }
  }

  return {
    appCpuPercent: clampPercent(appCpuPercent),
    rendererMemoryBytes,
  };
}

export function calculateMemoryUsageBytes({
  rendererMemoryBytes,
  rendererHeapUsedBytes,
  mainHeapUsedBytes,
}: MemoryUsageComponents): number | null {
  const rendererMemory = normalizeMemoryComponent(rendererMemoryBytes);
  const rendererHeap = normalizeMemoryComponent(rendererHeapUsedBytes);
  const mainHeap = normalizeMemoryComponent(mainHeapUsedBytes);

  if (rendererMemory === null || rendererHeap === null || mainHeap === null) {
    return null;
  }

  return rendererMemory + rendererHeap + mainHeap;
}

function readProcessWorkingSetBytes(metric: Electron.ProcessMetric): number {
  const memory = metric.memory;
  const workingSetKb = Number(memory?.workingSetSize ?? 0);
  if (!Number.isFinite(workingSetKb)) return 0;
  return Math.max(0, workingSetKb * 1024);
}

function readIncrementalRendererMemoryBytes(
  metric: Electron.ProcessMetric,
): number {
  const privateBytesKb = Number(metric.memory?.privateBytes);
  if (Number.isFinite(privateBytesKb) && privateBytesKb > 0) {
    return privateBytesKb * 1024;
  }

  return readProcessWorkingSetBytes(metric);
}

function normalizeMemoryComponent(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : null;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
