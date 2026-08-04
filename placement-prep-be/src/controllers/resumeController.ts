import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import OpenAI from "openai";
import { env } from "../config/env";
import multer from "multer";

const openai = new OpenAI({
  apiKey: env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

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

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;

  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    text += `${pageText}\n`;
  }

  await loadingTask.destroy();
  return text.trim();
}

async function analyzeWithAI(resumeText: string) {
  const prompt = `You are an expert resume analyzer and career advisor specializing in ATS (Applicant Tracking System) optimization. Analyze this resume and return a JSON object with exactly this structure (no markdown, no code fences):

{
  "skills": ["skill1", "skill2", ...],
  "experience_years": number,
  "top_roles": ["role1", "role2", ...],
  "strengths": ["strength1", "strength2", ...],
  "weaknesses": ["weakness1", "weakness2", ...],
  "improvements": [
    {
      "area": "Section or skill to improve",
      "suggestion": "Specific actionable advice",
      "priority": "high|medium|low"
    }
  ],
  "ats_score": 75,
  "ats_friendly": false,
  "ats_issues": [
    "Missing standard section headers like 'Experience' or 'Education'",
    "Uses tables or columns that ATS cannot parse",
    "No keywords from job description found",
    "File format or formatting may cause parsing errors"
  ],
  "ats_passed_checks": [
    "Uses standard font",
    "Contains contact information",
    "Has clear section headers"
  ],
  "missing_keywords": ["keyword1", "keyword2", ...],
  "summary": "Brief overall assessment"
}

CRITICAL: Be very strict about ATS friendliness. Check for these issues:
- Missing standard headers (Summary, Experience, Education, Skills)
- Tables, columns, or complex layouts that break ATS parsing
- No quantifiable achievements (numbers, percentages)
- Missing contact info (email, phone, LinkedIn)
- Skills not listed in a clear comma-separated or bullet format
- No education dates or degree names
- Generic objective statement instead of professional summary
- Experience descriptions without action verbs
- Missing keywords relevant to the candidate's target role

Resume text:
${resumeText.substring(0, 15000)}

Return ONLY the JSON object, no other text.`;

  const completion = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
  });
  const text = completion.choices[0]?.message?.content || "";

  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
}

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

async function analyzeJobSkillGaps(resumeText: string, resumeSkills: string[], jobs: any[]): Promise<any[]> {
  if (jobs.length === 0) return [];

  const jobBlock = jobs
    .map((j, i) => `--- JOB ${i} ---\nTitle: ${j.title}\nCompany: ${j.company}\nLocation: ${j.location}\nSalary: ${j.salary_min} - ${j.salary_max}\nDescription: ${j.description}`)
    .join("\n\n");

  const prompt = `You are a career advisor comparing a candidate's resume against live job postings from Bengaluru.

CANDIDATE RESUME (truncated):
${resumeText.substring(0, 4000)}

CANDIDATE SKILLS EXTRACTED:
${(resumeSkills || []).join(", ") || "Not available"}

LIVE JOBS:
${jobBlock}

For EACH job (one object per job, in the same order as the jobs given), analyze the skill gap and return STRICTLY a JSON array (no markdown, no code fences):
[
  {
    "index": 0,
    "required_skills": ["top 4-8 skills the job clearly demands"],
    "matched_skills": ["required skills the candidate already has"],
    "missing_skills": ["required skills the candidate does NOT have"],
    "fit_score": 0-100,
    "gap_summary": "One concise sentence explaining how big the skill gap is and what to learn first.",
    "suggestions": [
      {
        "skill": "name of a missing skill",
        "action": "Specific, actionable step to learn/practice this skill",
        "resource": "A well-known free resource (e.g., freeCodeCamp, MDN, Coursera, official docs, YouTube course)",
        "priority": "high|medium|low"
      }
    ]
  }
]

Rules:
- required_skills must be derived ONLY from the job description.
- matched_skills and missing_skills must be derived from the candidate's actual resume skills. missing_skills are the required ones not present in the resume.
- fit_score: 100 = perfect match, 0 = completely missing every requirement.
- suggestions MUST contain one entry for EACH missing skill (empty array if no gaps), with concrete, realistic learning actions and well-known free resources.
- Return ONLY the JSON array, no other text.`;

  const completion = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
  });
  const text = completion.choices[0]?.message?.content || "";
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[SkillGap] Failed to parse AI response:", err);
    return [];
  }
}

