import { motion } from "framer-motion";
import type { PerformanceSummary } from "../../../types/mockFeedback";
import { cardClass, scoreBar, scoreText } from "./format";

/** OVERALL INTERVIEW PERFORMANCE - averages over the evaluated answers, plus the main recommendation. */
export function PerformanceSummaryCard({ summary }: { summary: PerformanceSummary }) {
  if (summary.metrics.length === 0) {
    return (
      <div className={`${cardClass} p-6`}>
        <h3 className="text-lg font-semibold text-white mb-2">Overall Interview Performance</h3>
        <p className="text-sm text-gray-400">
          There are no evaluated answers to summarise yet{summary.answered > 0 ? " — evaluation was unavailable, reopen this report to retry" : ""}.
        </p>
      </div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`${cardClass} p-6`}>
      <h3 className="text-lg font-semibold text-white mb-1">Overall Interview Performance</h3>
      <p className="text-xs text-gray-500 mb-5">
        Averaged over {summary.evaluated} evaluated answer{summary.evaluated === 1 ? "" : "s"}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3.5">
        {summary.metrics.map((m, i) => (
          <div key={m.key}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-300">{m.label}</span>
              <span className={`font-bold tabular-nums ${scoreText(m.score)}`}>{m.score}%</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${m.score}%` }}
                transition={{ duration: 0.8, delay: i * 0.05 }}
                className={`h-full rounded-full ${scoreBar(m.score)}`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
        {summary.strongest && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
            <p className="text-[11px] uppercase tracking-wider text-emerald-300/80">Strongest area</p>
            <p className="text-white font-semibold mt-0.5">{summary.strongest.label} <span className="text-emerald-400">{summary.strongest.score}%</span></p>
          </div>
        )}
        {summary.weakest && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
            <p className="text-[11px] uppercase tracking-wider text-amber-300/80">Needs most improvement</p>
            <p className="text-white font-semibold mt-0.5">{summary.weakest.label} <span className="text-amber-400">{summary.weakest.score}%</span></p>
          </div>
        )}
      </div>

      {summary.recommendation && (
        <div className="mt-4 rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
          <p className="text-[11px] uppercase tracking-wider text-blue-300/70 mb-1">Main recommendation</p>
          <p className="text-sm text-blue-100 leading-relaxed">“{summary.recommendation}”</p>
        </div>
      )}
    </motion.div>
  );
}
