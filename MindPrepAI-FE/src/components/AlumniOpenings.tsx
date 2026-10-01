import { useEffect, useState } from "react";
import { getAlumniOpenings, type PublicAlumniOpening } from "../admin/alumniApi";

const isHttpUrl = (u: string) => /^https?:\/\//i.test(u);

/**
 * Student-facing list of job openings shared by alumni (public, no login needed).
 * Hidden when there are none; shows a short note if the alumni service is down.
 */
export function AlumniOpenings() {
  const [openings, setOpenings] = useState<PublicAlumniOpening[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getAlumniOpenings()
      .then(setOpenings)
      .catch((err) => {
        console.warn("Could not load alumni openings:", err);
        setFailed(true);
      });
  }, []);

  if (failed) {
    return <p className="mt-12 text-center text-sm text-subtle">Alumni job openings are unavailable right now.</p>;
  }
  if (!openings || openings.length === 0) return null;

  return (
    <section className="mt-14">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-fg mb-1">Openings from Alumni</h2>
        <p className="text-muted text-sm">Roles shared directly by MindPrep alumni. Apply through the link on each card.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {openings.map((o) => (
          <div
            key={o.id}
            className="rounded-2xl bg-surface border border-line p-6 transition-all hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/10 flex flex-col"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="w-11 h-11 rounded-xl bg-surface border border-line flex items-center justify-center text-sm font-bold text-fg">
                {o.currentCompany.slice(0, 2).toUpperCase()}
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                Alumni Opening
              </span>
            </div>

            <h3 className="text-lg font-bold text-fg leading-snug">{o.jobTitle}</h3>
            <p className="text-sm text-muted mb-1">
              Shared by {o.alumniName} · {o.currentJobRole}, {o.currentCompany}
            </p>
            <p className="text-sm text-muted mb-3">📍 {o.location}</p>
            <p className="text-sm text-fg-2 mb-4 line-clamp-3">{o.jobDescription}</p>

            <div className="flex flex-wrap gap-2 mb-4">
              {o.requiredSkills.slice(0, 5).map((s) => (
                <span key={s} className="text-xs px-2 py-1 rounded-md bg-surface text-fg-2">
                  {s}
                </span>
              ))}
            </div>

            <div className="mt-auto space-y-3">
              <p className="text-xs text-subtle">Apply by {new Date(o.lastDateToApply).toLocaleDateString()}</p>
              {isHttpUrl(o.applicationLink) ? (
                <a
                  href={o.applicationLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                >
                  Apply ↗
                </a>
              ) : (
                <p className="text-xs text-red-600 dark:text-red-400">Application link unavailable.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
