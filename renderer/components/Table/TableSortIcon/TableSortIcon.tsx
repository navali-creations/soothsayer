import type { Header } from "@tanstack/react-table";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";

import { getColumnMeta } from "../Table.utils";

interface TableSortIconProps<TData> {
  header: Header<TData, unknown>;
}

export function TableSortIcon<TData>({ header }: TableSortIconProps<TData>) {
  const sortedDirection = header.column.getIsSorted();

  if (
    !header.column.getCanSort() ||
    getColumnMeta(header.column.columnDef)?.hideSortIcon
  ) {
    return null;
  }

  return (
    <span className="inline-flex shrink-0">
      {sortedDirection === "asc" ? (
        <FiChevronUp className="w-4 h-4" />
      ) : sortedDirection === "desc" ? (
        <FiChevronDown className="w-4 h-4" />
      ) : (
        <div className="w-4 h-4 opacity-50 -mt-2">
          <FiChevronUp className="w-4 h-4 -mb-2" />
          <FiChevronDown className="w-4 h-4" />
        </div>
      )}
    </span>
  );
}
