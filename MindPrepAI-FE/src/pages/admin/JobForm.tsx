import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { adminApi } from "../../admin/api";
import type { AdminJob, JobEligibility, JobStatus } from "../../admin/types";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Button } from "../../components/admin/Button";
import { TextInput, TextArea, Select, Field } from "../../components/admin/Inputs";

interface JobFormState {
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  location: string;
  jobType: string;
  package: string;
  requiredSkills: string;
  minimumCGPA: string;
  maximumBacklogs: string;
  deptChecks: string[];
  allowedDepartments: string;
  lastDateToApply: string;
  numberOfOpenings: string;
  companyWebsite: string;
  applicationLink: string;
  experience: string;
  responsibilities: string;
  qualifications: string;
  selectionProcess: string;
  status: JobStatus;
}

const DEPT_OPTIONS = [
  { code: "CSE", label: "CSE (Computer Science)" },
  { code: "ISE", label: "ISE (Information Science)" },
  { code: "ECE", label: "ECE (Electronics & Communication)" },
  { code: "EEE", label: "EEE (Electrical & Electronics)" },
  { code: "Mechanical", label: "Mechanical" },
  { code: "Civil", label: "Civil" },
];

const DEPT_CODES = DEPT_OPTIONS.map((d) => d.code);

const empty: JobFormState = {
  companyName: "",
  jobTitle: "",
  jobDescription: "",
  location: "Bengaluru",
  jobType: "Full-time",
  package: "",
  requiredSkills: "",
  minimumCGPA: "",
  maximumBacklogs: "0",
  deptChecks: [],
  allowedDepartments: "",
  lastDateToApply: "",
  numberOfOpenings: "1",
  companyWebsite: "",
  applicationLink: "",
  experience: "",
  responsibilities: "",
  qualifications: "",
  selectionProcess: "",
  status: "active",
};

const fromJob = (job: AdminJob): JobFormState => {
  const depts = job.eligibility?.allowedDepartments || [];
  const deptChecks = depts.filter((d) => DEPT_CODES.includes(d));
  const others = depts.filter((d) => !DEPT_CODES.includes(d));
  return {
    companyName: job.companyName || "",
    jobTitle: job.jobTitle || "",
    jobDescription: job.jobDescription || "",
    location: job.location || "",
    jobType: job.jobType || "Full-time",
    package: job.package || "",
    requiredSkills: (job.requiredSkills || []).join(", "),
    minimumCGPA: job.eligibility?.minimumCGPA != null ? String(job.eligibility.minimumCGPA) : "",
    maximumBacklogs: job.eligibility?.maximumBacklogs != null ? String(job.eligibility.maximumBacklogs) : "0",
    deptChecks,
    allowedDepartments: others.join(", "),
    lastDateToApply: new Date(job.lastDateToApply).toISOString().slice(0, 10),
    numberOfOpenings: String(job.numberOfOpenings ?? 1),
    companyWebsite: job.companyWebsite || "",
    applicationLink: job.applicationLink || "",
    experience: job.experience || "",
    responsibilities: job.responsibilities || "",
    qualifications: job.qualifications || "",
    selectionProcess: job.selectionProcess || "",
    status: job.status || "active",
  };
};

const toPayload = (f: JobFormState) => {
  const skills = f.requiredSkills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const otherDepts = f.allowedDepartments
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const departments = [...f.deptChecks, ...otherDepts];
  const eligibility: JobEligibility = {
    minimumCGPA: f.minimumCGPA ? Number(f.minimumCGPA) : null,
    maximumBacklogs: f.maximumBacklogs !== "" ? Number(f.maximumBacklogs) : 0,
    allowedDepartments: departments,
  };
  return {
    companyName: f.companyName,
    jobTitle: f.jobTitle,
    jobDescription: f.jobDescription,
    location: f.location,
    jobType: f.jobType,
    package: f.package,
    requiredSkills: skills,
    eligibility,
    lastDateToApply: new Date(f.lastDateToApply + "T23:59:59").toISOString(),
    numberOfOpenings: Number(f.numberOfOpenings) || 1,
    companyWebsite: f.companyWebsite,
    applicationLink: f.applicationLink,
    experience: f.experience,
    responsibilities: f.responsibilities,
    qualifications: f.qualifications,
    selectionProcess: f.selectionProcess,
    status: f.status,
  };
};

