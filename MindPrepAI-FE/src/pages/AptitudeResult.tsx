import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

interface ResultData {
  answers: Record<number, number>;
  questions: any[];
  timeTaken: number;
  tabWarnings: number;
}

export function AptitudeResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state as ResultData | null;
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg">No results found</p>
          <button onClick={() => navigate("/aptitude")} className="mt-4 px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium">
            Take Test
          </button>
        </div>
      </div>
    );
  }

  const { answers, questions, timeTaken, tabWarnings } = data;
  let correct = 0;
  const results = questions.map((q: any, idx: number) => {
    const isCorrect = answers[idx] === q.correct;
    if (isCorrect) correct++;
    return { ...q, selected: answers[idx], isCorrect };
  });

  const total = questions.length;
  const score = Math.round((correct / total) * 100);
  const minutes = Math.floor(timeTaken / 60);
  const seconds = timeTaken % 60;

  const getGrade = (s: number) => {
    if (s >= 85) return { label: "Excellent", color: "text-emerald-400" };
    if (s >= 70) return { label: "Good", color: "text-blue-400" };
    if (s >= 50) return { label: "Average", color: "text-yellow-400" };
    return { label: "Needs Improvement", color: "text-red-400" };
  };

  const grade = getGrade(score);

  const quantQs = questions.filter((q: any) => q.category === "Quantitative");
  const logicalQs = questions.filter((q: any) => q.category === "Logical");
  const verbalQs = questions.filter((q: any) => q.category === "Verbal");

  const catScore = (qs: any[]) => {
    const done = qs.filter((q: any) => answers[q.id - 1] === q.correct).length;
    return qs.length > 0 ? Math.round((done / qs.length) * 100) : 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 py-8 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 mb-4"
          >
            <span className="text-4xl font-bold text-white">{score}</span>
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-1">{grade.label}</h1>
          <p className="text-gray-400">You scored {correct}/{total} correctly</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatBox label="Correct" value={correct} color="emerald" />
          <StatBox label="Wrong" value={total - correct - Object.values(answers).filter((a) => a === undefined).length} color="red" />
          <StatBox label="Unattempted" value={total - Object.keys(answers).length} color="gray" />
          <StatBox label="Tab Warnings" value={tabWarnings} color={tabWarnings > 0 ? "red" : "emerald"} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <CategoryCard label="Quantitative" score={catScore(quantQs)} icon="📊" />
          <CategoryCard label="Logical" score={catScore(logicalQs)} icon="🧩" />
          <CategoryCard label="Verbal" score={catScore(verbalQs)} icon="📝" />
        </div>

        <div className="flex gap-2 text-sm text-gray-400 mb-4">
          <span>Time: {minutes}m {seconds}s</span>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Question Review</h2>
          {results.map((r: any, idx: number) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-gray-800/50 rounded-xl border ${
                r.isCorrect ? "border-emerald-500/30" : r.selected === undefined ? "border-gray-700" : "border-red-500/30"
              } overflow-hidden`}
            >
              <button
                onClick={() => setExpanded(expanded === idx ? null : idx)}
                className="w-full text-left p-4 flex items-start gap-3"
              >
                <span className={`mt-0.5 text-lg ${r.isCorrect ? "text-emerald-400" : "text-red-400"}`}>
                  {r.isCorrect ? "✓" : r.selected === undefined ? "○" : "✗"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium">{r.question}</p>
                  <p className="text-[10px] text-gray-500 mt-1">Your answer: {r.selected !== undefined ? r.options[r.selected] : "Not answered"}</p>
                </div>
                <span className="text-gray-500 text-xs">{expanded === idx ? "▲" : "▼"}</span>
              </button>
              {expanded === idx && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-700/50 ml-9">
                  <p className="text-xs text-emerald-400 mb-1">
                    Correct: {r.options[r.correct]}
                  </p>
                  <p className="text-xs text-gray-400">{r.explanation}</p>
                </div>
              )}
            </motion.div>
          ))}
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

function CategoryCard({ label, score, icon }: { label: string; score: number; icon: string }) {
  const color = score >= 70 ? "bg-emerald-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="bg-gray-800/50 rounded-2xl p-5 border border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-medium text-white">{label}</span>
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
