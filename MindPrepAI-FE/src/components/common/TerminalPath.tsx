import { useLocation } from "react-router-dom";

/** Database ids, UUIDs and numbers in the URL are noise in a breadcrumb. */
const looksLikeId = (seg: string) => /^[0-9a-f]{12,}$/i.test(seg) || /^\d+$/.test(seg) || /^[0-9a-f-]{20,}$/i.test(seg);

/** Terminal-style location for the top bar, e.g. `~/practice/aptitude ▌`. */
export function TerminalPath({ className = "" }: { className?: string }) {
  const { pathname } = useLocation();
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((s) => (looksLikeId(s) ? ":id" : s));

  return (
    <p className={`font-mono text-[13px] text-muted truncate ${className}`} aria-label={`Current page: ${segments.join(" / ") || "home"}`}>
      <span className="text-accent-fg">~</span>
      {segments.map((s, i) => (
        <span key={i}>
          <span className="text-subtle">/</span>
          <span className={i === segments.length - 1 ? "text-fg font-medium" : ""}>{s}</span>
        </span>
      ))}
      <span className="cse-caret text-accent-fg" aria-hidden />
    </p>
  );
}
