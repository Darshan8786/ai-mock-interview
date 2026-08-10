import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getMyApplications, type StudentApplication } from "../services/jobsApi";

const statusStyle: Record<string, { label: string; cls: string }> = {
  applied: { label: "Applied", cls: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  shortlisted: { label: "Shortlisted", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
  rejected: { label: "Rejected", cls: "bg-red-500/10 text-red-400 border-red-500/30" },
  selected: { label: "Selected", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  withdrawn: { label: "Withdrawn", cls: "bg-gray-500/10 text-gray-400 border-gray-600/40" },
};

export function MyApplications() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<StudentApplication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyApplications()
      .then(setApps)
      .catch(() => toast.error("Failed to load your applications"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-black px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">My Applications</h1>
          <p className="text-gray-300 text-lg">Track the status of every job you've applied to.</p>
        </div>

        {loading ? (
          <div className="text-center py-24 text-gray-400">Loading applications...</div>
        ) : apps.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-lg">You haven't applied to any jobs yet.</p>
            <button
              onClick={() => navigate("/jobs")}
              className="mt-4 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
            >
              Browse Jobs
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {apps.map((app) => {
              const style = statusStyle[app.status] || statusStyle.applied;
              const deadlinePassed =
                app.lastDateToApply && new Date(app.lastDateToApply).getTime() < Date.now();
              return (
                <div
                  key={app.id}
                  className="rounded-2xl bg-gray-900 border border-gray-700 p-6 flex flex-col md:flex-row md:items-center gap-4 transition-all hover:border-blue-500"
                >
                  <div className="w-12 h-12 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-sm font-bold text-white">
                    {(app.companyName || "?").slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white">{app.jobTitle}</h3>
                    <p className="text-sm text-gray-400">
                      {app.companyName}
                      {app.location ? ` • ${app.location}` : ""} • {app.jobType}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Applied on {new Date(app.appliedAt).toLocaleDateString()}
                      {deadlinePassed && " • Job closed"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {app.package && <span className="text-emerald-400 text-sm font-semibold">{app.package}</span>}
                    <span className={`text-xs font-medium px-3 py-1 rounded-full border ${style.cls}`}>
                      {style.label}
                    </span>
                    <button
                      onClick={() => app.jobId && navigate(`/jobs/${app.jobId}`)}
                      className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                    >
                      View →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
