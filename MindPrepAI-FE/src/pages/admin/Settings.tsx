import { useState } from "react";
import { adminApi } from "../../admin/api";
import { useLoad } from "../../admin/useLoad";
import type { AdminSettings } from "../../admin/types";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Button } from "../../components/admin/Button";
import { TextInput, Field } from "../../components/admin/Inputs";
import { Skeleton } from "../../components/admin/Skeleton";
import { ErrorState } from "../../components/admin/ErrorState";

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
        <PageHeader title="Settings" subtitle="Manage your admin profile" />
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
        subtitle="Manage your admin profile"
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
          </div>
        </Card>

        <Card title="About these settings">
          <p className="text-sm text-slate-600">
            Your display name and email are saved on this browser and shown in the sidebar. Account credentials are managed
            by the placement cell's MindPrep account - use the main sign-in to change your password.
          </p>
        </Card>
      </div>
    </div>
  );
}
