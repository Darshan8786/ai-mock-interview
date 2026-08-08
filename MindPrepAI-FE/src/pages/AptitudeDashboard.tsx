import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  getAptitudeTests,
  getAptitudeTopics,
  getAptitudeProgress,
  startAptitudeTest,
} from "../services/profileApi";
import type {
  AptitudeTestSummary,
  TopicInfo,
  AptitudeProgress,
} from "../services/profileApi";

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  Quantitative: { icon: "📊", color: "from-blue-500/20 to-blue-600/5 border-blue-500/30" },
  "Logical Reasoning": { icon: "🧩", color: "from-violet-500/20 to-violet-600/5 border-violet-500/30" },
  "Verbal Ability": { icon: "📝", color: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30" },
  "Data Interpretation": { icon: "📈", color: "from-amber-500/20 to-amber-600/5 border-amber-500/30" },
};

const QUICK_MODES = [
  {
    mode: "daily",
    title: "Daily Aptitude",
    desc: "Balanced mix of all 4 sections — a quick daily warm-up.",
    icon: "📅",
    accent: "from-sky-500/20 to-sky-600/5 border-sky-500/30",
  },
  {
    mode: "mixed",
    title: "Mixed Test",
    desc: "Custom-weighted sections in a single timed test.",
    icon: "🎯",
    accent: "from-fuchsia-500/20 to-fuchsia-600/5 border-fuchsia-500/30",
  },
  {
    mode: "company",
    title: "Company Practice",
    desc: "Practice tagged TCS / Infosys / Wipro / Accenture style questions.",
    icon: "🏢",
    accent: "from-cyan-500/20 to-cyan-600/5 border-cyan-500/30",
  },
  {
    mode: "difficulty",
    title: "By Difficulty",
    desc: "Focus only on beginner, intermediate or advanced questions.",
    icon: "🏋️",
    accent: "from-rose-500/20 to-rose-600/5 border-rose-500/30",
  },
];

const DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const COMPANIES = ["TCS", "Infosys", "Wipro", "Accenture"];

