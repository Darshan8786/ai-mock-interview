import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";

const ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs/in/search/1";

interface AdzunaJob {
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  created: string;
  redirect_url: string;
  description: string;
  category?: { label: string };
}

function hasAdzunaConfig(): boolean {
  return Boolean(env.ADZUNA_APP_ID && env.ADZUNA_APP_KEY);
}

function normalizeSalary(value?: number): string {
  if (!value || value <= 0) return "Not specified";
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)} LPA`;
  return `₹${value.toLocaleString("en-IN")}`;
}

export const searchJobs = asyncHandler(async (req: Request, res: Response) => {
  const what = (req.query.what as string) || "software engineer";
  const where = (req.query.where as string) || "Bengaluru";
  const resultsPerPage = Math.min(Number(req.query.limit) || 10, 20);

  if (!hasAdzunaConfig()) {
    throw new AppError(
      "Adzuna API is not configured. Add ADZUNA_APP_ID and ADZUNA_APP_KEY to your .env file (free from developer.adzuna.com).",
      500
    );
  }

  const params = new URLSearchParams({
    app_id: env.ADZUNA_APP_ID,
    app_key: env.ADZUNA_APP_KEY,
    results_per_page: String(resultsPerPage),
    what,
    where,
    "content-type": "application/json",
  });

  const url = `${ADZUNA_BASE}?${params.toString()}`;

  let resApi: Awaited<ReturnType<typeof fetch>> | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    resApi = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MindPrep-AI/1.0 (job search)",
      },
    });

    if (resApi.ok) break;

    console.error(`[Adzuna Error] (attempt ${attempt}/3)`, resApi.status);
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }

  if (!resApi || !resApi.ok) {
    const body = await resApi?.text().catch(() => "");
    console.error("[Adzuna Error] final", resApi?.status, body);
    throw new AppError(`Adzuna request failed (${resApi?.status}). Check your API key/quota.`, 502);
  }

  const data = await resApi.json();
  const jobs: AdzunaJob[] = data.results || [];

  const jobsOut = jobs.map((j) => ({
    title: j.title,
    company: j.company?.display_name || "Unknown",
    location: j.location?.display_name || where,
    salary_min: normalizeSalary(j.salary_min),
    salary_max: normalizeSalary(j.salary_max),
    salary_is_predicted: j.salary_is_predicted === "1",
    created: j.created,
    description: j.description?.slice(0, 500),
    url: j.redirect_url,
    category: j.category?.label || "General",
  }));

  res.json({
    success: true,
    data: {
      query: { what, where },
      count: jobsOut.length,
      jobs: jobsOut,
    },
  });
});
