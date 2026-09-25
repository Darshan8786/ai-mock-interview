import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Explanation } from "../../../types/mockFeedback";
import { scoreText } from "./format";

interface Props {
  open: boolean;
  label: string;
  score: number;
  explanation: Explanation | undefined;
  onClose: () => void;
}

/**
 * "Why this score?" - a right-hand drawer on wide screens, a bottom sheet on phones. Every line shown was
 * derived by the local evaluator from the candidate's answer, the question and its expected concepts.
 */
export function WhyScoreDrawer({ open, label, score, explanation, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const nothing =
    !explanation || (explanation.good.length + explanation.missing.length + explanation.improve.length === 0);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={`Why this score: ${label}`}
            className="relative w-full sm:w-[28rem] max-h-[85vh] sm:max-h-none overflow-y-auto bg-gray-900 border border-gray-700 sm:border-y-0 sm:border-r-0 rounded-t-3xl sm:rounded-none p-6"
            initial={{ y: 60, x: 0, opacity: 0 }}
            animate={{ y: 0, x: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500">Why this score?</p>
                <h3 className="text-xl font-bold text-white mt-1">
                  {label} — <span className={scoreText(score)}>{score}%</span>
                </h3>
              </div>
              <button
                ref={closeRef}
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 w-9 h-9 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700"
              >
                ✕
              </button>
            </div>

            {nothing ? (
              <p className="text-sm text-gray-400">
                No specific reasons were recorded for this score. Detailed reasons are only generated for answers
                evaluated after this feature was added.
              </p>
            ) : (
              <div className="space-y-5">
                <Section title="What was good" icon="✓" tone="text-emerald-400" items={explanation!.good} empty="Nothing notable for this metric." />
                <Section title="What was missing" icon="✗" tone="text-red-400" items={explanation!.missing} empty="No gaps found for this metric." />
                <Section title="How to improve" icon="→" tone="text-blue-400" items={explanation!.improve} empty="No specific action needed." />
              </div>
            )}

            {explanation?.note && (
              <p className="mt-5 rounded-lg bg-gray-800 border border-gray-700 px-3 py-2 text-xs text-gray-400 leading-relaxed">
                ℹ {explanation.note}
              </p>
            )}

            <p className="text-[11px] text-gray-500 mt-6 leading-relaxed">
              Reasons come from your answer text, the question's expected concepts and (for voice answers) the audio
              measured while you spoke — nothing is guessed.
            </p>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ title, icon, tone, items, empty }: { title: string; icon: string; tone: string; items: string[]; empty: string }) {
  return (
    <div>
      <h4 className={`text-sm font-semibold mb-2 ${tone}`}>
        {icon} {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((t, i) => (
            <li key={i} className="text-sm text-gray-300 leading-relaxed flex gap-2">
              <span className="text-gray-600 select-none">•</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
