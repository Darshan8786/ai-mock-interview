import { useMemo, useState } from "react";
import { adminApi } from "../../admin/api";
import { useLoad } from "../../admin/useLoad";
import type { AptitudeQuestion, AptitudeTestConfig, AptitudeTopic } from "../../admin/types";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Table } from "../../components/admin/Table";
import { Badge } from "../../components/admin/Badge";
import { Button, IconButton } from "../../components/admin/Button";
import { Modal } from "../../components/admin/Modal";
import { TableSkeleton } from "../../components/admin/Skeleton";
import { EmptyState } from "../../components/admin/EmptyState";
import { ErrorState } from "../../components/admin/ErrorState";
import { TextInput, TextArea, Select, Field } from "../../components/admin/Inputs";

const CATEGORIES = ["Quantitative", "Logical Reasoning", "Verbal Ability", "Data Interpretation"];
const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

const diffTone = (d: string) =>
  d === "beginner" ? "green" : d === "intermediate" ? "yellow" : "red";

type Tab = "questions" | "tests";

interface QForm {
  category: "Quantitative" | "Logical Reasoning" | "Verbal Ability" | "Data Interpretation";
  topic: string;
  subtopic: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  estimatedTime: number;
  companyNames: string;
}

const emptyQForm: QForm = {
  category: "Quantitative",
  topic: "",
  subtopic: "",
  difficulty: "intermediate",
  question: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  explanation: "",
  estimatedTime: 60,
  companyNames: "",
};

interface TForm {
  title: string;
  description: string;
  category: string;
  difficulty: string;
  questionCount: number;
  durationMinutes: number;
  marksPerQuestion: number;
  negativeMarksPerQuestion: number;
  passingScore: number;
  isActive: boolean;
}

const emptyTForm: TForm = {
  title: "",
  description: "",
  category: "",
  difficulty: "",
  questionCount: 20,
  durationMinutes: 20,
  marksPerQuestion: 1,
  negativeMarksPerQuestion: 0.25,
  passingScore: 50,
  isActive: true,
};

