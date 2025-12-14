import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type PaginationState,
} from "@tanstack/react-table";
import { useState } from "react";
import clsx from "clsx";
import {
  FiChevronDown,
  FiChevronUp,
  FiChevronsLeft,
  FiChevronsRight,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { Button } from "..";

interface TableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  className?: string;
  enableSorting?: boolean;
  enablePagination?: boolean;
  pageSize?: number;
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
  zebraStripes?: boolean;
  initialSorting?: SortingState;
}

function Table<TData>({
  data,
  columns,
  className,
  enableSorting = true,
  enablePagination = false,
  pageSize = 10,
  striped = false,
  hoverable = true,
  compact = false,
  zebraStripes = false,
  initialSorting = [],
}: TableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getPaginationRowModel: enablePagination
      ? getPaginationRowModel()
      : undefined,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    state: {
      sorting,
      pagination: enablePagination ? pagination : undefined,
    },
  });

  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table
          className={clsx(
            "table",
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
                    })}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div
                      className={clsx("flex items-center gap-2", {
                        "justify-center": index > 0,
                      })}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {header.column.getCanSort() && (
                        <span className="inline-flex ">
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
                className={clsx({
                  hover: hoverable,
                })}
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
        <div className="flex items-center justify-between gap-2 mt-4">
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
