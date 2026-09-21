/**
 * Local, offline resume structuring - replaces the Groq-based
 * parseResumeToJSON/parseResumeFromText/autoFixResume parsing step.
 *
 * Approach: regex/heuristic section detection over the line-structured text
 * from pdfTextExtractor.ts, the same technique long predating LLM resume
 * parsers (section header matching, line-anchored regexes for contact info
 * and dates, bullet-line detection). No AI API is used.
 *
 * This is a best-effort structural parse, not a claim of perfect accuracy on
 * every resume layout - a resume with a highly unusual layout may need
 * manual correction in the builder UI, same as any rule-based parser would.
 */

import { randomUUID } from "crypto";
import { extractSkillsFromText } from "../data/resumeSkillsTaxonomy";

export interface ParsedResume {
  personalInfo: {
    fullName: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
    portfolio: string;
  };
  summary: string;
  education: Array<{
    id: string;
    institution: string;
    degree: string;
    field: string;
    startDate: string;
    endDate: string;
    gpa: string;
  }>;
  experience: Array<{
    id: string;
    company: string;
    role: string;
    startDate: string;
    endDate: string;
    current: boolean;
    bullets: string[];
  }>;
  skills: string[];
  projects: Array<{
    id: string;
    name: string;
    description: string;
    technologies: string[];
    link: string;
  }>;
  certifications: string[];
}