export function AptitudeManagement() {
  const [tab, setTab] = useState<Tab>("questions");

  const questionsLoad = useLoad(() => adminApi.getAptitudeQuestions());
  const testsLoad = useLoad(() => adminApi.getAptitudeTests());
  const topicsLoad = useLoad(() => adminApi.getAptitudeTopics());

  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState("all");

  const [qForm, setQForm] = useState<QForm | null>(null);
  const [editingQ, setEditingQ] = useState<string | null>(null);
  const [deletingQ, setDeletingQ] = useState<AptitudeQuestion | null>(null);

  const [tForm, setTForm] = useState<TForm | null>(null);
  const [editingT, setEditingT] = useState<string | null>(null);
  const [deletingT, setDeletingT] = useState<AptitudeTestConfig | null>(null);
  const [busy, setBusy] = useState(false);

  const questions = questionsLoad.data ?? [];
  const tests = testsLoad.data ?? [];
  const topics = topicsLoad.data ?? [];

  const filteredQs = useMemo(() => {
    const q = query.toLowerCase();
    return questions.filter((qs) => {
      const matchQ =
        !q ||
        qs.question.toLowerCase().includes(q) ||
        qs.topic.toLowerCase().includes(q);
      const matchCat = catFilter === "all" || qs.category === catFilter;
      return matchQ && matchCat;
    });
  }, [questions, query, catFilter]);

  const topicNames = useMemo(() => {
    const set = new Set<string>();
    topics.forEach((t: AptitudeTopic) => set.add(t.name));
    questions.forEach((q) => set.add(q.topic));
    return Array.from(set).sort();
  }, [topics, questions]);

  const openCreateQ = () => {
    setEditingQ(null);
    setQForm(emptyQForm);
  };

  const openEditQ = (q: AptitudeQuestion) => {
    setEditingQ(q._id);
    setQForm({
      category: q.category,
      topic: q.topic,
      subtopic: q.subtopic || "",
      difficulty: q.difficulty,
      question: q.question,
      options: [...(q.options.length ? q.options : ["", "", "", ""])],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || "",
      estimatedTime: q.estimatedTime || 60,
      companyNames: (q.companyTags || []).map((t) => t.name).join(", "),
    });
  };

  const handleSaveQ = async () => {
    if (!qForm) return;
    setBusy(true);
    const payload = {
      category: qForm.category,
      topic: qForm.topic.trim(),
      subtopic: qForm.subtopic.trim(),
      difficulty: qForm.difficulty,
      question: qForm.question.trim(),
      options: qForm.options.map((o) => o.trim()),
      correctAnswer: qForm.correctAnswer,
      explanation: qForm.explanation.trim(),
      estimatedTime: Number(qForm.estimatedTime || 60),
      companyTags: qForm.companyNames
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean)
        .map((name) => ({ name, style: `${name.toLowerCase()}-style` })),
    };

    try {
      if (editingQ) {
        await adminApi.updateAptitudeQuestion(editingQ, payload);
        questionsLoad.reload();
      } else {
        await adminApi.createAptitudeQuestion(payload);
        questionsLoad.reload();
      }
      setQForm(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteQ = async () => {
    if (!deletingQ) return;
    setBusy(true);
    await adminApi.deleteAptitudeQuestion(deletingQ._id);
    questionsLoad.reload();
    setBusy(false);
    setDeletingQ(null);
  };

  const openCreateT = () => {
    setEditingT(null);
    setTForm(emptyTForm);
  };

  const openEditT = (t: AptitudeTestConfig) => {
    setEditingT(t._id);
    setTForm({
      title: t.title,
      description: t.description || "",
      category: t.category || "",
      difficulty: t.difficulty || "",
      questionCount: t.questionCount,
      durationMinutes: t.durationMinutes,
      marksPerQuestion: t.marksPerQuestion,
      negativeMarksPerQuestion: t.negativeMarksPerQuestion,
      passingScore: t.passingScore,
      isActive: t.isActive,
    });
  };

  const handleSaveT = async () => {
    if (!tForm) return;
    setBusy(true);
    try {
      if (editingT) {
        await adminApi.updateAptitudeTest(editingT, tForm);
        testsLoad.reload();
      } else {
        await adminApi.createAptitudeTest(tForm);
        testsLoad.reload();
      }
      setTForm(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteT = async () => {
    if (!deletingT) return;
    setBusy(true);
    await adminApi.deleteAptitudeTest(deletingT._id);
    testsLoad.reload();
    setBusy(false);
    setDeletingT(null);
  };

  return (
    <div>
      <PageHeader
        title="Aptitude Management"
        subtitle="Manage the aptitude question bank and mock test configs"
        actions={
          tab === "questions" ? (
            <Button variant="primary" onClick={openCreateQ}>+ New Question</Button>
          ) : (
            <Button variant="primary" onClick={openCreateT}>+ New Test</Button>
          )
        }
      />

      <div className="flex gap-1 mb-4 p-1 bg-gray-900/60 rounded-xl border border-gray-800 w-fit">
        <TabButton active={tab === "questions"} onClick={() => setTab("questions")}>
          Question Bank ({questions.length})
        </TabButton>
        <TabButton active={tab === "tests"} onClick={() => setTab("tests")}>
          Test Configs ({tests.length})
        </TabButton>
      </div>

      {(questionsLoad.error || testsLoad.error || topicsLoad.error) && (
        <ErrorState message="Could not load aptitude data." onRetry={() => { questionsLoad.reload(); testsLoad.reload(); topicsLoad.reload(); }} />
      )}

      {tab === "questions" && (
        <Card
          title={`Questions (${filteredQs.length})`}
          actions={
            <div className="flex flex-col sm:flex-row gap-2">
              <TextInput
                placeholder="Search question or topic..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="sm:w-64"
              />
              <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
          }
        >
          {questionsLoad.loading ? (
            <TableSkeleton />
          ) : filteredQs.length === 0 ? (
            <EmptyState icon="📊" title="No questions found" description="Seed the question bank or add your first question." />
          ) : (
            <Table<AptitudeQuestion>
              columns={[
                { key: "question", header: "Question" },
                { key: "category", header: "Category" },
                { key: "difficulty", header: "Difficulty" },
                { key: "topics", header: "Topic" },
                { key: "tags", header: "Company Tags" },
                { key: "status", header: "Status" },
                { key: "actions", header: "Actions", className: "text-right" },
              ]}
              rows={filteredQs}
              renderRow={(q) => (
                <>
                  <td className="py-3 px-4 max-w-xs">
                    <p className="text-white font-medium truncate">{q.question}</p>
                  </td>
                  <td className="py-3 px-4">
                    <Badge tone="blue">{q.category}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge tone={diffTone(q.difficulty) as any}>{q.difficulty}</Badge>
                  </td>
                  <td className="py-3 px-4 text-gray-300">{q.topic}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {(q.companyTags || []).slice(0, 2).map((t) => (
                        <span key={t.name} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/60 text-gray-300">
                          {t.name}
                        </span>
                      ))}
                      {(q.companyTags || []).length > 2 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700/60 text-gray-400">
                          +{(q.companyTags || []).length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge tone={q.isActive ? "green" : "red"}>{q.isActive ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton title="Edit" onClick={() => openEditQ(q)}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </IconButton>
                      <IconButton title="Delete" onClick={() => setDeletingQ(q)} className="hover:text-red-400 hover:bg-red-500/10">
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
      )}

      {tab === "tests" && (
        <Card title={`Test Configs (${tests.length})`}>
          {testsLoad.loading ? (
            <TableSkeleton />
          ) : tests.length === 0 ? (
            <EmptyState icon="🏁" title="No test configs" description="Create a mock test configuration to let students take full-length tests." />
          ) : (
            <Table<AptitudeTestConfig>
              columns={[
                { key: "title", header: "Title" },
                { key: "config", header: "Config" },
                { key: "scoring", header: "Scoring" },
                { key: "status", header: "Status" },
                { key: "actions", header: "Actions", className: "text-right" },
              ]}
              rows={tests}
              renderRow={(t) => (
                <>
                  <td className="py-3 px-4">
                    <p className="text-white font-medium">{t.title}</p>
                    <p className="text-xs text-gray-500 line-clamp-1 max-w-xs">{t.description}</p>
                  </td>
                  <td className="py-3 px-4 text-gray-300">
                    {t.questionCount} Q · {t.durationMinutes} min
                    <span className="block text-xs text-gray-500">{t.category || "All categories"}</span>
                  </td>
                  <td className="py-3 px-4 text-gray-300">
                    +{t.marksPerQuestion}/−{t.negativeMarksPerQuestion} · pass {t.passingScore}%
                  </td>
                  <td className="py-3 px-4">
                    <Badge tone={t.isActive ? "green" : "red"}>{t.isActive ? "Published" : "Hidden"}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton title="Edit" onClick={() => openEditT(t)}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </IconButton>
                      <IconButton title="Delete" onClick={() => setDeletingT(t)} className="hover:text-red-400 hover:bg-red-500/10">
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
      )}

      {/* Question create/edit modal */}
      <Modal
        open={!!qForm}
        onClose={() => setQForm(null)}
        title={editingQ ? "Edit Question" : "New Question"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setQForm(null)}>Cancel</Button>
            <Button loading={busy} onClick={handleSaveQ}>Save Question</Button>
          </>
        }
      >
        {qForm && (
          <div className="space-y-4">
            <Field label="Question Text">
              <TextArea
                rows={2}
                placeholder="Enter the question..."
                value={qForm.question}
                onChange={(e) => setQForm((p) => p && { ...p, question: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <Select value={qForm.category} onChange={(e) => setQForm((p) => p && { ...p, category: e.target.value as QForm["category"] })}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Difficulty">
                <Select value={qForm.difficulty} onChange={(e) => setQForm((p) => p && { ...p, difficulty: e.target.value as QForm["difficulty"] })}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Topic">
                <TextInput
                  list="apt-topics"
                  placeholder="e.g. Percentage"
                  value={qForm.topic}
                  onChange={(e) => setQForm((p) => p && { ...p, topic: e.target.value })}
                />
                <datalist id="apt-topics">
                  {topicNames.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </Field>
              <Field label="Estimated Time (s)">
                <TextInput
                  type="number"
                  min={10}
                  value={qForm.estimatedTime}
                  onChange={(e) => setQForm((p) => p && { ...p, estimatedTime: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="Options">
              <div className="space-y-2">
                {qForm.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQForm((p) => p && { ...p, correctAnswer: idx })}
                      className={`shrink-0 w-7 h-7 rounded-full border text-xs font-bold ${
                        qForm.correctAnswer === idx
                          ? "bg-emerald-500 border-emerald-500 text-white"
                          : "bg-gray-800 border-gray-600 text-gray-400"
                      }`}
                      title={qForm.correctAnswer === idx ? "Correct answer" : "Set as correct"}
                    >
                      {String.fromCharCode(65 + idx)}
                    </button>
                    <TextInput
                      value={opt}
                      onChange={(e) =>
                        setQForm((p) => p && { ...p, options: p.options.map((o, i) => (i === idx ? e.target.value : o)) })
                      }
                      placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-500 mt-1">Green highlighted letter = correct answer. Click a letter to change it.</p>
            </Field>
            <Field label="Explanation">
              <TextArea
                rows={2}
                placeholder="Explain the solution..."
                value={qForm.explanation}
                onChange={(e) => setQForm((p) => p && { ...p, explanation: e.target.value })}
              />
            </Field>
            <Field label="Company Tags (comma separated)">
              <TextInput
                placeholder="TCS, Infosys, Wipro"
                value={qForm.companyNames}
                onChange={(e) => setQForm((p) => p && { ...p, companyNames: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>

      {/* Test create/edit modal */}
      <Modal
        open={!!tForm}
        onClose={() => setTForm(null)}
        title={editingT ? "Edit Test" : "New Test"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTForm(null)}>Cancel</Button>
            <Button loading={busy} onClick={handleSaveT}>Save Test</Button>
          </>
        }
      >
        {tForm && (
          <div className="space-y-4">
            <Field label="Title">
              <TextInput
                placeholder="e.g. Full Mock Aptitude Test"
                value={tForm.title}
                onChange={(e) => setTForm((p) => p && { ...p, title: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <TextInput
                placeholder="Short description students will see"
                value={tForm.description}
                onChange={(e) => setTForm((p) => p && { ...p, description: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category (blank = all)">
                <Select value={tForm.category} onChange={(e) => setTForm((p) => p && { ...p, category: e.target.value })}>
                  <option value="">All Categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Difficulty (blank = mixed)">
                <Select value={tForm.difficulty} onChange={(e) => setTForm((p) => p && { ...p, difficulty: e.target.value })}>
                  <option value="">Mixed</option>
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Questions">
                <TextInput
                  type="number"
                  min={1}
                  max={100}
                  value={tForm.questionCount}
                  onChange={(e) => setTForm((p) => p && { ...p, questionCount: Number(e.target.value) })}
                />
              </Field>
              <Field label="Duration (min)">
                <TextInput
                  type="number"
                  min={1}
                  value={tForm.durationMinutes}
                  onChange={(e) => setTForm((p) => p && { ...p, durationMinutes: Number(e.target.value) })}
                />
              </Field>
              <Field label="Pass %">
                <TextInput
                  type="number"
                  min={0}
                  max={100}
                  value={tForm.passingScore}
                  onChange={(e) => setTForm((p) => p && { ...p, passingScore: Number(e.target.value) })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Marks per question">
                <TextInput
                  type="number"
                  min={0}
                  step={0.25}
                  value={tForm.marksPerQuestion}
                  onChange={(e) => setTForm((p) => p && { ...p, marksPerQuestion: Number(e.target.value) })}
                />
              </Field>
              <Field label="Negative marks per wrong">
                <TextInput
                  type="number"
                  min={0}
                  step={0.25}
                  value={tForm.negativeMarksPerQuestion}
                  onChange={(e) => setTForm((p) => p && { ...p, negativeMarksPerQuestion: Number(e.target.value) })}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300">
              <input
                type="checkbox"
                checked={tForm.isActive}
                onChange={(e) => setTForm((p) => p && { ...p, isActive: e.target.checked })}
                className="w-4 h-4 accent-emerald-500"
              />
              Published (visible to students)
            </label>
          </div>
        )}
      </Modal>

      {/* Delete confirms */}
      <Modal
        open={!!deletingQ}
        onClose={() => setDeletingQ(null)}
        title="Confirm Deletion"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingQ(null)}>Cancel</Button>
            <Button variant="danger" loading={busy} onClick={handleDeleteQ}>Delete</Button>
          </>
        }
      >
        <p className="text-gray-300 text-sm">
          Delete this question permanently? Students will no longer see it in tests.
        </p>
      </Modal>

      <Modal
        open={!!deletingT}
        onClose={() => setDeletingT(null)}
        title="Confirm Deletion"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeletingT(null)}>Cancel</Button>
            <Button variant="danger" loading={busy} onClick={handleDeleteT}>Delete</Button>
          </>
        }
      >
        <p className="text-gray-300 text-sm">
          Delete test <span className="text-white font-semibold">{deletingT?.title}</span>? Students will no longer see it.
        </p>
      </Modal>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-gray-400 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
