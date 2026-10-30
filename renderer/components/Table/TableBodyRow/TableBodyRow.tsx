import type { RowData } from "@tanstack/react-table";
import { flexRender, type Row } from "@tanstack/react-table";
import clsx from "clsx";
import type { KeyboardEvent, MouseEvent } from "react";

import type { AppTableFeatures } from "../Table.utils";
import {
  getColumnMeta,
  getColumnWidthStyle,
  isInteractiveRowTarget,
} from "../Table.utils";

interface TableBodyRowProps<TData extends RowData> {
  row: Row<AppTableFeatures, TData>;
  hoverable: boolean;
  rowClassName?: string | ((row: Row<AppTableFeatures, TData>) => string);
  onRowClick?: (row: Row<AppTableFeatures, TData>) => void;
}

export function TableBodyRow<TData extends RowData>({
  row,
  hoverable,
  rowClassName,
  onRowClick,
}: TableBodyRowProps<TData>) {
  const handleClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (!onRowClick || isInteractiveRowTarget(event.target)) return;
    onRowClick(row);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (!onRowClick || isInteractiveRowTarget(event.target)) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    onRowClick(row);
  };

  return (
    <tr
      role={onRowClick ? "button" : undefined}
      tabIndex={onRowClick ? 0 : undefined}
      className={clsx(
        "group",
        hoverable && "hover",
        onRowClick && "cursor-pointer",
        typeof rowClassName === "function" ? rowClassName(row) : rowClassName,
      )}
      onClick={onRowClick ? handleClick : undefined}
      onKeyDown={onRowClick ? handleKeyDown : undefined}
    >
      {row.getVisibleCells().map((cell, index) => (
        <td
          key={cell.id}
          style={getColumnWidthStyle(cell.column.columnDef)}
          className={clsx({
            "text-center pl-0":
              index > 0 && !getColumnMeta(cell.column.columnDef)?.alignStart,
            "pl-0":
              index > 0 && !!getColumnMeta(cell.column.columnDef)?.alignStart,
          })}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
}
