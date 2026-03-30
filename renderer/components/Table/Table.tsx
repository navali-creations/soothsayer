import {
  type ColumnDef,
  type FilterFn,
  flexRender,
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
  rowClassName?: string | ((row: Row<TData>) => string);
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

  // ── Render helpers ─────────────────────────────────────────────────

  const renderSortIcon = (
    header: ReturnType<typeof table.getHeaderGroups>[number]["headers"][number],
  ) => {
    if (
      !header.column.getCanSort() ||
      (header.column.columnDef.meta as Record<string, unknown>)?.hideSortIcon
    ) {
      return null;
    }

    return (
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
    );
  };

  const renderHeaderRows = () =>
    table.getHeaderGroups().map((headerGroup) => (
      <tr key={headerGroup.id}>
        {headerGroup.headers.map((header, index) => (
          <th
            key={header.id}
            className={clsx({
              "cursor-pointer select-none": header.column.getCanSort(),
              "pl-0": index > 0,
            })}
            onClick={header.column.getToggleSortingHandler()}
          >
            <div
              className={clsx("flex items-center gap-1", {
                "justify-center":
                  index > 0 &&
                  !(header.column.columnDef.meta as Record<string, unknown>)
                    ?.alignStart,
              })}
            >
              {header.isPlaceholder
                ? null
                : flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
              {renderSortIcon(header)}
            </div>
          </th>
        ))}
      </tr>
    ));

  const renderBodyRows = () => (
    <>
      {table.getRowModel().rows.length === 0 && emptyMessage ? (
        <tr>
          <td
            colSpan={columns.length}
            className="text-center text-base-content/50 py-8"
          >
            {emptyMessage}
          </td>
        </tr>
      ) : null}
      {table.getRowModel().rows.map((row) => (
        <tr
          key={row.id}
          className={clsx(
            "group",
            hoverable && "hover",
            typeof rowClassName === "function"
              ? rowClassName(row)
              : rowClassName,
          )}
        >
          {row.getVisibleCells().map((cell, index) => (
            <td
              key={cell.id}
              className={clsx({
                "text-center pl-0":
                  index > 0 &&
                  !(cell.column.columnDef.meta as Record<string, unknown>)
                    ?.alignStart,
                "pl-0":
                  index > 0 &&
                  !!(cell.column.columnDef.meta as Record<string, unknown>)
                    ?.alignStart,
              })}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          ))}
        </tr>
      ))}
    </>
  );

  // ── Table classes ──────────────────────────────────────────────────

  const tableClasses = clsx(
    "table rounded-0 bg-base-100",
    { "table-zebra": zebraStripes, "table-xs": compact },
    className,
  );

  // ── Pagination element ─────────────────────────────────────────────

  const paginationElement = enablePagination ? (
    <div
      className={clsx(
        "flex items-center justify-between gap-2",
        stickyHeader
          ? "shrink-0 bg-base-100 py-2 px-3 border-t border-base-300"
          : "mt-4 px-3",
        !hasVisibleRows && "invisible",
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
  ) : null;

  // ══════════════════════════════════════════════════════════════════
  // LAYOUT: stickyHeader
  // ══════════════════════════════════════════════════════════════════
  // Uses CSS display overrides on a single <table> so that <thead>
  // and <tbody> become block-level elements.  <tbody> gets
  // overflow-y:auto so the scrollbar only appears next to body rows.
  // Each <tr> uses display:table + width:100% + table-layout:fixed
  // so columns stay aligned between thead and tbody.
  //
  //   ┌──────────────┐
  //   │  thead        │  ← block, no scroll
  //   ├──────────────┤
  //   │  tbody      ▲│  ← block, overflow-y: auto
  //   │             ▼│
  //   ├──────────────┤
  //   │  pagination   │  ← shrink-0 footer
  //   └──────────────┘
  if (stickyHeader) {
    return (
      <div className="w-full h-full relative">
        <div className="absolute inset-0 flex flex-col min-h-0">
          <table className={clsx(tableClasses, "table-block-layout")}>
            <thead>{renderHeaderRows()}</thead>
            <tbody>{renderBodyRows()}</tbody>
          </table>
          {paginationElement}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════
  // LAYOUT: default (no stickyHeader)
  // ══════════════════════════════════════════════════════════════════
  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className={tableClasses}>
          <thead>{renderHeaderRows()}</thead>
          <tbody>{renderBodyRows()}</tbody>
        </table>
      </div>
      {paginationElement}
    </div>
  );
}

export default Table;
