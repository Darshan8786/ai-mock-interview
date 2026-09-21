/**
 * Decides whether extracted PDF text is actually a resume, so a random PDF
 * (an invoice, a paper, a book chapter, a cover letter) is rejected up front
 * instead of being "analysed" into empty or misleading output.
 *
 * Fully local and rule-based, like the rest of the resume pipeline. It scores
 * independent resume signals rather than trusting any single one, because real
 * resumes vary a lot (custom headings, two-column templates, no LinkedIn):
 *
 *   - section headings (Education, Skills, Projects, Experience, ...)
 *   - contact details (email, phone, LinkedIn/GitHub)
 *   - resume vocabulary (university, CGPA, internship, developed, ...)
 *   - technology keywords found in the text
 *
 * A genuine resume clears the threshold through several of these at once; a
 * random document typically has at most one or two of them.
 */

import { AppError } from "../utils/AppError";
import { ParsedResume } from "./localResumeParser";

// Below this there is not enough text to judge (image-only/scanned PDF, or a
// near-empty file) - reported separately from "not a resume".
const MIN_TEXT_CHARS = 200;
// Resumes are short (1-3 pages is roughly 2-8k characters). A long document is
// almost certainly a report or manual, so it must clear a higher bar, and one
// this long (dozens of pages) is rejected outright however many resume-like
// words it happens to contain.
const LONG_DOCUMENT_CHARS = 12000;
const MAX_RESUME_CHARS = 30000;

const PASS_SCORE = 6;
const PASS_SCORE_LONG_DOCUMENT = 9;

const MAX_HEADING_LENGTH = 45;

// Headings that appear on nearly every resume and almost never on other
// documents in this combination.
const CORE_HEADINGS = new Set([
  "education", "academic background", "academics", "academic qualification", "academic qualifications",
  "educational qualification", "educational qualifications",
  "experience", "work experience", "professional experience", "employment history", "internship",
  "internships", "internship experience", "work history",
  "skills", "technical skills", "key skills", "core competencies", "technical proficiency",
  "technical expertise", "skills and abilities", "skills & abilities", "skill set",
  "projects", "academic projects", "personal projects", "key projects", "project work", "major projects",
  "summary", "professional summary", "career summary", "objective", "career objective", "profile",
  "professional profile", "about me",
]);

// Common but weaker: fine as supporting evidence, not enough on their own.
const SECONDARY_HEADINGS = new Set([
  "certifications", "certification", "certificates", "licenses & certifications", "licenses and certifications",
  "achievements", "awards", "awards & honors", "honors", "accomplishments",
  "languages", "interests", "hobbies", "extracurricular activities", "extracurriculars", "activities",
  "training", "courses", "coursework", "declaration", "volunteer experience", "leadership",
]);

const RESUME_VOCABULARY = [
  "university", "college", "institute of technology", "bachelor", "b.tech", "btech", "m.tech", "mtech",
  "b.e.", "bsc", "b.sc", "msc", "m.sc", "mba", "bca", "mca", "cgpa", "gpa", "graduation", "graduated",
  "intern", "internship", "developed", "implemented", "designed", "collaborated", "responsible for",
  "managed", "led a", "built", "achieved", "improved", "certified", "hackathon", "github", "linkedin",
  "resume", "curriculum vitae",
];

// A job posting reuses resume headings (Skills, Experience, Requirements) but
// is written to the candidate rather than about one. Seeing several of these
// phrases marks the document as a posting, not a resume.
// Only phrases that don't occur in a candidate's own resume ("responsibilities"
// and "requirements" do - "gathered requirements" - so they are left out).
const JOB_POSTING_PHRASES = [
  "we are looking for", "we are hiring", "about the company", "about the role", "job description",
  "apply now", "how to apply", "what you'll do", "what you will do", "equal opportunity",
  "salary range", "join our team", "job type",
];

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PROFILE_URL_RE = /(linkedin\.com\/|github\.com\/)/i;

