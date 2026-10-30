import type { RowData } from "@tanstack/react-table";
import {
  type ColumnDef,
  type FilterFn,
  type PaginationState,
  type Row,
  type SortingState,
  useTable,
} from "@tanstack/react-table";
import clsx from "clsx";
import { useEffect, useState } from "react";

import type { AppTableFeatures } from "./Table.utils";
import { appTableFeatures } from "./Table.utils";
import { TableBodyRows } from "./TableBodyRows/TableBodyRows";
import { TableHeaderRows } from "./TableHeaderRows/TableHeaderRows";
import { TablePagination } from "./TablePagination/TablePagination";

interface TableProps<TData extends RowData> {
  data: TData[];
  columns: ColumnDef<AppTableFeatures, TData, any>[];
  className?: string;
  enableSorting?: boolean;
  enablePagination?: boolean;
  pageSize?: number;
  _striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
  zebraStripes?: boolean;
  initialSorting?: SortingState;
  /** Controlled sorting state. When provided, the table uses this instead of internal state. */
  sorting?: SortingState;
  /** Callback when sorting changes. Required when `sorting` is controlled. */
  onSortingChange?: (sorting: SortingState) => void;
  /** TanStack global filter value (e.g. a debounced search string) */
  globalFilter?: string;
  /** Custom global filter function. Defaults to case-insensitive substring match on all string accessors. */
  globalFilterFn?: FilterFn<AppTableFeatures, TData>;
  /** Additional class name(s) applied to each `<tr>` in the body */
  rowClassName?: string | ((row: Row<AppTableFeatures, TData>) => string);
  /** Called when a non-interactive body row is clicked or keyboard-activated. */
  onRowClick?: (row: Row<AppTableFeatures, TData>) => void;
  /** Message shown when the table has no visible rows (e.g. after filtering) */
  emptyMessage?: string;
  /** When true, the table header row sticks to the top of the scroll container */
  stickyHeader?: boolean;
}

function Table<TData extends RowData>({
  data,
  columns,
  className,
  enableSorting = true,
  enablePagination = false,
  pageSize = 10,
  _striped = false,
  hoverable = true,
  compact = false,
  zebraStripes = false,
  initialSorting = [],
  sorting: controlledSorting,
  onSortingChange: controlledOnSortingChange,
  globalFilter,
  globalFilterFn,
  rowClassName,
  onRowClick,
  stickyHeader = false,
  emptyMessage,
}: TableProps<TData>) {
  const [internalSorting, setInternalSorting] =
    useState<SortingState>(initialSorting);

  const isControlled = controlledSorting !== undefined;
  const sorting = isControlled ? controlledSorting : internalSorting;
  const setSorting = isControlled
    ? (updater: SortingState | ((prev: SortingState) => SortingState)) => {
        const next =
          typeof updater === "function" ? updater(controlledSorting) : updater;
        controlledOnSortingChange?.(next);
      }
    : setInternalSorting;
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const enableGlobalFilter = globalFilter !== undefined;

  const table = useTable({
    features: appTableFeatures,
    data,
    columns,
    manualFiltering: !enableGlobalFilter,
    manualSorting: !enableSorting,
    manualPagination: !enablePagination,
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    state: {
      sorting,
      pagination,
      globalFilter: enableGlobalFilter ? globalFilter : undefined,
    },
    ...(globalFilterFn ? { globalFilterFn } : {}),
  });

  // Clamp pageIndex when data shrinks so the user doesn't land on an empty page
  const rowCount = data.length;
  useEffect(() => {
    if (!enablePagination) return;
    const maxPage = Math.max(0, Math.ceil(rowCount / pageSize) - 1);
    if (pagination.pageIndex > maxPage) {
      setPagination((prev) => ({ ...prev, pageIndex: maxPage }));
    }
  }, [rowCount, pageSize, enablePagination, pagination.pageIndex]);

  const hasVisibleRows = table.getFilteredRowModel().rows.length > 0;

  const tableClasses = clsx(
    "table rounded-0 bg-base-100",
    { "table-zebra": zebraStripes, "table-xs": compact },
    className,
  );

  if (stickyHeader) {
    return (
      <div className="w-full h-full relative">
        <div className="absolute inset-0 flex flex-col min-h-0">
          <table className={clsx(tableClasses, "table-block-layout")}>
            <thead>
              <TableHeaderRows table={table} />
            </thead>
            <tbody>
              <TableBodyRows
                table={table}
                columnsLength={columns.length}
                hoverable={hoverable}
                rowClassName={rowClassName}
                onRowClick={onRowClick}
                emptyMessage={emptyMessage}
              />
            </tbody>
          </table>
          {enablePagination && (
            <TablePagination
              table={table}
              stickyHeader={stickyHeader}
              hasVisibleRows={hasVisibleRows}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className={tableClasses}>
          <thead>
            <TableHeaderRows table={table} />
          </thead>
          <tbody>
            <TableBodyRows
              table={table}
              columnsLength={columns.length}
              hoverable={hoverable}
              rowClassName={rowClassName}
              onRowClick={onRowClick}
              emptyMessage={emptyMessage}
            />
          </tbody>
        </table>
      </div>
      {enablePagination && (
        <TablePagination
          table={table}
          stickyHeader={stickyHeader}
          hasVisibleRows={hasVisibleRows}
        />
      )}
    </div>
  );
}

export default Table;
