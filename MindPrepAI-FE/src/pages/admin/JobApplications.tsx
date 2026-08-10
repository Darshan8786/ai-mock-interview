import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { adminApi } from "../../admin/api";
import type { AdminJob, JobApplicant, JobApplicationsResponse, ApplicationStatus } from "../../admin/types";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Table } from "../../components/admin/Table";
import { Badge } from "../../components/admin/Badge";
import { Button, IconButton } from "../../components/admin/Button";
import { TableSkeleton } from "../../components/admin/Skeleton";
import { EmptyState } from "../../components/admin/EmptyState";
import { ErrorState } from "../../components/admin/ErrorState";

const applicantTone: Record<ApplicationStatus, "blue" | "yellow" | "red" | "green" | "gray"> = {
  applied: "blue",
  shortlisted: "yellow",
  rejected: "red",
  selected: "green",
  withdrawn: "gray",
};

const statCards = [
  { key: "total", label: "Total", color: "text-gray-200" },
  { key: "applied", label: "Applied", color: "text-blue-400" },
  { key: "shortlisted", label: "Shortlisted", color: "text-yellow-400" },
  { key: "rejected", label: "Rejected", color: "text-red-400" },
  { key: "selected", label: "Selected", color: "text-emerald-400" },
  { key: "withdrawn", label: "Withdrawn", color: "text-gray-500" },
];

export function JobApplications() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<JobApplicationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await adminApi.getJobApplications(id);
      setData(res);
    } catch (e: any) {
      setError(e.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const changeStatus = async (app: JobApplicant, status: ApplicationStatus) => {
    setBusyId(app.id);
    try {
      await adminApi.updateApplicationStatus(app.id, status);
      toast.success(`Marked as ${status}`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to update status");
    } finally {
      setBusyId(null);
    }
  };

  const job: AdminJob | null = data?.job ?? null;
  const stats = data?.stats ?? null;
  const applications: JobApplicant[] = data?.applications ?? [];

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle={
          job ? `${job.jobTitle} at ${job.companyName}` : "Job applications"
        }
        actions={
          <div className="flex items-center gap-2">
            {job && (
              <Button variant="secondary" onClick={() => navigate(`/admin/jobs/${job.id}/edit`)}>
                Edit Job
              </Button>
            )}
            <Button variant="ghost" onClick={() => navigate("/admin/jobs")}>
              ← Back to Jobs
            </Button>
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={load} />}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {statCards.map((s) => (
            <div key={s.key} className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
              <p className="text-2xl font-bold text-white">{stats[s.key as keyof typeof stats] ?? 0}</p>
              <p className={`text-xs font-medium uppercase tracking-wider mt-1 ${s.color}`}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <Card title={`Applicants (${applications.length})`}>
        {loading ? (
          <TableSkeleton />
        ) : applications.length === 0 ? (
          <EmptyState icon="📋" title="No applications yet" description="Students will appear here once they apply to this job." />
        ) : (
          <Table<JobApplicant>
            columns={[
              { key: "student", header: "Applicant" },
              { key: "dept", header: "Department" },
              { key: "cgpa", header: "CGPA" },
              { key: "applied", header: "Applied" },
              { key: "status", header: "Status" },
              { key: "actions", header: "Actions", className: "text-right" },
            ]}
            rows={applications}
            renderRow={(a) => (
              <>
                <td className="py-3 px-4">
                  <p className="text-white font-medium">{a.studentName || "Unknown"}</p>
                  <p className="text-xs text-gray-500">
                    {a.usn || "—"} {a.email && `• ${a.email}`}
                  </p>
                </td>
                <td className="py-3 px-4 text-gray-300">{a.department || "—"}</td>
                <td className="py-3 px-4 text-gray-300">{typeof a.cgpa === "number" ? a.cgpa.toFixed(2) : "—"}</td>
                <td className="py-3 px-4 text-gray-300">{new Date(a.appliedAt).toLocaleDateString()}</td>
                <td className="py-3 px-4">
                  <Badge tone={applicantTone[a.status] || "gray"}>{a.status}</Badge>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center justify-end gap-1.5">
                    {a.status !== "selected" && (
                      <Button
                        variant="success"
                        className="!px-2.5 !py-1 text-xs"
                        loading={busyId === a.id}
                        onClick={() => changeStatus(a, "selected")}
                      >
                        Select
                      </Button>
                    )}
                    {a.status !== "shortlisted" && a.status !== "selected" && (
                      <Button
                        variant="secondary"
                        className="!px-2.5 !py-1 text-xs"
                        loading={busyId === a.id}
                        onClick={() => changeStatus(a, "shortlisted")}
                      >
                        Shortlist
                      </Button>
                    )}
                    {a.status !== "rejected" && (
                      <Button
                        variant="danger"
                        className="!px-2.5 !py-1 text-xs"
                        loading={busyId === a.id}
                        onClick={() => changeStatus(a, "rejected")}
                      >
                        Reject
                      </Button>
                    )}
                    <IconButton
                      title={a.resumeUrl ? "Open resume" : "No resume uploaded"}
                      className={a.resumeUrl ? "hover:text-blue-400" : "opacity-40 cursor-not-allowed"}
                      onClick={() => {
                        if (a.resumeUrl) window.open(a.resumeUrl, "_blank", "noopener,noreferrer");
                      }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </IconButton>
                  </div>
                </td>
              </>
            )}
          />
        )}
      </Card>
    </div>
  );
}
