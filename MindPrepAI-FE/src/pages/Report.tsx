import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BACKEND_URL } from "../config/config";
import { Chatbot } from "../components/Chatbot";

type ScoreEntry = {
  category: string;
  score: number;
  sessionId?: string;
  createdAt: string;
  type: "role" | "company" | "subject";
};

type AttemptSummary = {
  total: number;
  correct: number;
  accuracy: number;
};

type SubjectAttempt = {
  subject: string;
  correctCount: number;
  totalCount: number;
};

type ReportResponse = {
  scores: ScoreEntry[];
  subjectBars: { subject: string; averageScore: number }[];
  attempts: AttemptSummary;
};

type SubjectAttemptsResponse = {
  subjectAttempts: SubjectAttempt[];
};

const palette = ["#7C3AED", "#06B6D4", "#F59E0B", "#10B981", "#3B82F6", "#EF4444"];

const capitalizeSubject = (subject: string) => {
  // Handle special cases
  const specialCases: { [key: string]: string } = {
    "dbms": "DBMS",
    "oops": "OOPS",
    "os": "OS",
    "dsa": "DSA",
  };

  const lowerSubject = subject.toLowerCase();
  if (specialCases[lowerSubject]) {
    return specialCases[lowerSubject];
  }

  // Default: capitalize each word
  return subject
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="w-full rounded-2xl border-2 border-white bg-slate-900 p-6 text-center text-white">
    {message}
  </div>
);

