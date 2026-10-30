import type { RowData } from "@tanstack/react-table";
import {
  type ColumnDef,
  columnFilteringFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";
import type { CSSProperties } from "react";

export const appTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

export type AppTableFeatures = typeof appTableFeatures;

const DEFAULT_COLUMN_SIZE = 150;

export function getColumnWidthStyle<TData extends RowData>(
  columnDef: ColumnDef<AppTableFeatures, TData, any>,
): CSSProperties | undefined {
  const hasExplicitSize =
    columnDef.size !== undefined && columnDef.size !== DEFAULT_COLUMN_SIZE;

  if (!hasExplicitSize) return undefined;

  return {
    width: columnDef.size,
    minWidth: columnDef.minSize,
    maxWidth: columnDef.maxSize,
  };
}

export function getColumnMeta<TData extends RowData>(
  columnDef: ColumnDef<AppTableFeatures, TData, any>,
): Record<string, unknown> | undefined {
  return columnDef.meta as Record<string, unknown> | undefined;
}

export function isInteractiveRowTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest("a,button,input,select,textarea,[data-row-click-ignore]") !==
      null
  );
}
