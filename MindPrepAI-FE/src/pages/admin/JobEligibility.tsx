import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { adminApi } from "../../admin/api";
import type {
  AdminJob,
  EligibleStudent,
  JobApplicationStats,
} from "../../admin/types";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Table } from "../../components/admin/Table";
import { Badge } from "../../components/admin/Badge";
import { Button } from "../../components/admin/Button";
import { Modal } from "../../components/admin/Modal";
import { TableSkeleton } from "../../components/admin/Skeleton";
import { EmptyState } from "../../components/admin/EmptyState";
import { ErrorState } from "../../components/admin/ErrorState";

type Tab = "eligible" | "ineligible";

const statCards = [
  { key: "total", label: "Total Students", color: "text-gray-200" },
  { key: "eligible", label: "Eligible", color: "text-emerald-400" },
  { key: "ineligible", label: "Not Eligible", color: "text-red-400" },
  { key: "applications", label: "Applications", color: "text-blue-400" },
  { key: "shortlisted", label: "Shortlisted", color: "text-yellow-400" },
  { key: "selected", label: "Selected", color: "text-purple-400" },
];

export function JobEligibility() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("eligible");
  const [job, setJob] = useState<AdminJob | null>(null);
  const [eligible, setEligible] = useState<EligibleStudent[]>([]);
  const [ineligible, setIneligible] = useState<EligibleStudent[]>([]);
  const [appStats, setAppStats] = useState<JobApplicationStats | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmNotify, setConfirmNotify] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [elig, inelig, apps] = await Promise.all([
        adminApi.getEligibleStudents(id),
        adminApi.getIneligibleStudents(id),
        adminApi.getJobApplications(id),
      ]);
      setJob(elig.job || apps.job || null);
      setEligible(elig.students);
      setIneligible(inelig.students);
      setTotalStudents(elig.totalStudents || 0);
      setAppStats(apps.stats);
    } catch (e: any) {
      setError(e.message || "Failed to load eligibility data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const current = tab === "eligible" ? eligible : ineligible;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return current;
    return current.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.usn || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q) ||
        (s.department || "").toLowerCase().includes(q)
    );
  }, [current, search]);

  const handleRecalculate = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const res = await adminApi.recalculateEligibility(id);
      toast.success(
        `Recalculated: ${res.eligible} of ${res.total} students eligible`
      );
      await load();
    } catch (e: any) {
      toast.error(e.message || "Recalculation failed");
    } finally {
      setBusy(false);
    }
  };

  const handleNotify = async () => {
    if (!id) return;
    setBusy(true);
    setConfirmNotify(false);
    try {
      const res = await adminApi.notifyEligible(id);
      toast.success(
        res.created > 0
          ? `Eligibility notification sent to ${res.created} student(s)`
          : "All eligible students were already notified"
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to send notifications");
    } finally {
      setBusy(false);
    }
  };

  const exportExcel = () => {
    if (!job) return;
    const depts =
      job.eligibility?.allowedDepartments?.length
        ? job.eligibility.allowedDepartments.join(", ")
        : "All";
    const aoa: (string | number | null)[][] = [
      ["Eligible Students Report"],
      ["Job Title", job.jobTitle],
      ["Company", job.companyName],
      ["Minimum CGPA", job.eligibility?.minimumCGPA ?? "Any"],
      ["Maximum Backlogs", job.eligibility?.maximumBacklogs ?? "Any"],
      ["Allowed Departments", depts],
      [],
      ["#", "USN", "Name", "Email", "Department", "CGPA", "Backlogs"],
      ...eligible.map((s, i) => [
        i + 1,
        s.usn || "",
        s.name || "",
        s.email || "",
        s.department || "",
        s.cgpa != null ? s.cgpa : "",
        s.backlogs,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [
      { wch: 5 },
      { wch: 14 },
      { wch: 22 },
      { wch: 32 },
      { wch: 24 },
      { wch: 8 },
      { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Eligible Students");
    const company = (job.companyName || "company").replace(/[^\w]+/g, "-");
    const role = (job.jobTitle || "job").replace(/[^\w]+/g, "-");
    XLSX.writeFile(wb, `eligible-students-${company}-${role}.xlsx`);
  };

  const exportCSV = () => {
    const rows = eligible.map((s) => ({
      USN: s.usn,
      Name: s.name,
      Email: s.email,
      Department: s.department,
      CGPA: s.cgpa != null ? s.cgpa : "",
      Backlogs: s.backlogs,
    }));
    const headers = Object.keys(rows[0] ?? {});
    const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escape((r as Record<string, string | number>)[h])).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const company = (job?.companyName || "company").replace(/[^\w]+/g, "-");
    const role = (job?.jobTitle || "job").replace(/[^\w]+/g, "-");
    a.download = `eligible-students-${company}-${role}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = {
    total: totalStudents,
    eligible: eligible.length,
    ineligible: ineligible.length,
    applications: appStats?.total ?? 0,
    shortlisted: appStats?.shortlisted ?? 0,
    selected: appStats?.selected ?? 0,
  };

  return (
    <div>
      <PageHeader
        title="Eligible Students"
        subtitle={
          job ? `${job.jobTitle} at ${job.companyName}` : "Job eligibility"
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate(`/admin/jobs/${id}/applications`)}>
              Applications
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/admin/jobs/${id}/edit`)}>
              Edit Job
            </Button>
            <Button variant="ghost" onClick={() => navigate("/admin/jobs")}>
              ← Back to Jobs
            </Button>
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={load} />}

      {loading ? (
        <TableSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {statCards.map((s) => (
              <div key={s.key} className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
                <p className="text-2xl font-bold text-white">{stats[s.key as keyof typeof stats]}</p>
                <p className={`text-xs font-medium uppercase tracking-wider mt-1 ${s.color}`}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Eligibility criteria summary */}
          <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4 mb-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <span className="text-gray-400">
              CGPA ≥ <span className="text-white font-semibold">{job?.eligibility?.minimumCGPA ?? "Any"}</span>
            </span>
            <span className="text-gray-400">
              Backlogs ≤ <span className="text-white font-semibold">{job?.eligibility?.maximumBacklogs ?? "Any"}</span>
            </span>
            <span className="text-gray-400">
              Departments:{" "}
              <span className="text-white font-semibold">
                {job?.eligibility?.allowedDepartments?.length
                  ? job.eligibility.allowedDepartments.join(", ")
                  : "All"}
              </span>
            </span>
          </div>

          {/* Tabs + actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div className="flex rounded-xl bg-gray-900 border border-gray-700 p-1 w-fit">
              <button
                onClick={() => setTab("eligible")}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === "eligible" ? "bg-emerald-600/20 text-emerald-400" : "text-gray-400 hover:text-white"
                }`}
              >
                Eligible ({eligible.length})
              </button>
              <button
                onClick={() => setTab("ineligible")}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === "ineligible" ? "bg-red-600/20 text-red-400" : "text-gray-400 hover:text-white"
                }`}
              >
                Not Eligible ({ineligible.length})
              </button>
            </div>
            <div className="flex items-center gap-2">
              {tab === "eligible" && (
                <>
                  <Button variant="secondary" onClick={() => setConfirmNotify(true)} disabled={eligible.length === 0}>
                    🔔 Notify Eligible
                  </Button>
                  <Button variant="primary" onClick={exportExcel} disabled={eligible.length === 0}>
                    Export Excel
                  </Button>
                  <Button variant="ghost" onClick={exportCSV} disabled={eligible.length === 0}>
                    Export CSV
                  </Button>
                </>
              )}
              <Button variant="ghost" loading={busy} onClick={handleRecalculate}>
                Recalculate
              </Button>
            </div>
          </div>

          <Card
            title={tab === "eligible" ? "Eligible Students" : "Not Eligible Students"}
            actions={
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search USN, name, dept..."
                spellCheck={false}
                className="w-full sm:w-56 bg-gray-800/70 border border-gray-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            }
          >
            {current.length === 0 ? (
              <EmptyState
                icon={tab === "eligible" ? "✅" : "🚫"}
                title={tab === "eligible" ? "No eligible students" : "No ineligible students"}
                description={
                  tab === "eligible"
                    ? "No students match the eligibility criteria. Adjust criteria or recalculate."
                    : "All students are eligible for this job."
                }
              />
            ) : (
              <Table<EligibleStudent>
                columns={[
                  { key: "student", header: "Student" },
                  { key: "dept", header: "Department" },
                  { key: "cgpa", header: "CGPA" },
                  { key: "backlogs", header: "Backlogs" },
                  { key: "reason", header: tab === "ineligible" ? "Reasons" : "Status" },
                ]}
                rows={filtered}
                renderRow={(s) => (
                  <>
                    <td className="py-3 px-4">
                      <p className="text-white font-medium">{s.name}</p>
                      <p className="text-xs text-gray-500">
                        {s.usn || "—"} {s.email && `• ${s.email}`}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-gray-300">{s.department || "—"}</td>
                    <td className="py-3 px-4 text-gray-300">{s.cgpa != null ? s.cgpa.toFixed(2) : "—"}</td>
                    <td className="py-3 px-4">
                      <span className={s.backlogs > 0 ? "text-red-400 font-medium" : "text-gray-300"}>
                        {s.backlogs}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {s.eligible ? (
                        <Badge tone="green">Eligible</Badge>
                      ) : (
                        <div className="space-y-1">
                          {s.reasons.map((r, i) => (
                            <p key={i} className="text-xs text-red-400/90">• {r}</p>
                          ))}
                        </div>
                      )}
                    </td>
                  </>
                )}
              />
            )}
          </Card>
        </>
      )}

      {/* Notify confirm */}
      <Modal
        open={confirmNotify}
        onClose={() => setConfirmNotify(false)}
        title="Notify Eligible Students"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmNotify(false)}>Cancel</Button>
            <Button loading={busy} onClick={handleNotify}>Send Notification</Button>
          </>
        }
      >
        <p className="text-gray-300 text-sm">
          Send the <span className="text-white font-semibold">"New Placement Opportunity"</span>{" "}
          notification to all <span className="text-emerald-400 font-semibold">{eligible.length} eligible student(s)</span>?
          Students already notified for this job will not be notified again.
        </p>
      </Modal>
    </div>
  );
}
