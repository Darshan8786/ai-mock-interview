import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { ScoredResult } from "../services/profileApi";

const CATEGORY_ICONS: Record<string, string> = {
  Quantitative: "📊",
  "Logical Reasoning": "🧩",
  "Verbal Ability": "📝",
  "Data Interpretation": "📈",
};

type ReviewFilter = "all" | "wrong" | "skipped" | "correct";

export function AptitudeResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state as { result: ScoredResult | null } | null;
  const result = data?.result ?? null;
  const [filter, setFilter] = useState<ReviewFilter>("all");

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">We could not compute your result.</p>
          <p className="text-gray-400 text-sm mb-6">Your answers may not have been submitted. Please try again.</p>
          <button
            onClick={() => navigate("/aptitude")}
            className="mt-4 px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium"
          >
            Back to Aptitude
          </button>
        </div>
      </div>
    );
  }

  const {
    score,
    correctAnswers,
    wrongAnswers,
    unattempted,
    totalQuestions,
    marks,
    passed,
    passingScore,
    timeTaken,
    tabWarnings,
    terminationReason,
    categoryScores,
    questions,
  } = result;
  const tabSwitchTerminated = terminationReason === "TAB_SWITCH_LIMIT_EXCEEDED";

  const minutes = Math.floor(timeTaken / 60);
  const seconds = timeTaken % 60;

  const getGrade = (s: number) => {
    if (s >= 85) return { label: "Excellent", color: "text-emerald-400" };
    if (s >= 70) return { label: "Good", color: "text-blue-400" };
    if (s >= 50) return { label: "Average", color: "text-yellow-400" };
    return { label: "Needs Improvement", color: "text-red-400" };
  };

  const grade = getGrade(score);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 py-8 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 mb-4"
          >
            <span className="text-4xl font-bold text-white">{score}</span>
          </motion.div>
          {result.title && <p className="text-sm text-gray-500 mb-1">{result.title}</p>}
          <h1 className="text-3xl font-bold text-white mb-1">{grade.label}</h1>
          <p className="text-gray-400">
            You scored {correctAnswers}/{totalQuestions} correctly
            {passingScore !== undefined && passed !== undefined && (
              <span className={passed ? " text-emerald-400" : " text-red-400"}>
                {" "}· {passed ? "PASSED" : "BELOW PASS MARK"} ({passingScore}%)
              </span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatBox label="Correct" value={correctAnswers} color="emerald" />
          <StatBox label="Wrong" value={wrongAnswers} color="red" />
          <StatBox label="Unattempted" value={unattempted} color="gray" />
          <StatBox label="Tab Switches" value={tabWarnings} color={tabWarnings > 0 ? "red" : "emerald"} />
        </div>

        {tabSwitchTerminated && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-8 text-center text-sm text-red-300">
            This test was automatically terminated after {tabWarnings} tab switches, exceeding the 3-switch limit.
          </div>
        )}

        <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-4 mb-8 text-center">
          <p className="text-sm text-gray-400">
            Score: <span className="text-white font-bold">{score}%</span> · Final marks:{" "}
            <span className="text-white font-bold">
              {marks} / {totalQuestions * (result.marksPerQuestion ?? 1)}
            </span>{" "}
            <span className="text-gray-500">
              (+{result.marksPerQuestion} per correct
              {result.negativeMarksPerQuestion > 0 ? `, −${result.negativeMarksPerQuestion} per wrong` : ""})
            </span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {categoryScores.map((c) => (
            <CategoryCard
              key={c.category}
              label={c.category}
              icon={CATEGORY_ICONS[c.category] || "📘"}
              score={c.score}
              correct={c.correct}
              total={c.total}
            />
          ))}
        </div>

        <div className="flex gap-2 text-sm text-gray-400 mb-4">
          <span>Time: {minutes}m {seconds}s</span>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold text-white">Answers &amp; Logic</h2>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "all", label: "All", n: questions.length },
                  { key: "wrong", label: "Wrong", n: wrongAnswers },
                  { key: "skipped", label: "Skipped", n: unattempted },
                  { key: "correct", label: "Correct", n: correctAnswers },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    filter === f.key
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                      : "bg-gray-800/50 text-gray-400 border-gray-700 hover:border-gray-600"
                  }`}
                >
                  {f.label} ({f.n})
                </button>
              ))}
            </div>
          </div>

          {questions
            .map((r, idx) => ({ r, idx }))
            .filter(({ r }) => reviewStatus(r) === filter || filter === "all")
            .map(({ r, idx }) => {
              const status = reviewStatus(r);
              return (
                <motion.div
                  key={r.id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-gray-800/50 rounded-2xl border p-5 ${
                    status === "correct"
                      ? "border-emerald-500/30"
                      : status === "wrong"
                      ? "border-red-500/30"
                      : "border-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs text-gray-500">Q{idx + 1}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        status === "correct"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : status === "wrong"
                          ? "bg-red-500/15 text-red-400"
                          : "bg-gray-600/40 text-gray-300"
                      }`}
                    >
                      {status === "correct" ? "Correct" : status === "wrong" ? "Wrong" : "Skipped"}
                    </span>
                    {r.topic && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700/60 text-gray-400">{r.topic}</span>
                    )}
                    {r.difficulty && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-700/60 text-gray-400">{r.difficulty}</span>
                    )}
                  </div>

                  <p className="text-sm text-white font-medium mb-3 whitespace-pre-wrap">{r.question}</p>

                  <div className="space-y-2">
                    {r.options.map((opt, optIdx) => {
                      const isCorrectOption = optIdx === r.correct;
                      const isYourPick = optIdx === r.selected;
                      return (
                        <div
                          key={optIdx}
                          className={`flex items-start gap-2 px-4 py-2.5 rounded-xl text-sm border ${
                            isCorrectOption
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                              : isYourPick
                              ? "bg-red-500/15 border-red-500/40 text-red-300"
                              : "bg-gray-700/30 border-gray-700 text-gray-400"
                          }`}
                        >
                          <span className="font-mono text-xs opacity-60 mt-0.5">{String.fromCharCode(65 + optIdx)}.</span>
                          <span className="flex-1">{opt}</span>
                          {isCorrectOption && <span className="text-[10px] font-semibold shrink-0">✓ Correct answer</span>}
                          {isYourPick && !isCorrectOption && (
                            <span className="text-[10px] font-semibold shrink-0">✗ Your answer</span>
                          )}
                          {isYourPick && isCorrectOption && (
                            <span className="text-[10px] font-semibold shrink-0">· Your answer</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-3">
                    <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wide mb-1">Logic</p>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">
                      {r.explanation || "No explanation is available for this question."}
                    </p>
                  </div>
                </motion.div>
              );
            })}

          {filter !== "all" && !questions.some((r) => reviewStatus(r) === filter) && (
            <p className="text-sm text-gray-500 text-center py-6">Nothing to show here.</p>
          )}
        </div>

        <div className="flex gap-4 justify-center mt-8">
          <button
            onClick={() => navigate("/aptitude")}
            className="px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
          >
            Take Again
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-6 py-3 bg-gray-700/50 text-gray-300 rounded-xl font-medium border border-gray-600 hover:border-gray-500 transition-all"
          >
            Dashboard
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function reviewStatus(r: { selected: number | undefined; isCorrect: boolean }): "correct" | "wrong" | "skipped" {
  if (r.selected === undefined) return "skipped";
  return r.isCorrect ? "correct" : "wrong";
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
    gray: "text-gray-400 bg-gray-500/10 border-gray-500/20",
  };
  return (
    <div className={`rounded-2xl p-4 border text-center ${colors[color] || colors.gray}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

function CategoryCard({ label, score, icon, correct, total }: { label: string; score: number; icon: string; correct: number; total: number }) {
  const color = score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-medium text-white">{label}</span>
        <span className="ml-auto text-xs text-gray-500">
          {correct}/{total}
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8 }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <p className="text-right text-xs text-gray-400 mt-1">{score}%</p>
    </div>
  );
}
