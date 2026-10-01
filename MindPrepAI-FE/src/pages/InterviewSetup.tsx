import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../config/config";
import type { ResumeProfile } from "../hooks/useInterview";
import { getPersonalization } from "../services/mockInterviewApi";
import type { Personalization } from "../types/mockFeedback";
import { NextInterviewPlan } from "../components/mock-interview/feedback/NextInterviewPlan";
import { Chip, Panel, Segmented } from "../components/module/ModuleKit";
import { selectCls } from "../components/module/styles";
import { FloatingCard } from "../components/3d/FloatingCard";

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
  { value: "Technical", label: "Technical", glyph: "</>", desc: "Focus on technical skills and problem-solving" },
  { value: "HR", label: "HR", glyph: "@hr", desc: "Behavioral and cultural fit assessment" },
  { value: "Behavioral", label: "Behavioral", glyph: "STAR", desc: "Soft skills and situational responses" },
  { value: "Resume", label: "Resume-Based", glyph: "cv.pdf", desc: "Questions on your own projects and skills, from your resume" },
];

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

const difficulties = [
  { value: "Easy", label: "Easy", hint: "Fundamentals" },
  { value: "Medium", label: "Medium", hint: "Typical campus round" },
  { value: "Hard", label: "Hard", hint: "Deep follow-ups" },
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

  // Numbered steps; a resume interview skips role/level/difficulty.
  let step = 0;
  const nextStep = () => String(++step).padStart(2, "0");
  const config: Record<string, string | number> = isResumeInterview
    ? { type: interviewType, resume: resume ? resumeFileName : "(not uploaded)", questions: totalQuestions }
    : {
        type: interviewType || "?",
        role: jobRole || "?",
        level: experienceLevel || "?",
        difficulty: difficulty || "?",
        questions: totalQuestions,
      };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <p className="font-mono text-xs text-accent-fg">// interview.configure()</p>
        <h1 className="mt-1 font-poppins text-3xl font-bold text-fg tracking-tight">Set up your mock interview</h1>
        <p className="text-muted mt-1.5 text-sm">Pick the format and we&apos;ll tailor the questions. You&apos;ll answer out loud while proctoring runs on your webcam.</p>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-6 items-start">
        <div className="space-y-5">
          <Panel kicker={`${nextStep()} // interview.type`} title="Interview type">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {interviewTypes.map((type) => {
                const active = interviewType === type.value;
                return (
                  <FloatingCard key={type.value} intensity={5}>
                    <button
                      onClick={() => setInterviewType(type.value)}
                      aria-pressed={active}
                      className={`w-full h-full p-4 rounded-xl text-left border transition-colors ${
                        active ? "bg-accent-soft border-accent/40" : "bg-surface-2/60 border-line hover:border-accent/40"
                      }`}
                    >
                      <span className={`font-mono text-sm font-semibold ${active ? "text-accent-fg" : "text-subtle"}`}>{type.glyph}</span>
                      <span className={`block font-semibold mt-1 ${active ? "text-accent-fg" : "text-fg"}`}>{type.label}</span>
                      <span className="block text-xs text-muted mt-1">{type.desc}</span>
                    </button>
                  </FloatingCard>
                );
              })}
            </div>

            {plan && (plan.message || plan.suggestions.length > 0) && (
              <div className="mt-5">
                <NextInterviewPlan plan={plan} title="Personalised for you" compact />
              </div>
            )}

            {isResumeInterview && (
              <div className="mt-5 rounded-xl border border-accent/30 bg-accent-soft/40 p-4">
                <p className="text-sm font-medium text-fg mb-1">Upload your resume</p>
                <p className="text-xs text-muted mb-3">
                  We read your projects and skills, then ask about them: why you chose your stack, the hardest problem you solved, how it
                  would scale, and more. The PDF itself is not stored; only the skills and projects found in it are saved with this
                  interview.
                </p>

                <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => handleResumeFile(e.target.files?.[0])} />

                {!resume && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={parsingResume}
                    className="w-full rounded-xl border-2 border-dashed border-line-strong hover:border-accent/60 px-4 py-6 text-sm text-fg-2 transition-colors disabled:opacity-60"
                  >
                    {parsingResume ? `Reading ${resumeFileName}…` : "Click to choose a PDF resume (max 5 MB)"}
                  </button>
                )}

                {resume && (
                  <div className="rounded-xl bg-surface border border-line p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 truncate">✓ {resumeFileName}</p>
                        <p className="text-xs text-muted mt-1">
                          Found {resume.skills.length} skill{resume.skills.length === 1 ? "" : "s"} and {resume.projects.filter((p) => p.name).length} project
                          {resume.projects.filter((p) => p.name).length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <button type="button" onClick={clearResume} className="text-xs text-muted hover:text-fg underline shrink-0">
                        Change
                      </button>
                    </div>
                    {resume.projects.some((p) => p.name) && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {resume.projects
                          .filter((p) => p.name)
                          .slice(0, 5)
                          .map((p) => (
                            <span key={p.name} className="text-[11px] px-2 py-1 rounded-md bg-accent-soft text-accent-fg">
                              {p.name}
                            </span>
                          ))}
                      </div>
                    )}
                    {resume.projects.every((p) => !p.name) && (
                      <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">No projects were detected, so all questions will be about your listed skills.</p>
                    )}
                  </div>
                )}

                {resumeError && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{resumeError}</p>}
              </div>
            )}
          </Panel>

          {/* A resume-based interview works out role, level and difficulty from the
              resume itself, so these are only asked for the other interview types. */}
          {!isResumeInterview && (
            <>
              <Panel kicker={`${nextStep()} // job.role`} title="Job role">
                <input
                  type="text"
                  placeholder="Search or type a role…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`${selectCls} mb-3`}
                />
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                  {filteredRoles.map((role) => (
                    <Chip
                      key={role}
                      active={jobRole === role}
                      onClick={() => {
                        setJobRole(role);
                        setSearchTerm("");
                      }}
                    >
                      {role}
                    </Chip>
                  ))}
                </div>
              </Panel>

              <Panel kicker={`${nextStep()} // experience.level`} title="Experience level">
                <div className="flex flex-wrap gap-2">
                  {experienceLevels.map((level) => (
                    <Chip key={level.value} active={experienceLevel === level.value} onClick={() => setExperienceLevel(level.value)}>
                      {level.label}
                    </Chip>
                  ))}
                </div>
              </Panel>

              <Panel kicker={`${nextStep()} // difficulty`} title="Difficulty">
                <Segmented
                  value={difficulty as "Easy" | "Medium" | "Hard"}
                  onChange={setDifficulty}
                  options={difficulties.map((d) => ({ value: d.value as "Easy" | "Medium" | "Hard", label: d.label, hint: d.hint }))}
                />
              </Panel>
            </>
          )}

          <Panel kicker={`${nextStep()} // questions.count`} title="Number of questions">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={3}
                max={15}
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(Number(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-surface-2 accent-[var(--accent)]"
                aria-label="Number of questions"
              />
              <span className="w-12 text-center font-mono text-lg font-semibold text-accent-fg tabular-nums">{totalQuestions}</span>
            </div>
            <p className="font-mono text-[11px] text-subtle mt-2">// about {Math.round(totalQuestions * 2.5)} minutes</p>
          </Panel>
        </div>

        {/* Live summary of the session, as a config object, with the start button. */}
        <aside className="lg:sticky lg:top-24 rounded-2xl bg-surface border border-line shadow-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 h-10 border-b border-line bg-surface-2/70">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="ml-2 font-mono text-xs text-subtle">interview.config.json</span>
          </div>
          <pre className="px-5 py-4 font-mono text-[13px] leading-relaxed text-fg-2 overflow-x-auto">
            <span className="text-subtle">{"{"}</span>
            {"\n"}
            {Object.entries(config).map(([k, v], i, arr) => (
              <span key={k}>
                {"  "}
                <span className="text-accent-fg">&quot;{k}&quot;</span>
                <span className="text-subtle">: </span>
                <span className={v === "?" || v === "(not uploaded)" ? "text-amber-700 dark:text-amber-400" : typeof v === "number" ? "text-sky-700 dark:text-sky-400" : "text-emerald-700 dark:text-emerald-400"}>
                  {typeof v === "number" ? v : `"${v}"`}
                </span>
                {i < arr.length - 1 ? <span className="text-subtle">,</span> : null}
                {"\n"}
              </span>
            ))}
            <span className="text-subtle">{"}"}</span>
          </pre>
          <div className="px-5 pb-5">
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                canStart ? "bg-accent hover:bg-accent-hover text-white" : "bg-surface-2 text-subtle border border-line cursor-not-allowed"
              }`}
            >
              {canStart ? "Start interview →" : isResumeInterview ? "Upload your resume" : "Fill in the highlighted fields"}
            </button>
            <p className="mt-3 text-[11px] text-muted leading-relaxed">You&apos;ll be asked to allow camera and microphone, and the interview runs in full screen.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