export function JobForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState<JobFormState>(empty);
  const [loading, setLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    adminApi
      .getJob(id)
      .then((job) => {
        setForm(fromJob(job));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || "Failed to load job");
        setLoading(false);
      });
  }, [id]);

  const set = (key: keyof JobFormState) => (value: string) =>
    setForm((p) => ({ ...p, [key]: value }));

  const handleSubmit = async () => {
    if (!form.companyName.trim() || !form.jobTitle.trim() || !form.jobDescription.trim()) {
      setError("Company, Job Title and Description are required.");
      return;
    }
    if (!form.lastDateToApply) {
      setError("Application deadline is required.");
      return;
    }
    if (form.minimumCGPA && (Number(form.minimumCGPA) < 0 || Number(form.minimumCGPA) > 10)) {
      setError("Minimum CGPA must be between 0 and 10.");
      return;
    }
    if (form.maximumBacklogs !== "" && Number(form.maximumBacklogs) < 0) {
      setError("Maximum backlogs cannot be negative.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const payload = toPayload(form);
      if (isEdit && id) {
        await adminApi.updateJob(id, payload);
        toast.success("Job updated successfully");
      } else {
        await adminApi.createJob(payload);
        toast.success("Job posted successfully");
      }
      navigate("/admin/jobs");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        Loading job...
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? "Edit Job" : "Post Job"}
        subtitle={isEdit ? "Update the placement opportunity" : "Create a new placement opportunity"}
        actions={
          <Button variant="ghost" onClick={() => navigate("/admin/jobs")}>
            ← Back to Jobs
          </Button>
        }
      />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <Card title="Basic Details">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Company *">
                <TextInput value={form.companyName} onChange={(e) => set("companyName")(e.target.value)} placeholder="e.g. Infosys" />
              </Field>
              <Field label="Job Title *">
                <TextInput value={form.jobTitle} onChange={(e) => set("jobTitle")(e.target.value)} placeholder="e.g. Software Engineer" />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Location *">
                <TextInput value={form.location} onChange={(e) => set("location")(e.target.value)} placeholder="e.g. Bengaluru" />
              </Field>
              <Field label="Job Type *">
                <Select value={form.jobType} onChange={(e) => set("jobType")(e.target.value)}>
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Internship">Internship</option>
                  <option value="Contract">Contract</option>
                  <option value="Remote">Remote</option>
                  <option value="On-site">On-site</option>
                  <option value="Hybrid">Hybrid</option>
                </Select>
              </Field>
              <Field label="Package">
                <TextInput value={form.package} onChange={(e) => set("package")(e.target.value)} placeholder="e.g. 8-12 LPA" />
              </Field>
            </div>
            <Field label="Job Description *">
              <TextArea rows={4} value={form.jobDescription} onChange={(e) => set("jobDescription")(e.target.value)} placeholder="Describe the role, responsibilities and what the company is looking for..." />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Required Skills">
                <TextInput value={form.requiredSkills} onChange={(e) => set("requiredSkills")(e.target.value)} placeholder="e.g. Java, SQL, DSA" />
              </Field>
              <Field label="Experience">
                <TextInput value={form.experience} onChange={(e) => set("experience")(e.target.value)} placeholder="e.g. 0-1 years, Fresher" />
              </Field>
              <Field label="Number of Openings">
                <TextInput type="number" min={1} value={form.numberOfOpenings} onChange={(e) => set("numberOfOpenings")(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Company Website">
                <TextInput value={form.companyWebsite} onChange={(e) => set("companyWebsite")(e.target.value)} placeholder="https://..." />
              </Field>
              <Field label="External Application Link">
                <TextInput value={form.applicationLink} onChange={(e) => set("applicationLink")(e.target.value)} placeholder="https://..." />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Eligibility Criteria">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Minimum CGPA">
              <TextInput type="number" step="0.1" min={0} max={10} value={form.minimumCGPA} onChange={(e) => set("minimumCGPA")(e.target.value)} placeholder="e.g. 7.0 (leave blank for any)" />
            </Field>
            <Field label="Maximum Backlogs">
              <TextInput type="number" min={0} value={form.maximumBacklogs} onChange={(e) => set("maximumBacklogs")(e.target.value)} placeholder="e.g. 0" />
            </Field>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Allowed Departments</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {DEPT_OPTIONS.map((d) => {
                const checked = form.deptChecks.includes(d.code);
                return (
                  <label
                    key={d.code}
                    className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm cursor-pointer transition-all ${
                      checked
                        ? "bg-blue-600/15 border-blue-500/40 text-white"
                        : "bg-gray-800/70 border-gray-700 text-gray-300 hover:border-gray-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setForm((p) => ({
                          ...p,
                          deptChecks: checked
                            ? p.deptChecks.filter((c) => c !== d.code)
                            : [...p.deptChecks, d.code],
                        }))
                      }
                      className="w-4 h-4 accent-blue-500"
                    />
                    {d.label}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3 mb-1.5">Additional departments (comma separated, optional)</p>
            <TextInput value={form.allowedDepartments} onChange={(e) => set("allowedDepartments")(e.target.value)} placeholder="e.g. Biotechnology, AIML (blank = only selected)" />
            {form.deptChecks.length === 0 && !form.allowedDepartments.trim() && (
              <p className="text-xs text-gray-500 mt-2">No departments selected — all departments will be eligible.</p>
            )}
          </div>
        </Card>

        <Card title="Additional Details">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Application Deadline *">
                <TextInput type="date" value={form.lastDateToApply} onChange={(e) => set("lastDateToApply")(e.target.value)} />
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(e) => set("status")(e.target.value as JobStatus)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="closed">Closed</option>
                  <option value="expired">Expired</option>
                </Select>
              </Field>
            </div>
            <Field label="Responsibilities">
              <TextArea rows={3} value={form.responsibilities} onChange={(e) => set("responsibilities")(e.target.value)} placeholder="Key responsibilities of the role..." />
            </Field>
            <Field label="Qualifications">
              <TextArea rows={3} value={form.qualifications} onChange={(e) => set("qualifications")(e.target.value)} placeholder="Required qualifications..." />
            </Field>
            <Field label="Selection Process">
              <TextArea rows={3} value={form.selectionProcess} onChange={(e) => set("selectionProcess")(e.target.value)} placeholder="e.g. Aptitude test → Technical interview → HR round" />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => navigate("/admin/jobs")}>Cancel</Button>
          <Button loading={busy} onClick={handleSubmit}>
            {isEdit ? "Save Changes" : "Post Job"}
          </Button>
        </div>
      </div>
    </div>
  );
}
