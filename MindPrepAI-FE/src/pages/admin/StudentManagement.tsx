import { useMemo, useState } from "react";
import { adminApi } from "../../admin/api";
import { useLoad } from "../../admin/useLoad";
import type { AdminStudent } from "../../admin/types";
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
import { TextInput, Select, Field } from "../../components/admin/Inputs";

function ScoreRing({ value }: { value: number }) {
  const color =
    value >= 75 ? "text-emerald-400" : value >= 50 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-full border-2 border-gray-700 flex items-center justify-center">
        <span className={`text-xs font-bold ${color}`}>{value}</span>
      </div>
    </div>
  );
}

export function StudentManagement() {
  const { data: students, loading, error, reload, setData } = useLoad(() => adminApi.getStudents());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<AdminStudent | null>(null);
  const [editing, setEditing] = useState<AdminStudent | null>(null);
  const [deleting, setDeleting] = useState<AdminStudent | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = query.toLowerCase();
    return students.filter((s) => {
      const matchQ =
        !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [students, query, statusFilter]);

  const handleSave = async () => {
    if (!editing) return;
    setBusy(true);
    await adminApi.updateStudent(editing.id, editing);
    setData((prev) => prev!.map((s) => (s.id === editing.id ? { ...s, ...editing } : s)));
    setBusy(false);
    setEditing(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    await adminApi.deleteStudent(deleting.id);
    setData((prev) => prev!.filter((s) => s.id !== deleting.id));
    setBusy(false);
    setDeleting(null);
  };

  const toggleStatus = async (s: AdminStudent) => {
    const next: AdminStudent["status"] =
      s.status === "active" ? "inactive" : s.status === "inactive" ? "active" : "active";
    await adminApi.updateStudent(s.id, { status: next });
    setData((prev) => prev!.map((x) => (x.id === s.id ? { ...x, status: next } : x)));
  };

  return (
    <div>
      <PageHeader
        title="Student Management"
        subtitle="View, edit and manage all registered students"
        actions={
          <Button variant="primary" onClick={() => setEditing({} as AdminStudent)}>
            + Add Student
          </Button>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <Card
        title={`Students (${filtered.length})`}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <TextInput
              placeholder="Search name or email..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:w-64"
            />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blocked">Blocked</option>
            </Select>
          </div>
        }
      >
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="👨‍🎓"
            title="No students found"
            description="Try adjusting your search or filters."
          />
        ) : (
          <Table<AdminStudent>
            columns={[
              { key: "student", header: "Student" },
              { key: "department", header: "Department" },
              { key: "readiness", header: "Readiness" },
              { key: "ats", header: "ATS" },
              { key: "interviews", header: "Interviews" },
              { key: "status", header: "Status" },
              { key: "actions", header: "Actions", className: "text-right" },
            ]}
            rows={filtered}
            renderRow={(s) => (
              <>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: s.avatarColor }}
                    >
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-medium">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <p className="text-gray-300">{s.department}</p>
                  <p className="text-xs text-gray-500">{s.year}</p>
                </td>
                <td className="py-3 px-4">
                  <ScoreRing value={s.placementReadiness} />
                </td>
                <td className="py-3 px-4 text-gray-300">{s.atsScore}%</td>
                <td className="py-3 px-4 text-gray-300">{s.interviewsTaken}</td>
                <td className="py-3 px-4">
                  <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <IconButton title="View" onClick={() => setSelected(s)}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-9 0a9 9 0 1118 0 9 9 0 01-18 0z" />
                      </svg>
                    </IconButton>
                    <IconButton title="Edit" onClick={() => setEditing({ ...s })}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </IconButton>
                    <IconButton title="Delete" onClick={() => setDeleting(s)} className="hover:text-red-400 hover:bg-red-500/10">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </IconButton>
                  </div>
                </td>
              </>
            )}
          />
        )}
      </Card>

      {/* View modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name || "Student Details"}>
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold"
                style={{ backgroundColor: selected.avatarColor }}
              >
                {selected.name.charAt(0)}
              </div>
              <div>
                <p className="text-white font-semibold text-lg">{selected.name}</p>
                <p className="text-gray-400 text-sm">{selected.email}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="College" value={selected.college} />
              <Detail label="Department" value={selected.department} />
              <Detail label="Batch" value={selected.year} />
              <Detail label="Phone" value={selected.phone} />
              <Detail label="Location" value={selected.location} />
              <Detail label="Status" value={selected.status} />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-800">
              <Metric label="ATS Score" value={`${selected.atsScore}%`} />
              <Metric label="Readiness" value={`${selected.placementReadiness}%`} />
              <Metric label="Avg Interview" value={`${selected.averageInterviewScore}%`} />
              <Metric label="Interviews" value={selected.interviewsTaken} />
              <Metric label="Quiz Attempts" value={selected.quizAttempts} />
              <Metric label="Joined" value={new Date(selected.createdAt).toLocaleDateString()} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium">Strong Subjects</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.strongSubjects.map((t) => (
                    <span key={t} className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full px-2.5 py-0.5">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2 font-medium">Weak Subjects</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.weakSubjects.map((t) => (
                    <span key={t} className="text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded-full px-2.5 py-0.5">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" onClick={() => toggleStatus(selected)}>
                {selected.status === "active" ? "Deactivate" : "Activate"}
              </Button>
              <Button variant="danger" onClick={() => { setDeleting(selected); setSelected(null); }}>
                Block Student
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit Student"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button loading={busy} onClick={handleSave}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Name">
            <TextInput value={editing?.name || ""} onChange={(e) => setEditing((p) => p && { ...p, name: e.target.value })} />
          </Field>
          <Field label="Email">
            <TextInput value={editing?.email || ""} onChange={(e) => setEditing((p) => p && { ...p, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <TextInput value={editing?.phone || ""} onChange={(e) => setEditing((p) => p && { ...p, phone: e.target.value })} />
          </Field>
          <Field label="Department">
            <TextInput value={editing?.department || ""} onChange={(e) => setEditing((p) => p && { ...p, department: e.target.value })} />
          </Field>
          <Field label="Status">
            <Select value={editing?.status || "active"} onChange={(e) => setEditing((p) => p && { ...p, status: e.target.value as AdminStudent["status"] })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="blocked">Blocked</option>
            </Select>
          </Field>
        </div>
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
          Are you sure you want to permanently delete <span className="text-white font-semibold">{deleting?.name}</span>?
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-gray-200">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-800/60 rounded-xl p-3">
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
