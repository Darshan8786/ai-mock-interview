import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  getAptitudeTests,
  getAptitudeTopics,
  getAptitudeCompanies,
  getAptitudeProgress,
  startAptitudeTest,
} from "../services/profileApi";
import type {
  AptitudeTestSummary,
  TopicInfo,
  CompanyInfo,
  AptitudeProgress,
} from "../services/profileApi";

const CATEGORY_META: Record<string, { icon: string }> = {
  Quantitative: { icon: "📊" },
  "Logical Reasoning": { icon: "🧩" },
  "Verbal Ability": { icon: "📝" },
  "Data Interpretation": { icon: "📈" },
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
];

const DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const COUNT_CHOICES = [5, 10, 15, 20];

type Section = "topic" | "company";

export function AptitudeDashboard() {
  const navigate = useNavigate();
  const [tests, setTests] = useState<AptitudeTestSummary[]>([]);
  const [topics, setTopics] = useState<Record<string, TopicInfo[]>>({});
  const [companies, setCompanies] = useState<CompanyInfo[]>([]);
  const [progress, setProgress] = useState<AptitudeProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [startError, setStartError] = useState("");
  const [starting, setStarting] = useState(false);

  const [section, setSection] = useState<Section>("topic");
  const [category, setCategory] = useState("Quantitative");
  const [topic, setTopic] = useState(""); // "" = every topic in the category
  const [company, setCompany] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [count, setCount] = useState(10);
  const [quickDifficulty, setQuickDifficulty] = useState("beginner");

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAptitudeTests(), getAptitudeTopics(), getAptitudeCompanies(), getAptitudeProgress()])
      .then(([t, topicsData, companyList, prog]) => {
        if (cancelled) return;
        setTests(t);
        setTopics(topicsData);
        setCompanies(companyList);
        if (companyList.length > 0) setCompany(companyList[0].name);
        setProgress(prog);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Could not load aptitude data. Make sure you are logged in and the backend is running.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryTopics = topics[category] || [];
  const categoryTotal = categoryTopics.reduce((sum, t) => sum + t.questionCount, 0);
  const selectedTopic = categoryTopics.find((t) => t.name === topic);
  const selectedCompany = companies.find((c) => c.name === company);

  // How many questions the current selection can actually supply, so the count
  // choices never offer more than exist.
  const pool = section === "topic" ? (selectedTopic ? selectedTopic.questionCount : categoryTotal) : selectedCompany?.questionCount || 0;
  const countChoices = pool >= COUNT_CHOICES[0] ? COUNT_CHOICES.filter((n) => n <= pool) : pool > 0 ? [pool] : [];
  // The count actually shown and started: the chosen one, or the largest choice
  // that still fits when the selection changed to a smaller pool.
  const effectiveCount = countChoices.includes(count) ? count : countChoices[countChoices.length - 1] ?? 0;

  const startSession = async (payload: Record<string, any>) => {
    if (starting) return;
    setStarting(true);
    setStartError("");
    try {
      const attempt = await startAptitudeTest(payload);
      navigate(`/aptitude/session/${attempt.attemptId}`, { state: { attempt } });
    } catch (err: any) {
      setStartError(err?.response?.data?.message || "Could not start the test. Try again.");
      setStarting(false);
    }
  };

  const startTopicWise = () => {
    const payload: Record<string, any> = { mode: "practice", category, count: effectiveCount };
    if (topic) payload.topic = topic;
    if (difficulty) payload.difficulty = difficulty;
    startSession(payload);
  };

  const startCompanyWise = () => startSession({ mode: "company", tag: company, count: effectiveCount });

  const startQuickMode = (mode: string) => {
    const payload: Record<string, any> = { mode, count: 10 };
    if (mode === "difficulty") payload.difficulty = quickDifficulty;
    startSession(payload);
  };

  const startTest = (testId: string) => startSession({ testId });

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 py-10 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white">Aptitude Preparation</h1>
          <p className="text-gray-400 mt-2">
            Practice topic by topic or company by company. After each attempt you get your score, the correct answers and
            the logic behind them.
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

        {loadError && (
          <div className="max-w-lg mx-auto mb-8 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
            {loadError}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && !loadError && (
          <>
            {progress && (
              <section className="mb-10">
                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
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

            {startError && (
              <div className="max-w-lg mx-auto mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
                {startError}
              </div>
            )}

            {/* Topic-wise / Company-wise */}
            <section className="mb-12">
              <div className="grid grid-cols-2 gap-3 mb-5">
                {(
                  [
                    { key: "topic", label: "Topic-wise", icon: "📚", desc: "Practice one topic at a time" },
                    { key: "company", label: "Company-wise", icon: "🏢", desc: "Questions asked by companies" },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSection(s.key)}
                    className={`text-left rounded-2xl border p-4 transition-all ${
                      section === s.key
                        ? "bg-emerald-500/15 border-emerald-500/50"
                        : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                    }`}
                  >
                    <span className="text-2xl">{s.icon}</span>
                    <p className={`font-semibold mt-1 ${section === s.key ? "text-emerald-400" : "text-white"}`}>{s.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                  </button>
                ))}
              </div>

              <div className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6">
                {section === "topic" && (
                  <>
                    <div className="flex flex-wrap gap-2 mb-5">
                      {Object.entries(CATEGORY_META).map(([key, meta]) => (
                        <button
                          key={key}
                          onClick={() => {
                            setCategory(key);
                            setTopic("");
                          }}
                          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
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

                    {categoryTopics.length === 0 ? (
                      <p className="text-sm text-gray-500">No topics are available in this category yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        <TopicCard
                          label={`All ${category}`}
                          sub={`${categoryTotal} questions`}
                          active={topic === ""}
                          onClick={() => setTopic("")}
                        />
                        {categoryTopics.map((t) => (
                          <TopicCard
                            key={t.id}
                            label={t.name}
                            sub={`${t.questionCount} questions`}
                            active={topic === t.name}
                            disabled={t.questionCount === 0}
                            onClick={() => setTopic(t.name)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {section === "company" && (
                  <>
                    {companies.length === 0 ? (
                      <p className="text-sm text-gray-500">No company-tagged questions are available yet.</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {companies.map((c) => (
                          <TopicCard
                            key={c.name}
                            label={c.name}
                            sub={`${c.questionCount} questions`}
                            active={company === c.name}
                            onClick={() => setCompany(c.name)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div className="flex flex-wrap items-end gap-4 mt-6">
                  {section === "topic" && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Difficulty</label>
                      <select
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value)}
                        className="px-3 py-2.5 rounded-xl bg-gray-700/50 text-gray-200 border border-gray-600 focus:outline-none focus:border-emerald-500/50"
                      >
                        <option value="">Mixed</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wide">Questions</label>
                    <select
                      value={effectiveCount}
                      onChange={(e) => setCount(Number(e.target.value))}
                      disabled={countChoices.length === 0}
                      className="px-3 py-2.5 rounded-xl bg-gray-700/50 text-gray-200 border border-gray-600 focus:outline-none focus:border-emerald-500/50 disabled:opacity-50"
                    >
                      {countChoices.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={section === "topic" ? startTopicWise : startCompanyWise}
                    disabled={starting || pool === 0 || (section === "company" && !company)}
                    className="flex-1 min-w-[220px] py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50"
                  >
                    {starting
                      ? "Preparing questions…"
                      : section === "topic"
                      ? `Start ${topic || category} Practice`
                      : `Start ${company || "Company"} Practice`}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  {section === "company"
                    ? "Marks: +1 per correct answer, −0.25 per wrong answer."
                    : "Marks: +1 per correct answer, no negative marking."}
                </p>
              </div>
            </section>

            {/* Other ways to practice */}
            <section className="mb-12">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span>⚡</span> More Ways to Practice
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {QUICK_MODES.map((m) => (
                  <button
                    key={m.mode}
                    onClick={() => startQuickMode(m.mode)}
                    disabled={starting}
                    className={`text-left bg-gray-800/50 rounded-2xl border p-5 hover:-translate-y-1 transition-all ${m.accent} ${
                      starting ? "opacity-60" : ""
                    }`}
                  >
                    <div className="text-2xl mb-2">{m.icon}</div>
                    <h3 className="font-semibold text-white text-sm">{m.title}</h3>
                    <p className="text-xs text-gray-400 mt-1">{m.desc}</p>
                  </button>
                ))}

                <div className="bg-gray-800/50 rounded-2xl border p-5 from-rose-500/20 to-rose-600/5 border-rose-500/30">
                  <div className="text-2xl mb-2">🏋️</div>
                  <h3 className="font-semibold text-white text-sm">By Difficulty</h3>
                  <p className="text-xs text-gray-400 mt-1">Focus only on beginner, intermediate or advanced questions.</p>
                  <div className="flex gap-2 mt-3">
                    <select
                      value={quickDifficulty}
                      onChange={(e) => setQuickDifficulty(e.target.value)}
                      className="flex-1 px-2 py-1.5 rounded-lg bg-gray-700/60 text-gray-200 border border-gray-600 text-xs focus:outline-none"
                    >
                      {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => startQuickMode("difficulty")}
                      disabled={starting}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium hover:bg-rose-500/30 disabled:opacity-60"
                    >
                      Start
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Full mock tests */}
            <section>
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
          </>
        )}
      </motion.div>
    </div>
  );
}

function TopicCard({
  label,
  sub,
  active,
  disabled,
  onClick,
}: {
  label: string;
  sub: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-left rounded-xl border px-4 py-3 transition-all disabled:opacity-40 ${
        active
          ? "bg-emerald-500/20 border-emerald-500/50"
          : "bg-gray-700/40 border-gray-600 hover:border-gray-500"
      }`}
    >
      <p className={`text-sm font-medium ${active ? "text-emerald-400" : "text-gray-200"}`}>{label}</p>
      <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>
    </button>
  );
}
