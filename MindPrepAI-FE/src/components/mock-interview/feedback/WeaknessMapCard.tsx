import { motion } from "framer-motion";
import type { WeaknessMap } from "../../../types/mockFeedback";
import { cardClass } from "./format";

/** Recurring weaknesses (bar length = how often and how badly) and strong areas, from the actual answers. */
export function WeaknessMapCard({ map, title = "Your Interview Weaknesses", scope }: { map: WeaknessMap; title?: string; scope?: string }) {
  if (map.answersConsidered === 0) {
    return (
      <div className={`${cardClass} p-6`}>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-400">There are no evaluated answers to analyse yet.</p>
      </div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`${cardClass} p-6`}>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-500 mb-4">
        {scope ?? `Based on ${map.answersConsidered} evaluated answer${map.answersConsidered === 1 ? "" : "s"}`}. An area is listed when
        it was weak in at least two answers or in half of the answers that touched it.
      </p>

      {map.weaknesses.length === 0 ? (
        <p className="text-sm text-emerald-300">No recurring weaknesses found — nothing was consistently weak.</p>
      ) : (
        <ol className="space-y-3">
          {map.weaknesses.map((w, i) => (
            <li key={w.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm mb-1">
                <span className="text-white font-medium">
                  {i + 1}. {w.label}
                  {w.detail && w.detail.length > 0 && <span className="text-gray-500 font-normal"> · {w.detail.join(", ")}</span>}
                </span>
                <span className="text-xs text-gray-400 shrink-0">
                  weak in {w.occurrences} of {w.total}
                </span>
              </div>
              <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden" role="img" aria-label={`${w.label}: weight ${w.weight} out of 100`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(6, w.weight)}%` }}
                  transition={{ duration: 0.7, delay: i * 0.06 }}
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500"
                />
              </div>
              {w.examples.length > 0 && (
                <p className="text-[11px] text-gray-500 mt-1 truncate" title={w.examples.map((e) => `Q${e.questionIndex + 1}: ${e.question}`).join("\n")}>
                  e.g. Q{w.examples[0].questionIndex + 1} — {w.examples[0].question}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      {map.strengths.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-700">
          <p className="text-sm font-medium text-gray-300 mb-2">Strong areas</p>
          <ul className="flex flex-wrap gap-2">
            {map.strengths.map((s) => (
              <li key={s.key} className="px-2.5 py-1 rounded-full text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                ✓ {s.label} <span className="text-emerald-400/70">{s.avgScore}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