async function fetchLiveJobsWithSkillGap(resumeText: string, resumeSkills: string[], topRole?: string) {
  const what = topRole || "software engineer";
  const jobs = await fetchLiveJobsFromAdzuna(what, "Bengaluru", 6);
  if (jobs.length === 0) return [];

  const gaps = await analyzeJobSkillGaps(resumeText, resumeSkills, jobs);

  return jobs.map((j, i) => {
    const gap = gaps[i] || {};
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

  const text = await extractTextFromPdf(req.file.buffer);

  if (!text || text.trim().length < 50) {
    throw new AppError("Could not extract enough text from PDF", 400);
  }

  const analysis = await analyzeWithAI(text);

  let liveJobs: any[] = [];
  try {
    liveJobs = await fetchLiveJobsWithSkillGap(text, analysis.skills || [], analysis.top_roles?.[0]);
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

export const enhanceResumeContent = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { type, context } = req.body;

  if (!type || !context) {
    throw new AppError("Missing required fields: type and context", 400);
  }

  if (type !== "summary" && type !== "bullet") {
    throw new AppError("Invalid type. Must be 'summary' or 'bullet'", 400);
  }

  let prompt: string;

  if (type === "summary") {
    const { name, role, skills, experience_years, education } = context;

    if (!role || !skills || !Array.isArray(skills)) {
      throw new AppError("Summary context requires: role, skills[] (name and education are optional)", 400);
    }

    prompt = `You are an expert resume writer. Write a concise, professional resume summary paragraph (3-4 sentences) for a candidate with the following profile:

Name: ${name || "the candidate"}
Target Role: ${role}
Skills: ${skills.join(", ")}
Years of Experience: ${experience_years ?? "not specified"}
Education: ${education || "not specified"}

Requirements:
- Write in first person implied (no "I" statements), professional tone
- Highlight key strengths and value proposition
- Include relevant technical skills naturally
- Make it ATS-friendly with industry keywords
- Keep it to 3-4 impactful sentences

Return ONLY the summary paragraph text, no quotes, no labels, no extra formatting.`;
  } else {
    const { role, company, original_text } = context;

    if (!original_text) {
      throw new AppError("Bullet context requires: original_text (role and company are optional)", 400);
    }

    prompt = `You are an expert resume writer. Rewrite the following resume bullet point to be more impactful and professional.

Original bullet point: "${original_text}"
Role: ${role || "not specified"}
Company: ${company || "not specified"}

Requirements:
- Start with a strong action verb (e.g., Spearheaded, Engineered, Optimized, Orchestrated)
- Include quantifiable impact where possible (percentages, numbers, dollar amounts)
- Keep it to one concise sentence
- Use professional, ATS-friendly language
- Make the achievement clear and measurable

Return ONLY the rewritten bullet point text, no quotes, no labels, no extra formatting.`;
  }

  const completion = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
  });
  const enhanced_text = completion.choices[0]?.message?.content?.trim() || "";

  if (!enhanced_text) {
    throw new AppError("AI failed to generate enhanced content", 500);
  }

  res.json({
    success: true,
    data: { enhanced_text },
  });
});

export const parseResumeToJSON = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) throw new AppError("Please upload a PDF resume", 400);

  const text = await extractTextFromPdf(req.file.buffer);

  if (!text || text.trim().length < 50) {
    throw new AppError("Could not extract enough text from PDF", 400);
  }

  const prompt = `You are an expert ATS resume parser. Extract the information from the following resume text and return it STRICTLY as a JSON object matching this exact structure (no markdown, no code fences):

{
  "personalInfo": { "fullName": "", "email": "", "phone": "", "location": "", "linkedin": "", "portfolio": "" },
  "summary": "",
  "education": [ { "id": "uuid", "institution": "", "degree": "", "field": "", "startDate": "", "endDate": "", "gpa": "" } ],
  "experience": [ { "id": "uuid", "company": "", "role": "", "startDate": "", "endDate": "", "current": boolean, "bullets": ["string"] } ],
  "skills": ["string"],
  "projects": [ { "id": "uuid", "name": "", "description": "", "technologies": ["string"], "link": "" } ]
}

CRITICAL: Generate random valid UUID strings for all the "id" fields in education, experience, and projects arrays.
If a field is not found in the resume, leave it as an empty string (or empty array/boolean as appropriate).

Resume text:
${text.substring(0, 15000)}

Return ONLY the JSON object, no other text.`;

  let parsedJson;
  try {
    const completion = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
    });
    const responseText = completion.choices[0]?.message?.content || "";
    const cleaned = responseText.replace(/```json\s*/ig, "").replace(/```\s*/g, "").trim();
    parsedJson = JSON.parse(cleaned);
  } catch (err: any) {
    console.error("OpenAI Error:", err);
    throw new AppError("Failed to parse resume from AI: " + (err.message || "Unknown error"), 500);
  }

  res.json({
    success: true,
    data: { resume: parsedJson },
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

  const prompt = `You are an expert ATS resume parser. Extract the information from the following resume text and return it STRICTLY as a JSON object matching this exact structure (no markdown, no code fences):

{
  "personalInfo": { "fullName": "", "email": "", "phone": "", "location": "", "linkedin": "", "portfolio": "" },
  "summary": "",
  "education": [ { "id": "uuid", "institution": "", "degree": "", "field": "", "startDate": "", "endDate": "", "gpa": "" } ],
  "experience": [ { "id": "uuid", "company": "", "role": "", "startDate": "", "endDate": "", "current": boolean, "bullets": ["string"] } ],
  "skills": ["string"],
  "projects": [ { "id": "uuid", "name": "", "description": "", "technologies": ["string"], "link": "" } ]
}

CRITICAL: Generate random valid UUID strings for all the "id" fields in education, experience, and projects arrays.
If a field is not found in the resume, leave it as an empty string (or empty array/boolean as appropriate).

Resume text:
${text.substring(0, 15000)}

Return ONLY the JSON object, no other text.`;

  const completion = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
  });
  const responseText = completion.choices[0]?.message?.content || "";
  const cleaned = responseText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const parsedJson = JSON.parse(cleaned);

  res.json({
    success: true,
    data: { resume: parsedJson },
  });
});

