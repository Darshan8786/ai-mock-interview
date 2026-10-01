import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { isAxiosError } from "axios";
import {
  answerAdaptiveTech, finishAdaptiveTech, getAdaptiveTechReport, getAdaptiveTechState, reattemptTech, retryAdaptiveTech,
} from "../services/adaptiveApi";
import type { TechAnswerResult, TechQuestionView, TechReport, TechReportItem, TechState } from "../services/adaptiveApi";
import {
  AdaptationNote, DifficultyBadge, FadeIn, GeneratingCard, ImprovementBadge, PlanCard, SourceBadge, SummaryReport, mmss, useElapsed,
} from "../components/adaptive/AdaptiveUI";

// Adaptive tech practice: one validated question at a time; grading, explanations and the next question's
// difficulty/topic come from the backend (which alone holds the answer key).
function inputKind(t: string): "mcq" | "code" | "text" {
  if (t === "MCQ") return "mcq";
  if (["Coding", "Programming Problem", "SQL Query", "Debugging"].includes(t)) return "code";
  return "text";
}

function CodeBlocks({ q }: { q: Partial<TechQuestionView> }) {
  return (
    <>
      {q.code_snippet && <pre className="bg-surface-2 border border-line rounded-xl p-4 text-sm text-emerald-700 dark:text-emerald-300 overflow-x-auto mb-5 font-mono">{q.code_snippet}</pre>}
      {q.buggy_code && <pre className="bg-surface-2 border border-line rounded-xl p-4 text-sm text-red-700 dark:text-red-300 overflow-x-auto mb-5 font-mono">{q.buggy_code}</pre>}
      {q.schema_context && <pre className="bg-surface-2 border border-line rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300 overflow-x-auto mb-5 font-mono">{q.schema_context}</pre>}
      {q.starter_code && <pre className="bg-surface-2 border border-line rounded-xl p-4 text-sm text-fg-2 overflow-x-auto mb-5 font-mono">{q.starter_code}</pre>}
    </>
  );
}

