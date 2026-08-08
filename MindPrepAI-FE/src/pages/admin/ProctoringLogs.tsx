import { useMemo, useState } from "react";
import { adminApi } from "../../admin/api";
import { useLoad } from "../../admin/useLoad";
import type { ProctoringLog } from "../../admin/types";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Table } from "../../components/admin/Table";
import { Badge } from "../../components/admin/Badge";
import { IconButton } from "../../components/admin/Button";
import { Modal } from "../../components/admin/Modal";
import { TableSkeleton } from "../../components/admin/Skeleton";
import { EmptyState } from "../../components/admin/EmptyState";
import { ErrorState } from "../../components/admin/ErrorState";
import { Select } from "../../components/admin/Inputs";

const typeLabels: Record<ProctoringLog["type"], string> = {
  tab_switch: "Tab Switch",
  multiple_faces: "Multiple Faces",
  phone_detected: "Phone Detected",
  eye_movement: "Eye Movement",
  face_not_visible: "Face Not Visible",
  looking_away: "Looking Away",
  copy: "Copy Attempt",
  fullscreen_exit: "Fullscreen Exit",
  camera_disabled: "Camera Disabled",
  person_left: "Person Left",
};

const severityTone = { low: "gray", medium: "yellow", high: "red" } as const;

export function ProctoringLogs() {
  const { data: logs, loading, error, reload } = useLoad(() => adminApi.getProctoringLogs());
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<ProctoringLog | null>(null);

  const filtered = useMemo(() => {
    if (!logs) return [];
    return logs.filter((l) => {
      const matchSeverity = severityFilter === "all" || l.severity === severityFilter;
      const matchType = typeFilter === "all" || l.type === typeFilter;
      return matchSeverity && matchType;
    });
  }, [logs, severityFilter, typeFilter]);

  const highCount = logs?.filter((l) => l.severity === "high").length ?? 0;
  const mediumCount = logs?.filter((l) => l.severity === "medium").length ?? 0;
  const lowCount = logs?.filter((l) => l.severity === "low").length ?? 0;

  return (
    <div>
      <PageHeader
        title="Proctoring Logs"
        subtitle="All AI proctoring events flagged during interviews"
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MiniStat label="High Risk" value={highCount} tone="text-red-400" />
        <MiniStat label="Medium Risk" value={mediumCount} tone="text-yellow-400" />
        <MiniStat label="Low Risk" value={lowCount} tone="text-gray-300" />
      </div>

      <Card
        title={`Proctoring Events (${filtered.length})`}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
              <option value="all">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All Types</option>
              {Object.entries(typeLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </div>
        }
      >
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState icon="🛡️" title="No proctoring events" description="No events match the current filters." />
        ) : (
          <Table<ProctoringLog>
            columns={[
              { key: "student", header: "Student" },
              { key: "type", header: "Event Type" },
              { key: "severity", header: "Severity" },
              { key: "time", header: "Time" },
              { key: "status", header: "Interview" },
              { key: "actions", header: "Details", className: "text-right" },
            ]}
            rows={filtered}
            renderRow={(l) => (
              <>
                <td className="py-3 px-4">
                  <p className="text-white font-medium">{l.studentName}</p>
                  <p className="text-xs text-gray-500">{l.interviewId}</p>
                </td>
                <td className="py-3 px-4">
                  <span className="text-gray-300">{typeLabels[l.type]}</span>
                </td>
                <td className="py-3 px-4">
                  <Badge tone={severityTone[l.severity]}>{l.severity}</Badge>
                </td>
                <td className="py-3 px-4 text-gray-300">{new Date(l.timestamp).toLocaleString()}</td>
                <td className="py-3 px-4">
                  <Badge tone={l.interviewStatus === "terminated" ? "red" : l.interviewStatus === "in-progress" ? "yellow" : "green"}>
                    {l.interviewStatus}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-right">
                  <IconButton title="View details" onClick={() => setSelected(l)}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </IconButton>
                </td>
              </>
            )}
          />
        )}
      </Card>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Proctoring Event Details" size="sm">
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-semibold">{selected.studentName}</p>
                <p className="text-xs text-gray-500">Interview: {selected.interviewId}</p>
              </div>
              <Badge tone={severityTone[selected.severity]}>{selected.severity} risk</Badge>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Event Type</p>
              <p className="text-white font-medium">{typeLabels[selected.type]}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Description</p>
              <p className="text-gray-300 text-sm">{selected.description}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Timestamp</p>
                <p className="text-gray-300">{new Date(selected.timestamp).toLocaleString()}</p>
              </div>
              <div className="bg-gray-800/50 rounded-xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Interview Status</p>
                <p className="text-gray-300">{selected.interviewStatus}</p>
              </div>
            </div>
            {selected.severity === "high" && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <p className="text-red-400 text-sm">
                  High-severity violation. Repeated high-risk events may auto-terminate the interview.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-4 flex items-center justify-between">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}
