import { useMemo, useState } from "react";
import { adminApi } from "../../admin/api";
import { useLoad } from "../../admin/useLoad";
import type { AdminResume } from "../../admin/types";
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

function AtsBar({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-gray-300 w-9 text-right">{score}%</span>
    </div>
  );
}

export function ResumeManagement() {
  const { data: resumes, loading, error, reload, setData } = useLoad(() => adminApi.getResumes());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<AdminResume | null>(null);
  const [deleting, setDeleting] = useState<AdminResume | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!resumes) return [];
    const q = query.toLowerCase();
    return resumes.filter((r) => {
      const matchQ = !q || r.studentName.toLowerCase().includes(q) || r.fileName.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [resumes, query, statusFilter]);

  const avgScore = resumes?.length
    ? Math.round(resumes.reduce((a, r) => a + r.atsScore, 0) / resumes.length)
    : 0;

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    await adminApi.deleteResume(deleting.id);
    setData((prev) => prev!.filter((r) => r.id !== deleting.id));
    setBusy(false);
    setDeleting(null);
  };

  return (
    <div>
      <PageHeader
        title="Resume Management"
        subtitle={`Monitor resume uploads and ATS scores — avg ${avgScore}%`}
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <Card
        title={`Resumes (${filtered.length})`}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <TextInput
              placeholder="Search student or file..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:w-64"
            />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="analyzed">Analyzed</option>
              <option value="parsing">Parsing</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </Select>
          </div>
        }
      >
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState icon="📄" title="No resumes found" description="Try adjusting your search or filters." />
        ) : (
          <Table<AdminResume>
            columns={[
              { key: "student", header: "Student" },
              { key: "file", header: "File" },
              { key: "ats", header: "ATS Score" },
              { key: "topRole", header: "Top Role Match" },
              { key: "skills", header: "Skills" },
              { key: "status", header: "Status" },
              { key: "actions", header: "Actions", className: "text-right" },
            ]}
            rows={filtered}
            renderRow={(r) => (
              <>
                <td className="py-3 px-4">
                  <p className="text-white font-medium">{r.studentName}</p>
                  <p className="text-xs text-gray-500">{r.studentEmail}</p>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div>
                      <p className="text-gray-300 text-xs">{r.fileName}</p>
                      <p className="text-gray-500 text-xs">{r.fileSize} · {new Date(r.uploadedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <AtsBar score={r.atsScore} />
                </td>
                <td className="py-3 px-4 text-gray-300">{r.topRole}</td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {r.skills.slice(0, 3).map((s) => (
                      <span key={s} className="text-xs bg-gray-800 text-gray-300 border border-gray-700 rounded-full px-2 py-0.5">
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <IconButton title="View details" onClick={() => setSelected(r)}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-9 0a9 9 0 1118 0 9 9 0 01-18 0z" />
                      </svg>
                    </IconButton>
                    <IconButton title="Download" onClick={() => {}} className="hover:text-blue-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </IconButton>
                    <IconButton title="Delete" onClick={() => setDeleting(r)} className="hover:text-red-400 hover:bg-red-500/10">
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

      {/* Details modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Resume Analysis Details">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-lg">{selected.studentName}</p>
                <p className="text-gray-400 text-sm">{selected.fileName}</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{selected.atsScore}%</p>
                <p className="text-xs text-gray-500">ATS Score</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">ATS Score Breakdown</p>
              <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    selected.atsScore >= 75 ? "bg-emerald-500" : selected.atsScore >= 50 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${selected.atsScore}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Detected Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.skills.map((s) => (
                    <span key={s} className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full px-2.5 py-0.5">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">Missing Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.missingKeywords.map((s) => (
                    <span key={s} className="text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded-full px-2.5 py-0.5">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gray-800/50 rounded-xl p-4 text-sm">
              <p className="text-gray-500 mb-1">Top Role Match</p>
              <p className="text-white font-semibold">{selected.topRole}</p>
            </div>
          </div>
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
          Delete resume <span className="text-white font-semibold">{deleting?.fileName}</span> for{" "}
          <span className="text-white font-semibold">{deleting?.studentName}</span>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
