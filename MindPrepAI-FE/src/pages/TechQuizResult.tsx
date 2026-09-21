import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import type { TechQuizResultDTO } from "../services/techQuizApi";

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

export function TechQuizResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const result = (location.state as { result: TechQuizResultDTO | null } | null)?.result;

  if (!result) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-2">We could not compute your result.</p>
          <button
            onClick={() => navigate("/tech-practice")}
            className="mt-4 px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium"
          >
            Back to Technical Practice
          </button>
        </div>
      </div>
    );
  }

  const minutes = Math.floor(result.timeTaken / 60);
  const seconds = result.timeTaken % 60;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 py-8 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 mb-4"
          >
            <span className="text-4xl font-bold text-white">{result.score}</span>
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-1">{result.technology} Practice Complete</h1>
          <p className="text-gray-400">
            {result.correctAnswers}/{result.totalQuestions} correct · {result.difficulty} difficulty · {minutes}m {seconds}s
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatBox label="Total Questions" value={result.totalQuestions} color="gray" />
          <StatBox label="Correct" value={result.correctAnswers} color="emerald" />
          <StatBox label="Wrong" value={result.wrongAnswers} color="red" />
          <StatBox label="Score %" value={result.score} color={result.score >= 60 ? "emerald" : "red"} />
        </div>

        <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">Performance by Topic</h3>
          <div className="space-y-3">
            {result.topicScores.map((t) => (
              <div key={t.topic}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{t.topic}</span>
                  <span className={scoreColor(t.score)}>
                    {t.score}% ({t.correct}/{t.total})
                  </span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${t.score >= 70 ? "bg-emerald-500" : t.score >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${t.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Strong Topics</h3>
            {result.strengths.length > 0 ? (
              <div className="space-y-2">
                {result.strengths.map((s) => (
                  <div key={s} className="flex items-center gap-2 text-emerald-400 text-sm">
                    <span>✓</span> {s}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No topic cleared the strong threshold yet.</p>
            )}
          </div>
          <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Topics to Practice</h3>
            {result.weaknesses.length > 0 ? (
              <div className="space-y-2">
                {result.weaknesses.map((w) => (
                  <div key={w} className="flex items-center gap-2 text-amber-400 text-sm">
                    <span>△</span> {w}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No weak topics detected - nice work.</p>
            )}
          </div>
        </div>

        {result.recommendedNextDifficulty && (
          <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-4 mb-8 text-center text-sm text-gray-300">
            Based on this session, your recommended next difficulty for {result.technology} is{" "}
            <span className="text-emerald-400 font-semibold">{result.recommendedNextDifficulty}</span>.
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => navigate("/tech-practice")}
            className="flex-1 px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
          >
            Practice Again
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="flex-1 px-6 py-3 bg-gray-700/50 text-gray-300 rounded-xl font-medium border border-gray-600 hover:border-gray-500 transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: "gray" | "emerald" | "red" }) {
  const colorClass = color === "emerald" ? "text-emerald-400" : color === "red" ? "text-red-400" : "text-white";
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 text-center">
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}
