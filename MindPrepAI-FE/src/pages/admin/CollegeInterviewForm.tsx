import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  collegeInterviewApi,
  INTERVIEW_TYPES,
  PROGRAMMING_LANGUAGES,
  DIFFICULTIES,
  type CollegeInterviewConfig,
} from "../../admin/collegeInterviewApi";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Button } from "../../components/admin/Button";
import { TextInput, TextArea, Select, Field } from "../../components/admin/Inputs";

const empty: CollegeInterviewConfig = {
  name: "",
  jobRole: "",
  interviewType: "Technical",
  programmingLanguage: "None",
  difficulty: "Medium",
  description: "",
  questionCount: 5,
  timeLimit: 30,
};

/** Create or edit the configuration of a college interview (questions are written on the next screen). */
export function CollegeInterviewForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<CollegeInterviewConfig>(empty);
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    collegeInterviewApi
      .get(id)
      .then(({ interview }) =>
        setForm({
          name: interview.name,
          jobRole: interview.jobRole,
          interviewType: interview.interviewType,
          programmingLanguage: interview.programmingLanguage,
          difficulty: interview.difficulty,
          description: interview.description || "",
          questionCount: interview.questionCount,
          timeLimit: interview.timeLimit,
        })
      )
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load interview"))
      .finally(() => setLoading(false));
  }, [id]);

  const set = <K extends keyof CollegeInterviewConfig>(key: K, value: CollegeInterviewConfig[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const validate = () => {
    if (!form.name.trim()) return "Interview name is required.";
    if (!form.jobRole.trim()) return "Job role is required.";
    if (!Number.isInteger(form.questionCount) || form.questionCount < 1 || form.questionCount > 50) return "Number of questions must be between 1 and 50.";
    if (!Number.isInteger(form.timeLimit) || form.timeLimit < 1 || form.timeLimit > 300) return "Time limit must be between 1 and 300 minutes.";
    return "";
  };

  const submit = async (e: React.FormEvent, next: "questions" | "list") => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = isEdit && id ? await collegeInterviewApi.update(id, form) : await collegeInterviewApi.create(form);
      toast.success(isEdit ? "Interview updated" : "Interview created as a draft");
      navigate(next === "questions" ? `/admin/college-interviews/${saved._id}/questions` : "/admin/interviews?tab=college");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-24 text-gray-400">Loading interview...</div>;

  return (
    <div>
      <PageHeader
        title={isEdit ? "Edit Interview" : "Create Interview"}
        subtitle={isEdit ? "Update the interview configuration" : "Set up the interview, then write its questions"}
        actions={
          <Button variant="ghost" onClick={() => navigate("/admin/interviews?tab=college")}>
            ← Back to Interviews
          </Button>
        }
      />

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">{error}</div>}

      <form noValidate onSubmit={(e) => submit(e, "questions")} className="space-y-6">
        <Card title="Interview Configuration">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Interview Name *">
                <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Java Developer Interview" />
              </Field>
              <Field label="Job Role *">
                <TextInput value={form.jobRole} onChange={(e) => set("jobRole", e.target.value)} placeholder="e.g. Java Developer" />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Interview Type *">
                <Select value={form.interviewType} onChange={(e) => set("interviewType", e.target.value as CollegeInterviewConfig["interviewType"])}>
                  {INTERVIEW_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Programming Language">
                <Select value={form.programmingLanguage} onChange={(e) => set("programmingLanguage", e.target.value as CollegeInterviewConfig["programmingLanguage"])}>
                  {PROGRAMMING_LANGUAGES.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Difficulty *">
                <Select value={form.difficulty} onChange={(e) => set("difficulty", e.target.value as CollegeInterviewConfig["difficulty"])}>
                  {DIFFICULTIES.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Number of Questions *">
                <TextInput type="number" min={1} max={50} value={form.questionCount} onChange={(e) => set("questionCount", Number(e.target.value))} />
              </Field>
              <Field label="Time Limit (minutes) *">
                <TextInput type="number" min={1} max={300} value={form.timeLimit} onChange={(e) => set("timeLimit", Number(e.target.value))} />
              </Field>
            </div>
            <Field label="Description">
              <TextArea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What students should expect..." />
            </Field>
            <p className="text-xs text-gray-500">New interviews start as a draft; students can't see them until you publish.</p>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate("/admin/interviews?tab=college")}>
            Cancel
          </Button>
          {isEdit && (
            <Button type="button" variant="secondary" loading={busy} onClick={(e) => submit(e as unknown as React.FormEvent, "list")}>
              Save
            </Button>
          )}
          <Button type="submit" variant="primary" loading={busy}>
            {isEdit ? "Save & Edit Questions" : "Create & Add Questions"}
          </Button>
        </div>
      </form>
    </div>
  );
}
