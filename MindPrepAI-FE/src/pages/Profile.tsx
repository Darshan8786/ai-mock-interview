import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { getMyProfile, updateMyProfile, type StudentProfile } from "../services/profileApi";

const DEPARTMENTS = [
  "Computer Science",
  "Information Science",
  "Electronics & Communication",
  "Mechanical",
  "Civil",
  "Electrical & Electronics",
];

const YEARS = ["1", "2", "3", "4"];
const SEMESTERS = ["1", "2", "3", "4", "5", "6", "7", "8"];
const SECTIONS = ["A", "B", "C", "D"];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/50 rounded-2xl border border-gray-700 p-6"
    >
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-gray-900/70 border border-gray-600 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all";

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      className={inputCls}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function SelectInput({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <select
      className={inputCls}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder || "Select..."}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

export function Profile() {
  const [form, setForm] = useState<Partial<StudentProfile>>({});
  const [skillsText, setSkillsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completion, setCompletion] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await getMyProfile();
      setForm(profile);
      setSkillsText((profile.skills || []).join(", "));
      setCompletion(profile.profileCompletion);
    } catch {
      toast.error("Could not load profile. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key: keyof StudentProfile, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const patch = {
        ...form,
        skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean),
      };
      const updated = await updateMyProfile(patch);
      setCompletion(updated.profileCompletion);
      toast.success("Profile saved! It is now visible in the admin panel.");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center">
        <p className="text-gray-400">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">My Profile</h1>
            <p className="text-sm text-gray-400">Your details are shared with the Training & Placement Office.</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">Profile Completion</p>
            <p className="text-2xl font-bold text-blue-400">{completion}%</p>
          </div>
        </div>

        {/* Completion bar */}
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completion}%` }}
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500"
          />
        </div>

        {/* Basic Info */}
        <SectionCard title="Basic Information">
          <Field label="Full Name">
            <TextInput value={form.name || ""} onChange={(v) => set("name", v)} />
          </Field>
          <Field label="College Email">
            <TextInput value={form.collegeEmail || ""} onChange={(v) => set("collegeEmail", v)} placeholder="name@college.edu" />
          </Field>
          <Field label="Personal Email">
            <TextInput value={form.personalEmail || ""} onChange={(v) => set("personalEmail", v)} placeholder="you@gmail.com" />
          </Field>
          <Field label="Phone Number">
            <TextInput value={form.phone || ""} onChange={(v) => set("phone", v)} placeholder="+91 98765 43210" />
          </Field>
          <Field label="USN">
            <TextInput value={form.usn || ""} onChange={(v) => set("usn", v)} placeholder="e.g. 1CR21CS001" />
          </Field>
          <Field label="Register Number">
            <TextInput value={form.registerNumber || ""} onChange={(v) => set("registerNumber", v)} />
          </Field>
          <Field label="Date of Birth">
            <TextInput value={form.dateOfBirth || ""} onChange={(v) => set("dateOfBirth", v)} placeholder="DD/MM/YYYY" />
          </Field>
          <Field label="Address">
            <TextInput value={form.address || ""} onChange={(v) => set("address", v)} />
          </Field>
        </SectionCard>

        {/* Academics */}
        <SectionCard title="Academics">
          <Field label="Department">
            <SelectInput value={form.department || ""} onChange={(v) => set("department", v)} options={DEPARTMENTS} />
          </Field>
          <Field label="Year">
            <SelectInput value={form.year || ""} onChange={(v) => set("year", v)} options={YEARS} />
          </Field>
          <Field label="Semester">
            <SelectInput value={form.semester || ""} onChange={(v) => set("semester", v)} options={SEMESTERS} />
          </Field>
          <Field label="Section">
            <SelectInput value={form.section || ""} onChange={(v) => set("section", v)} options={SECTIONS} />
          </Field>
          <Field label="CGPA (out of 10)">
            <input
              className={inputCls}
              type="number"
              min={0}
              max={10}
              step={0.01}
              value={form.cgpa ?? ""}
              onChange={(e) => set("cgpa", e.target.value === "" ? null : Number(e.target.value))}
            />
          </Field>
        </SectionCard>

        {/* Skills & Projects */}
        <SectionCard title="Skills & Experience">
          <Field label="Skills (comma separated)">
            <TextInput value={skillsText} onChange={setSkillsText} placeholder="Java, Python, React, SQL" />
          </Field>
        </SectionCard>

        {/* Links */}
        <SectionCard title="Online Presence">
          <Field label="LinkedIn">
            <TextInput value={form.linkedin || ""} onChange={(v) => set("linkedin", v)} placeholder="https://linkedin.com/in/..." />
          </Field>
          <Field label="GitHub">
            <TextInput value={form.github || ""} onChange={(v) => set("github", v)} placeholder="https://github.com/..." />
          </Field>
          <Field label="Portfolio">
            <TextInput value={form.portfolio || ""} onChange={(v) => set("portfolio", v)} placeholder="https://..." />
          </Field>
          <Field label="Resume URL (PDF)">
            <TextInput value={form.resumeUrl || ""} onChange={(v) => set("resumeUrl", v)} placeholder="https://drive.google.com/..." />
          </Field>
        </SectionCard>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 transition-all"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
