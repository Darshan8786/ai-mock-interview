import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../../admin/api";
import { useLoad } from "../../admin/useLoad";
import type { AdminJob } from "../../admin/types";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Table } from "../../components/admin/Table";
import { Badge } from "../../components/admin/Badge";
import { statusTone } from "../../components/admin/statusTone";
import { Button, IconButton } from "../../components/admin/Button";
import { Modal } from "../../components/admin/Modal";
import { TableSkeleton } from "../../components/admin/Skeleton";
import { EmptyState } from "../../components/admin/EmptyState";
import { ErrorState } from "../../components/admin/ErrorState";
import { TextInput, Select } from "../../components/admin/Inputs";

export function JobManagement() {
  const { data: jobs, loading, error, reload, setData } = useLoad(() => adminApi.getJobs());
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleting, setDeleting] = useState<AdminJob | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const q = query.toLowerCase();
    return jobs.filter((j) => {
      const matchQ =
        !q ||
        j.jobTitle.toLowerCase().includes(q) ||
        j.companyName.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || j.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [jobs, query, statusFilter]);

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await adminApi.deleteJob(deleting.id);
      setData((prev) => prev!.filter((j) => j.id !== deleting.id));
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Job Management"
        subtitle="Post and manage placement opportunities"
        actions={
          <Button variant="primary" onClick={() => navigate("/admin/jobs/create")}>
            + Post Job
          </Button>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <Card
        title={`Jobs (${filtered.length})`}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <TextInput
              placeholder="Search company, role or location..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:w-56"
            />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="closed">Closed</option>
              <option value="expired">Expired</option>
            </Select>
          </div>
        }
      >
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState icon="💼" title="No jobs found" description="Post a new job to get started." />
        ) : (
          <Table<AdminJob>
            columns={[
              { key: "job", header: "Job" },
              { key: "location", header: "Location" },
              { key: "type", header: "Type" },
              { key: "package", header: "Package" },
              { key: "deadline", header: "Deadline" },
              { key: "applicants", header: "Applicants" },
              { key: "eligible", header: "Eligible" },
              { key: "status", header: "Status" },
              { key: "actions", header: "Actions", className: "text-right" },
            ]}
            rows={filtered}
            renderRow={(j) => {
              const expired = j.isExpired || (new Date(j.lastDateToApply).getTime() < Date.now() && j.status === "active");
              return (
                <>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-white">
                        {j.companyName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium">{j.jobTitle}</p>
                        <p className="text-xs text-gray-500">{j.companyName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-300">{j.location}</td>
                  <td className="py-3 px-4 text-gray-300">{j.jobType}</td>
                  <td className="py-3 px-4 text-emerald-400 font-medium">{j.package || "—"}</td>
                  <td className="py-3 px-4">
                    <span className={expired ? "text-red-400" : "text-gray-300"}>
                      {new Date(j.lastDateToApply).toLocaleDateString()}
                      {expired && " ⚠"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-300">{j.applicants}</td>
                  <td className="py-3 px-4">
                    {j.eligibilityCounts ? (
                      <span className="text-emerald-400 font-medium">
                        {j.eligibilityCounts.eligible}
                        <span className="text-gray-500 font-normal">/{j.eligibilityCounts.total}</span>
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Badge tone={expired ? "red" : statusTone(j.status)}>
                      {expired ? "expired" : j.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        title="Eligible students"
                        onClick={() => navigate(`/admin/jobs/${j.id}/eligibility`)}
                        className="hover:text-emerald-400"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </IconButton>
                      <IconButton
                        title="View applications"
                        onClick={() => navigate(`/admin/jobs/${j.id}/applications`)}
                        className="hover:text-blue-400"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </IconButton>
                      <IconButton
                        title="Edit"
                        onClick={() => navigate(`/admin/jobs/${j.id}/edit`)}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </IconButton>
                      <IconButton
                        title="Delete"
                        onClick={() => setDeleting(j)}
                        className="hover:text-red-400 hover:bg-red-500/10"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </IconButton>
                    </div>
                  </td>
                </>
              );
            }}
          />
        )}
      </Card>

      {/* Delete confirm */}
      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Confirm Deletion"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" loading={busy} onClick={handleDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-gray-300 text-sm">
          Delete <span className="text-white font-semibold">{deleting?.jobTitle}</span> at{" "}
          <span className="text-white font-semibold">{deleting?.companyName}</span>? This will also
          remove all submitted applications. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
