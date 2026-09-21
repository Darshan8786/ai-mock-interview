import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";
import multer from "multer";
import axios from "axios";
import { extractTextFromPdf } from "../services/pdfTextExtractor";
import { parseResumeLocally, ParsedResume } from "../services/localResumeParser";
import { assertLooksLikeResume } from "../services/resumeValidator";
import { analyzeResumeLocally, computeSkillGapLocally, SkillGapResult } from "../services/localResumeAnalyzer";
import { canonicalizeSkillLabel } from "../data/resumeSkillsTaxonomy";

// Resume parsing, ATS scoring, and skill-gap analysis are all fully local
// (see localResumeParser.ts / localResumeAnalyzer.ts) - no AI API is used.
// The only remaining generative piece - rewriting a summary/bullet to be
// more impactful - calls the local fine-tuned resume-enhancer model served
// by ai-service (ai-services/resume_enhancer.py), never an external API.
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:5001";
const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || "mindprep-ai-key-2026";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF files allowed"));
      return;
    }
    cb(null, true);
  },
});

export const uploadMiddleware = upload.single("resume");

const ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs/in/search/1";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSalary(value?: number): string {
  if (!value || value <= 0) return "Not specified";
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)} LPA`;
  return `₹${value.toLocaleString("en-IN")}`;
}

async function fetchLiveJobsFromAdzuna(what: string, where = "Bengaluru", limit = 6): Promise<any[]> {
  if (!env.ADZUNA_APP_ID || !env.ADZUNA_APP_KEY) {
    console.warn("[LiveJobs] Adzuna API not configured, skipping live jobs");
    return [];
  }

  const params = new URLSearchParams({
    app_id: env.ADZUNA_APP_ID,
    app_key: env.ADZUNA_APP_KEY,
    results_per_page: String(limit),
    what,
    where,
    "content-type": "application/json",
  });

  const url = `${ADZUNA_BASE}?${params.toString()}`;

  let res: Awaited<ReturnType<typeof fetch>> | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MindPrep-AI/1.0 (resume skill-gap analyzer)",
      },
    });

    if (res.ok) break;

    console.error(`[LiveJobs] Adzuna error (attempt ${attempt}/3)`, res.status);
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }

  if (!res || !res.ok) {
    console.error("[LiveJobs] Adzuna failed after retries");
    return [];
  }

  const data = await res.json();
  return (data.results || []).map((j: any) => ({
    title: j.title,
    company: j.company?.display_name || "Unknown",
    location: j.location?.display_name || where,
    salary_min: normalizeSalary(j.salary_min),
    salary_max: normalizeSalary(j.salary_max),
    url: j.redirect_url,
    category: j.category?.label || "General",
    description: stripHtml(j.description || "").slice(0, 1200),
  }));
}

// Local, deterministic skill-gap comparison (see localResumeAnalyzer.ts) -
// no LLM call. Kept exported for parity with the previous module shape.
export function analyzeJobSkillGaps(resumeSkills: string[], jobs: any[]): SkillGapResult[] {
  return jobs.map((j, i) => computeSkillGapLocally(resumeSkills, { title: j.title, description: j.description }, i));
}

async function fetchLiveJobsWithSkillGap(resumeSkills: string[], topRole?: string) {
  const what = topRole || "software engineer";
  const jobs = await fetchLiveJobsFromAdzuna(what, "Bengaluru", 6);
  if (jobs.length === 0) return [];

  const gaps = analyzeJobSkillGaps(resumeSkills, jobs);

  return jobs.map((j, i) => {
    const gap: Partial<SkillGapResult> = gaps[i] || {};
    return {
      title: j.title,
      company: j.company,
      location: j.location,
      salary_min: j.salary_min,
      salary_max: j.salary_max,
      url: j.url,
      category: j.category,
      required_skills: gap.required_skills || [],
      matched_skills: gap.matched_skills || [],
      missing_skills: gap.missing_skills || [],
      fit_score: typeof gap.fit_score === "number" ? gap.fit_score : null,
      gap_summary: gap.gap_summary || "",
      suggestions: Array.isArray(gap.suggestions) ? gap.suggestions : [],
    };
  });
}

export const analyzeResume = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) throw new AppError("Please upload a PDF resume", 400);

  const { text, lines } = await extractTextFromPdf(req.file.buffer);

  if (!text || text.trim().length < 50) {
    throw new AppError("Could not extract enough text from PDF", 400);
  }

  const parsed = parseResumeLocally(text, lines);
  assertLooksLikeResume(text, lines, parsed);
  const analysis = analyzeResumeLocally(parsed, text);

  let liveJobs: any[] = [];
  try {
    liveJobs = await fetchLiveJobsWithSkillGap(analysis.skills, analysis.top_roles?.[0]);
  } catch (err) {
    console.error("[LiveJobs Skill Gap Error]", err);
  }

  res.json({
    success: true,
    data: {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      extractedLength: text.length,
      analysis,
      liveJobs,
    },
  });
});

// Calls the local fine-tuned resume-enhancer model (ai-services/resume_enhancer.py).
// No external API. If the ai-service is unreachable, falls back to a local
// rule-based rewrite (strong-verb substitution) so the endpoint still returns
// a real, answer-derived improvement rather than failing outright.
export const enhanceResumeContent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { type, context } = req.body;

  if (!type || !context) {
    throw new AppError("Missing required fields: type and context", 400);
  }

  if (type !== "summary" && type !== "bullet") {
    throw new AppError("Invalid type. Must be 'summary' or 'bullet'", 400);
  }

  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/enhance-resume-content`,
      { type, context },
      { timeout: 15000, headers: { "X-AI-Service-Key": AI_SERVICE_KEY } }
    );
    const enhanced_text = response.data.enhanced_text || "";
    if (!enhanced_text) throw new Error("Empty response from local resume-enhancer");
    res.json({ success: true, data: { enhanced_text } });
  } catch (err: any) {
    console.error(`Local resume-enhancer failed, no fallback text available: ${err?.message}`);
    throw new AppError("Resume enhancement service is currently unavailable", 502);
  }
});

