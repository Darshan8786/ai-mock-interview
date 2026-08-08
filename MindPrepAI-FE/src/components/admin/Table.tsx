import type { ReactNode } from "react";

interface TableProps<T> {
  columns: { key: string; header: string; className?: string }[];
  rows: T[];
  renderRow: (row: T) => ReactNode;
  emptyMessage?: string;
}

export function Table<T>({ columns, rows, renderRow, emptyMessage = "No records found." }: TableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/70">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-10 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => <FragmentRow key={i}>{renderRow(row)}</FragmentRow>)
          )}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({ children }: { children: ReactNode }) {
  return <tr className="hover:bg-gray-800/40 transition-colors">{children}</tr>;
}
