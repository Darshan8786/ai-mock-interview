import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { alumniApi, type Alumni } from "../../admin/alumniApi";
import { PageHeader } from "../../components/admin/PageHeader";
import { Card } from "../../components/admin/Card";
import { Badge } from "../../components/admin/Badge";
import { Button } from "../../components/admin/Button";
import { ErrorState } from "../../components/admin/ErrorState";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2.5 border-b border-gray-800 last:border-0">
      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wider pt-0.5">{label}</dt>
      <dd className="col-span-2 text-sm text-gray-200 break-words">{children}</dd>
    </div>
  );
}

const link = "text-blue-400 hover:underline";
const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function AlumniDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [alumni, setAlumni] = useState<Alumni | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    alumniApi
      .get(id)
      .then(setAlumni)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load alumni"))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  if (loading) return <div className="flex items-center justify-center py-24 text-gray-400">Loading alumni...</div>;

  const o = alumni?.opening;
  const expired = o ? new Date(o.lastDateToApply).getTime() < Date.now() : false;

  return (
    <div>
      <PageHeader
        title={alumni?.name || "Alumni"}
        subtitle={alumni ? `${alumni.currentJobRole} at ${alumni.currentCompany}` : undefined}
        actions={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate("/admin/alumni")}>← Back to Alumni</Button>
            {alumni && <Button variant="primary" onClick={() => navigate(`/admin/alumni/${alumni._id}/edit`)}>Edit</Button>}
          </div>
        }
      />

      {error && <ErrorState message={error} onRetry={load} />}

      {alumni && (
        <div className="space-y-6">
          <Card
            title="Alumni Details"
            actions={alumni.hasOpening ? <Badge tone="green">Job Opening Available</Badge> : undefined}
          >
            <dl>
              <Row label="Name">{alumni.name}</Row>
              <Row label="Graduation Year">{alumni.graduationYear}</Row>
              <Row label="Department">{alumni.department}</Row>
              <Row label="Current Company">{alumni.currentCompany}</Row>
              <Row label="Current Job Role">{alumni.currentJobRole}</Row>
              <Row label="Email">
                <a href={`mailto:${alumni.email}`} className={link}>{alumni.email}</a>
              </Row>
              <Row label="LinkedIn">
                {alumni.linkedin ? (
                  <a href={alumni.linkedin} target="_blank" rel="noopener noreferrer" className={link}>{alumni.linkedin}</a>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </Row>
            </dl>
          </Card>

          {alumni.hasOpening && o && (
            <Card title="Job Opening" actions={expired ? <Badge tone="red">Closed</Badge> : undefined}>
              <dl>
                <Row label="Job Title">{o.jobTitle}</Row>
                <Row label="Location">{o.location}</Row>
                <Row label="Required Skills">
                  {o.requiredSkills.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {o.requiredSkills.map((s) => (
                        <Badge key={s} tone="blue">{s}</Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </Row>
                <Row label="Job Description"><span className="whitespace-pre-line">{o.jobDescription}</span></Row>
                <Row label="Application Link">
                  <a href={o.applicationLink} target="_blank" rel="noopener noreferrer" className={link}>{o.applicationLink}</a>
                </Row>
                <Row label="Last Date to Apply">
                  <span className={expired ? "text-red-400" : ""}>{formatDate(o.lastDateToApply)}</span>
                </Row>
              </dl>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
