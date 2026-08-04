import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { BACKEND_URL } from "../config/config";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import toast from "react-hot-toast";
import type {
  ResumeData,
  TemplateType,
  Education,
  Experience,
  Project,
} from "../types/resume";
import { ResumePreview } from "../components/resume-builder/ResumePreview";

/* ───────────────────────── helpers ───────────────────────── */
const uid = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
};

const STEPS = [
  { key: "personal", label: "Personal", icon: "👤" },
  { key: "education", label: "Education", icon: "🎓" },
  { key: "experience", label: "Experience", icon: "💼" },
  { key: "skills", label: "Skills", icon: "⚡" },
  { key: "projects", label: "Projects", icon: "🚀" },
  { key: "summary", label: "Summary", icon: "📝" },
] as const;

const EMPTY_RESUME: ResumeData = {
  personalInfo: {
    fullName: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    portfolio: "",
  },
  summary: "",
  education: [],
  experience: [],
  skills: [],
  projects: [],
};

/* ───────────────────────── component ───────────────────────── */
export function ResumeBuilder() {
  const location = useLocation();
  const [data, setData] = useState<ResumeData>(
    location.state?.importedData || { ...EMPTY_RESUME }
  );
  const [template, setTemplate] = useState<TemplateType>("modern");
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(location.state?.atsAnalysis || null);
  const [showEvaluation, setShowEvaluation] = useState(!!location.state?.atsAnalysis);
  const [downloading, setDownloading] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [activeJobRole, setActiveJobRole] = useState("software engineer");

  // Auto-fill from route state if we navigated back to this page with new state
  useEffect(() => {
    if (location.state?.importedData) {
      const imported = location.state.importedData;
      setData(imported);
      if (!location.state?.atsAnalysis) {
        evaluateData(imported);
      }
    }
  }, [location.state?.importedData]);

  /* ── updaters ── */
  const updatePersonal = useCallback(
    (field: string, value: string) =>
      setData((d) => ({
        ...d,
        personalInfo: { ...d.personalInfo, [field]: value },
      })),
    []
  );

  const addEducation = () =>
    setData((d) => ({
      ...d,
      education: [
        ...d.education,
        { id: uid(), institution: "", degree: "", field: "", startDate: "", endDate: "", gpa: "" },
      ],
    }));

  const updateEducation = (id: string, field: keyof Education, value: string) =>
    setData((d) => ({
      ...d,
      education: d.education.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    }));

  const removeEducation = (id: string) =>
    setData((d) => ({ ...d, education: d.education.filter((e) => e.id !== id) }));

  const addExperience = () =>
    setData((d) => ({
      ...d,
      experience: [
        ...d.experience,
        { id: uid(), company: "", role: "", startDate: "", endDate: "", current: false, bullets: [""] },
      ],
    }));

  const updateExperience = (id: string, field: keyof Experience, value: any) =>
    setData((d) => ({
      ...d,
      experience: d.experience.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    }));

  const removeExperience = (id: string) =>
    setData((d) => ({ ...d, experience: d.experience.filter((e) => e.id !== id) }));

  const updateBullet = (expId: string, idx: number, value: string) =>
    setData((d) => ({
      ...d,
      experience: d.experience.map((e) =>
        e.id === expId ? { ...e, bullets: e.bullets.map((b, i) => (i === idx ? value : b)) } : e
      ),
    }));

  const addBullet = (expId: string) =>
    setData((d) => ({
      ...d,
      experience: d.experience.map((e) =>
        e.id === expId ? { ...e, bullets: [...e.bullets, ""] } : e
      ),
    }));

  const removeBullet = (expId: string, idx: number) =>
    setData((d) => ({
      ...d,
      experience: d.experience.map((e) =>
        e.id === expId ? { ...e, bullets: e.bullets.filter((_, i) => i !== idx) } : e
      ),
    }));

  const addProject = () =>
    setData((d) => ({
      ...d,
      projects: [
        ...d.projects,
        { id: uid(), name: "", description: "", technologies: [], link: "" },
      ],
    }));

  const updateProject = (id: string, field: keyof Project, value: any) =>
    setData((d) => ({
      ...d,
      projects: d.projects.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    }));

  const removeProject = (id: string) =>
    setData((d) => ({ ...d, projects: d.projects.filter((p) => p.id !== id) }));

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !data.skills.includes(s)) {
      setData((d) => ({ ...d, skills: [...d.skills, s] }));
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) =>
    setData((d) => ({ ...d, skills: d.skills.filter((s) => s !== skill) }));

  /* ── AI helpers ── */
  const aiEnhance = async (type: "summary" | "bullet", context: any) => {
    setAiLoading(type);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND_URL}/api/v1/resume/enhance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, context }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      return json.data.enhanced_text as string;
    } catch {
      return null;
    } finally {
      setAiLoading(null);
    }
  };

  const generateSummary = async () => {
    const text = await aiEnhance("summary", {
      name: data.personalInfo.fullName,
      role: data.experience[0]?.role || "Software Engineer",
      skills: data.skills,
      experience_years: data.experience.length,
      education: data.education[0]?.degree || "",
    });
    if (text) setData((d) => ({ ...d, summary: text }));
  };

  const enhanceBullet = async (expId: string, idx: number) => {
    const exp = data.experience.find((e) => e.id === expId);
    if (!exp) return;
    const text = await aiEnhance("bullet", {
      role: exp.role,
      company: exp.company,
      original_text: exp.bullets[idx],
    });
    if (text) updateBullet(expId, idx, text);
  };

  /* ── Resume import ── */
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please select a valid PDF file.");
      if (importRef.current) importRef.current.value = "";
      return;
    }

    setImporting(true);
    const toastId = toast.loading("Uploading and parsing your resume...");

    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("resume", file);

      const res = await fetch(`${BACKEND_URL}/api/v1/resume/parse`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      // Check if the server responded at all
      if (!res.ok && res.status === 0) {
        throw new Error("Cannot reach the server. Make sure the backend is running on port 3000.");
      }

      let json: any;
      try {
        json = await res.json();
      } catch {
        throw new Error(`Server returned status ${res.status}. Backend may not be running.`);
      }

      if (!json.success) {
        throw new Error(json.message || `Request failed with status ${res.status}`);
      }

      const imported = json.data.resume;
      setData(imported);
      toast.success("✅ Resume imported! Review and edit the fields.", { id: toastId, duration: 4000 });
      evaluateData(imported);
    } catch (err: any) {
      const msg =
        err?.message?.includes("fetch") || err?.message?.includes("Failed to fetch")
          ? `Cannot connect to backend. Is the server running on ${BACKEND_URL}?`
          : err?.message || "Import failed. Please try again.";
      toast.error(msg, { id: toastId, duration: 6000 });
      console.error("[Resume Import Error]", err);
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = "";
    }
  };

  const evaluateData = async (resumeData: ResumeData) => {
    setEvaluating(true);
    setShowEvaluation(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND_URL}/api/v1/resume/evaluate-builder`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ resumeData }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setEvaluation(json.data.analysis);
      const topRole =
        json.data.analysis?.top_roles?.[0] ||
        "software engineer";
      fetchJobs(topRole);
    } catch (err) {
      setEvaluation({ error: "Failed to evaluate ATS score." });
    } finally {
      setEvaluating(false);
    }
  };

  const checkAtsScore = () => evaluateData(data);

  const fetchJobs = async (role: string) => {
    setJobsLoading(true);
    setJobsError(null);
    setActiveJobRole(role);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${BACKEND_URL}/api/v1/jobs/search?what=${encodeURIComponent(role)}&where=${encodeURIComponent("Bengaluru")}&limit=8`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "Failed to fetch jobs");
      setJobs(json.data.jobs || []);
    } catch (err: any) {
      setJobs([]);
      setJobsError(err?.message || "Could not load live jobs.");
    } finally {
      setJobsLoading(false);
    }
  };

  /* ── PDF export / download ── */
  const downloadPDF = async () => {
    const element = document.getElementById("resume-preview");
    if (!element) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgW = canvas.width;
      const imgH = canvas.height;
      const ratio = Math.min(pdfW / imgW, pdfH / imgH);
      const finalW = imgW * ratio;
      const finalH = imgH * ratio;
      const xOffset = (pdfW - finalW) / 2;
      pdf.addImage(imgData, "PNG", xOffset, 0, finalW, finalH);
      const fileName = (data.personalInfo.fullName || "resume").replace(/\s+/g, "_") + "_resume.pdf";
      pdf.save(fileName);
    } catch (err) {
      console.error("PDF download failed:", err);
      alert("Could not generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  /* ── input style ── */
  const inputClass =
    "w-full bg-gray-800/70 border border-gray-600/50 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all text-sm";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider";
  const btnPrimary =
    "px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all";
  const btnSecondary =
    "px-4 py-2 rounded-xl bg-gray-700/50 text-gray-300 text-sm font-medium hover:bg-gray-700 border border-gray-600/50 transition-all";
  const btnDanger =
    "p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-all";
  const cardClass =
    "bg-gray-800/40 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-5";

  /* ───────────────────── render steps ───────────────────── */
  const renderStep = () => {
    switch (step) {
      /* ── Personal Info ── */
      case 0:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(
                [
                  ["fullName", "Full Name", "John Doe"],
                  ["email", "Email", "john@example.com"],
                  ["phone", "Phone", "+1 234 567 8900"],
                  ["location", "Location", "San Francisco, CA"],
                  ["linkedin", "LinkedIn URL", "linkedin.com/in/johndoe"],
                  ["portfolio", "Portfolio URL", "johndoe.dev"],
                ] as const
              ).map(([field, label, ph]) => (
                <div key={field}>
                  <label className={labelClass}>{label}</label>
                  <input
                    className={inputClass}
                    placeholder={ph}
                    value={(data.personalInfo as any)[field]}
                    onChange={(e) => updatePersonal(field, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        );

      /* ── Education ── */
      case 1:
        return (
          <div className="space-y-4">
            {data.education.map((edu) => (
              <motion.div
                key={edu.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cardClass}
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-sm font-semibold text-white">
                    {edu.institution || "New Education"}
                  </h4>
                  <button onClick={() => removeEducation(edu.id)} className={btnDanger}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Institution</label>
                    <input className={inputClass} placeholder="MIT" value={edu.institution} onChange={(e) => updateEducation(edu.id, "institution", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Degree</label>
                    <input className={inputClass} placeholder="B.Tech" value={edu.degree} onChange={(e) => updateEducation(edu.id, "degree", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Field of Study</label>
                    <input className={inputClass} placeholder="Computer Science" value={edu.field} onChange={(e) => updateEducation(edu.id, "field", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>GPA</label>
                    <input className={inputClass} placeholder="3.8/4.0" value={edu.gpa} onChange={(e) => updateEducation(edu.id, "gpa", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Start Date</label>
                    <input className={inputClass} placeholder="Aug 2020" value={edu.startDate} onChange={(e) => updateEducation(edu.id, "startDate", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>End Date</label>
                    <input className={inputClass} placeholder="May 2024" value={edu.endDate} onChange={(e) => updateEducation(edu.id, "endDate", e.target.value)} />
                  </div>
                </div>
              </motion.div>
            ))}
            <button onClick={addEducation} className={`${btnSecondary} w-full flex items-center justify-center gap-2`}>
              <span>+</span> Add Education
            </button>
          </div>
        );

      /* ── Experience ── */
      case 2:
        return (
          <div className="space-y-4">
            {data.experience.map((exp) => (
              <motion.div
                key={exp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cardClass}
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-sm font-semibold text-white">
                    {exp.role || "New Experience"}
                  </h4>
                  <button onClick={() => removeExperience(exp.id)} className={btnDanger}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className={labelClass}>Company</label>
                    <input className={inputClass} placeholder="Google" value={exp.company} onChange={(e) => updateExperience(exp.id, "company", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Role</label>
                    <input className={inputClass} placeholder="Software Engineer" value={exp.role} onChange={(e) => updateExperience(exp.id, "role", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Start Date</label>
                    <input className={inputClass} placeholder="Jan 2023" value={exp.startDate} onChange={(e) => updateExperience(exp.id, "startDate", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>End Date</label>
                    <input
                      className={inputClass}
                      placeholder={exp.current ? "Present" : "Dec 2024"}
                      value={exp.current ? "Present" : exp.endDate}
                      disabled={exp.current}
                      onChange={(e) => updateExperience(exp.id, "endDate", e.target.value)}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-400 mb-4 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exp.current}
                    onChange={(e) => updateExperience(exp.id, "current", e.target.checked)}
                    className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500/30"
                  />
                  Currently working here
                </label>
                <div className="space-y-2">
                  <label className={labelClass}>Bullet Points</label>
                  {exp.bullets.map((b, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <span className="text-gray-500 mt-3 text-sm">•</span>
                      <textarea
                        className={`${inputClass} min-h-[42px] resize-none`}
                        rows={1}
                        placeholder="Describe your responsibility or achievement..."
                        value={b}
                        onChange={(e) => updateBullet(exp.id, idx, e.target.value)}
                      />
                      <button
                        onClick={() => enhanceBullet(exp.id, idx)}
                        disabled={!b.trim() || aiLoading === "bullet"}
                        className="mt-1 p-2 rounded-lg text-purple-400 hover:bg-purple-500/10 transition-all disabled:opacity-30 flex-shrink-0"
                        title="AI Enhance"
                      >
                        {aiLoading === "bullet" ? (
                          <span className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin block" />
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        )}
                      </button>
                      {exp.bullets.length > 1 && (
                        <button onClick={() => removeBullet(exp.id, idx)} className={`${btnDanger} mt-1 flex-shrink-0`}>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => addBullet(exp.id)} className="text-xs text-blue-400 hover:text-blue-300 transition-all mt-1">
                    + Add bullet point
                  </button>
                </div>
              </motion.div>
            ))}
            <button onClick={addExperience} className={`${btnSecondary} w-full flex items-center justify-center gap-2`}>
              <span>+</span> Add Experience
            </button>
          </div>
        );

      /* ── Skills ── */
      case 3:
        return (
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                className={inputClass}
                placeholder="Type a skill and press Enter..."
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill();
                  }
                }}
              />
              <button onClick={addSkill} className={btnPrimary}>
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence>
                {data.skills.map((s) => (
                  <motion.span
                    key={s}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-400 rounded-full text-sm border border-blue-500/20"
                  >
                    {s}
                    <button onClick={() => removeSkill(s)} className="hover:text-red-400 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
            {data.skills.length === 0 && (
              <p className="text-gray-500 text-sm text-center py-6">No skills added yet. Start typing above.</p>
            )}
            <div className="bg-gray-800/30 rounded-xl p-3 border border-gray-700/40">
              <p className="text-xs text-gray-500">
                💡 <span className="text-gray-400">Tip:</span> Add skills relevant to your target role. Include both technical skills (React, Python) and soft skills (Leadership, Communication).
              </p>
            </div>
          </div>
        );

      /* ── Projects ── */
      case 4:
        return (
          <div className="space-y-4">
            {data.projects.map((proj) => (
              <motion.div
                key={proj.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cardClass}
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className="text-sm font-semibold text-white">
                    {proj.name || "New Project"}
                  </h4>
                  <button onClick={() => removeProject(proj.id)} className={btnDanger}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Project Name</label>
                    <input className={inputClass} placeholder="MindPrep AI" value={proj.name} onChange={(e) => updateProject(proj.id, "name", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelClass}>Link</label>
                    <input className={inputClass} placeholder="github.com/..." value={proj.link} onChange={(e) => updateProject(proj.id, "link", e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Description</label>
                    <textarea
                      className={`${inputClass} resize-none`}
                      rows={2}
                      placeholder="Brief description of the project and your contributions..."
                      value={proj.description}
                      onChange={(e) => updateProject(proj.id, "description", e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Technologies (comma-separated)</label>
                    <input
                      className={inputClass}
                      placeholder="React, Node.js, MongoDB"
                      value={proj.technologies.join(", ")}
                      onChange={(e) =>
                        updateProject(
                          proj.id,
                          "technologies",
                          e.target.value.split(",").map((t) => t.trim()).filter(Boolean)
                        )
                      }
                    />
                  </div>
                </div>
              </motion.div>
            ))}
            <button onClick={addProject} className={`${btnSecondary} w-full flex items-center justify-center gap-2`}>
              <span>+</span> Add Project
            </button>
          </div>
        );

      /* ── Summary ── */
      case 5:
        return (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelClass}>Professional Summary</label>
                <button
                  onClick={generateSummary}
                  disabled={aiLoading === "summary"}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-500/15 text-purple-400 text-xs font-medium border border-purple-500/20 hover:bg-purple-500/25 transition-all disabled:opacity-50"
                >
                  {aiLoading === "summary" ? (
                    <>
                      <span className="w-3 h-3 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      AI Generate
                    </>
                  )}
                </button>
              </div>
              <textarea
                className={`${inputClass} resize-none`}
                rows={5}
                placeholder="A brief professional summary highlighting your experience, skills, and career objectives..."
                value={data.summary}
                onChange={(e) => setData((d) => ({ ...d, summary: e.target.value }))}
              />
            </div>
            <div className="bg-gray-800/30 rounded-xl p-3 border border-gray-700/40">
              <p className="text-xs text-gray-500">
                💡 <span className="text-gray-400">Tip:</span> Click "AI Generate" to auto-create a summary from the info you've provided. You can edit it afterwards.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  /* ───────────────────────── main JSX ───────────────────────── */
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800">
      {/* ─── Top Bar ─── */}
      <div className="border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-sm print:hidden">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Resume Builder
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">Build your professional resume with AI assistance</p>
          </div>
          <div className="flex items-center gap-3">
            <input type="file" accept=".pdf" className="hidden" ref={importRef} onChange={handleImport} />
            <button
              onClick={() => importRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-xs font-medium border border-gray-700 hover:bg-gray-700 transition-all disabled:opacity-50"
            >
              {importing ? (
                <>
                  <span className="w-3 h-3 border-2 border-gray-400/30 border-t-gray-300 rounded-full animate-spin" />
                  Importing...
                </>
              ) : "📥 Import PDF"}
            </button>
            <button
              onClick={checkAtsScore}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
            >
              🎯 Check ATS Score
            </button>
            {/* Template Selector */}
            <div className="hidden sm:flex items-center gap-1 bg-gray-800/60 rounded-xl p-1 border border-gray-700/50">
              {(["modern", "classic", "minimal"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTemplate(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                    template === t
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            {/* Mobile preview toggle */}
            <button
              onClick={() => setShowPreviewMobile(!showPreviewMobile)}
              className="lg:hidden px-3 py-2 rounded-xl bg-gray-800/60 text-gray-300 text-xs font-medium border border-gray-700/50 hover:bg-gray-700/60 transition-all"
            >
              {showPreviewMobile ? "✏️ Edit" : "👁️ Preview"}
            </button>
            <button
              onClick={downloadPDF}
              disabled={downloading}
              className={`${btnPrimary} flex items-center gap-2 disabled:opacity-60`}
            >
              {downloading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="max-w-[1600px] mx-auto flex print:block">
        {/* ── Left: Form Panel ── */}
        <div className={`w-full lg:w-[480px] xl:w-[520px] flex-shrink-0 border-r border-gray-700/30 print:hidden ${showPreviewMobile ? "hidden lg:block" : ""}`}>
          <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 130px)" }}>
            {/* Step indicator */}
            <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
              {STEPS.map((s, idx) => (
                <button
                  key={s.key}
                  onClick={() => setStep(idx)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    step === idx
                      ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                      : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50 border border-transparent"
                  }`}
                >
                  <span>{s.icon}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              ))}
            </div>

            {/* Step title */}
            <div className="mb-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="text-xl">{STEPS[step].icon}</span>
                {STEPS[step].label}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                {step === 0 && "Add your contact details and personal information"}
                {step === 1 && "List your educational qualifications"}
                {step === 2 && "Describe your work experience and achievements"}
                {step === 3 && "Highlight your technical and soft skills"}
                {step === 4 && "Showcase your personal or professional projects"}
                {step === 5 && "Write or generate a professional summary"}
              </p>
            </div>

            {/* Step content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex justify-between mt-6 pt-4 border-t border-gray-700/30">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className={`${btnSecondary} disabled:opacity-30`}
              >
                ← Previous
              </button>
              <button
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                disabled={step === STEPS.length - 1}
                className={`${btnPrimary} disabled:opacity-30`}
              >
                Next →
              </button>
            </div>

            {/* Mobile Template Selector */}
            <div className="sm:hidden mt-4">
              <label className={labelClass}>Template</label>
              <div className="flex items-center gap-1 bg-gray-800/60 rounded-xl p-1 border border-gray-700/50">
                {(["modern", "classic", "minimal"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTemplate(t)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                      template === t
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Live Preview ── */}
        <div className={`flex-1 bg-gray-800/20 print:bg-white ${!showPreviewMobile && "hidden lg:block"} print:block`}>
          <div className="p-6 print:p-0 overflow-y-auto" style={{ maxHeight: "calc(100vh - 130px)" }}>
            <div className="mx-auto print:mx-0 print:shadow-none" style={{ maxWidth: "800px" }}>
              <div
                className="bg-white rounded-lg shadow-2xl shadow-black/30 print:shadow-none print:rounded-none"
                style={{ aspectRatio: "8.5/11", overflow: "hidden" }}
              >
                <div className="h-full overflow-y-auto">
                  <ResumePreview data={data} template={template} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ATS Evaluation Modal ── */}
      <AnimatePresence>
        {showEvaluation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:hidden"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="flex justify-between items-center p-5 border-b border-gray-800">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>🎯</span> ATS Evaluation
                </h3>
                <button onClick={() => setShowEvaluation(false)} className="text-gray-500 hover:text-white">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                {evaluating ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4" />
                    <p>Evaluating resume for ATS compliance...</p>
                  </div>
                ) : evaluation?.error ? (
                  <div className="text-red-400 text-center py-8">{evaluation.error}</div>
                ) : evaluation ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                        evaluation.ats_score >= 80 ? "bg-emerald-500/20 text-emerald-400" :
                        evaluation.ats_score >= 60 ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-red-500/20 text-red-400"
                      }`}>
                        {evaluation.ats_score}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-white">
                          {evaluation.ats_friendly ? "ATS Friendly ✅" : "Needs Improvement ⚠️"}
                        </h4>
                        <p className="text-sm text-gray-400">Score based on standard ATS parsing rules.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-sm font-semibold text-gray-300 uppercase mb-3">Failed Checks</h5>
                        {evaluation.ats_issues?.length > 0 ? (
                          <ul className="space-y-2">
                            {evaluation.ats_issues.map((issue: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-red-400">
                                <span className="mt-0.5">✗</span><span>{issue}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-emerald-400">Perfect! No issues found.</p>
                        )}
                      </div>
                      <div>
                        <h5 className="text-sm font-semibold text-gray-300 uppercase mb-3">Passed Checks</h5>
                        {evaluation.ats_passed_checks?.length > 0 ? (
                          <ul className="space-y-2">
                            {evaluation.ats_passed_checks.map((check: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-emerald-400">
                                <span className="mt-0.5">✓</span><span>{check}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500">None</p>
                        )}
                      </div>
                    </div>

                    {evaluation.missing_keywords?.length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-gray-300 uppercase mb-2">Missing Keywords</h5>
                        <div className="flex flex-wrap gap-2">
                          {evaluation.missing_keywords.map((kw: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-yellow-500/10 text-yellow-400 text-xs rounded border border-yellow-500/20">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {evaluation.summary && (
                      <div>
                        <h5 className="text-sm font-semibold text-gray-300 uppercase mb-2">Detailed Summary</h5>
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                          <p className="text-sm text-gray-300 leading-relaxed">{evaluation.summary}</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {evaluation.strengths?.length > 0 && (
                        <div>
                          <h5 className="text-sm font-semibold text-emerald-400 uppercase mb-2">Strengths</h5>
                          <ul className="space-y-1.5">
                            {evaluation.strengths.map((s: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                                <span className="mt-0.5 text-emerald-400">✓</span><span>{s}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {evaluation.weaknesses?.length > 0 && (
                        <div>
                          <h5 className="text-sm font-semibold text-red-400 uppercase mb-2">Weaknesses</h5>
                          <ul className="space-y-1.5">
                            {evaluation.weaknesses.map((w: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                                <span className="mt-0.5 text-red-400">✗</span><span>{w}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {evaluation.improvements?.length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-gray-300 uppercase mb-2">Recommended Improvements</h5>
                        <div className="space-y-2">
                          {evaluation.improvements.map((imp: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 bg-gray-800/40 border border-gray-700 rounded-xl p-3">
                              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded mt-0.5 flex-shrink-0 ${
                                imp.priority === "high" ? "bg-red-500/20 text-red-400" :
                                imp.priority === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                                "bg-emerald-500/20 text-emerald-400"
                              }`}>
                                {imp.priority}
                              </span>
                              <div>
                                <p className="text-xs font-semibold text-white">{imp.area}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{imp.suggestion}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-semibold text-gray-300 uppercase">
                          Live Jobs in Bengaluru
                        </h5>
                        {evaluation.top_roles?.length > 1 && (
                          <div className="flex gap-1.5">
                            {evaluation.top_roles.slice(0, 3).map((role: string, i: number) => (
                              <button
                                key={i}
                                onClick={() => fetchJobs(role)}
                                className={`px-2 py-1 text-[10px] font-medium rounded border transition-colors ${
                                  activeJobRole === role
                                    ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                                    : "bg-gray-700/40 text-gray-400 border-gray-600 hover:border-gray-500"
                                }`}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {jobsLoading ? (
                        <div className="flex items-center gap-3 text-gray-400 py-6 justify-center">
                          <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                          <p className="text-sm">Fetching live vacancies for "{activeJobRole}"...</p>
                        </div>
                      ) : jobsError ? (
                        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                          <p className="text-xs text-yellow-400">{jobsError}</p>
                          <p className="text-[10px] text-gray-500 mt-1">
                            Get a free Adzuna key at developer.adzuna.com and add it to backend .env (ADZUNA_APP_ID / ADZUNA_APP_KEY).
                          </p>
                        </div>
                      ) : jobs.length === 0 ? (
                        <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-4 text-sm text-gray-400">
                          No live vacancies found right now for "{activeJobRole}" in Bengaluru.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {jobs.map((job, i) => (
                            <a
                              key={i}
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block bg-gray-800/40 border border-gray-700 hover:border-blue-500/40 rounded-xl p-3 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-white truncate">{job.title}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">{job.company} · {job.location}</p>
                                </div>
                                <span className="text-xs font-bold text-emerald-400 flex-shrink-0">
                                  {job.salary_min}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] text-gray-500">{job.category}</span>
                                <span className="text-[10px] text-blue-400 ml-auto">Apply →</span>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
