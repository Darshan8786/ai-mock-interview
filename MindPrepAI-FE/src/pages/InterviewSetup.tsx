import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config/config";
import type { ResumeProfile } from "../hooks/useInterview";
import { getPersonalization } from "../services/mockInterviewApi";
import type { Personalization } from "../types/mockFeedback";
import { NextInterviewPlan } from "../components/mock-interview/feedback/NextInterviewPlan";

const jobRoles = [
  "Software Engineer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Data Scientist",
  "Machine Learning Engineer",
  "DevOps Engineer",
  "Cloud Architect",
  "Product Manager",
  "UI/UX Designer",
  "QA Engineer",
  "Security Engineer",
];

const experienceLevels = [
  { value: "fresher", label: "Fresher (0-1 yrs)" },
  { value: "junior", label: "Junior (1-3 yrs)" },
  { value: "mid", label: "Mid-Level (3-5 yrs)" },
  { value: "senior", label: "Senior (5-8 yrs)" },
  { value: "lead", label: "Lead (8+ yrs)" },
];

const interviewTypes = [
  { value: "Technical", label: "Technical", icon: "⚙️", desc: "Focus on technical skills and problem-solving" },
  { value: "HR", label: "HR", icon: "👥", desc: "Behavioral and cultural fit assessment" },
  { value: "Behavioral", label: "Behavioral", icon: "🧠", desc: "Soft skills and situational responses" },
  { value: "Resume", label: "Resume-Based", icon: "📄", desc: "Questions on your own projects and skills, from your resume" },
];

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

const difficulties = [
  { value: "Easy", label: "Easy", color: "emerald" },
  { value: "Medium", label: "Medium", color: "amber" },
  { value: "Hard", label: "Hard", color: "red" },
];

const INTERN_ROLE = /intern|trainee/i;
const YEAR = /\b(?:19|20)\d{2}\b/;

interface InterviewDefaults {
  jobRole: string;
  experienceLevel: string;
  difficulty: string;
}

// A resume-based interview doesn't ask for role / level / difficulty: they are
// worked out from the resume so the candidate only uploads it and picks a
// question count. Level comes from the total years across non-internship jobs
// (years are read from the dates the parser found; an entry with no usable
// dates adds nothing), the role from the most recent non-internship job, and
// difficulty is a fixed Medium - the resume can't say how hard to ask.
function deriveInterviewDefaults(experience: any[]): InterviewDefaults {
  const nowYear = new Date().getFullYear();
  let years = 0;
  for (const job of experience) {
    if (INTERN_ROLE.test(String(job?.role || ""))) continue;
    const start = String(job?.startDate || "").match(YEAR);
    const endText = String(job?.endDate || "");
    const endMatch = endText.match(YEAR);
    const ongoing = job?.current || /present|current|now|till date/i.test(endText);
    const end = ongoing ? nowYear : endMatch ? Number(endMatch[0]) : NaN;
    if (start && !Number.isNaN(end) && end >= Number(start[0])) years += end - Number(start[0]);
  }

  const experienceLevel =
    years < 1 ? "fresher" : years < 3 ? "junior" : years < 5 ? "mid" : years < 8 ? "senior" : "lead";
  const latestRole = experience
    .map((job) => String(job?.role || "").trim())
    .find((role) => role && !INTERN_ROLE.test(role));

  return { jobRole: latestRole?.slice(0, 80) || "Software Engineer", experienceLevel, difficulty: "Medium" };
}

