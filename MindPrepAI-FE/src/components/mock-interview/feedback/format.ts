// Small presentation helpers shared by the explainable-feedback components. Colour thresholds match the
// existing report page (80 / 60) so old and new sections read the same.

export const scoreText = (s: number) => (s >= 80 ? "text-emerald-400" : s >= 60 ? "text-yellow-400" : "text-red-400");
export const scoreBar = (s: number) => (s >= 80 ? "bg-emerald-500" : s >= 60 ? "bg-yellow-500" : "bg-red-500");

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function fmtDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export const cardClass = "bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700";
