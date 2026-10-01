import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getAvailableJobs, type StudentJob } from "../services/jobsApi";
import { AlumniOpenings } from "../components/AlumniOpenings";
import { FloatingCard } from "../components/3d/FloatingCard";

const jobTypes = ["All", "Full-time", "Internship", "Part-time", "Contract", "Remote", "On-site", "Hybrid"];

export function Jobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<StudentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [jobType, setJobType] = useState("All");
  const [sort, setSort] = useState<"latest" | "deadline">("latest");

  useEffect(() => {
    getAvailableJobs()
      .then(setJobs)
      .catch(() => toast.error("Failed to load jobs"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return jobs.filter((j) => {
      const matchQ =
        !q ||
        j.companyName.toLowerCase().includes(q) ||
        j.jobTitle.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q);
      const matchType = jobType === "All" || j.jobType === jobType;
      return matchQ && matchType;
    });
  }, [jobs, query, jobType]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "deadline") {
      arr.sort((a, b) => new Date(a.lastDateToApply).getTime() - new Date(b.lastDateToApply).getTime());
    } else {
      arr.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime());
    }
    return arr;
  }, [filtered, sort]);

  return (
    <div className="min-h-[calc(100vh-4rem)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-fg mb-2">Job Opportunities</h1>
          <p className="text-fg-2 text-lg">
            Explore placement drives and apply to the ones you're eligible for.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-8">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company, role or location..."
            spellCheck={false}
            className="flex-1 bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-fg placeholder-subtle focus:outline-none focus:border-blue-500"
          />
          <select
            value={jobType}
            onChange={(e) => setJobType(e.target.value)}
            className="bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-fg focus:outline-none focus:border-blue-500"
          >
            {jobTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "latest" | "deadline")}
            className="bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-fg focus:outline-none focus:border-blue-500"
          >
            <option value="latest">Newest first</option>
            <option value="deadline">Deadline soonest</option>
          </select>
        </div>

        {loading ? (
          <div className="text-center py-24 text-muted">Loading jobs...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-24 text-muted">
            <p className="text-5xl mb-4">💼</p>
            <p className="text-lg">No jobs available right now.</p>
            <p className="text-sm text-subtle mt-1">Check back later for new opportunities.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sorted.map((job) => {
              const deadlinePassed = new Date(job.lastDateToApply).getTime() < Date.now();
              return (
                <FloatingCard
                  key={job.id}
                  intensity={4}
                  className="group rounded-2xl bg-surface border border-line p-6 transition-all hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl bg-surface border border-line flex items-center justify-center text-sm font-bold text-fg">
                      {job.companyName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex items-center gap-2">
                      {job.eligibilityDetails && (
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            job.eligibilityDetails.eligible
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-yellow-600/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30"
                          }`}
                        >
                          {job.eligibilityDetails.eligible ? "✓ Eligible" : "Not Eligible"}
                        </span>
                      )}
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full border border-blue-500/30 text-blue-600 dark:text-blue-400">
                        {job.jobType}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-fg leading-snug">{job.jobTitle}</h3>
                  <p className="text-sm text-muted mb-1">{job.companyName}</p>
                  <p className="text-sm text-muted mb-4">📍 {job.location}</p>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {job.requiredSkills?.slice(0, 4).map((s) => (
                      <span key={s} className="text-xs px-2 py-1 rounded-md bg-surface text-fg-2">
                        {s}
                      </span>
                    ))}
                  </div>

                  <div className="mt-auto space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{job.package || "—"}</span>
                      <span className={`text-xs ${deadlinePassed ? "text-red-600 dark:text-red-400" : "text-subtle"}`}>
                        Deadline: {new Date(job.lastDateToApply).toLocaleDateString()}
                      </span>
                    </div>

                    {job.hasApplied ? (
                      <button
                        disabled
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-surface text-subtle cursor-not-allowed"
                      >
                        ✓ Applied
                      </button>
                    ) : job.eligibilityDetails?.eligible ? (
                      <button
                        onClick={() => navigate(`/jobs/${job.id}`)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all"
                      >
                        Apply Now
                      </button>
                    ) : (
                      <button
                        onClick={() => navigate(`/jobs/${job.id}`)}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-yellow-600/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/30 hover:bg-yellow-600/25 transition-all"
                      >
                        View &amp; Eligibility
                      </button>
                    )}
                  </div>
                </FloatingCard>
              );
            })}
          </div>
        )}

        <AlumniOpenings />
      </div>
    </div>
  );
}
