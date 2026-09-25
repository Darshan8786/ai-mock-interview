import type { Comparison, ComparisonRow } from "../../../types/mockFeedback";
import { fmtDuration, scoreText } from "./format";

function cell(row: ComparisonRow, v: number | null) {
  if (v === null) return <span className="text-gray-600">—</span>;
  if (row.unit === "%") return <span className={scoreText(v)}>{v}%</span>;
  if (row.unit === "s") return <span className="text-gray-200">{fmtDuration(v)}</span>;
  return <span className="text-gray-200">{v}</span>;
}

function change(row: ComparisonRow) {
  const d = row.delta;
  if (d === null) return null;
  if (d === 0) return <span className="text-gray-400">no change</span>;
  const better = row.neutral ? null : row.lowerIsBetter ? d < 0 : d > 0;
  const tone = better === null ? "text-gray-300" : better ? "text-emerald-400" : "text-red-400";
  const arrow = d > 0 ? "▲" : "▼";
  const unit = row.unit === "%" ? "" : row.unit === "s" ? "s" : "";
  return (
    <span className={`font-semibold tabular-nums ${tone}`}>
      {arrow} {d > 0 ? "+" : ""}
      {d}
      {unit}
    </span>
  );
}

/** Before vs after across attempts. Rows are only those the server found on 2+ attempts. */
export function AttemptComparison({ comparison }: { comparison: Comparison }) {
  if (comparison.attempts.length < 2 || comparison.rows.length === 0) {
    return <p className="text-sm text-gray-500">Not enough comparable data between attempts yet.</p>;
  }
  const first = comparison.attempts[0];
  const last = comparison.attempts[comparison.attempts.length - 1];
  const improved = comparison.rows.filter((r) => !r.neutral && r.delta !== null && (r.lowerIsBetter ? r.delta < 0 : r.delta > 0));

  return (
    <div className="rounded-xl bg-gray-900/50 border border-gray-700 p-4">
      <h5 className="text-sm font-semibold text-white mb-3">Before vs After</h5>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-sm min-w-[22rem]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-gray-500">
              <th className="text-left font-medium py-1.5 pr-3">Metric</th>
              {comparison.attempts.map((n) => (
                <th key={n} className="text-right font-medium py-1.5 px-2">Attempt {n}</th>
              ))}
              <th className="text-right font-medium py-1.5 pl-3">Change</th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((r) => (
              <tr key={r.key} className="border-t border-gray-800">
                <th scope="row" className="text-left font-normal text-gray-300 py-2 pr-3">{r.label}</th>
                {r.values.map((v, i) => (
                  <td key={i} className="text-right tabular-nums py-2 px-2">{cell(r, v)}</td>
                ))}
                <td className="text-right py-2 pl-3">{change(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-gray-300">
        {improved.length > 0 ? (
          <>
            <span className="text-emerald-400 font-medium">Improvement (attempt {first} → {last}):</span>{" "}
            {improved.map((r) => `${r.label} ${r.delta! > 0 ? "+" : ""}${r.delta}`).join(" · ")}
          </>
        ) : (
          <span className="text-gray-400">No measured improvement yet between attempt {first} and attempt {last}.</span>
        )}
      </p>
    </div>
  );
}
