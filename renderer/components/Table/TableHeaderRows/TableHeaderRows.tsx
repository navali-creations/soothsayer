import type { RowData } from "@tanstack/react-table";
import { flexRender, type Table as ReactTable } from "@tanstack/react-table";
import clsx from "clsx";

import type { AppTableFeatures } from "../Table.utils";
import { getColumnMeta, getColumnWidthStyle } from "../Table.utils";
import { TableSortIcon } from "../TableSortIcon/TableSortIcon";

interface TableHeaderRowsProps<TData extends RowData> {
  table: ReactTable<AppTableFeatures, TData>;
}

export function TableHeaderRows<TData extends RowData>({
  table,
}: TableHeaderRowsProps<TData>) {
  return (
    <>
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id}>
          {headerGroup.headers.map((header, index) => (
            <th
              key={header.id}
              className={clsx({
                "cursor-pointer select-none": header.column.getCanSort(),
                "pl-0": index > 0,
              })}
              style={getColumnWidthStyle(header.column.columnDef)}
              onClick={header.column.getToggleSortingHandler()}
            >
              <div
                className={clsx("flex items-center gap-1", {
                  "justify-center":
                    index > 0 &&
                    !getColumnMeta(header.column.columnDef)?.alignStart,
                })}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                <TableSortIcon header={header} />
              </div>
            </th>
          ))}
        </tr>
      ))}
    </>
  );
}
