import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ModuleHero, Panel } from "../components/module/ModuleKit";
import { CollegeInterviewsSection } from "../components/CollegeInterviewsSection";
import { FloatingCard } from "../components/3d/FloatingCard";
import { BACKEND_URL } from "../config/config";
import { getProgress } from "../services/mockInterviewApi";
import type { ProgressData } from "../types/mockFeedback";
import { ProgressCharts } from "../components/mock-interview/feedback/ProgressCharts";
import { WeaknessMapCard } from "../components/mock-interview/feedback/WeaknessMapCard";

interface DashboardData {
  interviews: any[];
  reports: any[];
  stats: {
    totalInterviews: number;
    completedInterviews: number;
    averageScore: number;
    bestScore: number;
    totalCheatingEvents: number;
    recentInterviews: any[];
  };
}

export function MockDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<ProgressData | null>(null);

  useEffect(() => {
    fetchDashboard();
    getProgress()
      .then((r) => {
        if (r?.success) setProgress(r.data);
      })
      .catch((err) => console.error("Progress fetch error:", err));
  }, []);

  const fetchDashboard = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${BACKEND_URL}/api/v1/mock-interview/dashboard`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = data?.stats;
  const interviews = data?.interviews || [];
  const reports = data?.reports || [];
  const scoreTone = (s: number) =>
    s >= 70 ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10" : s >= 40 ? "text-amber-700 dark:text-amber-400 bg-amber-500/10" : "text-red-700 dark:text-red-400 bg-red-500/10";

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <ModuleHero
        kind="interview"
        kicker="// practice/interview"
        title="Mock Interview"
        description="A proctored AI interview: questions tailored to your role and resume, spoken answers, live webcam monitoring and a detailed feedback report with what to fix next."
        stats={[
          { label: "interviews", value: stats?.totalInterviews || 0 },
          { label: "completed", value: stats?.completedInterviews || 0 },
          { label: "avg score", value: `${stats?.averageScore || 0}%` },
          { label: "best score", value: `${stats?.bestScore || 0}%` },
        ]}
        actions={
          <button
            onClick={() => navigate("/mock-interview/setup")}
            className="px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold transition-colors"
          >
            Start a new interview →
          </button>
        }
      />

      <CollegeInterviewsSection />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Panel className="lg:col-span-2" kicker="// history[]" title="Interview history">
          {interviews.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-subtle mb-4">No interviews yet.</p>
              <button onClick={() => navigate("/mock-interview/setup")} className="px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-semibold">
                Start your first interview
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-line -my-2">
              {interviews.slice(0, 10).map((interview: any) => (
                <li key={interview._id}>
                  <button
                    onClick={() => navigate(`/mock-interview/result/${interview._id}`)}
                    className="w-full flex items-center justify-between gap-4 py-3 px-2 -mx-2 rounded-lg text-left hover:bg-surface-2 transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-fg truncate">{interview.jobRole}</span>
                      <span className="mt-1 flex gap-1.5 font-mono text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 border border-line text-muted">{interview.interviewType}</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-2 border border-line text-muted">{interview.difficulty}</span>
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-sm font-bold tabular-nums ${scoreTone(interview.overallScore || 0)}`}>
                        {interview.overallScore || "—"}%
                      </span>
                      <span className="block text-[10px] text-subtle mt-1">{new Date(interview.createdAt).toLocaleDateString()}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <ScoreDistribution reports={reports} />
      </div>

      {progress && progress.points.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2">
            <ProgressCharts progress={progress} />
          </div>
          {progress.weaknessMap && (
            <WeaknessMapCard
              map={progress.weaknessMap}
              title="Recurring Weaknesses"
              scope={`Across your last ${Math.min(10, progress.points.length)} interviews`}
            />
          )}
        </div>
      )}

      <Panel kicker="// reports[]" title="Recent reports">
        {reports.length === 0 ? (
          <p className="text-subtle text-center py-4">No reports available yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.slice(0, 6).map((report: any) => (
              <FloatingCard key={report._id} intensity={6}>
                <button
                  onClick={() => navigate(`/mock-interview/result/${report._id}`)}
                  className="w-full text-left rounded-xl p-4 bg-surface-2/60 border border-line hover:border-accent/40 transition-colors"
                >
                  <span className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-fg truncate">{report.jobRole}</span>
                    <span className={`px-2 py-0.5 rounded-md text-sm font-bold tabular-nums ${scoreTone(report.overallScore || 0)}`}>{report.overallScore}%</span>
                  </span>
                  <span className="flex gap-1.5 font-mono text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-surface border border-line text-muted">{report.interviewType}</span>
                    <span className="px-1.5 py-0.5 rounded bg-surface border border-line text-muted">{report.difficulty}</span>
                  </span>
                  <span className="block text-[10px] text-subtle mt-2">
                    {new Date(report.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </button>
              </FloatingCard>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ScoreDistribution({ reports }: { reports: any[] }) {
  const getScoreRange = (score: number) => {
    if (score >= 80) return "excellent";
    if (score >= 60) return "good";
    if (score >= 40) return "average";
    return "needs_improvement";
  };

  const distribution: Record<string, number> = {
    excellent: 0,
    good: 0,
    average: 0,
    needs_improvement: 0,
  };

  reports.forEach((r: any) => {
    const range = getScoreRange(r.overallScore);
    distribution[range] = (distribution[range] || 0) + 1;
  });

  const total = reports.length || 1;

  const colors: Record<string, string> = {
    excellent: "bg-emerald-500",
    good: "bg-blue-500",
    average: "bg-yellow-500",
    needs_improvement: "bg-red-500",
  };

  return (
    <Panel kicker="// scores.histogram()" title="Score distribution">
      <div className="space-y-3">
        {Object.entries(colors).map(([key, color]) => (
          <div key={key}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted capitalize">{key.replace(/_/g, " ")}</span>
              <span className="text-subtle">{distribution[key]}</span>
            </div>
            <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(distribution[key] / total) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full rounded-full ${color}`}
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
