import { useMemo, useState } from "react";
import { adminApi } from "../../admin/api";
import { useLoad } from "../../admin/useLoad";
import type { Announcement } from "../../admin/types";
import { PageHeader } from "../../components/admin/PageHeader";
import { Badge } from "../../components/admin/Badge";
import { statusTone } from "../../components/admin/statusTone";
import { Button, IconButton } from "../../components/admin/Button";
import { Modal } from "../../components/admin/Modal";
import { Skeleton } from "../../components/admin/Skeleton";
import { EmptyState } from "../../components/admin/EmptyState";
import { ErrorState } from "../../components/admin/ErrorState";
import { TextInput, TextArea, Select, Field } from "../../components/admin/Inputs";

interface AnnouncementForm {
  title: string;
  body: string;
  audience: Announcement["audience"];
  status: Announcement["status"];
  priority: Announcement["priority"];
  scheduledAt?: string;
}

const emptyForm: AnnouncementForm = {
  title: "",
  body: "",
  audience: "all",
  status: "draft",
  priority: "normal",
};

const priorityTone = { normal: "gray", important: "yellow", urgent: "red" } as const;
const audienceTone = { all: "blue", students: "purple", placed: "green", freshers: "yellow" } as const;

export function Announcements() {
  const { data: announcements, loading, error, reload, setData } = useLoad(() => adminApi.getAnnouncements());
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState<AnnouncementForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () =>
      (announcements ?? []).filter(
        (a) => statusFilter === "all" || a.status === statusFilter
      ),
    [announcements, statusFilter]
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const openEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      body: a.body,
      audience: a.audience,
      status: a.status,
      priority: a.priority,
      scheduledAt: a.scheduledAt,
    });
  };

  const handleSave = async () => {
    if (!form) return;
    setBusy(true);
    if (editingId) {
      const updated = await adminApi.updateAnnouncement(editingId, form);
      setData((prev) => prev!.map((a) => (a.id === editingId ? { ...a, ...updated } : a)));
    } else {
      const created = await adminApi.createAnnouncement(form);
      setData((prev) => [created, ...prev!]);
    }
    setBusy(false);
    setForm(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    await adminApi.deleteAnnouncement(deleting.id);
    setData((prev) => prev!.filter((a) => a.id !== deleting.id));
    setBusy(false);
    setDeleting(null);
  };

  const publishNow = async (a: Announcement) => {
    const updated = await adminApi.updateAnnouncement(a.id, {
      status: "published",
      publishedAt: new Date().toISOString(),
    });
    setData((prev) => prev!.map((x) => (x.id === a.id ? { ...x, ...updated } : x)));
  };

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Send announcements to students and manage their status"
        actions={<Button variant="primary" onClick={openCreate}>+ New Announcement</Button>}
      />

      {error && <ErrorState message={error} onRetry={reload} />}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">Showing {filtered.length} announcement{filtered.length === 1 ? "" : "s"}</p>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="scheduled">Scheduled</option>
        </Select>
      </div>

      {loading ? (
        <Skeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="📢" title="No announcements" description="Create an announcement to notify students." />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <div key={a.id} className="bg-gray-900/70 border border-gray-800 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h3 className="text-white font-semibold">{a.title}</h3>
                    <Badge tone={priorityTone[a.priority]}>{a.priority}</Badge>
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">{a.body}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-gray-500">
                    <Badge tone={audienceTone[a.audience]}>Audience: {a.audience}</Badge>
                    <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                    {a.publishedAt && <span>Published {new Date(a.publishedAt).toLocaleDateString()}</span>}
                    {a.scheduledAt && <span>Scheduled {new Date(a.scheduledAt).toLocaleDateString()}</span>}
                    <span>Created {new Date(a.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {a.status === "draft" && (
                    <Button variant="success" className="px-3 py-1.5 text-xs" onClick={() => publishNow(a)}>
                      Publish
                    </Button>
                  )}
                  <IconButton title="Edit" onClick={() => openEdit(a)}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </IconButton>
                  <IconButton title="Delete" onClick={() => setDeleting(a)} className="hover:text-red-400 hover:bg-red-500/10">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </IconButton>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit modal */}
      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        title={editingId ? "Edit Announcement" : "New Announcement"}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            <Button loading={busy} onClick={handleSave}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Title">
            <TextInput
              placeholder="e.g. TCS Off-Campus Drive"
              value={form?.title || ""}
              onChange={(e) => setForm((p) => p && { ...p, title: e.target.value })}
            />
          </Field>
          <Field label="Message">
            <TextArea
              rows={4}
              placeholder="Write the announcement message..."
              value={form?.body || ""}
              onChange={(e) => setForm((p) => p && { ...p, body: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Audience">
              <Select value={form?.audience || "all"} onChange={(e) => setForm((p) => p && { ...p, audience: e.target.value as Announcement["audience"] })}>
                <option value="all">All Students</option>
                <option value="students">Students</option>
                <option value="placed">Placed</option>
                <option value="freshers">Freshers</option>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form?.priority || "normal"} onChange={(e) => setForm((p) => p && { ...p, priority: e.target.value as Announcement["priority"] })}>
                <option value="normal">Normal</option>
                <option value="important">Important</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={form?.status || "draft"} onChange={(e) => setForm((p) => p && { ...p, status: e.target.value as Announcement["status"] })}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
              </Select>
            </Field>
            <Field label="Schedule Date (optional)">
              <TextInput
                type="datetime-local"
                value={form?.scheduledAt ? new Date(form.scheduledAt).toISOString().slice(0, 16) : ""}
                onChange={(e) => setForm((p) => p && { ...p, scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
              />
            </Field>
          </div>
        </div>
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
          Delete announcement <span className="text-white font-semibold">{deleting?.title}</span>?
        </p>
      </Modal>
    </div>
  );
}
