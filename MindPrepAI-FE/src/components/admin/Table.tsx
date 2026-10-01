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
          <tr className="bg-surface-2 border-b border-line">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left py-2.5 px-4 text-[11px] font-semibold text-muted uppercase tracking-wider ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line text-fg-2">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-muted">
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
  return <tr className="hover:bg-surface-2 transition-colors">{children}</tr>;
}
