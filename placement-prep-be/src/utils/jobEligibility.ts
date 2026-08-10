/**
 * Backend-only eligibility validation for a job.
 *
 * NEVER trust eligibility data sent from the frontend — this always reads the
 * student record fetched from the authenticated request (req.user) or the DB.
 *
 * Criteria are read entirely from `job.eligibility` (minimumCGPA,
 * maximumBacklogs, allowedDepartments) — nothing is hardcoded.
 */
export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

const DEPT_NORMALIZE: Record<string, string> = {
  cse: "computer science",
  "computer science": "computer science",
  "comp sci": "computer science",
  "computer science & engineering": "computer science",
  "computer science and engineering": "computer science",
  ise: "information science",
  "information science": "information science",
  "information science & engineering": "information science",
  "information science and engineering": "information science",
  ece: "electronics & communication",
  "electronics & communication": "electronics & communication",
  "electronics and communication": "electronics & communication",
  "electronics & communication engineering": "electronics & communication",
  eee: "electrical & electronics",
  "electrical & electronics": "electrical & electronics",
  "electrical and electronics": "electrical & electronics",
  "electrical & electronics engineering": "electrical & electronics",
  ee: "electrical",
  electrical: "electrical",
  mech: "mechanical",
  mechanical: "mechanical",
  me: "mechanical",
  "mechanical engineering": "mechanical",
  civil: "civil",
  "civil engineering": "civil",
  chemical: "chemical",
  "chemical engineering": "chemical",
  biotech: "biotechnology",
  biotechnology: "biotechnology",
  ai: "artificial intelligence",
  "artificial intelligence": "artificial intelligence",
  "ai & ml": "artificial intelligence & machine learning",
  "ai and ml": "artificial intelligence & machine learning",
  "artificial intelligence & machine learning": "artificial intelligence & machine learning",
};

export function normalizeDepartment(raw: string): string {
  const key = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
  return DEPT_NORMALIZE[key] || key;
}

export function computeJobEligibility(job: any, student: any): EligibilityResult {
  const reasons: string[] = [];

  // ── Department ──────────────────────────────────────────
  const allowed = Array.isArray(job.eligibility?.allowedDepartments)
    ? job.eligibility.allowedDepartments.map(normalizeDepartment).filter(Boolean)
    : [];
  const studentDept = normalizeDepartment(student?.department || "");
  if (allowed.length > 0) {
    if (!studentDept) {
      reasons.push("Add your department in your profile to apply");
    } else if (!allowed.includes(studentDept)) {
      reasons.push(
        `Department "${student?.department || "not set"}" is not eligible (allowed: ${job.eligibility.allowedDepartments.join(", ")})`
      );
    }
  }

  // ── CGPA ────────────────────────────────────────────────
  const minCgpa = job.eligibility?.minimumCGPA;
  if (typeof minCgpa === "number" && minCgpa > 0) {
    const studentCgpa = student?.cgpa;
    if (typeof studentCgpa !== "number" || studentCgpa <= 0) {
      reasons.push(`CGPA not set in profile (required minimum: ${minCgpa})`);
    } else if (studentCgpa < minCgpa) {
      reasons.push(`CGPA ${studentCgpa} is below the required CGPA of ${minCgpa}.`);
    }
  }

  // ── Backlogs ────────────────────────────────────────────
  const maxBacklogs = job.eligibility?.maximumBacklogs;
  if (typeof maxBacklogs === "number" && maxBacklogs >= 0) {
    const backlogs = student?.backlogs ?? 0;
    if (backlogs > maxBacklogs) {
      reasons.push(
        `Student has ${backlogs} backlog${backlogs > 1 ? "s" : ""}. Maximum allowed backlogs: ${maxBacklogs}.`
      );
    }
  }

  return { eligible: reasons.length === 0, reasons };
}