export const autoFixResume = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) throw new AppError("Please upload a PDF resume", 400);

  const text = await extractTextFromPdf(req.file.buffer);

  if (!text || text.trim().length < 50) {
    throw new AppError("Could not extract enough text from PDF", 400);
  }

  const prompt = `You are an expert resume parser and ATS optimizer. 
Parse this resume into the JSON structure below, AND automatically rewrite the experience bullet points to be highly ATS-friendly (action verbs, quantifiable metrics), and inject missing relevant industry keywords into the skills and summary to optimize for ATS.

Return STRICTLY a JSON object matching this exact structure (no markdown, no code fences):
{
  "personalInfo": { "fullName": "", "email": "", "phone": "", "location": "", "linkedin": "", "portfolio": "" },
  "summary": "",
  "education": [ { "id": "uuid", "institution": "", "degree": "", "field": "", "startDate": "", "endDate": "", "gpa": "" } ],
  "experience": [ { "id": "uuid", "company": "", "role": "", "startDate": "", "endDate": "", "current": boolean, "bullets": ["string"] } ],
  "skills": ["string"],
  "projects": [ { "id": "uuid", "name": "", "description": "", "technologies": ["string"], "link": "" } ]
}

CRITICAL: Generate random valid UUID strings for all the "id" fields in education, experience, and projects arrays.
If a field is not found in the resume, leave it as an empty string (or empty array/boolean as appropriate).

Resume text:
${text.substring(0, 15000)}

Return ONLY the optimized JSON object, no other text.`;

  const completion = await openai.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
  });
  const responseText = completion.choices[0]?.message?.content || "";
  const cleaned = responseText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const fixedJson = JSON.parse(cleaned);

  res.json({
    success: true,
    data: { resume: fixedJson },
  });
});

export const evaluateBuilderResume = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { resumeData } = req.body;
  
  if (!resumeData) {
    throw new AppError("Missing resumeData in request body", 400);
  }

  const prompt = `You are an expert ATS resume analyzer and career advisor. Analyze the resume data below and produce a DETAILED, PERSONALIZED assessment that reflects THIS EXACT RESUME'S content. Never use generic responses — every field must reference the actual skills, companies, roles, education, and projects found in the resume.

STRICT RULES:
1. ats_score MUST vary with content quality: strong (detailed experience with quantified bullets, relevant skills, clear structure) = 75-95; mediocre (thin descriptions, few skills, weak bullets) = 45-74; poor = 20-44.
2. summary MUST be 3-5 sentences evaluating THIS resume: strengths, what role it fits, key gaps, and overall readiness.
3. missing_keywords MUST be job-relevant keywords (technologies, frameworks, methodologies) NOT already present in the resume.
4. ats_issues MUST list real problems in this resume (e.g., "No quantified achievements in experience", "Summary section is empty", "Only N skills listed").

Return a JSON object with exactly this structure (no markdown, no code fences):

{
  "skills": ["skill1", "skill2", ...],
  "experience_years": number,
  "top_roles": ["role1", "role2", ...],
  "strengths": ["strength1", "strength2", ...],
  "weaknesses": ["weakness1", "weakness2", ...],
  "improvements": [
    {
      "area": "Section or skill to improve",
      "suggestion": "Specific actionable advice",
      "priority": "high|medium|low"
    }
  ],
  "ats_score": 75,
  "ats_friendly": false,
  "ats_issues": ["String issues"],
  "ats_passed_checks": ["String passed checks"],
  "missing_keywords": ["keyword1", "keyword2", ...],
  "summary": "3-5 sentence detailed assessment of this specific resume"
}

Structured resume data to evaluate:
${JSON.stringify(resumeData, null, 2)}

Return ONLY the JSON object, no other text.`;

  let evaluationJson;
  try {
    const completion = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const responseText = completion.choices[0]?.message?.content || "";
    const cleaned = responseText.replace(/```json\s*/ig, "").replace(/```\s*/g, "").trim();
    evaluationJson = JSON.parse(cleaned);
  } catch (err: any) {
    console.error("OpenAI Error:", err);
    throw new AppError("Failed to parse ATS evaluation from AI: " + (err.message || "Unknown error"), 500);
  }

  res.json({
    success: true,
    data: { analysis: evaluationJson },
  });
});
