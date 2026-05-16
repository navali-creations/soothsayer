import type { ColumnDef } from "@tanstack/react-table";
import type { CSSProperties } from "react";

const DEFAULT_COLUMN_SIZE = 150;

export function getColumnWidthStyle<TData>(
  columnDef: ColumnDef<TData, any>,
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

export function getColumnMeta<TData>(
  columnDef: ColumnDef<TData, any>,
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
