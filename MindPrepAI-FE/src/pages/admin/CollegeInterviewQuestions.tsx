import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  collegeInterviewApi,
  statusTone,
  CollegeApiError,
  QUESTION_TYPES,
  QUESTION_DIFFICULTIES,
  PROGRAMMING_LANGUAGES,
  type CollegeInterview,
  type CollegeQuestion,
  type QuestionInput,
  type QuestionType,
} from "../../admin/collegeInterviewApi";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Badge } from "../../components/admin/Badge";
import { Button, IconButton } from "../../components/admin/Button";
import { ErrorState } from "../../components/admin/ErrorState";
import { TextInput, TextArea, Select, Field } from "../../components/admin/Inputs";

const TOPICS = ["Java/OOP", "Python", "JavaScript", "DSA", "DBMS/SQL", "Operating Systems", "Computer Networks", "System Design", "Web Development", "Aptitude", "HR", "Behavioral"];

/** One question as edited in the form (marks kept as text while typing). */
interface QForm {
  key: string;
  id?: string;
  questionType: QuestionType;
  question: string;
  topic: string;
  difficulty: (typeof QUESTION_DIFFICULTIES)[number];
  marks: string;
  options: string[];
  correctAnswer: "A" | "B" | "C" | "D" | "";
  expectedAnswer: string;
  evaluationCriteria: string;
  language: string;
  starterCode: string;
  expectedSolution: string;
  dirty: boolean;
  error: string;
}

let keySeq = 0;
const newKey = () => `q${++keySeq}`;

const blank = (): QForm => ({
  key: newKey(),
  questionType: "Technical",
  question: "",
  topic: "",
  difficulty: "Medium",
  marks: "5",
  options: ["", "", "", ""],
  correctAnswer: "",
  expectedAnswer: "",
  evaluationCriteria: "",
  language: "",
  starterCode: "",
  expectedSolution: "",
  dirty: true,
  error: "",
});

const fromServer = (q: CollegeQuestion): QForm => ({
  key: newKey(),
  id: q._id,
  questionType: q.questionType,
  question: q.question,
  topic: q.topic || "",
  difficulty: q.difficulty,
  marks: String(q.marks),
  options: [0, 1, 2, 3].map((i) => q.options?.[i] ?? ""),
  correctAnswer: q.correctAnswer || "",
  expectedAnswer: q.expectedAnswer || "",
  evaluationCriteria: q.evaluationCriteria || "",
  language: q.codingConfig?.language || "",
  starterCode: q.codingConfig?.starterCode || "",
  expectedSolution: q.codingConfig?.expectedSolution || "",
  dirty: false,
  error: "",
});

const toInput = (f: QForm): QuestionInput => ({
  questionType: f.questionType,
  question: f.question.trim(),
  topic: f.topic.trim(),
  difficulty: f.difficulty,
  marks: Number(f.marks),
  options: f.options.map((o) => o.trim()),
  correctAnswer: f.correctAnswer,
  expectedAnswer: f.expectedAnswer.trim(),
  evaluationCriteria: f.evaluationCriteria.trim(),
  codingConfig: { language: f.language, starterCode: f.starterCode, expectedSolution: f.expectedSolution },
});

const localProblem = (f: QForm): string => {
  if (f.question.trim().length < 3) return "Write the question text.";
  if (!Number.isFinite(Number(f.marks)) || Number(f.marks) < 0) return "Marks must be a number.";
  return "";
};

