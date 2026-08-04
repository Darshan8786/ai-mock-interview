import { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ScoreCard } from "../components/mock-interview/ScoreCard";
import { BACKEND_URL } from "../config/config";

interface ReportData {
  interview: any;
  report: any;
  cheatingEvents: any[];
}

export function InterviewResult() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stateData = (location.state as any)?.report;
    if (stateData) {
      setData(stateData);
      setLoading(false);
    } else if (id) {
      fetchReport(id);
    }
  }, [id, location.state]);

  const fetchReport = async (reportId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${BACKEND_URL}/api/v1/mock-interview/${reportId}/report`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Failed to fetch report:", err);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    const report = data?.report;
    if (!report) return;

    const content = `
MOCK INTERVIEW REPORT
=====================
Job Role: ${report.jobRole}
Type: ${report.interviewType}
Difficulty: ${report.difficulty}
Date: ${new Date(report.createdAt).toLocaleDateString()}

SCORES
------
Overall: ${report.overallScore}%
Technical: ${report.technicalScore}%
Communication: ${report.communicationScore}%
Confidence: ${report.confidenceScore}%
Grammar: ${report.grammarScore}%
Fluency: ${report.fluencyScore}%

STRENGTHS
---------
${report.strengths?.join("\n") || "N/A"}

WEAKNESSES
----------
${report.weaknesses?.join("\n") || "N/A"}

AREAS TO IMPROVE
----------------
${report.areasToImprove?.join("\n") || "N/A"}

CHEATING VIOLATIONS: ${report.cheatingCount}

FINAL FEEDBACK
--------------
${report.finalFeedback || "N/A"}
    `.trim();

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-report-${report.jobRole?.replace(/\s+/g, "-").toLowerCase() || "report"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg">Report not found</p>
          <button
            onClick={() => navigate("/mock-interview/dashboard")}
            className="mt-4 px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { report, interview, cheatingEvents } = data;
  const isTerminated = interview?.status === "terminated";

  const getStatusBadge = () => {
    if (isTerminated) {
      return { label: "Terminated", color: "bg-red-500/20 text-red-400 border-red-500/30" };
    }
    return { label: "Completed", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
  };

  const badge = getStatusBadge();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-5xl mx-auto"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500 mb-4"
          >
            <span className="text-3xl font-bold text-white">
              {report.overallScore}
            </span>
          </motion.div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            Interview Complete
          </h1>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
              {badge.label}
            </span>
            <span className="text-gray-400 text-sm">
              {report.jobRole} • {report.interviewType} • {report.difficulty}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <ScoreCard
            title="Performance Scores"
            items={[
              { label: "Overall", score: report.overallScore },
              { label: "Technical", score: report.technicalScore },
              { label: "Communication", score: report.communicationScore },
              { label: "Confidence", score: report.confidenceScore },
              { label: "Grammar", score: report.grammarScore },
              { label: "Fluency", score: report.fluencyScore },
            ]}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Strengths</h3>
            <div className="space-y-2">
              {report.strengths?.map((s: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-emerald-400">
                  <span>✓</span>
                  <span className="text-sm">{s}</span>
                </div>
              )) || (
                <p className="text-gray-500 text-sm">No strengths recorded</p>
              )}
            </div>

            <h3 className="text-lg font-semibold text-white mt-6 mb-4">Weaknesses</h3>
            <div className="space-y-2">
              {report.weaknesses?.map((w: string, i: number) => (
                <div key={i} className="flex items-center gap-2 text-amber-400">
                  <span>△</span>
                  <span className="text-sm">{w}</span>
                </div>
              )) || (
                <p className="text-gray-500 text-sm">No weaknesses recorded</p>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Areas to Improve</h3>
            <div className="space-y-2">
              {report.areasToImprove?.map((a: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-blue-400">
                  <span className="mt-0.5">→</span>
                  <span className="text-sm">{a}</span>
                </div>
              )) || (
                <p className="text-gray-500 text-sm">No areas recorded</p>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-700">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Details</h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Questions</span>
                  <span className="text-white">{report.questionsAttempted || interview?.questions?.length || 0}/{report.totalQuestions || "?"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Violations</span>
                  <span className={report.cheatingCount > 0 ? "text-red-400" : "text-emerald-400"}>
                    {report.cheatingCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time</span>
                  <span className="text-white">{Math.floor((report.totalTimeTaken || 0) / 60)}m {(report.totalTimeTaken || 0) % 60}s</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {cheatingEvents?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 mb-8"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              Cheating Events ({cheatingEvents.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cheatingEvents.map((event: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-gray-700/30 rounded-lg px-4 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-red-400">⚠</span>
                    <span className="text-sm text-gray-300 capitalize">
                      {event.type?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Per-question breakdown */}
        {interview?.questions?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mb-8"
          >
            <h3 className="text-xl font-semibold text-white mb-4">Question-by-Question Breakdown</h3>
            <div className="space-y-4">
              {interview.questions.map((q: any, i: number) => {
                const e = q.evaluation;
                const scores = [
                  { label: "Technical", score: e?.technicalScore ?? 0 },
                  { label: "Communication", score: e?.communicationScore ?? 0 },
                  { label: "Confidence", score: e?.confidenceScore ?? 0 },
                  { label: "Grammar", score: e?.grammarScore ?? 0 },
                  { label: "Fluency", score: e?.fluencyScore ?? 0 },
                  { label: "Relevance", score: e?.relevanceScore ?? 0 },
                ];
                const avg = q.skipped ? 0 : Math.round(scores.reduce((s, x) => s + x.score, 0) / scores.length);
                const textColor = avg >= 80 ? "text-emerald-400" : avg >= 60 ? "text-yellow-400" : "text-red-400";

                return (
                  <div key={i} className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-gray-500 bg-gray-700 px-2 py-0.5 rounded">
                          Q{i + 1}
                        </span>
                        <p className="text-white font-medium text-sm">{q.question}</p>
                      </div>
                      {q.skipped ? (
                        <span className="shrink-0 text-xs px-2 py-1 rounded-full bg-gray-700 text-gray-400">Skipped</span>
                      ) : (
                        <span className={`shrink-0 text-sm font-bold tabular-nums ${textColor}`}>{avg}%</span>
                      )}
                    </div>

                    {!q.skipped && q.answer && (
                      <p className="text-gray-400 text-xs mb-4 bg-gray-700/30 rounded-lg px-3 py-2 leading-relaxed">
                        {q.answer}
                      </p>
                    )}

                    {!q.skipped && (
                      <>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mb-4">
                          {scores.map((s) => (
                            <div key={s.label}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-500">{s.label}</span>
                                <span className={s.score >= 80 ? "text-emerald-400" : s.score >= 60 ? "text-yellow-400" : "text-red-400"}>
                                  {s.score}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${s.score >= 80 ? "bg-emerald-500" : s.score >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                                  style={{ width: `${s.score}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {e?.feedback && (
                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3">
                            <p className="text-xs text-gray-400 mb-1">AI Feedback</p>
                            <p className="text-sm text-blue-200 leading-relaxed">{e.feedback}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-gray-800 to-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 mb-8"
        >
          <h3 className="text-lg font-semibold text-white mb-3">AI Feedback</h3>
          <p className="text-gray-300 leading-relaxed">
            {report.finalFeedback || "No feedback available."}
          </p>
        </motion.div>

        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={generatePDF}
            className="px-6 py-3 bg-emerald-500/20 text-emerald-400 rounded-xl font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
          >
            Download Report
          </button>
          <button
            onClick={() => navigate("/mock-interview/setup")}
            className="px-6 py-3 bg-blue-500/20 text-blue-400 rounded-xl font-medium border border-blue-500/30 hover:bg-blue-500/30 transition-all"
          >
            Take Another Interview
          </button>
          <button
            onClick={() => navigate("/mock-interview/dashboard")}
            className="px-6 py-3 bg-gray-700/50 text-gray-300 rounded-xl font-medium border border-gray-600 hover:border-gray-500 transition-all"
          >
            Dashboard
          </button>
        </div>
      </motion.div>
    </div>
  );
}