function normalizeHeading(line: string): string {
  return line
    .toLowerCase()
    .replace(/[^a-z& ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhoneNumber(text: string): boolean {
  // 10+ digits in a phone-shaped run; avoids counting years, IDs, prices.
  const candidates = text.match(/\+?\d[\d\s().-]{8,}\d/g) || [];
  return candidates.some((c) => c.replace(/\D/g, "").length >= 10 && c.replace(/\D/g, "").length <= 13);
}

export interface ResumeAssessment {
  isResume: boolean;
  verdict: "ok" | "too_little_text" | "too_long" | "not_a_resume";
  score: number;
  needed: number;
  signals: string[];
}

export function assessResumeText(text: string, lines: string[], parsed?: ParsedResume): ResumeAssessment {
  const signals: string[] = [];
  const trimmed = (text || "").trim();

  if (trimmed.length < MIN_TEXT_CHARS) {
    return { isResume: false, verdict: "too_little_text", score: 0, needed: PASS_SCORE, signals };
  }
  if (trimmed.length > MAX_RESUME_CHARS) {
    return { isResume: false, verdict: "too_long", score: 0, needed: PASS_SCORE_LONG_DOCUMENT, signals };
  }

  let score = 0;

  // 1. Section headings: whole short lines matching the resume vocabulary.
  const coreFound = new Set<string>();
  const secondaryFound = new Set<string>();
  for (const line of lines) {
    if (line.length > MAX_HEADING_LENGTH) continue;
    const heading = normalizeHeading(line);
    if (CORE_HEADINGS.has(heading)) coreFound.add(heading);
    else if (SECONDARY_HEADINGS.has(heading)) secondaryFound.add(heading);
  }
  const coreScore = Math.min(coreFound.size, 3) * 2;
  const secondaryScore = Math.min(secondaryFound.size, 2);
  score += coreScore + secondaryScore;
  if (coreFound.size) signals.push(`${coreFound.size} core section heading(s)`);
  if (secondaryFound.size) signals.push(`${secondaryFound.size} other section heading(s)`);

  // 2. Contact details.
  if (EMAIL_RE.test(trimmed)) {
    score += 2;
    signals.push("email");
  }
  if (hasPhoneNumber(trimmed)) {
    score += 1;
    signals.push("phone");
  }
  if (PROFILE_URL_RE.test(trimmed)) {
    score += 1;
    signals.push("LinkedIn/GitHub link");
  }

  // 3. Resume vocabulary (distinct terms, so one repeated word can't inflate it).
  const lower = trimmed.toLowerCase();
  const vocabHits = RESUME_VOCABULARY.filter((term) => lower.includes(term)).length;
  if (vocabHits >= 4) {
    score += 2;
    signals.push("resume vocabulary");
  } else if (vocabHits >= 2) {
    score += 1;
    signals.push("some resume vocabulary");
  }

  // 4. Technology keywords the local skills taxonomy recognises. Weak on its
  // own (any programming tutorial has them), so it only adds a point.
  if (parsed && parsed.skills.length >= 3) {
    score += 1;
    signals.push("technical skills");
  }

  // 5. Job-posting language counts against it, scaled by how much there is: a
  // couple of phrases is a mild flag, four or more is a posting for certain
  // (a candidate's own resume essentially never says "how to apply").
  const postingHits = JOB_POSTING_PHRASES.filter((phrase) => lower.includes(phrase)).length;
  if (postingHits >= 4) {
    score -= 10;
    signals.push("job-posting language (strong)");
  } else if (postingHits >= 2) {
    score -= 3;
    signals.push("job-posting language");
  }

  const isLong = trimmed.length > LONG_DOCUMENT_CHARS;
  const needed = isLong ? PASS_SCORE_LONG_DOCUMENT : PASS_SCORE;
  const ok = score >= needed;
  return { isResume: ok, verdict: ok ? "ok" : "not_a_resume", score, needed, signals };
}

/** Throws a user-facing 400 unless the text looks like a resume. */
export function assertLooksLikeResume(text: string, lines: string[], parsed?: ParsedResume): void {
  const assessment = assessResumeText(text, lines, parsed);
  if (assessment.verdict === "too_little_text") {
    throw new AppError(
      "Could not read enough text from this file. If it is a scanned image, upload a text-based PDF of your resume instead.",
      400
    );
  }
  if (assessment.verdict === "too_long") {
    throw new AppError(
      "This file is too long to be a resume. Upload a PDF of just your resume (usually 1-3 pages).",
      400
    );
  }
  if (assessment.verdict === "not_a_resume") {
    throw new AppError(
      "This file doesn't look like a resume. Upload a PDF of your resume with sections such as Education, Skills, Projects or Experience, and your contact details.",
      400
    );
  }
}
