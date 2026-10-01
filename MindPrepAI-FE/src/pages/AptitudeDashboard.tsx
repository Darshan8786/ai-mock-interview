import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { AdaptiveAptitudeCard } from "../components/adaptive/AdaptiveSetupCards";
import { ModuleHero, Panel, Segmented } from "../components/module/ModuleKit";
import { labelCls, selectCls } from "../components/module/styles";
import { FloatingCard } from "../components/3d/FloatingCard";

const CATEGORY_META: Record<string, { icon: string }> = {
  Quantitative: { icon: "∑" },
  "Logical Reasoning": { icon: "⊢" },
  "Verbal Ability": { icon: "Aa" },
  "Data Interpretation": { icon: "▤" },
};

const QUICK_MODES = [
  {
    mode: "daily",
    title: "Daily Aptitude",
    desc: "Balanced mix of all 4 sections — a quick daily warm-up.",
    icon: "⟳",
  },
  {
    mode: "mixed",
    title: "Mixed Test",
    desc: "Custom-weighted sections in a single timed test.",
    icon: "⧉",
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
  // Company-wise practice is one mixed set; company names are never shown.
  // (A question tagged with several companies is counted once per tag, so this
  // can overstate the pool slightly - the backend then serves what exists.)
  const companyPool = companies.reduce((sum, c) => sum + c.questionCount, 0);

  // How many questions the current selection can actually supply, so the count
  // choices never offer more than exist.
  const pool = section === "topic" ? (selectedTopic ? selectedTopic.questionCount : categoryTotal) : companyPool;
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

  const startCompanyWise = () => startSession({ mode: "company", count: effectiveCount });

  const startQuickMode = (mode: string) => {
    const payload: Record<string, any> = { mode, count: 10 };
    if (mode === "difficulty") payload.difficulty = quickDifficulty;
    startSession(payload);
  };

  const startTest = (testId: string) => startSession({ testId });

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <ModuleHero
        kind="aptitude"
        kicker="// practice/aptitude"
        title="Aptitude"
        description="Practise quant, logical, verbal and data interpretation by category, by company, or in an adaptive session that tunes itself to you. Every attempt shows the correct answers and the logic behind them."
        stats={[
          { label: "accuracy", value: progress ? `${progress.accuracy}%` : "—" },
          { label: "tests done", value: progress ? progress.completedTests : "—" },
          { label: "categories", value: Object.keys(CATEGORY_META).length },
        ]}
        actions={
          <>
            <button onClick={() => navigate("/aptitude/progress")} className="px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors">
              My progress
            </button>
            <button onClick={() => navigate("/aptitude/history")} className="px-4 py-2.5 rounded-lg border border-line-strong bg-surface text-fg-2 hover:text-fg hover:bg-surface-2 text-sm font-medium transition-colors">
              Test history
            </button>
          </>
        }
      />

      {loadError && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-sm">{loadError}</div>
      )}

      {loading && (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-accent border-t-transparent rounded-full" />
        </div>
      )}

      {!loading && !loadError && (
        <>
          {startError && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-sm">{startError}</div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Panel
                kicker="// adaptive.session()"
                title="AI adaptive practice"
                description="One question at a time, generated and answer-checked on this machine. Difficulty follows your answers and your weak topics get extra attention."
              >
                <AdaptiveAptitudeCard />
              </Panel>

              <Panel kicker="// practice.set()" title="Category & company practice" description="A fixed set of questions, scored at the end.">
                <Segmented
                  value={section}
                  onChange={setSection}
                  options={[
                    { value: "topic", label: "Category-wise", hint: "One category, mixed topics" },
                    { value: "company", label: "Company-wise", hint: "Questions asked in placement tests" },
                  ]}
                />

                <div className="mt-5">
                  {section === "topic" && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {Object.entries(CATEGORY_META).map(([key, meta]) => {
                          const active = category === key;
                          return (
                            <button
                              key={key}
                              onClick={() => {
                                setCategory(key);
                                setTopic("");
                              }}
                              aria-pressed={active}
                              className={`text-left rounded-xl border p-3.5 transition-colors ${
                                active ? "bg-accent-soft border-accent/40" : "bg-surface border-line-strong hover:border-accent/40"
                              }`}
                            >
                              <span className={`font-mono text-lg ${active ? "text-accent-fg" : "text-subtle"}`}>{meta.icon}</span>
                              <p className={`mt-1 text-sm font-semibold ${active ? "text-accent-fg" : "text-fg"}`}>{key}</p>
                            </button>
                          );
                        })}
                      </div>
                      {categoryTopics.length === 0 && <p className="text-sm text-subtle mt-3">No questions are available in this category yet.</p>}
                    </>
                  )}

                  {section === "company" &&
                    (companies.length === 0 ? (
                      <p className="text-sm text-subtle">No company questions are available yet.</p>
                    ) : (
                      <div className="rounded-xl border border-line bg-surface-2/60 p-4 flex items-start gap-3">
                        <span className="w-10 h-10 shrink-0 rounded-lg bg-accent-soft text-accent-fg font-mono text-sm font-semibold flex items-center justify-center">{"{?}"}</span>
                        <p className="text-sm text-fg-2">
                          A mixed set of questions that have appeared in real company placement tests. Companies aren&apos;t named, so
                          you practise the question, not the brand.
                        </p>
                      </div>
                    ))}
                </div>

                <div className="flex flex-wrap items-end gap-4 mt-6">
                  {section === "topic" && (
                    <div className="w-40">
                      <label className={labelCls}>difficulty</label>
                      <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={selectCls}>
                        <option value="">Mixed</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                      </select>
                    </div>
                  )}
                  <div className="w-28">
                    <label className={labelCls}>questions</label>
                    <select
                      value={effectiveCount}
                      onChange={(e) => setCount(Number(e.target.value))}
                      disabled={countChoices.length === 0}
                      className={`${selectCls} disabled:opacity-50`}
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
                    disabled={starting || pool === 0}
                    className="flex-1 min-w-[220px] py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold transition-colors disabled:opacity-50"
                  >
                    {starting
                      ? "Preparing questions…"
                      : section === "topic"
                      ? `Start ${topic || category} practice →`
                      : "Start company practice →"}
                  </button>
                </div>
                <p className="font-mono text-[11px] text-subtle mt-3">
                  {section === "company" ? "// marks: +1 correct, −0.25 wrong" : "// marks: +1 correct, no negative marking"}
                </p>
              </Panel>
            </div>

            <div className="space-y-6">
              <Panel kicker="// quick.start()" title="Quick start" description="10 questions, one click.">
                <div className="space-y-3">
                  {QUICK_MODES.map((m) => (
                    <FloatingCard key={m.mode} intensity={5}>
                      <button
                        onClick={() => startQuickMode(m.mode)}
                        disabled={starting}
                        className="w-full text-left flex items-start gap-3 rounded-xl border border-line bg-surface-2/60 hover:border-accent/40 p-4 transition-colors disabled:opacity-60"
                      >
                        <span className="w-10 h-10 shrink-0 rounded-lg bg-accent-soft text-accent-fg font-mono text-lg flex items-center justify-center">{m.icon}</span>
                        <span>
                          <span className="block text-sm font-semibold text-fg">{m.title}</span>
                          <span className="block text-xs text-muted mt-0.5">{m.desc}</span>
                        </span>
                      </button>
                    </FloatingCard>
                  ))}
                  <FloatingCard intensity={5}>
                    <div className="rounded-xl border border-line bg-surface-2/60 p-4">
                      <div className="flex items-start gap-3">
                        <span className="w-10 h-10 shrink-0 rounded-lg bg-accent-soft text-accent-fg font-mono text-lg flex items-center justify-center">▲</span>
                        <span>
                          <span className="block text-sm font-semibold text-fg">By difficulty</span>
                          <span className="block text-xs text-muted mt-0.5">Only beginner, intermediate or advanced questions.</span>
                        </span>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <select value={quickDifficulty} onChange={(e) => setQuickDifficulty(e.target.value)} className={`${selectCls} !py-2 capitalize`}>
                          {DIFFICULTIES.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => startQuickMode("difficulty")}
                          disabled={starting}
                          className="px-4 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold disabled:opacity-60"
                        >
                          Start
                        </button>
                      </div>
                    </div>
                  </FloatingCard>
                </div>
              </Panel>
            </div>
          </div>

          <Panel className="mt-6" kicker="// mock.tests[]" title="Full mock tests" description="Timed papers published by your placement cell.">
            {tests.length === 0 ? (
              <p className="text-sm text-subtle">No tests configured yet. Ask an admin to publish one.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tests.map((t) => (
                  <FloatingCard key={t.id} intensity={6}>
                    <button
                      onClick={() => startTest(t.id)}
                      disabled={starting}
                      className="w-full h-full text-left rounded-xl border border-line bg-surface-2/60 hover:border-accent/40 p-5 transition-colors disabled:opacity-60"
                    >
                      <h3 className="font-semibold text-fg">{t.title}</h3>
                      <p className="text-xs text-muted mt-1 line-clamp-2">{t.description}</p>
                      <div className="flex flex-wrap gap-1.5 mt-4 font-mono text-[11px]">
                        <span className="px-2 py-1 rounded-md bg-surface border border-line text-fg-2">{t.questionCount} q</span>
                        <span className="px-2 py-1 rounded-md bg-surface border border-line text-fg-2">{t.durationMinutes} min</span>
                        <span className="px-2 py-1 rounded-md bg-surface border border-line text-fg-2">
                          +{t.marksPerQuestion}/−{t.negativeMarksPerQuestion}
                        </span>
                        <span className="px-2 py-1 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400">pass {t.passingScore}%</span>
                      </div>
                    </button>
                  </FloatingCard>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