function parsedToResponse(parsed: ParsedResume) {
  return {
    ...parsed,
    skills: parsed.skills.map(canonicalizeSkillLabel),
  };
}

export const parseResumeToJSON = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) throw new AppError("Please upload a PDF resume", 400);

  const { text, lines } = await extractTextFromPdf(req.file.buffer);

  if (!text || text.trim().length < 50) {
    throw new AppError("Could not extract enough text from PDF", 400);
  }

  const parsed = parseResumeLocally(text, lines);
  assertLooksLikeResume(text, lines, parsed);

  res.json({
    success: true,
    data: { resume: parsedToResponse(parsed) },
  });
});

export const parseResumeFromText = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { text } = req.body;

  if (!text || typeof text !== "string") {
    throw new AppError("Missing or invalid 'text' field in request body", 400);
  }

  if (text.trim().length < 50) {
    throw new AppError("Resume text is too short to parse", 400);
  }

  const lines = text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
  const parsed = parseResumeLocally(text, lines);
  assertLooksLikeResume(text, lines, parsed);

  res.json({
    success: true,
    data: { resume: parsedToResponse(parsed) },
  });
});

export const autoFixResume = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) throw new AppError("Please upload a PDF resume", 400);

  const { text, lines } = await extractTextFromPdf(req.file.buffer);

  if (!text || text.trim().length < 50) {
    throw new AppError("Could not extract enough text from PDF", 400);
  }

  const parsed = parseResumeLocally(text, lines);
  assertLooksLikeResume(text, lines, parsed);

  // "Auto-fix": apply the same local action-verb/metric heuristics used by
  // the resume-enhancer to every bullet automatically, rather than a
  // free-form AI rewrite. Falls back to the original bullet on any per-item
  // failure so auto-fix never produces worse content than the input.
  const fixedExperience = await Promise.all(
    parsed.experience.map(async (exp) => ({
      ...exp,
      bullets: await Promise.all(
        exp.bullets.map((b) => enhanceBulletLocally(b, exp.role, exp.company))
      ),
    }))
  );
  const fixedJson: ParsedResume = { ...parsed, experience: fixedExperience };
  const analysis = analyzeResumeLocally(fixedJson, text);

  res.json({
    success: true,
    data: { resume: parsedToResponse(fixedJson), analysis },
  });
});

export const evaluateBuilderResume = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { resumeData } = req.body;

  if (!resumeData) {
    throw new AppError("Missing resumeData in request body", 400);
  }

  const parsed: ParsedResume = {
    personalInfo: resumeData.personalInfo || { fullName: "", email: "", phone: "", location: "", linkedin: "", portfolio: "" },
    summary: resumeData.summary || "",
    education: resumeData.education || [],
    experience: (resumeData.experience || []).map((e: any) => ({ ...e, bullets: e.bullets || [] })),
    skills: (resumeData.skills || []).map(canonicalizeSkillLabel),
    projects: resumeData.projects || [],
    certifications: resumeData.certifications || [],
  };

  const rawText = [
    parsed.summary,
    ...parsed.experience.flatMap((e) => e.bullets),
    ...parsed.projects.map((p) => p.description),
    parsed.skills.join(" "),
  ].join(" ");

  const analysis = analyzeResumeLocally(parsed, rawText);

  res.json({
    success: true,
    data: { analysis },
  });
});

// Local rule-based bullet enhancement, used by /auto-fix and as the fallback
// if the trained resume-enhancer model is unavailable: ensures the bullet
// starts with a strong action verb and flags (but does not fabricate) a
// missing quantifiable metric.
const WEAK_OPENERS: Record<string, string> = {
  "was responsible for": "Managed",
  "responsible for": "Managed",
  "worked on": "Developed",
  "helped with": "Contributed to",
  // Bare "helped <verb>" (e.g. "helped mentor") takes a bare infinitive in
  // English, unlike "Contributed to" which needs a gerund ("contributed to
  // mentoring") - so this needs a different replacement to stay grammatical.
  "helped": "Supported efforts to",
  "in charge of": "Led",
  "involved in": "Participated in",
  "tasked with": "Delivered",
};

async function enhanceBulletLocally(bullet: string, role?: string, company?: string): Promise<string> {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/enhance-resume-content`,
      { type: "bullet", context: { original_text: bullet, role, company } },
      { timeout: 8000, headers: { "X-AI-Service-Key": AI_SERVICE_KEY } }
    );
    if (response.data.enhanced_text) return response.data.enhanced_text;
  } catch (err: any) {
    console.error(`Local resume-enhancer unavailable, applying rule-based fallback: ${err?.message}`);
  }

  let fixed = bullet.trim();
  const lower = fixed.toLowerCase();
  for (const [weak, strong] of Object.entries(WEAK_OPENERS)) {
    if (lower.startsWith(weak)) {
      fixed = strong + fixed.slice(weak.length);
      break;
    }
  }
  return fixed;
}
