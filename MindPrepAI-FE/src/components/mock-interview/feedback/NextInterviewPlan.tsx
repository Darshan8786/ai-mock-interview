import { motion } from "framer-motion";
import type { Personalization } from "../../../types/mockFeedback";
import { cardClass } from "./format";

interface Props {
  plan: Personalization;
  title?: string;
  compact?: boolean;
}

/** Personalised recommendations. Only says the next interview will change when it really will. */
export function NextInterviewPlan({ plan, title = "Your Next Interview", compact = false }: Props) {
  if (!plan.hasHistory) {
    return compact ? null : (
      <div className={`${cardClass} p-6`}>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-400">
          Finish a few interviews and your next one will adapt to the topics you struggle with.
        </p>
      </div>
    );
  }
  const nothing = !plan.message && plan.coaching.length === 0 && plan.suggestions.length === 0;
  if (nothing && compact) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className={`${cardClass} ${compact ? "p-4" : "p-6"}`}>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-gray-500 mb-3">
        Based on your last {plan.basedOnInterviews} interview{plan.basedOnInterviews === 1 ? "" : "s"}
      </p>

      {plan.message ? (
        <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-4">
          <p className="text-sm text-purple-100 leading-relaxed">“{plan.message}”</p>
          <ul className="mt-2 space-y-1">
            {plan.focusAreas.map((f) => (
              <li key={f.label} className="text-xs text-purple-200/70">
                <span className="text-purple-300 font-medium">{f.label}</span> — {f.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-gray-400">
          Nothing in your history calls for changing the questions — no topic was repeatedly weak.
        </p>
      )}

      {plan.suggestions.map((s, i) => (
        <p key={i} className="mt-3 text-sm text-gray-300">💡 {s}</p>
      ))}

      {plan.coaching.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-300 mb-2">Skills to work on</p>
          <ul className="space-y-2">
            {plan.coaching.map((c) => (
              <li key={c.label} className="text-sm text-gray-300 leading-relaxed">
                <span className="text-amber-300 font-medium">{c.label}:</span> {c.advice}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
}
