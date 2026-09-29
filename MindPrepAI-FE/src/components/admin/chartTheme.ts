// Two-colour chart palette: indigo + violet.
export const chartColors = {
  blue: "#4f46e5", // indigo (kept under the "blue" key so existing charts pick it up)
  indigo: "#4f46e5",
  purple: "#8b5cf6",
  violet: "#8b5cf6",
  emerald: "#8b5cf6",
  amber: "#a5b4fc",
  pink: "#8b5cf6",
  red: "#c4b5fd",
  cyan: "#818cf8",
  grid: "#e0e7ff",
  axis: "#94a3b8",
};

/** ATS ranges low -> high: light violet to deep indigo. */
export const atsColors = ["#ddd6fe", "#c4b5fd", "#a78bfa", "#818cf8", "#4f46e5"];

/** Readiness buckets (ready, almost, needs work, no activity). */
export const readinessColors = ["#4f46e5", "#8b5cf6", "#c4b5fd", "#e2e8f0"];

export const chartTooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e0e7ff",
  borderRadius: "12px",
  color: "#0f172a",
  fontSize: "12px",
  boxShadow: "0 10px 30px rgba(79,70,229,0.15)",
};
