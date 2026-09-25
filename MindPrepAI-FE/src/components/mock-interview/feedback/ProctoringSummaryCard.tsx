import type { ProctoringSummary } from "../../../types/mockFeedback";
import { cardClass } from "./format";

const STYLE = {
  ok: { icon: "✓", cls: "text-emerald-400" },
  warn: { icon: "⚠", cls: "text-yellow-400" },
  bad: { icon: "✗", cls: "text-red-400" },
} as const;

/** Only what was actually recorded; the note says what is not stored. */
export function ProctoringSummaryCard({ summary }: { summary: ProctoringSummary }) {
  return (
    <div className={`${cardClass} p-6`}>
      <h3 className="text-lg font-semibold text-white mb-3">Proctoring Summary</h3>
      <ul className="space-y-1.5">
        {summary.items.map((it, i) => (
          <li key={i} className={`text-sm flex gap-2 ${STYLE[it.status].cls}`}>
            <span aria-hidden>{STYLE[it.status].icon}</span>
            <span>
              {it.label}
              {it.detail && <span className="text-gray-500"> ({it.detail})</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">{summary.note}</p>
    </div>
  );
}
