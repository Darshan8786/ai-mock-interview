import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { getJobDetail, applyToJob, type StudentJob } from "../services/jobsApi";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 border-b border-gray-800">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white text-sm text-right font-medium">{value || "—"}</span>
    </div>
  );
}

export function JobDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState<StudentJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!id) return;
    getJobDetail(id)
      .then(setJob)
      .catch((e) => setError(e.response?.data?.message || e.message || "Failed to load job"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleApply = async () => {
    if (!id) return;
    setApplying(true);
    try {
      await applyToJob(id);
      toast.success("Application submitted successfully!");
      const updated = await getJobDetail(id);
      setJob(updated);
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || "Failed to apply");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-gray-400">Loading job...</div>;
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center px-6">
        <p className="text-5xl mb-4">🔍</p>
        <p className="text-white text-lg mb-1">{error || "Job not found"}</p>
        <button
          onClick={() => navigate("/jobs")}
          className="mt-4 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
        >
          ← Back to Jobs
        </button>
      </div>
    );
  }

  const { eligibilityDetails } = job;
  const eligible = eligibilityDetails?.eligible ?? true;
  const reasons = eligibilityDetails?.reasons ?? [];
  const applied = job.hasApplied;

  return (
    <div className="min-h-screen bg-black px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate("/jobs")}
          className="text-gray-400 hover:text-white text-sm mb-6 transition"
        >
          ← Back to Jobs
        </button>

        {/* Header */}
        <div className="rounded-2xl bg-gray-900 border border-gray-700 p-8 mb-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center text-lg font-bold text-white">
                {job.companyName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">{job.jobTitle}</h1>
                <p className="text-gray-400 mt-1">
                  {job.companyName} • {job.location} • {job.jobType}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {job.requiredSkills?.map((s) => (
                    <span key={s} className="text-xs px-2.5 py-1 rounded-md bg-gray-800 text-gray-300">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="shrink-0 text-left md:text-right">
              <p className="text-2xl text-emerald-400 font-bold">{job.package || "—"}</p>
              <p className="text-xs text-gray-500 mt-1">
                Deadline: {new Date(job.lastDateToApply).toLocaleDateString()}
              </p>
              <p className="text-xs text-gray-500">
                {job.numberOfOpenings} opening{job.numberOfOpenings > 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Action + eligibility */}
        <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6 mb-6">
          {applied ? (
            <div className="flex items-center gap-3 text-emerald-400 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              You have applied to this job.
            </div>
          ) : eligible ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <p className="text-green-400 text-sm font-medium">
                ✓ You are eligible for this job
              </p>
              <button
                onClick={handleApply}
                disabled={applying}
                className="ml-auto px-8 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60 transition-all"
              >
                {applying ? "Applying..." : "Apply Now"}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-yellow-400 font-semibold mb-2">
                You are not currently eligible for this job.
              </p>
              <ul className="space-y-1.5">
                {reasons.map((r, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-yellow-500">•</span> {r}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 mt-3">
                Update your profile (CGPA, department, graduation year) if any information is out of date.
              </p>
            </div>
          )}
        </div>

        {/* Details */}
        {job.jobDescription && (
          <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-3">Job Description</h2>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{job.jobDescription}</p>
          </div>
        )}

        <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Job Details</h2>
          <InfoRow label="Experience" value={job.experience} />
          <InfoRow label="Package" value={job.package} />
          <InfoRow label="Location" value={job.location} />
          <InfoRow label="Job Type" value={job.jobType} />
          <InfoRow label="Openings" value={String(job.numberOfOpenings)} />
          <InfoRow label="Posted On" value={new Date(job.postedAt).toLocaleDateString()} />
        </div>

        <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Eligibility Criteria</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <InfoRow
              label="Minimum CGPA"
              value={job.eligibility?.minimumCGPA != null ? `${job.eligibility.minimumCGPA} CGPA` : "Any"}
            />
            <InfoRow
              label="Maximum Backlogs"
              value={job.eligibility?.maximumBacklogs != null ? String(job.eligibility.maximumBacklogs) : "Any"}
            />
            <InfoRow
              label="Departments"
              value={job.eligibility?.allowedDepartments?.length ? job.eligibility.allowedDepartments.join(", ") : "All"}
            />
          </div>
        </div>

        {job.qualifications && (
          <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-3">Qualifications</h2>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{job.qualifications}</p>
          </div>
        )}

        {job.responsibilities && (
          <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-3">Responsibilities</h2>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{job.responsibilities}</p>
          </div>
        )}

        {job.selectionProcess && (
          <div className="rounded-2xl bg-gray-900 border border-gray-700 p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-3">Selection Process</h2>
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{job.selectionProcess}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-8">
          {job.companyWebsite && (
            <a
              href={job.companyWebsite}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-semibold hover:bg-gray-700 transition"
            >
              Visit Company Website
            </a>
          )}
          {job.applicationLink && (
            <a
              href={job.applicationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-semibold hover:bg-gray-700 transition"
            >
              Apply on Company Portal
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
