import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { createElement } from "react";

import type { useChartColors } from "~/renderer/hooks";
import {
  formatBytes,
  formatCompactBytes,
  formatDurationMs,
  formatNumber,
  formatPercent,
  formatShortDateTime,
} from "~/renderer/utils";

import type { AppPerformanceCaptureSummaryDTO } from "../../AppPerformance.types";
import { MetricSummaryCell } from "./MetricSummaryCell/MetricSummaryCell";
import type { MetricSummarySparklineLine } from "./MetricSummaryCell/MetricSummaryCell.utils";

const columnHelper = createColumnHelper<AppPerformanceCaptureSummaryDTO>();

export function createAppPerformanceHistoryColumns({
  deleteMode,
  selectedCaptureIdSet,
  allVisibleSelected,
  selectableCount,
  deletingCaptureId,
  onToggleCaptureSelection,
  onToggleAllVisibleCaptureSelection,
  colors,
}: {
  deleteMode: boolean;
  selectedCaptureIdSet: ReadonlySet<string>;
  allVisibleSelected: boolean;
  selectableCount: number;
  deletingCaptureId: string | null;
  onToggleCaptureSelection: (captureId: string) => void;
  onToggleAllVisibleCaptureSelection: () => void;
  colors: ReturnType<typeof useChartColors>;
}): ColumnDef<AppPerformanceCaptureSummaryDTO, unknown>[] {
  const columns: ColumnDef<AppPerformanceCaptureSummaryDTO, unknown>[] = [];

  if (deleteMode) {
    columns.push(
      columnHelper.display({
        id: "select",
        header: () =>
          createElement("input", {
            type: "checkbox",
            className: "checkbox checkbox-error checkbox-xs",
            checked: allVisibleSelected,
            disabled: selectableCount === 0 || deletingCaptureId !== null,
            "aria-label": "Select all visible captures",
            onChange: onToggleAllVisibleCaptureSelection,
          }),
        size: 42,
        cell: (info) => {
          const capture = info.row.original;
          const active = capture.stoppedAt === null;
          const handleCaptureSelectionChange = () => {
            onToggleCaptureSelection(capture.id);
          };

          return createElement("input", {
            type: "checkbox",
            className: "checkbox checkbox-error checkbox-xs",
            checked: selectedCaptureIdSet.has(capture.id),
            disabled: active || deletingCaptureId !== null,
            "aria-label": `Select diagnostics capture from ${formatShortDateTime(capture.startedAt)}`,
            onChange: handleCaptureSelectionChange,
          });
        },
      }),
    );
  }

  columns.push(
    columnHelper.display({
      id: "started",
      header: "Started",
      size: 176,
      minSize: 156,
      meta: { alignStart: true },
      cell: (info) => {
        const capture = info.row.original;
        const active = capture.stoppedAt === null;

        return createElement(
          "div",
          { className: "flex min-w-0 items-center gap-2" },
          createElement(
            "span",
            { className: "truncate text-xs font-semibold" },
            formatShortDateTime(capture.startedAt),
          ),
          active
            ? createElement(
                "span",
                { className: "badge badge-success badge-xs" },
                "Active",
              )
            : null,
        );
      },
    }),
    columnHelper.display({
      id: "duration",
      header: "Duration",
      size: 72,
      cell: (info) =>
        createElement(
          "span",
          { className: "text-[11px] tabular-nums text-base-content/60" },
          formatDurationMs(info.row.original.durationMs, {
            includeSecondsWithHours: false,
          }),
        ),
    }),
    columnHelper.display({
      id: "size",
      header: "Size",
      size: 74,
      cell: (info) =>
        createElement(
          "span",
          { className: "text-[11px] tabular-nums text-base-content/60" },
          `~${formatBytes(info.row.original.estimatedSizeBytes)}`,
        ),
    }),
    createMetricColumn("fps", "FPS", 112, "fps", formatNumber, (capture) => [
      {
        id: "fps",
        points: capture.sparklineSamples.map((sample) => ({
          x: sample.captureElapsedMs,
          value: sample.fps,
        })),
        color: colors.success,
      },
    ]),
    createMetricColumn("cpu", "CPU", 112, "cpu", formatPercent, (capture) => [
      {
        id: "cpu",
        points: capture.sparklineSamples.map((sample) => ({
          x: sample.captureElapsedMs,
          value: sample.appCpuPercent,
        })),
        color: colors.warning,
      },
    ]),
    createMetricColumn(
      "appMemoryBytes",
      "RAM",
      144,
      "appMemoryBytes",
      formatCompactBytes,
      (capture) => [
        {
          id: "app-memory-bytes",
          points: capture.sparklineSamples.map((sample) => ({
            x: sample.captureElapsedMs,
            value: sample.appMemoryBytes,
          })),
          color: colors.secondary,
        },
      ],
    ),
    createMetricColumn(
      "memory",
      "RAM %",
      112,
      "memory",
      formatPercent,
      (capture) => [
        {
          id: "app-memory-percent",
          points: capture.sparklineSamples.map((sample) => ({
            x: sample.captureElapsedMs,
            value: sample.appMemoryPercent,
          })),
          color: colors.warning,
        },
        {
          id: "system-memory-percent",
          points: capture.sparklineSamples.map((sample) => ({
            x: sample.captureElapsedMs,
            value: sample.systemMemoryUsedPercent,
          })),
          color: colors.bc30,
        },
      ],
    ),
  );

  return columns;
}

function createMetricColumn(
  id: string,
  header: string,
  size: number,
  metric: "fps" | "cpu" | "memory" | "appMemoryBytes",
  format: (value: number | null) => string,
  getSparklineLines: (
    capture: AppPerformanceCaptureSummaryDTO,
  ) => MetricSummarySparklineLine[],
) {
  return columnHelper.display({
    id,
    header,
    size,
    cell: (info) => {
      const capture = info.row.original;
      return createElement(MetricSummaryCell, {
        summary: capture[metric],
        comparison: capture.comparison[metric],
        format,
        sparklineLines: getSparklineLines(capture),
      });
    },
  });
}
