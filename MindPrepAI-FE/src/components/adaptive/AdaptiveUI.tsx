import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { Adaptation, AttemptComparison, Comparison, Level, Plan, Summary } from "../../services/adaptiveApi";

// Shared building blocks for the adaptive Aptitude and Tech Practice sessions (same look as the rest of the app).

const LEVEL_STYLE: Record<string, string> = {
  easy: "bg-line-strong text-fg",
  medium: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  hard: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export function DifficultyBadge({ level }: { level: string }) {
  const l = String(level || "").toLowerCase();
  return <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium capitalize ${LEVEL_STYLE[l] || LEVEL_STYLE.easy}`}>{l || "—"}</span>;
}

export function SourceBadge({ source }: { source: string }) {
  const label: Record<string, string> = {
    model: "AI-generated · verified",
    template: "Generated · verified",
    bank: "Verified bank",
    "bank-db": "Verified bank",
  };
  return <span className="px-2 py-0.5 rounded-md text-[11px] bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">{label[source] || source}</span>;
}

/** Elapsed seconds since `start` (ticks every second). */
export function useElapsed(start: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return start ? Math.max(0, Math.floor((now - start) / 1000)) : 0;
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

export function PlanCard({ plan, title = "Personalized for you" }: { plan: Plan | null | undefined; title?: string }) {
  if (!plan) return null;
  return (
    <div className="bg-surface rounded-xl border border-line p-4">
      <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">{title}</p>
      <p className="text-sm text-fg-2">{plan.message}</p>
      {plan.weakTopics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {plan.weakTopics.map((w) => (
            <span key={w.topic} className="text-[11px] px-2 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300">
              {w.topic} · {w.accuracy}%
            </span>
          ))}
        </div>
      )}
      {plan.strongTopics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {plan.strongTopics.map((s) => (
            <span key={s.topic} className="text-[11px] px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              ✓ {s.topic} · {s.accuracy}%
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function GeneratingCard({ failed, error, onRetry }: { failed?: boolean; error?: string; onRetry?: () => void }) {
  return (
    <div className="bg-surface rounded-2xl border border-line p-10 text-center">
      {failed ? (
        <>
          <p className="text-red-600 dark:text-red-400 text-sm mb-4">{error || "The next question could not be prepared."}</p>
          <button onClick={onRetry} className="px-5 py-2 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-sm font-medium">
            Try again
          </button>
        </>
      ) : (
        <>
          <div className="animate-spin w-9 h-9 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-fg-2 text-sm">Preparing your next question…</p>
          <p className="text-subtle text-xs mt-1">Generated and checked locally, adapted to your answers so far.</p>
        </>
      )}
    </div>
  );
}

export function AdaptationNote({ adaptation }: { adaptation: Adaptation | null | undefined }) {
  if (!adaptation || !adaptation.message) return null;
  const arrow = adaptation.direction === "up" ? "▲" : adaptation.direction === "down" ? "▼" : "●";
  const color = adaptation.direction === "up" ? "text-emerald-700 dark:text-emerald-400" : adaptation.direction === "down" ? "text-amber-700 dark:text-amber-400" : "text-muted";
  return (
    <div className="mt-4 rounded-xl bg-surface border border-line px-4 py-3 text-xs">
      <p className="text-fg font-medium">{adaptation.message}</p>
      <p className={`${color} mt-0.5`}>
        {arrow} {adaptation.reason}
      </p>
    </div>
  );
}

export function ImprovementBadge({ comparison }: { comparison: AttemptComparison | null | undefined }) {
  if (!comparison) return null;
  const d = comparison.improvement;
  return (
    <div className="flex items-center gap-3 text-xs mt-2">
      <span className="text-muted">Before: <span className="text-fg font-semibold">{comparison.before}%</span></span>
      <span className="text-subtle">→</span>
      <span className="text-muted">After: <span className="text-fg font-semibold">{comparison.after}%</span></span>
      <span className={`px-2 py-0.5 rounded-md font-semibold ${d > 0 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : d < 0 ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-line-strong text-fg-2"}`}>
        {d > 0 ? `+${d}` : d}%
      </span>
    </div>
  );
}

function Bar({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-fg-2 capitalize">{label}</span>
        <span className={value >= 70 ? "text-emerald-700 dark:text-emerald-400" : value >= 40 ? "text-yellow-700 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}>
          {value}% <span className="text-subtle text-xs">({sub})</span>
        </span>
      </div>
      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function SummaryReport({
  summary, comparison, nextSession, applied, startDifficulty, finalDifficulty, showTypes, sources,
}: {
  summary: Summary; comparison: Comparison | null; nextSession: Plan; applied: Plan | null; startDifficulty: Level;
  finalDifficulty: Level; showTypes?: boolean; sources: Record<string, number>;
}) {
  const stat = (label: string, value: string, accent = "text-fg") => (
    <div className="bg-surface rounded-xl p-4 border border-line text-center">
      <div className={`text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
    </div>
  );
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stat("Overall score", `${summary.score}%`, summary.score >= 60 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}
        {stat("Accuracy (answered)", `${summary.accuracy}%`)}
        {stat("Correct", `${summary.correct}/${summary.total}`)}
        {stat("Avg. response time", summary.avgResponseTime === null ? "—" : `${summary.avgResponseTime}s`)}
      </div>

      <div className="bg-surface rounded-2xl p-5 border border-line flex flex-wrap items-center gap-3 text-sm text-fg-2">
        <span>Difficulty:</span> <DifficultyBadge level={startDifficulty} /> <span className="text-subtle">→</span> <DifficultyBadge level={finalDifficulty} />
        {summary.averageDifficulty && <span className="text-muted text-xs">(average {summary.averageDifficulty})</span>}
        {comparison && (
          <span className="ml-auto text-xs">
            vs previous session:{" "}
            <span className={comparison.scoreDelta >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
              {comparison.scoreDelta >= 0 ? "+" : ""}{comparison.scoreDelta}% score
            </span>{" "}
            ({comparison.previousScore}% → {summary.score}%)
          </span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-surface rounded-2xl p-5 border border-line">
          <h3 className="text-fg font-semibold mb-3">Topic-wise performance</h3>
          <div className="space-y-3">
            {summary.topicWise.length === 0 && <p className="text-sm text-subtle">No answered questions.</p>}
            {summary.topicWise.map((t) => <Bar key={t.topic} label={t.topic} value={t.accuracy} sub={`${t.correct}/${t.attempts}`} />)}
          </div>
        </div>
        <div className="bg-surface rounded-2xl p-5 border border-line space-y-5">
          <div>
            <h3 className="text-fg font-semibold mb-3">Difficulty-wise</h3>
            <div className="space-y-3">
              {summary.difficultyWise.map((d) => <Bar key={d.difficulty} label={d.difficulty} value={d.accuracy} sub={`${d.correct}/${d.answered}`} />)}
            </div>
          </div>
          {showTypes && summary.typeWise.length > 0 && (
            <div>
              <h3 className="text-fg font-semibold mb-3">Question-type performance</h3>
              <div className="space-y-3">
                {summary.typeWise.map((t) => <Bar key={t.questionType} label={t.questionType} value={t.accuracy} sub={`${t.correct}/${t.answered}`} />)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {[
          { title: "Strongest (this session)", items: summary.strongest, color: "text-emerald-700 dark:text-emerald-400", icon: "✓" },
          { title: "Weakest (this session)", items: summary.weakest, color: "text-amber-700 dark:text-amber-400", icon: "△" },
          { title: "Recommended practice", items: summary.recommended, color: "text-sky-700 dark:text-sky-400", icon: "→" },
        ].map((b) => (
          <div key={b.title} className="bg-surface rounded-2xl p-5 border border-line">
            <h3 className="text-fg font-semibold mb-3 text-sm">{b.title}</h3>
            {b.items.length ? b.items.map((t) => <p key={t} className={`${b.color} text-sm`}>{b.icon} {t}</p>) : <p className="text-subtle text-sm">—</p>}
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {applied && <PlanCard plan={applied} title="Personalization applied to this session" />}
        <PlanCard plan={nextSession} title="Your next session" />
      </div>
      <p className="text-[11px] text-subtle">
        Question sources this session: {Object.entries(sources).map(([k, v]) => `${k} ${v}`).join(" · ")}. Every question was validated before it was shown.
      </p>
    </div>
  );
}

export function FadeIn({ children, k }: { children: ReactNode; k: string | number }) {
  return (
    <motion.div key={k} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      {children}
    </motion.div>
  );
}
