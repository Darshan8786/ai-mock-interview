import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getQuestionHistory } from "../../../services/mockInterviewApi";
import type { AttemptView, Comparison, QuestionSummary, ReportFeedback, VerdictLevel } from "../../../types/mockFeedback";
import { AnswerStructureCard } from "./AnswerStructureCard";
import { AnswerTimeline } from "./AnswerTimeline";
import { AttemptComparison } from "./AttemptComparison";
import { CommunicationCard } from "./CommunicationCard";
import { MetricScoreGrid } from "./MetricScoreGrid";
import { PracticeAgain, type ReattemptResult } from "./PracticeAgain";
import { StrengthWeaknessCards } from "./StrengthWeaknessCards";
import { cardClass, fmtDateTime, scoreText } from "./format";

const BADGE: Record<VerdictLevel, { icon: string; cls: string }> = {
  strong: { icon: "✓", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  improve: { icon: "⚠", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  weak: { icon: "🔴", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
  skipped: { icon: "–", cls: "bg-gray-700/60 text-gray-400 border-gray-600" },
  pending: { icon: "…", cls: "bg-gray-700/60 text-gray-400 border-gray-600" },
};

interface Props {
  interview: any;
  feedback: ReportFeedback;
}

interface QState {
  summary: QuestionSummary;
  attempts: AttemptView[] | null; // null until loaded (attempt 1 is derivable immediately)
  comparison: Comparison | null;
}

/** Attempt 1 straight from the stored interview question (no request needed). */
function firstAttempt(interview: any, q: any): AttemptView {
  return {
    attemptNumber: 1,
    answer: q.answer || "",
    transcript: q.transcript || (q.answerType === "voice" ? q.answer || "" : ""),
    answerType: q.answerType || "text",
    timeTaken: q.timeTaken || 0,
    speech: q.speech,
    evaluation: q.evaluation || null,
    createdAt: q.answeredAt || interview.completedAt || interview.createdAt || null,
    timestampApproximate: !q.answeredAt,
  };
}

export function QuestionFeedbackAccordion({ interview, feedback }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, QState>>(() =>
    Object.fromEntries(feedback.questions.map((s) => [s.questionId, { summary: s, attempts: null, comparison: s.comparison }]))
  );
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [practicing, setPracticing] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const toggle = useCallback(
    async (s: QuestionSummary) => {
      const id = s.questionId;
      if (openId === id) {
        setOpenId(null);
        return;
      }
      setOpenId(id);
      setLoadError(null);
      const cur = state[id];
      if (cur && cur.attempts === null && cur.summary.attemptCount > 1) {
        try {
          const res = await getQuestionHistory(interview._id, id);
          if (!res?.success) throw new Error(res?.message || "Could not load attempts");
          setState((p) => ({ ...p, [id]: { ...p[id], attempts: res.data.attempts, comparison: res.data.comparison } }));
        } catch (e) {
          setLoadError(e instanceof Error ? e.message : "Could not load attempts");
        }
      }
    },
    [openId, state, interview._id]
  );

  const onSaved = (id: string, r: ReattemptResult) => {
    setState((p) => ({ ...p, [id]: { summary: r.summary, attempts: r.attempts, comparison: r.comparison } }));
    setSelected((p) => ({ ...p, [id]: r.attempt.attemptNumber }));
    setPracticing(null);
  };

  return (
    <div className="space-y-3">
      {interview.questions.map((q: any, i: number) => {
        const s0 = feedback.questions[i];
        if (!s0) return null;
        const st = state[s0.questionId];
        const s = st.summary;
        const badge = BADGE[s.verdict.level];
        const isOpen = openId === s.questionId;
        const attempts: AttemptView[] = st.attempts ?? [firstAttempt(interview, q)];
        const shownNo = selected[s.questionId] ?? attempts[0].attemptNumber;
        const attempt = attempts.find((a) => a.attemptNumber === shownNo) ?? attempts[0];
        const ev = attempt.evaluation;
        const analysis = ev?.analysis;
        const evaluated = !!ev && ev.source !== "fallback";
        const isCommunication = analysis?.communication;

        return (
          <div key={s.questionId} className={`${cardClass} overflow-hidden`}>
            <button
              onClick={() => toggle(s)}
              aria-expanded={isOpen}
              aria-controls={`q-panel-${s.questionId}`}
              className="w-full flex items-center gap-3 text-left p-4 hover:bg-gray-700/20 transition-colors"
            >
              <span className="shrink-0 text-xs font-mono text-gray-400 bg-gray-700 px-2 py-0.5 rounded">Q{i + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-white font-medium truncate sm:whitespace-normal">{q.question}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${badge.cls}`}>
                    <span aria-hidden>{badge.icon}</span> {s.verdict.label}
                  </span>
                  {s.focusArea && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-purple-500/10 text-purple-300 border border-purple-500/20" title="Chosen because of your earlier interviews">
                      Targeted: {s.focusArea}
                    </span>
                  )}
                  {s.attemptCount > 1 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-500/10 text-blue-300 border border-blue-500/20">
                      {s.attemptCount} attempts
                    </span>
                  )}
                </span>
              </span>
              {(s.verdict.level === "strong" || s.verdict.level === "improve" || s.verdict.level === "weak") && (
                <span className={`shrink-0 text-lg font-bold tabular-nums ${scoreText(s.verdict.score)}`}>{s.verdict.score}%</span>
              )}
              <span className={`shrink-0 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden>▾</span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`q-panel-${s.questionId}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 pt-0 space-y-4 border-t border-gray-700/60">
                    {loadError && <p className="text-sm text-red-400 pt-3">{loadError}</p>}

                    {s.verdict.level === "skipped" ? (
                      <p className="text-sm text-gray-400 pt-3">This question was skipped, so there is nothing to score.</p>
                    ) : (
                      <>
                        {attempts.length > 1 && (
                          <div className="pt-3 flex flex-wrap gap-2" role="tablist" aria-label="Attempts">
                            {attempts.map((a) => (
                              <button
                                key={a.attemptNumber}
                                role="tab"
                                aria-selected={a.attemptNumber === attempt.attemptNumber}
                                onClick={() => setSelected((p) => ({ ...p, [s.questionId]: a.attemptNumber }))}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                                  a.attemptNumber === attempt.attemptNumber
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    : "bg-gray-700/40 text-gray-300 border-gray-600 hover:border-gray-500"
                                }`}
                              >
                                Attempt {a.attemptNumber}
                              </button>
                            ))}
                          </div>
                        )}

                        {st.comparison && attempts.length > 1 && <AttemptComparison comparison={st.comparison} />}

                        {/* Candidate answer + transcript */}
                        <div className={`rounded-xl bg-gray-900/50 border border-gray-700 p-4 ${attempts.length > 1 ? "" : "mt-3"}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <h5 className="text-sm font-semibold text-white">
                              {attempt.answerType === "voice" ? "Your answer (transcript)" : "Your answer"}
                            </h5>
                            <span className="text-[11px] text-gray-500">
                              Attempt {attempt.attemptNumber} · {attempt.answerType === "voice" ? "🎤 spoken" : "⌨️ typed"} ·{" "}
                              {fmtDateTime(attempt.createdAt)}
                              {attempt.timestampApproximate ? " (approx.)" : ""}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                            {attempt.answer || <span className="text-gray-500">No answer recorded.</span>}
                          </p>
                        </div>

                        {!ev ? null : !evaluated ? (
                          <div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4 text-sm text-yellow-100">
                            Automatic evaluation was unavailable for this answer, so it has no scores or explanation yet. Your
                            answer was saved — reopening this report retries the evaluation.
                          </div>
                        ) : (
                          <>
                            <MetricScoreGrid evaluation={ev} />
                            {!analysis && ev.feedback && (
                              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
                                <p className="text-xs text-gray-400 mb-1">AI Feedback</p>
                                <p className="text-sm text-blue-200 leading-relaxed">{ev.feedback}</p>
                                <p className="text-[11px] text-gray-500 mt-2">
                                  Detailed reasons, structure and speaking analysis are not available for answers recorded before
                                  this feature existed.
                                </p>
                              </div>
                            )}
                            {analysis && (
                              <>
                                <AnswerStructureCard structure={analysis.structure} />
                                {isCommunication && <CommunicationCard comm={analysis.communication} answerType={attempt.answerType} />}
                                <AnswerTimeline
                                  events={analysis.timeline}
                                  durationSeconds={analysis.communication.durationSeconds}
                                  durationIsRecording={analysis.communication.durationSource === "recording"}
                                />
                                <StrengthWeaknessCards analysis={analysis} />
                              </>
                            )}
                          </>
                        )}

                        {/* Practice Again */}
                        {practicing === s.questionId ? (
                          <PracticeAgain
                            interviewId={interview._id}
                            questionId={s.questionId}
                            question={q.question}
                            nextAttemptNumber={s.attemptCount + 1}
                            onSaved={(r) => onSaved(s.questionId, r)}
                            onCancel={() => setPracticing(null)}
                          />
                        ) : (
                          s.canPractice && (
                            <button
                              onClick={() => setPracticing(s.questionId)}
                              className="px-5 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                            >
                              ↻ Practice Again
                            </button>
                          )
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
