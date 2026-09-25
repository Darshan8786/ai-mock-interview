import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  collegeInterviewApi,
  statusTone,
  CollegeApiError,
  type CollegeInterview,
  type InterviewStatus,
} from "../../admin/collegeInterviewApi";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Table } from "../../components/admin/Table";
import { Badge } from "../../components/admin/Badge";
import { Button } from "../../components/admin/Button";
import { Modal } from "../../components/admin/Modal";
import { TableSkeleton } from "../../components/admin/Skeleton";
import { EmptyState } from "../../components/admin/EmptyState";
import { ErrorState } from "../../components/admin/ErrorState";
import { TextInput, Select } from "../../components/admin/Inputs";

/** College-created interviews for the signed-in admin's own college. */
export function CollegeInterviewList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CollegeInterview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | InterviewStatus>("all");
  const [deleting, setDeleting] = useState<CollegeInterview | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [problems, setProblems] = useState<{ name: string; list: string[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await collegeInterviewApi.list());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load interviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (statusFilter === "all" || i.status === statusFilter) &&
        (!q || i.name.toLowerCase().includes(q) || i.jobRole.toLowerCase().includes(q))
    );
  }, [items, query, statusFilter]);

  const changeStatus = async (i: CollegeInterview, status: InterviewStatus) => {
    setBusyId(i._id);
    try {
      const updated = await collegeInterviewApi.setStatus(i._id, status);
      setItems((prev) => prev.map((x) => (x._id === i._id ? { ...x, ...updated } : x)));
      toast.success(status === "published" ? "Interview published" : status === "closed" ? "Interview closed" : "Moved to draft");
    } catch (err) {
      if (err instanceof CollegeApiError && err.problems.length) {
        setProblems({ name: i.name, list: err.problems });
      } else {
        toast.error(err instanceof Error ? err.message : "Could not change status");
      }
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting._id);
    try {
      await collegeInterviewApi.remove(deleting._id);
      setItems((prev) => prev.filter((x) => x._id !== deleting._id));
      toast.success("Interview deleted");
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete interview");
    } finally {
      setBusyId(null);
    }
  };

  const link = "text-xs font-medium px-2 py-1 rounded-md transition-colors";

  return (
    <div>
      <PageHeader
        title="Interview Management"
        subtitle="Interviews your college has prepared for its students"
        actions={
          <Button variant="primary" onClick={() => navigate("/admin/college-interviews/new")}>
            + Create Interview
          </Button>
        }
      />

      {error && <ErrorState message={error} onRetry={load} />}

      <Card
        title={`College Interviews (${filtered.length})`}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <TextInput placeholder="Search name or role..." value={query} onChange={(e) => setQuery(e.target.value)} className="sm:w-56" />
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | InterviewStatus)}>
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </Select>
          </div>
        }
      >
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="🎓"
            title={items.length ? "No interviews match" : "No college interviews yet"}
            description={items.length ? "Try a different search or filter." : "Create an interview and write its questions."}
          />
        ) : (
          <Table<CollegeInterview>
            columns={[
              { key: "name", header: "Interview Name" },
              { key: "role", header: "Role" },
              { key: "type", header: "Type" },
              { key: "q", header: "Questions" },
              { key: "status", header: "Status" },
              { key: "actions", header: "Actions", className: "text-right" },
            ]}
            rows={filtered}
            renderRow={(i) => (
              <>
                <td className="py-3 px-4">
                  <p className="text-white font-medium">{i.name}</p>
                  <p className="text-xs text-gray-500">
                    {i.difficulty} · {i.timeLimit} min{i.programmingLanguage !== "None" ? ` · ${i.programmingLanguage}` : ""}
                  </p>
                </td>
                <td className="py-3 px-4 text-gray-300">{i.jobRole}</td>
                <td className="py-3 px-4 text-gray-300">{i.interviewType}</td>
                <td className="py-3 px-4">
                  <span className={i.questionsAuthored === i.questionCount ? "text-emerald-400" : "text-yellow-400"}>
                    {i.questionsAuthored}
                  </span>
                  <span className="text-gray-500">/{i.questionCount}</span>
                </td>
                <td className="py-3 px-4">
                  <Badge tone={statusTone(i.status)}>{i.status}</Badge>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    <button className={`${link} text-blue-400 hover:bg-blue-500/10`} onClick={() => navigate(`/admin/college-interviews/${i._id}`)}>View</button>
                    <button
                      className={`${link} text-gray-300 hover:bg-gray-700/50 disabled:opacity-40`}
                      disabled={i.status === "closed"}
                      onClick={() => navigate(`/admin/college-interviews/${i._id}/edit`)}
                    >
                      Edit
                    </button>
                    <button className={`${link} text-purple-300 hover:bg-purple-500/10`} onClick={() => navigate(`/admin/college-interviews/${i._id}/questions`)}>Questions</button>
                    {i.status !== "published" && (
                      <button className={`${link} text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40`} disabled={busyId === i._id} onClick={() => changeStatus(i, "published")}>
                        {i.status === "closed" ? "Reopen" : "Publish"}
                      </button>
                    )}
                    {i.status === "published" && (
                      <button className={`${link} text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-40`} disabled={busyId === i._id} onClick={() => changeStatus(i, "closed")}>Close</button>
                    )}
                    <button className={`${link} text-red-400 hover:bg-red-500/10`} onClick={() => setDeleting(i)}>Delete</button>
                  </div>
                </td>
              </>
            )}
          />
        )}
      </Card>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Confirm Deletion"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" loading={busyId === deleting?._id} onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-gray-300 text-sm">
          Delete <span className="text-white font-semibold">{deleting?.name}</span> and all of its questions? This cannot be undone.
        </p>
      </Modal>

      <Modal
        open={!!problems}
        onClose={() => setProblems(null)}
        title="Can't publish yet"
        size="md"
        footer={<Button variant="ghost" onClick={() => setProblems(null)}>OK</Button>}
      >
        <p className="text-gray-300 text-sm mb-3">
          <span className="text-white font-semibold">{problems?.name}</span> needs these fixes before students can see it:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-300">
          {problems?.list.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
