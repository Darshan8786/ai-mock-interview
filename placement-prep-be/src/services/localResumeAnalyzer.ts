/**
 * Local, offline resume quality (ATS) scoring and job skill-gap analysis -
 * replaces the Groq-based analyzeWithAI / analyzeJobSkillGaps.
 *
 * Every field below is computed directly from the parsed resume content
 * (see localResumeParser.ts) via explicit, inspectable rules - the same
 * checklist real ATS-readiness tools use (contact info present? quantified
 * achievements? action-verb bullets? skills section? etc.) - rather than an
 * LLM's free-form judgment. No AI API is used anywhere in this module.
 */

import { ParsedResume } from "./localResumeParser";
import { extractSkillsFromText, SKILLS_TAXONOMY } from "../data/resumeSkillsTaxonomy";

export interface ResumeAnalysis {
  skills: string[];
  certifications: string[];
  experience_years: number;
  top_roles: string[];
  strengths: string[];
  weaknesses: string[];
  improvements: Array<{ area: string; suggestion: string; priority: "high" | "medium" | "low" }>;
  ats_score: number;
  ats_friendly: boolean;
  ats_issues: string[];
  ats_passed_checks: string[];
  missing_keywords: string[];
  summary: string;
}

interface AtsCheck {
  passed: boolean;
  passedLabel: string;
  failLabel: string;
  weight: number;
  priority: "high" | "medium" | "low";
  area: string;
  suggestion: string;
}

const ACTION_VERBS = [
  "led", "built", "developed", "designed", "implemented", "created", "managed", "engineered",
  "optimized", "improved", "launched", "architected", "automated", "reduced", "increased",
  "spearheaded", "orchestrated", "delivered", "deployed", "streamlined", "analyzed", "collaborated",
  "coordinated", "achieved", "drove", "established", "executed", "generated", "resolved",
  "mentored", "authored", "initiated", "enhanced", "migrated", "integrated", "maintained",
  "tested", "trained", "presented", "negotiated", "supervised", "refactored", "scaled",
];

// A bullet starting with an adverb ("Successfully led...") still opens with
// a strong action verb once the adverb is stripped - checking the raw bullet
// alone was rejecting those as weak.
const LEADING_ADVERB_RE = /^(successfully|effectively|actively|proactively|independently|consistently)\s+/i;

// Explicit metric context (%, currency, x-multiplier, k/m suffix, "10+", or a
// number paired with a countable unit) is unambiguous. A bare 2+ digit number
// on its own is NOT unambiguous - "Migrated the service in 2021" or "Used
// Python 3" would count as a "quantified achievement" under a plain \d{2,}
// check, which is a false positive. isQuantified() only falls back to a bare
// number when that number isn't just a 4-digit calendar year.
const METRIC_UNIT_RE =
  /\d+(\.\d+)?\s*%|[$₹]\s?\d|\b\d+(\.\d+)?\s?(x|k|m)\b|\b\d+\+|\b\d+(\.\d+)?\s?(users?|customers?|requests?|records?|hours?|days?|weeks?|months?|projects?|members?|clients?|downloads?|reviews?|tickets?|servers?|deployments?|lines?|tests?|engineers?|developers?|students?|teams?)\b/i;
const CALENDAR_YEAR_RE = /^(19|20)\d{2}$/;

function isQuantified(bullet: string): boolean {
  if (METRIC_UNIT_RE.test(bullet)) return true;
  const numbers = bullet.match(/\b\d{2,}\b/g) || [];
  return numbers.some((n) => !CALENDAR_YEAR_RE.test(n));
}

// role name -> a handful of skills a strong resume for that role usually lists.
const ROLE_EXPECTED_SKILLS: Record<string, string[]> = {
  "Frontend Developer": ["JavaScript", "React", "HTML", "CSS", "REST API", "Git"],
  "Backend Developer": ["SQL", "Node.js", "REST API", "DBMS", "Git", "System Design"],
  "Full Stack Developer": ["JavaScript", "React", "Node.js", "SQL", "REST API", "Git"],
  "Data Scientist": ["Python", "Machine Learning", "Pandas", "NumPy", "SQL", "Data Visualization"],
  "Machine Learning Engineer": ["Python", "Machine Learning", "TensorFlow", "PyTorch", "SQL"],
  "DevOps Engineer": ["Docker", "Kubernetes", "CI/CD", "AWS", "Linux", "Terraform"],
  "Software Engineer": ["Data Structures", "Algorithms", "Git", "SQL", "OOP"],
};

