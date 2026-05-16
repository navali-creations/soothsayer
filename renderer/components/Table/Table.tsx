import {
  type ColumnDef,
  type FilterFn,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type Row,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import clsx from "clsx";
import { useEffect, useState } from "react";

import { TableBodyRows } from "./TableBodyRows/TableBodyRows";
import { TableHeaderRows } from "./TableHeaderRows/TableHeaderRows";
import { TablePagination } from "./TablePagination/TablePagination";

interface TableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
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
  globalFilterFn?: FilterFn<TData>;
  /** Additional class name(s) applied to each `<tr>` in the body */
  rowClassName?: string | ((row: Row<TData>) => string);
  /** Called when a non-interactive body row is clicked or keyboard-activated. */
  onRowClick?: (row: Row<TData>) => void;
  /** Message shown when the table has no visible rows (e.g. after filtering) */
  emptyMessage?: string;
  /** When true, the table header row sticks to the top of the scroll container */
  stickyHeader?: boolean;
}

function Table<TData>({
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

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: enableGlobalFilter ? getFilteredRowModel() : undefined,
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getPaginationRowModel: enablePagination
      ? getPaginationRowModel()
      : undefined,
    autoResetPageIndex: false,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    state: {
      sorting,
      pagination: enablePagination ? pagination : undefined,
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
