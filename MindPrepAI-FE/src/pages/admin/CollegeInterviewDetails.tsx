import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  collegeInterviewApi,
  statusTone,
  CollegeApiError,
  type InterviewDetail,
  type InterviewStatus,
} from "../../admin/collegeInterviewApi";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Badge } from "../../components/admin/Badge";
import { Button } from "../../components/admin/Button";
import { ErrorState } from "../../components/admin/ErrorState";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2.5 border-b border-gray-800 last:border-0">
      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wider pt-0.5">{label}</dt>
      <dd className="col-span-2 text-sm text-gray-200 break-words">{children}</dd>
    </div>
  );
}

/** Read-only view of a college interview: configuration, question list and student attempt counts. */
export function CollegeInterviewDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<InterviewDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setDetail(await collegeInterviewApi.get(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load interview");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (status: InterviewStatus) => {
    if (!id) return;
    setBusy(true);
    setProblems([]);
    try {
      await collegeInterviewApi.setStatus(id, status);
      toast.success(status === "published" ? "Interview published" : status === "closed" ? "Interview closed" : "Moved to draft");
      await load();
    } catch (err) {
      if (err instanceof CollegeApiError && err.problems.length) setProblems(err.problems);
      else toast.error(err instanceof Error ? err.message : "Could not change status");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-24 text-gray-400">Loading interview...</div>;

  const i = detail?.interview;
  return (
    <div>
      <PageHeader
        title={i?.name || "Interview"}
        subtitle={i ? `${i.jobRole} · ${i.interviewType}` : undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => navigate("/admin/interviews?tab=college")}>← Back</Button>
            {i && i.status !== "closed" && <Button variant="secondary" onClick={() => navigate(`/admin/college-interviews/${i._id}/edit`)}>Edit</Button>}
            {i && <Button variant="secondary" onClick={() => navigate(`/admin/college-interviews/${i._id}/questions`)}>Questions</Button>}
            {i && i.status !== "published" && <Button variant="success" loading={busy} onClick={() => changeStatus("published")}>{i.status === "closed" ? "Reopen" : "Publish"}</Button>}
            {i && i.status === "published" && <Button variant="danger" loading={busy} onClick={() => changeStatus("closed")}>Close</Button>}
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={load} />}

      {problems.length > 0 && (
        <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
          <p className="font-semibold mb-1">Can't publish yet:</p>
          <ul className="list-disc pl-5 space-y-0.5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}

      {detail && i && (
        <div className="space-y-6">
          <Card title="Configuration" actions={<Badge tone={statusTone(i.status)}>{i.status}</Badge>}>
            <dl>
              <Row label="Job Role">{i.jobRole}</Row>
              <Row label="Type">{i.interviewType}</Row>
              <Row label="Language">{i.programmingLanguage}</Row>
              <Row label="Difficulty">{i.difficulty}</Row>
              <Row label="Questions">{detail.questions.length} written / {i.questionCount} required</Row>
              <Row label="Time Limit">{i.timeLimit} minutes</Row>
              <Row label="Description">{i.description || <span className="text-gray-500">—</span>}</Row>
            </dl>
          </Card>

          <Card title="Student Attempts">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              {[
                ["Total", detail.attempts.total],
                ["In progress", detail.attempts["in-progress"]],
                ["Completed", detail.attempts.completed],
                ["Terminated", detail.attempts.terminated],
              ].map(([label, n]) => (
                <div key={label as string} className="rounded-xl bg-gray-800/60 border border-gray-700 py-3">
                  <p className="text-2xl font-bold text-white">{n}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title={`Questions (${detail.questions.length})`}>
            {detail.questions.length === 0 ? (
              <p className="text-sm text-gray-500">No questions yet. Open "Questions" to add some.</p>
            ) : (
              <ol className="space-y-3">
                {detail.questions.map((q) => (
                  <li key={q._id} className="rounded-xl border border-gray-700 bg-gray-800/40 p-4">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5 text-xs">
                      <span className="text-gray-400 font-medium">Q{q.order}</span>
                      <Badge tone="blue">{q.questionType}</Badge>
                      {q.topic && <Badge tone="gray">{q.topic}</Badge>}
                      <Badge tone="purple">{q.difficulty}</Badge>
                      <span className="text-gray-400">{q.marks} {q.marks === 1 ? "mark" : "marks"}</span>
                    </div>
                    <p className="text-sm text-gray-100 whitespace-pre-line">{q.question}</p>
                    {q.questionType === "MCQ" && (
                      <ul className="mt-2 space-y-1 text-sm">
                        {q.options.map((o, idx) => {
                          const letter = String.fromCharCode(65 + idx);
                          const right = q.correctAnswer === letter;
                          return (
                            <li key={letter} className={right ? "text-emerald-400" : "text-gray-400"}>
                              {letter}. {o} {right && "✓"}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
