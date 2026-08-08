import { useMemo, useState } from "react";
import { adminApi } from "../../admin/api";
import { useLoad } from "../../admin/useLoad";
import type { AdminInterview } from "../../admin/types";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Table } from "../../components/admin/Table";
import { Badge } from "../../components/admin/Badge";
import { statusTone } from "../../components/admin/statusTone";
import { IconButton } from "../../components/admin/Button";
import { Modal } from "../../components/admin/Modal";
import { TableSkeleton } from "../../components/admin/Skeleton";
import { EmptyState } from "../../components/admin/EmptyState";
import { ErrorState } from "../../components/admin/ErrorState";
import { Select } from "../../components/admin/Inputs";

function ScoreBar({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? "bg-emerald-500" : value >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-200 font-medium">{value}%</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function InterviewManagement() {
  const { data: interviews, loading, error, reload } = useLoad(() => adminApi.getInterviews());
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<AdminInterview | null>(null);

  const filtered = useMemo(() => {
    if (!interviews) return [];
    const q = query.toLowerCase();
    return interviews.filter((i) => {
      const matchQ = !q || i.studentName.toLowerCase().includes(q) || i.jobRole.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || i.status === statusFilter;
      const matchType = typeFilter === "all" || i.interviewType === typeFilter;
      return matchQ && matchStatus && matchType;
    });
  }, [interviews, query, statusFilter, typeFilter]);

  const completed = interviews?.filter((i) => i.status === "completed") ?? [];
  const avgOverall = completed.length
    ? Math.round(completed.reduce((a, i) => a + i.overallScore, 0) / completed.length)
    : 0;

  return (
    <div>
      <PageHeader
        title="Interview Management"
        subtitle={`Monitor AI interview sessions — avg score ${avgOverall}% across ${completed.length} completed`}
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <Card
        title={`Interviews (${filtered.length})`}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              placeholder="Search student or role..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="bg-gray-800/70 border border-gray-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 sm:w-56"
            />
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              <option value="Technical">Technical</option>
              <option value="HR">HR</option>
              <option value="Behavioral">Behavioral</option>
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="terminated">Terminated</option>
            </Select>
          </div>
        }
      >
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState icon="🎤" title="No interviews found" description="Try adjusting your search or filters." />
        ) : (
          <Table<AdminInterview>
            columns={[
              { key: "student", header: "Student" },
              { key: "role", header: "Role" },
              { key: "type", header: "Type" },
              { key: "score", header: "Score" },
              { key: "duration", header: "Duration" },
              { key: "date", header: "Date" },
              { key: "status", header: "Status" },
              { key: "actions", header: "Actions", className: "text-right" },
            ]}
            rows={filtered}
            renderRow={(i) => (
              <>
                <td className="py-3 px-4">
                  <p className="text-white font-medium">{i.studentName}</p>
                  <p className="text-xs text-gray-500">{i.studentEmail}</p>
                </td>
                <td className="py-3 px-4">
                  <p className="text-gray-300">{i.jobRole}</p>
                  <p className="text-xs text-gray-500">{i.difficulty}</p>
                </td>
                <td className="py-3 px-4">
                  <Badge tone={i.interviewType === "Technical" ? "blue" : i.interviewType === "HR" ? "purple" : "yellow"}>
                    {i.interviewType}
                  </Badge>
                </td>
                <td className="py-3 px-4">
                  {i.status === "pending" ? (
                    <span className="text-gray-500">—</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${i.overallScore >= 75 ? "text-emerald-400" : i.overallScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                        {i.overallScore}
                      </span>
                      <span className="text-xs text-gray-500">/100</span>
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 text-gray-300">{i.durationMin} min</td>
                <td className="py-3 px-4 text-gray-300">{new Date(i.date).toLocaleDateString()}</td>
                <td className="py-3 px-4">
                  <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                </td>
                <td className="py-3 px-4 text-right">
                  <IconButton title="View report" onClick={() => setSelected(i)}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm-9 0a9 9 0 1118 0 9 9 0 01-18 0z" />
                    </svg>
                  </IconButton>
                </td>
              </>
            )}
          />
        )}
      </Card>

      {/* Report modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Interview Report" size="lg">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold text-lg">{selected.studentName}</p>
                <p className="text-gray-400 text-sm">
                  {selected.jobRole} · {selected.interviewType} Interview · {new Date(selected.date).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={statusTone(selected.status)}>{selected.status}</Badge>
                {selected.cheatingCount > 0 && (
                  <Badge tone="red">⚠ {selected.cheatingCount} flag{selected.cheatingCount > 1 ? "s" : ""}</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Metric label="Overall" value={selected.overallScore} />
              <Metric label="Technical" value={selected.technicalScore} />
              <Metric label="Communication" value={selected.communicationScore} />
              <Metric label="Confidence" value={selected.confidenceScore} />
              <Metric label="Grammar" value={selected.grammarScore} />
            </div>

            <div className="space-y-3">
              <ScoreBar label="Technical" value={selected.technicalScore} />
              <ScoreBar label="Communication" value={selected.communicationScore} />
              <ScoreBar label="Confidence" value={selected.confidenceScore} />
              <ScoreBar label="Grammar" value={selected.grammarScore} />
              <ScoreBar label="Fluency" value={selected.fluencyScore} />
            </div>

            {selected.finalFeedback && (
              <div className="bg-gray-800/50 border border-gray-700/60 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">AI Feedback</p>
                <p className="text-gray-300 text-sm leading-relaxed">{selected.finalFeedback}</p>
              </div>
            )}

            {selected.autoTerminated && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-red-400 text-sm font-medium">
                  This interview was automatically terminated due to repeated proctoring violations.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  const color = value >= 75 ? "text-emerald-400" : value >= 50 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="bg-gray-800/60 rounded-xl p-3 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
