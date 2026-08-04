import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BACKEND_URL } from "../config/config";

interface Suggestion {
  skill: string;
  action: string;
  resource: string;
  priority: string;
}

interface LiveJob {
  title: string;
  company: string;
  location: string;
  salary_min: string;
  salary_max: string;
  url: string;
  category: string;
  required_skills: string[];
  matched_skills: string[];
  missing_skills: string[];
  fit_score: number | null;
  gap_summary: string;
  suggestions: Suggestion[];
}

interface Improvement {
  area: string;
  suggestion: string;
  priority: string;
}

interface Analysis {
  skills: string[];
  experience_years: number;
  top_roles: string[];
  strengths: string[];
  weaknesses: string[];
  improvements: Improvement[];
  ats_score: number;
  ats_friendly: boolean;
  ats_issues: string[];
  ats_passed_checks: string[];
  missing_keywords: string[];
  summary: string;
}

export function ResumeAnalyzer() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [liveJobs, setLiveJobs] = useState<LiveJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fixing, setFixing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setAnalysis(null);
    setLiveJobs([]);

    const formData = new FormData();
    formData.append("resume", file);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND_URL}/api/v1/resume/analyze`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Analysis failed");
      setAnalysis(data.data.analysis);
      setLiveJobs(data.data.liveJobs || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFix = async () => {
    if (!file) return;
    setFixing(true);
    setError(null);
    const formData = new FormData();
    formData.append("resume", file);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND_URL}/api/v1/resume/auto-fix`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Auto-fix failed");
      navigate("/resume-builder", { state: { importedData: data.data.resume, atsAnalysis: analysis } });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFixing(false);
    }
  };

  const getScoreColor = (s: number) =>
    s >= 80 ? "text-emerald-400" : s >= 60 ? "text-yellow-400" : "text-red-400";
  const getPriColor = (p: string) =>
    p === "high" ? "bg-red-500/20 text-red-400" : p === "medium" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 py-8 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
            AI Resume Analyzer
          </h1>
          <p className="text-gray-400 mt-2">Upload your resume to get company suggestions & improvement tips</p>
        </div>

        {!analysis && (
          <motion.div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f?.type === "application/pdf") setFile(f); }}
            className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all ${
              dragOver ? "border-emerald-500 bg-emerald-500/5" : "border-gray-600 hover:border-gray-500"
            }`}
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-white font-medium mb-1">Drop your PDF resume here</p>
            <p className="text-gray-500 text-sm mb-4">or click to browse (max 5MB)</p>
            <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button onClick={() => inputRef.current?.click()} className="px-6 py-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 hover:bg-emerald-500/30 transition-all">
              Select File
            </button>
            {file && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center justify-center gap-2 text-sm">
                <span className="text-emerald-400">✓</span>
                <span className="text-gray-300">{file.name}</span>
                <span className="text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
              </motion.div>
            )}
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="mt-6 px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:shadow-lg hover:shadow-emerald-500/25"
            >
              {loading ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analyzing...</span>
              ) : "Analyze Resume"}
            </button>
          </motion.div>
        )}

        {error && <div className="mt-6 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">{error}</div>}

        <AnimatePresence>
          {analysis && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Analysis Results</h2>
                <div className="flex items-center gap-4">
                  <button onClick={() => { setAnalysis(null); setFile(null); }} className="text-sm text-gray-400 hover:text-white transition-all">Analyze Another</button>
                  {analysis.ats_friendly === false && (
                    <button
                      onClick={handleAutoFix}
                      disabled={fixing}
                      className="px-4 py-2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-all disabled:opacity-50"
                    >
                      {fixing ? "Fixing..." : "Auto-Fix ATS Issues 🪄"}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatBox label="ATS Score" value={`${analysis.ats_score}%`} color={getScoreColor(analysis.ats_score)} />
                <StatBox label="Experience" value={`${analysis.experience_years}yrs`} color="text-white" />
                <StatBox label="Skills Found" value={`${analysis.skills.length}`} color="text-blue-400" />
                <StatBox label="Live Jobs" value={`${liveJobs.length}`} color="text-emerald-400" />
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl p-6 border ${
                  analysis.ats_friendly
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-red-500/10 border-red-500/30"
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    analysis.ats_friendly ? "bg-emerald-500/20" : "bg-red-500/20"
                  }`}>
                    <span className="text-2xl">{analysis.ats_friendly ? "✓" : "✗"}</span>
                  </div>
                  <div>
                    <h3 className={`text-lg font-bold ${analysis.ats_friendly ? "text-emerald-400" : "text-red-400"}`}>
                      {analysis.ats_friendly ? "ATS Friendly" : "Not ATS Friendly"}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {analysis.ats_friendly
                        ? "Your resume is optimized for Applicant Tracking Systems"
                        : "Your resume has issues that may cause ATS rejection"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Failed Checks</p>
                    {analysis.ats_issues?.length > 0 ? (
                      <ul className="space-y-1.5">
                        {analysis.ats_issues.map((issue, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-red-400">
                            <span className="mt-0.5">✗</span>
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">None</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Passed Checks</p>
                    {analysis.ats_passed_checks?.length > 0 ? (
                      <ul className="space-y-1.5">
                        {analysis.ats_passed_checks.map((check, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-emerald-400">
                            <span className="mt-0.5">✓</span>
                            <span>{check}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">None</p>
                    )}
                  </div>
                </div>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <motion.div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-1">Live Jobs in Bengaluru</h3>
                    <p className="text-xs text-gray-500 mb-4">Skill gap analysis against real, current openings</p>
                    {liveJobs.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No live jobs could be fetched right now. Please check the Adzuna API configuration.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {liveJobs.map((j, i) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                            className="bg-gray-700/30 rounded-xl p-4 border border-gray-600/50"
                          >
                            <div className="flex items-start justify-between mb-1 gap-3">
                              <div className="min-w-0">
                                <p className="text-white font-semibold truncate">{j.title}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{j.company} · {j.location}</p>
                              </div>
                              {typeof j.fit_score === "number" ? (
                                <div className={`text-lg font-bold shrink-0 ${getScoreColor(j.fit_score)}`}>{j.fit_score}%</div>
                              ) : (
                                <div className="text-lg font-bold shrink-0 text-gray-500">—</div>
                              )}
                            </div>
                            <p className="text-[11px] text-emerald-400">{j.salary_min} - {j.salary_max} · {j.category}</p>

                            {j.required_skills?.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-600/50">
                                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Required Skills</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {j.required_skills.map((s, k) => {
                                    const isMissing = j.missing_skills?.includes(s);
                                    const isMatched = j.matched_skills?.includes(s);
                                    return (
                                      <span
                                        key={k}
                                        className={`text-[11px] px-2 py-1 rounded-lg border ${
                                          isMissing
                                            ? "bg-red-500/10 text-red-400 border-red-500/30"
                                            : isMatched
                                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                            : "bg-gray-600/50 text-gray-300 border-gray-600"
                                        }`}
                                        title={isMissing ? "Missing skill" : isMatched ? "Matched" : "Required"}
                                      >
                                        {isMissing ? "✗ " : isMatched ? "✓ " : ""}{s}
                                      </span>
                                    );
                                  })}
                                </div>
                                {j.missing_skills?.length > 0 && (
                                  <p className="text-[11px] text-red-400 mt-2">
                                    Skill gap: {j.missing_skills.length} required skill{j.missing_skills.length > 1 ? "s" : ""} missing — {j.gap_summary}
                                  </p>
                                )}
                              </div>
                            )}

                            {j.suggestions?.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-600/50">
                                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">How to Close the Gap</p>
                                <div className="space-y-2">
                                  {j.suggestions.map((s, k) => (
                                    <div key={k} className="flex items-start gap-2 bg-gray-800/60 rounded-lg p-2.5 border border-gray-700/60">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium mt-0.5 shrink-0 ${getPriColor(s.priority)}`}>
                                        {s.priority}
                                      </span>
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium text-white">{s.skill}</p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{s.action}</p>
                                        <p className="text-[11px] text-blue-400 mt-0.5">Learn: {s.resource}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {j.url && (
                              <a
                                href={j.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block mt-3 text-xs font-medium text-blue-400 hover:text-blue-300"
                              >
                                View & Apply →
                              </a>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>

                  <motion.div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Improvement Suggestions</h3>
                    <div className="space-y-3">
                      {analysis.improvements.map((imp, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                          className="bg-gray-700/30 rounded-xl p-4 border border-gray-600/50"
                        >
                          <div className="flex items-start gap-3">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium mt-0.5 ${getPriColor(imp.priority)}`}>
                              {imp.priority}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-white">{imp.area}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{imp.suggestion}</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </div>

                <div className="space-y-6">
                  <motion.div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Skills</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {analysis.skills.map((s, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 bg-gray-700 rounded-lg text-gray-300">{s}</span>
                      ))}
                    </div>
                  </motion.div>

                  <motion.div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Strengths</h3>
                    <ul className="space-y-1.5">
                      {analysis.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-emerald-400"><span>✓</span><span>{s}</span></li>
                      ))}
                    </ul>
                  </motion.div>

                  <motion.div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Weaknesses</h3>
                    <ul className="space-y-1.5">
                      {analysis.weaknesses.map((w, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-red-400"><span>△</span><span>{w}</span></li>
                      ))}
                    </ul>
                  </motion.div>

                  {analysis.missing_keywords.length > 0 && (
                    <motion.div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                      <h3 className="text-lg font-semibold text-white mb-4">Missing Keywords</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.missing_keywords.map((k, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 bg-yellow-500/10 text-yellow-400 rounded-lg border border-yellow-500/20">{k}</span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              <motion.div className="bg-gradient-to-br from-gray-800 to-gray-800/50 rounded-2xl p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-2">AI Summary</h3>
                <p className="text-gray-300 leading-relaxed">{analysis.summary}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-800/50 rounded-2xl p-4 border border-gray-700 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