export function AptitudeDashboard() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<AptitudeTestSummary[]>([]);
  const [topics, setTopics] = useState<Record<string, TopicInfo[]>>({});
  const [progress, setProgress] = useState<AptitudeProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [category, setCategory] = useState("Quantitative");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [count, setCount] = useState(10);

  const [quickMode, setQuickMode] = useState("daily");
  const [quickCompany, setQuickCompany] = useState("TCS");
  const [quickDifficulty, setQuickDifficulty] = useState("beginner");
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAptitudeTests(), getAptitudeTopics(), getAptitudeProgress()])
      .then(([t, topicsData, prog]) => {
        if (cancelled) return;
        setTests(t);
        setTopics(topicsData);
        setProgress(prog);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Could not load aptitude data. Make sure you are logged in and the backend is running.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryTopics = topics[category] || [];

  const startPractice = () => {
    const params = new URLSearchParams({ category });
    if (topic) params.set("topic", topic);
    if (difficulty) params.set("difficulty", difficulty);
    params.set("count", String(count));
    navigate(`/aptitude/practice?${params.toString()}`);
  };

  const startQuickMode = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const payload: Record<string, any> = { mode: quickMode, count: 10 };
      if (quickMode === "company") payload.tag = quickCompany;
      if (quickMode === "difficulty") payload.difficulty = quickDifficulty;
      const attempt = await startAptitudeTest(payload);
      navigate(`/aptitude/session/${attempt.attemptId}`, { state: { attempt } });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not start the test. Try again.");
      setStarting(false);
    }
  };

  const startTest = async (testId: string) => {
    if (starting) return;
    setStarting(true);
    try {
      const attempt = await startAptitudeTest({ testId });
      navigate(`/aptitude/session/${attempt.attemptId}`, { state: { attempt } });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Could not start the test. Try again.");
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 py-10 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white">Aptitude Preparation</h1>
          <p className="text-gray-400 mt-2">
            Pick a full mock test, a practice topic, or a quick-mode session. Questions never repeat until you finish the bank.
          </p>
          <div className="flex justify-center gap-3 mt-4">
            <button
              onClick={() => navigate("/aptitude/progress")}
              className="px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-sm font-medium hover:bg-emerald-500/25 transition-all"
            >
              📈 My Progress
            </button>
            <button
              onClick={() => navigate("/aptitude/history")}
              className="px-4 py-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 text-sm font-medium hover:bg-blue-500/25 transition-all"
            >
              🕘 Test History
            </button>
          </div>
        </div>

        {error && (
          <div className="max-w-lg mx-auto mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && !error && (
          <>
            {progress && (
              <section className="mb-12">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Overall Accuracy", value: `${progress.accuracy}%`, accent: "text-emerald-400" },
                    { label: "Tests Completed", value: String(progress.completedTests), accent: "text-fuchsia-400" },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-800/50 rounded-2xl border border-gray-700 p-4 text-center">
                      <p className={`text-2xl font-bold ${s.accent}`}>{s.value}</p>
                      <p className="text-[11px] text-gray-400 mt-1 uppercase tracking-wide">{s.label}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Quick modes */}
            <section className="mb-12">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>⚡</span> Quick Modes
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {QUICK_MODES.map((m) => (
                  <button
                    key={m.mode}
                    onClick={() => {
                      setQuickMode(m.mode);
                      startQuickMode();
                    }}
                    disabled={starting}
                    className={`text-left bg-gray-800/50 rounded-2xl border p-5 hover:-translate-y-1 transition-all ${m.accent} ${
                      starting ? "opacity-60" : ""
                    }`}
                  >
                    <div className="text-2xl mb-2">{m.icon}</div>
                    <h3 className="font-semibold text-white text-sm">{m.title}</h3>
                    <p className="text-xs text-gray-400 mt-1">{m.desc}</p>
                    {m.mode === "company" && (
                      <select
                        value={quickCompany}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setQuickCompany(e.target.value)}
                        className="mt-3 w-full px-2 py-1.5 rounded-lg bg-gray-700/60 text-gray-200 border border-gray-600 text-xs focus:outline-none"
                      >
                        {COMPANIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    )}
                    {m.mode === "difficulty" && (
                      <select
                        value={quickDifficulty}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setQuickDifficulty(e.target.value)}
                        className="mt-3 w-full px-2 py-1.5 rounded-lg bg-gray-700/60 text-gray-200 border border-gray-600 text-xs focus:outline-none"
                      >
                        {DIFFICULTIES.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    )}
                  </button>
                ))}
              </div>
            </section>

            {/* Full mock tests */}
            <section className="mb-12">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>🏁</span> Full Mock Tests
              </h2>
              {tests.length === 0 ? (
                <p className="text-sm text-gray-500">No tests configured yet. Ask an admin to publish one.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tests.map((t) => (
                    <motion.button
                      key={t.id}
                      whileHover={{ y: -4 }}
                      onClick={() => startTest(t.id)}
                      disabled={starting}
                      className={`text-left bg-gray-800/50 rounded-2xl border border-gray-700 p-5 hover:border-emerald-500/40 transition-all ${
                        starting ? "opacity-60" : ""
                      }`}
                    >
                      <h3 className="font-semibold text-white">{t.title}</h3>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{t.description}</p>
                      <div className="flex flex-wrap gap-2 mt-4 text-[11px]">
                        <span className="px-2 py-1 rounded-lg bg-gray-700/60 text-gray-300">
                          {t.questionCount} questions
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-gray-700/60 text-gray-300">
                          {t.durationMinutes} min
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-gray-700/60 text-gray-300">
                          +{t.marksPerQuestion} / −{t.negativeMarksPerQuestion}
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400">
                          Pass {t.passingScore}%
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </section>

            {/* Practice builder */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>🎯</span> Practice Mode
              </h2>
              <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Category</label>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(CATEGORY_META).map(([key, meta]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setCategory(key);
                            setTopic("");
                          }}
                          className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all text-left ${
                            category === key
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                              : "bg-gray-700/40 text-gray-300 border-gray-600 hover:border-gray-500"
                          }`}
                        >
                          <span className="mr-1.5">{meta.icon}</span>
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Topic</label>
                    <select
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-gray-700/50 text-gray-200 border border-gray-600 focus:outline-none focus:border-emerald-500/50"
                    >
                      <option value="">All topics</option>
                      {categoryTopics.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name} ({t.questionCount})
                        </option>
                      ))}
                    </select>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Difficulty</label>
                        <select
                          value={difficulty}
                          onChange={(e) => setDifficulty(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl bg-gray-700/50 text-gray-200 border border-gray-600 focus:outline-none focus:border-emerald-500/50"
                        >
                          <option value="">Mixed</option>
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Questions</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={count}
                          onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 10)))}
                          className="w-full px-3 py-2.5 rounded-xl bg-gray-700/50 text-gray-200 border border-gray-600 focus:outline-none focus:border-emerald-500/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={startPractice}
                  className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
                >
                  Start Practice ({count} questions)
                </button>
              </div>
            </section>
          </>
        )}
      </motion.div>
    </div>
  );
}
