import { useState } from "react";
import { adminApi } from "../../admin/api";
import { useLoad } from "../../admin/useLoad";
import type { AdminSettings } from "../../admin/types";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Button } from "../../components/admin/Button";
import { TextInput, Select, Field } from "../../components/admin/Inputs";
import { Skeleton } from "../../components/admin/Skeleton";
import { ErrorState } from "../../components/admin/ErrorState";

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
        checked ? "bg-blue-600" : "bg-gray-700"
      }`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

const notificationItems = [
  { key: "email", label: "Email Notifications", desc: "Receive email alerts for important events" },
  { key: "push", label: "Push Notifications", desc: "Get push notifications in the browser" },
  { key: "weeklyDigest", label: "Weekly Digest", desc: "Summary report every Monday" },
  { key: "newInterview", label: "New Interview Alerts", desc: "Notify when a new interview is scheduled" },
  { key: "lowAtsAlert", label: "Low ATS Alerts", desc: "Alert when student ATS drops below threshold" },
  { key: "proctoringAlerts", label: "Proctoring Alerts", desc: "Immediate alerts for high-risk proctoring events" },
] as const;

export function Settings() {
  const { data: settings, loading, error, reload, setData } = useLoad(() => adminApi.getSettings());
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<AdminSettings>) => {
    if (!settings) return;
    setData({ ...settings, ...patch });
    setSaved(false);
  };

  const updateProfile = (patch: Partial<AdminSettings["profile"]>) => {
    if (!settings) return;
    update({ profile: { ...settings.profile, ...patch } });
  };

  const updateNotifications = (key: keyof AdminSettings["notifications"], value: boolean) => {
    if (!settings) return;
    update({ notifications: { ...settings.notifications, [key]: value } });
  };

  const handleSave = async () => {
    if (!settings) return;
    setBusy(true);
    await adminApi.updateSettings(settings);
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Settings" subtitle="Manage admin profile, theme and notifications" />
        <Skeleton rows={6} />
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div>
        <PageHeader title="Settings" />
        <ErrorState message={error || "Settings unavailable"} onRetry={reload} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage admin profile, theme and notifications"
        actions={
          <Button variant="primary" loading={busy} onClick={handleSave}>
            {saved ? "Saved ✓" : "Save Settings"}
          </Button>
        }
      />

      <div className="space-y-6 max-w-3xl">
        <Card title="Admin Profile">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name">
              <TextInput
                value={settings.profile.name}
                onChange={(e) => updateProfile({ name: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <TextInput
                value={settings.profile.email}
                onChange={(e) => updateProfile({ email: e.target.value })}
              />
            </Field>
            <Field label="Role">
              <TextInput value={settings.profile.role} readOnly className="opacity-60" />
            </Field>
            <Field label="Theme Preference">
              <Select
                value={settings.theme}
                onChange={(e) => update({ theme: e.target.value as AdminSettings["theme"] })}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card title="Notifications">
          <div className="divide-y divide-gray-800">
            {notificationItems.map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between py-3.5">
                <div>
                  <p className="text-white text-sm font-medium">{label}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{desc}</p>
                </div>
                <Toggle
                  checked={settings.notifications[key]}
                  onChange={(v) => updateNotifications(key, v)}
                />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Danger Zone">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-white text-sm font-medium">Reset demo data</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Clear all mock data in the dashboard (students, interviews, jobs).
              </p>
            </div>
            <Button variant="danger" onClick={() => window.location.reload()}>
              Reset Data
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
