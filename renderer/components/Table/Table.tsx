import {
  type ColumnDef,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import clsx from "clsx";
import { useState } from "react";
import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
  FiChevronUp,
} from "react-icons/fi";

import { Button } from "..";

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
  rowClassName?: string;
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
  stickyHeader = false,
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
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    state: {
      sorting,
      pagination: enablePagination ? pagination : undefined,
      globalFilter: enableGlobalFilter ? globalFilter : undefined,
    },
    ...(globalFilterFn ? { globalFilterFn } : {}),
  });

  return (
    <div className="w-full">
      <div className={stickyHeader ? undefined : "overflow-x-auto"}>
        <table
          className={clsx(
            "table rounded-0 bg-base-100",
            {
              "table-zebra": zebraStripes,
              "table-xs": compact,
            },
            className,
          )}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => (
                  <th
                    key={header.id}
                    className={clsx({
                      "cursor-pointer select-none": header.column.getCanSort(),
                      "pl-0": index > 0,
                      "sticky top-0 z-10 bg-base-100": stickyHeader,
                    })}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div
                      className={clsx("flex items-center gap-1", {
                        "justify-center": index > 0,
                      })}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {header.column.getCanSort() &&
                        !(
                          header.column.columnDef.meta as Record<
                            string,
                            unknown
                          >
                        )?.hideSortIcon && (
                          <span className="inline-flex shrink-0">
                            {header.column.getIsSorted() === "asc" ? (
                              <FiChevronUp className="w-4 h-4" />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <FiChevronDown className="w-4 h-4" />
                            ) : (
                              <div className="w-4 h-4 opacity-50 -mt-2">
                                <FiChevronUp className="w-4 h-4 -mb-2" />
                                <FiChevronDown className="w-4 h-4" />
                              </div>
                            )}
                          </span>
                        )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={clsx("group", hoverable && "hover", rowClassName)}
              >
                {row.getVisibleCells().map((cell, index) => (
                  <td
                    key={cell.id}
                    className={clsx({
                      "text-center pl-0": index > 0,
                    })}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {enablePagination && (
        <div
          className={clsx(
            "flex items-center justify-between gap-2",
            stickyHeader
              ? "sticky bottom-0 z-10 bg-base-100 py-2 px-3 border-t border-base-300"
              : "mt-4 px-3",
          )}
        >
          <div className="text-sm text-base-content/70">
            Showing{" "}
            {table.getState().pagination.pageIndex *
              table.getState().pagination.pageSize +
              1}{" "}
            to{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) *
                table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length,
            )}{" "}
            of {table.getFilteredRowModel().rows.length} results
          </div>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <FiChevronsLeft />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <FiChevronLeft />
            </Button>
            <div className="flex items-center gap-2 px-3">
              <span className="text-sm">
                Page {table.getState().pagination.pageIndex + 1} of{" "}
                {table.getPageCount()}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <FiChevronRight />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <FiChevronsRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Table;
