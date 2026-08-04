import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BACKEND_URL } from "../config/config";

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

  useEffect(() => {
    fetchDashboard();
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  const stats = data?.stats;
  const interviews = data?.interviews || [];
  const reports = data?.reports || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Mock Interview Dashboard
            </h1>
            <p className="text-gray-400 mt-1">Track your interview performance and progress</p>
          </div>
          <button
            onClick={() => navigate("/mock-interview/setup")}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
          >
            New Interview
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Interviews"
            value={stats?.totalInterviews || 0}
            icon="🎯"
            delay={0}
          />
          <StatCard
            label="Completed"
            value={stats?.completedInterviews || 0}
            icon="✅"
            delay={0.1}
          />
          <StatCard
            label="Avg Score"
            value={`${stats?.averageScore || 0}%`}
            icon="📊"
            delay={0.2}
            scoreColor
          />
          <StatCard
            label="Best Score"
            value={`${stats?.bestScore || 0}%`}
            icon="🏆"
            delay={0.3}
            scoreColor
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
            >
              <h2 className="text-lg font-semibold text-white mb-4">Interview History</h2>
              {interviews.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">No interviews yet</p>
                  <button
                    onClick={() => navigate("/mock-interview/setup")}
                    className="px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium"
                  >
                    Start Your First Interview
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {interviews.slice(0, 10).map((interview: any) => (
                    <div
                      key={interview._id}
                      onClick={() => navigate(`/mock-interview/result/${interview._id}`)}
                      className="flex items-center justify-between bg-gray-700/30 rounded-xl px-4 py-3 hover:bg-gray-700/50 transition-colors cursor-pointer"
                    >
                      <div>
                        <p className="text-white font-medium text-sm">{interview.jobRole}</p>
                        <div className="flex gap-2 mt-1">
                          <span className="text-[10px] px-2 py-0.5 bg-gray-600/50 rounded-full text-gray-400">
                            {interview.interviewType}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 bg-gray-600/50 rounded-full text-gray-400">
                            {interview.difficulty}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${
                          interview.overallScore >= 70 ? "text-emerald-400" : "text-yellow-400"
                        }`}>
                          {interview.overallScore || "—"}%
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(interview.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>

          <div>
            <ScoreDistribution reports={reports} />
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
        >
          <h2 className="text-lg font-semibold text-white mb-4">Recent Reports</h2>
          {reports.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No reports available yet</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.slice(0, 6).map((report: any) => (
                <motion.div
                  key={report._id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => navigate(`/mock-interview/result/${report._id}`)}
                  className="bg-gray-700/30 rounded-xl p-4 border border-gray-600/50 cursor-pointer hover:border-emerald-500/30 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{report.jobRole}</span>
                    <span className={`text-sm font-bold ${
                      report.overallScore >= 70 ? "text-emerald-400" : "text-yellow-400"
                    }`}>
                      {report.overallScore}%
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 bg-gray-600/50 rounded-full text-gray-400">
                      {report.interviewType}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 bg-gray-600/50 rounded-full text-gray-400">
                      {report.difficulty}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-2">
                    {new Date(report.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  delay,
  scoreColor,
}: {
  label: string;
  value: string | number;
  icon: string;
  delay: number;
  scoreColor?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-5 border border-gray-700"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${scoreColor ? "text-emerald-400" : "text-white"}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </motion.div>
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
    >
      <h2 className="text-lg font-semibold text-white mb-4">Score Distribution</h2>
      <div className="space-y-3">
        {Object.entries(colors).map(([key, color]) => (
          <div key={key}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-400 capitalize">{key.replace(/_/g, " ")}</span>
              <span className="text-gray-500">{distribution[key]}</span>
            </div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
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
    </motion.div>
  );
}
