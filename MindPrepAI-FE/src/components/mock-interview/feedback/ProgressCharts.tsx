import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MetricKey, ProgressData } from "../../../types/mockFeedback";
import { cardClass } from "./format";

const CHARTS: Array<{ key: MetricKey; label: string }> = [
  { key: "technical", label: "Technical" },
  { key: "communication", label: "Communication" },
  { key: "confidence", label: "Confidence" },
  { key: "fluency", label: "Fluency" },
  { key: "relevance", label: "Relevance" },
  { key: "structure", label: "Structure" },
];

const LINE = "#34d399"; // one series per chart: the chart title names it, so no legend is needed
const GRID = "#374151";
const AXIS = "#9ca3af";

interface Props {
  progress: ProgressData;
  /** Interview to highlight (the one whose report is open). */
  currentId?: string;
}

/** Score trend across mock interviews - one small single-axis chart per metric, with a table alternative. */
export function ProgressCharts({ progress, currentId }: Props) {
  const [table, setTable] = useState(false);
  const rows = useMemo(
    () =>
      progress.points.map((p, i) => ({
        id: p.interviewId,
        label: `#${i + 1}`,
        name: `Interview ${i + 1}`,
        date: new Date(p.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
        role: p.jobRole,
        overall: p.overall,
        ...p.metrics,
      })),
    [progress.points]
  );
  const charts = CHARTS.filter((c) => rows.some((r) => (r as any)[c.key] !== undefined));

  if (rows.length === 0) return null;

  return (
    <div className={`${cardClass} p-6`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="text-lg font-semibold text-white">Interview Progress</h3>
        <button onClick={() => setTable((t) => !t)} className="text-xs text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline">
          {table ? "Show charts" : "View as table"}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        {rows.length < 2
          ? "Complete another interview to see how your scores change over time."
          : `Your last ${rows.length} finished mock interviews, oldest to newest.`}
      </p>

      {rows.length >= 2 && progress.improvement.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {progress.improvement.map((i) => (
            <span
              key={i.key}
              className={`px-2.5 py-1 rounded-full text-xs border ${
                i.delta > 0
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                  : i.delta < 0
                  ? "bg-red-500/10 text-red-300 border-red-500/20"
                  : "bg-gray-700/40 text-gray-300 border-gray-600"
              }`}
            >
              {i.label} {i.delta > 0 ? "▲ +" : i.delta < 0 ? "▼ " : "= "}
              {i.delta}
              <span className="text-gray-500"> ({i.first}→{i.latest})</span>
            </span>
          ))}
        </div>
      )}

      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[32rem]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                <th className="text-left py-1.5 pr-3 font-medium">Interview</th>
                <th className="text-right px-2 font-medium">Overall</th>
                {charts.map((c) => (
                  <th key={c.key} className="text-right px-2 font-medium">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-t border-gray-800 ${r.id === currentId ? "bg-emerald-500/5" : ""}`}>
                  <th scope="row" className="text-left font-normal text-gray-300 py-2 pr-3">
                    {r.name} <span className="text-gray-500 text-xs">· {r.date}</span>
                  </th>
                  <td className="text-right tabular-nums px-2 text-gray-200">{r.overall}%</td>
                  {charts.map((c) => (
                    <td key={c.key} className="text-right tabular-nums px-2 text-gray-200">
                      {(r as any)[c.key] !== undefined ? `${(r as any)[c.key]}%` : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {charts.map((c) => (
            <div key={c.key} className="rounded-xl bg-gray-900/50 border border-gray-700 p-3">
              <p className="text-sm font-medium text-gray-200 mb-1">{c.label}</p>
              <div className="h-36" role="img" aria-label={`${c.label} score across interviews: ${rows.map((r) => (r as any)[c.key] ?? "n/a").join(", ")}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} tickLine={false} />
                    <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fill: AXIS, fontSize: 11 }} stroke={GRID} tickLine={false} />
                    <Tooltip
                      cursor={{ stroke: AXIS, strokeDasharray: "3 3" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const r: any = payload[0].payload;
                        return (
                          <div className="rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-xs shadow-lg">
                            <p className="text-gray-300 font-medium">{r.name}</p>
                            <p className="text-gray-500">{r.date} · {r.role}</p>
                            <p className="text-white mt-1">{c.label}: <b>{r[c.key]}%</b></p>
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey={c.key}
                      stroke={LINE}
                      strokeWidth={2}
                      connectNulls
                      isAnimationActive={false}
                      dot={(p: any) => (
                        <circle
                          key={p.index}
                          cx={p.cx}
                          cy={p.cy}
                          r={p.payload.id === currentId ? 6 : 4}
                          fill={LINE}
                          stroke="#111827"
                          strokeWidth={2}
                        />
                      )}
                      activeDot={{ r: 6, stroke: "#111827", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