export function AdaptiveTechSession() {
  const { attemptId = "" } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<TechState | null>(null);
  const [feedback, setFeedback] = useState<TechAnswerResult | null>(null);
  const [option, setOption] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [report, setReport] = useState<TechReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shownAt, setShownAt] = useState<number | null>(null);
  const sessionStart = useRef(Date.now());
  const elapsed = useElapsed(shownAt);
  const total = useElapsed(state ? new Date(state.startedAt).getTime() : null);
  const finishing = useRef(false);

  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      setReport(await finishAdaptiveTech(attemptId, { timeTaken: Math.floor((Date.now() - sessionStart.current) / 1000) }));
    } catch {
      setError("Could not finish the session. Please refresh the page.");
      finishing.current = false;
    }
  }, [attemptId]);

  const refresh = useCallback(async () => {
    try {
      const s = await getAdaptiveTechState(attemptId);
      setState(s);
      if (s.status === "completed") {
        setReport(await getAdaptiveTechReport(attemptId));
        return;
      }
      if (s.currentQuestion) setShownAt((t) => t ?? Date.now());
    } catch (e) {
      setError(isAxiosError(e) && e.response?.status === 404 ? "Session not found." : "Could not reach the server.");
    }
  }, [attemptId]);

  useEffect(() => { void refresh(); }, [refresh]);
  const waiting = !!state && state.status === "in-progress" && !state.currentQuestion && !feedback && state.nextStatus !== "failed" && !report;
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => void refresh(), 1200);
    return () => clearInterval(t);
  }, [waiting, refresh]);

  const remaining = state && state.timeLimitMinutes > 0 ? state.timeLimitMinutes * 60 - total : null;
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !report) void finish();
  }, [remaining, report, finish]);

  const q = state?.currentQuestion || null;
  const kind = q ? inputKind(q.question_type) : "text";
  const canSubmit = kind === "mcq" ? option !== null : text.trim().length > 0;

  const submit = async (skip = false) => {
    if (!q || busy || !state) return;
    setBusy(true);
    try {
      const res = await answerAdaptiveTech(attemptId, { index: q.index, answer: skip ? null : kind === "mcq" ? option : text, responseTime: elapsed });
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
    setOption(null);
    setText("");
    setShownAt(null);
    setState((s) => (s ? { ...s, currentQuestion: null, nextStatus: "generating" } : s));
    await refresh();
  };

  if (error) {
    return (
      <Shell>
        <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
        <button onClick={() => navigate("/tech-practice")} className="px-5 py-2 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">Back to Tech Practice</button>
      </Shell>
    );
  }
  if (report) return <TechReportView report={report} attemptId={attemptId} onReport={setReport} />;
  if (!state) return <Shell><div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto" /></Shell>;

  return (
    <div className="min-h-[calc(100vh-4rem)] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold text-fg">{state.technology}{state.topic ? ` · ${state.topic}` : ""} · Adaptive Practice</h1>
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
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.round((state.answered / state.totalQuestions) * 100)}%` }} />
        </div>

        {state.answered === 0 && !q && state.personalization && <div className="mb-4"><PlanCard plan={state.personalization} /></div>}
        {!q && !feedback && (
          <GeneratingCard failed={state.nextStatus === "failed"} error={state.nextError}
            onRetry={async () => { await retryAdaptiveTech(attemptId); await refresh(); }} />
        )}

        {q && (
          <FadeIn k={q.index}>
            <div className="bg-surface rounded-2xl p-6 border border-line">
              <div className="flex flex-wrap items-center gap-2 mb-4 text-[11px]">
                <span className="px-2 py-0.5 rounded-md bg-surface-2 text-fg-2">{q.topic}</span>
                <span className="px-2 py-0.5 rounded-md bg-surface-2 text-fg-2">{q.question_type}</span>
                <DifficultyBadge level={q.difficulty} />
                <SourceBadge source={q.source} />
                {q.focusArea && <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">🎯 Focus area</span>}
                {!feedback && <span className="ml-auto text-subtle">{mmss(elapsed)}</span>}
              </div>
              {q.focusArea && <p className="text-xs text-amber-300/80 mb-3">{q.topicReason}</p>}
              <p className="text-lg text-fg font-medium mb-5 whitespace-pre-wrap">{q.question}</p>
              <CodeBlocks q={q} />

              {kind === "mcq" && (
                <div className="space-y-3">
                  {q.options?.map((opt, idx) => {
                    const isSel = option === idx;
                    const isRight = feedback && opt === feedback.correctAnswer;
                    return (
                      <button key={idx} disabled={!!feedback} onClick={() => setOption(idx)}
                        className={`w-full text-left px-5 py-3.5 rounded-xl text-sm font-medium transition-all border-2 ${
                          isRight ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50"
                            : feedback && isSel ? "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/50"
                            : isSel ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/50"
                            : feedback ? "bg-surface-2 text-muted border-line"
                            : "bg-surface-2 text-fg-2 border-line-strong hover:border-line-strong"}`}>
                        <span className="mr-3 font-mono text-xs opacity-60">{String.fromCharCode(65 + idx)}.</span>{opt}
                      </button>
                    );
                  })}
                </div>
              )}
              {kind !== "mcq" && (
                <textarea value={text} onChange={(e) => setText(e.target.value)} disabled={!!feedback} rows={kind === "code" ? 8 : 4}
                  placeholder={kind === "code" ? "Write your solution / query / fix here…" : "Type your answer…"}
                  className={`w-full bg-surface-2 border border-line-strong rounded-xl p-4 text-sm text-fg placeholder:text-subtle resize-none focus:outline-none focus:border-emerald-500/50 disabled:opacity-70 ${kind === "code" ? "font-mono" : ""}`} />
              )}

              {feedback && <EvaluationPanel ev={feedback} mcq={kind === "mcq"} />}

              <div className="flex justify-end gap-3 mt-6">
                {!feedback ? (
                  <>
                    <button onClick={() => submit(true)} disabled={busy} className="px-5 py-2.5 bg-surface-2 text-fg-2 rounded-xl border border-line-strong text-sm disabled:opacity-50">Skip</button>
                    <button onClick={() => submit()} disabled={busy || !canSubmit}
                      className="px-6 py-2.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-500/30 font-medium disabled:opacity-50">
                      {busy ? "Evaluating…" : "Submit Answer"}
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

function EvaluationPanel({ ev, mcq }: { ev: Partial<TechAnswerResult> & { pending?: boolean }; mcq: boolean }) {
  const tone = ev.pending ? "bg-surface-2 border-line-strong" : ev.isCorrect ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30";
  return (
    <div className={`mt-5 rounded-xl p-4 border ${tone}`}>
      <p className={`text-sm font-semibold mb-1 ${ev.pending ? "text-fg-2" : ev.isCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
        {ev.pending ? "Saved - evaluation pending" : ev.isCorrect ? "Correct" : ev.skipped ? "Skipped" : "Not quite"}
        {!ev.pending && typeof ev.score === "number" && ` · score ${ev.score}%`}
      </p>
      {ev.correctAnswer && !mcq && (
        <p className="text-sm text-fg mb-2"><span className="text-muted">Reference answer: </span><span className="whitespace-pre-wrap font-mono">{ev.correctAnswer}</span></p>
      )}
      {ev.referenceFixedCode && <pre className="bg-surface-2 border border-line rounded-lg p-3 text-xs text-emerald-700 dark:text-emerald-300 overflow-x-auto mb-2 font-mono">{ev.referenceFixedCode}</pre>}
      {ev.explanation && <p className="text-sm text-fg-2 whitespace-pre-wrap">{ev.explanation}</p>}
      {!!ev.expectedConcepts?.length && (
        <p className="text-xs text-muted mt-2">Expected concepts: {ev.expectedConcepts.map((c) => (
          <span key={c} className={`mr-1.5 ${ev.missingConcepts?.includes(c) ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>{ev.missingConcepts?.includes(c) ? "✗" : "✓"} {c}</span>
        ))}</p>
      )}
      {ev.recommendation && <p className="text-xs text-muted mt-1">{ev.recommendation}</p>}
      <AdaptationNote adaptation={ev.adaptation} />
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center"><div className="text-center">{children}</div></div>;
}

function TechReportView({ report, attemptId, onReport }: { report: TechReport; attemptId: string; onReport: (r: TechReport) => void }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-[calc(100vh-4rem)] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-fg mb-1">{report.technology}{report.topic ? ` · ${report.topic}` : ""} · Session Report</h1>
        <p className="text-muted text-sm mb-6">
          {report.summary.total} adaptive questions · {mmss(report.timeTaken || 0)}
          {report.pendingEvaluations > 0 && <span className="text-amber-700 dark:text-amber-300"> · {report.pendingEvaluations} answer(s) still awaiting evaluation</span>}
        </p>
        <SummaryReport summary={report.summary} comparison={report.comparison} nextSession={report.nextSession} applied={report.personalizationApplied}
          startDifficulty={report.startDifficulty} finalDifficulty={report.finalDifficulty} showTypes sources={report.sources} />
        <h2 className="text-lg font-semibold text-fg mt-8 mb-3">Question review & Practice Again</h2>
        <div className="space-y-3">
          {report.items.map((item) => (
            <TechReviewItem key={item.index} item={item} attemptId={attemptId}
              onUpdated={(u) => onReport({ ...report, items: report.items.map((x) => (x.index === u.index ? u : x)) })} />
          ))}
        </div>
        <div className="flex gap-3 mt-8">
          <button onClick={() => navigate("/tech-practice")} className="flex-1 px-6 py-3 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl font-medium border border-emerald-500/30">New session</button>
          <button onClick={() => navigate("/dashboard")} className="flex-1 px-6 py-3 bg-surface-2 text-fg-2 rounded-xl font-medium border border-line-strong">Go to Dashboard</button>
        </div>
      </div>
    </div>
  );
}

function TechReviewItem({ item, attemptId, onUpdated }: { item: TechReportItem; attemptId: string; onUpdated: (i: TechReportItem) => void }) {
  const [open, setOpen] = useState(false);
  const [practising, setPractising] = useState(false);
  const [answer, setAnswer] = useState<string>("");
  const [option, setOption] = useState<number | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof reattemptTech>> | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(Date.now());
  const kind = inputKind(item.questionType);
  const ev = item.evaluation;
  const label = item.isCorrect === null ? (item.submittedAnswer === null ? "Skipped" : "Pending") : item.isCorrect ? "Correct" : "Incorrect";

  const submit = async () => {
    setBusy(true);
    try {
      const r = await reattemptTech(attemptId, item.index, { answer: kind === "mcq" ? (option as number) : answer, timeTaken: Math.floor((Date.now() - started.current) / 1000) });
      setResult(r);
      onUpdated({ ...item, attempts: r.attempts, comparison: r.comparison, canPractice: r.attempts.length < 10 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl border border-line p-4">
      <button onClick={() => setOpen(!open)} className="w-full text-left flex items-start gap-3">
        <span className={`text-xs px-2 py-0.5 rounded-md shrink-0 ${item.isCorrect ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400"}`}>{label}{typeof item.score === "number" && item.isCorrect !== null ? ` ${item.score}%` : ""}</span>
        <span className="text-sm text-fg flex-1">{item.question}</span>
        <DifficultyBadge level={item.difficulty} />
      </button>
      <ImprovementBadge comparison={item.comparison} />
      {open && (
        <div className="mt-3 text-sm space-y-2">
          <p className="text-muted">{item.topic} · {item.questionType} · <SourceBadge source={item.source} /></p>
          {item.code && <pre className="bg-surface-2 border border-line rounded-lg p-3 text-xs text-fg-2 overflow-x-auto font-mono">{item.code}</pre>}
          {item.submittedAnswer !== null && (
            <p className="text-muted">Your answer: <span className="text-fg whitespace-pre-wrap font-mono">{kind === "mcq" && item.options ? item.options[Number(item.submittedAnswer)] : String(item.submittedAnswer)}</span></p>
          )}
          {ev && <EvaluationPanel ev={{ ...ev, adaptation: undefined }} mcq={kind === "mcq"} />}
          {item.canPractice && !practising && (
            <button onClick={() => { setPractising(true); setResult(null); setAnswer(""); setOption(null); started.current = Date.now(); }}
              className="mt-2 px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-medium">↻ Practice Again</button>
          )}
          {practising && (
            <div className="mt-3 rounded-xl bg-surface border border-line p-4">
              <p className="text-xs text-muted mb-2">Attempt #{item.attempts.length + 1} — earlier attempts are kept.</p>
              {kind === "mcq" ? (
                <div className="space-y-2">
                  {item.options?.map((o, i) => (
                    <button key={i} disabled={!!result} onClick={() => setOption(i)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg text-sm border ${option === i ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "border-line-strong bg-surface-2 text-fg-2"}`}>{o}</button>
                  ))}
                </div>
              ) : (
                <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={!!result} rows={kind === "code" ? 7 : 4}
                  className="w-full bg-surface-2 border border-line-strong rounded-xl p-3 text-sm text-fg placeholder:text-subtle font-mono resize-none" />
              )}
              {!result ? (
                <button onClick={submit} disabled={busy || (kind === "mcq" ? option === null : !answer.trim())}
                  className="mt-3 px-4 py-2 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium disabled:opacity-50">{busy ? "Evaluating…" : "Submit attempt"}</button>
              ) : (
                <div className="mt-3 text-xs space-y-1">
                  <p className={result.pending ? "text-fg-2" : result.attempt.isCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {result.pending ? "Saved - evaluation pending." : result.attempt.isCorrect ? `Correct · ${result.attempt.score}%` : `Score ${result.attempt.score}%`}
                  </p>
                  {!!result.missingConcepts.length && <p className="text-amber-700 dark:text-amber-300">Still missing: {result.missingConcepts.join(", ")}</p>}
                  <p className="text-muted">{result.recommendation}</p>
                  <button onClick={() => setPractising(false)} className="text-muted underline">Close</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
