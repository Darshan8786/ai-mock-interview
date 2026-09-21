import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { alumniApi, type Alumni, type Pagination } from "../../admin/alumniApi";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Table } from "../../components/admin/Table";
import { Badge } from "../../components/admin/Badge";
import { Button, IconButton } from "../../components/admin/Button";
import { Modal } from "../../components/admin/Modal";
import { TableSkeleton } from "../../components/admin/Skeleton";
import { EmptyState } from "../../components/admin/EmptyState";
import { ErrorState } from "../../components/admin/ErrorState";
import { TextInput, Select } from "../../components/admin/Inputs";

const PAGE_SIZE = 10;

export function AlumniManagement() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Alumni[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "none">("all");
  const [page, setPage] = useState(1);

  const [deleting, setDeleting] = useState<Alumni | null>(null);
  const [busy, setBusy] = useState(false);

  // Wait for the admin to stop typing before hitting the server, and restart at page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await alumniApi.list({
        search: debounced,
        hasOpening: filter === "all" ? undefined : filter === "open",
        page,
        limit: PAGE_SIZE,
      });
      setItems(res.items);
      setPagination(res.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alumni.");
    } finally {
      setLoading(false);
    }
  }, [debounced, filter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await alumniApi.remove(deleting._id);
      toast.success("Alumni deleted");
      setDeleting(null);
      // Step back a page if that was the last row on this one.
      if (items.length === 1 && page > 1) setPage(page - 1);
      else await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete alumni");
    } finally {
      setBusy(false);
    }
  };

  const total = pagination?.total ?? 0;

  return (
    <div>
      <PageHeader
        title="Alumni"
        subtitle="Manage alumni and the job openings they share with students"
        actions={
          <Button variant="primary" onClick={() => navigate("/admin/alumni/new")}>
            + Add Alumni
          </Button>
        }
      />

      {error && <ErrorState message={error} onRetry={load} />}

      <Card
        title={`Alumni (${total})`}
        actions={
          <div className="flex flex-col sm:flex-row gap-2">
            <TextInput
              placeholder="Search name, company, role, department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="sm:w-72"
            />
            <Select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as "all" | "open" | "none");
                setPage(1);
              }}
            >
              <option value="all">All alumni</option>
              <option value="open">With job opening</option>
              <option value="none">Without job opening</option>
            </Select>
          </div>
        }
      >
        {loading ? (
          <TableSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon="🎓"
            title={debounced || filter !== "all" ? "No alumni match your search" : "No alumni yet"}
            description={debounced || filter !== "all" ? "Try a different search or filter." : "Add an alumnus to get started."}
          />
        ) : (
          <>
            <Table<Alumni>
              columns={[
                { key: "alumni", header: "Alumni" },
                { key: "grad", header: "Graduated" },
                { key: "dept", header: "Department" },
                { key: "work", header: "Company / Role" },
                { key: "opening", header: "Opening" },
                { key: "actions", header: "Actions", className: "text-right" },
              ]}
              rows={items}
              renderRow={(a) => (
                <>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-white">
                        {a.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium">{a.name}</p>
                        <p className="text-xs text-gray-500">{a.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-300">{a.graduationYear}</td>
                  <td className="py-3 px-4 text-gray-300">{a.department}</td>
                  <td className="py-3 px-4">
                    <p className="text-gray-200">{a.currentCompany}</p>
                    <p className="text-xs text-gray-500">{a.currentJobRole}</p>
                  </td>
                  <td className="py-3 px-4">
                    {a.hasOpening ? <Badge tone="green">Job Opening Available</Badge> : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton title="View details" onClick={() => navigate(`/admin/alumni/${a._id}`)} className="hover:text-blue-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </IconButton>
                      <IconButton title="Edit" onClick={() => navigate(`/admin/alumni/${a._id}/edit`)}>
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
                  </td>
                </>
              )}
            />

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
                <span>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" disabled={!pagination.hasPrev} onClick={() => setPage(page - 1)}>
                    ← Previous
                  </Button>
                  <Button variant="ghost" disabled={!pagination.hasNext} onClick={() => setPage(page + 1)}>
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

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
          Delete <span className="text-white font-semibold">{deleting?.name}</span>
          {deleting?.hasOpening && " and their job opening"}? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
