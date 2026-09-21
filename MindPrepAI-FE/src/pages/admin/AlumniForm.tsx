import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { alumniApi, type Alumni, type AlumniInput } from "../../admin/alumniApi";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Button } from "../../components/admin/Button";
import { TextInput, TextArea, Field } from "../../components/admin/Inputs";

interface FormState {
  name: string;
  graduationYear: string;
  department: string;
  currentCompany: string;
  currentJobRole: string;
  email: string;
  linkedin: string;
  hasOpening: boolean;
  jobTitle: string;
  location: string;
  requiredSkills: string;
  jobDescription: string;
  applicationLink: string;
  lastDateToApply: string;
}

const empty: FormState = {
  name: "",
  graduationYear: "",
  department: "",
  currentCompany: "",
  currentJobRole: "",
  email: "",
  linkedin: "",
  hasOpening: false,
  jobTitle: "",
  location: "",
  requiredSkills: "",
  jobDescription: "",
  applicationLink: "",
  lastDateToApply: "",
};

/** yyyy-mm-dd in the admin's local time (toISOString would shift the day for some time zones). */
const toDateInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const fromAlumni = (a: Alumni): FormState => ({
  name: a.name,
  graduationYear: String(a.graduationYear),
  department: a.department,
  currentCompany: a.currentCompany,
  currentJobRole: a.currentJobRole,
  email: a.email,
  linkedin: a.linkedin || "",
  hasOpening: a.hasOpening,
  jobTitle: a.opening?.jobTitle || "",
  location: a.opening?.location || "",
  requiredSkills: (a.opening?.requiredSkills || []).join(", "),
  jobDescription: a.opening?.jobDescription || "",
  applicationLink: a.opening?.applicationLink || "",
  lastDateToApply: a.opening ? toDateInput(a.opening.lastDateToApply) : "",
});

const toPayload = (f: FormState): AlumniInput => ({
  name: f.name.trim(),
  graduationYear: Number(f.graduationYear),
  department: f.department.trim(),
  currentCompany: f.currentCompany.trim(),
  currentJobRole: f.currentJobRole.trim(),
  email: f.email.trim(),
  linkedin: f.linkedin.trim(),
  hasOpening: f.hasOpening,
  ...(f.hasOpening
    ? {
        opening: {
          jobTitle: f.jobTitle.trim(),
          location: f.location.trim(),
          requiredSkills: f.requiredSkills.split(",").map((s) => s.trim()).filter(Boolean),
          jobDescription: f.jobDescription.trim(),
          applicationLink: f.applicationLink.trim(),
          // End of the chosen day, so the opening stays visible to students all day.
          lastDateToApply: new Date(f.lastDateToApply + "T23:59:59").toISOString(),
        },
      }
    : {}),
});

export function AlumniForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<FormState>(empty);
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    alumniApi
      .get(id)
      .then((a) => setForm(fromAlumni(a)))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load alumni"))
      .finally(() => setLoading(false));
  }, [id]);

  const set = (key: keyof FormState) => (value: string) => setForm((p) => ({ ...p, [key]: value }));

  const validate = (): string => {
    if (!form.name.trim()) return "Name is required.";
    const year = Number(form.graduationYear);
    if (!form.graduationYear || !Number.isInteger(year) || year < 1950) return "Enter a valid graduation year.";
    if (!form.department.trim()) return "Department is required.";
    if (!form.currentCompany.trim()) return "Current company is required.";
    if (!form.currentJobRole.trim()) return "Current job role is required.";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Enter a valid email address.";
    if (form.hasOpening) {
      if (!form.jobTitle.trim() || !form.location.trim()) return "Job title and location are required for the job opening.";
      if (form.jobDescription.trim().length < 10) return "Job description must be at least 10 characters.";
      if (!form.applicationLink.trim()) return "Application link is required for the job opening.";
      if (!form.lastDateToApply) return "Last date to apply is required for the job opening.";
    }
    return "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = toPayload(form);
      if (isEdit && id) {
        await alumniApi.update(id, payload);
        toast.success("Alumni updated");
      } else {
        await alumniApi.create(payload);
        toast.success("Alumni added");
      }
      navigate("/admin/alumni");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-gray-400">Loading alumni...</div>;
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? "Edit Alumni" : "Add Alumni"}
        subtitle={isEdit ? "Update alumni details" : "Add an alumnus and, optionally, a job opening for students"}
        actions={
          <Button variant="ghost" onClick={() => navigate("/admin/alumni")}>
            ← Back to Alumni
          </Button>
        }
      />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Alumni Details">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name *">
                <TextInput value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. Priya Sharma" />
              </Field>
              <Field label="Email *">
                <TextInput type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} placeholder="name@example.com" />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Graduation Year *">
                <TextInput type="number" value={form.graduationYear} onChange={(e) => set("graduationYear")(e.target.value)} placeholder="e.g. 2020" />
              </Field>
              <Field label="Department *">
                <TextInput value={form.department} onChange={(e) => set("department")(e.target.value)} placeholder="e.g. CSE" />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Current Company *">
                <TextInput value={form.currentCompany} onChange={(e) => set("currentCompany")(e.target.value)} placeholder="e.g. Infosys" />
              </Field>
              <Field label="Current Job Role *">
                <TextInput value={form.currentJobRole} onChange={(e) => set("currentJobRole")(e.target.value)} placeholder="e.g. Software Engineer" />
              </Field>
            </div>
            <Field label="LinkedIn">
              <TextInput value={form.linkedin} onChange={(e) => set("linkedin")(e.target.value)} placeholder="https://www.linkedin.com/in/..." />
            </Field>
          </div>
        </Card>

        <Card title="Job Opening (optional)">
          <label
            className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm cursor-pointer transition-all ${
              form.hasOpening
                ? "bg-blue-600/15 border-blue-500/40 text-white"
                : "bg-gray-800/70 border-gray-700 text-gray-300 hover:border-gray-600"
            }`}
          >
            <input
              type="checkbox"
              checked={form.hasOpening}
              onChange={(e) => setForm((p) => ({ ...p, hasOpening: e.target.checked }))}
              className="w-4 h-4 accent-blue-500"
            />
            This alumnus has a job opening to share with students
          </label>

          {form.hasOpening && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Job Title *">
                  <TextInput value={form.jobTitle} onChange={(e) => set("jobTitle")(e.target.value)} placeholder="e.g. Backend Engineer" />
                </Field>
                <Field label="Location *">
                  <TextInput value={form.location} onChange={(e) => set("location")(e.target.value)} placeholder="e.g. Bengaluru" />
                </Field>
              </div>
              <Field label="Required Skills">
                <TextInput value={form.requiredSkills} onChange={(e) => set("requiredSkills")(e.target.value)} placeholder="e.g. Java, SQL, DSA (comma separated)" />
              </Field>
              <Field label="Job Description *">
                <TextArea rows={4} value={form.jobDescription} onChange={(e) => set("jobDescription")(e.target.value)} placeholder="What the role involves and who should apply..." />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Application Link *">
                  <TextInput value={form.applicationLink} onChange={(e) => set("applicationLink")(e.target.value)} placeholder="https://..." />
                </Field>
                <Field label="Last Date to Apply *">
                  <TextInput type="date" value={form.lastDateToApply} onChange={(e) => set("lastDateToApply")(e.target.value)} />
                </Field>
              </div>
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate("/admin/alumni")}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={busy}>
            {isEdit ? "Save Changes" : "Add Alumni"}
          </Button>
        </div>
      </form>
    </div>
  );
}