function inferTopRoles(skills: string[], experienceRoles: string[]): string[] {
  if (experienceRoles.length > 0) {
    return Array.from(new Set(experienceRoles)).slice(0, 3);
  }
  const scored = Object.entries(ROLE_EXPECTED_SKILLS)
    .map(([role, expected]) => ({ role, score: expected.filter((s) => skills.includes(s)).length }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.length ? scored.slice(0, 2).map((r) => r.role) : ["Software Engineer"];
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Parses a date string ("Jan 2020", "01/2020", "2020") into an absolute
 * month index (year*12 + month), defaulting to June when only a year is
 * given (a bare year is as likely to mean the middle of the year as either
 * end, so this avoids systematically over- or under-counting durations). */
function toAbsoluteMonth(dateStr: string): number | null {
  const s = (dateStr || "").trim().toLowerCase();
  const yearOnly = s.match(/^\d{4}$/);
  if (yearOnly) return parseInt(s, 10) * 12 + 5;

  const numeric = s.match(/^(\d{1,2})[/\-](\d{4})$/);
  if (numeric) return parseInt(numeric[2], 10) * 12 + (parseInt(numeric[1], 10) - 1);

  const monthName = s.match(/^([a-z]{3})[a-z]*\.?\s*(\d{4})$/);
  if (monthName && MONTH_INDEX[monthName[1]] !== undefined) {
    return parseInt(monthName[2], 10) * 12 + MONTH_INDEX[monthName[1]];
  }
  return null;
}

function computeExperienceYears(experience: ParsedResume["experience"]): number {
  const now = new Date();
  const currentAbsoluteMonth = now.getFullYear() * 12 + now.getMonth();
  let totalMonths = 0;
  for (const e of experience) {
    const start = toAbsoluteMonth(e.startDate || "");
    const end = e.current ? currentAbsoluteMonth : toAbsoluteMonth(e.endDate || "");
    if (start !== null && end !== null && end >= start) {
      totalMonths += Math.max(1, end - start); // at least 1 month for a same-month stint
    }
  }
  return Math.round((totalMonths / 12) * 10) / 10;
}

function allBullets(parsed: ParsedResume): string[] {
  return [
    ...parsed.experience.flatMap((e) => e.bullets),
    ...parsed.projects.map((p) => p.description),
  ];
}

function buildChecks(parsed: ParsedResume, rawText: string): AtsCheck[] {
  const bullets = allBullets(parsed);
  const hasExperienceOrProjects = parsed.experience.length > 0 || parsed.projects.length > 0;
  const quantifiedCount = bullets.filter((b) => isQuantified(b)).length;
  const actionVerbCount = bullets.filter((b) => {
    const cleaned = b.trim().replace(LEADING_ADVERB_RE, "");
    return ACTION_VERBS.some((v) => new RegExp(`^${v}\\b`, "i").test(cleaned));
  }).length;
  const wordCount = rawText.split(/\s+/).filter(Boolean).length;

  return [
    {
      passed: parsed.personalInfo.email !== "",
      passedLabel: "Contains a valid contact email",
      failLabel: "Missing an email address - ATS systems and recruiters need this to reach you",
      weight: 10, priority: "high", area: "Contact Info",
      suggestion: "Add a professional email address near the top of your resume.",
    },
    {
      passed: parsed.personalInfo.phone !== "",
      passedLabel: "Contains a phone number",
      failLabel: "Missing a phone number",
      weight: 5, priority: "medium", area: "Contact Info",
      suggestion: "Add a phone number so recruiters can contact you directly.",
    },
    {
      passed: parsed.personalInfo.linkedin !== "" || parsed.personalInfo.portfolio !== "",
      passedLabel: "Includes a LinkedIn or portfolio link",
      failLabel: "No LinkedIn profile or portfolio link found",
      weight: 5, priority: "medium", area: "Contact Info",
      suggestion: "Add a LinkedIn profile URL or portfolio/GitHub link.",
    },
    {
      passed: parsed.summary.trim().length >= 30,
      passedLabel: "Has a professional summary",
      failLabel: "Summary section is missing or very short",
      weight: 10, priority: "medium", area: "Summary",
      suggestion: "Add a 3-4 sentence professional summary highlighting your top skills and goals.",
    },
    {
      passed: parsed.education.length > 0,
      passedLabel: "Has a clear education section",
      failLabel: "No education entries detected",
      weight: 10, priority: "high", area: "Education",
      suggestion: "Add your degree, institution, and graduation dates under an 'Education' heading.",
    },
    {
      passed: hasExperienceOrProjects,
      passedLabel: "Has experience or project entries",
      failLabel: "No work experience or project entries detected",
      weight: 15, priority: "high", area: "Experience",
      suggestion: "Add at least one work experience or project entry with concrete bullet points.",
    },
    {
      passed: parsed.skills.length >= 5,
      passedLabel: `Lists a solid set of skills (${parsed.skills.length} detected)`,
      failLabel: `Only ${parsed.skills.length} recognizable skills detected - add a dedicated Skills section`,
      weight: 15, priority: "high", area: "Skills",
      suggestion: "Add a dedicated Skills section listing your technologies, tools, and frameworks.",
    },
    {
      passed: bullets.length > 0 && quantifiedCount > 0,
      passedLabel: `${quantifiedCount} bullet point(s) include quantifiable metrics`,
      failLabel: "No quantifiable achievements (numbers, percentages, counts) found in your bullet points",
      weight: 15, priority: "high", area: "Experience",
      suggestion: "Rewrite bullets to include a number - e.g. 'reduced load time by 30%' or 'served 10k+ users'.",
    },
    {
      passed: bullets.length > 0 && actionVerbCount / bullets.length >= 0.5,
      passedLabel: "Most bullet points start with a strong action verb",
      failLabel: "Many bullet points don't start with a strong action verb (e.g. 'Built', 'Led', 'Optimized')",
      weight: 10, priority: "medium", area: "Experience",
      suggestion: "Start each bullet with an action verb like 'Built', 'Led', 'Designed', or 'Optimized'.",
    },
    {
      passed: wordCount >= 150 && wordCount <= 1200,
      passedLabel: "Resume length is within a reasonable range",
      failLabel: wordCount < 150 ? "Resume content looks too short to fully represent your background" : "Resume content looks unusually long - consider tightening it to 1-2 pages",
      weight: 5, priority: "low", area: "Formatting",
      suggestion: wordCount < 150 ? "Expand your experience/projects with more detail." : "Trim less relevant content to keep the resume to 1-2 pages.",
    },
  ];
}

export function analyzeResumeLocally(parsed: ParsedResume, rawText: string): ResumeAnalysis {
  const checks = buildChecks(parsed, rawText);
  const maxScore = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.filter((c) => c.passed).reduce((s, c) => s + c.weight, 0);
  const ats_score = Math.round((earned / maxScore) * 100);

  const ats_passed_checks = checks.filter((c) => c.passed).map((c) => c.passedLabel);
  const ats_issues = checks.filter((c) => !c.passed).map((c) => c.failLabel);
  const improvements = checks
    .filter((c) => !c.passed)
    .map((c) => ({ area: c.area, suggestion: c.suggestion, priority: c.priority }));

  const top_roles = inferTopRoles(
    parsed.skills,
    parsed.experience.map((e) => e.role).filter(Boolean)
  );
  const experience_years = computeExperienceYears(parsed.experience);

  const strengths: string[] = [];
  if (parsed.skills.length >= 8) strengths.push(`Broad, relevant skill set (${parsed.skills.length} skills detected)`);
  if (checks.find((c) => c.area === "Experience" && c.passed && c.weight === 15 && c.passedLabel.includes("quantif")))
    strengths.push("Achievement-oriented bullet points with measurable impact");
  if (parsed.education.length > 0 && (parsed.experience.length > 0 || parsed.projects.length > 0))
    strengths.push("Clear, complete structure with education and experience/projects both present");
  if (parsed.certifications.length > 0)
    strengths.push(`Includes ${parsed.certifications.length} certification(s)/achievement(s) that add credibility`);
  if (strengths.length === 0) strengths.push("Resume has a usable baseline structure to build on");

  const weaknesses = ats_issues.slice(0, 4);
  if (weaknesses.length === 0) weaknesses.push("No major structural issues detected - focus on tailoring content per job application");

  const expected = ROLE_EXPECTED_SKILLS[top_roles[0]] || [];
  const missing_keywords = expected.filter((s) => !parsed.skills.includes(s));

  const ats_friendly = ats_score >= 70;
  const tier = ats_score >= 80 ? "strong" : ats_score >= 55 ? "moderate" : "weak";
  const summary =
    `This resume shows a ${tier} ATS-readiness profile (${ats_score}/100), best aligned with ${top_roles.join(" or ")} roles. ` +
    `${strengths[0]}. ` +
    (ats_issues.length > 0
      ? `The main gaps are: ${ats_issues.slice(0, 2).join("; ").toLowerCase()}.`
      : "No major structural gaps were found.");

  return {
    skills: parsed.skills,
    certifications: parsed.certifications,
    experience_years,
    top_roles,
    strengths,
    weaknesses,
    improvements,
    ats_score,
    ats_friendly,
    ats_issues,
    ats_passed_checks,
    missing_keywords,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Job skill-gap analysis (replaces the Groq-based analyzeJobSkillGaps)
// ---------------------------------------------------------------------------

export interface SkillGapResult {
  index: number;
  required_skills: string[];
  matched_skills: string[];
  missing_skills: string[];
  fit_score: number;
  gap_summary: string;
  suggestions: Array<{ skill: string; action: string; resource: string; priority: "high" | "medium" | "low" }>;
}

const CATEGORY_RESOURCES: Record<string, string> = {
  Language: "the official language documentation + a freeCodeCamp course",
  Web: "MDN Web Docs + a freeCodeCamp project",
  Database: "the official docs + a hands-on mini-project",
  "Cloud/DevOps": "the provider's free-tier docs/tutorials (AWS/Azure/GCP)",
  "Data/ML": "Kaggle Learn + the official library documentation",
  Testing: "the official docs + writing tests for an existing project",
  Tool: "the official documentation and a short guided tutorial",
  Mobile: "the official platform documentation + a sample app tutorial",
  Fundamentals: "a structured DSA/CS fundamentals course (e.g. freeCodeCamp, NPTEL)",
  Methodology: "a short Agile/Scrum primer and applying it to a personal project",
  "Soft Skill": "practicing in mock interviews and real project collaboration",
};

function resourceFor(skill: string): string {
  const def = SKILLS_TAXONOMY.find((s) => s.canonical === skill);
  return CATEGORY_RESOURCES[def?.category || ""] || "the official documentation and a hands-on project";
}

export function computeSkillGapLocally(
  resumeSkills: string[],
  job: { title: string; description: string },
  index: number
): SkillGapResult {
  const requiredAll = extractSkillsFromText(`${job.title} ${job.description}`);
  const required_skills = requiredAll.slice(0, 8);
  const matched_skills = required_skills.filter((s) => resumeSkills.includes(s));
  const missing_skills = required_skills.filter((s) => !resumeSkills.includes(s));

  const fit_score = required_skills.length === 0 ? 50 : Math.round((matched_skills.length / required_skills.length) * 100);

  const gap_summary =
    missing_skills.length === 0
      ? "Your skills closely match this job's requirements."
      : `You match ${matched_skills.length}/${required_skills.length} key requirements; prioritize learning ${missing_skills[0]} first.`;

  const suggestions = missing_skills.map((skill, i) => ({
    skill,
    action: `Learn the fundamentals of ${skill} and apply it in a small hands-on project you can show on your resume.`,
    resource: resourceFor(skill),
    priority: (i < 2 ? "high" : i < 4 ? "medium" : "low") as "high" | "medium" | "low",
  }));

  return { index, required_skills, matched_skills, missing_skills, fit_score, gap_summary, suggestions };
}
