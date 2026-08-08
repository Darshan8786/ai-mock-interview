import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getAptitudeProgress } from "../services/profileApi";
import type { AptitudeProgress as ProgressData } from "../services/profileApi";

export function AptitudeProgress() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getAptitudeProgress()
      .then((data) => {
        if (cancelled) return;
        setProgress(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load progress. Make sure the backend is running and you are logged in.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 py-10 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">📈 My Aptitude Progress</h1>
            <p className="text-gray-400 text-sm mt-1">Your no-repeat bank walkthrough, at a glance.</p>
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

        {progress && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Questions Answered", value: progress.totalAnswered, accent: "text-emerald-400" },
                { label: "Tests Completed", value: progress.completedTests, accent: "text-fuchsia-400" },
              ].map((s) => (
                <div key={s.label} className="bg-gray-800/50 rounded-2xl border border-gray-700 p-5 text-center">
                  <p className={`text-3xl font-bold ${s.accent}`}>{s.value}</p>
                  <p className="text-[11px] text-gray-400 mt-1 uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6 mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">Overall Accuracy</span>
                <span className="text-lg font-bold text-emerald-400">{progress.accuracy}%</span>
              </div>
              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.accuracy}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {progress.totalCorrect} correct · {progress.totalIncorrect} incorrect out of {progress.totalAnswered} answered
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6">
                <h2 className="text-sm font-medium text-white mb-3">Weak Topics</h2>
                {progress.weakTopics.length === 0 ? (
                  <p className="text-xs text-gray-500">No weak topics yet — keep going!</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {progress.weakTopics.map((t) => (
                      <span key={t} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6">
                <h2 className="text-sm font-medium text-white mb-3">Strong Topics</h2>
                {progress.strongTopics.length === 0 ? (
                  <p className="text-xs text-gray-500">Nothing strong yet — answer more to identify them.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {progress.strongTopics.map((t) => (
                      <span key={t} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6">
              <h2 className="text-sm font-medium text-white mb-4">Topic-wise Accuracy</h2>
              {progress.topicWise.length === 0 ? (
                <p className="text-xs text-gray-500">Answer a few questions to populate this chart.</p>
              ) : (
                <div className="space-y-4">
                  {progress.topicWise.map((t) => (
                    <div key={t.topic}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-300">{t.topic}</span>
                        <span className={`text-xs font-medium ${t.weak ? "text-red-400" : "text-emerald-400"}`}>
                          {t.correct}/{t.answered} · {t.accuracy}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${t.weak ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{ width: `${t.accuracy}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
