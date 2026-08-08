import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { adminApi } from "../../admin/api";
import { useLoad } from "../../admin/useLoad";
import { PageHeader } from "../../components/admin/PageHeader";
import { StatCard } from "../../components/admin/StatCard";
import { ChartCard } from "../../components/admin/Charts";
import { chartColors, chartTooltipStyle } from "../../components/admin/chartTheme";
import { StatSkeleton } from "../../components/admin/Skeleton";
import { ErrorState } from "../../components/admin/ErrorState";
import { Button } from "../../components/admin/Button";

export function AdminDashboard() {
  const navigate = useNavigate();
  const stats = useLoad(() => adminApi.getStats());
  const charts = useLoad(() => adminApi.getCharts());

  const statCards = [
    {
      label: "Total Students",
      value: stats.data?.totalStudents ?? 0,
      icon: <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      color: "bg-blue-500/15",
      trend: "12%",
      trendUp: true,
    },
    {
      label: "Total Interviews",
      value: stats.data?.totalInterviews ?? 0,
      icon: <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
      color: "bg-purple-500/15",
      trend: "8%",
      trendUp: true,
    },
    {
      label: "Total Quiz Attempts",
      value: stats.data?.totalQuizAttempts ?? 0,
      icon: <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      color: "bg-amber-500/15",
      trend: "5%",
      trendUp: true,
    },
    {
      label: "Total Resume Analyses",
      value: stats.data?.totalResumeAnalyses ?? 0,
      icon: <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      color: "bg-emerald-500/15",
      trend: "18%",
      trendUp: true,
    },
    {
      label: "Total Jobs",
      value: stats.data?.totalJobs ?? 0,
      icon: <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
      color: "bg-cyan-500/15",
      trend: "3%",
      trendUp: false,
    },
    {
      label: "Average ATS Score",
      value: `${stats.data?.avgAtsScore ?? 0}%`,
      icon: <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
      color: "bg-red-500/15",
      trend: "4%",
      trendUp: true,
    },
    {
      label: "Placement Readiness",
      value: `${stats.data?.placementReadiness ?? 0}%`,
      icon: <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      color: "bg-green-500/15",
      trend: "2%",
      trendUp: true,
    },
    {
      label: "Today's Proctoring Violations",
      value: stats.data?.todayProctoringViolations ?? 0,
      icon: <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
      color: "bg-red-500/15",
      trend: "30%",
      trendUp: false,
    },
  ];

  const readiness = charts.data?.placementReady ?? [];
  const weekly = charts.data?.weeklyActivity ?? [];

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        subtitle="Overview of platform activity and student performance"
        actions={
          <Button variant="secondary" onClick={() => navigate("/admin/reports")}>
            View Reports →
          </Button>
        }
      />

      {stats.error && <ErrorState message={stats.error} onRetry={stats.reload} />}
      {stats.loading ? (
        <StatSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {statCards.map((card) => (
            <StatCard key={card.label} {...card} />
          ))}
        </div>
      )}

      {charts.error && <ErrorState message={charts.error} onRetry={charts.reload} />}
      {charts.loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-800/70 rounded-2xl h-72 animate-pulse" />
          <div className="bg-gray-800/70 rounded-2xl h-72 animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Interview Performance */}
          <ChartCard title="Interview Performance" subtitle="Average scores across last 6 months">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.data?.interviewPerformance ?? []} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="label" stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                <YAxis stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="interviews" name="Interviews" fill={chartColors.blue} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Quiz Performance */}
          <ChartCard title="Quiz Performance" subtitle="Quiz attempt success rates">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.data?.quizPerformance ?? []} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="label" stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                <YAxis stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="quizzes" name="Quizzes" fill={chartColors.purple} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* ATS Score Distribution */}
          <ChartCard title="ATS Score Distribution" subtitle="Resume ATS score ranges across students">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.data?.atsDistribution ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="range" stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                <YAxis stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="count" name="Students" fill={chartColors.emerald} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Placement Ready Students */}
          <ChartCard title="Placement Ready Students" subtitle="Readiness distribution">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={readiness}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  {readiness.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: chartColors.axis }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Weekly User Activity */}
          <ChartCard title="Weekly User Activity" subtitle="Logins, interviews and quiz attempts" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weekly}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="day" stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                <YAxis stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: chartColors.axis }} />
                <Line type="monotone" dataKey="logins" name="Logins" stroke={chartColors.blue} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="interviews" name="Interviews" stroke={chartColors.emerald} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="quizzes" name="Quizzes" stroke={chartColors.purple} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6"
      >
        <Button variant="primary" onClick={() => navigate("/admin/students")}>
          Manage Students →
        </Button>
      </motion.div>
    </div>
  );
}
