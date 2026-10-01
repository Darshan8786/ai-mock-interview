import { createElement } from "react";

// Chart palette for the admin panel. Grid, axis and tooltip colours are CSS
// variables so charts follow the light/dark theme.
export const chartColors = {
  blue: "#6366f1", // indigo (kept under the "blue" key so existing charts pick it up)
  indigo: "#6366f1",
  purple: "#8b5cf6",
  violet: "#8b5cf6",
  emerald: "#10b981",
  amber: "#f59e0b",
  pink: "#ec4899",
  red: "#f43f5e",
  cyan: "#06b6d4",
  grid: "var(--line)",
  axis: "var(--muted)",
};

/** ATS ranges low -> high: light violet to deep indigo. */
export const atsColors = ["#ddd6fe", "#c4b5fd", "#a78bfa", "#818cf8", "#4f46e5"];

/** Readiness buckets (ready, almost, needs work, no activity). */
export const readinessColors = ["#10b981", "#8b5cf6", "#f59e0b", "#94a3b8"];

export const chartTooltipStyle = {
  backgroundColor: "var(--surface)",
  border: "1px solid var(--line)",
  borderRadius: "10px",
  color: "var(--fg)",
  fontSize: "12px",
  boxShadow: "var(--shadow-pop)",
};

/** Recharts legend labels default to the series colour, which is unreadable
 * for light series on a white card; keep the colour in the swatch only. */
export const legendLabel = (value: string) =>
  createElement("span", { style: { color: "var(--fg-2)" } }, value);