export function InterviewSetup() {
  const navigate = useNavigate();
  const [jobRole, setJobRole] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [interviewType, setInterviewType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [searchTerm, setSearchTerm] = useState("");

  const [resume, setResume] = useState<ResumeProfile | null>(null);
  const [resumeDefaults, setResumeDefaults] = useState<InterviewDefaults | null>(null);
  const [resumeFileName, setResumeFileName] = useState("");
  const [parsingResume, setParsingResume] = useState(false);
  const [resumeError, setResumeError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredRoles = jobRoles.filter((r) =>
    r.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // What this interview will be tailored to, from the candidate's own earlier interviews (best effort).
  const [plan, setPlan] = useState<Personalization | null>(null);
  useEffect(() => {
    if (!interviewType) return;
    let cancelled = false;
    setPlan(null);
    getPersonalization(interviewType)
      .then((r) => {
        if (!cancelled && r?.success) setPlan(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [interviewType]);

  const isResumeInterview = interviewType === "Resume";
  const canStart = isResumeInterview
    ? !!resume && !!resumeDefaults && !parsingResume
    : !!(jobRole && experienceLevel && interviewType && difficulty);

  const clearResume = () => {
    setResume(null);
    setResumeDefaults(null);
    setResumeFileName("");
    setResumeError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleResumeFile = async (file: File | undefined) => {
    if (!file) return;
    setResumeError("");

    if (file.type !== "application/pdf") {
      setResumeError("Please upload your resume as a PDF.");
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setResumeError("The PDF is larger than 5 MB. Please upload a smaller file.");
      return;
    }

    setParsingResume(true);
    setResume(null);
    setResumeDefaults(null);
    setResumeFileName(file.name);
    try {
      const formData = new FormData();
      formData.append("resume", file);
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND_URL}/api/v1/resume/parse`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Could not read this resume. Try a text-based PDF.");
      }

      const parsed = json.data.resume;
      const profile: ResumeProfile = {
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        projects: (Array.isArray(parsed.projects) ? parsed.projects : []).map((p: any) => ({
          name: p?.name || "",
          description: p?.description || "",
          technologies: Array.isArray(p?.technologies) ? p.technologies : [],
        })),
      };
      if (profile.skills.length === 0 && profile.projects.every((p) => !p.name)) {
        throw new Error(
          "No skills or projects were found in this resume. Make sure it has Skills and Projects sections."
        );
      }
      setResumeDefaults(deriveInterviewDefaults(Array.isArray(parsed.experience) ? parsed.experience : []));
      setResume(profile);
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : "Could not read this resume.");
      setResumeFileName("");
    } finally {
      setParsingResume(false);
    }
  };

  const handleStart = () => {
    if (!canStart) return;
    if (isResumeInterview && resume && resumeDefaults) {
      navigate("/mock-interview/room", {
        state: { ...resumeDefaults, interviewType, totalQuestions, resume },
      });
      return;
    }
    navigate("/mock-interview/room", {
      state: { jobRole, experienceLevel, interviewType, difficulty, totalQuestions },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="text-center mb-10">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent"
          >
            AI Mock Interview
          </motion.h1>
          <p className="text-gray-400 mt-3 text-lg">
            Practice with AI-powered interviews. Get real-time feedback and detailed reports.
          </p>
        </div>

        <div className="grid gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
          >
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Interview Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {interviewTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setInterviewType(type.value)}
                  className={`p-4 rounded-xl text-left transition-all ${
                    interviewType === type.value
                      ? "bg-violet-500/20 border border-violet-500/50"
                      : "bg-gray-700/50 border border-gray-600 hover:border-gray-500"
                  }`}
                >
                  <span className="text-2xl">{type.icon}</span>
                  <p className={`font-semibold mt-1 ${
                    interviewType === type.value ? "text-violet-400" : "text-gray-200"
                  }`}>
                    {type.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{type.desc}</p>
                </button>
              ))}
            </div>

            {plan && (plan.message || plan.suggestions.length > 0) && (
              <div className="mt-5">
                <NextInterviewPlan plan={plan} title="Personalised for you" compact />
              </div>
            )}

            {isResumeInterview && (
              <div className="mt-5 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4">
                <p className="text-sm font-medium text-gray-200 mb-1">Upload your resume</p>
                <p className="text-xs text-gray-400 mb-3">
                  We read your projects and skills, then ask about them: why you chose your stack, the hardest problem you
                  solved, how it would scale, and more. The PDF itself is not stored; only the skills and projects found in it are
                  saved with this interview.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => handleResumeFile(e.target.files?.[0])}
                />

                {!resume && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parsingResume}
                    className="w-full rounded-xl border-2 border-dashed border-gray-600 hover:border-violet-500/60 px-4 py-6 text-sm text-gray-300 transition-colors disabled:opacity-60"
                  >
                    {parsingResume ? `Reading ${resumeFileName}…` : "Click to choose a PDF resume (max 5 MB)"}
                  </button>
                )}

                {resume && (
                  <div className="rounded-xl bg-gray-700/40 border border-gray-600 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-emerald-400 truncate">✓ {resumeFileName}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Found {resume.skills.length} skill{resume.skills.length === 1 ? "" : "s"} and{" "}
                          {resume.projects.filter((p) => p.name).length} project
                          {resume.projects.filter((p) => p.name).length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={clearResume}
                        className="text-xs text-gray-400 hover:text-white underline shrink-0"
                      >
                        Change
                      </button>
                    </div>

                    {resume.projects.some((p) => p.name) && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {resume.projects
                          .filter((p) => p.name)
                          .slice(0, 5)
                          .map((p) => (
                            <span key={p.name} className="text-[11px] px-2 py-1 rounded-full bg-violet-500/15 text-violet-300">
                              {p.name}
                            </span>
                          ))}
                      </div>
                    )}
                    {resume.projects.every((p) => !p.name) && (
                      <p className="mt-3 text-xs text-amber-300">
                        No projects were detected, so all questions will be about your listed skills.
                      </p>
                    )}
                  </div>
                )}

                {resumeError && <p className="mt-3 text-xs text-red-400">{resumeError}</p>}
              </div>
            )}
          </motion.div>

          {/* A resume-based interview works out role, level and difficulty from the
              resume itself, so these are only asked for the other interview types. */}
          {!isResumeInterview && (
            <>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
              >
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Job Role
                </label>
                <input
                  type="text"
                  placeholder="Search or type a role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors mb-3"
                />
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {filteredRoles.map((role) => (
                    <button
                      key={role}
                      onClick={() => { setJobRole(role); setSearchTerm(""); }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        jobRole === role
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50"
                          : "bg-gray-700/50 text-gray-300 border border-gray-600 hover:border-gray-500"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
              >
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Experience Level
                </label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {experienceLevels.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setExperienceLevel(level.value)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        experienceLevel === level.value
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/50"
                          : "bg-gray-700/50 text-gray-300 border border-gray-600 hover:border-gray-500"
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
              >
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Difficulty Level
                </label>
                <div className="flex gap-3">
                  {difficulties.map((d) => (
                    <button
                      key={d.value}
                      onClick={() => setDifficulty(d.value)}
                      className={`flex-1 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                        difficulty === d.value
                          ? `bg-${d.color}-500/20 text-${d.color}-400 border border-${d.color}-500/50`
                          : "bg-gray-700/50 text-gray-300 border border-gray-600 hover:border-gray-500"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700"
          >
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Number of Questions: <span className="text-emerald-400 font-bold">{totalQuestions}</span>
            </label>
            <input
              type="range"
              min={3}
              max={15}
              value={totalQuestions}
              onChange={(e) => setTotalQuestions(Number(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>3</span>
              <span>15</span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center"
          >
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={`px-10 py-4 rounded-2xl text-lg font-bold transition-all ${
                canStart
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:shadow-lg hover:shadow-emerald-500/25 active:scale-95"
                  : "bg-gray-700 text-gray-500 cursor-not-allowed"
              }`}
            >
              {canStart
                ? "Start Interview →"
                : isResumeInterview
                ? "Upload Your Resume"
                : "Complete All Fields"}
            </button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