const SECTION_HEADERS: Record<string, RegExp> = {
  summary: /^(summary|professional summary|objective|profile|about me)\s*:?$/i,
  education: /^(education|academic background|academics)\s*:?$/i,
  experience: /^(experience|work experience|professional experience|employment history)\s*:?$/i,
  skills: /^(skills|technical skills|core competencies|key skills)\s*:?$/i,
  projects: /^(projects|academic projects|personal projects)\s*:?$/i,
  certifications: /^(certifications?|licenses?(\s*(&|and)\s*certifications?)?|achievements?|awards?(\s*(&|and)\s*honors)?|honors)\s*:?$/i,
};

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+\d{1,3}[\s-]?)?\(?\d{3,5}\)?[\s-]?\d{3,5}[\s-]?\d{0,5}/;
const LINKEDIN_RE = /(linkedin\.com\/[a-zA-Z0-9\-_/]+)/i;
const PORTFOLIO_RE = /((?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.(?:dev|io|me|com|in|tech|app)\/?[a-zA-Z0-9\-_/]*)/i;
// Month-name/year ("Jan 2020"), numeric ("01/2020", "01-2020"), and bare-year
// forms are all common on resumes - matching only the first left real dates
// (the majority format outside the US) undetected, breaking date/duration
// parsing for those entries entirely.
const DATE_TOKEN = "(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s*\\d{4}|\\d{1,2}[/\\-]\\d{4}|\\d{4})";
const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:-|–|—|to)\\s*(${DATE_TOKEN}|present|current)`, "i");
const NAME_LINE_RE = /^[A-Za-z][a-zA-Z.'-]+(?:\s+[A-Za-z][a-zA-Z.'-]+){1,3}$/;
const LOCATION_RE = /^[A-Za-z][A-Za-z\s]{1,30},\s*[A-Za-z][A-Za-z\s]{1,30}$/;
const BULLET_LINE_RE = /^(?:[•●○◦▪▫‣∙·⁃✓➤➔→o]|[-*]|\d{1,2}[.)])\s+/;
// Common single-line experience-entry patterns: "Role at Company",
// "Company | Role", "Role - Company", etc. Whichever side contains a
// recognizable job-title word is assumed to be the role.
const JOB_TITLE_KEYWORDS =
  /\b(engineer|developer|intern(?:ship)?|manager|analyst|designer|lead|architect|consultant|scientist|specialist|coordinator|director|administrator|officer|associate|executive|founder|researcher|programmer)\b/i;

/** Extracts a GPA/CGPA/percentage score from an education line, accepting
 * either "8.5/10 CGPA", "CGPA: 8.5", or "85%" - resumes use all three. */
function matchGpa(line: string): string {
  let m = line.match(/(\d(?:\.\d{1,2})?)\s*\/\s*(\d{1,2}(?:\.\d)?)/);
  if (m) return `${m[1]}/${m[2]}`;
  m = line.match(/(?:gpa|cgpa)\s*:?\s*(\d(?:\.\d{1,2})?)/i);
  if (m) return m[1];
  m = line.match(/\b(\d{1,3}(?:\.\d{1,2})?)\s*%/);
  if (m) return `${m[1]}%`;
  return "";
}

/** Splits a single combined header line into {role, company} using the
 * job-title keyword as a signal for which side is which. Returns {} when the
 * line doesn't clearly split, so callers can fall back to sequential
 * (line-by-line) assignment. */
function splitRoleCompany(text: string): { role?: string; company?: string } {
  const atMatch = text.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (atMatch) return { role: atMatch[1].trim(), company: atMatch[2].trim() };

  const parts = text
    .split(/\s*[|–—]\s*|,\s+(?=[A-Z])/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    const [a, b] = parts;
    if (JOB_TITLE_KEYWORDS.test(a) && !JOB_TITLE_KEYWORDS.test(b)) return { role: a, company: b };
    if (JOB_TITLE_KEYWORDS.test(b) && !JOB_TITLE_KEYWORDS.test(a)) return { role: b, company: a };
  }
  return {};
}

function detectSection(line: string): keyof typeof SECTION_HEADERS | null {
  for (const [section, re] of Object.entries(SECTION_HEADERS)) {
    if (re.test(line.trim())) return section as keyof typeof SECTION_HEADERS;
  }
  return null;
}

function splitIntoSections(lines: string[]): Record<string, string[]> {
  const sections: Record<string, string[]> = { header: [] };
  let current = "header";
  for (const line of lines) {
    const detected = detectSection(line);
    if (detected) {
      current = detected;
      sections[current] = sections[current] || [];
      continue;
    }
    sections[current] = sections[current] || [];
    sections[current].push(line);
  }
  return sections;
}

function extractPersonalInfo(headerLines: string[], fullText: string) {
  const email = fullText.match(EMAIL_RE)?.[0] || "";
  const phone = headerLines.join(" ").match(PHONE_RE)?.[0]?.trim() || "";
  const linkedin = fullText.match(LINKEDIN_RE)?.[0] || "";
  // Strip the email first so its own domain (e.g. "example.com" in
  // "jane@example.com") is never mistaken for a portfolio/personal site link.
  const textWithoutEmail = email ? fullText.replace(email, "") : fullText;
  const portfolioMatch = textWithoutEmail.match(PORTFOLIO_RE)?.[0] || "";
  const portfolio = portfolioMatch && !portfolioMatch.includes("linkedin") ? portfolioMatch : "";

  // Heuristic: the candidate's name is almost always the first non-empty
  // line of the document that isn't itself contact info. Prefer a line that
  // actually looks like a name (2-4 Title-Case/ALL-CAPS words) before
  // falling back to the old "first plausible non-contact line" heuristic,
  // which could grab a job-title banner or address line instead.
  const fullName =
    headerLines.find((l) => NAME_LINE_RE.test(l.trim()) && !EMAIL_RE.test(l)) ||
    headerLines.find(
      (l) => l.length > 1 && l.length < 60 && !EMAIL_RE.test(l) && !PHONE_RE.test(l.replace(/\d{4}/, ""))
    ) ||
    "";

  // Location: a header line shaped like "City, State/Country" - excluding
  // email/name lines and anything that's actually a skills/tech list (which
  // can also look like "X, Y" once comma-joined).
  const location =
    headerLines.find(
      (l) =>
        LOCATION_RE.test(l.trim()) &&
        !EMAIL_RE.test(l) &&
        l !== fullName &&
        l.length < 60 &&
        extractSkillsFromText(l).length === 0
    ) || "";

  return { fullName: fullName.trim(), email, phone, location: location.trim(), linkedin, portfolio };
}

function extractEducation(lines: string[]): ParsedResume["education"] {
  const entries: ParsedResume["education"] = [];
  let current: Partial<ParsedResume["education"][number]> | null = null;

  const flush = () => {
    if (current && (current.institution || current.degree)) {
      entries.push({
        id: randomUUID(),
        institution: current.institution || "",
        degree: current.degree || "",
        field: current.field || "",
        startDate: current.startDate || "",
        endDate: current.endDate || "",
        gpa: current.gpa || "",
      });
    }
    current = null;
  };

  for (const line of lines) {
    const dateMatch = line.match(DATE_RANGE_RE);
    const gpaStr = matchGpa(line);
    const isDegreeLine = /\b(b\.?tech|bachelor|master|m\.?tech|b\.?sc|m\.?sc|phd|diploma|b\.?e\.?|m\.?e\.?|mba)\b/i.test(
      line
    );

    if (isDegreeLine || (dateMatch && !current)) {
      flush();
      current = {};
    }
    if (!current) current = {};

    if (isDegreeLine) {
      current.degree = line.replace(DATE_RANGE_RE, "").trim();
    } else if (!current.institution && line.length < 100) {
      current.institution = line.replace(DATE_RANGE_RE, "").trim();
    }
    if (dateMatch) {
      current.startDate = dateMatch[1];
      current.endDate = dateMatch[2];
    }
    if (gpaStr) {
      current.gpa = gpaStr;
    }
  }
  flush();
  return entries;
}

/** Fills in role/company on a partial experience entry from one text
 * fragment. Tries splitting a combined "Role at Company" / "Company | Role"
 * line first; falls back to sequential assignment (first line seen -> role,
 * next -> company) when the fragment doesn't clearly split. */
function assignRoleOrCompany(
  current: Partial<ParsedResume["experience"][number]>,
  text: string
): void {
  const split = splitRoleCompany(text);
  if (split.role && split.company) {
    if (!current.role) current.role = split.role;
    if (!current.company) current.company = split.company;
  } else if (!current.role) {
    current.role = text;
  } else if (!current.company) {
    current.company = text;
  }
}

function extractExperience(lines: string[]): ParsedResume["experience"] {
  const entries: ParsedResume["experience"] = [];
  let current: Partial<ParsedResume["experience"][number]> | null = null;
  // Once an entry has bullets, the next non-bullet, non-date line is a new
  // entry's header (role/company), not a continuation of this one - resumes
  // don't reliably have blank-line separators once text is extracted from a
  // PDF, so this is the boundary signal we have.
  let sawBulletsForCurrent = false;

  const flush = () => {
    if (current && (current.company || current.role)) {
      entries.push({
        id: randomUUID(),
        company: current.company || "",
        role: current.role || "",
        startDate: current.startDate || "",
        endDate: current.endDate || "",
        current: current.current || false,
        bullets: current.bullets || [],
      });
    }
    current = null;
    sawBulletsForCurrent = false;
  };

  for (const line of lines) {
    const dateMatch = line.match(DATE_RANGE_RE);
    const isBullet = BULLET_LINE_RE.test(line);

    if (isBullet) {
      if (!current) current = { bullets: [] };
      current.bullets = current.bullets || [];
      current.bullets.push(line.replace(BULLET_LINE_RE, "").trim());
      sawBulletsForCurrent = true;
      continue;
    }

    if (dateMatch) {
      // Bullets already collected for `current` -> this date line belongs
      // to the NEXT entry, not this one.
      if (current && sawBulletsForCurrent) flush();
      if (!current) current = { bullets: [] };
      current.startDate = dateMatch[1];
      current.endDate = dateMatch[2];
      current.current = /present|current/i.test(dateMatch[2]);
      const withoutDate = line.replace(DATE_RANGE_RE, "").trim();
      if (withoutDate) assignRoleOrCompany(current, withoutDate);
      continue;
    }

    // Plain header-ish line (role or company name).
    if (current && sawBulletsForCurrent) flush();
    if (!current) current = { bullets: [] };
    if (line.length >= 100) continue; // too long to be a role/company header
    assignRoleOrCompany(current, line.trim());
  }
  flush();
  return entries;
}

function extractProjects(lines: string[]): ParsedResume["projects"] {
  const entries: ParsedResume["projects"] = [];
  let current: Partial<ParsedResume["projects"][number]> | null = null;
  const descParts: string[] = [];

  const flush = () => {
    if (current && current.name) {
      entries.push({
        id: randomUUID(),
        name: current.name,
        description: descParts.join(" ").trim(),
        technologies: extractSkillsFromText(descParts.join(" ")),
        link: current.link || "",
      });
    }
    current = null;
    descParts.length = 0;
  };

  for (const line of lines) {
    const linkMatch = line.match(/(https?:\/\/[^\s]+)/);
    const isBullet = BULLET_LINE_RE.test(line);

    if (!isBullet && line.length < 80 && !linkMatch) {
      flush();
      current = { name: line.trim() };
      continue;
    }
    if (linkMatch && current) current.link = linkMatch[1];
    if (current) descParts.push(line.replace(BULLET_LINE_RE, "").trim());
  }
  flush();
  return entries;
}

/** Certifications/Achievements/Awards section: one entry per non-empty line
 * (bullet marker stripped), kept separate from experience/education so this
 * content no longer leaks into whichever section happened to precede it. */
function extractCertifications(lines: string[]): string[] {
  return lines.map((l) => l.replace(BULLET_LINE_RE, "").trim()).filter(Boolean);
}

export function parseResumeLocally(fullText: string, lines: string[]): ParsedResume {
  const sections = splitIntoSections(lines);
  const personalInfo = extractPersonalInfo(sections.header || [], fullText);

  const summary = (sections.summary || []).join(" ").trim();
  const education = extractEducation(sections.education || []);
  const experience = extractExperience(sections.experience || []);
  const projects = extractProjects(sections.projects || []);
  const certifications = extractCertifications(sections.certifications || []);

  // Skills: prefer the dedicated section, but always fall back to scanning
  // the whole document so skills mentioned only in bullet points are caught.
  const sectionSkillsText = (sections.skills || []).join(", ");
  const skills = Array.from(
    new Set([...extractSkillsFromText(sectionSkillsText), ...extractSkillsFromText(fullText)])
  );

  return { personalInfo, summary, education, experience, skills, projects, certifications };
}
