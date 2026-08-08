import { useMemo, useState } from "react";
import { adminApi } from "../../admin/api";
import { useLoad } from "../../admin/useLoad";
import type { AdminJob, JobApplicant } from "../../admin/types";
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
import { TextInput, TextArea, Select, Field } from "../../components/admin/Inputs";

interface JobForm {
  company: string;
  title: string;
  location: string;
  salary: string;
  eligibility: string;
  skillsRequired: string[];
  deadline: string;
  status: "open" | "closed" | "draft";
  description: string;
}

const emptyJob: JobForm = {
  company: "",
  title: "",
  location: "Bengaluru",
  salary: "",
  eligibility: "",
  skillsRequired: [],
  deadline: "",
  status: "draft",
  description: "",
};

const applicantTones: Record<JobApplicant["status"], "green" | "yellow" | "red" | "blue"> = {
  applied: "blue",
  shortlisted: "yellow",
  rejected: "red",
  hired: "green",
};

export function JobManagement() {
  const { data: jobs, loading, error, reload, setData } = useLoad(() => adminApi.getJobs());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [applicantsFor, setApplicantsFor] = useState<AdminJob | null>(null);
  const [applicants, setApplicants] = useState<JobApplicant[]>([]);
  const [applicantsLoading, setApplicantsLoading] = useState(false);
  const [form, setForm] = useState<JobForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminJob | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const q = query.toLowerCase();
    return jobs.filter((j) => {
      const matchQ = !q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || j.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [jobs, query, statusFilter]);

  const openApplicants = async (job: AdminJob) => {
    setApplicantsFor(job);
    setApplicantsLoading(true);
    setApplicants([]);
    const data = await adminApi.getJobApplicants(job.id);
    setApplicants(data);
    setApplicantsLoading(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyJob);
  };

  const openEdit = (job: AdminJob) => {
    setEditingId(job.id);
    setForm({
      company: job.company,
      title: job.title,
      location: job.location,
      salary: job.salary,
      eligibility: job.eligibility,
      skillsRequired: job.skillsRequired,
      deadline: new Date(job.deadline).toISOString().slice(0, 10),
      status: job.status,
      description: job.description,
    });
  };

  const handleSave = async () => {
    if (!form) return;
    setBusy(true);
    if (editingId) {
      const updated = await adminApi.updateJob(editingId, form);
      setData((prev) => prev!.map((j) => (j.id === editingId ? { ...j, ...updated } : j)));
    } else {
      const created = await adminApi.createJob(form);
      setData((prev) => [created, ...prev!]);
    }
    setBusy(false);
    setForm(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    await adminApi.deleteJob(deleting.id);
    setData((prev) => prev!.filter((j) => j.id !== deleting.id));
    setBusy(false);
    setDeleting(null);
  };

  return (
    <div>
      <PageHeader
        title="Job Management"
        subtitle="Post and manage placement opportunities"
        actions={<Button variant="primary" onClick={openCreate}>+ Post Job</Button>}
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <Card
        title={`Jobs (${filtered.length})`}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <TextInput
              placeholder="Search company or role..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:w-56"
            />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="draft">Draft</option>
              <option value="closed">Closed</option>
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
              { key: "salary", header: "Salary" },
              { key: "deadline", header: "Deadline" },
              { key: "applicants", header: "Applicants" },
              { key: "status", header: "Status" },
              { key: "actions", header: "Actions", className: "text-right" },
            ]}
            rows={filtered}
            renderRow={(j) => {
              const expired = new Date(j.deadline).getTime() < Date.now() && j.status === "open";
              return (
                <>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-white">
                        {j.company.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium">{j.title}</p>
                        <p className="text-xs text-gray-500">{j.company}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-300">{j.location}</td>
                  <td className="py-3 px-4 text-emerald-400 font-medium">{j.salary}</td>
                  <td className="py-3 px-4">
                    <span className={expired ? "text-red-400" : "text-gray-300"}>
                      {new Date(j.deadline).toLocaleDateString()}
                      {expired && " ⚠"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-300">{j.applicants}</td>
                  <td className="py-3 px-4">
                    <Badge tone={statusTone(j.status)}>{j.status}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton title="Applicants" onClick={() => openApplicants(j)} className="hover:text-blue-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </IconButton>
                      <IconButton title="Edit" onClick={() => openEdit(j)}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </IconButton>
                      <IconButton title="Delete" onClick={() => setDeleting(j)} className="hover:text-red-400 hover:bg-red-500/10">
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

      {/* Create/Edit modal */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={editingId ? "Edit Job" : "Post Job"}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            <Button loading={busy} onClick={handleSave}>Save Job</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company">
              <TextInput value={form?.company || ""} onChange={(e) => setForm((p) => p && { ...p, company: e.target.value })} />
            </Field>
            <Field label="Role / Title">
              <TextInput value={form?.title || ""} onChange={(e) => setForm((p) => p && { ...p, title: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Location">
              <TextInput value={form?.location || ""} onChange={(e) => setForm((p) => p && { ...p, location: e.target.value })} />
            </Field>
            <Field label="Salary Range">
              <TextInput placeholder="e.g. 8-12 LPA" value={form?.salary || ""} onChange={(e) => setForm((p) => p && { ...p, salary: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Eligibility">
              <TextInput placeholder="e.g. CSE, 2026 batch, 60%+" value={form?.eligibility || ""} onChange={(e) => setForm((p) => p && { ...p, eligibility: e.target.value })} />
            </Field>
            <Field label="Application Deadline">
              <TextInput type="date" value={form?.deadline || ""} onChange={(e) => setForm((p) => p && { ...p, deadline: e.target.value })} />
            </Field>
          </div>
          <Field label="Required Skills (comma separated)">
            <TextInput
              placeholder="e.g. Java, SQL, DSA"
              value={form?.skillsRequired.join(", ") || ""}
              onChange={(e) => setForm((p) => p && { ...p, skillsRequired: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            />
          </Field>
          <Field label="Description">
            <TextArea rows={3} value={form?.description || ""} onChange={(e) => setForm((p) => p && { ...p, description: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={form?.status || "draft"} onChange={(e) => setForm((p) => p && { ...p, status: e.target.value as JobForm["status"] })}>
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </Select>
          </Field>
        </div>
      </Modal>

      {/* Applicants modal */}
      <Modal
        open={!!applicantsFor}
        onClose={() => setApplicantsFor(null)}
        title={`Applicants — ${applicantsFor?.title} @ ${applicantsFor?.company}`}
        size="lg"
      >
        {applicantsLoading ? (
          <TableSkeleton />
        ) : (
          <Table<JobApplicant>
            columns={[
              { key: "name", header: "Applicant" },
              { key: "ats", header: "ATS Score" },
              { key: "applied", header: "Applied" },
              { key: "status", header: "Status" },
            ]}
            rows={applicants}
            renderRow={(a) => (
              <>
                <td className="py-3 px-4">
                  <p className="text-white font-medium">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.email}</p>
                </td>
                <td className="py-3 px-4 text-gray-300">{a.atsScore}%</td>
                <td className="py-3 px-4 text-gray-300">{new Date(a.appliedAt).toLocaleDateString()}</td>
                <td className="py-3 px-4">
                  <Badge tone={applicantTones[a.status]}>{a.status}</Badge>
                </td>
              </>
            )}
          />
        )}
      </Modal>

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
          Delete <span className="text-white font-semibold">{deleting?.title}</span> at{" "}
          <span className="text-white font-semibold">{deleting?.company}</span>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
