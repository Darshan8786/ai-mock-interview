import { useState } from "react";
import { motion } from "framer-motion";
import { METRIC_DEFS, metricScore, type Evaluation, type MetricDef } from "../../../types/mockFeedback";
import { WhyScoreDrawer } from "./WhyScoreDrawer";
import { scoreBar, scoreText } from "./format";

interface Props {
  evaluation: Evaluation;
}

/** Score cards for one answer. Only metrics the record actually has are shown; each has "Why this score?". */
export function MetricScoreGrid({ evaluation }: Props) {
  const [open, setOpen] = useState<MetricDef | null>(null);
  const explanations = evaluation.analysis?.explanations;
  const shown = METRIC_DEFS.filter((d) => metricScore(evaluation, d) !== undefined);

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {shown.map((d, i) => {
          const score = metricScore(evaluation, d)!;
          const canExplain = !!explanations?.[d.key];
          return (
            <motion.div
              key={d.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-xl bg-gray-900/50 border border-gray-700 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-gray-400">{d.label}</span>
                <span className={`text-lg font-bold tabular-nums ${scoreText(score)}`}>{score}%</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mt-2">
                <div className={`h-full rounded-full ${scoreBar(score)}`} style={{ width: `${score}%` }} />
              </div>
              {canExplain ? (
                <button
                  onClick={() => setOpen(d)}
                  className="mt-2.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline"
                >
                  Why this score?
                </button>
              ) : (
                <p className="mt-2.5 text-[11px] text-gray-600">No detailed reasons for this answer</p>
              )}
            </motion.div>
          );
        })}
      </div>
      <WhyScoreDrawer
        open={!!open}
        label={open?.label ?? ""}
        score={open ? metricScore(evaluation, open) ?? 0 : 0}
        explanation={open ? explanations?.[open.key] : undefined}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