export function CollegeInterviewQuestions() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [interview, setInterview] = useState<CollegeInterview | null>(null);
  const [forms, setForms] = useState<QForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const d = await collegeInterviewApi.get(id);
      setInterview(d.interview);
      setForms(d.questions.map(fromServer));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load interview");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const status = interview?.status;
  const canEditContent = status === "draft" || status === "published";
  const canStructure = status === "draft";

  const patchForm = (key: string, patch: Partial<QForm>) =>
    setForms((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch, dirty: patch.dirty ?? true, error: "" } : f)));

  /** Saves one question; returns true on success. */
  const saveQuestion = async (f: QForm): Promise<boolean> => {
    if (!id) return false;
    const problem = localProblem(f);
    if (problem) {
      setForms((prev) => prev.map((x) => (x.key === f.key ? { ...x, error: problem } : x)));
      return false;
    }
    try {
      const saved = f.id
        ? await collegeInterviewApi.updateQuestion(id, f.id, toInput(f))
        : await collegeInterviewApi.addQuestion(id, toInput(f));
      setForms((prev) => prev.map((x) => (x.key === f.key ? { ...fromServer(saved), key: f.key } : x)));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save";
      setForms((prev) => prev.map((x) => (x.key === f.key ? { ...x, error: msg } : x)));
      return false;
    }
  };

  const saveAllDirty = async (): Promise<boolean> => {
    let ok = true;
    for (const f of forms.filter((x) => x.dirty)) {
      if (!(await saveQuestion(f))) ok = false;
    }
    return ok;
  };

  const reload = async () => {
    setLoading(true);
    await load();
  };

  const remove = async (f: QForm) => {
    if (!f.id) {
      setForms((prev) => prev.filter((x) => x.key !== f.key));
      return;
    }
    if (!window.confirm("Delete this question?")) return;
    try {
      await collegeInterviewApi.deleteQuestion(id!, f.id);
      toast.success("Question deleted");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    }
  };

  const duplicate = async (f: QForm) => {
    if (!f.id || f.dirty) {
      toast.error("Save the question before duplicating it.");
      return;
    }
    try {
      await collegeInterviewApi.duplicateQuestion(id!, f.id);
      toast.success("Question duplicated");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not duplicate");
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= forms.length) return;
    if (forms.some((f) => !f.id || f.dirty)) {
      toast.error("Save your changes before reordering.");
      return;
    }
    const next = [...forms];
    [next[index], next[target]] = [next[target], next[index]];
    setForms(next); // optimistic
    try {
      await collegeInterviewApi.reorderQuestions(id!, next.map((f) => f.id!));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reorder");
      await reload();
    }
  };

  const saveDraft = async () => {
    setBusy(true);
    setProblems([]);
    try {
      if (!(await saveAllDirty())) {
        toast.error("Fix the highlighted questions first.");
        return;
      }
      if (status !== "draft") await collegeInterviewApi.setStatus(id!, "draft");
      toast.success("Draft saved");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save draft");
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    setBusy(true);
    setProblems([]);
    try {
      if (!(await saveAllDirty())) {
        toast.error("Fix the highlighted questions first.");
        return;
      }
      await collegeInterviewApi.setStatus(id!, "published");
      toast.success("Interview published — students in your college can now see it");
      navigate("/admin/interviews?tab=college");
    } catch (err) {
      if (err instanceof CollegeApiError && err.problems.length) setProblems(err.problems);
      else toast.error(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setBusy(false);
    }
  };

  const moveToDraft = async () => {
    setBusy(true);
    try {
      await collegeInterviewApi.setStatus(id!, "draft");
      toast.success("Moved to draft");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change status");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-24 text-gray-400">Loading questions...</div>;

  const writtenCount = forms.filter((f) => f.id).length;
  const dirtyCount = forms.filter((f) => f.dirty).length;

  return (
    <div>
      <PageHeader
        title={interview ? `Questions — ${interview.name}` : "Questions"}
        subtitle={
          interview
            ? `${writtenCount} saved of ${interview.questionCount} required · ${interview.interviewType} · ${interview.timeLimit} min`
            : undefined
        }
        actions={
          <div className="flex flex-wrap gap-2 items-center">
            {status && <Badge tone={statusTone(status)}>{status}</Badge>}
            <Button variant="ghost" onClick={() => navigate("/admin/interviews?tab=college")}>← Back</Button>
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      {status === "published" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-200">
          <span>This interview is published. You can edit question wording and answers, but adding or removing questions needs it moved back to draft.</span>
          <Button variant="secondary" loading={busy} onClick={moveToDraft}>Move to draft</Button>
        </div>
      )}
      {status === "closed" && (
        <div className="mb-4 rounded-xl border border-gray-600 bg-gray-800/60 p-4 text-sm text-gray-300">
          This interview is closed and read-only. Reopen it from the interview list to make changes.
        </div>
      )}
      {problems.length > 0 && (
        <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
          <p className="font-semibold mb-1">Can't publish yet:</p>
          <ul className="list-disc pl-5 space-y-0.5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
      )}

      <div className="space-y-5">
        {forms.map((f, index) => {
          const isMcq = f.questionType === "MCQ";
          const isCoding = f.questionType === "Coding";
          const needsKey = f.questionType === "Technical" || isCoding || f.questionType === "Subjective";
          return (
            <Card
              key={f.key}
              title={`Question ${index + 1}`}
              actions={
                <div className="flex items-center gap-1">
                  {f.dirty ? <Badge tone="yellow">Unsaved</Badge> : <Badge tone="green">Saved</Badge>}
                  <IconButton title="Move up" disabled={!canEditContent || index === 0} onClick={() => move(index, -1)}>↑</IconButton>
                  <IconButton title="Move down" disabled={!canEditContent || index === forms.length - 1} onClick={() => move(index, 1)}>↓</IconButton>
                  <IconButton title="Duplicate" disabled={!canStructure} onClick={() => duplicate(f)}>⧉</IconButton>
                  <IconButton title="Delete" disabled={!canStructure} onClick={() => remove(f)} className="hover:text-red-400 hover:bg-red-500/10">🗑</IconButton>
                </div>
              }
            >
              <fieldset disabled={!canEditContent} className="space-y-4">
                <Field label="Question *">
                  <TextArea rows={3} value={f.question} onChange={(e) => patchForm(f.key, { question: e.target.value })} placeholder={isCoding ? "Problem statement..." : "Write the question..."} />
                </Field>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Field label="Type">
                    <Select value={f.questionType} onChange={(e) => patchForm(f.key, { questionType: e.target.value as QuestionType })}>
                      {QUESTION_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </Select>
                  </Field>
                  <Field label="Topic">
                    <TextInput list="college-topics" value={f.topic} onChange={(e) => patchForm(f.key, { topic: e.target.value })} placeholder="e.g. Java/OOP" />
                  </Field>
                  <Field label="Difficulty">
                    <Select value={f.difficulty} onChange={(e) => patchForm(f.key, { difficulty: e.target.value as QForm["difficulty"] })}>
                      {QUESTION_DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
                    </Select>
                  </Field>
                  <Field label="Marks">
                    <TextInput type="number" min={0} value={f.marks} onChange={(e) => patchForm(f.key, { marks: e.target.value })} />
                  </Field>
                </div>

                {isMcq && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Options — select the correct one</p>
                    {f.options.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i) as "A" | "B" | "C" | "D";
                      return (
                        <div key={letter} className="flex items-center gap-3">
                          <input
                            type="radio"
                            name={`correct-${f.key}`}
                            checked={f.correctAnswer === letter}
                            onChange={() => patchForm(f.key, { correctAnswer: letter })}
                            className="w-4 h-4 accent-emerald-500"
                            aria-label={`Option ${letter} is correct`}
                          />
                          <span className="w-5 text-sm font-semibold text-gray-300">{letter}</span>
                          <TextInput
                            value={opt}
                            onChange={(e) => patchForm(f.key, { options: f.options.map((o, j) => (j === i ? e.target.value : o)) })}
                            placeholder={`Option ${letter}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {isCoding && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Programming language">
                        <Select value={f.language} onChange={(e) => patchForm(f.key, { language: e.target.value })}>
                          <option value="">Use the interview's language</option>
                          {PROGRAMMING_LANGUAGES.filter((l) => l !== "None").map((l) => <option key={l}>{l}</option>)}
                        </Select>
                      </Field>
                    </div>
                    <Field label="Starter code (optional)">
                      <TextArea rows={4} className="font-mono text-xs" value={f.starterCode} onChange={(e) => patchForm(f.key, { starterCode: e.target.value })} />
                    </Field>
                    <Field label="Expected solution (kept private — used for evaluation)">
                      <TextArea rows={5} className="font-mono text-xs" value={f.expectedSolution} onChange={(e) => patchForm(f.key, { expectedSolution: e.target.value })} />
                    </Field>
                  </div>
                )}

                {!isMcq && (
                  <div className="space-y-4">
                    <Field label={`Expected answer${needsKey ? " *" : ""} (kept private)`}>
                      <TextArea rows={3} value={f.expectedAnswer} onChange={(e) => patchForm(f.key, { expectedAnswer: e.target.value })} placeholder="What a good answer covers..." />
                    </Field>
                    <Field label={`Evaluation criteria${needsKey ? " *" : ""} — key concepts, comma separated (kept private)`}>
                      <TextInput value={f.evaluationCriteria} onChange={(e) => patchForm(f.key, { evaluationCriteria: e.target.value })} placeholder="e.g. encapsulation, inheritance, polymorphism" />
                    </Field>
                    {needsKey && <p className="text-xs text-gray-500">Provide an expected answer or evaluation criteria (or both) so answers can be scored.</p>}
                  </div>
                )}
              </fieldset>

              {f.error && <p className="mt-3 text-sm text-red-400">{f.error}</p>}

              <div className="mt-4 flex justify-end">
                <Button variant={f.dirty ? "primary" : "secondary"} disabled={!canEditContent || !f.dirty} onClick={() => saveQuestion(f)}>
                  Save Question
                </Button>
              </div>
            </Card>
          );
        })}

        {forms.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-6">No questions yet. Add the first one below.</p>
        )}
      </div>

      <datalist id="college-topics">
        {TOPICS.map((t) => <option key={t} value={t} />)}
      </datalist>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" disabled={!canStructure} onClick={() => setForms((p) => [...p, blank()])}>
          + Add Question
        </Button>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 && <span className="text-xs text-yellow-400">{dirtyCount} unsaved</span>}
          <Button variant="secondary" loading={busy} disabled={status === "closed"} onClick={saveDraft}>Save Draft</Button>
          <Button variant="success" loading={busy} disabled={status === "closed"} onClick={publish}>
            {status === "published" ? "Save & Keep Published" : "Publish Interview"}
          </Button>
        </div>
      </div>
    </div>
  );
}
