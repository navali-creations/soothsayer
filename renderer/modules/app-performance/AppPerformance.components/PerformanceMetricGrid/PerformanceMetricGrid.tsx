import { FiActivity, FiCpu, FiMonitor } from "react-icons/fi";

import { GroupedStats, Stat } from "~/renderer/components";
import { useAppPerformanceSelector } from "~/renderer/store";
import { formatBytes, formatNumber, formatPercent } from "~/renderer/utils";

import type { AppPerformanceSampleDTO } from "../../AppPerformance.types";

export function PerformanceMetricGrid() {
  const latest = useAppPerformanceSelector(
    (appPerformance) => appPerformance.samples.at(-1) ?? null,
  );
  const items = [
    {
      label: "FPS",
      value:
        latest?.fps === null || latest?.fps === undefined
          ? "n/a"
          : formatNumber(latest.fps),
      sublabel: "renderer",
      icon: <FiMonitor className="w-4 h-4" />,
    },
    {
      label: "Soothsayer CPU",
      value:
        latest?.appCpuPercent === null || latest?.appCpuPercent === undefined
          ? "n/a"
          : formatPercent(latest.appCpuPercent),
      sublabel:
        latest?.systemCpuPercent === null ||
        latest?.systemCpuPercent === undefined
          ? "system n/a"
          : `system ${formatPercent(latest.systemCpuPercent)}`,
      icon: <FiCpu className="w-4 h-4" />,
    },
    {
      label: "Memory Usage",
      value:
        latest?.appMemoryBytes === null || latest?.appMemoryBytes === undefined
          ? "n/a"
          : formatBytes(latest.appMemoryBytes),
      sublabel: formatMemoryUsageSublabel(latest),
      icon: <FiActivity className="w-4 h-4" />,
    },
  ];

  return (
    <GroupedStats className="w-full grid-cols-3 overflow-hidden shadow">
      {items.map((item) => (
        <Stat key={item.label} className="min-w-0 overflow-hidden">
          <Stat.Figure className="text-base-content/40">
            {item.icon}
          </Stat.Figure>
          <Stat.Title className="truncate">{item.label}</Stat.Title>
          <Stat.Value className="text-lg tabular-nums">{item.value}</Stat.Value>
          <Stat.Desc className="min-w-0 truncate">{item.sublabel}</Stat.Desc>
        </Stat>
      ))}
    </GroupedStats>
  );
}

function formatMemoryUsageSublabel(
  latest: AppPerformanceSampleDTO | null,
): string {
  const rendererWorkingSetBytes =
    latest?.rendererMemoryBytes === null ||
    latest?.rendererMemoryBytes === undefined
      ? null
      : latest.rendererMemoryBytes;
  const rendererHeapBytes = latest?.rendererHeapUsedBytes ?? null;
  const mainHeapBytes = latest?.mainHeapUsedBytes ?? null;
  const rendererBytes =
    rendererWorkingSetBytes === null || rendererHeapBytes === null
      ? null
      : rendererWorkingSetBytes + rendererHeapBytes;
  const renderer =
    rendererBytes === null
      ? "renderer n/a"
      : `renderer ${formatBytes(rendererBytes)}`;
  const main =
    mainHeapBytes === null ? "main n/a" : `main ${formatBytes(mainHeapBytes)}`;
  return `${renderer} / ${main}`;
}
