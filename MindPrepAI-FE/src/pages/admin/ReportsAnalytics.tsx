import { useState } from "react";
import { jsPDF } from "jspdf";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { adminApi } from "../../admin/api";
import { useLoad } from "../../admin/useLoad";
import { PageHeader } from "../../components/admin/PageHeader";
import { ChartCard } from "../../components/admin/Charts";
import { chartColors, chartTooltipStyle } from "../../components/admin/chartTheme";
import { Button } from "../../components/admin/Button";
import { Select } from "../../components/admin/Inputs";
import { ErrorState } from "../../components/admin/ErrorState";

export function ReportsAnalytics() {
  const [range, setRange] = useState("30");
  const charts = useLoad(() => adminApi.getCharts());
  const interviews = useLoad(() => adminApi.getInterviews());
  const students = useLoad(() => adminApi.getStudents());
  const resumes = useLoad(() => adminApi.getResumes());

  const completed = (interviews.data ?? []).filter((i) => i.status === "completed");
  const avgScore = completed.length
    ? Math.round(completed.reduce((a, i) => a + i.overallScore, 0) / completed.length)
    : 0;
  const terminated = (interviews.data ?? []).filter((i) => i.status === "terminated").length;
  const readyCount = (students.data ?? []).filter((s) => s.placementReadiness >= 70).length;
  const totalStudents = students.data?.length ?? 0;
  const avgAts = resumes.data?.length
    ? Math.round(resumes.data.reduce((a, r) => a + r.atsScore, 0) / resumes.data.length)
    : 0;

  const exportPDF = () => {
    const doc = new jsPDF();
    const now = new Date().toLocaleDateString();

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("MindPrep AI — Placement Readiness Report", 14, 18);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${now} · Range: Last ${range} days`, 14, 25);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Key Metrics", 14, 42);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const metrics = [
      ["Total Students", String(totalStudents)],
      ["Avg Interview Score", `${avgScore}%`],
      ["Avg ATS Score", `${avgAts}%`],
      ["Placement Ready", `${readyCount} (${totalStudents ? Math.round((readyCount / totalStudents) * 100) : 0}%)`],
      ["Terminated Interviews", String(terminated)],
      ["Completed Interviews", String(completed.length)],
    ];
    let y = 52;
    metrics.forEach(([label, value]) => {
      doc.setDrawColor(226, 232, 240);
      doc.line(14, y + 1, 196, y + 1);
      doc.setTextColor(100, 116, 139);
      doc.text(label, 14, y + 6);
      doc.setTextColor(15, 23, 42);
      doc.text(value, 196, y + 6, { align: "right" });
      y += 10;
    });

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Recent Interviews", 14, y + 14);

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    const cols = ["Student", "Role", "Type", "Score", "Status", "Date"];
    const colX = [14, 45, 80, 110, 140, 165];
    cols.forEach((c, i) => doc.text(c, colX[i], y + 22));

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    let rowY = y + 28;
    (interviews.data ?? []).slice(0, 18).forEach((i) => {
      doc.text(i.studentName.slice(0, 18), colX[0], rowY);
      doc.text(i.jobRole.slice(0, 20), colX[1], rowY);
      doc.text(i.interviewType, colX[2], rowY);
      doc.text(i.status === "pending" ? "—" : String(i.overallScore), colX[3], rowY);
      doc.text(i.status, colX[4], rowY);
      doc.text(new Date(i.date).toLocaleDateString(), colX[5], rowY);
      rowY += 7;
    });

    doc.save("mindprep-placement-report.pdf");
  };

  const exportCSV = () => {
    const rows = (interviews.data ?? []).map((i) => ({
      Student: i.studentName,
      Email: i.studentEmail,
      Role: i.jobRole,
      Type: i.interviewType,
      Difficulty: i.difficulty,
      Status: i.status,
      "Overall Score": i.overallScore,
      Technical: i.technicalScore,
      Communication: i.communicationScore,
      Confidence: i.confidenceScore,
      Grammar: i.grammarScore,
      Fluency: i.fluencyScore,
      "Cheating Flags": i.cheatingCount,
      Date: new Date(i.date).toLocaleDateString(),
    }));
    const headers = Object.keys(rows[0] ?? {});
    const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escape((r as Record<string, string | number>)[h])).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mindprep-interview-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const readiness = charts.data?.placementReady ?? [];

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Export placement reports and analyze platform performance"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
            </Select>
            <Button variant="success" onClick={exportPDF}>Export PDF</Button>
            <Button variant="secondary" onClick={exportCSV}>Export Excel (CSV)</Button>
          </div>
        }
      />

      {charts.error && <ErrorState message={charts.error} onRetry={charts.reload} />}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <Kpi label="Avg Interview Score" value={`${avgScore}%`} />
        <Kpi label="Avg ATS Score" value={`${avgAts}%`} />
        <Kpi label="Placement Ready" value={`${readyCount}/${totalStudents}`} />
        <Kpi label="Completed Interviews" value={completed.length} />
        <Kpi label="Terminated" value={terminated} />
        <Kpi label="Total Students" value={totalStudents} />
      </div>

      {charts.loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-800/70 rounded-2xl h-72 animate-pulse" />
          <div className="bg-gray-800/70 rounded-2xl h-72 animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="Interview Performance" subtitle="Monthly interview counts">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.data?.interviewPerformance ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="label" stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                <YAxis stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="interviews" name="Interviews" fill={chartColors.blue} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="ATS Score Distribution" subtitle="Resume quality across students">
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

          <ChartCard title="Placement Readiness" subtitle="Readiness distribution across students">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={readiness} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}>
                  {readiness.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12, color: chartColors.axis }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Weekly Activity" subtitle="Engagement over the week">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={charts.data?.weeklyActivity ?? []}>
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
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900/70 backdrop-blur-sm border border-gray-800 rounded-2xl p-4">
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
    </div>
  );
}