export function Report() {
  const [data, setData] = useState<ReportResponse | null>(null);
  const [subjectAttempts, setSubjectAttempts] = useState<SubjectAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const ITEMS_PER_CAROUSEL = 3;

  useEffect(() => {
    const fetchReport = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setData({
          scores: [],
          subjectBars: [],
          attempts: { total: 0, correct: 0, accuracy: 0 },
        });
        setLoading(false);
        return;
      }

      try {
        const [reportRes, attemptsRes, syncRes] = await Promise.all([
          axios.get<ReportResponse>(
            `${BACKEND_URL}/v1/report/personalized`,
            { headers: { token } }
          ),
          axios.get<SubjectAttemptsResponse>(
            `${BACKEND_URL}/v1/report/subject-attempts`,
            { headers: { token } }
          ),
          axios.post(
            `${BACKEND_URL}/v1/vectordb/sync-attempts`,
            {},
            { headers: { token } }
          ),
        ]);

        console.log("Report Response:", reportRes.data);
        console.log("Attempts Response:", attemptsRes.data);
        console.log("Vector DB Sync Response:", syncRes.data);

        setData(reportRes.data);
        const attempts = attemptsRes.data.subjectAttempts || [];
        console.log("Processed Subject Attempts Data:", attempts);
        setSubjectAttempts(attempts);

        const subjects = attempts.map((item) => item.subject);
        console.log("Extracted Subjects:", subjects);
        setAllSubjects(subjects);
        setSelectedSubjects(subjects);
      } catch (err: any) {
        console.error("Report fetch failed:", err);
        console.error("Error details:", err.response?.data);
        setData({
          scores: [],
          subjectBars: [],
          attempts: { total: 0, correct: 0, accuracy: 0 },
        });
        setSubjectAttempts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, []);

  const filteredSubjectAttempts = useMemo(() => {
    if (selectedSubjects.length === 0) {
      return subjectAttempts;
    }
    return subjectAttempts.filter((subject) =>
      selectedSubjects.includes(subject.subject)
    );
  }, [subjectAttempts, selectedSubjects]);

  // Sync selectedSubjects with allSubjects when allSubjects changes
  useEffect(() => {
    if (allSubjects.length > 0 && selectedSubjects.length === 0) {
      // Show only first 3 subjects by default
      setSelectedSubjects(allSubjects.slice(0, 3));
    }
  }, [allSubjects, selectedSubjects]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="animate-pulse text-2xl font-semibold">Building your report...</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-3 text-white">
          <p className="text-sm uppercase tracking-[0.35em] text-indigo-300/80 text-center">
            Personalized Insights
          </p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl text-center">
            Your Performance Dashboard
          </h1>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border-2 border-white bg-slate-900 p-5 text-white shadow-lg">
            <p className="text-sm text-white/70">Attempts</p>
            <h3 className="text-4xl font-bold mt-2">{data.attempts.total}</h3>
            <p className="text-sm text-white/60 mt-1">Questions attempted</p>
          </div>
          <div className="rounded-2xl border-2 border-white bg-slate-900 p-5 text-white shadow-lg">
            <p className="text-sm text-white/70">Correct Answers</p>
            <h3 className="text-4xl font-bold mt-2">{data.attempts.correct}</h3>
            <p className="text-sm text-white/60 mt-1">Across all attempts</p>
          </div>
          <div className="rounded-2xl border-2 border-white bg-slate-900 p-5 text-white shadow-lg">
            <p className="text-sm text-white/80">Accuracy</p>
            <h3 className="text-4xl font-bold mt-2">{data.attempts.accuracy}%</h3>
            <p className="text-sm text-white/70 mt-1">Overall precision</p>
          </div>
        </div>

        <section className="rounded-2xl border-2 border-white bg-slate-900 p-5 text-white shadow-lg">
          <div className="mb-6">
            <p className="text-sm text-white/60">Subject Performance</p>
            <h2 className="text-2xl font-bold">Correct Answers by Categories</h2>
          </div>

          {subjectAttempts.length === 0 ? (
            <>
              <EmptyState message="No subject attempts recorded yet. Start answering questions to see your progress." />
              <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-200 text-sm">
                📊 Tip: Answer questions in the quiz to populate this chart with your performance data.
              </div>
            </>
          ) : (
            <>
              <div className="mb-6">
                <label className="text-sm text-white/70 mb-3 block">Filter Subjects:</label>
                <div className="flex flex-wrap gap-2">
                  {allSubjects.map((subject) => (
                    <button
                      key={subject}
                      onClick={() => {
                        console.log("Clicking subject:", subject);
                        console.log("Currently selected:", selectedSubjects);
                        setSelectedSubjects((prev) => {
                          const newSelected = prev.includes(subject)
                            ? prev.filter((s) => s !== subject)
                            : [...prev, subject];
                          console.log("New selected:", newSelected);
                          return newSelected;
                        });
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedSubjects.includes(subject)
                        ? "bg-indigo-500 text-white"
                        : "bg-white/10 text-white/70 hover:bg-white/20"
                        }`}
                    >
                      {capitalizeSubject(subject)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-6 text-white">Subject-wise Performance</h3>

                {filteredSubjectAttempts.length > 0 && (
                  <div className="relative">
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-3 overflow-hidden">
                      {filteredSubjectAttempts
                        .slice(carouselIndex, carouselIndex + ITEMS_PER_CAROUSEL)
                        .map((attempt, idx) => {
                          const actualIdx = carouselIndex + idx;
                          return (
                            <div
                              key={attempt.subject}
                              className="rounded-xl border-2 border-white bg-slate-800 p-6 hover:border-white transition-all"
                            >
                              <div className="mb-4">
                                <h4
                                  className="text-lg font-semibold"
                                  style={{ color: palette[actualIdx % palette.length] }}
                                >
                                  {capitalizeSubject(attempt.subject)}
                                </h4>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-white/70">Questions Attempted:</span>
                                  <span className="text-2xl font-bold text-white">
                                    {attempt.totalCount}
                                  </span>
                                </div>
                                <div className="w-full bg-white/10 rounded-full h-2">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${(attempt.totalCount / Math.max(...filteredSubjectAttempts.map(a => a.totalCount), 1)) * 100}%`,
                                      backgroundColor: palette[actualIdx % palette.length]
                                    }}
                                  />
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                  <span className="text-sm text-white/70">Correct Answers:</span>
                                  <span
                                    className="text-2xl font-bold"
                                    style={{ color: palette[actualIdx % palette.length] }}
                                  >
                                    {attempt.correctCount}
                                  </span>
                                </div>
                                <div className="w-full bg-white/10 rounded-full h-2">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${(attempt.correctCount / Math.max(...filteredSubjectAttempts.map(a => a.correctCount), 1)) * 100}%`,
                                      backgroundColor: palette[actualIdx % palette.length]
                                    }}
                                  />
                                </div>
                              </div>

                              <div className="mt-4 pt-4 border-t border-white/10">
                                <div className="text-center">
                                  <span className="text-white/60 text-sm">Accuracy</span>
                                  <p className="text-3xl font-bold mt-1" style={{ color: palette[actualIdx % palette.length] }}>
                                    {attempt.totalCount > 0
                                      ? Math.round((attempt.correctCount / attempt.totalCount) * 100)
                                      : 0}%
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {filteredSubjectAttempts.length > ITEMS_PER_CAROUSEL && (
                      <div className="flex justify-between items-center mt-6">
                        <button
                          onClick={() =>
                            setCarouselIndex((prev) =>
                              prev - ITEMS_PER_CAROUSEL < 0 ? 0 : prev - ITEMS_PER_CAROUSEL
                            )
                          }
                          className="px-4 py-2 rounded-lg bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-all disabled:opacity-50"
                          disabled={carouselIndex === 0}
                        >
                          ← Previous
                        </button>
                        <span className="text-white/70 text-sm">
                          {carouselIndex + 1} - {Math.min(carouselIndex + ITEMS_PER_CAROUSEL, filteredSubjectAttempts.length)} of {filteredSubjectAttempts.length}
                        </span>
                        <button
                          onClick={() =>
                            setCarouselIndex((prev) =>
                              prev + ITEMS_PER_CAROUSEL >= filteredSubjectAttempts.length
                                ? prev
                                : prev + ITEMS_PER_CAROUSEL
                            )
                          }
                          className="px-4 py-2 rounded-lg bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-all disabled:opacity-50"
                          disabled={carouselIndex + ITEMS_PER_CAROUSEL >= filteredSubjectAttempts.length}
                        >
                          Next →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* Chatbot Section */}
        <Chatbot />
      </div>
    </div>
  );
}