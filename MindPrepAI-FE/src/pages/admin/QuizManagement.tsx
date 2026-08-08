import { useMemo, useState } from "react";
import { adminApi } from "../../admin/api";
import { useLoad } from "../../admin/useLoad";
import type { AdminQuiz } from "../../admin/types";
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

interface QuizForm {
  subject: string;
  title: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  status: "published" | "draft" | "archived";
}

const emptyForm: QuizForm = {
  subject: "DSA",
  title: "",
  topic: "",
  difficulty: "medium",
  status: "draft",
};

export function QuizManagement() {
  const { data: quizzes, loading, error, reload, setData } = useLoad(() => adminApi.getQuizzes());
  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [attemptsFor, setAttemptsFor] = useState<AdminQuiz | null>(null);
  const [attempts, setAttempts] = useState<Awaited<ReturnType<typeof adminApi.getQuizAttempts>> | null>(null);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [form, setForm] = useState<QuizForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminQuiz | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    if (!quizzes) return [];
    const q = query.toLowerCase();
    return quizzes.filter((qz) => {
      const matchQ = !q || qz.title.toLowerCase().includes(q) || qz.subject.toLowerCase().includes(q);
      const matchSubject = subjectFilter === "all" || qz.subject === subjectFilter;
      return matchQ && matchSubject;
    });
  }, [quizzes, query, subjectFilter]);

  const subjects = useMemo(
    () => Array.from(new Set((quizzes ?? []).map((q) => q.subject))),
    [quizzes]
  );

  const openAttempts = async (quiz: AdminQuiz) => {
    setAttemptsFor(quiz);
    setAttemptsLoading(true);
    setAttempts(null);
    const data = await adminApi.getQuizAttempts(quiz.id);
    setAttempts(data);
    setAttemptsLoading(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const openEdit = (quiz: AdminQuiz) => {
    setEditingId(quiz.id);
    setForm({
      subject: quiz.subject,
      title: quiz.title,
      topic: quiz.topic,
      difficulty: quiz.difficulty,
      status: quiz.status,
    });
  };

  const handleSave = async () => {
    if (!form) return;
    setBusy(true);
    if (editingId) {
      const updated = await adminApi.updateQuiz(editingId, form);
      setData((prev) => prev!.map((q) => (q.id === editingId ? { ...q, ...updated } : q)));
    } else {
      const created = await adminApi.createQuiz({ ...form, questionCount: 0 });
      setData((prev) => [created, ...prev!]);
    }
    setBusy(false);
    setForm(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    await adminApi.deleteQuiz(deleting.id);
    setData((prev) => prev!.filter((q) => q.id !== deleting.id));
    setBusy(false);
    setDeleting(null);
  };

  return (
    <div>
      <PageHeader
        title="Quiz Management"
        subtitle="Create, edit and monitor practice quizzes"
        actions={
          <Button variant="primary" onClick={openCreate}>+ New Quiz</Button>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <Card
        title={`Quizzes (${filtered.length})`}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <TextInput
              placeholder="Search quiz..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:w-56"
            />
            <Select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
              <option value="all">All Subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
        }
      >
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState icon="📝" title="No quizzes found" description="Create your first quiz to get started." />
        ) : (
          <Table<AdminQuiz>
            columns={[
              { key: "quiz", header: "Quiz" },
              { key: "subject", header: "Subject" },
              { key: "questions", header: "Questions" },
              { key: "attempts", header: "Attempts" },
              { key: "avg", header: "Avg Score" },
              { key: "status", header: "Status" },
              { key: "actions", header: "Actions", className: "text-right" },
            ]}
            rows={filtered}
            renderRow={(q) => (
              <>
                <td className="py-3 px-4">
                  <p className="text-white font-medium">{q.title}</p>
                  <p className="text-xs text-gray-500">{q.topic}</p>
                </td>
                <td className="py-3 px-4">
                  <Badge tone="blue">{q.subject}</Badge>
                </td>
                <td className="py-3 px-4 text-gray-300">{q.questionCount}</td>
                <td className="py-3 px-4 text-gray-300">{q.attempts}</td>
                <td className="py-3 px-4">
                  <span className={`font-semibold ${q.avgScore >= 75 ? "text-emerald-400" : q.avgScore >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                    {q.avgScore}%
                  </span>
                </td>
                <td className="py-3 px-4">
                  <Badge tone={statusTone(q.status)}>{q.status}</Badge>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <IconButton title="Attempts" onClick={() => openAttempts(q)} className="hover:text-purple-400">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </IconButton>
                    <IconButton title="Edit" onClick={() => openEdit(q)}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </IconButton>
                    <IconButton title="Delete" onClick={() => setDeleting(q)} className="hover:text-red-400 hover:bg-red-500/10">
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

      {/* Create/Edit modal */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={editingId ? "Edit Quiz" : "New Quiz"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            <Button loading={busy} onClick={handleSave}>Save Quiz</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Subject">
            <Select value={form?.subject || ""} onChange={(e) => setForm((p) => p && { ...p, subject: e.target.value })}>
              {["DSA", "DBMS", "OOPS", "OS", "Networking", "SQL"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Title">
            <TextInput
              placeholder="e.g. DSA Practice Set 1"
              value={form?.title || ""}
              onChange={(e) => setForm((p) => p && { ...p, title: e.target.value })}
            />
          </Field>
          <Field label="Topic">
            <TextInput
              placeholder="e.g. Arrays & Hashing"
              value={form?.topic || ""}
              onChange={(e) => setForm((p) => p && { ...p, topic: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Difficulty">
              <Select value={form?.difficulty || "medium"} onChange={(e) => setForm((p) => p && { ...p, difficulty: e.target.value as QuizForm["difficulty"] })}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form?.status || "draft"} onChange={(e) => setForm((p) => p && { ...p, status: e.target.value as QuizForm["status"] })}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
          </div>
        </div>
      </Modal>

      {/* Attempts modal */}
      <Modal
        open={!!attemptsFor}
        onClose={() => setAttemptsFor(null)}
        title={`Attempts — ${attemptsFor?.title || ""}`}
        size="lg"
      >
        {attemptsLoading ? (
          <TableSkeleton />
        ) : (
          <Table
            columns={[
              { key: "student", header: "Student" },
              { key: "score", header: "Score" },
              { key: "percentage", header: "Percentage" },
              { key: "time", header: "Time Taken" },
              { key: "date", header: "Date" },
            ]}
            rows={attempts ?? []}
            renderRow={(a) => (
              <>
                <td className="py-3 px-4 text-white font-medium">{a.studentName}</td>
                <td className="py-3 px-4 text-gray-300">{a.score} / {a.total}</td>
                <td className="py-3 px-4">
                  <span className={`font-semibold ${a.percentage >= 75 ? "text-emerald-400" : a.percentage >= 50 ? "text-yellow-400" : "text-red-400"}`}>
                    {a.percentage}%
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-300">{a.timeTaken}</td>
                <td className="py-3 px-4 text-gray-300">{new Date(a.date).toLocaleDateString()}</td>
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
          Delete quiz <span className="text-white font-semibold">{deleting?.title}</span> and all its data?
        </p>
      </Modal>
    </div>
  );
}
