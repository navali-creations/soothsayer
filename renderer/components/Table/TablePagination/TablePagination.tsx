import type { Table as ReactTable } from "@tanstack/react-table";
import clsx from "clsx";
import {
  FiChevronLeft,
  FiChevronRight,
  FiChevronsLeft,
  FiChevronsRight,
} from "react-icons/fi";

import Button from "../../Button/Button";

interface TablePaginationProps<TData> {
  table: ReactTable<TData>;
  stickyHeader: boolean;
  hasVisibleRows: boolean;
}

export function TablePagination<TData>({
  table,
  stickyHeader,
  hasVisibleRows,
}: TablePaginationProps<TData>) {
  const pagination = table.getState().pagination;
  const firstResult = pagination.pageIndex * pagination.pageSize + 1;
  const lastResult = Math.min(
    (pagination.pageIndex + 1) * pagination.pageSize,
    table.getFilteredRowModel().rows.length,
  );
  const totalResults = table.getFilteredRowModel().rows.length;

  const handleFirstPage = () => {
    table.setPageIndex(0);
  };

  const handlePreviousPage = () => {
    table.previousPage();
  };

  const handleNextPage = () => {
    table.nextPage();
  };

  const handleLastPage = () => {
    table.setPageIndex(table.getPageCount() - 1);
  };

  return (
    <div
      className={clsx("flex items-center justify-between gap-2", {
        "shrink-0 bg-base-100 py-2 px-3 border-t border-base-300": stickyHeader,
        "mt-4 px-3": !stickyHeader,
        invisible: !hasVisibleRows,
      })}
    >
      <div className="text-sm text-base-content/70">
        Showing {firstResult} to {lastResult} of {totalResults} results
      </div>

      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleFirstPage}
          disabled={!table.getCanPreviousPage()}
        >
          <FiChevronsLeft />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePreviousPage}
          disabled={!table.getCanPreviousPage()}
        >
          <FiChevronLeft />
        </Button>
        <div className="flex items-center gap-2 px-3">
          <span className="text-sm">
            Page {pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNextPage}
          disabled={!table.getCanNextPage()}
        >
          <FiChevronRight />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLastPage}
          disabled={!table.getCanNextPage()}
        >
          <FiChevronsRight />
        </Button>
      </div>
    </div>
  );
}
