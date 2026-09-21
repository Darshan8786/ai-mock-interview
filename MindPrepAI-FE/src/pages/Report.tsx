import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Chatbot } from "../components/Chatbot";
import {
  errorMessage,
  getMyAnalytics,
  type AreaStat,
  type StudentAnalytics,
  type TrendPoint,
} from "../services/analyticsApi";

const COLORS = { aptitude: "#7C3AED", tech: "#06B6D4", interview: "#F59E0B" };

const card = "rounded-2xl border-2 border-white bg-slate-900 p-5 text-white shadow-lg";

const barColor = (pct: number) => (pct < 60 ? "#EF4444" : pct < 75 ? "#F59E0B" : "#10B981");

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={card}>
      <p className="text-sm text-white/70">{label}</p>
      <h3 className="mt-2 text-4xl font-bold">{value}</h3>
      <p className="mt-1 text-sm text-white/60">{hint}</p>
    </div>
  );
}

function AreaBars({ areas, empty }: { areas: AreaStat[]; empty: string }) {
  if (!areas.length) return <p className="text-sm text-white/50">{empty}</p>;
  return (
    <ul className="space-y-3">
      {areas.map((a) => (
        <li key={`${a.source}-${a.group}-${a.name}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">
              {a.name}
              <span className="ml-2 text-xs text-white/40">{a.source === "tech" ? `${a.group} quiz` : a.group}</span>
            </span>
            <span className="shrink-0 font-semibold" style={{ color: barColor(a.accuracy) }}>
              {a.accuracy}%
              <span className="ml-1 text-xs font-normal text-white/40">
                ({a.correct}/{a.total})
              </span>
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10">
            <div className="h-full rounded-full transition-all" style={{ width: `${a.accuracy}%`, backgroundColor: barColor(a.accuracy) }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Merge the three per-module trends into one date-ordered series for a single chart. */
function mergeTrends(d: StudentAnalytics) {
  const rows = new Map<string, { date: string; aptitude?: number; tech?: number; interview?: number }>();
  const add = (points: TrendPoint[], key: "aptitude" | "tech" | "interview") =>
    points.forEach((p, i) => {
      // Two results on the same day must stay separate points, so key on the exact timestamp.
      const k = `${p.date}#${key}#${i}`;
      rows.set(k, { date: p.date, [key]: p.score });
    });
  add(d.aptitude.trend, "aptitude");
  add(d.techQuiz.trend, "tech");
  add(d.interview.trend, "interview");
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export function Report() {
  const [data, setData] = useState<StudentAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getMyAnalytics());
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setError(errorMessage(err, "Couldn't load your analytics."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const trend = useMemo(() => (data ? mergeTrends(data) : []), [data]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white">
        <div className="animate-pulse text-2xl font-semibold">Building your report...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-3 text-white">
          <p className="text-center text-sm uppercase tracking-[0.35em] text-indigo-300/80">Personalized Insights</p>
          <h1 className="text-center text-4xl font-bold leading-tight sm:text-5xl">Your Performance Dashboard</h1>
        </div>

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-red-400/60 bg-red-500/10 p-5 text-red-100">
            <p className="text-sm">{error}</p>
            <button onClick={load} className="rounded-lg bg-red-500/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500">
              Try again
            </button>
          </div>
        )}

        {data && !data.hasData && (
          <div className={`${card} text-center`}>
            <h2 className="text-xl font-bold">No results yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-white/70">
              Complete an aptitude test, a tech quiz or a mock interview and your scores, trends and weak areas will appear here.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3 text-sm">
              <Link to="/aptitude" className="rounded-lg bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-700">Aptitude</Link>
              <Link to="/tech-practice" className="rounded-lg bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-700">Tech Practice</Link>
              <Link to="/mock-interview/setup" className="rounded-lg bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-700">Mock Interview</Link>
            </div>
          </div>
        )}

        {data && data.hasData && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Readiness"
                value={data.overview.readiness !== null ? `${data.overview.readiness}%` : "—"}
                hint="Average of the areas you've practised"
              />
              <StatCard
                label="Aptitude tests"
                value={String(data.overview.aptitudeTests)}
                hint={data.aptitude.attempts ? `Avg ${data.aptitude.avgScore}% · best ${data.aptitude.bestScore}%` : "None completed yet"}
              />
              <StatCard
                label="Tech quizzes"
                value={String(data.overview.techQuizzes)}
                hint={data.techQuiz.attempts ? `Avg ${data.techQuiz.avgScore}% · best ${data.techQuiz.bestScore}%` : "None completed yet"}
              />
              <StatCard
                label="Mock interviews"
                value={String(data.overview.interviews)}
                hint={
                  data.interview.attempts
                    ? `Avg ${data.interview.avgOverall}%${data.interview.terminated ? ` · ${data.interview.terminated} ended early` : ""}`
                    : "None completed yet"
                }
              />
            </div>

            {trend.length > 1 && (
              <section className={card}>
                <p className="text-sm text-white/60">Progress over time</p>
                <h2 className="mb-4 text-2xl font-bold">Score Trend</h2>
                <div className="h-72 w-full">
                  <ResponsiveContainer>
                    <LineChart data={trend} margin={{ top: 5, right: 16, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="date" tickFormatter={shortDate} stroke="rgba(255,255,255,0.5)" fontSize={12} />
                      <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.5)" fontSize={12} />
                      <Tooltip
                        labelFormatter={(v) => new Date(v as string).toLocaleString()}
                        contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8 }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="aptitude" name="Aptitude" stroke={COLORS.aptitude} strokeWidth={2} connectNulls dot />
                      <Line type="monotone" dataKey="tech" name="Tech quiz" stroke={COLORS.tech} strokeWidth={2} connectNulls dot />
                      <Line type="monotone" dataKey="interview" name="Interview" stroke={COLORS.interview} strokeWidth={2} connectNulls dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <section className={card}>
                <p className="text-sm text-white/60">Needs attention</p>
                <h2 className="mb-4 text-2xl font-bold">Weak Areas</h2>
                <AreaBars
                  areas={data.weakAreas}
                  empty="Nothing below 60% with enough answers yet — or not enough questions answered per topic to judge."
                />
              </section>
              <section className={card}>
                <p className="text-sm text-white/60">Going well</p>
                <h2 className="mb-4 text-2xl font-bold">Strengths</h2>
                <AreaBars areas={data.strengths} empty="No topic at 75%+ with enough answers yet. Keep practising." />
              </section>
            </div>

            {data.aptitude.categories.length > 0 && (
              <section className={card}>
                <p className="text-sm text-white/60">Aptitude</p>
                <h2 className="mb-4 text-2xl font-bold">Accuracy by Category</h2>
                <AreaBars areas={data.aptitude.categories} empty="" />
              </section>
            )}

            {data.techQuiz.attempts > 0 && (
              <section className={card}>
                <p className="text-sm text-white/60">Tech Practice</p>
                <h2 className="mb-4 text-2xl font-bold">By Technology</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.techQuiz.technologies.map((t) => (
                    <div key={t.technology} className="rounded-xl border border-white/20 bg-slate-800 p-4">
                      <h3 className="font-semibold" style={{ color: COLORS.tech }}>{t.technology}</h3>
                      <p className="mt-1 text-sm text-white/70">
                        {t.attempts} quiz{t.attempts === 1 ? "" : "zes"} · avg {t.avgScore}% · best {t.bestScore}%
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {data.interview.attempts > 0 && (
              <section className={card}>
                <p className="text-sm text-white/60">Mock interviews</p>
                <h2 className="mb-4 text-2xl font-bold">Interview Skills</h2>
                <ul className="space-y-3">
                  {data.interview.skills.map((s) => (
                    <li key={s.key}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{s.label}</span>
                        <span className="font-semibold" style={{ color: barColor(s.score) }}>{s.score}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-white/10">
                        <div className="h-full rounded-full" style={{ width: `${s.score}%`, backgroundColor: barColor(s.score) }} />
                      </div>
                    </li>
                  ))}
                </ul>
                {data.interview.improvementAreas.length > 0 && (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <p className="mb-2 text-sm font-semibold text-white/80">Feedback that keeps coming up</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-white/70">
                      {data.interview.improvementAreas.map((i) => (
                        <li key={i.text}>
                          {i.text} <span className="text-white/40">×{i.count}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}
          </>
        )}

        <Chatbot />
      </div>
    </div>
  );
}
