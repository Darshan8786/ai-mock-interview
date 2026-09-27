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
          <tr className="bg-gradient-to-b from-white/90 to-indigo-50/70 border-b border-white shadow-[inset_0_-1px_0_rgba(99,102,241,0.15)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-left py-2.5 px-4 text-[11px] font-bold text-indigo-700 uppercase tracking-wider ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-indigo-100/60">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-500">
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
  return <tr className="hover:bg-white/70 transition-colors">{children}</tr>;
}
