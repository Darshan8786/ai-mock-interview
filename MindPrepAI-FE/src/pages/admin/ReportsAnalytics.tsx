import { useState } from "react";
import { jsPDF } from "jspdf";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { adminApi } from "../../admin/api";
import { useLoad } from "../../admin/useLoad";
import type { TopicAccuracy } from "../../admin/types";
import { PageHeader } from "../../components/admin/PageHeader";
import { ChartCard } from "../../components/admin/Charts";
import { chartColors, chartTooltipStyle } from "../../components/admin/chartTheme";
import { Button } from "../../components/admin/Button";
import { Select } from "../../components/admin/Inputs";
import { ErrorState } from "../../components/admin/ErrorState";

// Every figure on this page comes from GET /admin/reports?days=N (stored interviews, aptitude and tech-practice
// sessions, saved resume ATS scores, cheating events, applications). Nothing is estimated.
export function ReportsAnalytics() {
  const [range, setRange] = useState("30");
  const report = useLoad(() => adminApi.getReports(Number(range)));
  const onRange = (v: string) => {
    setRange(v);
    // useLoad reads the loader through a ref, so the reload picks up the new range
    setTimeout(report.reload, 0);
  };

  const d = report.data;
  const k = d?.kpis;
  const rangeLabel = { "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days", "365": "Last 12 months" }[range] || `Last ${range} days`;
  const readyPct = k && k.totalStudents ? Math.round((k.placementReady / k.totalStudents) * 100) : 0;

  const exportPDF = () => {
    if (!d || !k) return;
    const doc = new jsPDF();
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("MindPrep AI - Placement Readiness Report", 14, 18);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleDateString()} - ${rangeLabel}`, 14, 25);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Key Metrics", 14, 42);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const metrics: Array<[string, string]> = [
      ["Total students", String(k.totalStudents)],
      ["Active students (in range)", String(k.activeStudents)],
      ["Interviews taken / completed / terminated", `${k.interviewsTaken} / ${k.interviewsCompleted} / ${k.interviewsTerminated}`],
      ["Average interview score", `${k.avgInterviewScore}%`],
      ["Aptitude sessions (avg score)", `${k.aptitudeSessions} (${k.avgAptitudeScore}%)`],
      ["Tech-practice sessions (avg score)", `${k.techSessions} (${k.avgTechScore}%)`],
      ["Resumes analysed (avg ATS)", `${k.resumesAnalyzed} (${k.avgAtsScore}%)`],
      ["Placement ready", `${k.placementReady} of ${k.totalStudents} (${readyPct}%)`],
      ["Cheating events", String(k.cheatingEvents)],
      ["Job applications", String(k.applications)],
    ];
    let y = 50;
    metrics.forEach(([label, value]) => {
      doc.setDrawColor(226, 232, 240);
      doc.line(14, y + 1, 196, y + 1);
      doc.setTextColor(100, 116, 139);
      doc.text(label, 14, y + 6);
      doc.setTextColor(15, 23, 42);
      doc.text(value, 196, y + 6, { align: "right" });
      y += 9;
    });

    const topicTable = (title: string, rows: TopicAccuracy[]) => {
      if (!rows.length) return;
      y += 8;
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(title, 14, y);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      rows.forEach((r) => {
        y += 6;
        doc.text(r.topic.slice(0, 60), 14, y);
        doc.text(`${r.accuracy}% (${r.correct}/${r.answered})`, 196, y, { align: "right" });
      });
    };
    topicTable("Weakest aptitude topics", d.weakestAptitudeTopics);
    topicTable("Weakest tech topics", d.weakestTechTopics);

    doc.addPage();
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Interviews in range", 14, 18);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    const cols = ["Student", "Role", "Type", "Score", "Status", "Date"];
    const colX = [14, 50, 95, 125, 145, 170];
    cols.forEach((c, i) => doc.text(c, colX[i], 26));
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    let rowY = 32;
    d.interviews.slice(0, 36).forEach((i) => {
      doc.text(i.studentName.slice(0, 20), colX[0], rowY);
      doc.text(i.jobRole.slice(0, 24), colX[1], rowY);
      doc.text(i.interviewType, colX[2], rowY);
      doc.text(i.status === "completed" || i.status === "terminated" ? String(i.overallScore) : "—", colX[3], rowY);
      doc.text(i.status, colX[4], rowY);
      doc.text(new Date(i.date).toLocaleDateString(), colX[5], rowY);
      rowY += 7;
    });
    if (!d.interviews.length) doc.text("No interviews in this range.", 14, rowY);
    doc.save(`mindprep-placement-report-${range}d.pdf`);
  };

  const exportCSV = () => {
    if (!d) return;
    const headers = ["Student", "Email", "Role", "Type", "Difficulty", "Status", "Overall Score", "Technical", "Communication",
      "Confidence", "Grammar", "Fluency", "Cheating Flags", "Date"];
    const rows = d.interviews.map((i) => [i.studentName, i.studentEmail, i.jobRole, i.interviewType, i.difficulty, i.status,
      i.overallScore, i.technicalScore, i.communicationScore, i.confidenceScore, i.grammarScore, i.fluencyScore, i.cheatingCount,
      new Date(i.date).toLocaleDateString()]);
    const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `mindprep-interview-report-${range}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Export placement reports and analyze platform performance"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onChange={(e) => onRange(e.target.value)}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
            </Select>
            <Button variant="success" onClick={exportPDF} disabled={!d}>Export PDF</Button>
            <Button variant="secondary" onClick={exportCSV} disabled={!d}>Export Excel (CSV)</Button>
          </div>
        }
      />

      {report.error && <ErrorState message={report.error} onRetry={report.reload} />}

      {report.loading && !d ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="bg-gray-800/70 rounded-2xl h-72 animate-pulse" />)}
        </div>
      ) : d && k ? (
        <div className={report.loading ? "opacity-60 transition-opacity" : ""}>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
            <Kpi label="Avg Interview Score" value={`${k.avgInterviewScore}%`} sub={`${k.interviewsCompleted + k.interviewsTerminated} finished`} />
            <Kpi label="Avg ATS Score" value={`${k.avgAtsScore}%`} sub={`${k.resumesAnalyzed} resumes analysed`} />
            <Kpi label="Placement Ready" value={`${k.placementReady}/${k.totalStudents}`} sub={`${readyPct}% of students`} />
            <Kpi label="Completed Interviews" value={k.interviewsCompleted} sub={`${k.interviewsTaken} started`} />
            <Kpi label="Terminated" value={k.interviewsTerminated} sub={`${k.cheatingEvents} cheating events`} />
            <Kpi label="Total Students" value={k.totalStudents} sub={`${k.activeStudents} active in range`} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Kpi label="Aptitude Sessions" value={k.aptitudeSessions} sub={`avg score ${k.avgAptitudeScore}%`} />
            <Kpi label="Tech-Practice Sessions" value={k.techSessions} sub={`avg score ${k.avgTechScore}%`} />
            <Kpi label="Avg Readiness" value={`${k.avgReadiness}%`} sub="students with activity" />
            <Kpi label="Job Applications" value={k.applications} sub={rangeLabel.toLowerCase()} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Interview Performance" subtitle={`Interviews taken and average score - ${rangeLabel.toLowerCase()}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.interviewPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                  <XAxis dataKey="label" stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 11 }} />
                  <YAxis allowDecimals={false} stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: chartColors.axis }} />
                  <Bar dataKey="interviews" name="Interviews" fill={chartColors.blue} radius={[6, 6, 0, 0]} />
                  <Bar dataKey="avgScore" name="Avg score %" fill={chartColors.emerald} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="ATS Score Distribution" subtitle={`Latest resume analysis per student (${k.resumesAnalyzed} analysed)`}>
              {k.resumesAnalyzed === 0 ? (
                <Empty text="No resume has been analysed yet. Scores appear here once students use the Resume Analyzer." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.atsDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                    <XAxis dataKey="range" stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                    <YAxis allowDecimals={false} stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Bar dataKey="count" name="Students" fill={chartColors.emerald} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Placement Readiness" subtitle={d.readinessMethod}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.placementReadiness.filter((x) => x.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3}>
                    {d.placementReadiness.filter((x) => x.value > 0).map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: chartColors.axis }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Student Activity" subtitle={`Sessions started - ${rangeLabel.toLowerCase()}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d.activity}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                  <XAxis dataKey="label" stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 11 }} />
                  <YAxis allowDecimals={false} stroke={chartColors.axis} tick={{ fill: chartColors.axis, fontSize: 12 }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: chartColors.axis }} />
                  <Line type="monotone" dataKey="interviews" name="Interviews" stroke={chartColors.blue} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="aptitude" name="Aptitude" stroke={chartColors.emerald} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="tech" name="Tech practice" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <TopicTable title="Weakest Aptitude Topics" rows={d.weakestAptitudeTopics} />
            <TopicTable title="Weakest Tech Topics" rows={d.weakestTechTopics} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900/70 backdrop-blur-sm border border-gray-800 rounded-2xl p-4">
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{label}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="h-full flex items-center justify-center text-center text-sm text-gray-500 px-6">{text}</div>;
}

function TopicTable({ title, rows }: { title: string; rows: TopicAccuracy[] }) {
  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-5">
      <h3 className="text-white font-semibold">{title}</h3>
      <p className="text-xs text-gray-500 mb-3">Lowest accuracy across all students in range (topics with 5+ answers)</p>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">Not enough answers in this range yet.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.topic}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300">{r.topic}</span>
                <span className={r.accuracy >= 70 ? "text-emerald-400" : r.accuracy >= 50 ? "text-yellow-400" : "text-red-400"}>
                  {r.accuracy}% <span className="text-gray-500 text-xs">({r.correct}/{r.answered})</span>
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${r.accuracy >= 70 ? "bg-emerald-500" : r.accuracy >= 50 ? "bg-yellow-500" : "bg-red-500"}`} style={{ width: `${r.accuracy}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
