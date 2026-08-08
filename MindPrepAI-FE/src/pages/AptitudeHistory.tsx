import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getAptitudeHistory, getAptitudeHistoryDetail } from "../services/profileApi";
import type { AttemptSummary, AttemptDetail } from "../services/profileApi";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  started: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  expired: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function AptitudeHistory() {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<AttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAptitudeHistory()
      .then((data) => {
        if (cancelled) return;
        setAttempts(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load history. Make sure the backend is running and you are logged in.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDetail = async (attemptId: string) => {
    setDetailLoading(true);
    try {
      const d = await getAptitudeHistoryDetail(attemptId);
      setDetail(d);
    } catch {
      setDetail(null);
    }
    setDetailLoading(false);
  };

  const toggleDetail = (attempt: AttemptSummary, idx: number) => {
    if (expanded === idx) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(idx);
    if (attempt.status === "completed") {
      loadDetail(attempt.attemptId);
    } else {
      setDetail(null);
    }
  };

  const fmtDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 py-10 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">🕘 Test History</h1>
            <p className="text-gray-400 text-sm mt-1">Review your past aptitude attempts.</p>
          </div>
          <button
            onClick={() => navigate("/aptitude")}
            className="px-4 py-2 rounded-xl bg-gray-700/50 text-gray-300 border border-gray-600 text-sm hover:border-gray-500 transition-all"
          >
            ← Back
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center mb-6">
            {error}
          </div>
        )}

        {!error && attempts.length === 0 && (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">📭</p>
            <p className="text-gray-400 text-sm">No attempts yet. Take your first test from the aptitude dashboard!</p>
            <button
              onClick={() => navigate("/aptitude")}
              className="mt-5 px-6 py-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
            >
              Start a Test
            </button>
          </div>
        )}

        <div className="space-y-3">
          {attempts.map((a, idx) => (
            <div key={a.attemptId} className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden">
              <button onClick={() => toggleDetail(a, idx)} className="w-full text-left p-5 flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-white text-sm">{a.title || "Aptitude Test"}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_STYLES[a.status] || "bg-gray-700/60 text-gray-300"}`}>
                      {a.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {a.testType} mode · {a.difficulty || "mixed"} · {fmtDate(a.createdAt)}
                  </p>
                </div>
                {a.status === "completed" ? (
                  <div className="flex items-center gap-6 text-center">
                    <div>
                      <p className="text-lg font-bold text-emerald-400">{a.accuracy}%</p>
                      <p className="text-[10px] text-gray-500 uppercase">Accuracy</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">{a.score}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Score</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-300">{a.correctAnswers}✓ {a.wrongAnswers}✗</p>
                      <p className="text-[10px] text-gray-500 uppercase">C / W</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-yellow-400 font-medium">In progress</p>
                    <p className="text-[10px] text-gray-500 uppercase">{fmtTime(a.timeTaken)} elapsed</p>
                  </div>
                )}
                <span className="text-gray-500 text-xs">{expanded === idx ? "▲" : "▼"}</span>
              </button>

              {expanded === idx && (
                <div className="px-5 pb-5 border-t border-gray-700/50">
                  {a.status === "completed" ? (
                    detailLoading ? (
                      <div className="py-8 flex justify-center">
                        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
                      </div>
                    ) : detail ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                          <span>Total: <b className="text-white">{detail.totalQuestions}</b></span>
                          <span>Correct: <b className="text-emerald-400">{detail.correctAnswers}</b></span>
                          <span>Wrong: <b className="text-red-400">{detail.wrongAnswers}</b></span>
                          <span>Unattempted: <b className="text-gray-300">{detail.unattempted}</b></span>
                          <span>Marks: <b className="text-white">{detail.marks}</b></span>
                          <span>Time: {fmtTime(detail.timeTaken)}</span>
                        </div>

                        {detail.questions.length > 0 && (
                          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                            {detail.questions.map((q, qidx) => (
                              <div
                                key={q.id || qidx}
                                className={`rounded-xl border p-3 ${
                                  q.isCorrect
                                    ? "border-emerald-500/30"
                                    : q.selected === undefined
                                    ? "border-gray-700"
                                    : "border-red-500/30"
                                }`}
                              >
                                <p className="text-sm text-white font-medium">{q.question}</p>
                                <p className="text-[10px] text-gray-500 mt-1">
                                  {q.topic} · {q.difficulty} · Your answer:{" "}
                                  {q.selected !== undefined ? q.options[q.selected] : "Not answered"}
                                </p>
                                {q.explanation && (
                                  <p className="text-xs text-emerald-400 mt-1.5">
                                    Correct: {q.options[q.correct]} — {q.explanation}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 py-3 text-center">Could not load this attempt's details.</p>
                    )
                  ) : (
                    <p className="text-xs text-gray-500 py-3 text-center">
                      This attempt is still in progress — answers and explanations become available after submission.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
