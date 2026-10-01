import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import {
  answerAdaptiveAptitude, finishAdaptiveAptitude, getAdaptiveAptitudeReport, getAdaptiveAptitudeState, reattemptAptitude, retryAdaptiveAptitude,
} from "../services/adaptiveApi";
import type { AptitudeAnswerResult, AptitudeReport, AptitudeReportItem, AptitudeState } from "../services/adaptiveApi";
import {
  AdaptationNote, DifficultyBadge, FadeIn, GeneratingCard, ImprovementBadge, PlanCard, SourceBadge, SummaryReport, mmss, useElapsed,
} from "../components/adaptive/AdaptiveUI";

// Adaptive aptitude session: one AI-generated (validated) question at a time. The page never knows the answer key
// before submitting - correctness, the explanation and the next question's difficulty all come from the backend.
export function AdaptiveAptitudeSession() {
  const { attemptId = "" } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<AptitudeState | null>(null);
  const [feedback, setFeedback] = useState<AptitudeAnswerResult | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [report, setReport] = useState<AptitudeReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [questionShownAt, setQuestionShownAt] = useState<number | null>(null);
  const sessionStart = useRef(Date.now());
  const elapsed = useElapsed(questionShownAt);
  const total = useElapsed(state ? new Date(state.startedAt).getTime() : null);
  const finishing = useRef(false);

  const finish = useCallback(async (terminationReason?: string) => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      setReport(await finishAdaptiveAptitude(attemptId, { timeTaken: Math.floor((Date.now() - sessionStart.current) / 1000), terminationReason }));
    } catch {
      setError("Could not finish the session. Please refresh the page.");
      finishing.current = false;
    }
  }, [attemptId]);

  const refresh = useCallback(async () => {
    try {
      const s = await getAdaptiveAptitudeState(attemptId);
      setState(s);
      if (s.status === "completed") {
        setReport(await getAdaptiveAptitudeReport(attemptId));
        return;
      }
      if (s.currentQuestion) setQuestionShownAt((t) => t ?? Date.now());
    } catch (e) {
      setError(isAxiosError(e) && e.response?.status === 404 ? "Session not found." : "Could not reach the server.");
    }
  }, [attemptId]);

  useEffect(() => { void refresh(); }, [refresh]);

  // poll while the next question is being generated
  const waiting = !!state && state.status === "started" && !state.currentQuestion && !feedback && state.nextStatus !== "failed" && !report;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => void refresh(), 1200);
    return () => clearInterval(t);
  }, [waiting, refresh]);

  // optional overall time limit
  const remaining = state && state.timeLimitMinutes > 0 ? state.timeLimitMinutes * 60 - total : null;
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !report) void finish("TIME_LIMIT_REACHED");
  }, [remaining, report, finish]);

  const submit = async (skip = false) => {
    if (!state?.currentQuestion || busy) return;
    setBusy(true);
    try {
      const res = await answerAdaptiveAptitude(attemptId, {
        itemIndex: state.currentQuestion.itemIndex, selected: skip ? null : selected, responseTime: elapsed,
      });
      setFeedback(res);
      setState({ ...state, answered: res.answered, correct: res.correct, currentDifficulty: res.adaptation.level });
    } catch (e) {
      setError(isAxiosError(e) ? e.response?.data?.message || "Could not submit the answer." : "Could not submit the answer.");
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    if (feedback?.isLast) return finish();
    setFeedback(null);
    setSelected(null);
    setQuestionShownAt(null);
    setState((s) => (s ? { ...s, currentQuestion: null, nextStatus: "generating" } : s));
    await refresh();
  };

  if (error) {
    return (
      <Shell>
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate("/aptitude")} className="px-5 py-2 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">Back to Aptitude</button>
      </Shell>
    );
  }
  if (report) return <AptitudeReportView report={report} attemptId={attemptId} onReport={setReport} />;
  if (!state) return <Shell><div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto" /></Shell>;

  const q = state.currentQuestion;
  const progress = Math.round((state.answered / state.totalQuestions) * 100);
  return (
    <div className="min-h-[calc(100vh-4rem)] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold text-fg">{state.topic || state.category} · Adaptive Practice</h1>
            <p className="text-xs text-muted mt-0.5">
              Question {Math.min(state.answered + (feedback ? 0 : 1), state.totalQuestions)} of {state.totalQuestions} · {state.correct} correct
            </p>
          </div>
          <div className="text-right text-xs text-muted space-y-1">
            <div>Current difficulty <DifficultyBadge level={state.currentDifficulty} /></div>
            {remaining !== null ? <div className={remaining < 60 ? "text-red-600 dark:text-red-400" : ""}>⏱ {mmss(remaining)} left</div> : <div>⏱ {mmss(total)}</div>}
          </div>
        </div>
        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>

        {state.answered === 0 && !q && state.personalization && <div className="mb-4"><PlanCard plan={state.personalization} /></div>}

        {!q && !feedback && (
          <GeneratingCard failed={state.nextStatus === "failed"} error={state.nextError}
            onRetry={async () => { await retryAdaptiveAptitude(attemptId); await refresh(); }} />
        )}

        {q && (
          <FadeIn k={q.itemIndex}>
            <div className="bg-surface rounded-2xl p-6 border border-line">
              <div className="flex flex-wrap items-center gap-2 mb-4 text-[11px]">
                <span className="px-2 py-0.5 rounded-md bg-surface-2 text-fg-2">{q.category}</span>
                <span className="px-2 py-0.5 rounded-md bg-surface-2 text-fg-2">{q.topic}</span>
                <DifficultyBadge level={q.difficulty} />
                <SourceBadge source={q.source} />
                {q.focusArea && <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">🎯 Focus area</span>}
                {!feedback && <span className="ml-auto text-subtle">{mmss(elapsed)}</span>}
              </div>
              {q.focusArea && <p className="text-xs text-amber-300/80 mb-3">{q.topicReason}</p>}
              <p className="text-lg text-fg font-medium mb-5 whitespace-pre-wrap">{q.question}</p>
              <div className="space-y-3">
                {q.options.map((opt, idx) => {
                  const isSel = selected === idx;
                  const isRight = feedback && idx === feedback.correctIndex;
                  const isWrongPick = feedback && isSel && !feedback.isCorrect;
                  return (
                    <button key={idx} disabled={!!feedback} onClick={() => setSelected(idx)}
                      className={`w-full text-left px-5 py-3.5 rounded-xl text-sm font-medium transition-all border-2 ${
                        isRight ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50"
                          : isWrongPick ? "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/50"
                          : isSel ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50"
                          : feedback ? "bg-surface-2 text-muted border-line"
                          : "bg-surface-2 text-fg-2 border-line-strong hover:border-line-strong"}`}>
                      <span className="mr-3 font-mono text-xs opacity-60">{String.fromCharCode(65 + idx)}.</span>{opt}
                    </button>
                  );
                })}
              </div>

              {feedback && (
                <div className={`mt-5 rounded-xl p-4 border ${feedback.isCorrect ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                  <p className={`text-sm font-semibold mb-1 ${feedback.isCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {feedback.isCorrect ? "Correct" : feedback.skipped ? "Skipped" : "Incorrect"} · score {feedback.isCorrect ? 100 : 0}%
                  </p>
                  {!feedback.isCorrect && <p className="text-sm text-fg mb-2"><span className="text-muted">Correct answer: </span>{feedback.correctOption}</p>}
                  {feedback.explanation && <p className="text-sm text-fg-2 whitespace-pre-wrap"><span className="text-muted">Explanation: </span>{feedback.explanation}</p>}
                  {feedback.weakConcept && <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">Weak concept: {feedback.weakConcept}</p>}
                  <p className="text-xs text-muted mt-1">{feedback.recommendation}</p>
                  <AdaptationNote adaptation={feedback.adaptation} />
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6">
                {!feedback ? (
                  <>
                    <button onClick={() => submit(true)} disabled={busy} className="px-5 py-2.5 bg-surface-2 text-fg-2 rounded-xl border border-line-strong text-sm disabled:opacity-50">Skip</button>
                    <button onClick={() => submit()} disabled={busy || selected === null}
                      className="px-6 py-2.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-500/30 font-medium disabled:opacity-50">
                      {busy ? "Checking…" : "Submit Answer"}
                    </button>
                  </>
                ) : (
                  <button onClick={next} className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-xl font-bold">
                    {feedback.isLast ? "Finish & See Report" : "Next Question →"}
                  </button>
                )}
              </div>
            </div>
          </FadeIn>
        )}

        {!feedback && state.answered > 0 && (
          <button onClick={() => finish()} className="mt-6 text-xs text-subtle hover:text-fg-2">End session early and see report</button>
        )}
      </div>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center"><div className="text-center">{children}</div></div>;
}

function AptitudeReportView({ report, attemptId, onReport }: { report: AptitudeReport; attemptId: string; onReport: (r: AptitudeReport) => void }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-[calc(100vh-4rem)] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-fg mb-1">{report.topic || report.category} · Session Report</h1>
        <p className="text-muted text-sm mb-6">{report.summary.total} adaptive questions · {mmss(report.timeTaken || 0)}</p>
        <SummaryReport summary={report.summary} comparison={report.comparison} nextSession={report.nextSession}
          applied={report.personalizationApplied} startDifficulty={report.startDifficulty} finalDifficulty={report.finalDifficulty} sources={report.sources} />

        <h2 className="text-lg font-semibold text-fg mt-8 mb-3">Question review & Practice Again</h2>
        <div className="space-y-3">
          {report.items.map((item) => (
            <ReviewItem key={item.itemIndex} item={item} attemptId={attemptId}
              onUpdated={(updated) => onReport({ ...report, items: report.items.map((x) => (x.itemIndex === updated.itemIndex ? updated : x)) })} />
          ))}
        </div>

        <div className="flex gap-3 mt-8">
          <button onClick={() => navigate("/aptitude")} className="flex-1 px-6 py-3 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl font-medium border border-emerald-500/30">New adaptive session</button>
          <button onClick={() => navigate("/aptitude/progress")} className="flex-1 px-6 py-3 bg-surface-2 text-fg-2 rounded-xl font-medium border border-line-strong">My Progress</button>
        </div>
      </div>
    </div>
  );
}

function ReviewItem({ item, attemptId, onUpdated }: { item: AptitudeReportItem; attemptId: string; onUpdated: (i: AptitudeReportItem) => void }) {
  const [open, setOpen] = useState(false);
  const [practising, setPractising] = useState(false);
  const [pick, setPick] = useState<string | null>(null);
  const [result, setResult] = useState<{ isCorrect: boolean; correctOption: string; recommendation: string } | null>(null);
  const [shuffled] = useState(() => [...item.options].sort(() => Math.random() - 0.5));
  const started = useRef(Date.now());
  const status = !item.answered ? "Not reached" : item.selected === null ? "Skipped" : item.isCorrect ? "Correct" : "Incorrect";

  const submitPractice = async () => {
    if (!pick) return;
    const r = await reattemptAptitude(attemptId, item.itemIndex, { selectedText: pick, timeTaken: Math.floor((Date.now() - started.current) / 1000) });
    setResult({ isCorrect: r.attempt.isCorrect, correctOption: r.correctOption, recommendation: r.recommendation });
    onUpdated({ ...item, attempts: r.attempts, comparison: r.comparison, canPractice: r.attempts.length < 10 });
  };

  return (
    <div className="bg-surface rounded-xl border border-line p-4">
      <button onClick={() => setOpen(!open)} className="w-full text-left flex items-start gap-3">
        <span className={`text-xs px-2 py-0.5 rounded-md shrink-0 ${item.isCorrect ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400"}`}>{status}</span>
        <span className="text-sm text-fg flex-1">{item.question}</span>
        <DifficultyBadge level={item.difficulty} />
      </button>
      <ImprovementBadge comparison={item.comparison} />
      {open && (
        <div className="mt-3 text-sm space-y-2">
          <p className="text-muted">Topic: <span className="text-fg">{item.topic}</span>{item.responseTime ? ` · ${item.responseTime}s` : ""} · <SourceBadge source={item.source} /></p>
          {item.selected !== null && item.selected !== undefined && <p className="text-muted">Your answer: <span className="text-fg">{item.options[item.selected]}</span></p>}
          <p className="text-muted">Correct answer: <span className="text-emerald-700 dark:text-emerald-400">{item.options[item.correct]}</span></p>
          {item.explanation && <p className="text-fg-2 whitespace-pre-wrap">{item.explanation}</p>}
          {item.attempts.length > 1 && (
            <p className="text-xs text-subtle">Attempts: {item.attempts.map((a) => `#${a.attemptNumber} ${a.isCorrect ? "✓" : "✗"}`).join("  ")}</p>
          )}
          {item.canPractice && !practising && (
            <button onClick={() => { setPractising(true); setResult(null); setPick(null); started.current = Date.now(); }}
              className="mt-2 px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-medium">↻ Practice Again</button>
          )}
          {practising && (
            <div className="mt-3 rounded-xl bg-surface border border-line p-4">
              <p className="text-xs text-muted mb-2">Attempt #{item.attempts.length + 1} — options are reshuffled; your first attempt is kept.</p>
              <div className="space-y-2">
                {shuffled.map((o) => (
                  <button key={o} disabled={!!result} onClick={() => setPick(o)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm border ${pick === o ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "border-line-strong bg-surface-2 text-fg-2"}`}>{o}</button>
                ))}
              </div>
              {!result ? (
                <button onClick={submitPractice} disabled={!pick} className="mt-3 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium disabled:opacity-50">Submit attempt</button>
              ) : (
                <div className="mt-3 text-xs">
                  <p className={result.isCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{result.isCorrect ? "Correct this time." : `Still incorrect — correct answer: ${result.correctOption}`}</p>
                  <p className="text-muted mt-1">{result.recommendation}</p>
                  <button onClick={() => setPractising(false)} className="mt-2 text-muted underline">Close</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
