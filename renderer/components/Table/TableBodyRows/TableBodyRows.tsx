import type { Table as ReactTable, Row, RowData } from "@tanstack/react-table";

import type { AppTableFeatures } from "../Table.utils";
import { TableBodyRow } from "../TableBodyRow/TableBodyRow";

interface TableBodyRowsProps<TData extends RowData> {
  table: ReactTable<AppTableFeatures, TData>;
  columnsLength: number;
  hoverable: boolean;
  rowClassName?: string | ((row: Row<AppTableFeatures, TData>) => string);
  onRowClick?: (row: Row<AppTableFeatures, TData>) => void;
  emptyMessage?: string;
}

export function TableBodyRows<TData extends RowData>({
  table,
  columnsLength,
  hoverable,
  rowClassName,
  onRowClick,
  emptyMessage,
}: TableBodyRowsProps<TData>) {
  const rows = table.getRowModel().rows;

  return (
    <>
      {rows.length === 0 && emptyMessage && (
        <tr>
          <td
            colSpan={columnsLength}
            className="text-center text-base-content/50 py-8"
          >
            {emptyMessage}
          </td>
        </tr>
      )}
      {rows.map((row) => (
        <TableBodyRow
          key={row.id}
          row={row}
          hoverable={hoverable}
          rowClassName={rowClassName}
          onRowClick={onRowClick}
        />
      ))}
    </>
  );
}
